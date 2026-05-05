from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from io import BytesIO
from app.gemini_service import analyze_with_gemini
from PIL import Image
import torch
import timm
from torchvision import transforms


MODEL_NAME = "swin_small_patch4_window7_224"
IMG_SIZE = 224

CLASS_NAMES = sorted([
    "Acne and Rosacea Photos",
    "Actinic Keratosis Basal Cell Carcinoma and other Malignant Lesions",
    "Atopic Dermatitis Photos",
    "Bullous Disease Photos",
    "Cellulitis Impetigo and other Bacterial Infections",
    "Eczema Photos",
    "Exanthems and Drug Eruptions",
    "Hair Loss Photos Alopecia and other Hair Diseases",
    "Herpes HPV and other STDs Photos",
    "Light Diseases and Disorders of Pigmentation",
    "Lupus and other Connective Tissue diseases",
    "Melanoma Skin Cancer Nevi and Moles",
    "Nail Fungus and other Nail Disease",
    "Poison Ivy Photos and other Contact Dermatitis",
    "Psoriasis pictures Lichen Planus and related diseases",
    "Scabies Lyme Disease and other Infestations and Bites",
    "Seborrheic Keratoses and other Benign Tumors",
    "Systemic Disease",
    "Tinea Ringworm Candidiasis and other Fungal Infections",
    "Urticaria Hives",
    "Vascular Tumors",
    "Vasculitis Photos",
    "Warts Molluscum and other Viral Infections",
])


preprocess = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])


def load_model(weights_path: str, device: torch.device):
    try:
        checkpoint = torch.load(weights_path, map_location="cpu", weights_only=True)
    except TypeError:
        checkpoint = torch.load(weights_path, map_location="cpu")

    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
    else:
        state_dict = checkpoint

    model = timm.create_model(
        MODEL_NAME,
        pretrained=False,
        num_classes=len(CLASS_NAMES),
    )

    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    if missing or unexpected:
        pass

    model.to(device).eval()
    return model


def predict_top3(image_bytes: bytes):
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    x = preprocess(img).unsqueeze(0).to(DEVICE)

    with torch.inference_mode():
        logits = MODEL(x)
        probs = torch.softmax(logits, dim=1)[0]

    top_probs, top_indices = torch.topk(probs, k=3)

    result = []
    for p, idx in zip(top_probs.tolist(), top_indices.tolist()):
        result.append({
            "class_name": CLASS_NAMES[idx],
            "probability": float(p),
        })

    return result


app = FastAPI(title="Skin Disease Classifier", version="1.0")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None


@app.on_event("startup")
def _startup():
    global MODEL
    weights_path = "app/final_model_v1.pth"
    MODEL = load_model(weights_path, DEVICE)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(DEVICE)
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