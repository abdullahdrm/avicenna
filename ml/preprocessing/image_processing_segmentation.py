import os, glob, cv2, numpy as np
import matplotlib
matplotlib.use("Agg")  
import matplotlib.pyplot as plt
from PIL import Image
from skimage.segmentation import slic
from skimage.filters.rank import entropy
from skimage.morphology import disk


INPUT_DIR       = "../datasets/testing/inputs"          
OUTPUT_DIR      = "../datasets/testing/outputs"        
REVIEW_DIR      = "../datasets/testing/review_outputs"  

MAX_SIDE        = 1400              # Downscale long side 
N_SEGMENTS      = 1200              # Number of SLIC superpixels (higher = finer regions)
SLIC_COMPACT    = 10                # SLIC compactness; higher favors spatial proximity over color similarity.
KMEANS_K        = 2                 # Number of KMeans clusters in Lab space (lesion vs. skin).
GRABCUT_ITERS   = 5                 # Iterations for GrabCut refinement (GMM + graph cut).

# Superpixel score threshold values
FG_Q            = 0.75
PFG_Q           = 0.55
PBG_Q           = 0.40
BG_Q            = 0.25

MIN_REGION_AREA = 200              # Minimum area in pixels
POST_CLOSE_K    = 5                # Kernel size for morphological closing 


