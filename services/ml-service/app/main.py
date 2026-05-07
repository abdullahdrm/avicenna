from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from io import BytesIO
from pathlib import Path
from app.gemini_service import analyze_with_gemini
from PIL import Image
import cv2
import numpy as np
import torch
import timm
from torchvision import transforms


MODEL_NAME = "swinv2_small_window8_256.ms_in1k"
IMG_SIZE = 256
DROP_PATH_RATE = 0.20
USE_TTA = True
WEIGHTS_PATH = (
    Path(__file__).resolve().parent.parent
    / "final_5_class"
    / "dermnet_5class_cc_clahe_lab_unsharp_hsvv_v2_improved_best.pth"
)

CLASS_NAMES = [
    "acne",
    "eczema",
    "fungal",
    "psoriasis",
    "others",
]


class ShadesOfGray:
    def __init__(self, power=6, percentile=99.5, eps=1e-6):
        self.power = power
        self.percentile = percentile
        self.eps = eps

    def __call__(self, img: Image.Image) -> Image.Image:
        arr = np.asarray(img).astype(np.float32) + 1.0
        illum = np.power(
            np.mean(np.power(arr, self.power), axis=(0, 1)),
            1.0 / self.power,
        )
        illum = illum / (np.linalg.norm(illum) + self.eps)
        scale = np.sqrt(3.0) / (illum + self.eps)
        arr = arr * scale[None, None, :]
        hi = np.percentile(arr, self.percentile)
        arr = np.clip(arr * (255.0 / (hi + self.eps)), 0, 255).astype(np.uint8)
        return Image.fromarray(arr)


class CLAHELab:
    def __init__(self, clip_limit=0.5, tile_grid_size=(8, 8), blend=0.25):
        self.clip_limit = clip_limit
        self.tile_grid_size = tile_grid_size
        self.blend = blend

    def __call__(self, img: Image.Image) -> Image.Image:
        arr = np.ascontiguousarray(np.asarray(img).astype(np.uint8))
        lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        l_orig = l.copy()
        clahe = cv2.createCLAHE(
            clipLimit=self.clip_limit,
            tileGridSize=self.tile_grid_size,
        )
        l_clahe = clahe.apply(l)

        if self.blend >= 1.0:
            l_new = l_clahe
        elif self.blend <= 0.0:
            l_new = l_orig
        else:
            l_new = cv2.addWeighted(
                l_clahe,
                float(self.blend),
                l_orig,
                float(1.0 - self.blend),
                0.0,
            )

        rgb = cv2.cvtColor(cv2.merge((l_new, a, b)), cv2.COLOR_LAB2RGB)
        return Image.fromarray(rgb)


class UnsharpMaskHSVValue:
    def __init__(self, sigma=0.8, amount=0.10, threshold=6.0):
        self.sigma = sigma
        self.amount = amount
        self.threshold = threshold

    def __call__(self, img: Image.Image) -> Image.Image:
        arr = np.ascontiguousarray(np.asarray(img).astype(np.uint8))
        hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
        h, s, v = cv2.split(hsv)
        v_f = v.astype(np.float32)
        blurred = cv2.GaussianBlur(
            v_f,
            ksize=(0, 0),
            sigmaX=self.sigma,
            sigmaY=self.sigma,
        )
        sharpened = cv2.addWeighted(
            v_f,
            1.0 + self.amount,
            blurred,
            -self.amount,
            0.0,
        )

        if self.threshold > 0:
            low_contrast_mask = np.abs(v_f - blurred) < self.threshold
            sharpened[low_contrast_mask] = v_f[low_contrast_mask]

        v_new = np.clip(sharpened, 0, 255).astype(np.uint8)
        rgb = cv2.cvtColor(cv2.merge((h, s, v_new)), cv2.COLOR_HSV2RGB)
        return Image.fromarray(rgb)


preprocess = transforms.Compose([
    ShadesOfGray(power=6, percentile=99.5, eps=1e-6),
    transforms.Resize(IMG_SIZE + 32),
    transforms.CenterCrop(IMG_SIZE),
    CLAHELab(clip_limit=0.5, tile_grid_size=(8, 8), blend=0.25),
    UnsharpMaskHSVValue(sigma=0.8, amount=0.10, threshold=6.0),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])


