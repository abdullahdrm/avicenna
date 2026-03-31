import cv2
import numpy as np
from typing import Any, Dict, Sequence, Tuple
import logging
from skimage.feature import graycomatrix, graycoprops, local_binary_pattern
from skimage.filters import gabor

logger = logging.getLogger(__name__)


def refine_fungal_mask(binary_mask: np.ndarray, max_regions: int = 3) -> np.ndarray:
    h, w = binary_mask.shape
    image_area = h * w

    open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    refined = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, open_kernel)
    refined = cv2.morphologyEx(refined, cv2.MORPH_CLOSE, close_kernel)

    min_area = max(300, int(0.001 * image_area))

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats((refined > 0).astype(np.uint8), connectivity=8)
    if num_labels <= 1:
        return refined

    candidates = []
    for label_id in range(1, num_labels):
        area = stats[label_id, cv2.CC_STAT_AREA]
        if area >= min_area:
            candidates.append((label_id, area))

    if not candidates:
        return np.zeros_like(binary_mask, dtype=np.uint8)

    candidates.sort(key=lambda x: x[1], reverse=True)
    selected_labels = [label_id for label_id, _ in candidates[:max_regions]]

    kept_mask = np.zeros_like(binary_mask, dtype=np.uint8)
    for label_id in selected_labels:
        kept_mask[labels == label_id] = 255

    kept_mask = cv2.medianBlur(kept_mask, 5)
    kept_mask = cv2.morphologyEx(kept_mask, cv2.MORPH_CLOSE, open_kernel)

    return kept_mask


def extract_gabor_features(gray_image: np.ndarray, num_orientations: int = 8, num_scales: int = 3) -> np.ndarray:
    h, w = gray_image.shape
    feature_map = np.zeros((h, w), dtype=np.float32)

    frequencies = [0.1, 0.2, 0.3][:num_scales]

    for frequency in frequencies:
        for theta in np.linspace(0, np.pi, num_orientations, endpoint=False):
            try:
                filtered_real, filtered_imag = gabor(gray_image, frequency=frequency, theta=theta)

                magnitude = np.sqrt(filtered_real**2 + filtered_imag**2)

                feature_map += magnitude
            except Exception as e:
                logger.warning(f"Gabor filter failed for freq={frequency}, theta={theta}: {e}")
                continue

    if feature_map.max() > 0:
        feature_map = feature_map / feature_map.max()

    return feature_map


def extract_lbp_features(gray_image: np.ndarray, radius: int = 3, n_points: int = 24) -> Tuple[np.ndarray, float]:
    try:
        lbp = local_binary_pattern(gray_image, n_points, radius, method='uniform')

        lbp_normalized = lbp / lbp.max() if lbp.max() > 0 else lbp

        hist, _ = np.histogram(lbp.ravel(), bins=n_points + 2, range=(0, n_points + 2))
        hist = hist.astype(float)
        hist = hist / hist.sum() if hist.sum() > 0 else hist

        entropy = -np.sum(hist * np.log2(hist + 1e-10))

        return lbp_normalized.astype(np.float32), float(entropy)

    except Exception as e:
        logger.error(f"LBP extraction failed: {e}")
        return np.zeros_like(gray_image, dtype=np.float32), 0.0


def extract_glcm_features(gray_image: np.ndarray, distances: Sequence[int] = (1, 2, 3)) -> Dict[str, float]:
    try:
        if gray_image.dtype != np.uint8:
            gray_quantized = ((gray_image - gray_image.min()) / 
                            (gray_image.max() - gray_image.min() + 1e-10) * 255).astype(np.uint8)
        else:
            gray_quantized = gray_image

        angles = [0, np.pi/4, np.pi/2, 3*np.pi/4]

        glcm = graycomatrix(gray_quantized, distances=distances, angles=angles, 
                           levels=256, symmetric=True, normed=True)

        contrast = graycoprops(glcm, 'contrast').mean()
        homogeneity = graycoprops(glcm, 'homogeneity').mean()
        energy = graycoprops(glcm, 'energy').mean()
        correlation = graycoprops(glcm, 'correlation').mean()

        return {
            'contrast': float(contrast),
            'homogeneity': float(homogeneity),
            'energy': float(energy),
            'correlation': float(correlation)
        }

    except Exception as e:
        logger.error(f"GLCM extraction failed: {e}")
        return {
            'contrast': 0.0,
            'homogeneity': 0.0,
            'energy': 0.0,
            'correlation': 0.0
        }


