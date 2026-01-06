import asyncio
import json
import time
from pathlib import Path
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime
import os
import uuid

# Local testing: "http://localhost:8001"
# Remote testing: "https://postdevelopmental-rosenda-transcendingly.ngrok-free.dev"
PROCESSING_SERVER_URL = "https://postdevelopmental-rosenda-transcendingly.ngrok-free.dev"
RESULTS_DIR = "processing_results"

class Gender:
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class SkinType:
    NORMAL = "normal"
    DRY = "dry"
    OILY = "oily"
    COMBINATION = "combination"
    SENSITIVE = "sensitive"

class ProblemType:
    ACNE = "acne"
    HYPERPIGMENTATION = "hyperpigmentation"
    WRINKLE = "wrinkle"
    REDNESS = "redness"
    OTHER = "other"

class RequestPriority:
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class ProcessingClient:
    
    def __init__(self, server_url: str = PROCESSING_SERVER_URL):
        self.server_url = server_url
        
    def save_result(self, result: Dict[str, Any], case_id: str) -> str:
        os.makedirs(RESULTS_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{case_id}_{timestamp}.json"
        filepath = os.path.join(RESULTS_DIR, filename)
        
        with open(filepath, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"[SAVED] results saved to {filepath}")
        return filepath
    
    def analyze_sync(
        self,
        image_url: str,
        case_id: str,
        image_id: str,
        user_id: Optional[str] = None,
        user_age: Optional[int] = None,
        gender: Optional[str] = None,
        skin_type: Optional[str] = None,
        problem_type: Optional[str] = None,
        is_follow_up: bool = False,
        priority: str = RequestPriority.NORMAL,
        extra: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Synchronous analysis - blocks until complete"""
        request_id = str(uuid.uuid4())
        
        payload = {
            "request_id": request_id,
            "case_id": case_id,
            "image_id": image_id,
            "image_url": image_url,
            "user_id": user_id,
            "user_age": user_age,
            "gender": gender,
            "skin_type": skin_type,
            "problem_type": problem_type,
            "is_follow_up": is_follow_up,
            "priority": priority,
            "created_at": datetime.utcnow().isoformat(),
            "extra": extra or {}
        }
        
        payload = {k: v for k, v in payload.items() if v is not None}
        
        try:
            response = requests.post(
                f"{self.server_url}/analyze-sync",
                json=payload,
                timeout=120  # Longer timeout for sync processing
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"[OK] sync analysis completed for case={case_id}")
                return result
            else:
                print(f"[ERROR] sync analysis failed: {response.status_code} {response.text}")
                return None
                
        except Exception as e:
            print(f"[ERROR] sync analysis error: {e}")
            return None
        
    def enqueue_analysis(self, image_url: str, case_id: str, image_id: str) -> Optional[str]:
        payload = {
            "request_id": str(uuid.uuid4()),
            "image_url": image_url,
            "case_id": case_id,
            "image_id": image_id
        }
        
        try:
            response = requests.post(
                f"{self.server_url}/jobs",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                job_id = result.get("job_id")
                print(f"[OK] enqueued job_id={job_id} for case={case_id}")
                return job_id
            else:
                print(f"[ERROR] enqueue failed: {response.status_code} {response.text}")
                return None
                
        except Exception as e:
            print(f"[ERROR] enqueue error: {e}")
            return None
    
    def enqueue_comprehensive_analysis(
        self, 
        image_url: str, 
        case_id: str, 
        image_id: str,
        user_id: Optional[str] = None,
        user_age: Optional[int] = None,
        gender: Optional[str] = None,
        skin_type: Optional[str] = None,
        problem_type: Optional[str] = None,
        is_follow_up: bool = False,
        priority: str = RequestPriority.NORMAL,
        extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        request_id = str(uuid.uuid4())
        
        payload = {
            "request_id": request_id,
            "case_id": case_id,
            "image_id": image_id,
            "image_url": image_url,
            "user_id": user_id,
            "user_age": user_age,
            "gender": gender,
            "skin_type": skin_type,
            "problem_type": problem_type,
            "is_follow_up": is_follow_up,
            "priority": priority,
            "created_at": datetime.utcnow().isoformat(),
            "extra": extra or {}
        }
        
        payload = {k: v for k, v in payload.items() if v is not None}
        
        try:
            response = requests.post(
                f"{self.server_url}/jobs",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                job_id = result.get("job_id")
                print(f"[OK] comprehensive analysis enqueued job_id={job_id} for case={case_id}")
                print(f"     request_id={request_id}, user_id={user_id}, problem_type={problem_type}")
                return job_id
            else:
                print(f"[ERROR] comprehensive enqueue failed: {response.status_code} {response.text}")
                return None
                
        except Exception as e:
            print(f"[ERROR] comprehensive enqueue error: {e}")
            return None
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        try:
            response = requests.get(f"{self.server_url}/jobs/{job_id}")
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                print(f"job_id={job_id} not found")
                return None
            else:
                print(f"status check failed: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"status check error: {e}")
            return None
    
    def get_result(self, job_id: str) -> Optional[Dict[str, Any]]:
        try:
            response = requests.get(f"{self.server_url}/jobs/{job_id}")
            
            if response.status_code == 200:
                job_data = response.json()
                return job_data.get("result")
            else:
                print(f"result fetch failed: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"result fetch error: {e}")
            return None
    
    def process_sync(self, image_url: str, case_id: str, image_id: str) -> Optional[Dict[str, Any]]:
        payload = {
            "request_id": str(uuid.uuid4()),
            "image_url": image_url,
            "case_id": case_id,
            "image_id": image_id
        }
        
        try:
            response = requests.post(
                f"{self.server_url}/analyze-sync",
                json=payload,
                timeout=120
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"sync processing failed: {response.status_code} {response.text}")
                return None
                
        except Exception as e:
            print(f"sync processing error: {e}")
            return None
    
    async def wait_for_completion(self, job_id: str, timeout: int = 300) -> Optional[Dict[str, Any]]:
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = self.get_job_status(job_id)
            
            if not status:
                return None
                
            job_status = status.get("status")
            print(f"job_id={job_id} status={job_status}")
            
            if job_status == "completed":
                result = self.get_result(job_id)
                return result
            elif job_status == "failed":
                print(f"job failed: {status.get('error', 'unknown error')}")
                return None
            elif job_status == "canceled":
                print("job was canceled")
                return None
            
            await asyncio.sleep(2)
        
        print(f"timeout waiting for job_id={job_id}")
        return None


async def test_async_flow():
    client = ProcessingClient()
    
    test_cases = [
        {
            "image_url": "http://localhost:8888/left_cheek.jpeg",
            "case_id": "left_cheek_test",
            "image_id": "left_cheek_001",
            "user_id": "user_test_001",
            "user_age": 28,
            "gender": Gender.FEMALE,
            "skin_type": SkinType.COMBINATION,
            "is_follow_up": False,
            "priority": RequestPriority.NORMAL,
            "extra": {"test_description": "Testing two-stage ML pipeline with left_cheek.jpeg"}
        }
    ]
    
    print("Testing async processing flow")
    
    job_ids = []
    for test_case in test_cases:
        # Use comprehensive enqueue if test case has extra fields
        if any(k in test_case for k in ["user_id", "user_age", "gender", "skin_type"]):
            job_id = client.enqueue_comprehensive_analysis(**test_case)
        else:
            job_id = client.enqueue_analysis(
                test_case["image_url"],
                test_case["case_id"], 
                test_case["image_id"]
            )
        if job_id:
            job_ids.append((job_id, test_case))
    
    results = []
    for job_id, test_case in job_ids:
        print(f"\nwaiting for job_id={job_id}...")
        result = await client.wait_for_completion(job_id)
        
        if result:
            print(f"[OK] completed case={test_case['case_id']}")
            print(f"  processing_time: {result.get('processing_time_ms')}ms")
            print(f"  metrics: {result.get('metrics', {})}")
            
            filepath = client.save_result(result, test_case['case_id'])
            result['saved_to'] = filepath
            results.append(result)
        else:
            print(f"[ERROR] failed case={test_case['case_id']}")
    
    return results


def test_sync_flow():
    """Test synchronous analysis with analyze_sync"""
    client = ProcessingClient()
    
    print("Testing synchronous analysis flow")
    
    result = client.analyze_sync(
        image_url="http://localhost:8888/left_cheek.jpeg",
        case_id="sync_test_left_cheek",
        image_id="sync_img_001",
        user_id="test_user_001",
        user_age=28,
        gender=Gender.FEMALE,
        skin_type=SkinType.COMBINATION,
        is_follow_up=False
    )
    
    if result:
        print("[OK] sync analysis completed")
        print(f"  is_valid: {result.get('is_valid')}")
        print(f"  metrics: {result.get('metrics', {})}")
        
        filepath = client.save_result(result, "sync_test_left_cheek")
        result['saved_to'] = filepath
        return result
    else:
        print("[ERROR] sync analysis failed")
        return None


def test_sync_flow_old():
    """Old test using process_sync (picsum placeholder)"""
    client = ProcessingClient()
    
    print("Testing sync processing flow (old)")
    
    result = client.process_sync(
        "https://picsum.photos/320/240",
        "sync_test_001",
        "sync_img_001"
    )
    
    if result:
        print("[OK] sync processing completed")
        print(f"processing_time: {result.get('processing_time_ms')}ms")
        print(f"metrics: {result.get('metrics', {})}")
        
        filepath = client.save_result(result, "sync_test_001")
        result['saved_to'] = filepath
        return result
    else:
        print("[ERROR] sync processing failed")
        return None


def test_server_health():
    try:
        response = requests.get(f"{PROCESSING_SERVER_URL}/", timeout=5)
        if response.status_code == 404:
            print("[OK] processing server is running")
            return True
        else:
            print(f"unexpected response: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] processing server not reachable: {e}")
        return False


def test_full_integration():
    client = ProcessingClient()
    
    print("Testing full integration with result saving")
    
    test_image = "https://picsum.photos/256/256"
    case_id = "integration_test_001"
    image_id = "img_integration_001"
    
    print(f"Sending image for analysis: {test_image}")
    job_id = client.enqueue_analysis(test_image, case_id, image_id)
    
    if job_id:
        print(f"Job enqueued with ID: {job_id}")
        print("Waiting for completion...")
        
        start_time = time.time()
        while time.time() - start_time < 60:
            status = client.get_job_status(job_id)
            if status:
                job_status = status.get("status")
                print(f"Status: {job_status}")
                
                if job_status == "completed":
                    result = client.get_result(job_id)
                    if result:
                        filepath = client.save_result(result, case_id)
                        print(f"[SUCCESS] Analysis completed and saved to {filepath}")
                        return result
                    break
                elif job_status == "failed":
                    print(f"[ERROR] Job failed: {status.get('error', 'unknown error')}")
                    break
            
            time.sleep(2)
        
        print("[TIMEOUT] Job did not complete in time")
    else:
        print("[ERROR] Failed to enqueue job")
    
    return None


def show_field_examples():
    print("Processing Server Field Examples:")
    print("=" * 40)
    
    print("\nRequired Fields:")
    print("  image_url: URL to the image to analyze")
    print("  case_id: unique identifier for the case")
    print("  image_id: unique identifier for the image")
    
    print("\nOptional User Fields:")
    print("  user_id: unique user identifier")
    print("  user_age: age (0-120)")
    print(f"  gender: {Gender.MALE} | {Gender.FEMALE} | {Gender.OTHER}")
    print(f"  skin_type: {SkinType.NORMAL} | {SkinType.DRY} | {SkinType.OILY} | {SkinType.COMBINATION} | {SkinType.SENSITIVE}")
    
    print("\nAnalysis Configuration:")
    print(f"  problem_type: {ProblemType.ACNE} | {ProblemType.HYPERPIGMENTATION} | {ProblemType.WRINKLE} | {ProblemType.REDNESS} | {ProblemType.OTHER}")
    print("  is_follow_up: true | false")
    print(f"  priority: {RequestPriority.LOW} | {RequestPriority.NORMAL} | {RequestPriority.HIGH} | {RequestPriority.URGENT}")
    
    print("\nResult Fields:")
    print("  validation: {is_valid: bool, reasons: [str], details: {}}")
    print("  metrics: {lesion_count: int, severity_score: float, per_region: {}, extra: {}}")
    print("  comparison: {type: str, improvement_score: float, notes: str}")
    print("  processing_time_ms: milliseconds taken for processing")
    
    print("\nExample Payload:")
    example = {
        "request_id": "req_12345",
        "case_id": "case_001",
        "image_id": "img_001",
        "image_url": "https://example.com/image.jpg",
        "user_id": "user_123",
        "user_age": 28,
        "gender": Gender.FEMALE,
        "skin_type": SkinType.COMBINATION,
        "problem_type": ProblemType.HYPERPIGMENTATION,
        "is_follow_up": False,
        "priority": RequestPriority.HIGH,
        "extra": {
            "clinic_id": "clinic_001",
            "doctor_notes": "Patient reports improvement"
        }
    }
    print(json.dumps(example, indent=2))


if __name__ == "__main__":
    if not test_server_health():
        exit(1)
    
    print("choose test mode:")
    print("1. async flow (recommended for production)")
    print("2. sync flow (simple but blocking)")
    print("3. both")
    print("4. full integration test")
    print("5. show field examples")
    
    choice = input("enter choice (1-5): ").strip()
    
    if choice == "1":
        asyncio.run(test_async_flow())
    elif choice == "2":
        test_sync_flow()
    elif choice == "3":
        test_sync_flow()
        print("\n" + "="*50 + "\n")
        asyncio.run(test_async_flow())
    elif choice == "4":
        test_full_integration()
    elif choice == "5":
        show_field_examples()
    else:
        print("invalid choice")