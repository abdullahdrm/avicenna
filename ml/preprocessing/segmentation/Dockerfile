# ---- Base image ----
FROM python:3.11-slim
# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*
# Çalışma klasörü

WORKDIR /app
# Python bağımlılıkları
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

# Uvicorn FastAPI servisi
EXPOSE 80

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "80"]
