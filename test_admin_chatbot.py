#!/usr/bin/env python3
"""
Test script for admin chatbot functionality
"""

import requests
import json

def test_admin_chatbot_api():
    """Test the admin chatbot API directly"""
    base_url = "http://localhost:8000"
    
    # Test health check
    print("🔍 Testing chatbot health...")
    try:
        health_response = requests.get(f"{base_url}/api/chatbot/health")
        print(f"Health status: {health_response.status_code}")
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"Health data: {health_data}")
        else:
            print(f"Health check failed: {health_response.text}")
    except Exception as e:
        print(f"Health check error: {e}")
    
    # Test admin chat (this will fail without authentication, but we can see the structure)
    print("\n🤖 Testing admin chat...")
    try:
        chat_data = {
            "message": "Résumez l'activité d'aujourd'hui",
            "session_id": "test_admin_session_123",
            "chatbot_role": "admin_assistant"
        }
        
        chat_response = requests.post(
            f"{base_url}/api/chatbot/admin/chat",
            headers={"Content-Type": "application/json"},
            data=json.dumps(chat_data)
        )
        
        print(f"Admin chat status: {chat_response.status_code}")
        if chat_response.status_code == 200:
            chat_result = chat_response.json()
            print(f"Admin chat response: {json.dumps(chat_result, indent=2, ensure_ascii=False)}")
        elif chat_response.status_code == 401:
            print("✅ Expected 401 - Authentication required for admin chat")
        else:
            print(f"Admin chat failed: {chat_response.text}")
            
    except Exception as e:
        print(f"Admin chat error: {e}")

if __name__ == "__main__":
    test_admin_chatbot_api() 