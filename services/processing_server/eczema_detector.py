import os
import re
import cv2
import glob
import math
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, List
from skimage import morphology, measure


@dataclass
class Config:
    input_dir: str = "images"
    output_dir: str = "output"

    resize_long_side: int = 1200

    roi: Optional[Tuple[int, int, int, int]] = None

    pixels_per_mm: Optional[float] = None

    day_regex: str = r"day(\d+)"

    min_component_area_px: int = 700
    max_component_area_ratio: float = 0.65
    hole_area_threshold: int = 800

    redness_z_thresh: float = 0.7
    redness_abs_margin: float = 10.0

    texture_thresh: float = 35.0

    white_scale_thresh: int = 185

    open_radius: int = 3
    close_radius: int = 9

    enable_region_growing: bool = True
    grow_redness_relaxed_z: float = 0.15
    grow_iterations: int = 20

    require_scale_overlap: bool = True


CFG = Config()


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"([0-9]+)", s)]


def resize_keep_aspect(img: np.ndarray, long_side: int) -> np.ndarray:
    h, w = img.shape[:2]
    scale = long_side / max(h, w)
    if scale >= 1.0:
        return img.copy()
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def parse_day_from_filename(filename: str, regex: str) -> Optional[int]:
    m = re.search(regex, os.path.basename(filename), re.IGNORECASE)
    return int(m.group(1)) if m else None


def preprocess_image(img_bgr: np.ndarray) -> np.ndarray:
    img = img_bgr.copy()

    if CFG.roi is not None:
        x1, y1, x2, y2 = CFG.roi
        img = img[y1:y2, x1:x2]

    img = resize_keep_aspect(img, CFG.resize_long_side)

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge([l_eq, a, b]), cv2.COLOR_LAB2BGR)

    return img


def get_skin_mask(img_bgr: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)

    lower_ycrcb = np.array([0, 133, 77], dtype=np.uint8)
    upper_ycrcb = np.array([255, 180, 135], dtype=np.uint8)
    mask_ycrcb = cv2.inRange(ycrcb, lower_ycrcb, upper_ycrcb)

    lower_hsv = np.array([0, 15, 30], dtype=np.uint8)
    upper_hsv = np.array([30, 255, 255], dtype=np.uint8)
    mask_hsv = cv2.inRange(hsv, lower_hsv, upper_hsv)

    r = rgb[:, :, 0].astype(np.int32)
    g = rgb[:, :, 1].astype(np.int32)
    b = rgb[:, :, 2].astype(np.int32)

    rgb_rule = (
        (r > 85) & (g > 30) & (b > 15) &
        ((np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) > 15) &
        (np.abs(r - g) > 10) &
        (r > g) & (r > b)
    )

    mask_rgb = rgb_rule.astype(np.uint8) * 255
    mask = cv2.bitwise_and(mask_ycrcb, mask_hsv)
    mask = cv2.bitwise_and(mask, mask_rgb)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    return mask


def compute_redness_map(img_bgr: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]

    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    a = lab[:, :, 1]

    rg = r - g
    rb = r - b
    erythema = r - 0.5 * (g + b)
    ratio = (r / (r + g + b + 1e-6)) * 255.0

    redness = (
        0.35 * rg +
        0.20 * rb +
        0.25 * erythema +
        0.15 * (a - 128.0) +
        0.05 * ratio
    )
    return redness.astype(np.float32)


