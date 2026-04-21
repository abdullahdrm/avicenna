from __future__ import annotations

import argparse
import csv
import itertools
import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


SUPPORTED_EXTS = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class Variant:
    variant_id: str
    clahe_clip: float
    clahe_tile: int
    gray_p: int
    blur_sigma: float


def list_images(input_dir: Path, max_images: int | None) -> list[Path]:
    files = [
        p for p in sorted(input_dir.rglob("*"))
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS
    ]
    if max_images is not None:
        return files[:max_images]
    return files


def resize_max(img: np.ndarray, max_side: int = 1400) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) <= max_side:
        return img
    s = max_side / float(max(h, w))
    return cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)


def shades_of_gray_cc(bgr: np.ndarray, p: int = 6) -> np.ndarray:
    img = bgr.astype(np.float32) + 1e-6
    power = np.power(img, p)
    mean_power = np.mean(power, axis=(0, 1))
    norm = np.power(mean_power, 1.0 / p)
    img = img / norm
    img *= 255.0 / np.max(img)
    return np.clip(img, 0, 255).astype(np.uint8)


def clahe_l_channel(bgr: np.ndarray, clip: float, tile: int) -> np.ndarray:
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l_chan, a_chan, b_chan = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
    l_enh = clahe.apply(l_chan)
    merged = cv2.merge([l_enh, a_chan, b_chan])
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def preprocess_variant(bgr: np.ndarray, v: Variant) -> np.ndarray:
    out = resize_max(bgr)
    out = shades_of_gray_cc(out, p=v.gray_p)
    out = clahe_l_channel(out, clip=v.clahe_clip, tile=v.clahe_tile)
    if v.blur_sigma > 0.0:
        out = cv2.GaussianBlur(out, (0, 0), sigmaX=v.blur_sigma, sigmaY=v.blur_sigma)
    return out


def compute_metrics(bgr: np.ndarray) -> dict[str, float]:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)

    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast = float(np.std(lab[:, :, 0]))

    l = lab[:, :, 0].astype(np.float32)
    clip_low = float(np.mean(l <= 5.0))
    clip_high = float(np.mean(l >= 250.0))
    clip_ratio = clip_low + clip_high

    means = np.mean(bgr.reshape(-1, 3), axis=0)
    color_cast = float(np.mean(np.abs(means - np.mean(means))) / 255.0)

    return {
        "sharpness": sharpness,
        "contrast": contrast,
        "clip_ratio": clip_ratio,
        "color_cast": color_cast,
    }


def minmax_scale(values: list[float]) -> list[float]:
    if not values:
        return []
    v_min = min(values)
    v_max = max(values)
    if abs(v_max - v_min) < 1e-12:
        return [0.5 for _ in values]
    return [(v - v_min) / (v_max - v_min) for v in values]


def score_rows_for_single_image(rows: list[dict]) -> None:
    sharp_vals = [r["sharpness"] for r in rows]
    contrast_vals = [r["contrast"] for r in rows]
    clip_vals = [r["clip_ratio"] for r in rows]
    cast_vals = [r["color_cast"] for r in rows]

    sharp_n = minmax_scale(sharp_vals)
    contrast_n = minmax_scale(contrast_vals)
    clip_n = minmax_scale(clip_vals)
    cast_n = minmax_scale(cast_vals)

    for i, row in enumerate(rows):
        row["cv_score"] = float(
            0.35 * sharp_n[i]
            + 0.35 * contrast_n[i]
            + 0.20 * (1.0 - clip_n[i])
            + 0.10 * (1.0 - cast_n[i])
        )


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def build_variants() -> list[Variant]:
    clips = [1.5, 2.0, 2.5, 3.0]
    tiles = [6, 8, 10]
    gray_ps = [4, 6, 8]
    blur_sigmas = [0.0, 0.8]

    variants: list[Variant] = []
    idx = 1
    for clip, tile, gray_p, blur in itertools.product(clips, tiles, gray_ps, blur_sigmas):
        variants.append(
            Variant(
                variant_id=f"v{idx:03d}",
                clahe_clip=clip,
                clahe_tile=tile,
                gray_p=gray_p,
                blur_sigma=blur,
            )
        )
        idx += 1
    return variants


def save_preview_set(
    image_path: Path,
    bgr0: np.ndarray,
    top_variants: list[Variant],
    output_dir: Path,
) -> None:
    stem = image_path.stem
    for v in top_variants:
        out = preprocess_variant(bgr0, v)
        variant_dir = output_dir / "previews" / v.variant_id
        variant_dir.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(variant_dir / f"{stem}.png"), out)


