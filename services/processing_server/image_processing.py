# Çağla B. Çam
# 15 Dec 2025

# Image processing module

from __future__ import annotations

import io
import logging
from enum import Enum
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from pydantic import BaseModel, Field
import cv2

logger = logging.getLogger(__name__)


class ImageFormat(str, Enum):
    JPEG = "JPEG"
    PNG = "PNG" # only supports these


class ProcessingQuality(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    ULTRA = "ultra" # quality


class ProcessingConfig(BaseModel):
    """Config for image preprocessing"""
    
    # dimensions (for now 512x512 confirm with cv)
    target_size: Tuple[int, int] = Field(default=(512, 512), description="Target image dimensions (width, height)")
    
    # output settings
    quality: ProcessingQuality = Field(default=ProcessingQuality.HIGH)
    output_format: ImageFormat = Field(default=ImageFormat.JPEG)
    jpeg_quality: int = Field(default=95, ge=1, le=100)
    
    # color norm
    normalize_colors: bool = Field(default=True)
    auto_contrast: bool = Field(default=True)
    
    # lighting
    equalize_histogram: bool = Field(default=False)
    gamma_correction: Optional[float] = Field(default=None, ge=0.1, le=3.0)
    
    # clahe
    use_clahe: bool = Field(default=True)
    clahe_clip_limit: float = Field(default=2.0, ge=1.0, le=5.0)
    clahe_tile_grid_size: Tuple[int, int] = Field(default=(8, 8))
    
    # color constancy (gray_world, shades_of_gray, none)
    color_constancy_method: str = Field(default="shades_of_gray")
    shades_of_gray_p: float = Field(default=6.0, ge=1.0, le=10.0)
    
    # roi/skin detection
    detect_skin_roi: bool = Field(default=True)
    roi_padding: float = Field(default=0.1, ge=0.0, le=0.3)
    
    # denoising
    denoise: bool = Field(default=True)
    denoise_strength: int = Field(default=1, ge=1, le=5)
    
    # sharpen
    sharpen: bool = Field(default=False)
    sharpen_strength: float = Field(default=1.0, ge=0.0, le=3.0)
    
    # resize settings
    preserve_aspect_ratio: bool = Field(default=False)
    padding_color: Tuple[int, int, int] = Field(default=(255, 255, 255))
    
    # validation
    min_resolution: Tuple[int, int] = Field(default=(224, 224))
    max_file_size_mb: float = Field(default=10.0, ge=0.1, le=50.0)


class ProcessingResult(BaseModel):
    success: bool
    processed_image_path: Optional[str] = None
    original_size: Tuple[int, int]
    processed_size: Tuple[int, int]
    file_size_kb: float
    format: str
    warnings: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ImageProcessor:
    
    def __init__(self, config: Optional[ProcessingConfig] = None):
        self.config = config or ProcessingConfig()
        logger.info("ImageProcessor initialized with: %s", self.config.model_dump())
    
    def process(
        self,
        input_path: Path,
        output_path: Optional[Path] = None,
    ) -> ProcessingResult:
        logger.info("Processing image: %s", input_path)
        warnings = []
        
        try:
            # load image
            img = Image.open(input_path)
            original_size = img.size
            original_format = img.format or "UNKNOWN"
            
            # apply exif
            img = ImageOps.exif_transpose(img)
            
            # convert to rgb if not rgb
            if img.mode != "RGB":
                logger.debug("Converting from %s to RGB", img.mode)
                img = img.convert("RGB")
            
            # validate minimum res
            if (img.size[0] < self.config.min_resolution[0] or 
                img.size[1] < self.config.min_resolution[1]):
                warnings.append(
                    f"Image resolution {img.size} below minimum {self.config.min_resolution}"
                )
        
            # color constancy
            img = self._remove_color_cast(img)
            
            # roi detection and crop
            if self.config.detect_skin_roi:
                img = self._crop_to_roi(img)
            
            # clahe on l-channel
            if self.config.use_clahe:
                img = self._apply_clahe(img)
            
            # denoising
            if self.config.denoise:
                img = self._denoise(img)
            
            # gamma correction
            if self.config.gamma_correction:
                img = self._apply_gamma_correction(img)
            
            # additional processing
            if self.config.normalize_colors:
                img = self._normalize_colors(img)
            if self.config.auto_contrast:
                img = self._auto_contrast(img)
            if self.config.equalize_histogram:
                img = self._equalize_histogram(img)
            if self.config.sharpen:
                img = self._sharpen(img)
            
            # resize to target dimensions
            img = self._resize(img)
            processed_size = img.size
            
            # save
            output_path = output_path or input_path
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            save_kwargs = {}
            if self.config.output_format == ImageFormat.JPEG:
                save_kwargs["quality"] = self.config.jpeg_quality
                save_kwargs["optimize"] = True
            
            img.save(output_path, format=self.config.output_format.value, **save_kwargs)
            
            # get file size
            file_size_kb = output_path.stat().st_size / 1024
            
            # check file size
            if file_size_kb > self.config.max_file_size_mb * 1024:
                warnings.append(
                    f"Processed file size {file_size_kb:.1f}KB exceeds maximum {self.config.max_file_size_mb}MB"
                )
            
            logger.info(
                "Processing complete: %s -> %s (%dx%d -> %dx%d, %.1fKB)",
                input_path.name,
                output_path.name,
                original_size[0], original_size[1],
                processed_size[0], processed_size[1],
                file_size_kb
            )
            
            return ProcessingResult(
                success=True,
                processed_image_path=str(output_path),
                original_size=original_size,
                processed_size=processed_size,
                file_size_kb=file_size_kb,
                format=self.config.output_format.value,
                warnings=warnings,
                metadata={
                    "original_format": original_format,
                    "config": self.config.model_dump()
                }
            )
            
        except Exception as e:
            logger.exception("Error processing image %s", input_path)
            return ProcessingResult(
                success=False,
                processed_image_path=None,
                original_size=(0, 0),
                processed_size=(0, 0),
                file_size_kb=0.0,
                format="UNKNOWN",
                warnings=[f"Processing failed: {str(e)}"],
                metadata={}
            )
    
    def process_from_bytes(
        self,
        image_bytes: bytes,
        output_path: Path,
    ) -> ProcessingResult:
        # temp file
        temp_input = output_path.parent / f"_temp_input_{output_path.name}"
        temp_input.write_bytes(image_bytes)
        
        try:
            result = self.process(temp_input, output_path)
            return result
        finally:
            # cleanup
            if temp_input.exists():
                temp_input.unlink()
    
    def _resize(self, img: Image.Image) -> Image.Image:
        # resize to target
        target_w, target_h = self.config.target_size
        
        if self.config.preserve_aspect_ratio:
            # maintain aspect + pad
            img.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
            
            new_img = Image.new("RGB", (target_w, target_h), self.config.padding_color)
            
            paste_x = (target_w - img.size[0]) // 2
            paste_y = (target_h - img.size[1]) // 2
            new_img.paste(img, (paste_x, paste_y))
            
            return new_img
        else:
            return img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    def _denoise(self, img: Image.Image) -> Image.Image:
        # median filter
        for _ in range(self.config.denoise_strength):
            img = img.filter(ImageFilter.MedianFilter(size=3))
        return img
    
    def _sharpen(self, img: Image.Image) -> Image.Image:
        # sharpen
        enhancer = ImageEnhance.Sharpness(img)
        return enhancer.enhance(1.0 + self.config.sharpen_strength)
    
    def _normalize_colors(self, img: Image.Image) -> Image.Image:
        # normalize 0-255
        arr = np.array(img, dtype=np.float32)
        
        for i in range(3):
            channel = arr[:, :, i]
            c_min, c_max = channel.min(), channel.max()
            if c_max > c_min:
                arr[:, :, i] = (channel - c_min) / (c_max - c_min) * 255
        
        return Image.fromarray(arr.astype(np.uint8))
    
    def _auto_contrast(self, img: Image.Image) -> Image.Image:
        return ImageOps.autocontrast(img, cutoff=2)
    
    def _equalize_histogram(self, img: Image.Image) -> Image.Image:
        return ImageOps.equalize(img)
    
    def _apply_gamma_correction(self, img: Image.Image) -> Image.Image:
        if self.config.gamma_correction is None:
            return img
        
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = np.power(arr, self.config.gamma_correction)
        arr = (arr * 255).clip(0, 255).astype(np.uint8)
        
        return Image.fromarray(arr)
    
    def _remove_color_cast(self, img: Image.Image) -> Image.Image:
        if self.config.color_constancy_method == "none":
            return img
        elif self.config.color_constancy_method == "gray_world":
            return self._gray_world(img)
        elif self.config.color_constancy_method == "shades_of_gray":
            return self._shades_of_gray(img)
        else:
            logger.warning("Unknown color constancy method: %s, using gray_world", self.config.color_constancy_method)
            return self._gray_world(img)
    
    def _gray_world(self, img: Image.Image) -> Image.Image:
        # gray world algo
        arr = np.array(img, dtype=np.float32)
        
        avg_r = arr[:, :, 0].mean()
        avg_g = arr[:, :, 1].mean()
        avg_b = arr[:, :, 2].mean()
        
        avg_gray = (avg_r + avg_g + avg_b) / 3.0
        
        if avg_r == 0 or avg_g == 0 or avg_b == 0:
            return img
        
        arr[:, :, 0] = arr[:, :, 0] * (avg_gray / avg_r)
        arr[:, :, 1] = arr[:, :, 1] * (avg_gray / avg_g)
        arr[:, :, 2] = arr[:, :, 2] * (avg_gray / avg_b)
        
        arr = arr.clip(0, 255).astype(np.uint8)
        
        return Image.fromarray(arr)
    
    def _shades_of_gray(self, img: Image.Image) -> Image.Image:
        # minkowski p-norm
        arr = np.array(img, dtype=np.float32)
        p = self.config.shades_of_gray_p
        
        norm_r = np.power(np.power(arr[:, :, 0], p).mean(), 1.0/p)
        norm_g = np.power(np.power(arr[:, :, 1], p).mean(), 1.0/p)
        norm_b = np.power(np.power(arr[:, :, 2], p).mean(), 1.0/p)
        
        norm_gray = (norm_r + norm_g + norm_b) / 3.0
        
        if norm_r == 0 or norm_g == 0 or norm_b == 0:
            return img
        
        arr[:, :, 0] = arr[:, :, 0] * (norm_gray / norm_r)
        arr[:, :, 1] = arr[:, :, 1] * (norm_gray / norm_g)
        arr[:, :, 2] = arr[:, :, 2] * (norm_gray / norm_b)
        
        arr = arr.clip(0, 255).astype(np.uint8)
        
        return Image.fromarray(arr)
    
    def _apply_clahe(self, img: Image.Image) -> Image.Image:
        # clahe
        arr = np.array(img)
        
        lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        clahe = cv2.createCLAHE(
            clipLimit=self.config.clahe_clip_limit,
            tileGridSize=self.config.clahe_tile_grid_size
        )
        
        # l-channel only
        l_clahe = clahe.apply(l)
        
        lab_clahe = cv2.merge([l_clahe, a, b])
        rgb_clahe = cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2RGB)
        
        return Image.fromarray(rgb_clahe)
    
    def _detect_skin_roi(self, img: Image.Image) -> Optional[Tuple[int, int, int, int]]:
        # hsv skin detection
        try:
            arr = np.array(img)
            
            # hsv conversion
            hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
            
            # skin range
            lower_skin = np.array([0, 20, 70], dtype=np.uint8)
            upper_skin = np.array([20, 255, 255], dtype=np.uint8)
            
            # mask
            mask = cv2.inRange(hsv, lower_skin, upper_skin)
            
            # morphology
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            
            # contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return None
            
            # largest = skin
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # padding
            img_h, img_w = arr.shape[:2]
            padding_x = int(w * self.config.roi_padding)
            padding_y = int(h * self.config.roi_padding)
            
            x = max(0, x - padding_x)
            y = max(0, y - padding_y)
            w = min(img_w - x, w + 2 * padding_x)
            h = min(img_h - y, h + 2 * padding_y)
            
            # validate size (min 25%)
            roi_area = w * h
            img_area = img_w * img_h
            if roi_area < img_area * 0.25:
                logger.warning("ROI too small (%d%% of image), skipping ROI detection", int(roi_area/img_area*100))
                return None
            
            return (x, y, w, h)
            
        except Exception as e:
            logger.warning("Skin ROI detection failed: %s", e)
            return None
    
    def _crop_to_roi(self, img: Image.Image) -> Image.Image:
        """Crop image to detected skin ROI"""
        roi = self._detect_skin_roi(img)
        
        if roi is None:
            logger.debug("No ROI detected, using full image")
            return img
        
        x, y, w, h = roi
        arr = np.array(img)
        cropped = arr[y:y+h, x:x+w]
        
        logger.debug("Cropped to ROI: (%d,%d,%d,%d)", x, y, w, h)
        return Image.fromarray(cropped)


def create_dermnet_processor() -> ImageProcessor:
    # dermnet pipeline factory
    config = ProcessingConfig(
        target_size=(512, 512),
        quality=ProcessingQuality.HIGH,
        output_format=ImageFormat.JPEG,
        jpeg_quality=95,
        
        # color constancy
        color_constancy_method="shades_of_gray",
        shades_of_gray_p=6.0,
        
        # clahe
        use_clahe=True,
        clahe_clip_limit=2.0,
        clahe_tile_grid_size=(8, 8),
        
        # roi
        detect_skin_roi=True,
        roi_padding=0.1,
        
        # denoise
        denoise=True,
        denoise_strength=1,
        
        # disable extras
        normalize_colors=False,
        auto_contrast=False,
        equalize_histogram=False,
        gamma_correction=None,
        sharpen=False,
        
        # standard
        preserve_aspect_ratio=False,
        min_resolution=(224, 224),
    )
    
    return ImageProcessor(config)