def segment_fungal_region(bgr_image: np.ndarray) -> Tuple[np.ndarray, Dict[str, float]]:
    logger.info("Segmenting fungal regions")

    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2LAB)

    h, w = gray.shape
    h_channel = hsv[:, :, 0].astype(np.float32)
    s_channel = hsv[:, :, 1].astype(np.float32)
    v_channel = hsv[:, :, 2].astype(np.float32)
    a_channel = lab[:, :, 1].astype(np.float32)

    y1, y2 = int(0.15 * h), int(0.85 * h)
    x1, x2 = int(0.15 * w), int(0.85 * w)
    center_a = a_channel[y1:y2, x1:x2]
    center_s = s_channel[y1:y2, x1:x2]
    center_v = v_channel[y1:y2, x1:x2]
    center_skin_mask = (center_v > 45) & (center_s < 85)
    if np.any(center_skin_mask):
        skin_a = float(np.median(center_a[center_skin_mask]))
    else:
        skin_a = float(np.median(center_a))

    red_delta = np.clip((a_channel - (skin_a + 4.0)) / 24.0, 0.0, 1.0)
    hue_distance = np.minimum(np.abs(h_channel - 0.0), np.abs(h_channel - 179.0))
    hue_redness = np.clip(1.0 - (hue_distance / 38.0), 0.0, 1.0)
    sat_score = np.clip((s_channel - 14.0) / 80.0, 0.0, 1.0)
    value_gate = np.clip((v_channel - 42.0) / 120.0, 0.0, 1.0)

    score_map = (0.50 * red_delta + 0.30 * hue_redness + 0.20 * sat_score) * value_gate
    valid_region = v_channel > 35.0

    if np.any(valid_region):
        thresh = max(0.16, float(np.percentile(score_map[valid_region], 88)))
    else:
        thresh = 0.18

    raw_mask = (score_map >= thresh).astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    raw_mask = cv2.morphologyEx(raw_mask, cv2.MORPH_OPEN, kernel)
    raw_mask = cv2.morphologyEx(raw_mask, cv2.MORPH_CLOSE, kernel)

    n_labels, cc_labels, stats, _ = cv2.connectedComponentsWithStats((raw_mask > 0).astype(np.uint8), connectivity=8)
    binary_mask = np.zeros_like(raw_mask)
    skin_component_mask = np.zeros_like(raw_mask)
    if n_labels > 1:
        min_area = max(120, int(0.0002 * h * w))
        fungal_candidates = []
        skin_candidates = []
        largest_cc = -1
        largest_area = 0

        for cc_id in range(1, n_labels):
            area = int(stats[cc_id, cv2.CC_STAT_AREA])
            if area > largest_area:
                largest_area = area
                largest_cc = cc_id
            if area < min_area:
                continue

            x = int(stats[cc_id, cv2.CC_STAT_LEFT])
            y = int(stats[cc_id, cv2.CC_STAT_TOP])
            ww = int(stats[cc_id, cv2.CC_STAT_WIDTH])
            hh = int(stats[cc_id, cv2.CC_STAT_HEIGHT])
            touches_border = (x == 0) or (y == 0) or (x + ww >= w) or (y + hh >= h)

            cc_mask = cc_labels == cc_id
            cc_mean_score = float(score_map[cc_mask].mean())
            cc_red_gain = float(np.mean(a_channel[cc_mask]) - skin_a)
            cc_sat = float(np.mean(s_channel[cc_mask]))

            if touches_border and cc_mean_score < (thresh + 0.04):
                continue

            rank_score = cc_mean_score * (1.0 + min(0.8, area / float(h * w))) + 0.02 * cc_red_gain

            if cc_red_gain >= 3.5 and cc_sat >= 10.0 and cc_mean_score >= (thresh - 0.01):
                fungal_candidates.append((cc_id, rank_score))
            else:
                skin_candidates.append((cc_id, rank_score))

        if fungal_candidates:
            fungal_candidates.sort(key=lambda item: item[1], reverse=True)
            for cc_id, _ in fungal_candidates[:2]:
                binary_mask[cc_labels == cc_id] = 255
        elif largest_cc > 0:
            binary_mask[cc_labels == largest_cc] = 255

        if skin_candidates:
            skin_candidates.sort(key=lambda item: item[1], reverse=True)
            for cc_id, _ in skin_candidates[:2]:
                skin_component_mask[cc_labels == cc_id] = 255

    binary_mask = refine_fungal_mask(binary_mask, max_regions=2)

    skin_tone_mask = (
        (np.abs(a_channel - skin_a) < 9.0)
        & (s_channel < 85.0)
        & (v_channel > 45.0)
    ).astype(np.uint8) * 255
    skin_tone_mask = cv2.morphologyEx(skin_tone_mask, cv2.MORPH_OPEN, kernel)
    skin_tone_mask = cv2.morphologyEx(skin_tone_mask, cv2.MORPH_CLOSE, kernel)
    skin_mask = cv2.bitwise_or(skin_tone_mask, skin_component_mask)
    skin_mask[binary_mask > 0] = 0

    gabor_map = extract_gabor_features(gray, num_orientations=8, num_scales=3)
    _, lbp_entropy = extract_lbp_features(gray, radius=3, n_points=24)
    glcm_features = extract_glcm_features(gray)

    texture_scores = {
        'gabor_mean': float(gabor_map[binary_mask > 0].mean()) if np.any(binary_mask > 0) else 0.0,
        'lbp_entropy': lbp_entropy,
        'glcm_contrast': glcm_features['contrast'],
        'glcm_homogeneity': glcm_features['homogeneity'],
        'skin_area_percentage': float(np.sum(skin_mask > 0) / float(h * w) * 100.0),
        'skin_mask': skin_mask
    }

    logger.info(f"Fungal segmentation: {np.sum(binary_mask > 0)} pixels detected")

    return binary_mask, texture_scores


