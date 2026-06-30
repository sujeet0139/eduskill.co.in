import os
import requests
import sys
from dotenv import load_dotenv
import warnings

# Suppress only the single InsecureRequestWarning from urllib3 needed for `verify=False`
from urllib3.exceptions import InsecureRequestWarning
warnings.simplefilter('ignore', InsecureRequestWarning)

# Load environment variables from .env file in the parent directory
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

API_BASE_URL = "https://api.eduskill.co.in/api"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

def print_header(text):
    print("\n" + "-" * 50)
    print(text)
    print("-" * 50)

def run_test(name, test_func):
    print(f"Testing {name}...")
    try:
        test_func()
        print(f"✅ {name} PASSED")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection Error: {e}")
    except Exception as e:
        print(f"❌ Test Failed: {e}")
    
    # Exit with a non-zero code if any test fails
    sys.exit(1)

def test_admin_login():
    """Tests if the admin login endpoint responds successfully."""
    if not ADMIN_PASSWORD:
        raise ValueError("ADMIN_PASSWORD is not set in the .env file.")
        
    url = f"{API_BASE_URL}/auth/admin/login"
    payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    # The key fix is `verify=False`, which tells requests to not verify the SSL cert.
    response = requests.post(url, json=payload, timeout=15, verify=False)
    
    if response.status_code != 200:
        raise Exception(f"Expected status 200, but got {response.status_code}. Response: {response.text[:100]}")

if __name__ == "__main__":
    print_header("EduSkill Production Smoke Test")
    print(f"Targeting: {API_BASE_URL}")
    
    run_test("Admin Login", test_admin_login)