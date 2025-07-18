"""
Test script for enhanced QR code features in WaitLess CHU API
Tests the scan-to-join functionality and service QR codes
"""

import requests
import json

# API base URL
BASE_URL = "http://localhost:8000"

def test_service_qr_generation():
    """Test getting QR codes for services."""
    print("🔸 Testing Service QR Code Generation...")
    
    try:
        # Get all services
        response = requests.get(f"{BASE_URL}/api/services/")
        if response.status_code == 200:
            services = response.json()
            if services:
                service_id = services[0]['id']
                service_name = services[0]['name']
                
                # Get QR code for first service
                qr_response = requests.get(f"{BASE_URL}/api/services/{service_id}/qr-code")
                if qr_response.status_code == 200:
                    qr_data = qr_response.json()
                    print(f"✓ QR Code generated for {service_name}")
                    print(f"  Instructions: {qr_data['scan_instructions']}")
                    print(f"  Location: {qr_data['location']}")
                    return qr_data['qr_code'], service_id
                else:
                    print(f"❌ QR Generation Failed: {qr_response.status_code}")
                    return None, None
        else:
            print(f"❌ Services Fetch Failed: {response.status_code}")
            return None, None
    except requests.exceptions.RequestException as e:
        print(f"❌ QR Generation Error: {e}")
        return None, None


def test_scan_to_join():
    """Test scan-to-join functionality."""
    print("\n🔸 Testing Scan-to-Join Functionality...")
    
    # Create service QR data (simulating scan)
    service_qr_data = {
        "type": "service_join",
        "service_id": 1,  # Cardiologie
        "service_name": "Cardiologie",
        "action": "join_queue"
    }
    
    scan_data = {
        "qr_data": json.dumps(service_qr_data)
    }
    
    # Patient data
    patient_data = {
        "patient_name": "Test Scanner Patient",
        "patient_phone": "0677777777",
        "patient_email": "scanner.test@waitless.chu",
        "priority": "medium"
    }
    
    try:
        # Make scan-to-join request
        response = requests.post(
            f"{BASE_URL}/api/tickets/scan-to-join",
            json=scan_data,
            params=patient_data
        )
        
        if response.status_code == 201:
            ticket_data = response.json()
            print(f"✓ Scan-to-Join Success!")
            print(f"  Ticket Number: {ticket_data['ticket_number']}")
            print(f"  Position: {ticket_data['position_in_queue']}")
            print(f"  Wait Time: {ticket_data['estimated_wait_time']} minutes")
            print(f"  Service: {ticket_data['service_name']}")
            return ticket_data['ticket_number']
        else:
            print(f"❌ Scan-to-Join Failed: {response.status_code} - {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Scan-to-Join Error: {e}")
        return None


def test_enhanced_scan():
    """Test enhanced scan functionality that handles both types."""
    print("\n🔸 Testing Enhanced Scan Detection...")
    
    # Test 1: Service QR code
    service_qr_data = {
        "type": "service_join",
        "service_id": 2,  # Dermatologie
        "service_name": "Dermatologie",
        "action": "join_queue"
    }
    
    scan_data = {"qr_data": json.dumps(service_qr_data)}
    
    try:
        response = requests.post(f"{BASE_URL}/api/tickets/scan", json=scan_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Service QR Detected: {result['service_name']}")
            print(f"  Message: {result['message']}")
        else:
            print(f"❌ Service QR Scan Failed: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Service QR Scan Error: {e}")
    
    # Test 2: Invalid QR code
    invalid_scan = {"qr_data": "INVALID_QR_CODE"}
    
    try:
        response = requests.post(f"{BASE_URL}/api/tickets/scan", json=invalid_scan)
        if response.status_code == 404:
            print("✓ Invalid QR Code properly rejected")
        else:
            print(f"❌ Invalid QR handling unexpected: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Invalid QR Test Error: {e}")


def test_services_with_qr():
    """Test getting all services with their QR codes."""
    print("\n🔸 Testing Services with QR Codes...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/services/active/with-qr")
        if response.status_code == 200:
            data = response.json()
            services = data['services']
            print(f"✓ Retrieved {len(services)} services with QR codes")
            
            for service in services[:3]:  # Show first 3
                print(f"  - {service['name']} ({service['location']})")
                print(f"    Waiting: {service['current_waiting']}, Avg: {service['avg_wait_time']}min")
                
        else:
            print(f"❌ Services with QR Failed: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Services with QR Error: {e}")


def run_qr_tests():
    """Run all QR code tests."""
    print("🧪 Testing Enhanced QR Code Features")
    print("=" * 50)
    
    # Test service QR generation
    qr_code, service_id = test_service_qr_generation()
    
    # Test scan-to-join
    if service_id:
        ticket_number = test_scan_to_join()
    
    # Test enhanced scan detection
    test_enhanced_scan()
    
    # Test services with QR codes
    test_services_with_qr()
    
    print("\n🎉 QR Code Testing Complete!")
    print("\n📋 New QR Features Available:")
    print("   • Service QR Codes: /api/services/{id}/qr-code")
    print("   • Scan-to-Join: /api/tickets/scan-to-join")
    print("   • Enhanced Scan: /api/tickets/scan")
    print("   • Services with QR: /api/services/active/with-qr")
    
    print("\n📱 Usage Flow:")
    print("   1. Generate QR codes for services")
    print("   2. Display QR codes at service locations")
    print("   3. Patients scan QR codes with their phones")
    print("   4. Automatically join queue with patient info")
    print("   5. Get ticket with position and wait time")


if __name__ == "__main__":
    run_qr_tests() 