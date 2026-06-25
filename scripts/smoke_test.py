import requests
import sys
import time

# Configuration: Update BASE_URL to your production backend URL once deployed.
BASE_URL = "https://api.eduskill.co.in/api" # Use http://localhost:5000/api for local testing
ADMIN_EMAIL = "admin@eduskill.co.in"
ADMIN_PASSWORD = "admin123"

def print_header(title):
    print(f"\n{'-'*50}\n{title}\n{'-'*50}")

def test_admin_login():
    """Tests the admin login endpoint and retrieves a JWT token."""
    print("Testing Admin Login...")
    url = f"{BASE_URL}/auth/admin/login"
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200 and response.json().get("success"):
            print("✅ Admin Login Successful!")
            return response.json().get("token")
        else:
            print(f"❌ Admin Login Failed! Status: {response.status_code}, Response: {response.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        sys.exit(1)

def test_endpoint(name, endpoint, token):
    """Hits a protected endpoint and verifies it returns a 200 OK."""
    print(f"Testing {name}...")
    url = f"{BASE_URL}/{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        start_time = time.time()
        response = requests.get(url, headers=headers)
        elapsed_time = round((time.time() - start_time) * 1000, 2)
        
        if response.status_code == 200 and response.json().get("success"):
            print(f"✅ {name} check passed! ({elapsed_time}ms)")
        else:
            print(f"❌ {name} check failed! Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"❌ Request to {name} failed: {e}")

def main():
    print_header("EduSkill Production Smoke Test")
    print(f"Targeting: {BASE_URL}")
    
    # 1. Authenticate
    token = test_admin_login()
    
    # 2. Run API checks
    print_header("Running Protected API Checks")
    
    endpoints_to_test = [
        ("Colleges Master Data", "colleges"),
        ("Districts Master Data", "districts"),
        ("Programs List", "programs"),
        ("Admin Analytics Overview", "reports/overview"),
        ("Live Classes Schedule", "live-classes"),
    ]
    
    for name, endpoint in endpoints_to_test:
        test_endpoint(name, endpoint, token)
        
    print("\n🎉 Smoke Testing Completed!")

if __name__ == "__main__":
    main()