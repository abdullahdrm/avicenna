import requests
from django.conf import settings

def call_external_ai_server(image_path):
    """Calls the external ML server as defined in gateaway."""
    url = "http://127.0.0.1:8001/predict" # Or settings.MODEL_SERVER_URL
    try:
        with open(image_path, "rb") as f:
            files = {"image": ("image.jpg", f, "image/jpeg")}
            resp = requests.post(url, files=files, timeout=10.0)
        
        if resp.status_code == 200:
            data = resp.json()
            return {
                "prediction": data.get("diagnosis", "unknown"),
                "confidence": data.get("confidence", 0.0)
            }
    except Exception as e:
        print(f"AI Server Error: {e}")
    return None