def configure_model_input_size(model, img_size: int):
    if hasattr(model, "set_input_size"):
        try:
            model.set_input_size(img_size=(img_size, img_size))
        except TypeError:
            model.set_input_size(img_size=img_size)

    if hasattr(model, "patch_embed"):
        if hasattr(model.patch_embed, "strict_img_size"):
            model.patch_embed.strict_img_size = False
        if hasattr(model.patch_embed, "img_size"):
            model.patch_embed.img_size = None


def load_model(weights_path: Path, device: torch.device):
    if not weights_path.exists():
        raise RuntimeError(f"Model weights not found: {weights_path}")

    try:
        checkpoint = torch.load(weights_path, map_location="cpu", weights_only=True)
    except TypeError:
        checkpoint = torch.load(weights_path, map_location="cpu")

    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
        checkpoint_model_name = checkpoint.get("model_name")
        checkpoint_class_names = checkpoint.get("class_names")

        if checkpoint_model_name and checkpoint_model_name != MODEL_NAME:
            raise RuntimeError(
                f"Checkpoint model mismatch: {checkpoint_model_name} != {MODEL_NAME}"
            )

        if checkpoint_class_names and list(checkpoint_class_names) != CLASS_NAMES:
            raise RuntimeError(
                f"Checkpoint classes mismatch: {checkpoint_class_names} != {CLASS_NAMES}"
            )
    else:
        state_dict = checkpoint

    model = timm.create_model(
        MODEL_NAME,
        pretrained=False,
        num_classes=len(CLASS_NAMES),
        drop_path_rate=DROP_PATH_RATE,
    )
    configure_model_input_size(model, IMG_SIZE)
    model.load_state_dict(state_dict, strict=True)
    model.to(device).eval()
    return model


def predict_top3(image_bytes: bytes):
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")

    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    x = preprocess(img).unsqueeze(0).to(DEVICE)

    with torch.inference_mode():
        if USE_TTA:
            batch = torch.cat([
                x,
                torch.flip(x, dims=[3]),
                torch.flip(x, dims=[2]),
                torch.rot90(x, k=1, dims=[2, 3]),
                torch.rot90(x, k=3, dims=[2, 3]),
            ], dim=0)
            logits = MODEL(batch)
            probs = torch.softmax(logits, dim=1).mean(dim=0)
        else:
            logits = MODEL(x)
            probs = torch.softmax(logits, dim=1)[0]

    top_probs, top_indices = torch.topk(probs, k=min(3, len(CLASS_NAMES)))

    result = []
    for p, idx in zip(top_probs.tolist(), top_indices.tolist()):
        result.append({
            "class_name": CLASS_NAMES[idx],
            "probability": float(p),
        })

    return result


app = FastAPI(title="Skin Disease Classifier", version="2.0")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None


@app.on_event("startup")
def _startup():
    global MODEL
    MODEL = load_model(WEIGHTS_PATH, DEVICE)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(DEVICE),
        "model_name": MODEL_NAME,
        "classes": CLASS_NAMES,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in {
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
        "image/bmp",
    }:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content-type: {file.content_type}"
        )

    image_bytes = await file.read()
    top3 = predict_top3(image_bytes)

    model_output = {
        "class_name": top3[0]["class_name"],
        "probability": float(f"{top3[0]['probability']:.2f}")
    }

    return {
        "model": model_output
    }


@app.post("/analyze")
async def analyze_patient(
    patient_info: str = Form(...),
    file: UploadFile = File(...)
):
    if file.content_type not in {
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
        "image/bmp",
    }:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content-type: {file.content_type}"
        )

    image_bytes = await file.read()

    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    top3 = predict_top3(image_bytes)

    gemini_result = analyze_with_gemini(img, patient_info, top3)

    model_output = {
        "class_name": top3[0]["class_name"],
        "probability": float(f"{top3[0]['probability']:.2f}")
    }

    return {
        "status": gemini_result.get("status", "success"),
        "model": model_output,
        "gemini_analysis": gemini_result.get("gemini_analysis"),
        "gemini_summary": gemini_result.get("gemini_summary"),
        "gemini_final_response": gemini_result.get("gemini_final_response"),
        "gemini_final_response_form": gemini_result.get("gemini_final_response_form")
    }
