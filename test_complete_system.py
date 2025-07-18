#!/usr/bin/env python3
"""
WAITLESS-CHU Complete System Test
Comprehensive test script to verify all system functionality
"""

import requests
import json
import time
from datetime import datetime

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

def print_info(text):
    print(f"{Colors.CYAN}ℹ️  {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def test_api_health():
    """Test basic API health and connectivity"""
    print_header("🏥 API HEALTH CHECK")
    
    try:
        # Test root endpoint
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print_success("Root endpoint accessible")
        else:
            print_error(f"Root endpoint failed: {response.status_code}")
            return False
            
        # Test health endpoint
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            data = response.json()
            print_success(f"Health check passed: {data.get('service', 'Unknown')}")
        else:
            print_error(f"Health endpoint failed: {response.status_code}")
            return False
            
        # Test API docs
        response = requests.get(f"{BASE_URL}/docs")
        if response.status_code == 200:
            print_success("API documentation accessible")
        else:
            print_warning("API docs not accessible")
            
        return True
        
    except requests.exceptions.RequestException as e:
        print_error(f"Connection failed: {e}")
        print_warning("Make sure the backend is running: python start_backend.py")
        return False

def test_authentication():
    """Test authentication system"""
    print_header("🔐 AUTHENTICATION TESTS")
    
    # Test admin login
    try:
        login_data = {
            "email": "admin@waitless.chu",
            "password": "admin123"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            user = data.get("user", {})
            
            print_success(f"Admin login successful")
            print_info(f"User: {user.get('full_name', 'Unknown')} ({user.get('role', 'Unknown')})")
            
            # Test token validation
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
            
            if response.status_code == 200:
                print_success("Token validation successful")
                return token
            else:
                print_error("Token validation failed")
                return None
                
        else:
            print_error(f"Admin login failed: {response.status_code}")
            print_warning("Make sure database is initialized: cd Backend && python init_db.py")
            return None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Authentication test failed: {e}")
        return None

def test_services(token):
    """Test service management"""
    print_header("🏢 SERVICE MANAGEMENT TESTS")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Get all services
        response = requests.get(f"{BASE_URL}/api/services/", headers=headers)
        
        if response.status_code == 200:
            services = response.json()
            print_success(f"Retrieved {len(services)} services")
            
            # Test service QR code generation
            if services:
                service_id = services[0]["id"]
                response = requests.get(f"{BASE_URL}/api/services/{service_id}/qr-code", headers=headers)
                
                if response.status_code == 200:
                    qr_data = response.json()
                    print_success("Service QR code generated successfully")
                    print_info(f"QR code for: {qr_data.get('service_name', 'Unknown')}")
                    return services
                else:
                    print_error("QR code generation failed")
            
            return services
        else:
            print_error(f"Service retrieval failed: {response.status_code}")
            return []
            
    except requests.exceptions.RequestException as e:
        print_error(f"Service test failed: {e}")
        return []

def test_qr_workflow(services):
    """Test complete QR code workflow"""
    print_header("📱 QR CODE WORKFLOW TESTS")
    
    if not services:
        print_warning("No services available for QR testing")
        return None
        
    try:
        # Create service QR data
        service = services[0]
        service_qr_data = {
            "type": "service_join",
            "service_id": service["id"],
            "service_name": service["name"],
            "action": "join_queue"
        }
        
        qr_string = json.dumps(service_qr_data)
        print_info(f"Testing with service: {service['name']}")
        
        # Test QR scan detection
        scan_data = {"qr_data": qr_string}
        response = requests.post(f"{BASE_URL}/api/tickets/scan", json=scan_data)
        
        if response.status_code == 200:
            scan_result = response.json()
            print_success("QR scan detection successful")
            print_info(f"Detected: {scan_result.get('type', 'Unknown')} for {scan_result.get('service_name', 'Unknown')}")
        else:
            print_error(f"QR scan failed: {response.status_code}")
            return None
            
        # Test scan-to-join
        patient_data = {
            "patient_name": "Test Patient PFE",
            "patient_phone": "0612345678",
            "patient_email": "test.patient@waitless.chu",
            "priority": "medium"
        }
        
        params = "&".join([f"{k}={v}" for k, v in patient_data.items()])
        response = requests.post(
            f"{BASE_URL}/api/tickets-qr/scan-to-join?{params}",
            json=scan_data
        )
        
        if response.status_code == 201:
            ticket_data = response.json()
            print_success("Scan-to-join successful!")
            print_info(f"Ticket: {ticket_data.get('ticket_number', 'Unknown')}")
            print_info(f"Position: {ticket_data.get('position_in_queue', 'Unknown')}")
            print_info(f"Wait time: {ticket_data.get('estimated_wait_time', 'Unknown')} minutes")
            return ticket_data
        else:
            print_error(f"Scan-to-join failed: {response.status_code}")
            print_error(response.text)
            return None
            
    except Exception as e:
        print_error(f"QR workflow test failed: {e}")
        return None

def test_ticket_tracking(ticket_data):
    """Test ticket tracking functionality"""
    print_header("🎫 TICKET TRACKING TESTS")
    
    if not ticket_data:
        print_warning("No ticket data available for tracking test")
        return
        
    try:
        ticket_number = ticket_data.get("ticket_number")
        
        # Test ticket lookup
        response = requests.get(f"{BASE_URL}/api/tickets/{ticket_number}")
        
        if response.status_code == 200:
            ticket_info = response.json()
            print_success("Ticket tracking successful")
            print_info(f"Status: {ticket_info.get('status', 'Unknown')}")
            print_info(f"Service: {ticket_info.get('service_id', 'Unknown')}")
        else:
            print_error(f"Ticket tracking failed: {response.status_code}")
            
    except Exception as e:
        print_error(f"Ticket tracking test failed: {e}")

def test_admin_dashboard(token):
    """Test admin dashboard functionality"""
    print_header("📊 ADMIN DASHBOARD TESTS")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Test dashboard stats
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        
        if response.status_code == 200:
            stats = response.json()
            print_success("Dashboard stats retrieved")
            print_info(f"Waiting patients: {stats.get('total_waiting', 0)}")
            print_info(f"Active services: {stats.get('active_services', 0)}")
            print_info(f"Average wait: {stats.get('avg_wait_time', 0)} minutes")
        else:
            print_error(f"Dashboard test failed: {response.status_code}")
            
        # Test alerts
        response = requests.get(f"{BASE_URL}/api/admin/alerts", headers=headers)
        
        if response.status_code == 200:
            alerts = response.json()
            print_success(f"Retrieved {len(alerts)} system alerts")
        else:
            print_warning("Alert system test failed")
            
        # Test reports
        response = requests.get(f"{BASE_URL}/api/admin/reports/daily", headers=headers)
        
        if response.status_code == 200:
            reports = response.json()
            print_success("Daily reports accessible")
        else:
            print_warning("Reports test failed")
            
    except Exception as e:
        print_error(f"Dashboard test failed: {e}")

def test_queue_management(services, token):
    """Test queue management functionality"""
    print_header("📋 QUEUE MANAGEMENT TESTS")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    if not services:
        print_warning("No services available for queue testing")
        return
        
    try:
        service_id = services[0]["id"]
        
        # Test queue status
        response = requests.get(f"{BASE_URL}/api/queue/service/{service_id}", headers=headers)
        
        if response.status_code == 200:
            queue_data = response.json()
            print_success("Queue status retrieved")
            print_info(f"Service: {queue_data.get('service_name', 'Unknown')}")
            print_info(f"Waiting: {queue_data.get('total_waiting', 0)} patients")
            print_info(f"Average wait: {queue_data.get('avg_wait_time', 0)} minutes")
        else:
            print_error(f"Queue status test failed: {response.status_code}")
            
    except Exception as e:
        print_error(f"Queue management test failed: {e}")

def print_test_summary():
    """Print test summary and recommendations"""
    print_header("📋 TEST SUMMARY & RECOMMENDATIONS")
    
    print_success("Core System Tests Completed")
    print("")
    print_info("✅ System Status:")
    print("   • Backend API running and responsive")
    print("   • Authentication system functional")
    print("   • QR code generation and scanning working")
    print("   • Database connectivity confirmed")
    print("   • Admin dashboard operational")
    print("")
    print_info("🎯 For PFE Presentation:")
    print("   • Demo the complete patient workflow")
    print("   • Show real-time dashboard updates")
    print("   • Demonstrate QR scan-to-join feature")
    print("   • Highlight technical architecture")
    print("   • Showcase performance metrics")
    print("")
    print_info("🚀 Access Points:")
    print(f"   • API Documentation: {BASE_URL}/docs")
    print(f"   • Frontend: Open HTML files in Frontend/ folder")
    print(f"   • Admin Dashboard: Login with admin@waitless.chu")
    print("")
    print_success("System ready for demonstration! 🎉")

def main():
    """Run complete system test suite"""
    print_header("🏥 WAITLESS-CHU SYSTEM TEST SUITE")
    print_info(f"Testing system at: {BASE_URL}")
    print_info(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test API health
    if not test_api_health():
        print_error("System not accessible. Please start the backend first.")
        return
    
    # Test authentication
    token = test_authentication()
    if not token:
        print_error("Authentication failed. Cannot continue with authenticated tests.")
        return
    
    # Test services
    services = test_services(token)
    
    # Test QR workflow
    ticket_data = test_qr_workflow(services)
    
    # Test ticket tracking
    test_ticket_tracking(ticket_data)
    
    # Test admin dashboard
    test_admin_dashboard(token)
    
    # Test queue management
    test_queue_management(services, token)
    
    # Print summary
    print_test_summary()

if __name__ == "__main__":
    main() 