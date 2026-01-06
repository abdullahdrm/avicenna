import uuid
import requests


server_url = "http://localhost:8081"

def process_sync(image_url, case_id, image_id: str):
    payload = {
        "request_id": str(uuid.uuid4()),
        "image_url": image_url,
        "case_id": case_id,
        "image_id": image_id
    }

    try:
        response = requests.post(
            f"{server_url}/analyze-sync", 
            json=payload,
            timeout=120
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"Sync processing failed: {response.status_code} {response.text}")
            return None

    except Exception as e:
        print(f"Sync processing error: {e}")
        return None