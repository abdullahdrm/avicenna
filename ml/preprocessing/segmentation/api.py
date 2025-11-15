# ml/preprocessing/segmentation/api.py

import io
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from image_processing_segmentation import (
    process_image,
    overlay_mask,
    ensure_dirs,
)

app = FastAPI(
    title="Avicenna Preprocessing Segmentation API",
    version="1.0.0",
    description="Lesion segmentation pipeline served over HTTP (KMeans + SLIC + GrabCut).",
)


@app.on_event("startup")
def startup_event():
    # Eğer ileride diske yazmak istersen klasörler hazır olsun
    ensure_dirs()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/segment/overlay")
async def segment_overlay(file: UploadFile = File(...)):
    """
    Tek bir resim alır (png/jpg/jpeg), pipeline'ı çalıştırır,
    overlay edilmiş sonucu PNG olarak döner.
    """
    # Dosyayı belleğe oku
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    # Bytes -> numpy array -> BGR image
    np_bytes = np.frombuffer(contents, np.uint8)
    bgr0 = cv2.imdecode(np_bytes, cv2.IMREAD_COLOR)
    if bgr0 is None:
        raise HTTPException(status_code=400, detail="Invalid image format")

    # Pipeline
    bgr_proc, mask, score = process_image(bgr0)
    overlay = overlay_mask(bgr_proc, mask, color=(0, 255, 0), alpha=0.35)

    # Overlay'i PNG'ye çevir
    # (overlay zaten RGB, cv2.imencode BGR bekliyor, o yüzden çevirelim)
    overlay_bgr = cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
    ok, png_bytes = cv2.imencode(".png", overlay_bgr)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode overlay image")

    return StreamingResponse(
        io.BytesIO(png_bytes.tobytes()),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="overlay.png"'},
    )


@app.post("/segment/mask")
async def segment_mask(file: UploadFile = File(...)):
    """
    Tek bir resim alır, sadece binary mask'i PNG olarak döner.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    np_bytes = np.frombuffer(contents, np.uint8)
    bgr0 = cv2.imdecode(np_bytes, cv2.IMREAD_COLOR)
    if bgr0 is None:
        raise HTTPException(status_code=400, detail="Invalid image format")

    bgr_proc, mask, score = process_image(bgr0)

    ok, png_bytes = cv2.imencode(".png", mask)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode mask image")

    return StreamingResponse(
        io.BytesIO(png_bytes.tobytes()),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="mask.png"'},
    )


@app.post("/segment/info")
async def segment_info(file: UploadFile = File(...)):
    """
    Hafif bir JSON endpoint: sadece mask'teki foreground oranını vs. dönebilir.
    (Modelin mantığını test etmek için faydalı.)
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    np_bytes = np.frombuffer(contents, np.uint8)
    bgr0 = cv2.imdecode(np_bytes, cv2.IMREAD_COLOR)
    if bgr0 is None:
        raise HTTPException(status_code=400, detail="Invalid image format")

    bgr_proc, mask, score = process_image(bgr0)

    fg_pixels = int((mask > 0).sum())
    total_pixels = int(mask.size)
    fg_ratio = float(fg_pixels) / float(total_pixels) if total_pixels > 0 else 0.0

    return JSONResponse(
        {
            "foreground_pixels": fg_pixels,
            "total_pixels": total_pixels,
            "foreground_ratio": fg_ratio,
        }
    )
