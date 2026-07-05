# Avicenna — AI-Powered Dermatology Assistant

> A full-stack AI system that analyzes skin condition images using a fine-tuned **Swin Transformer V2** model and provides clinical reasoning via **Google Gemini 2.5 Flash**.  
> Built as a graduation project at **METU (Middle East Technical University)**.

---

## 🔬 System Overview

![Avicenna Full System Pipeline](docs/assets/full_system.png)

The pipeline works in two parallel tracks:

- **Vision Track:** Raw skin image → Color Constancy → CLAHE (LAB-L) → Unsharp Mask (HSV-V) → SwinV2 → Top-1 class + probability
- **Context Track:** Patient info (age, gender, history) + complaint → fed into Gemini alongside vision output
- **Fusion:** Gemini 2.5 Flash receives vision predictions, patient context, and the preprocessed image to generate a structured clinical report with a detailed analysis, a summary, and a dedicated medical advice paragraph

---

## 🧠 Model: Fine-Tuned SwinV2 Small

![SwinV2 Fine-Tuning Strategy & Preprocessing Results](docs/assets/swin_model_info.png)

### 3-Stage Fine-Tuning Strategy

The backbone `swinv2_small_window8_256.ms_in1k` (pre-trained on ImageNet-1K, 24 transformer blocks) was fine-tuned progressively:

| Stage | What's Trainable | Input Size | Key Settings |
|---|---|---|---|
| **Stage 1** — Head & Norm Adaptation | head, norm | 224 | LR: head 8e-4 / norm 2e-5 · Mixup ON · 3 epochs |
| **Stage 2** — Partial Backbone | layers.2, layers.3, head, norm | 224→256 | LR: layers 2.4e-5–3e-5 · Early stop patience 5 · 35 max epochs |
| **Stage 3** — Full Model Fine-Tuning | all layers | 256 | LR: backbone 1.2e-5 / head 2.5e-5 · Mixup OFF · 12 epochs |

### Preprocessing Pipeline Impact

Each preprocessing step was added incrementally and evaluated on the test set:

| Configuration | Preprocessing | Test Acc | F1 Weighted | F1 Macro |
|---|---|---|---|---|
| Fine-Tuned Baseline | None (raw image) | 82.11 | 81.98 | 81.79 |
| + Color Constancy | Shades of Gray | 82.38 (+0.27) | 82.32 (+0.34) | 83.14 (+1.35) |
| + CLAHE | CC + CLAHE (LAB-L) | 83.13 (+0.75) | 83.14 (+0.82) | 83.87 (+0.73) |
| **+ Unsharp Mask (Full Pipeline)** | **CC + CLAHE + Unsharp (HSV-V)** | **84.00 (+0.87)** | **83.96 (+0.82)** | **84.68 (+0.81)** |

**Net gain over baseline: +1.89 Accuracy · +1.98 F1 Weighted · +2.89 F1 Macro**

### Why This Preprocessing Order?

```
RGB Image
  → Color Constancy (Shades of Gray)   # standardize lighting & color balance first
  → LAB color space
  → CLAHE on L channel only            # local contrast enhancement, color-safe
  → back to RGB
  → HSV color space
  → Unsharp Mask on V channel only     # edge/texture sharpening, no hue/saturation impact
  → back to RGB
  → SwinV2 inference
```

Color correction must happen before contrast enhancement; sharpening last to avoid amplifying noise.

---

## 📊 Final Model Performance

| Metric | Value |
|---|---|
| Architecture | `swinv2_small_window8_256.ms_in1k` |
| Classes | acne · eczema · fungal · psoriasis · others |
| Test Accuracy (TTA-5) | **84.00%** |
| Test F1 Weighted | **0.8396** |
| Test F1 Macro | **0.8468** |
| Best Val F1 Weighted | 0.8100 (epoch 44) |
| Training Set | 6,466 images (DermNet) |
| Val / Test | 806 / 806 images |

---

## 🏗️ Repository Structure

```
avicenna/
├── services/
│   └── ml-service/              # FastAPI — classification + Gemini reasoning
│       ├── app/
│       │   ├── main.py              # REST API endpoints
│       │   └── gemini_service.py    # Gemini 2.5 Flash integration
│       ├── services/
│       │   ├── gemini_service.py
│       │   └── patient_health_report_service.py
│       ├── final_5_class/           # Training artifacts, confusion matrices, metrics JSON
│       ├── Dockerfile
│       └── requirements.txt
├── ml/
│   ├── notebooks/               # Training notebooks (all Swin experiments)
│   ├── preprocessing/segmentation/  # Skin segmentation microservice (FastAPI)
│   └── datasets/                # Sample test images
├── rag_dataset/                 # 1,800-entry dermatology Q&A dataset (JSONL)
│   └── gemini_dataset_create.py     # Dataset generation pipeline
├── llm/                         # LLM reasoning experiments & notebooks
├── swim_model/                  # Early Swin model experiments
├── docs/assets/                 # Architecture diagrams
├── docker-compose.yaml          # Single-command deployment
└── apps/                        # Mobile & web frontends
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)
- Model weights file (~186 MB, see below)

### 1. Clone & configure

```bash
git clone https://github.com/abdullahdrm/avicenna.git
cd avicenna