def main() -> None:
    parser = argparse.ArgumentParser(description="Preprocessing parameter tuner")
    parser.add_argument(
        "--input-dir",
        default="ml/datasets/fungal_images_real",
        help="Directory of input images",
    )
    parser.add_argument(
        "--output-dir",
        default="services/processing_images/test_outputs/preprocess_tuning",
        help="Directory to save tuning outputs",
    )
    parser.add_argument("--max-images", type=int, default=20, help="Max images to process")
    parser.add_argument("--top-global", type=int, default=5, help="Top variants for preview/LLM")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    images = list_images(input_dir, args.max_images)
    if not images:
        raise SystemExit(f"No images found in: {input_dir}")

    variants = build_variants()
    all_rows: list[dict] = []

    print(f"Images: {len(images)}")
    print(f"Variants: {len(variants)}")

    for img_path in images:
        bgr0 = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        if bgr0 is None:
            print(f"[Skip] unreadable image: {img_path}")
            continue

        image_rows: list[dict] = []
        for v in variants:
            processed = preprocess_variant(bgr0, v)
            m = compute_metrics(processed)
            row = {
                "image": str(img_path),
                "variant_id": v.variant_id,
                "clahe_clip": v.clahe_clip,
                "clahe_tile": v.clahe_tile,
                "gray_p": v.gray_p,
                "blur_sigma": v.blur_sigma,
                **m,
            }
            image_rows.append(row)

        score_rows_for_single_image(image_rows)
        all_rows.extend(image_rows)

    if not all_rows:
        raise SystemExit("No valid rows were generated.")

    all_fields = [
        "image",
        "variant_id",
        "clahe_clip",
        "clahe_tile",
        "gray_p",
        "blur_sigma",
        "sharpness",
        "contrast",
        "clip_ratio",
        "color_cast",
        "cv_score",
    ]
    write_csv(output_dir / "all_scores.csv", all_rows, all_fields)

    best_by_image: dict[str, dict] = {}
    for row in all_rows:
        key = row["image"]
        if key not in best_by_image or row["cv_score"] > best_by_image[key]["cv_score"]:
            best_by_image[key] = row
    best_rows = list(best_by_image.values())
    write_csv(output_dir / "best_params_per_image.csv", best_rows, all_fields)

    agg: dict[str, dict] = {}
    for row in all_rows:
        v_id = row["variant_id"]
        if v_id not in agg:
            agg[v_id] = {
                "variant_id": v_id,
                "clahe_clip": row["clahe_clip"],
                "clahe_tile": row["clahe_tile"],
                "gray_p": row["gray_p"],
                "blur_sigma": row["blur_sigma"],
                "count": 0,
                "cv_score_sum": 0.0,
            }
        agg[v_id]["count"] += 1
        agg[v_id]["cv_score_sum"] += row["cv_score"]

    global_rows: list[dict] = []
    for item in agg.values():
        n = max(1, item["count"])
        global_rows.append(
            {
                "variant_id": item["variant_id"],
                "clahe_clip": item["clahe_clip"],
                "clahe_tile": item["clahe_tile"],
                "gray_p": item["gray_p"],
                "blur_sigma": item["blur_sigma"],
                "images_count": item["count"],
                "avg_cv_score": item["cv_score_sum"] / n,
            }
        )

    global_rows.sort(key=lambda r: r["avg_cv_score"], reverse=True)
    write_csv(
        output_dir / "global_variant_ranking.csv",
        global_rows,
        [
            "variant_id",
            "clahe_clip",
            "clahe_tile",
            "gray_p",
            "blur_sigma",
            "images_count",
            "avg_cv_score",
        ],
    )

    top_n_rows = global_rows[: max(1, args.top_global)]
    top_variants_lookup = {v.variant_id: v for v in variants}
    top_variants = [top_variants_lookup[r["variant_id"]] for r in top_n_rows]

    for img_path in images[: min(10, len(images))]:
        bgr0 = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        if bgr0 is None:
            continue
        save_preview_set(img_path, bgr0, top_variants, output_dir)

    payload = {
        "task": "Rank preprocessing variants using visual quality for lesion analysis.",
        "rubric": [
            "Preserve lesion boundaries and small spots",
            "Avoid over-smoothing and detail loss",
            "Improve contrast without clipping highlights/shadows",
            "Maintain natural skin tones",
        ],
        "top_variants": top_n_rows,
        "preview_root": str(output_dir / "previews"),
        "recommended_next_step": "Use this payload as input to LLM review and combine LLM rank with avg_cv_score.",
    }
    with (output_dir / "llm_review_payload.json").open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Saved: {output_dir / 'all_scores.csv'}")
    print(f"Saved: {output_dir / 'best_params_per_image.csv'}")
    print(f"Saved: {output_dir / 'global_variant_ranking.csv'}")
    print(f"Saved: {output_dir / 'llm_review_payload.json'}")


if __name__ == "__main__":
    main()
