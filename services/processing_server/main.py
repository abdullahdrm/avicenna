from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

import requests as _requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from job_queue import InMemoryJobQueue
from models import AnalysisRequest, AnalysisResult
from storage import ProcessingStore
from pipeline import run_analysis_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

DB_PATH = os.getenv("PROCESSING_DB_PATH", "processing_store.sqlite3")
IMAGE_ROOT = os.getenv("PROCESSING_IMAGE_ROOT", "processing_images")
NUM_WORKERS = int(os.getenv("PROCESSING_WORKERS", "2"))

store = ProcessingStore(db_path=DB_PATH, image_root=IMAGE_ROOT)
job_queue = InMemoryJobQueue(store=store, num_workers=NUM_WORKERS)

# Ensure uploads directory exists so StaticFiles can mount it
_uploads_dir = os.path.join(IMAGE_ROOT, "uploads")
os.makedirs(_uploads_dir, exist_ok=True)

app = FastAPI(title="Avicenna Processing Server", version="0.1.0")
app.mount("/images", StaticFiles(directory=IMAGE_ROOT), name="images")


@app.on_event("shutdown")
def shutdown_event():
    """Gracefully shutdown the processing server"""
    logger.info("Shutting down processing server...")
    job_queue.shutdown(timeout=10.0)
    logger.info("Processing server shutdown complete")


class EnqueueResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress_step: Optional[str] = None
    attempts: int
    max_attempts: int
    error: Optional[str]
    result: Optional[AnalysisResult]


class FormAnswersRequest(BaseModel):
    answers: Dict[str, Any]
    patient_info: Optional[Dict[str, Any]] = None


class GeminiAssessmentResponse(BaseModel):
    assessment: str


class StatsResponse(BaseModel):
    total_jobs: int
    queued: int
    running: int
    completed: int
    failed: int
    canceled: int


@app.get("/health", tags=["system"])
def health_check() -> Dict[str, Any]:
    return {"status": "ok", "workers": NUM_WORKERS}


@app.post("/jobs", response_model=EnqueueResponse, tags=["jobs"])
def enqueue_job(request: AnalysisRequest):
    job_id = str(uuid.uuid4())
    try:
        job = job_queue.enqueue(job_id=job_id, req=request, max_attempts=1)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return EnqueueResponse(job_id=job.job_id, status=job.status.value)


@app.get("/jobs/{job_id}", response_model=JobStatusResponse, tags=["jobs"])
def get_job_status(job_id: str):
    job = job_queue.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status.value,
        progress_step=job.progress_step,
        attempts=job.attempts,
        max_attempts=job.max_attempts,
        error=job.error,
        result=job.result,
    )


@app.get("/jobs", response_model=List[JobStatusResponse], tags=["jobs"])
def list_recent_jobs(limit: int = 20):
    jobs = job_queue.list_jobs(limit=limit)
    return [
        JobStatusResponse(
            job_id=j.job_id,
            status=j.status.value,
            progress_step=j.progress_step,
            attempts=j.attempts,
            max_attempts=j.max_attempts,
            error=j.error,
            result=j.result,
        )
        for j in jobs
    ]


@app.post("/jobs/{job_id}/cancel", response_model=EnqueueResponse, tags=["jobs"])
def cancel_job(job_id: str):
    ok = job_queue.cancel_job(job_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Job not found or already running/finished")
    job = job_queue.get_job(job_id)
    assert job is not None
    return EnqueueResponse(job_id=job_id, status=job.status.value)


@app.get("/stats", response_model=StatsResponse, tags=["system"])
def get_stats():
    s = job_queue.stats()
    return StatsResponse(**s)


@app.post("/analyze-sync", response_model=AnalysisResult, tags=["debug"])
def analyze_sync(request: AnalysisRequest):
    try:
        result = run_analysis_pipeline(request, store=store)
    except Exception as e:
        logger.exception("sync analyze failed")
        raise HTTPException(status_code=500, detail=str(e))
    return result


@app.post("/analyze-upload", response_model=EnqueueResponse, tags=["jobs"])
async def analyze_upload(
    file: UploadFile = File(...),
    case_id: str = Form(default=""),
    patient_info: str = Form(default=""),
):
    """Accept a raw image file, save it, enqueue a processing job, return job_id."""
    image_id = str(uuid.uuid4())
    cid = case_id or image_id
    ext = ".jpg"

    upload_path = os.path.join(IMAGE_ROOT, "uploads", f"{image_id}{ext}")
    contents = await file.read()
    with open(upload_path, "wb") as f_out:
        f_out.write(contents)

    # Build a localhost URL so the pipeline can download it via HTTP
    self_url = f"http://localhost:{os.getenv('PORT', '8081')}/images/uploads/{image_id}{ext}"

    req = AnalysisRequest(
        image_url=self_url,
        request_id=str(uuid.uuid4()),
        case_id=cid,
        image_id=image_id,
        extra={"patient_info": patient_info} if patient_info else {},
    )
    job_id = str(uuid.uuid4())
    try:
        job = job_queue.enqueue(job_id=job_id, req=req, max_attempts=1)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return EnqueueResponse(job_id=job.job_id, status=job.status.value)


@app.post("/jobs/{job_id}/analyze-answers", response_model=GeminiAssessmentResponse, tags=["analysis"])
def analyze_form_answers(job_id: str, body: FormAnswersRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured on processing server")

    job = job_queue.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status.value != "completed" or job.result is None:
        raise HTTPException(status_code=400, detail=f"Job not completed (status={job.status.value})")

    result = job.result
    metrics = result.metrics
    problem_type = (metrics.extra or {}).get("problem_type", "unknown") if metrics else "unknown"
    severity = metrics.severity_score if metrics else "N/A"
    lesion_count = metrics.lesion_count if metrics else "N/A"

    patient_block = ""
    if body.patient_info:
        patient_block = f"\n**Patient Info:**\n{json.dumps(body.patient_info, indent=2)}"

    prompt = f"""You are a dermatology AI assistant. A skin image analysis was performed with the following results:

**Detected condition:** {problem_type}
**Severity score:** {severity} (0 = none, 1 = severe)
**Lesion count:** {lesion_count}
**Image quality valid:** {result.is_valid}{patient_block}

**Patient questionnaire answers:**
{json.dumps(body.answers, indent=2)}

Based on the analysis and the patient's answers, provide:
1. A concise plain-language summary of the patient's skin condition.
2. Specific self-care recommendations they can start immediately.
3. Whether they should seek an in-person dermatologist appointment (yes/no and why).

Be clear, supportive, and avoid definitive diagnoses — remind the patient that this is AI-assisted screening, not a medical diagnosis."""

    try:
        resp = _requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        assessment = data["candidates"][0]["content"]["parts"][0]["text"]
    except (_requests.RequestException, KeyError, IndexError) as e:
        logger.exception("Gemini call failed for job_id=%s", job_id)
        raise HTTPException(status_code=502, detail=f"Gemini API error: {e}")

    return GeminiAssessmentResponse(assessment=assessment)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