cp services/ml-service/.env.example services/ml-service/.env
# Open .env and set your GEMINI_API_KEY
```

### 2. Add model weights

Place the weights file at:

```
services/ml-service/final_5_class/dermnet_5class_cc_clahe_lab_unsharp_hsvv_v2_improved_best.pth
```

> 📦 Weights are not included in this repo (~186 MB).  
> To train from scratch, use `ml/notebooks/final-model-acne04.ipynb`.

### 3. Run with Docker

```bash
docker-compose up --build
```

ML service → **`http://localhost:9000`**

---

## 🔌 API Reference

### `POST /analyze`

Analyzes a skin image and returns classification + Gemini clinical reasoning.

**Request** (`multipart/form-data`):

| Field | Type | Description |
|---|---|---|
| `file` | image | Skin photo (JPG/PNG) |
| `patient_info` | string | Age, gender, symptoms, history (optional) |

**Response:**

```json
{
  "status": "success",
  "model": {
    "class_name": "eczema",
    "probability": 0.87
  },
  "gemini_analysis": "The most likely condition is eczema. [5-paragraph clinical report]",
  "gemini_summary": "Eczema with contact dermatitis pattern detected. Dermatology review advised.",
  "gemini_final_response": {
    "class": "contact dermatitis",
    "probability": 0.91
  },
  "gemini_final_response_form": {
    "class": "eczema",
    "probability": 0.91
  }
}
```

**`gemini_analysis` structure (5 paragraphs):**
1. **Diagnosis** — broad umbrella label + specific subtype
2. **Model Evaluation** — agrees/disagrees with SwinV2 prediction and explains why
3. **Clinical Reasoning** — visual findings linked to symptoms, differential diagnosis
4. **Treatment Approach** — conservative patient-facing recommendations
5. **Doctor Recommendation** — specific medical & herbal options for the physician

### `GET /health`

Returns service health status.

---

## 🐳 Running Without Docker

```bash
cd services/ml-service
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🧪 Testing

```bash
# Classification + Gemini end-to-end test
python services/ml-service/test_et.py

# Gemini-only connection test
python services/ml-service/test_gemini_class.py
```

Sample image: `services/ml-service/ornek_resim.jpg`

---

## 📓 Notebooks

| Notebook | Description |
|---|---|
| `ml/notebooks/final-model-acne04.ipynb` | ✅ Final 5-class SwinV2 training (full pipeline) |
| `ml/notebooks/dermnet_f1_oriented_model_analysis.ipynb` | F1-oriented model analysis & ablation |
| `ml/notebooks/kaggle-swin-transformer-v1.ipynb` | SwinV1 baseline experiments |
| `ml/notebooks/kaggle-swin-transformer-v2.ipynb` | SwinV2 experiments |
| `ml/notebooks/swin-transfomer-v3.ipynb` | SwinV2 + preprocessing experiments |
| `llm/llm_gemini_reasoning.ipynb` | Gemini reasoning integration |
| `llm/llm_reasoning_with_swin_model.ipynb` | Full pipeline (vision + LLM) experiments |
| `rag_dataset/gemini_dataset_create.py` | Dermatology RAG dataset generation (1,800 Q&A) |

---

## ⚙️ Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key — [get one here](https://aistudio.google.com/app/apikey) |

Copy `.env.example` → `.env` inside `services/ml-service/`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| ML Model | SwinV2 Small (`timm`) + PyTorch · 3-stage fine-tuning |
| Image Preprocessing | Color Constancy · CLAHE (LAB-L) · Unsharp Mask (HSV-V) · OpenCV · PIL |
| LLM Reasoning | Google Gemini 2.5 Flash · structured JSON output · 5-paragraph prompt |
| API | FastAPI + Uvicorn |
| Containerization | Docker · Docker Compose |
| Dataset | DermNet — 5-class, 6,466 training images |

---

## 👥 Team

Built by Group 14 — METU Computer Engineering, 2025–2026.

---

## 📄 License

This project was developed for academic purposes at METU.
