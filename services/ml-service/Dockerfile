FROM python:3.11-slim

WORKDIR /app


RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt


COPY app /app/app
COPY final_5_class/dermnet_5class_cc_clahe_lab_unsharp_hsvv_v2_improved_best.pth /app/final_5_class/dermnet_5class_cc_clahe_lab_unsharp_hsvv_v2_improved_best.pth
COPY final_5_class/summary_dermnet_5class_cc_clahe_lab_unsharp_hsvv_v2_improved.json /app/final_5_class/summary_dermnet_5class_cc_clahe_lab_unsharp_hsvv_v2_improved.json

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
