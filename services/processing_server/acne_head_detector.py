import cv2
import numpy as np
from skimage.filters.rank import entropy
from skimage.morphology import disk


def find_candidates(acne_channel, min_intensity=30):
    _, binary = cv2.threshold(acne_channel, min_intensity, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    return contours


def filter_by_shape(contours, circularity_range=(0.4, 1.0), aspect_ratio_range=(0.5, 2.0)):
    valid = []
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area == 0:
            continue
        
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        
        if not (circularity_range[0] <= circularity <= circularity_range[1]):
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        if h == 0:
            continue
        
        aspect_ratio = float(w) / h
        
        if not (aspect_ratio_range[0] <= aspect_ratio <= aspect_ratio_range[1]):
            continue
        
        valid.append(cnt)
    
    return valid


def filter_by_size(contours, img_shape, diameter_range_px=(3, 25)):
    """
    Filter by size - acne heads have diameter 3-25 pixels at standard resolution.
    Scale limits proportionally for different image sizes.
    
    Args:
        contours: List of contours
        img_shape: (height, width) of image
        diameter_range_px: (min, max) diameter in pixels
    
    Returns:
        sized_contours: List of contours with valid sizes
    """
    h, w = img_shape[:2]
    reference_width = 1400
    scale_factor = w / reference_width
    
    min_diameter = diameter_range_px[0] * scale_factor
    max_diameter = diameter_range_px[1] * scale_factor
    
    sized = []
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 0:
            diameter = 2 * np.sqrt(area / np.pi)
        else:
            continue
        
        if min_diameter <= diameter <= max_diameter:
            sized.append(cnt)
    
    return sized


def validate_texture(img_gray, contours, acne_channel, entropy_threshold=2.0, gradient_threshold=15):
    ent = entropy(img_gray, disk(3))
    grad_x = cv2.Sobel(img_gray, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(img_gray, cv2.CV_32F, 0, 1, ksize=3)
    gradient_mag = np.sqrt(grad_x**2 + grad_y**2)
    
    textured = []
    
    for cnt in contours:
        M = cv2.moments(cnt)
        if M['m00'] == 0:
            continue
        
        cx = int(M['m10'] / M['m00'])
        cy = int(M['m01'] / M['m00'])
        mask = np.zeros(img_gray.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        
        region_entropy = ent[mask > 0].mean() if np.sum(mask) > 0 else 0
        
        if region_entropy < entropy_threshold:
            continue
        if 0 <= cy < gradient_mag.shape[0] and 0 <= cx < gradient_mag.shape[1]:
            center_gradient = gradient_mag[cy, cx]
        else:
            continue
        
        if center_gradient < gradient_threshold:
            continue
        
        textured.append(cnt)
    
    return textured


def score_detections(contours, acne_channel, img_gray):
    detections = []
    ent = entropy(img_gray, disk(3))
    
    for cnt in contours:
        M = cv2.moments(cnt)
        if M['m00'] == 0:
            continue
        
        cx = int(M['m10'] / M['m00'])
        cy = int(M['m01'] / M['m00'])
        
        area = cv2.contourArea(cnt)
        radius = int(np.sqrt(area / np.pi))
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        shape_score = min(circularity, 1.0)

        diameter = 2 * radius
        if diameter < 5:
            size_score = diameter / 5.0
        elif diameter <= 15:
            size_score = 1.0
        else:
            size_score = max(0, 1.0 - (diameter - 15) / 10.0)
        mask = np.zeros(img_gray.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        
        region_entropy = ent[mask > 0].mean() if np.sum(mask) > 0 else 0
        texture_score = min(region_entropy / 4.0, 1.0)

        region_intensity = acne_channel[mask > 0].mean() if np.sum(mask) > 0 else 0
        color_score = region_intensity / 255.0
        confidence = (
            0.3 * shape_score +
            0.3 * size_score +
            0.2 * texture_score +
            0.2 * color_score
        )
        
        detections.append({
            'x': cx,
            'y': cy,
            'radius': radius,
            'confidence': confidence,
            'contour': cnt
        })
    
    return detections


def non_maximum_suppression(detections, overlap_threshold=0.5):
    if len(detections) == 0:
        return []
    detections = sorted(detections, key=lambda d: d['confidence'], reverse=True)
    
    kept = []
    
    for detection in detections:
        is_duplicate = False
        
        for kept_det in kept:
            dx = detection['x'] - kept_det['x']
            dy = detection['y'] - kept_det['y']
            distance = np.sqrt(dx*dx + dy*dy)
            r1 = detection['radius']
            r2 = kept_det['radius']
            if distance < (r1 + r2) * overlap_threshold:
                is_duplicate = True
                break
        
        if not is_duplicate:
            kept.append(detection)
    
    return kept


def detect_acne_heads(acne_channel, img_gray, confidence_threshold=0.4):
    contours = find_candidates(acne_channel, min_intensity=30)
    print(f"  Found {len(contours)} candidate regions")
    
    if len(contours) == 0:
        return []
    shaped = filter_by_shape(contours, circularity_range=(0.4, 1.0), aspect_ratio_range=(0.5, 2.0))
    print(f"  After shape filter: {len(shaped)} candidates")
    sized = filter_by_size(shaped, acne_channel.shape, diameter_range_px=(3, 25))
    print(f"  After size filter: {len(sized)} candidates")
    textured = validate_texture(img_gray, sized, acne_channel, entropy_threshold=2.0, gradient_threshold=15)
    print(f"  After texture validation: {len(textured)} candidates")
    detections = score_detections(textured, acne_channel, img_gray)
    print(f"  Scored {len(detections)} detections")
    confident = [d for d in detections if d['confidence'] >= confidence_threshold]
    print(f"  After confidence threshold ({confidence_threshold}): {len(confident)} detections")
    final = non_maximum_suppression(confident, overlap_threshold=0.5)
    print(f"  After NMS: {len(final)} final heads")
    head_list = [
        {'x': d['x'], 'y': d['y'], 'radius': d['radius'], 'confidence': d['confidence']}
        for d in final
    ]
    
    return head_list


def visualize_detected_heads(img, heads, show_confidence=True):
    vis = img.copy()
    
    for i, head in enumerate(heads):
        x, y, r = head['x'], head['y'], head['radius']
        conf = head['confidence']
        if conf >= 0.7:
            color = (0, 255, 0)
        elif conf >= 0.5:
            color = (0, 255, 255)
        else:
            color = (0, 165, 255)

        cv2.circle(vis, (x, y), r, color, 2)
        cv2.circle(vis, (x, y), 2, color, -1)

        if show_confidence:
            label = f"
        else:
            label = f"
        
        cv2.putText(vis, label, (x - r, y - r - 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)
    summary = f"Detected: {len(heads)} acne heads"
    cv2.putText(vis, summary, (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(vis, summary, (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 1, cv2.LINE_AA)
    
    return vis
