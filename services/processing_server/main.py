from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .job_queue import InMemoryJobQueue
from .models import AnalysisRequest, AnalysisResult
from .storage import ProcessingStore
from .pipeline import run_analysis_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

DB_PATH = os.getenv("PROCESSING_DB_PATH", "processing_store.sqlite3")
IMAGE_ROOT = os.getenv("PROCESSING_IMAGE_ROOT", "processing_images")
NUM_WORKERS = int(os.getenv("PROCESSING_WORKERS", "2"))

store = ProcessingStore(db_path=DB_PATH, image_root=IMAGE_ROOT)
job_queue = InMemoryJobQueue(store=store, num_workers=NUM_WORKERS)

app = FastAPI(title="Avicenna Processing Server", version="0.1.0")


class EnqueueResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    attempts: int
    max_attempts: int
    error: Optional[str]
    result: Optional[AnalysisResult]


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