def compute_texture_map(img_bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    texture = np.abs(lap)

    texture = cv2.GaussianBlur(texture, (9, 9), 0)
    texture = cv2.normalize(texture, None, 0, 255, cv2.NORM_MINMAX)

    return texture.astype(np.float32)


def detect_white_scales(img_bgr: np.ndarray, skin_mask: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    white = (gray >= CFG.white_scale_thresh).astype(np.uint8) * 255

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    white_hsv = ((s < 60) & (v > 160)).astype(np.uint8) * 255

    scale = cv2.bitwise_or(white, white_hsv)
    scale = cv2.bitwise_and(scale, skin_mask)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    scale = cv2.morphologyEx(scale, cv2.MORPH_OPEN, kernel)
    scale = cv2.morphologyEx(scale, cv2.MORPH_CLOSE, kernel)

    return scale


def robust_skin_baseline(values: np.ndarray) -> Tuple[float, float]:
    if len(values) == 0:
        return 0.0, 1.0
    med = float(np.median(values))
    mad = float(np.median(np.abs(values - med)) + 1e-6)
    robust_std = 1.4826 * mad + 1e-6
    return med, robust_std


def region_grow_from_seeds(
    seeds: np.ndarray,
    allowed: np.ndarray,
    iterations: int
) -> np.ndarray:
    region = (seeds > 0).astype(np.uint8) * 255
    allowed = (allowed > 0).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

    for _ in range(iterations):
        dil = cv2.dilate(region, kernel, iterations=1)
        new_region = cv2.bitwise_and(dil, allowed)
        if np.array_equal(new_region, region):
            break
        region = new_region

    return region


def filter_components(
    mask: np.ndarray,
    img_shape: Tuple[int, int],
    scale_mask: Optional[np.ndarray] = None
) -> np.ndarray:
    h, w = img_shape
    img_area = h * w

    labels = measure.label(mask > 0, connectivity=2)
    props = measure.regionprops(labels)

    out = np.zeros_like(mask, dtype=np.uint8)

    for p in props:
        area = p.area
        if area < CFG.min_component_area_px:
            continue
        if area > CFG.max_component_area_ratio * img_area:
            continue

        extent = getattr(p, "extent", 0.0)
        solidity = getattr(p, "solidity", 1.0)

        if extent < 0.08:
            continue
        if solidity < 0.10:
            continue

        component_mask = (labels == p.label).astype(np.uint8) * 255

        if CFG.require_scale_overlap and scale_mask is not None:
            overlap = cv2.bitwise_and(component_mask, scale_mask)
            if np.sum(overlap > 0) == 0:
                continue

        out[labels == p.label] = 255

    return out


def segment_psoriasis_eczema(img_bgr: np.ndarray) -> Tuple[np.ndarray, Dict[str, np.ndarray], Dict]:
    skin_mask = get_skin_mask(img_bgr)
    redness_map = compute_redness_map(img_bgr)
    texture_map = compute_texture_map(img_bgr)
    scale_mask = detect_white_scales(img_bgr, skin_mask)

    skin_red = redness_map[skin_mask > 0]
    med_red, std_red = robust_skin_baseline(skin_red)
    redness_z = (redness_map - med_red) / std_red

    redness_norm = cv2.normalize(
        redness_map, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    texture_norm = cv2.normalize(
        texture_map, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    red_mask = (
        (redness_z > CFG.redness_z_thresh) &
        (redness_map > med_red + CFG.redness_abs_margin) &
        (skin_mask > 0)
    ).astype(np.uint8) * 255

    texture_mask = ((texture_norm > CFG.texture_thresh) &
                    (skin_mask > 0)).astype(np.uint8) * 255

    core = (
        (red_mask > 0) &
        ((texture_mask > 0) | (scale_mask > 0))
    ).astype(np.uint8) * 255

    if CFG.enable_region_growing:
        relaxed_red = (
            (redness_z > CFG.grow_redness_relaxed_z) &
            (skin_mask > 0)
        ).astype(np.uint8) * 255

        seeds = cv2.bitwise_or(core, scale_mask)
        grown = region_grow_from_seeds(seeds, relaxed_red, CFG.grow_iterations)

        candidate = cv2.bitwise_or(core, grown)
    else:
        candidate = core.copy()

    se_open = morphology.disk(CFG.open_radius)
    se_close = morphology.disk(CFG.close_radius)

    candidate_bool = candidate > 0
    candidate_bool = morphology.opening(candidate_bool, se_open)
    candidate_bool = morphology.closing(candidate_bool, se_close)
    candidate_bool = morphology.remove_small_holes(
        candidate_bool, area_threshold=CFG.hole_area_threshold)
    candidate_bool = morphology.remove_small_objects(
        candidate_bool, min_size=CFG.min_component_area_px)

    lesion_mask = (candidate_bool.astype(np.uint8) * 255)
    lesion_mask = filter_components(
        lesion_mask, img_bgr.shape[:2], scale_mask=scale_mask)

    debug = {
        "skin_mask": skin_mask,
        "redness_map": redness_map,
        "redness_norm": redness_norm,
        "redness_z": redness_z,
        "texture_map": texture_map,
        "texture_norm": texture_norm,
        "scale_mask": scale_mask,
        "red_mask": red_mask,
        "texture_mask": texture_mask,
        "core_mask": core,
        "candidate_mask": candidate,
    }

    stats = {
        "median_skin_redness": med_red,
        "robust_skin_red_std": std_red,
        "skin_area_px": int(np.sum(skin_mask > 0)),
        "scale_area_px": int(np.sum(scale_mask > 0)),
    }

    return lesion_mask, debug, stats


def compute_metrics(img_bgr: np.ndarray, lesion_mask: np.ndarray, redness_map: np.ndarray) -> Dict:
    skin_mask = get_skin_mask(img_bgr)

    lesion = lesion_mask > 0
    skin = skin_mask > 0
    bg_skin = skin & (~lesion)

    lesion_area_px = int(np.sum(lesion))
    skin_area_px = int(np.sum(skin))

    lesion_red_mean = float(
        np.mean(redness_map[lesion])) if lesion_area_px > 0 else 0.0
    lesion_red_median = float(
        np.median(redness_map[lesion])) if lesion_area_px > 0 else 0.0

    bg_red_mean = float(np.mean(redness_map[bg_skin])) if np.sum(
        bg_skin) > 0 else 0.0
    bg_red_median = float(np.median(redness_map[bg_skin])) if np.sum(
        bg_skin) > 0 else 0.0

    area_percent_skin = 100.0 * lesion_area_px / \
        skin_area_px if skin_area_px > 0 else 0.0

    area_mm2 = None
    eq_diameter_mm = None
    if CFG.pixels_per_mm is not None and CFG.pixels_per_mm > 0:
        area_mm2 = lesion_area_px / (CFG.pixels_per_mm ** 2)
        eq_diameter_mm = math.sqrt((4.0 * area_mm2) / math.pi)

    labels = measure.label(lesion, connectivity=2)
    props = measure.regionprops(labels)

    bbox = None
    centroid = None
    n_components = len(props)

    if props:
        p = max(props, key=lambda x: x.area)
        minr, minc, maxr, maxc = p.bbox
        bbox = (int(minc), int(minr), int(maxc), int(maxr))
        centroid = (float(p.centroid[1]), float(p.centroid[0]))

    return {
        "lesion_area_px": lesion_area_px,
        "visible_skin_area_px": skin_area_px,
        "lesion_area_percent_visible_skin": area_percent_skin,
        "lesion_redness_mean": lesion_red_mean,
        "lesion_redness_median": lesion_red_median,
        "background_redness_mean": bg_red_mean,
        "background_redness_median": bg_red_median,
        "redness_contrast_mean": lesion_red_mean - bg_red_mean,
        "redness_contrast_median": lesion_red_median - bg_red_median,
        "area_mm2": area_mm2,
        "equivalent_diameter_mm": eq_diameter_mm,
        "bbox": bbox,
        "centroid": centroid,
        "n_components": n_components,
    }


def colorize_gray(gray: np.ndarray, cmap: int) -> np.ndarray:
    arr = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.applyColorMap(arr, cmap)


def mask_to_bgr(mask: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)


def make_overlay(img_bgr: np.ndarray, lesion_mask: np.ndarray) -> np.ndarray:
    overlay = img_bgr.copy()

    red_fill = np.zeros_like(overlay)
    red_fill[:, :, 2] = 255

    lesion_3 = np.dstack([lesion_mask > 0] * 3)
    overlay = np.where(
        lesion_3,
        (0.65 * overlay + 0.35 * red_fill).astype(np.uint8),
        overlay
    )

    contours, _ = cv2.findContours(
        lesion_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, contours, -1, (0, 0, 255), 2)

    labels = measure.label(lesion_mask > 0, connectivity=2)
    props = measure.regionprops(labels)
    if props:
        p = max(props, key=lambda x: x.area)
        minr, minc, maxr, maxc = p.bbox
        cv2.rectangle(overlay, (minc, minr), (maxc, maxr), (255, 255, 0), 2)

    return overlay


def add_title(img: np.ndarray, title: str) -> np.ndarray:
    canvas = img.copy()
    h, w = canvas.shape[:2]
    header_h = 35
    out = np.zeros((h + header_h, w, 3), dtype=np.uint8)
    out[header_h:, :, :] = canvas
    cv2.putText(out, title, (10, 24), cv2.FONT_HERSHEY_SIMPLEX,
                0.7, (255, 255, 255), 2, cv2.LINE_AA)
    return out


def save_debug_panel(img_bgr: np.ndarray, debug: Dict[str, np.ndarray], lesion_mask: np.ndarray, out_path: str) -> None:
    items = [
        ("Original", img_bgr),
        ("Skin", mask_to_bgr(debug["skin_mask"])),
        ("Red Mask", mask_to_bgr(debug["red_mask"])),
        ("Texture Mask", mask_to_bgr(debug["texture_mask"])),
        ("Scale Mask", mask_to_bgr(debug["scale_mask"])),
        ("Core", mask_to_bgr(debug["core_mask"])),
        ("Candidate", mask_to_bgr(debug["candidate_mask"])),
        ("Lesion", mask_to_bgr(lesion_mask)),
        ("Redness", colorize_gray(debug["redness_norm"], cv2.COLORMAP_JET)),
        ("Texture", colorize_gray(debug["texture_norm"], cv2.COLORMAP_TURBO)),
        ("Overlay", make_overlay(img_bgr, lesion_mask)),
    ]

    target_w = 350
    rendered = []
    for title, im in items:
        h, w = im.shape[:2]
        scale = target_w / w
        new_h = int(h * scale)
        im2 = cv2.resize(im, (target_w, new_h), interpolation=cv2.INTER_AREA)
        rendered.append(add_title(im2, title))

    max_h = max(im.shape[0] for im in rendered)
    padded = []
    for im in rendered:
        h, w = im.shape[:2]
        if h < max_h:
            pad = np.zeros((max_h - h, w, 3), dtype=np.uint8)
            im = np.vstack([im, pad])
        padded.append(im)

    rows = []
    cols = 3
    for i in range(0, len(padded), cols):
        row = padded[i:i + cols]
        while len(row) < cols:
            row.append(np.zeros_like(padded[0]))
        rows.append(np.hstack(row))

    panel = np.vstack(rows)
    cv2.imwrite(out_path, panel)


def compute_change(curr: Dict, base: Dict) -> Dict:
    keys = [
        "lesion_area_px",
        "lesion_area_percent_visible_skin",
        "lesion_redness_mean",
        "lesion_redness_median",
        "redness_contrast_mean",
        "redness_contrast_median",
    ]

    out = {}
    for k in keys:
        a = curr.get(k)
        b = base.get(k)
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            out[f"{k}_delta"] = a - b
            out[f"{k}_pct_change"] = (
                100.0 * (a - b) / abs(b)) if abs(b) > 1e-6 else None
    return out


def process_one_image(image_path: str) -> Dict:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read {image_path}")

    img_p = preprocess_image(img)

    lesion_mask, debug, stats = segment_psoriasis_eczema(img_p)
    metrics = compute_metrics(img_p, lesion_mask, debug["redness_map"])

    filename = os.path.basename(image_path)
    stem, _ = os.path.splitext(filename)

    ensure_dir(CFG.output_dir)

    overlay_path = os.path.join(CFG.output_dir, f"{stem}_overlay.png")
    mask_path = os.path.join(CFG.output_dir, f"{stem}_mask.png")
    panel_path = os.path.join(CFG.output_dir, f"{stem}_debug_panel.png")
    processed_path = os.path.join(CFG.output_dir, f"{stem}_processed.png")
    red_path = os.path.join(CFG.output_dir, f"{stem}_redness.png")
    tex_path = os.path.join(CFG.output_dir, f"{stem}_texture.png")
    scale_path = os.path.join(CFG.output_dir, f"{stem}_scales.png")
    skin_path = os.path.join(CFG.output_dir, f"{stem}_skin.png")

    cv2.imwrite(overlay_path, make_overlay(img_p, lesion_mask))
    cv2.imwrite(mask_path, lesion_mask)
    cv2.imwrite(processed_path, img_p)
    cv2.imwrite(red_path, colorize_gray(
        debug["redness_norm"], cv2.COLORMAP_JET))
    cv2.imwrite(tex_path, colorize_gray(
        debug["texture_norm"], cv2.COLORMAP_TURBO))
    cv2.imwrite(scale_path, debug["scale_mask"])
    cv2.imwrite(skin_path, debug["skin_mask"])
    save_debug_panel(img_p, debug, lesion_mask, panel_path)

    record = {
        "filename": filename,
        "day": parse_day_from_filename(filename, CFG.day_regex),
        "overlay_path": overlay_path,
        "mask_path": mask_path,
        "panel_path": panel_path,
        "processed_path": processed_path,
        "redness_path": red_path,
        "texture_path": tex_path,
        "scale_path": scale_path,
        "skin_path": skin_path,
        **stats,
        **metrics,
    }

    bbox = metrics.get("bbox")
    centroid = metrics.get("centroid")

    if bbox is not None:
        record["bbox_x1"], record["bbox_y1"], record["bbox_x2"], record["bbox_y2"] = bbox
    else:
        record["bbox_x1"] = record["bbox_y1"] = record["bbox_x2"] = record["bbox_y2"] = None

    if centroid is not None:
        record["centroid_x"], record["centroid_y"] = centroid
    else:
        record["centroid_x"] = record["centroid_y"] = None

    return record


def main():
    ensure_dir(CFG.output_dir)

    exts = ["*.jpg", "*.jpeg", "*.png", "*.bmp", "*.tif", "*.tiff"]
    image_paths: List[str] = []
    for ext in exts:
        image_paths.extend(glob.glob(os.path.join(CFG.input_dir, ext)))

    image_paths = sorted(image_paths, key=natural_key)

    if not image_paths:
        print(f"No images found in {CFG.input_dir}")
        return

    records = []
    for path in image_paths:
        try:
            rec = process_one_image(path)
            records.append(rec)
            print(
                f"Processed {rec['filename']} | "
                f"area_px={rec['lesion_area_px']} | "
                f"redness={rec['lesion_redness_mean']:.2f} | "
                f"scale_px={rec['scale_area_px']}"
            )
        except Exception as e:
            print(f"Failed {path}: {e}")

    if not records:
        print("Nothing processed.")
        return

    df = pd.DataFrame(records)

    if df["day"].notna().any():
        df = df.sort_values(["day", "filename"],
                            na_position="last").reset_index(drop=True)
    else:
        df = df.sort_values(["filename"]).reset_index(drop=True)

    baseline = df.iloc[0].to_dict()
    changes = [compute_change(row.to_dict(), baseline)
               for _, row in df.iterrows()]
    df = pd.concat([df, pd.DataFrame(changes)], axis=1)

    csv_path = os.path.join(CFG.output_dir, "lesion_tracking_results.csv")
    df.to_csv(csv_path, index=False)

    print("\nSaved:", csv_path)
    print(
        df[
            [
                "filename",
                "day",
                "lesion_area_px",
                "lesion_area_percent_visible_skin",
                "lesion_redness_mean",
                "redness_contrast_mean",
                "scale_area_px",
            ]
        ].to_string(index=False)
    )


if __name__ == "__main__":
    main()
