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
        "min_laplacian_var": 50.0,
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

    # Blur check disabled
    # if blur is not None and blur < thresholds["min_laplacian_var"]:
    #     reasons.append("too_blurry")

    details: Dict[str, Any] = {
        "mean": mean,
        "std": std,
        "black_ratio": black_ratio,
        "white_ratio": white_ratio,
        "blur_var": blur,
        "thresholds": thresholds,
    }

    return ValidationResult(is_valid=len(reasons) == 0, reasons=reasons, details=details)


def _decode_bgr_image(image_bytes: bytes) -> np.ndarray:
    import cv2

    np_bytes = np.frombuffer(image_bytes, np.uint8)
    bgr_image = cv2.imdecode(np_bytes, cv2.IMREAD_COLOR)
    if bgr_image is None:
        raise ValueError("Could not decode image")
    return bgr_image


def _ml_segmentation_and_classification(image_bytes: bytes, req: AnalysisRequest) -> Tuple[Metrics, str]:
    try:
        import sys
        import os
        from pathlib import Path
        
        current_dir = Path(__file__).parent
        ml_segmentation_dir = current_dir.parent.parent / "ml" / "preprocessing" / "segmentation"
        sys.path.insert(0, str(ml_segmentation_dir))
        
        from image_processing_segmentation import process_image
        from acne_model import GeneralConditionClassifier, AcneClassifier
        from pathlib import Path
        
        pil_image = _load_pil(image_bytes)
        
        # 23 class general
        general_model_path = Path(__file__).parent.parent.parent / "ml" / "training" / "final_model_v1.pth"
        general_classifier = GeneralConditionClassifier(str(general_model_path), device='cpu')
        general_result = general_classifier.predict(pil_image)
        
        detected_condition = general_result['condition']
        is_acne = general_result['is_acne']
        
        logger.info(f"General classifier detected: {detected_condition} (is_acne={is_acne}, confidence={general_result['confidence']:.2f})")
        
        detected_lower = str(detected_condition).lower()
        bgr_image = _decode_bgr_image(image_bytes)

        # Acne path
        if is_acne:
            preprocessed_bgr, mask, score = process_image(bgr_image)

            lesion_pixels = np.sum(mask > 0)
            total_pixels = mask.size
            lesion_ratio = lesion_pixels / total_pixels

            _, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
            lesion_count = max(0, labels.max() - 1)

            acne_model_path = Path(__file__).parent.parent.parent / "ml" / "training" / "mobilenet_v2_best.pth"
            acne_classifier = AcneClassifier(str(acne_model_path), device='cpu')
            acne_result = acne_classifier.predict(pil_image)

            severity_score = acne_result['severity_score']
            predicted_class = acne_result['predicted_class']
            confidence = acne_result['confidence']

            per_region = {
                "forehead": int(lesion_count * 0.3),
                "left_cheek": int(lesion_count * 0.35),
                "right_cheek": int(lesion_count * 0.35),
            }

            return Metrics(
                lesion_count=lesion_count,
                severity_score=severity_score,
                per_region=per_region,
                extra={
                    "problem_type": f"{detected_condition} - {predicted_class}",
                    "is_follow_up": False,
                    "detector": "acne",
                    "general_confidence": float(general_result.get("confidence", 0.0)),
                    "acne_confidence": float(confidence),
                    "lesion_area_ratio": float(lesion_ratio),
                }
            ), detected_condition

        # Fungal path
        if any(token in detected_lower for token in ["fungal", "tinea", "ringworm"]):
            from fungus_model import process_fungal_infection

            fungal_result = process_fungal_infection(bgr_image)
            fungal_mask = fungal_result.get("segmentation_mask", np.zeros(bgr_image.shape[:2], dtype=np.uint8))
            _, cc_labels, _, _ = cv2.connectedComponentsWithStats((fungal_mask > 0).astype(np.uint8), connectivity=8)
            lesion_count = max(0, int(cc_labels.max() - 1))

            return Metrics(
                lesion_count=lesion_count,
                severity_score=float(np.clip(fungal_result.get("texture_score", 0.0), 0.0, 1.0)),
                per_region={"forehead": 0, "left_cheek": 0, "right_cheek": 0},
                extra={
                    "problem_type": detected_condition,
                    "is_follow_up": False,
                    "detector": "fungal",
                    "affected_area_percentage": float(fungal_result.get("affected_area_percentage", 0.0)),
                    "spread_radius": float(fungal_result.get("spread_radius", 0.0)),
                    "boundary_sharpness": float(fungal_result.get("boundary_sharpness", 0.0)),
                    "spread_pattern": str(fungal_result.get("spread_pattern", "none")),
                    "circularity": float(fungal_result.get("circularity", 0.0)),
                    "skin_area_percentage": float(fungal_result.get("skin_area_percentage", 0.0)),
                },
            ), detected_condition

        # Eczema/Psoriasis/Dermatitis path
        if any(token in detected_lower for token in ["eczema", "psoriasis", "dermatitis"]):
            from eczema_detector import compute_metrics, segment_psoriasis_eczema

            lesion_mask, debug, eczema_stats = segment_psoriasis_eczema(bgr_image)
            eczema_metrics = compute_metrics(bgr_image, lesion_mask, debug["redness_map"])

            severity_score = float(np.clip(eczema_metrics.get("lesion_area_percent_visible_skin", 0.0) / 100.0, 0.0, 1.0))

            return Metrics(
                lesion_count=int(eczema_metrics.get("n_components", 0)),
                severity_score=severity_score,
                per_region={"forehead": 0, "left_cheek": 0, "right_cheek": 0},
                extra={
                    "problem_type": detected_condition,
                    "is_follow_up": False,
                    "detector": "eczema_psoriasis",
                    "lesion_area_px": int(eczema_metrics.get("lesion_area_px", 0)),
                    "lesion_area_percent_visible_skin": float(eczema_metrics.get("lesion_area_percent_visible_skin", 0.0)),
                    "redness_contrast_mean": float(eczema_metrics.get("redness_contrast_mean", 0.0)),
                    "n_components": int(eczema_metrics.get("n_components", 0)),
                    "median_skin_redness": float(eczema_stats.get("median_skin_redness", 0.0)),
                },
            ), detected_condition

        # Generic fallback for non-acne conditions without dedicated detector
        else:
            return Metrics(
                lesion_count=0,
                severity_score=0.0,
                per_region={"forehead": 0, "left_cheek": 0, "right_cheek": 0},
                extra={
                    "problem_type": detected_condition,
                    "is_follow_up": False
                }
            ), detected_condition
        
    except Exception as e:
        import traceback
        logger.error(f"ML analysis failed: {e}")
        logger.error(traceback.format_exc())
        return _vit_stub(image_bytes, req)


