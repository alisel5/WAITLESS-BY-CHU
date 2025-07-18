"""
QR Code Demo for WaitLess CHU
Demonstrates the complete scan-to-join workflow
"""

import requests
import json
import base64
from PIL import Image
import io

BASE_URL = "http://localhost:8000"

def demo_complete_qr_workflow():
    """Demonstrate the complete QR workflow."""
    print("🏥 WaitLess CHU - QR Code Demo")
    print("=" * 50)
    
    # Step 1: Get services with QR codes
    print("📋 Step 1: Getting Services with QR Codes...")
    try:
        response = requests.get(f"{BASE_URL}/api/services/active/with-qr")
        if response.status_code == 200:
            data = response.json()
            services = data['services']
            print(f"✓ Found {len(services)} active services")
            
            # Display service options
            for i, service in enumerate(services, 1):
                print(f"   {i}. {service['name']} - {service['location']}")
                print(f"      Current waiting: {service['current_waiting']}, Avg time: {service['avg_wait_time']}min")
            
            # Use first service for demo
            demo_service = services[0]
            service_id = demo_service['id']
            service_name = demo_service['name']
            
            print(f"\n🎯 Demo Service: {service_name}")
            
    except Exception as e:
        print(f"❌ Error getting services: {e}")
        return
    
    # Step 2: Generate and display service QR code
    print(f"\n📱 Step 2: Generating QR Code for {service_name}...")
    try:
        response = requests.get(f"{BASE_URL}/api/services/{service_id}/qr-code")
        if response.status_code == 200:
            qr_data = response.json()
            print(f"✓ QR Code generated successfully")
            print(f"   Instructions: {qr_data['scan_instructions']}")
            print(f"   Location: {qr_data['location']}")
            
            # Extract QR code data for scanning simulation
            qr_code_b64 = qr_data['qr_code']
            print(f"   QR Code: {qr_code_b64[:50]}...")
            
            # Simulate QR scan by parsing the data
            service_qr_data = {
                "type": "service_join",
                "service_id": service_id,
                "service_name": service_name,
                "action": "join_queue"
            }
            qr_scan_data = json.dumps(service_qr_data)
            
    except Exception as e:
        print(f"❌ Error generating QR code: {e}")
        return
    
    # Step 3: Simulate QR scan detection
    print(f"\n🔍 Step 3: Simulating QR Code Scan...")
    try:
        scan_request = {"qr_data": qr_scan_data}
        response = requests.post(f"{BASE_URL}/api/tickets/scan", json=scan_request)
        
        if response.status_code == 200:
            scan_result = response.json()
            print(f"✓ QR Code detected as: {scan_result['type']}")
            print(f"   Service: {scan_result['service_name']}")
            print(f"   Location: {scan_result['location']}")
            print(f"   Current waiting: {scan_result['current_waiting']}")
            print(f"   Message: {scan_result['message']}")
            
    except Exception as e:
        print(f"❌ Error scanning QR code: {e}")
        return
    
    # Step 4: Join queue via QR scan
    print(f"\n🎫 Step 4: Joining Queue via QR Scan...")
    
    # Patient information
    patient_info = {
        "patient_name": "Demo Patient",
        "patient_phone": "0688888888",
        "patient_email": "demo.patient@waitless.chu",
        "priority": "medium"
    }
    
    try:
        scan_data = {"qr_data": qr_scan_data}
        
        response = requests.post(
            f"{BASE_URL}/api/tickets-qr/scan-to-join",
            json=scan_data,
            params=patient_info
        )
        
        if response.status_code == 201:
            ticket = response.json()
            print(f"✓ Successfully joined queue!")
            print(f"   Ticket Number: {ticket['ticket_number']}")
            print(f"   Position in Queue: {ticket['position_in_queue']}")
            print(f"   Estimated Wait: {ticket['estimated_wait_time']} minutes")
            print(f"   Service: {ticket['service_name']}")
            print(f"   Status: {ticket['status']}")
            
            return ticket['ticket_number']
            
        else:
            print(f"❌ Failed to join queue: {response.status_code}")
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Error joining queue: {e}")
        return None
    
    return None


def demo_admin_view():
    """Demonstrate admin view of the queue."""
    print(f"\n👨‍⚕️ Step 5: Admin Dashboard View...")
    
    # Login as admin
    admin_login = {
        "email": "admin@waitless.chu",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=admin_login)
        if response.status_code == 200:
            admin_token = response.json()['access_token']
            headers = {"Authorization": f"Bearer {admin_token}"}
            
            # Get dashboard stats
            dashboard_response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
            if dashboard_response.status_code == 200:
                stats = dashboard_response.json()
                print(f"✓ Dashboard Statistics:")
                print(f"   Total Waiting: {stats['total_waiting']}")
                print(f"   Total Consulting: {stats['total_consulting']}")
                print(f"   Active Services: {stats['active_services']}")
                print(f"   Average Wait Time: {stats['avg_wait_time']} minutes")
                
            # Get queue status for Cardiologie
            queue_response = requests.get(f"{BASE_URL}/api/queue/service/1")
            if queue_response.status_code == 200:
                queue_data = queue_response.json()
                print(f"\n📊 Queue Status for {queue_data['service_name']}:")
                print(f"   Total Waiting: {queue_data['total_waiting']}")
                print(f"   Average Wait: {queue_data['avg_wait_time']} minutes")
                
                if queue_data['queue']:
                    print(f"   Queue Positions:")
                    for pos in queue_data['queue'][:3]:  # Show first 3
                        print(f"     {pos['position']}. {pos['ticket_number']} ({pos['estimated_wait_time']}min)")
                        
    except Exception as e:
        print(f"❌ Error accessing admin view: {e}")


def run_complete_demo():
    """Run the complete QR code demo."""
    try:
        # Check API health
        response = requests.get(f"{BASE_URL}/")
        if response.status_code != 200:
            print("❌ API server is not running!")
            print("Please start the server with: python main.py")
            return
        
        print("✓ API server is running")
        
        # Run main demo
        ticket_number = demo_complete_qr_workflow()
        
        # Show admin view
        demo_admin_view()
        
        print(f"\n🎉 Demo Complete!")
        print(f"\n📱 QR Code Workflow Summary:")
        print(f"   1. ✓ Generate service QR codes")
        print(f"   2. ✓ Detect QR code type when scanned")
        print(f"   3. ✓ Auto-join queue with patient info")
        print(f"   4. ✓ Get ticket with position and wait time")
        print(f"   5. ✓ Admin can monitor queue in real-time")
        
        if ticket_number:
            print(f"\n🎫 Demo ticket created: {ticket_number}")
            print(f"   Use this for testing ticket tracking features")
        
        print(f"\n🌐 API Documentation: {BASE_URL}/docs")
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API server!")
        print("Please ensure the server is running on http://localhost:8000")
        print("Start with: cd Backend && python main.py")


if __name__ == "__main__":
    run_complete_demo() 