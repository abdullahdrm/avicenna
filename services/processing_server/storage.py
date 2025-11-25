from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Optional

from .models import AnalysisResult


class ProcessingStore:
    def __init__(self, db_path: str, image_root: str) -> None:
        self.db_path = db_path
        self.image_root = Path(image_root)
        self.image_root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analyses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id TEXT NOT NULL,
                    image_id TEXT NOT NULL,
                    image_path TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    processed_at REAL NOT NULL
                )
                """
            )
            conn.commit()

    def _get_conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path, check_same_thread=False)

    def build_image_path(self, case_id: str, image_id: str, ext: str = ".jpg") -> Path:
        case_dir = self.image_root / case_id
        case_dir.mkdir(parents=True, exist_ok=True)
        return case_dir / f"{image_id}{ext}"

    def save_analysis(
        self, case_id: str, image_id: str, image_path: Path, result: AnalysisResult
    ) -> None:
        data = result.model_dump()
        payload = json.dumps(data)
        with self._lock, self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO analyses (case_id, image_id, image_path, result_json, processed_at)
                VALUES (?, ?, ?, ?, strftime('%s','now'))
                """,
                (case_id, image_id, str(image_path), payload),
            )
            conn.commit()

    def get_latest_analysis_for_case(self, case_id: str) -> Optional[AnalysisResult]:
        with self._lock, self._get_conn() as conn:
            row = conn.execute(
                """
                SELECT result_json
                FROM analyses
                WHERE case_id = ?
                ORDER BY processed_at DESC
                LIMIT 1
                """,
                (case_id,),
            ).fetchone()
        if not row:
            return None
        result_json = row[0]
        data = json.loads(result_json)
        return AnalysisResult.model_validate(data)
