#!/usr/bin/env python3
"""
Test script to verify dashboard consultations count
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@waitless.chu"
ADMIN_PASSWORD = "admin123"

def test_dashboard_consultations():
    """Test the dashboard consultations count"""
    print("🧪 Testing Dashboard Consultations Count")
    print("=" * 50)
    
    try:
        # 1. Login as admin
        print("1. Logging in as admin...")
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
        
        token = login_response.json().get("access_token")
        if not token:
            print("❌ No access token received")
            return False
        
        print("✅ Login successful")
        
        # 2. Get dashboard stats
        print("\n2. Getting dashboard stats...")
        headers = {"Authorization": f"Bearer {token}"}
        
        dashboard_response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        if dashboard_response.status_code != 200:
            print(f"❌ Dashboard request failed: {dashboard_response.status_code}")
            return False
        
        dashboard_data = dashboard_response.json()
        print("✅ Dashboard data retrieved")
        
        # 3. Check consultations data
        print("\n3. Analyzing consultations data...")
        
        total_consultations = dashboard_data.get("total_consultations", 0)
        total_completed_today = dashboard_data.get("total_completed_today", 0)
        total_patients = dashboard_data.get("total_patients", 0)
        
        print(f"📊 Total Consultations (all time): {total_consultations}")
        print(f"📊 Completed Today: {total_completed_today}")
        print(f"📊 Total Patients: {total_patients}")
        
        # 4. Validate data
        print("\n4. Validating data...")
        
        if total_consultations >= 0:
            print("✅ Total consultations count is valid")
        else:
            print("❌ Total consultations count is invalid")
            return False
        
        if total_completed_today >= 0:
            print("✅ Today's completed count is valid")
        else:
            print("❌ Today's completed count is invalid")
            return False
        
        if total_patients >= 0:
            print("✅ Total patients count is valid")
        else:
            print("❌ Total patients count is invalid")
            return False
        
        # 5. Check relationships
        print("\n5. Checking data relationships...")
        
        if total_consultations >= total_patients:
            print("✅ Total consultations >= Total patients (logical)")
        else:
            print("⚠️  Total consultations < Total patients (might be normal if patients have multiple consultations)")
        
        if total_completed_today <= total_consultations:
            print("✅ Today's completed <= Total consultations (logical)")
        else:
            print("❌ Today's completed > Total consultations (illogical)")
            return False
        
        print("\n🎉 All tests passed!")
        print(f"📈 Dashboard shows {total_consultations} total consultations of all time")
        print(f"📈 With {total_completed_today} completed today")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the server. Make sure the backend is running.")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Dashboard Consultations Test")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    success = test_dashboard_consultations()
    
    print()
    if success:
        print("✅ Test completed successfully!")
    else:
        print("❌ Test failed!")
    
    print(f"⏰ Test ended at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}") 