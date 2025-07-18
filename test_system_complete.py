#!/usr/bin/env python3
"""
WAITLESS-CHU Complete System Test
Comprehensive test script to verify all system functionality
"""

import requests
import json
import time
from datetime import datetime
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'Backend'))

BASE_URL = "http://localhost:8000"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

def print_success(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠ {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.CYAN}ℹ {text}{Colors.END}")

def test_backend_health():
    """Test backend health endpoint"""
    print_header("Testing Backend Health")
    
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            data = response.json()
            print_success(f"Backend is running: {data.get('message', 'OK')}")
            return True
        else:
            print_error(f"Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Backend connection failed: {e}")
        return False

def test_authentication():
    """Test authentication system"""
    print_header("Testing Authentication System")
    
    # Test admin registration
    admin_data = {
        "email": "admin@waitless.chu",
        "password": "admin123",
        "full_name": "Admin User",
        "phone": "06 00 00 00 00",
        "role": "admin"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register-admin", json=admin_data)
        if response.status_code == 201:
            print_success("Admin user created successfully")
            token_data = response.json()
            admin_token = token_data["access_token"]
        else:
            print_warning("Admin user might already exist, trying login")
            login_data = {
                "email": admin_data["email"],
                "password": admin_data["password"]
            }
            response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
            if response.status_code == 200:
                print_success("Admin login successful")
                token_data = response.json()
                admin_token = token_data["access_token"]
            else:
                print_error("Admin authentication failed")
                return None
    except Exception as e:
        print_error(f"Authentication test failed: {e}")
        return None
    
    return admin_token

def test_services_management(token):
    """Test services management"""
    print_header("Testing Services Management")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test creating a service
    service_data = {
        "name": "Cardiologie Test",
        "description": "Service de cardiologie pour les tests",
        "location": "Étage 2, Aile A",
        "priority": "high"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/services/", json=service_data, headers=headers)
        if response.status_code == 201:
            print_success("Service created successfully")
            service = response.json()
            service_id = service["id"]
        else:
            print_warning("Service might already exist, getting existing services")
            response = requests.get(f"{BASE_URL}/api/services/", headers=headers)
            if response.status_code == 200:
                services = response.json()
                if services:
                    service_id = services[0]["id"]
                    print_success(f"Using existing service: {services[0]['name']}")
                else:
                    print_error("No services found")
                    return False
            else:
                print_error("Failed to get services")
                return False
    except Exception as e:
        print_error(f"Service management test failed: {e}")
        return False
    
    # Test QR code generation
    try:
        response = requests.get(f"{BASE_URL}/api/services/{service_id}/qr-code", headers=headers)
        if response.status_code == 200:
            qr_data = response.json()
            if qr_data.get("qr_code"):
                print_success("QR code generated successfully")
            else:
                print_error("QR code not found in response")
                return False
        else:
            print_error(f"QR code generation failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"QR code test failed: {e}")
        return False
    
    return True

def test_ticket_creation(token):
    """Test ticket creation and management"""
    print_header("Testing Ticket System")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get services first
    try:
        response = requests.get(f"{BASE_URL}/api/services/", headers=headers)
        if response.status_code != 200:
            print_error("Failed to get services for ticket test")
            return False
        
        services = response.json()
        if not services:
            print_error("No services available for ticket test")
            return False
        
        service_id = services[0]["id"]
    except Exception as e:
        print_error(f"Failed to get services: {e}")
        return False
    
    # Test online queue joining
    queue_data = {
        "patient_name": "Test Patient",
        "patient_phone": "06 12 34 56 78",
        "patient_email": "test@example.com",
        "service_id": service_id,
        "priority": "medium"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/tickets/join-online", json=queue_data)
        if response.status_code == 201:
            ticket_data = response.json()
            print_success(f"Ticket created successfully: {ticket_data.get('ticket_number', 'N/A')}")
            ticket_number = ticket_data.get("ticket_number")
        else:
            print_error(f"Ticket creation failed: {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Ticket creation test failed: {e}")
        return False
    
    # Test ticket status checking
    if ticket_number:
        try:
            response = requests.get(f"{BASE_URL}/api/tickets/{ticket_number}")
            if response.status_code == 200:
                status_data = response.json()
                print_success(f"Ticket status retrieved: {status_data.get('status', 'N/A')}")
            else:
                print_error(f"Ticket status check failed: {response.status_code}")
        except Exception as e:
            print_error(f"Ticket status test failed: {e}")
    
    return True

def test_admin_dashboard(token):
    """Test admin dashboard functionality"""
    print_header("Testing Admin Dashboard")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test dashboard stats
    try:
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print_success("Dashboard stats retrieved successfully")
            print_info(f"Total waiting: {stats.get('total_waiting', 0)}")
            print_info(f"Total consulting: {stats.get('total_consulting', 0)}")
            print_info(f"Active services: {stats.get('active_services', 0)}")
        else:
            print_error(f"Dashboard stats failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Dashboard test failed: {e}")
        return False
    
    # Test patients list
    try:
        response = requests.get(f"{BASE_URL}/api/admin/patients", headers=headers)
        if response.status_code == 200:
            patients = response.json()
            print_success(f"Patients list retrieved: {len(patients)} patients")
        else:
            print_error(f"Patients list failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Patients test failed: {e}")
        return False
    
    # Test daily reports
    try:
        response = requests.get(f"{BASE_URL}/api/admin/reports/daily", headers=headers)
        if response.status_code == 200:
            reports = response.json()
            print_success(f"Daily reports retrieved: {len(reports)} days")
        else:
            print_error(f"Daily reports failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Reports test failed: {e}")
        return False
    
    return True

def test_frontend_pages():
    """Test frontend pages accessibility"""
    print_header("Testing Frontend Pages")
    
    # List of pages to test
    pages = [
        ("Accueil", "Frontend/Acceuil/acceuil.html"),
        ("QR Scanner", "Frontend/qr code/qr.html"),
        ("QR Display", "Frontend/qr-display/qr-display.html"),
        ("Dashboard", "Frontend/dashboard/dashboard.html"),
        ("Patients", "Frontend/patients/patients.html"),
        ("Reports", "Frontend/reports/reports.html"),
        ("Track Status", "Frontend/tickets/ticket.html"),
        ("Services", "Frontend/services/services.html")
    ]
    
    all_pages_exist = True
    
    for page_name, page_path in pages:
        if os.path.exists(page_path):
            print_success(f"{page_name} page exists")
        else:
            print_error(f"{page_name} page missing: {page_path}")
            all_pages_exist = False
    
    return all_pages_exist

def test_api_endpoints():
    """Test all API endpoints"""
    print_header("Testing API Endpoints")
    
    endpoints = [
        ("Health Check", "GET", "/"),
        ("Login", "POST", "/api/auth/login"),
        ("Register", "POST", "/api/auth/register"),
        ("Services List", "GET", "/api/services/"),
        ("Active Services", "GET", "/api/services/active/list"),
        ("Services with QR", "GET", "/api/services/active/with-qr"),
        ("Join Online", "POST", "/api/tickets/join-online"),
        ("Dashboard Stats", "GET", "/api/admin/dashboard"),
        ("Patients List", "GET", "/api/admin/patients"),
        ("Daily Reports", "GET", "/api/admin/reports/daily")
    ]
    
    all_endpoints_ok = True
    
    for endpoint_name, method, path in endpoints:
        try:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{path}")
            else:
                response = requests.post(f"{BASE_URL}{path}", json={})
            
            if response.status_code in [200, 201, 401, 422]:  # Acceptable responses
                print_success(f"{endpoint_name}: {response.status_code}")
            else:
                print_warning(f"{endpoint_name}: {response.status_code}")
        except Exception as e:
            print_error(f"{endpoint_name}: Connection failed")
            all_endpoints_ok = False
    
    return all_endpoints_ok

def main():
    """Run all tests"""
    print_header("WAITLESS-CHU SYSTEM TEST")
    print_info("Starting comprehensive system test...")
    
    # Test results
    results = {}
    
    # 1. Backend Health
    results["backend_health"] = test_backend_health()
    if not results["backend_health"]:
        print_error("Backend is not running. Please start the backend first.")
        return
    
    # 2. Authentication
    admin_token = test_authentication()
    results["authentication"] = admin_token is not None
    
    # 3. Services Management
    if admin_token:
        results["services"] = test_services_management(admin_token)
    else:
        results["services"] = False
    
    # 4. Ticket System
    if admin_token:
        results["tickets"] = test_ticket_creation(admin_token)
    else:
        results["tickets"] = False
    
    # 5. Admin Dashboard
    if admin_token:
        results["dashboard"] = test_admin_dashboard(admin_token)
    else:
        results["dashboard"] = False
    
    # 6. Frontend Pages
    results["frontend"] = test_frontend_pages()
    
    # 7. API Endpoints
    results["api_endpoints"] = test_api_endpoints()
    
    # Summary
    print_header("TEST RESULTS SUMMARY")
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        color = Colors.GREEN if result else Colors.RED
        print(f"{color}{status}{Colors.END} - {test_name.replace('_', ' ').title()}")
    
    print(f"\n{Colors.BOLD}Overall Result: {passed_tests}/{total_tests} tests passed{Colors.END}")
    
    if passed_tests == total_tests:
        print_success("🎉 All tests passed! System is ready for PFE presentation.")
    else:
        print_warning("⚠ Some tests failed. Please check the issues above.")
    
    # Recommendations
    print_header("RECOMMENDATIONS")
    
    if not results["backend_health"]:
        print_info("1. Start the backend server: python Backend/main.py")
    
    if not results["authentication"]:
        print_info("2. Check database initialization and admin user creation")
    
    if not results["frontend"]:
        print_info("3. Ensure all frontend files are present")
    
    if not results["api_endpoints"]:
        print_info("4. Verify all API routes are properly configured")
    
    print_info("5. For PFE presentation, ensure the backend is running and accessible")
    print_info("6. Test the QR code scanning functionality with a mobile device")
    print_info("7. Verify all admin features work correctly")

if __name__ == "__main__":
    main() 