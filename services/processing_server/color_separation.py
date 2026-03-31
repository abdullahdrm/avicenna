import cv2
import numpy as np
from skimage.filters.rank import entropy
from skimage.morphology import disk


def separate_skin_background(img):
    """
    Separate skin foreground from background.

    Returns:
        skin_mask: uint8 mask (255 = skin, 0 = non-skin)
        background_mask: uint8 mask (255 = background, 0 = skin)
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    L, A, B = cv2.split(lab)
    _, S, V = cv2.split(hsv)
    h, w = L.shape

    # Grid averages for local adaptation.
    cell = max(14, min(h, w) // 32)
    gh = (h + cell - 1) // cell
    gw = (w + cell - 1) // cell
    grid_l = np.zeros((gh, gw), dtype=np.float32)
    grid_a = np.zeros((gh, gw), dtype=np.float32)
    grid_b = np.zeros((gh, gw), dtype=np.float32)
    grid_s = np.zeros((gh, gw), dtype=np.float32)
    grid_v = np.zeros((gh, gw), dtype=np.float32)

    for gy in range(gh):
        y1, y2 = gy * cell, min((gy + 1) * cell, h)
        for gx in range(gw):
            x1, x2 = gx * cell, min((gx + 1) * cell, w)
            grid_l[gy, gx] = float(np.mean(L[y1:y2, x1:x2]))
            grid_a[gy, gx] = float(np.mean(A[y1:y2, x1:x2]))
            grid_b[gy, gx] = float(np.mean(B[y1:y2, x1:x2]))
            grid_s[gy, gx] = float(np.mean(S[y1:y2, x1:x2]))
            grid_v[gy, gx] = float(np.mean(V[y1:y2, x1:x2]))

    # Estimate skin prototype from center
    cy1, cy2 = int(0.2 * gh), int(0.8 * gh)
    cx1, cx2 = int(0.2 * gw), int(0.8 * gw)
    center_l = grid_l[cy1:cy2, cx1:cx2].ravel()
    center_a = grid_a[cy1:cy2, cx1:cx2].ravel()
    center_b = grid_b[cy1:cy2, cx1:cx2].ravel()
    center_s = grid_s[cy1:cy2, cx1:cx2].ravel()
    center_v = grid_v[cy1:cy2, cx1:cx2].ravel()

    center_valid = (center_v > 40) & (center_s > 5)
    if np.any(center_valid):
        skin_l0 = float(np.median(center_l[center_valid]))
        skin_a0 = float(np.median(center_a[center_valid]))
        skin_b0 = float(np.median(center_b[center_valid]))
    else:
        skin_l0 = float(np.median(center_l))
        skin_a0 = float(np.median(center_a))
        skin_b0 = float(np.median(center_b))

    # Grid skin likelihood + abrupt change penalty.
    grid_dist = np.sqrt(
        ((grid_l - skin_l0) / 28.0) ** 2 +
        ((grid_a - skin_a0) / 16.0) ** 2 +
        ((grid_b - skin_b0) / 16.0) ** 2
    )
    grid_skin_score = np.exp(-0.5 * (grid_dist ** 2))

    # Abrupt cell change map (high => likely boundary/background transition)
    abrupt = np.zeros((gh, gw), dtype=np.float32)
    for gy in range(gh):
        for gx in range(gw):
            neigh = []
            for ny, nx in ((gy - 1, gx), (gy + 1, gx), (gy, gx - 1), (gy, gx + 1)):
                if 0 <= ny < gh and 0 <= nx < gw:
                    dl = abs(grid_l[gy, gx] - grid_l[ny, nx])
                    da = abs(grid_a[gy, gx] - grid_a[ny, nx])
                    db = abs(grid_b[gy, gx] - grid_b[ny, nx])
                    neigh.append(0.5 * dl + 0.3 * da + 0.2 * db)
            abrupt[gy, gx] = max(neigh) if neigh else 0.0
    abrupt_n = np.clip(abrupt / (np.percentile(abrupt, 95) + 1e-6), 0.0, 1.0)
    grid_skin_score = grid_skin_score * (1.0 - 0.35 * abrupt_n)

    # Upsample grid score and blend with pixel level score
    grid_skin_full = cv2.resize(grid_skin_score, (w, h), interpolation=cv2.INTER_CUBIC)
    pix_dist = np.sqrt(
        ((L.astype(np.float32) - skin_l0) / 30.0) ** 2 +
        ((A.astype(np.float32) - skin_a0) / 17.0) ** 2 +
        ((B.astype(np.float32) - skin_b0) / 17.0) ** 2
    )
    pix_skin_score = np.exp(-0.5 * (pix_dist ** 2))
    combined_skin = 0.6 * pix_skin_score + 0.4 * grid_skin_full

    valid_light = (V.astype(np.float32) > 32.0)
    initial_skin = ((combined_skin > 0.40) & valid_light).astype(np.uint8) * 255

    # Build border-connected background from low skin score seeds.
    border_ring = np.zeros((h, w), dtype=np.uint8)
    bw = max(8, int(0.05 * min(h, w)))
    border_ring[:bw, :] = 1
    border_ring[-bw:, :] = 1
    border_ring[:, :bw] = 1
    border_ring[:, -bw:] = 1

    # Shadowed skin protection
    shadow_skin_like = (
        (np.abs(A.astype(np.float32) - skin_a0) < 16.0)
        & (np.abs(B.astype(np.float32) - skin_b0) < 18.0)
        & ((combined_skin > 0.20) | (V.astype(np.float32) > 24.0))
    )

    # Stricter background criteria, especially for dark/shadow regions.
    bg_seed = (
        (
            (combined_skin < 0.24)
            | ((V < 24) & (combined_skin < 0.36))
            | ((S < 5) & (combined_skin < 0.36))
        )
        & (border_ring == 1)
        & (~shadow_skin_like)
    ).astype(np.uint8) * 255

    bg_candidates = (
        (
            (combined_skin < 0.28)
            | ((V < 20) & (combined_skin < 0.34))
            | ((S < 4) & (combined_skin < 0.34))
        )
        & (~shadow_skin_like)
    ).astype(np.uint8) * 255

    # Flood by connected components
    num_labels, cc_labels, stats, _ = cv2.connectedComponentsWithStats((bg_candidates > 0).astype(np.uint8), connectivity=8)
    background_mask = np.zeros((h, w), dtype=np.uint8)
    seed_labels = set(np.unique(cc_labels[bg_seed > 0]).tolist())
    for label_id in seed_labels:
        if label_id == 0:
            continue
        background_mask[cc_labels == label_id] = 255

    # Final guard against shadow-skin being marked as background
    background_mask[shadow_skin_like] = 0

    # Final masks with cleanup.
    skin_mask = cv2.bitwise_not(background_mask)
    skin_mask = cv2.bitwise_and(skin_mask, initial_skin)

    # Recover shadowed skin connected to center skin seeds
    center_seed = np.zeros((h, w), dtype=np.uint8)
    sy1, sy2 = int(0.25 * h), int(0.75 * h)
    sx1, sx2 = int(0.25 * w), int(0.75 * w)
    center_seed[sy1:sy2, sx1:sx2] = 255
    skin_seed = ((skin_mask > 0) & (center_seed > 0)).astype(np.uint8) * 255

    recovery_candidates = (
        (combined_skin > 0.17)
        & (np.abs(A.astype(np.float32) - skin_a0) < 22.0)
        & (np.abs(B.astype(np.float32) - skin_b0) < 24.0)
        & (V.astype(np.float32) > 18.0)
    ).astype(np.uint8) * 255

    if np.any(skin_seed > 0):
        # Keep only candidate components connected to center skin seeds
        num_labels, cc_labels, _, _ = cv2.connectedComponentsWithStats((recovery_candidates > 0).astype(np.uint8), connectivity=8)
        connected_ids = set(np.unique(cc_labels[skin_seed > 0]).tolist())
        recovered = np.zeros((h, w), dtype=np.uint8)
        for lid in connected_ids:
            if lid == 0:
                continue
            recovered[cc_labels == lid] = 255
        skin_mask = cv2.bitwise_or(skin_mask, recovered)

    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel_open)
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel_close)

    # Fill holes inside skin
    inv = cv2.bitwise_not(skin_mask)
    num_labels, hole_labels, _, _ = cv2.connectedComponentsWithStats((inv > 0).astype(np.uint8), connectivity=8)
    if num_labels > 1:
        hole_bg = np.zeros_like(inv)
        hole_bg[0, :] = 255
        hole_bg[-1, :] = 255
        hole_bg[:, 0] = 255
        hole_bg[:, -1] = 255
        border_ids = set(np.unique(hole_labels[hole_bg > 0]).tolist())
        holes = np.ones_like(inv, dtype=np.uint8) * 255
        for lid in border_ids:
            holes[hole_labels == lid] = 0
        skin_mask[holes > 0] = 255

    background_mask = cv2.bitwise_not(skin_mask)
    return skin_mask, background_mask


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