def analyze_spread_pattern(binary_mask: np.ndarray) -> Dict[str, float]:
    try:
        h, w = binary_mask.shape
        total_pixels = h * w
        affected_pixels = np.sum(binary_mask > 0)
        affected_area_percentage = (affected_pixels / total_pixels * 100.0)
        
        if affected_pixels == 0:
            return {
                'spread_radius': 0.0,
                'boundary_sharpness': 0.0,
                'circularity': 0.0,
                'affected_area_percentage': 0.0,
                'spread_pattern': 'none'
            }

        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if len(contours) == 0:
            return {
                'spread_radius': 0.0,
                'boundary_sharpness': 0.0,
                'circularity': 0.0,
                'affected_area_percentage': affected_area_percentage,
                'spread_pattern': 'diffuse'
            }

        largest_contour = max(contours, key=cv2.contourArea)

        area = cv2.contourArea(largest_contour)
        spread_radius = np.sqrt(area / np.pi) if area > 0 else 0.0

        perimeter = cv2.arcLength(largest_contour, True)
        circularity = (4 * np.pi * area / (perimeter**2)) if perimeter > 0 else 0.0
        circularity = min(1.0, circularity)

        if circularity > 0.7:
            spread_pattern = 'circular'
        elif circularity > 0.4:
            spread_pattern = 'oval'
        else:
            spread_pattern = 'irregular'

        edges = cv2.Canny(binary_mask, 50, 150)
        boundary_pixels = np.sum(edges > 0)

        boundary_sharpness = min(1.0, boundary_pixels / (perimeter + 1e-10))

        return {
            'spread_radius': float(spread_radius),
            'boundary_sharpness': float(boundary_sharpness),
            'circularity': float(circularity),
            'affected_area_percentage': float(affected_area_percentage),
            'spread_pattern': spread_pattern
        }

    except Exception as e:
        logger.error(f"Spread pattern analysis failed: {e}")
        return {
            'spread_radius': 0.0,
            'boundary_sharpness': 0.0,
            'circularity': 0.0,
            'affected_area_percentage': 0.0,
            'spread_pattern': 'error'
        }


def calculate_texture_score(texture_features: Dict[str, float]) -> float:
    gabor_norm = min(1.0, texture_features.get('gabor_mean', 0.0))
    lbp_norm = min(1.0, texture_features.get('lbp_entropy', 0.0) / 5.0)
    glcm_norm = min(1.0, texture_features.get('glcm_contrast', 0.0) / 200.0)

    texture_score = (gabor_norm + lbp_norm + glcm_norm) / 3.0

    return float(texture_score)


def process_fungal_infection(bgr_image: np.ndarray) -> Dict[str, Any]:
    logger.info("Running fungal infection analysis")

    mask, texture_features = segment_fungal_region(bgr_image)

    spread_metrics = analyze_spread_pattern(mask)

    texture_score = calculate_texture_score(texture_features)

    results = {
        "affected_area_percentage": spread_metrics["affected_area_percentage"],
        "spread_radius": spread_metrics["spread_radius"],
        "texture_score": texture_score,
        "boundary_sharpness": spread_metrics["boundary_sharpness"],
        "spread_pattern": spread_metrics["spread_pattern"],
        "circularity": spread_metrics["circularity"],
        "skin_area_percentage": texture_features.get("skin_area_percentage", 0.0),
        "texture_features": texture_features,
        "segmentation_mask": mask,
        "skin_mask": texture_features.get("skin_mask", np.zeros_like(mask))
    }

    logger.info(f"Fungal analysis complete: {spread_metrics['affected_area_percentage']:.1f}% affected, "
                f"texture_score={texture_score:.2f}, pattern={spread_metrics['spread_pattern']}")

    return results
