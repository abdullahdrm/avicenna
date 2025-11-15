# ---- Base image ----
FROM python:3.11-slim

# Sistem bağımlılıkları (OpenCV / skimage için bazıları gerekli)
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

# Proje dosyaları (script dahil)
COPY . /app

# Varsayılan komut
# Burayı kendi dosya adına göre düzenle
CMD ["python", "image_processing_segmentation.py"]
