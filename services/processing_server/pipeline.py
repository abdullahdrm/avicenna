from __future__ import annotations

import io
import logging
import time
from typing import Any, Dict, Optional, Tuple

import requests
from PIL import Image, ImageOps

try:
    import cv2
except Exception:
    cv2 = None

import numpy as np

from models import (
    AnalysisRequest,
    AnalysisResult,
    Comparison,
    Metrics,
    ValidationResult,
)
from storage import ProcessingStore
from image_processing import create_dermnet_processor, ProcessingConfig

logger = logging.getLogger(__name__)


def _download_image(url: str) -> bytes:
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    return resp.content


def _load_pil(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    return img


def _to_gray_resized(img: Image.Image, size: int = 256) -> Image.Image:
    img_gray = img.convert("L")
    w, h = img_gray.size
    if max(w, h) > size:
        if w >= h:
            new_w = size
            new_h = int(h * size / w)
        else:
            new_h = size
            new_w = int(w * size / h)
        img_gray = img_gray.resize((new_w, new_h), Image.BILINEAR)
    return img_gray


def _brightness_contrast(gray_img: Image.Image) -> Tuple[float, float]:
    arr = np.array(gray_img, dtype="float32")
    return float(arr.mean()), float(arr.std())


def _blur_score(gray_img: Image.Image) -> Optional[float]:
    if cv2 is None:
        return None
    arr = np.array(gray_img, dtype="uint8")
    lap = cv2.Laplacian(arr, cv2.CV_64F)
    return float(lap.var())


def _image_quality(image_bytes: bytes) -> ValidationResult:
    gray = _to_gray_resized(_load_pil(image_bytes), size=256)
    mean, std = _brightness_contrast(gray)
    blur = _blur_score(gray)

    thresholds: Dict[str, Any] = {
        "min_mean": 60.0,
        "max_mean": 200.0,
        "min_std": 15.0,
        "max_clip_ratio": 0.5,
        "min_laplacian_var": 60.0,
    }

    arr = np.array(gray, dtype="uint8")
    total = arr.size
    black_ratio = float((arr < 10).sum()) / total
    white_ratio = float((arr > 245).sum()) / total

    reasons: list[str] = []

    if mean < thresholds["min_mean"]:
        reasons.append("too_dark")
    elif mean > thresholds["max_mean"]:
        reasons.append("too_bright")

    if std < thresholds["min_std"]:
        reasons.append("low_contrast")

    if black_ratio > thresholds["max_clip_ratio"]:
        reasons.append("too_much_black")
    if white_ratio > thresholds["max_clip_ratio"]:
        reasons.append("too_much_white")

    if blur is not None and blur < thresholds["min_laplacian_var"]:
        reasons.append("too_blurry")

    details: Dict[str, Any] = {
        "mean": mean,
        "std": std,
        "black_ratio": black_ratio,
        "white_ratio": white_ratio,
        "blur_var": blur,
        "thresholds": thresholds,
    }

    return ValidationResult(is_valid=len(reasons) == 0, reasons=reasons, details=details)


def _vit_stub(image_bytes: bytes, req: AnalysisRequest) -> Metrics:
    import hashlib

    h = hashlib.sha256(str(req.image_url).encode("utf-8")).hexdigest()
    lesions = int(h[:4], 16) % 40
    sev_raw = int(h[4:8], 16) % 100
    sev = sev_raw / 100.0

    per_region = {
        "forehead": int(lesions * 0.3),
        "left_cheek": int(lesions * 0.35),
        "right_cheek": int(lesions * 0.35),
    }

    extra = {"problem_type": req.problem_type.value, "is_follow_up": req.is_follow_up}
    return Metrics(lesion_count=lesions, severity_score=sev, per_region=per_region, extra=extra)


def _compare(previous: Optional[AnalysisResult], current: Metrics) -> Optional[Comparison]:
    if previous is None or previous.metrics is None:
        return None
    baseline = previous.metrics
    base_lesions = baseline.lesion_count
    curr_lesions = current.lesion_count
    if base_lesions == 0:
        improvement = 0.0
    else:
        improvement = (base_lesions - curr_lesions) / base_lesions
    notes = f"baseline={base_lesions}, current={curr_lesions}"
    return Comparison(improvement_score=float(improvement), notes=notes)


def run_analysis_pipeline(req: AnalysisRequest, store: ProcessingStore) -> AnalysisResult:
    logger.info(
        "run pipeline request_id=%s case_id=%s image_id=%s",
        req.request_id,
        req.case_id,
        req.image_id,
    )
    start_ts = time.perf_counter()

    img_bytes = _download_image(str(req.image_url))
    logger.debug("Downloaded image: %d bytes", len(img_bytes))

    img_path_original = store.build_image_path(req.case_id, f"{req.image_id}_original", ext=".jpg")
    img_path_original.write_bytes(img_bytes)
    logger.debug("Saved original image: %s", img_path_original)

    # image quality check - similar thing also in backend but it fails sometimes and server can be used by others too.
    validation = _image_quality(img_bytes)

    if not validation.is_valid:
        end_ts = time.perf_counter()
        res = AnalysisResult(
            request_id=req.request_id,
            case_id=req.case_id,
            image_id=req.image_id,
            is_valid=False,
            validation=validation,
            metrics=None,
            comparison=None,
            processing_time_ms=int((end_ts - start_ts) * 1000),
        )
        store.save_analysis(req.case_id, req.image_id, img_path_original, res)
        return res

    # Preprocess image for CV model
    processor = create_dermnet_processor()
    img_path_processed = store.build_image_path(req.case_id, req.image_id, ext=".jpg")
    
    logger.info("Preprocessing image to DermNet format...")
    preprocess_result = processor.process_from_bytes(img_bytes, img_path_processed)
    
    if not preprocess_result.success:
        logger.error("Image preprocessing failed: %s", preprocess_result.warnings)
        # fail original
        img_path_processed = img_path_original
    else:
        logger.info(
            "Preprocessing complete: %dx%d -> %dx%d (%.1fKB)",
            preprocess_result.original_size[0],
            preprocess_result.original_size[1],
            preprocess_result.processed_size[0],
            preprocess_result.processed_size[1],
            preprocess_result.file_size_kb
        )

    # TODO: Rep _vit_stub with our cv
    metrics = _vit_stub(img_bytes, req)
    
    prev = store.get_latest_analysis_for_case(req.case_id)
    comparison = _compare(prev, metrics)

    end_ts = time.perf_counter()
    res = AnalysisResult(
        request_id=req.request_id,
        case_id=req.case_id,
        image_id=req.image_id,
        is_valid=True,
        validation=validation,
        metrics=metrics,
        comparison=comparison,
        processing_time_ms=int((end_ts - start_ts) * 1000),
        extra={
            "preprocessing": preprocess_result.model_dump() if preprocess_result.success else {},
            "original_image_path": str(img_path_original),
            "processed_image_path": str(img_path_processed),
        }
    )
    store.save_analysis(req.case_id, req.image_id, img_path_processed, res)
    return res
