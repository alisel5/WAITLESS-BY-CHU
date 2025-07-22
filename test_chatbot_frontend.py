#!/usr/bin/env python3
"""
Test script for chatbot frontend functionality
"""

import requests
import json

def test_chatbot_api():
    """Test the chatbot API directly"""
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
    
    # Test patient chat
    print("\n🤖 Testing patient chat...")
    try:
        chat_data = {
            "message": "Bonjour, je cherche le service de cardiologie",
            "session_id": "test_session_123",
            "chatbot_role": "patient_assistant"
        }
        
        chat_response = requests.post(
            f"{base_url}/api/chatbot/patient/chat",
            headers={"Content-Type": "application/json"},
            data=json.dumps(chat_data)
        )
        
        print(f"Chat status: {chat_response.status_code}")
        if chat_response.status_code == 200:
            chat_result = chat_response.json()
            print(f"Chat response: {json.dumps(chat_result, indent=2, ensure_ascii=False)}")
        else:
            print(f"Chat failed: {chat_response.text}")
            
    except Exception as e:
        print(f"Chat error: {e}")

if __name__ == "__main__":
    test_chatbot_api() 