from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def preprocess(bgr: np.ndarray, size: int = 512) -> np.ndarray:
    bgr_r = cv2.resize(bgr, (size, size), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(bgr_r, cv2.COLOR_BGR2LAB)
    L, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    L = clahe.apply(L)
    lab = cv2.merge([L, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def kmeans_mask(bgr: np.ndarray, k: int = 3) -> tuple:
    """K-means in LAB space, returns binary lesion mask and cluster visualization."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    pixels = lab.reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(
        pixels, k, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
    )
    labels = labels.reshape(bgr.shape[:2])

    sorted_idx = np.argsort(centers[:, 0])
    lesion_idx = int(sorted_idx[0])

    mask = ((labels == lesion_idx).astype(np.uint8)) * 255

    colors = [(255, 100, 100), (100, 200, 100), (100, 100, 255)]
    cluster_viz = np.zeros_like(bgr)
    for rank, orig_idx in enumerate(sorted_idx):
        cluster_viz[labels == orig_idx] = colors[rank]

    return mask, cluster_viz


def watershed_from_components(mask: np.ndarray, bgr: np.ndarray):
    """Watershed using connected components as markers."""
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask_open = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask_close = cv2.morphologyEx(mask_open, cv2.MORPH_CLOSE, kernel)

    kernel_sure = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    sure_fg = cv2.erode(mask_close, kernel_sure, iterations=3)

    sure_bg = cv2.dilate(mask_close, kernel, iterations=3)

    unknown = cv2.subtract(sure_bg, sure_fg)

    num_labels, markers = cv2.connectedComponents(sure_fg)

    markers = markers + 1

    markers[unknown == 255] = 0

    markers = cv2.watershed(bgr, markers.astype(np.int32))

    return markers, num_labels


def draw_overlay(bgr: np.ndarray, markers: np.ndarray):
    """Draw green circles on each watershed region."""
    overlay = bgr.copy()
    head_count = 0

    for label_id in range(2, markers.max() + 1):
        region = (markers == label_id).astype(np.uint8)
        contours, _ = cv2.findContours(region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        cnt = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(cnt)
        if area < 30:
            continue

        (cx, cy), r = cv2.minEnclosingCircle(cnt)
        cx_i, cy_i, r_i = int(cx), int(cy), int(max(5, min(30, r)))
        cv2.circle(overlay, (cx_i, cy_i), r_i, (0, 255, 0), 2)
        head_count += 1

    cv2.putText(overlay, f"Acne Heads: {head_count}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
    return overlay, head_count


def main():
    parser = argparse.ArgumentParser(description="K-means + watershed (no manual peak detection)")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--out-dir", default="services/processing_images/test_outputs/simple_watershed", help="Output directory")
    args = parser.parse_args()

    image_path = Path(args.image)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    bgr0 = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if bgr0 is None:
        print(f"ERROR: Could not read {image_path}")
        sys.exit(1)

    bgr = preprocess(bgr0)
    cv2.imwrite(str(out_dir / "01_preprocessed.png"), bgr)
    print("Step 1: Preprocessed")

    mask, cluster_viz = kmeans_mask(bgr, k=3)
    cv2.imwrite(str(out_dir / "02_kmeans_mask.png"), mask)
    cv2.imwrite(str(out_dir / "02_kmeans_clusters.png"), cluster_viz)
    print("Step 2: K-means mask")

    markers, num_components = watershed_from_components(mask, bgr)

    labels_viz = np.zeros_like(bgr)
    labels_viz[markers == -1] = (0, 0, 255)
    for label_id in range(2, markers.max() + 1):
        color = tuple(int(c) for c in np.random.randint(50, 255, 3))
        labels_viz[markers == label_id] = color
    cv2.imwrite(str(out_dir / "03_watershed_labels.png"), labels_viz)
    print(f"Step 3: Watershed ({num_components - 1} components before filtering)")

    overlay, head_count = draw_overlay(bgr, markers)
    cv2.imwrite(str(out_dir / "04_watershed_overlay.png"), overlay)
    print(f"Step 4: Overlay — {head_count} acne heads detected")
    print(f"Results saved to: {out_dir}")

    import subprocess
    for f in ["01_preprocessed.png", "02_kmeans_mask.png", "02_kmeans_clusters.png",
              "03_watershed_labels.png", "04_watershed_overlay.png"]:
        subprocess.Popen(["open", str(out_dir / f)])


if __name__ == "__main__":
    main()
