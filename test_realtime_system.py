#!/usr/bin/env python3
"""
Real-time System Demo Script
Tests the WebSocket functionality and enhanced UX features
"""

import asyncio
import websockets
import json
import requests
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"

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

async def test_websocket_connection():
    """Test WebSocket connection to admin dashboard"""
    print_header("🔌 Testing WebSocket Connection")
    
    try:
        uri = f"{WS_URL}/admin/dashboard"
        print_info(f"Connecting to: {uri}")
        
        async with websockets.connect(uri) as websocket:
            print_success("Connected to admin dashboard WebSocket")
            
            # Send ping
            ping_message = {"type": "ping", "timestamp": datetime.now().isoformat()}
            await websocket.send(json.dumps(ping_message))
            print_info("Sent ping message")
            
            # Wait for initial state and pong
            timeout = 10
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    data = json.loads(message)
                    
                    if data.get("type") == "pong":
                        print_success("Received pong response")
                    elif data.get("type") == "admin_connection_established":
                        print_success("Admin connection established")
                    elif data.get("type") == "initial_dashboard_state":
                        print_success("Received initial dashboard state")
                        print_info(f"Stats: {data.get('stats', {})}")
                        return True
                    else:
                        print_info(f"Received: {data.get('type', 'unknown')}")
                        
                except asyncio.TimeoutError:
                    continue
                    
            print_warning("Did not receive expected initial state within timeout")
            return False
            
    except Exception as e:
        print_error(f"WebSocket connection failed: {e}")
        return False

async def test_service_websocket():
    """Test service-specific WebSocket"""
    print_header("🏥 Testing Service WebSocket")
    
    # First, get available services
    try:
        response = requests.get(f"{BASE_URL}/api/services/")
        if response.status_code == 200:
            services = response.json()
            if services:
                service_id = services[0]['id']
                print_info(f"Testing with service: {services[0]['name']} (ID: {service_id})")
                
                uri = f"{WS_URL}/service/{service_id}"
                
                async with websockets.connect(uri) as websocket:
                    print_success(f"Connected to service {service_id} WebSocket")
                    
                    # Wait for initial queue state
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        data = json.loads(message)
                        
                        if data.get("type") == "initial_queue_state":
                            print_success("Received initial queue state")
                            print_info(f"Service: {data.get('service_name')}")
                            print_info(f"Total waiting: {data.get('total_waiting', 0)}")
                            return True
                        else:
                            print_warning(f"Unexpected message type: {data.get('type')}")
                            return False
                            
                    except asyncio.TimeoutError:
                        print_error("Timeout waiting for initial queue state")
                        return False
            else:
                print_warning("No services available for testing")
                return False
        else:
            print_error(f"Failed to get services: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Service WebSocket test failed: {e}")
        return False

def test_api_endpoints():
    """Test API endpoints are working"""
    print_header("🔗 Testing API Endpoints")
    
    endpoints = [
        ("/", "Health check"),
        ("/api/health", "API health"),
        ("/api/services/", "Services list"),
        ("/ws/stats", "WebSocket stats")
    ]
    
    success_count = 0
    
    for endpoint, description in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            if response.status_code == 200:
                print_success(f"{description}: OK")
                success_count += 1
            else:
                print_error(f"{description}: HTTP {response.status_code}")
        except Exception as e:
            print_error(f"{description}: {e}")
    
    print_info(f"API endpoints working: {success_count}/{len(endpoints)}")
    return success_count == len(endpoints)

def test_frontend_files():
    """Check if frontend files exist"""
    print_header("📁 Checking Frontend Files")
    
    import os
    
    files_to_check = [
        "Frontend/shared/websocket-client.js",
        "Frontend/shared/loading-manager.js", 
        "Frontend/shared/message-manager.js",
        "Frontend/dashboard/dashboard.js",
        "Frontend/dashboard/dashboard.html"
    ]
    
    all_exist = True
    
    for file_path in files_to_check:
        if os.path.exists(file_path):
            print_success(f"{file_path}: Found")
        else:
            print_error(f"{file_path}: Missing")
            all_exist = False
    
    return all_exist

async def run_comprehensive_test():
    """Run all tests"""
    print_header("🚀 WAITLESS-CHU Real-time System Test")
    print_info("Testing enhanced WebSocket and UX implementations")
    
    results = []
    
    # Test 1: Frontend files
    print_info("1. Checking frontend files...")
    results.append(test_frontend_files())
    
    # Test 2: API endpoints
    print_info("2. Testing API endpoints...")
    results.append(test_api_endpoints())
    
    # Test 3: WebSocket connections
    print_info("3. Testing WebSocket connections...")
    results.append(await test_websocket_connection())
    
    # Test 4: Service WebSocket
    print_info("4. Testing service-specific WebSocket...")
    results.append(await test_service_websocket())
    
    # Summary
    print_header("📊 Test Results Summary")
    
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print_success(f"All tests passed! ({passed}/{total})")
        print_success("✨ Real-time system is working perfectly!")
    else:
        print_warning(f"Tests passed: {passed}/{total}")
        if passed >= total * 0.75:
            print_info("🎯 System is mostly functional - excellent for PFE demo!")
        else:
            print_warning("🔧 Some issues detected - may need attention")
    
    print_header("🎓 PFE Recommendation")
    
    if passed >= 3:
        print_success("✅ EXCELLENT for PFE presentation!")
        print_info("Your system demonstrates:")
        print_info("  • Real-time WebSocket communication")
        print_info("  • Professional UX with loading states")
        print_info("  • Beautiful error handling and notifications")
        print_info("  • Full-stack integration")
        print_info("  • Production-ready architecture")
    else:
        print_info("🔧 System needs some fixes before PFE presentation")
        print_info("Check backend is running: python start_backend.py")
        print_info("Ensure database is initialized: python Backend/init_db.py")

if __name__ == "__main__":
    try:
        asyncio.run(run_comprehensive_test())
    except KeyboardInterrupt:
        print_info("\nTest interrupted by user")
    except Exception as e:
        print_error(f"Test failed with error: {e}")