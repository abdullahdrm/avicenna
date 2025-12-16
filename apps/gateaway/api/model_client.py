from __future__ import annotations

import os
import requests
from django.conf import settings


class ModelServerError(RuntimeError):
    pass


def call_model_server(image_path: str) -> dict:
    """
    Sends the uploaded image file to the ML model server via HTTP.
    Expects the server to return JSON.

    Expected response (example):
      {
        "diagnosis": "eczema",
        "confidence": 0.87,
        "raw_output": {...}   # optional
      }
    """
    url = getattr(settings, "MODEL_SERVER_URL", None) or os.getenv("MODEL_SERVER_URL")
    if not url:
        raise ModelServerError("MODEL_SERVER_URL is not configured")

    timeout = getattr(settings, "MODEL_SERVER_TIMEOUT_SEC", 10.0)

    try:
        with open(image_path, "rb") as f:
            files = {"image": ("image.jpg", f, "image/jpeg")}
            resp = requests.post(url, files=files, timeout=timeout)

        if resp.status_code != 200:
            raise ModelServerError(f"Model server error: HTTP {resp.status_code} - {resp.text[:200]}")

        data = resp.json()
        if not isinstance(data, dict):
            raise ModelServerError("Model server returned non-object JSON")

        # normalize keys safely
        diagnosis = str(data.get("diagnosis", data.get("label", "")))
        confidence = data.get("confidence", data.get("score", None))
        raw_output = data.get("raw_output", data)

        out = {
            "diagnosis": diagnosis,
            "confidence": float(confidence) if confidence is not None else None,
            "raw_output": raw_output,
        }
        return out

    except requests.Timeout as e:
        raise ModelServerError("Model server timeout") from e
    except requests.RequestException as e:
        raise ModelServerError(f"Model server request failed: {e}") from e
    except ValueError as e:
        # json decode error
        raise ModelServerError("Model server returned invalid JSON") from e