def ensure_dirs():
    """ directories """
    os.makedirs(INPUT_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(REVIEW_DIR, exist_ok=True)


def list_images(inp_dir=INPUT_DIR):
    """ images on the inputs """
    exts = ("*.png","*.jpg","*.jpeg")
    files = []
    for e in exts:
        files.extend(glob.glob(os.path.join(inp_dir, "**", e), recursive=True))
    files = [f for f in files if os.path.isfile(f)]
    files.sort()
    return files


def resize_max(img, max_side=MAX_SIDE):
    """
    Downscale an image while preserving aspect ratio.
    Scale factor s = max_side / max(H, W).
    New size = (floor(W*s), floor(H*s)).
    """
    h, w = img.shape[:2]
    if max(h,w) <= max_side:
        return img
    s = max_side/float(max(h, w))
    return cv2.resize(img, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)


def shades_of_gray_cc(bgr, p=6):
    """
    Shades-of-Gray color constancy (per-channel gain normalization).
    For each channel c: gain k_c = (E[I_c^p])^(-1/p).
    Then rescale to [0, 255] by max normalization.
    """
    img = bgr.astype(np.float32) + 1e-6
    power = np.power(img, p)
    mean_power = np.mean(power, axis=(0, 1))
    norm = np.power(mean_power, 1.0 / p)
    img = img / norm
    img *= (255.0 / np.max(img))
    return np.clip(img, 0, 255).astype(np.uint8)


def clahe_L(bgr, clip=2.0, tiles=(8,8)):
    """Apply CLAHE to the L channel in Lab space to boost local contrast."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L,A,B = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=tiles)
    L2 = clahe.apply(L)
    return cv2.cvtColor(cv2.merge([L2,A,B]), cv2.COLOR_LAB2BGR)


def preprocess(bgr):
    """Preprocess pipeline: resize_max → Shades-of-Gray → CLAHE(Lab-L)."""
    bgr = resize_max(bgr, MAX_SIDE)
    bgr = shades_of_gray_cc(bgr, p=6)
    bgr = clahe_L(bgr, 2.0, (8,8))
    return bgr


def kmeans_mask_lab(bgr, k=2, attempts=8):
    """
    KMeans clustering in Lab space using OpenCV (no scikit-learn).
    Lesion cluster = the one with the lowest mean L (darker).
    Returns: (binary_mask, labels_2d, lesion_idx)
    """
    lab_img = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    h, w = lab_img.shape[:2]
    X = lab_img.reshape(-1, 3).astype(np.float32)

    # criteria: max 50 iters or epsilon 0.2
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.2)
    flags = cv2.KMEANS_PP_CENTERS

    _compactness, labels, centers = cv2.kmeans(
        data=X, K=k, bestLabels=None, criteria=criteria,
        attempts=attempts, flags=flags
    )
    labels2d = labels.reshape(h, w)

    L = lab_img[:, :, 0]
    lesion_idx = int(np.argmin([L[labels2d == i].mean() for i in range(k)]))
    mask = (labels2d == lesion_idx).astype(np.uint8) * 255
    return mask, labels2d, lesion_idx


def texture_maps(gray):
    """
    Texture/edge cues:
      - LoG magnitude: |∇^2 (G_σ * I)|, highlights fine structures.
      - Local entropy H in a disk neighborhood, measures local complexity.
    Returns (log_abs ∈ [0,1], entropy_norm ∈ [0,1]).
    """
    g = cv2.GaussianBlur(gray, (0,0), sigmaX=1.2, sigmaY=1.2)
    log_abs = np.abs(cv2.Laplacian(g, cv2.CV_32F, ksize=3))
    log_abs = cv2.normalize(log_abs, None, 0, 1.0, cv2.NORM_MINMAX)
    g8 = gray.astype(np.uint8)
    ent = entropy(g8, disk(9)).astype(np.float32)
    ent = (ent - ent.min())/(ent.max()-ent.min() + 1e-6)
    return log_abs, ent


def superpixel_scores(rgb, labels_sp, lesion_bins, log_abs, ent):
    """
    Fuse cues per superpixel:
      - lr(S_i) = mean(lesion_bins | S_i)    (KMeans lesion ratio)
      - lm(S_i) = mean(log_abs | S_i)        (LoG structural cue)
      - em(S_i) = mean(entropy | S_i)        (texture complexity)
    Combined score (normalized into [0,1]):
      score = 0.5*lr + 0.25*lm + 0.25*em
    """
    sp_ids = np.unique(labels_sp)
    score = np.zeros_like(labels_sp, dtype=np.float32)

    lesion_ratio = np.zeros(sp_ids.shape[0], dtype=np.float32)
    log_mean     = np.zeros_like(lesion_ratio)
    ent_mean     = np.zeros_like(lesion_ratio)

    for idx, sp in enumerate(sp_ids):
        m = (labels_sp == sp)
        lesion_ratio[idx] = lesion_bins[m].mean()
        log_mean[idx]     = log_abs[m].mean()
        ent_mean[idx]     = ent[m].mean()

    def nz_norm(v):
        v = (v - v.min())/(v.max()-v.min() + 1e-6)
        return v.astype(np.float32)

    lr = nz_norm(lesion_ratio)
    lm = nz_norm(log_mean)
    em = nz_norm(ent_mean)

    sp_score = 0.5*lr + 0.25*lm + 0.25*em

    for idx, sp in enumerate(sp_ids):
        score[labels_sp==sp] = sp_score[idx]

    return score


def to_trimap(score, fg_q=FG_Q, pfg_q=PFG_Q, pbg_q=PBG_Q, bg_q=BG_Q):
    """Convert fused score map into a trimap: 0=BG, 1=PR_BGD, 2=PR_FGD, 3=FGD."""
    tri = np.zeros_like(score, dtype=np.uint8)
    tri[score < bg_q] = 0
    tri[(score >= bg_q) & (score < pbg_q)] = 1
    tri[(score >= pfg_q) & (score < fg_q)] = 2
    tri[score >= fg_q] = 3
    return tri


def grabcut_refine(bgr, tri, iters=GRABCUT_ITERS):
    """
    GrabCut refinement using the trimap as initialization (GC_INIT_WITH_MASK).
    Returns a binary mask where FG and PR_FG are set to 255.
    """
    GC_BGD, GC_PR_BGD, GC_PR_FGD, GC_FGD = 0, 2, 3, 1
    m = np.zeros(tri.shape, np.uint8)
    m[tri==0] = GC_BGD
    m[tri==1] = GC_PR_BGD
    m[tri==2] = GC_PR_FGD
    m[tri==3] = GC_FGD
    bgdModel = np.zeros((1,65), np.float64)
    fgdModel = np.zeros((1,65), np.float64)
    cv2.grabCut(bgr, m, None, bgdModel, fgdModel, iters, cv2.GC_INIT_WITH_MASK)
    mask = np.where((m==GC_FGD)|(m==GC_PR_FGD), 255, 0).astype('uint8')
    return mask


def postprocess_mask(mask):
    """
    Post-processing on the binary mask:
      1) Keep only components with area ≥ MIN_REGION_AREA.
      2) Morphological closing with elliptical kernel of size POST_CLOSE_K (if > 0).
      3) Hole filling via flood fill from the image border.
    """
    cnts,_ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    clean = np.zeros_like(mask)
    for c in cnts:
        if cv2.contourArea(c) >= MIN_REGION_AREA:
            cv2.drawContours(clean, [c], -1, 255, -1)
    if POST_CLOSE_K>0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (POST_CLOSE_K,POST_CLOSE_K))
        clean = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, k)
    h,w = clean.shape
    ff = clean.copy()
    cv2.floodFill(ff, np.zeros((h+2,w+2), np.uint8), (0,0), 255)
    ff_inv = cv2.bitwise_not(ff)
    clean = clean | ff_inv
    return clean


def overlay_mask(bgr, mask, color=(0,255,0), alpha=0.35):
    """Alpha-blend the mask over the image: O = (1 - α) * I + α * C (on mask>0 pixels)."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    overlay = rgb.copy()
    overlay[mask>0] = (overlay[mask>0]*(1-alpha) + np.array(color)*(alpha)).astype(np.uint8)
    return overlay


