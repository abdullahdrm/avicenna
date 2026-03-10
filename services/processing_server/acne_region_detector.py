import cv2
import numpy as np


def initialize_seeds(heads):
    return [(h['x'], h['y'], h['radius']) for h in heads]


def grow_region(img, seed_x, seed_y, seed_radius, acne_channel, max_iterations=50):
    h, w = img.shape[:2]
    region_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(region_mask, (seed_x, seed_y), seed_radius, 255, -1)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    seed_region = region_mask > 0
    if np.sum(seed_region) == 0:
        return region_mask
    
    seed_L = lab[:, :, 0][seed_region].mean()
    seed_A = lab[:, :, 1][seed_region].mean()
    seed_B = lab[:, :, 2][seed_region].mean()
    for iteration in range(max_iterations):
        prev_mask = region_mask.copy()
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        dilated = cv2.dilate(region_mask, kernel, iterations=1)
        boundary = (dilated > 0) & (region_mask == 0)
        
        if np.sum(boundary) == 0:
            break

        boundary_L = lab[:, :, 0][boundary]
        boundary_A = lab[:, :, 1][boundary]
        boundary_B = lab[:, :, 2][boundary]
        dist_L = np.abs(boundary_L - seed_L)
        dist_A = np.abs(boundary_A - seed_A)
        dist_B = np.abs(boundary_B - seed_B)
        dist = np.sqrt(dist_L**2 + dist_A**2 + dist_B**2)
        boundary_acne = acne_channel[boundary]
        similar = (dist < 30) & (boundary_acne > 10)
        boundary_coords = np.where(boundary)
        for i in range(len(boundary_coords[0])):
            if similar[i]:
                region_mask[boundary_coords[0][i], boundary_coords[1][i]] = 255
        if np.array_equal(region_mask, prev_mask):
            break
    
    return region_mask


def refine_boundaries(mask, img_gray):
    grad_x = cv2.Sobel(img_gray, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(img_gray, cv2.CV_32F, 0, 1, ksize=3)
    gradient = np.sqrt(grad_x**2 + grad_y**2)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        cv2.drawContours(mask, [cnt], -1, 255, -1)
    
    return mask


def merge_overlapping_regions(region_masks, overlap_threshold=0.3):
    if len(region_masks) <= 1:
        return region_masks
    
    merged = []
    used = set()
    
    for i in range(len(region_masks)):
        if i in used:
            continue
        
        current_mask = region_masks[i].copy()
        for j in range(i + 1, len(region_masks)):
            if j in used:
                continue
            
            overlap = np.sum((current_mask > 0) & (region_masks[j] > 0))
            area_i = np.sum(current_mask > 0)
            area_j = np.sum(region_masks[j] > 0)
            
            if area_i > 0 and area_j > 0:
                overlap_ratio = overlap / min(area_i, area_j)
                if overlap_ratio > overlap_threshold:
                    current_mask = cv2.bitwise_or(current_mask, region_masks[j])
                    used.add(j)
        
        merged.append(current_mask)
    
    return merged


def quantify_redness_per_region(img, region_mask):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    
    H, S, V = cv2.split(hsv)
    L, A, B = cv2.split(lab)
    
    region_pixels = region_mask > 0
    if np.sum(region_pixels) == 0:
        return {
            'area_pixels': 0,
            'redness_percentage': 0,
            'inflammation_score': 0
        }
    red_mask = ((H <= 10) | (H >= 170)) & (S > 50) & region_pixels
    redness_pct = np.sum(red_mask) / np.sum(region_pixels) * 100
    region_A = A[region_pixels].mean()
    baseline_A = 128
    inflammation = (region_A - baseline_A) / 128.0
    inflammation_score = np.clip(inflammation, 0, 1)
    
    return {
        'area_pixels': int(np.sum(region_pixels)),
        'redness_percentage': float(redness_pct),
        'inflammation_score': float(inflammation_score)
    }


def detect_acne_regions(img, acne_channel, heads, img_gray):
    if len(heads) == 0:
        return {
            'mask': np.zeros(img.shape[:2], dtype=np.uint8),
            'regions': [],
            'total_affected_area': 0,
            'coverage_percentage': 0
        }
    
    print(f"  Growing regions from {len(heads)} heads...")
    region_masks = []
    for i, head in enumerate(heads):
        mask = grow_region(img, head['x'], head['y'], head['radius'], acne_channel, max_iterations=50)
        mask = refine_boundaries(mask, img_gray)
        
        if np.sum(mask > 0) >= 100:
            region_masks.append(mask)
    
    print(f"  Grown {len(region_masks)} valid regions")
    merged_masks = merge_overlapping_regions(region_masks, overlap_threshold=0.3)
    print(f"  After merging: {len(merged_masks)} regions")
    combined_mask = np.zeros(img.shape[:2], dtype=np.uint8)
    for mask in merged_masks:
        combined_mask = cv2.bitwise_or(combined_mask, mask)
    regions = []
    for i, mask in enumerate(merged_masks):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if len(contours) == 0:
            continue
        
        x, y, w, h = cv2.boundingRect(contours[0])
        metrics = quantify_redness_per_region(img, mask)
        
        regions.append({
            'region_id': i + 1,
            'bounding_box': (x, y, x + w, y + h),
            **metrics
        })
    total_area = np.sum(combined_mask > 0)
    image_area = img.shape[0] * img.shape[1]
    coverage = total_area / image_area * 100
    
    return {
        'mask': combined_mask,
        'regions': regions,
        'total_affected_area': int(total_area),
        'coverage_percentage': float(coverage)
    }


def visualize_regions(img, result):
    vis = img.copy()
    mask = result['mask']
    overlay = np.zeros_like(img)
    overlay[mask > 0] = [0, 0, 255]
    
    vis = cv2.addWeighted(vis, 0.7, overlay, 0.3, 0)
    for region in result['regions']:
        x1, y1, x2, y2 = region['bounding_box']
        cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        label = f"
        cv2.putText(vis, label, (x1, y1 - 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1, cv2.LINE_AA)
    summary = f"Regions: {len(result['regions'])} | Coverage: {result['coverage_percentage']:.2f}%"
    cv2.putText(vis, summary, (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(vis, summary, (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 1, cv2.LINE_AA)
    
    return vis