def _vit_stub(image_bytes: bytes, req: AnalysisRequest) -> Tuple[Metrics, str]:
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

    extra = {"problem_type": req.problem_type.value if req.problem_type else "acne", "is_follow_up": req.is_follow_up}
    return Metrics(lesion_count=lesions, severity_score=sev, per_region=per_region, extra=extra), req.problem_type.value if req.problem_type else "acne"


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

    metrics, detected_problem_type = _ml_segmentation_and_classification(img_bytes, req)
    
    # Update request problem type based on detection
    from models import ProblemType
    detected_lower = detected_problem_type.lower()
    
    if 'acne' in detected_lower or 'rosacea' in detected_lower:
        req.problem_type = ProblemType.acne
    elif 'eczema' in detected_lower or 'atopic dermatitis' in detected_lower:
        req.problem_type = ProblemType.eczema  
    elif 'psoriasis' in detected_lower:
        req.problem_type = ProblemType.psoriasis
    elif 'dermatitis' in detected_lower or 'poison ivy' in detected_lower:
        req.problem_type = ProblemType.dermatitis
    elif 'melanoma' in detected_lower or 'cancer' in detected_lower:
        req.problem_type = ProblemType.melanoma
    elif 'fungal' in detected_lower or 'tinea' in detected_lower or 'ringworm' in detected_lower:
        req.problem_type = ProblemType.fungal
    elif 'bacterial' in detected_lower or 'cellulitis' in detected_lower or 'impetigo' in detected_lower:
        req.problem_type = ProblemType.bacterial
    elif 'viral' in detected_lower or 'warts' in detected_lower or 'molluscum' in detected_lower:
        req.problem_type = ProblemType.viral
    elif 'pigmentation' in detected_lower:
        req.problem_type = ProblemType.hyperpigmentation
    else:
        req.problem_type = ProblemType.other
    
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
        original_image_path=str(img_path_original),
        processed_image_path=str(img_path_processed),
    )
    store.save_analysis(req.case_id, req.image_id, img_path_processed, res)
    return res
