# Avicenna — AI-Powered Dermatology Assistant

> A full-stack AI system that analyzes skin condition images using a fine-tuned **Swin Transformer V2** model and provides clinical reasoning via **Google Gemini 2.5 Flash**.  
> Built as a graduation project at **METU (Middle East Technical University)**.

---

## 🧠 What It Does

A patient uploads a skin photo through the mobile or web app. The system:

1. **Preprocesses** the image (color constancy, CLAHE, unsharp masking)
2. **Classifies** the condition via a custom-trained Swin Transformer V2 (84% test accuracy, 5-class)
3. **Reasons** about the result using Gemini 2.5 Flash with structured clinical prompts
4. **Returns** a structured JSON with diagnosis, confidence, clinical analysis, and treatment suggestions — separately for patients and doctors

---

## 📊 Model Performance

| Metric | Value |
|---|---|
| Architecture | Swin Transformer V2 (`swinv2_small_window8_256`) |
| Classes | acne · eczema · fungal · psoriasis · others |
| Test Accuracy (TTA-5) | **84.0%** |
| Test F1 Weighted | **0.8396** |
| Test F1 Macro | **0.8468** |
| Best Val F1 Weighted | 0.8100 |
| Training Set | 6,466 images |
| Val / Test Set | 806 / 806 images |
| Dataset | DermNet (preprocessed) |

**Preprocessing pipeline:**  
`ShadesOfGray color constancy → CLAHE (LAB space) → Unsharp masking → HSV value augmentation`

---

## 🏗️ Architecture

```
avicenna/
├── services/
│   └── ml-service/          # FastAPI — image classification + Gemini reasoning
│       ├── app/
│       │   ├── main.py          # REST API endpoints
│       │   └── gemini_service.py  # Gemini 2.5 Flash integration
│       ├── services/
│       │   ├── gemini_service.py
│       │   └── patient_health_report_service.py
│       ├── final_5_class/       # Model training artifacts & metrics
│       ├── Dockerfile
│       └── requirements.txt
├── ml/
│   ├── notebooks/           # Training notebooks (Swin Transformer V2)
│   ├── preprocessing/
│   │   └── segmentation/    # Skin segmentation API (separate FastAPI service)
│   └── datasets/            # Sample test images
├── rag_dataset/             # Dermatology Q&A dataset (1800 entries, JSONL)
│   └── gemini_dataset_create.py  # Dataset generation pipeline
├── llm/                     # LLM reasoning experiments & notebooks
├── swim_model/              # Early Swin model experiments
├── docker-compose.yaml      # Single-command deployment
└── apps/                    # Mobile & web frontends
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)
- Model weights file (see below)

### 1. Clone & configure environment

```bash
git clone https://github.com/abdullahdrm/avicenna.git
cd avicenna

cp services/ml-service/.env.example services/ml-service/.env
# Edit .env and add your GEMINI_API_KEY
```

### 2. Add model weights

Download the model weights and place them at:

```
services/ml-service/final_5_class/dermnet_5class_cc_clahe_lab_unsharp_hsvv_v2_improved_best.pth
```

> 📦 Model weights are not included in this repo due to file size (~186 MB).  
> Contact the repository owner or train your own using the notebooks in `ml/notebooks/`.

### 3. Run with Docker

```bash
docker-compose up --build
```

The ML service will be available at: **`http://localhost:9000`**

---

## 🔌 API Reference

### `POST /analyze`

Analyzes a skin image and returns classification + clinical reasoning.

**Request** (`multipart/form-data`):

| Field | Type | Description |
|---|---|---|
| `file` | image | Skin photo (JPG/PNG) |
| `patient_info` | string | Patient symptoms, age, history (optional) |

**Response:**

```json
{
  "status": "success",
  "model": {
    "class_name": "eczema",
    "probability": 0.87
  },
  "gemini_analysis": "The most likely condition is eczema...",
  "gemini_summary": "Eczema with contact dermatitis pattern detected.",
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

### `GET /health`

Returns service health status.

---

## 🐳 Running Without Docker

```bash
cd services/ml-service
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Make sure .env is configured
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🧪 Testing

```bash
# Quick classification test
python services/ml-service/test_et.py

# Gemini integration test
python services/ml-service/test_gemini_class.py
```

Sample test image: `services/ml-service/ornek_resim.jpg`

---

## 📓 Notebooks

| Notebook | Description |
|---|---|
| `ml/notebooks/final-model-acne04.ipynb` | Final 5-class Swin V2 training |
| `ml/notebooks/dermnet_f1_oriented_model_analysis.ipynb` | F1-oriented model analysis |
| `ml/notebooks/kaggle-swin-transformer-v1.ipynb` | Swin V1 baseline |
| `ml/notebooks/kaggle-swin-transformer-v2.ipynb` | Swin V2 experiments |
| `llm/llm_gemini_reasoning.ipynb` | Gemini reasoning integration |
| `llm/llm_reasoning_with_swin_model.ipynb` | Combined pipeline experiments |
| `rag_dataset/gemini_dataset_create.py` | Dermatology RAG dataset generation |

---

## ⚙️ Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey)) |

Copy `.env.example` to `.env` in `services/ml-service/` and fill in the values.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| ML Model | Swin Transformer V2 (`timm`) + PyTorch |
| Image Preprocessing | OpenCV, PIL, NumPy |
| LLM Reasoning | Google Gemini 2.5 Flash |
| API | FastAPI + Uvicorn |
| Containerization | Docker, Docker Compose |
| Dataset | DermNet (6,466 training images) |

---

## 👥 Team

Built by Group 14 — METU Computer Engineering, 2025–2026.

---

## 📄 License

This project was developed for academic purposes.
