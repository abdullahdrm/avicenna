import cv2
import numpy as np
from skimage.filters.rank import entropy
from skimage.morphology import disk


def normalize_skin_tone(img):
    h, w = img.shape[:2]
    
    # Convert
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L, A, B = cv2.split(lab)
    
    # Skin detection
    skin_mask = (
        (L > 20) & (L < 200) &
        (A > 100) & (A < 180) &
        (B > 90) & (B < 160)
    ).astype(np.uint8) * 255
    
    # Morphological cleaning
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)
    
    # Calculate mean skin tone
    if np.sum(skin_mask > 0) > 100:
        mean_L = L[skin_mask > 0].mean()
        mean_A = A[skin_mask > 0].mean()
        mean_B = B[skin_mask > 0].mean()
    else:
        # Fallback if no skin detected
        mean_L = L.mean()
        mean_A = A.mean()
        mean_B = B.mean()
    
    # Normalize
    target_L = 135
    L_shift = target_L - mean_L
    L_normalized = np.clip(L.astype(np.float32) + L_shift, 0, 255).astype(np.uint8)
    
    lab_normalized = cv2.merge([L_normalized, A, B])
    img_normalized = cv2.cvtColor(lab_normalized, cv2.COLOR_LAB2BGR)
    
    return img_normalized


def extract_baseline_redness(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    
    # Find smooth regions
    ent = entropy(gray, disk(7))
    ent_normalized = (ent - ent.min()) / (ent.max() - ent.min() + 1e-6)
    smooth_mask = (ent_normalized < 0.3).astype(np.uint8) * 255
    
    # Convert to HSV
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)
    
    red_mask_1 = (H <= 15) | (H >= 165)
    red_mask_smooth = red_mask_1 & (smooth_mask > 0) & (S > 20)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    baseline_mask = cv2.dilate(red_mask_smooth.astype(np.uint8) * 255, kernel, iterations=2)
    
    contours, _ = cv2.findContours(baseline_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    large_region_mask = np.zeros_like(baseline_mask)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 1000:  # Large smooth red regions
            cv2.drawContours(large_region_mask, [cnt], -1, 255, -1)
    
    baseline_mask = cv2.bitwise_or(baseline_mask, large_region_mask)
    
    return baseline_mask


def isolate_acne_colors(img, baseline_mask):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    
    # Convert to HSV and LAB
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    
    H, S, V = cv2.split(hsv)
    L, A, B = cv2.split(lab)
    red_mask_hsv = (
        ((H <= 8) | (H >= 172)) &
        (S > 80) &
        (V > 50) & (V < 220)
    )

    smooth_regions = (entropy(gray, disk(5)) < 2.5)
    if np.sum(smooth_regions) > 100:
        baseline_A = A[smooth_regions].mean()
    else:
        baseline_A = 128
    
    inflamed_mask_lab = (
        (A > baseline_A + 20) &
        (L > 60) & (L < 180)
    )
    
    acne_color_mask = red_mask_hsv & inflamed_mask_lab
    
    acne_color_mask = acne_color_mask & (baseline_mask == 0)
    
    ent = entropy(gray, disk(5))
    textured = ent > 2.8
    acne_color_mask = acne_color_mask & textured
    
    contours, _ = cv2.findContours(acne_color_mask.astype(np.uint8) * 255, 
                                     cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filtered_mask = np.zeros(acne_color_mask.shape, dtype=np.uint8)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if 20 < area < 5000:
            cv2.drawContours(filtered_mask, [cnt], -1, 255, -1)
    
    acne_color_mask = (filtered_mask > 0)
    
    redness_intensity = np.clip(A.astype(np.float32) - baseline_A, 0, 255)
    texture_intensity = np.clip((ent - 2.0) * 50, 0, 255).astype(np.float32)
    
    acne_intensity = (0.7 * redness_intensity + 0.3 * texture_intensity).astype(np.uint8)
    acne_intensity[~acne_color_mask] = 0
    
    # Morphological cleaning
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    acne_intensity = cv2.morphologyEx(acne_intensity, cv2.MORPH_OPEN, kernel_small)
    
    return acne_intensity


def separate_colors(img):
    img_normalized = normalize_skin_tone(img)
    
    baseline_mask = extract_baseline_redness(img_normalized)
    
    acne_channel = isolate_acne_colors(img_normalized, baseline_mask)
    
    skin_tone = cv2.cvtColor(img_normalized, cv2.COLOR_BGR2GRAY)
    
    return skin_tone, baseline_mask, acne_channel


def visualize_separation(img, skin_tone, baseline_mask, acne_channel):
    h, w = img.shape[:2]
    
    skin_tone_3ch = cv2.cvtColor(skin_tone, cv2.COLOR_GRAY2BGR)
    baseline_3ch = cv2.cvtColor(baseline_mask, cv2.COLOR_GRAY2BGR)
    baseline_3ch[:, :, 1:] = 0 
    acne_3ch = cv2.cvtColor(acne_channel, cv2.COLOR_GRAY2BGR)
    acne_3ch[:, :, :2] = 0
    
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(skin_tone_3ch, "Normalized Skin", (10, 30), font, 0.7, (255, 255, 255), 2)
    cv2.putText(baseline_3ch, "Natural Redness", (10, 30), font, 0.7, (255, 255, 255), 2)
    cv2.putText(acne_3ch, "Acne Channel", (10, 30), font, 0.7, (255, 255, 255), 2)
    
    # Concatenate horizontally
    vis = np.hstack([skin_tone_3ch, baseline_3ch, acne_3ch])
    
    return vis
