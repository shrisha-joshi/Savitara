import requests
import sys
import json
import time
import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend'))
sys.path.append(backend_path)
load_dotenv(os.path.join(backend_path, '.env'))

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DATABASE_NAME", "savitara")

BASE_URL = "http://localhost:8000"
API_V1 = f"{BASE_URL}/api/v1"

# Constants
LOGIN_STEP_NAME = "Login as user@savitara.com"
BOOKING_STEP_NAME = "Create Generic Booking (Request Mode)"
SERVICES_ENDPOINT_NAME = "GET /api/v1/services"
AUTH_CHECK_NAME = "GET /api/v1/gamification/coins/balance (Auth Check)"

def print_result(step, success, message=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {step}")
    if message:
        print(f"   Note: {message}")
    if not success:
        print("   Re-run with verbose output if needed.")

def check_endpoint(url, expected_codes=[200], method="GET", headers=None, data=None):
    try:
        response = None
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        
        if response.status_code in expected_codes:
            return True, response
        else:
            return False, response
    except Exception as e:
        return False, str(e)

def check_services_endpoint():
    """Check if services endpoint is accessible."""
    success, resp = check_endpoint(f"{API_V1}/services", expected_codes=[200])
    if success:
        print_result(SERVICES_ENDPOINT_NAME, True, f"Status: {resp.status_code}")
    else:
        msg = resp if isinstance(resp, str) else f"Status: {resp.status_code}"
        print_result(SERVICES_ENDPOINT_NAME, False, msg)

def check_auth_endpoint():
    """Check if authentication is working by testing protected endpoint."""
    success, resp = check_endpoint(f"{API_V1}/gamification/coins/balance", expected_codes=[401])
    if success:
         print_result(AUTH_CHECK_NAME, True, f"Status: {resp.status_code}")
    else:
         msg = resp if isinstance(resp, str) else f"Status: {resp.status_code}"
         print_result(AUTH_CHECK_NAME, False, msg)

def perform_login():
    """Perform login and return access token."""
    login_data = {
        "email": "user@savitara.com",
        "password": "Password@123" 
    }
    
    success, resp = check_endpoint(f"{API_V1}/auth/login", method="POST", data=login_data, expected_codes=[200])
    
    if not success:
        print_result(LOGIN_STEP_NAME, False, "Could not login. Skipping booking creation.")
        return None
    
    data = resp.json()
    token = data.get("data", {}).get("access_token")
    if not token:
        token = data.get("access_token")
    
    if token:
        print_result(LOGIN_STEP_NAME, True)
    else:
        print_result(LOGIN_STEP_NAME, False, "Token not found in response")
    
    return token

def find_acharya_from_db():
    """Try to find an acharya ID from database."""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        acharya_user = db.users.find_one({"role": "acharya"})
        if acharya_user:
            acharya_profile = db.acharya_profiles.find_one({"user_id": str(acharya_user["_id"])})
            if acharya_profile:
                acharya_id = str(acharya_profile["_id"])
                print(f"   Found Acharya ID from DB: {acharya_id}")
                client.close()
                return acharya_id
            else:
                print("   Found Acharya User but no Profile in DB")
        else:
            print("   No Acharya found in DB")
        client.close()
    except Exception as e:
        print(f"   DB Connection failed: {e}")
    return None

def find_acharya_from_api(headers):
    """Try to find an acharya ID from API."""
    success, resp = check_endpoint(f"{API_V1}/users/search", headers=headers, expected_codes=[200])
    if not success:
        return None
    
    data = resp.json()
    acharyas = data.get("data", []) if isinstance(data.get("data"), list) else []
    if not acharyas and isinstance(data, list):
        acharyas = data
    
    if acharyas:
        first = acharyas[0]
        acharya_id = first.get("id") or first.get("_id") or first.get("user_id")
        if acharya_id:
            print(f"   Found Acharya ID via API: {acharya_id}")
            return acharya_id
    return None

def create_test_booking(token, acharya_id):
    """Create a test booking and report results."""
    headers = {"Authorization": f"Bearer {token}"}
    booking_payload = {
        "acharya_id": acharya_id,
        "service_name": "Test Pooja Service",
        "booking_type": "only",
        "booking_mode": "request",
        "date": "2026-12-31",
        "time": "10:00",
        "requirements": "System Health Check Test from Verify Script"
    }

    success, resp = check_endpoint(f"{API_V1}/bookings", method="POST", headers=headers, data=booking_payload, expected_codes=[201])
    
    if success:
        try:
            res_json = resp.json()
            data = res_json.get("data", {})
            booking_id = data.get("booking_id") or data.get("id") or res_json.get("id")
            print_result(BOOKING_STEP_NAME, True, f"Booking ID: {booking_id}")
        except Exception as e:
            print_result(BOOKING_STEP_NAME, True, f"Created, but couldn't parse ID: {e}")
    else:
        msg = f"Status: {resp.status_code if hasattr(resp, 'status_code') else resp}"
        if hasattr(resp, 'text'):
            msg += f", Response: {resp.text}"
        print_result(BOOKING_STEP_NAME, False, msg)

def main():
    """Run system health checks."""
    print("Starting System Health Check...\n")
    
    # Check basic endpoints
    check_services_endpoint()
    check_auth_endpoint()
    
    # Perform login
    token = perform_login()
    if not token:
        print("   Skipping Booking Creation - No Token")
        return
    
    # Find acharya
    print("   Attempting to create booking...")
    headers = {"Authorization": f"Bearer {token}"}
    
    acharya_id = find_acharya_from_db()
    if not acharya_id:
        acharya_id = find_acharya_from_api(headers)
    
    if not acharya_id:
        print("   Could not find an Acharya ID. Cannot create valid booking.")
        return
    
    # Create test booking
    create_test_booking(token, acharya_id)

if __name__ == "__main__":
    main()
