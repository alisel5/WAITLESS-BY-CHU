#!/usr/bin/env python3
"""
Test script to verify auto-completion functionality
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@waitless.com"
ADMIN_PASSWORD = "admin123"

def test_auto_completion():
    """Test the auto-completion feature"""
    
    print("🧪 Testing Auto-Completion Feature")
    print("=" * 50)
    
    # Step 1: Login as admin
    print("1. Logging in as admin...")
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_response.status_code != 200:
        print("❌ Failed to login as admin")
        return False
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("✅ Admin login successful")
    
    # Step 2: Get services
    print("\n2. Getting services...")
    services_response = requests.get(f"{BASE_URL}/api/services", headers=headers)
    
    if services_response.status_code != 200:
        print("❌ Failed to get services")
        return False
    
    services = services_response.json()
    if not services:
        print("❌ No services found")
        return False
    
    service = services[0]  # Use first service
    service_id = service["id"]
    service_name = service["name"]
    
    print(f"✅ Found service: {service_name} (ID: {service_id})")
    
    # Step 3: Check current queue status
    print(f"\n3. Checking queue status for {service_name}...")
    queue_response = requests.get(f"{BASE_URL}/api/queue/service/{service_id}", headers=headers)
    
    if queue_response.status_code != 200:
        print("❌ Failed to get queue status")
        return False
    
    queue_status = queue_response.json()
    waiting_count = queue_status["total_waiting"]
    
    print(f"✅ Current waiting patients: {waiting_count}")
    
    # Step 4: Call next patient until no more waiting
    print(f"\n4. Calling next patients until queue is empty...")
    
    while waiting_count > 0:
        print(f"   Calling next patient (waiting: {waiting_count})...")
        
        call_response = requests.post(f"{BASE_URL}/api/queue/call-next/{service_id}", headers=headers)
        
        if call_response.status_code != 200:
            print(f"❌ Failed to call next patient: {call_response.text}")
            return False
        
        result = call_response.json()
        auto_completed = result.get("auto_completed", False)
        
        if auto_completed:
            print("   ✅ Auto-completion triggered!")
        
        # Update waiting count
        queue_response = requests.get(f"{BASE_URL}/api/queue/service/{service_id}", headers=headers)
        if queue_response.status_code == 200:
            queue_status = queue_response.json()
            waiting_count = queue_status["total_waiting"]
        else:
            print("❌ Failed to get updated queue status")
            return False
    
    print("✅ All patients called, queue is empty")
    
    # Step 5: Verify that consulting tickets are now completed
    print(f"\n5. Verifying that consulting tickets are now completed...")
    
    # Get all tickets for this service
    tickets_response = requests.get(f"{BASE_URL}/api/admin/tickets", headers=headers)
    
    if tickets_response.status_code != 200:
        print("❌ Failed to get tickets")
        return False
    
    tickets = tickets_response.json()
    service_tickets = [t for t in tickets if t.get("service_id") == service_id]
    
    consulting_tickets = [t for t in service_tickets if t["status"] == "consulting"]
    completed_tickets = [t for t in service_tickets if t["status"] == "completed"]
    
    print(f"   Consulting tickets: {len(consulting_tickets)}")
    print(f"   Completed tickets: {len(completed_tickets)}")
    
    if len(consulting_tickets) == 0 and len(completed_tickets) > 0:
        print("✅ Auto-completion working correctly!")
        return True
    else:
        print("❌ Auto-completion not working as expected")
        return False

if __name__ == "__main__":
    try:
        success = test_auto_completion()
        if success:
            print("\n🎉 All tests passed! Auto-completion feature is working correctly.")
        else:
            print("\n💥 Tests failed! Please check the implementation.")
    except Exception as e:
        print(f"\n💥 Test failed with exception: {e}")
        import traceback
        traceback.print_exc() 