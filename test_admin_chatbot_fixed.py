#!/usr/bin/env python3
"""
Test script to verify admin chatbot includes emergency services
"""

import requests
import json

def test_admin_chatbot_with_emergency():
    """Test that admin chatbot now includes emergency services"""
    base_url = "http://localhost:8000"
    
    print("🔍 Testing Admin Chatbot with Emergency Services...")
    print("=" * 60)
    
    # Test 1: Check dashboard stats
    print("📊 Test 1: Dashboard Stats (should show 7 services)")
    try:
        # First login to get token
        login_data = {
            "email": "admin@waitless.chu",
            "password": "admin123"
        }
        
        login_response = requests.post(f"{base_url}/api/auth/login", json=login_data)
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Get dashboard stats
            dashboard_response = requests.get(f"{base_url}/api/admin/dashboard", headers=headers)
            if dashboard_response.status_code == 200:
                dashboard_data = dashboard_response.json()
                active_services = dashboard_data.get("active_services", 0)
                services_list = dashboard_data.get("services", [])
                
                print(f"✅ Active services count: {active_services}")
                print(f"✅ Services list length: {len(services_list)}")
                print("\n📋 Services included:")
                for service in services_list:
                    print(f"   • {service['name']} - Status: {service['status']}")
                
                if active_services == 7:
                    print("✅ SUCCESS: Admin chatbot now shows 7 services (including emergency)")
                else:
                    print(f"❌ FAILED: Expected 7 services, got {active_services}")
                    
            else:
                print(f"❌ Dashboard request failed: {dashboard_response.status_code}")
                
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing dashboard: {e}")
    
    # Test 2: Check active services API
    print("\n🏥 Test 2: Active Services API (should include emergency)")
    try:
        services_response = requests.get(f"{base_url}/api/services/active/list")
        if services_response.status_code == 200:
            services = services_response.json()
            print(f"✅ Active services API returns: {len(services)} services")
            
            emergency_found = False
            for service in services:
                if service['name'] == 'Urgences':
                    emergency_found = True
                    print(f"✅ Found Urgences service with status: {service['status']}")
                    break
            
            if emergency_found:
                print("✅ SUCCESS: Emergency service is now included in active services")
            else:
                print("❌ FAILED: Emergency service not found in active services")
                
        else:
            print(f"❌ Services API failed: {services_response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing services API: {e}")
    
    # Test 3: Test admin chatbot context
    print("\n🤖 Test 3: Admin Chatbot Context")
    try:
        if 'token' in locals():
            chat_data = {
                "message": "Combien de services actifs y a-t-il ?",
                "session_id": "test_admin_session_123",
                "chatbot_role": "admin_assistant"
            }
            
            chat_response = requests.post(
                f"{base_url}/api/chatbot/admin/chat",
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
                data=json.dumps(chat_data)
            )
            
            if chat_response.status_code == 200:
                chat_result = chat_response.json()
                print("✅ Admin chatbot response received")
                print(f"📝 Response: {chat_result.get('response', 'No response')[:200]}...")
            else:
                print(f"❌ Admin chatbot failed: {chat_response.status_code}")
        else:
            print("❌ No token available for chatbot test")
            
    except Exception as e:
        print(f"❌ Error testing admin chatbot: {e}")

if __name__ == "__main__":
    test_admin_chatbot_with_emergency() 