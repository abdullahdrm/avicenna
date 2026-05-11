from __future__ import annotations

import logging
import queue
import threading
import time
import traceback
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional

from models import AnalysisRequest, AnalysisResult
from pipeline import run_analysis_pipeline
from storage import ProcessingStore

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


@dataclass
class Job:
    job_id: str
    request: AnalysisRequest
    status: JobStatus = JobStatus.QUEUED
    progress_step: Optional[str] = None
    result: Optional[AnalysisResult] = None
    error: Optional[str] = None
    error_trace: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    attempts: int = 0
    max_attempts: int = 1

    def to_dict(self) -> Dict:
        return {
            "job_id": self.job_id,
            "request_id": self.request.request_id,
            "case_id": self.request.case_id,
            "image_id": self.request.image_id,
            "status": self.status.value,
            "progress_step": self.progress_step,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "error": self.error,
            "result": self.result.model_dump() if self.result else None,
        }


class InMemoryJobQueue:
    def __init__(self, store: ProcessingStore, num_workers: int = 2) -> None:
        self.store = store
        self._queue: "queue.Queue[Optional[str]]" = queue.Queue()
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()
        self._workers: List[threading.Thread] = []
        self._stop = threading.Event()
        num_workers = max(1, num_workers)

        for i in range(num_workers):
            t = threading.Thread(
                target=self._worker_loop, name=f"processing-worker-{i+1}", daemon=True
            )
            t.start()
            self._workers.append(t)

        logger.info("job queue started workers=%d", num_workers)

    def enqueue(self, job_id: str, req: AnalysisRequest, max_attempts: int = 1) -> Job:
        with self._lock:
            if job_id in self._jobs:
                raise ValueError(f"job {job_id} exists")
            job = Job(job_id=job_id, request=req, max_attempts=max_attempts)
            self._jobs[job_id] = job
        self._queue.put(job_id)
        logger.info("enqueue job_id=%s request_id=%s", job_id, req.request_id)
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self, limit: int = 50) -> List[Job]:
        with self._lock:
            jobs = list(self._jobs.values())
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return jobs[:limit]

    def cancel_job(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return False
            if job.status != JobStatus.QUEUED:
                return False
            job.status = JobStatus.CANCELED
            job.updated_at = time.time()
        logger.info("cancel job_id=%s", job_id)
        return True

    def stats(self) -> Dict[str, int]:
        with self._lock:
            total = len(self._jobs)
            by_status: Dict[str, int] = {s.value: 0 for s in JobStatus}
            for job in self._jobs.values():
                by_status[job.status.value] += 1
        return {
            "total_jobs": total,
            "queued": by_status[JobStatus.QUEUED.value],
            "running": by_status[JobStatus.RUNNING.value],
            "completed": by_status[JobStatus.COMPLETED.value],
            "failed": by_status[JobStatus.FAILED.value],
            "canceled": by_status[JobStatus.CANCELED.value],
        }

    def shutdown(self, timeout: float = 5.0) -> None:
        logger.info("shutdown job queue")
        self._stop.set()
        for _ in self._workers:
            self._queue.put(None)
        for t in self._workers:
            t.join(timeout=timeout)

    def _make_progress_callback(self, job_id: str) -> Callable[[str], None]:
        def _cb(step: str) -> None:
            with self._lock:
                job = self._jobs.get(job_id)
                if job is not None:
                    job.progress_step = step
                    job.updated_at = time.time()
        return _cb

    def _worker_loop(self) -> None:
        logger.info("%s started", threading.current_thread().name)
        while not self._stop.is_set():
            try:
                job_id = self._queue.get(timeout=1.0)
            except queue.Empty:
                continue

            if job_id is None:
                self._queue.task_done()
                break

            job = self.get_job(job_id)
            if job is None:
                logger.warning("job_id=%s not found", job_id)
                self._queue.task_done()
                continue

            with self._lock:
                if job.status == JobStatus.CANCELED:
                    logger.info("job_id=%s canceled, skipping", job_id)
                    self._queue.task_done()
                    continue
                job.status = JobStatus.RUNNING
                job.updated_at = time.time()
                job.attempts += 1

            logger.info("worker %s processing job_id=%s", threading.current_thread().name, job_id)

            try:
                result = run_analysis_pipeline(
                    job.request,
                    store=self.store,
                    progress_callback=self._make_progress_callback(job_id),
                )
                with self._lock:
                    job.status = JobStatus.COMPLETED
                    job.result = result
                    job.error = None
                    job.error_trace = None
                    job.updated_at = time.time()
                logger.info("worker %s job_id=%s completed", threading.current_thread().name, job_id)
            except Exception as exc:
                logger.exception("job failed job_id=%s attempt=%d", job_id, job.attempts)
                tb = traceback.format_exc()
                with self._lock:
                    job.error = str(exc)
                    job.error_trace = tb
                    job.updated_at = time.time()
                    if job.attempts >= job.max_attempts:
                        job.status = JobStatus.FAILED
                        logger.error("job_id=%s failed permanently after %d attempts", job_id, job.attempts)
                    else:
                        job.status = JobStatus.QUEUED
                        self._queue.put(job_id)
                        logger.info("job_id=%s requeued for retry", job_id)
            finally:
                self._queue.task_done()
        
        logger.info("%s stopped", threading.current_thread().name)
