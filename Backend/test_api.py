"""
Test script for WaitLess CHU API
Tests the main endpoints to ensure they are working correctly
"""

import requests
import json
from datetime import datetime

# API base URL
BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test if the API is running."""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✓ Health Check: {response.status_code} - {response.json()}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Health Check Failed: {e}")
        return False

def test_admin_login():
    """Test admin login and return token."""
    login_data = {
        "email": "admin@waitless.chu",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Admin Login: {response.status_code}")
            print(f"  Token: {data['access_token'][:20]}...")
            print(f"  User: {data['user']['full_name']}")
            return data['access_token']
        else:
            print(f"❌ Admin Login Failed: {response.status_code} - {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Admin Login Error: {e}")
        return None

def test_services_endpoint(token=None):
    """Test services endpoint."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    try:
        response = requests.get(f"{BASE_URL}/api/services/", headers=headers)
        if response.status_code == 200:
            services = response.json()
            print(f"✓ Services List: {response.status_code} - Found {len(services)} services")
            for service in services[:3]:  # Show first 3 services
                print(f"  - {service['name']} ({service['location']})")
            return True
        else:
            print(f"❌ Services List Failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Services Error: {e}")
        return False

def test_patient_registration():
    """Test patient registration."""
    patient_data = {
        "email": "test.patient@email.com",
        "password": "testpass123",
        "full_name": "Test Patient",
        "phone": "0600000000"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register", json=patient_data)
        if response.status_code == 201:
            data = response.json()
            print(f"✓ Patient Registration: {response.status_code}")
            print(f"  Patient: {data['user']['full_name']}")
            return data['access_token']
        elif response.status_code == 400 and "already registered" in response.text:
            print("✓ Patient Registration: User already exists (expected)")
            # Try to login instead
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": patient_data["email"],
                "password": patient_data["password"]
            })
            if login_response.status_code == 200:
                return login_response.json()['access_token']
        else:
            print(f"❌ Patient Registration Failed: {response.status_code} - {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Patient Registration Error: {e}")
        return None

def test_dashboard(admin_token):
    """Test admin dashboard endpoint."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Dashboard: {response.status_code}")
            print(f"  Total Waiting: {data['total_waiting']}")
            print(f"  Total Consulting: {data['total_consulting']}")
            print(f"  Active Services: {data['active_services']}")
            return True
        else:
            print(f"❌ Dashboard Failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Dashboard Error: {e}")
        return False

def run_tests():
    """Run all tests."""
    print("🧪 Testing WaitLess CHU API")
    print("=" * 40)
    
    # Test 1: Health check
    if not test_health_check():
        print("❌ API server is not running!")
        return
    
    print()
    
    # Test 2: Admin login
    admin_token = test_admin_login()
    if not admin_token:
        print("❌ Cannot proceed without admin token!")
        return
    
    print()
    
    # Test 3: Services
    test_services_endpoint(admin_token)
    
    print()
    
    # Test 4: Patient registration
    patient_token = test_patient_registration()
    
    print()
    
    # Test 5: Dashboard
    if admin_token:
        test_dashboard(admin_token)
    
    print()
    print("🎉 API Testing Complete!")
    print("\n📋 Available Endpoints:")
    print("   • Authentication: /api/auth/")
    print("   • Services: /api/services/")
    print("   • Tickets: /api/tickets/")
    print("   • Queue: /api/queue/")
    print("   • Admin: /api/admin/")
    print(f"\n🌐 API Documentation: {BASE_URL}/docs")

if __name__ == "__main__":
    run_tests() 