def process_image(bgr):
    """
    End-to-end pipeline:
      1) Preprocess
      2) KMeans (Lab, k=2) → coarse lesion cluster (OpenCV cv2.kmeans)
      3) SLIC superpixels
      4) LoG + entropy texture cues
      5) Superpixel score fusion
      6) Trimap thresholds
      7) GrabCut refinement
      8) Post-process mask
    Returns: (preprocessed_bgr, final_mask, score_map)
    """
    bgr = preprocess(bgr)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    km_mask, km_labels, lesion_idx = kmeans_mask_lab(bgr, KMEANS_K)
    km_bins = (km_labels==lesion_idx).astype(np.float32)

    labels_sp = slic(rgb, n_segments=N_SEGMENTS, compactness=SLIC_COMPACT, start_label=0)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    log_abs, ent = texture_maps(gray)

    score = superpixel_scores(rgb, labels_sp, km_bins, log_abs, ent)

    tri = to_trimap(score)
    gc = grabcut_refine(bgr, tri, GRABCUT_ITERS)

    final_mask = postprocess_mask(gc)
    return bgr, final_mask, score


def save_review_triptych(bgr, score, overlay_img, out_path_png):
    """
    Save a 3-panel review figure:
      (Preprocessed) | (Superpixel score) | (Final mask overlay)
    Titles are in English.
    """
    plt.figure(figsize=(15,5))
    plt.subplot(1,3,1); plt.title("Preprocessed"); plt.imshow(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)); plt.axis('off')
    plt.subplot(1,3,2); plt.title("Superpixel score"); plt.imshow(score, cmap='magma'); plt.axis('off')
    plt.subplot(1,3,3); plt.title("Final mask (overlay)"); plt.imshow(overlay_img); plt.axis('off')
    plt.tight_layout()
    plt.savefig(out_path_png, dpi=180)
    plt.close()


def main():
    """
    Batch processor:
      - Process all images under inputs/.
      - Save mask + overlay to outputs/ for every image.
      - Additionally, for every 100th image (1, 101, 201, ...), save a review triptych to review_outputs/.
    """
    ensure_dirs()
    files = list_images(INPUT_DIR)
    if not files:
        print(f"No images found under '{INPUT_DIR}/'. Supported: png/jpg/jpeg")
        return

    print(f"Found {len(files)} images. Processing...")
    for idx, p in enumerate(files, start=1):
        bgr0 = cv2.imread(p, cv2.IMREAD_COLOR)
        if bgr0 is None:
            print(f"[Skip] Could not read: {p}")
            continue

        bgr, mask, score = process_image(bgr0)
        base = os.path.splitext(os.path.basename(p))[0]

        # Save final outputs (mask + overlay) for every image
        ov = overlay_mask(bgr, mask, color=(0,255,0), alpha=0.35)
        mask_path    = os.path.join(OUTPUT_DIR, f"{base}__mask.png")
        overlay_path = os.path.join(OUTPUT_DIR, f"{base}__overlay.png")
        cv2.imwrite(mask_path, mask)
        Image.fromarray(ov).save(overlay_path)

        # For every 100th image (1, 101, 201, ...), also save a triptych for manual review
        if (idx-1) % 100 == 0:
            review_path = os.path.join(REVIEW_DIR, f"{base}__review.png")
            save_review_triptych(bgr, score, ov, review_path)

        if idx % 25 == 0 or idx == len(files):
            print(f"Processed {idx}/{len(files)}")

    print(f"Done. Outputs → '{OUTPUT_DIR}', reviews → '{REVIEW_DIR}'")


if __name__ == "__main__":
    main()
