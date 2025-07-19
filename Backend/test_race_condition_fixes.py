#!/usr/bin/env python3
"""
Test script to verify race condition fixes in queue management
Tests concurrent ticket creation and queue operations
"""

import asyncio
import aiohttp
import json
import time
from concurrent.futures import ThreadPoolExecutor
import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_success(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

async def get_auth_token():
    """Get authentication token for testing"""
    async with aiohttp.ClientSession() as session:
        login_data = {
            "email": "admin@waitless.chu",
            "password": "admin123"
        }
        
        async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as response:
            if response.status == 200:
                data = await response.json()
                return data.get("access_token")
            else:
                print_error(f"Failed to get auth token: {response.status}")
                return None

async def create_test_user(session, user_data):
    """Create a test user for concurrent testing"""
    try:
        async with session.post(f"{BASE_URL}/api/auth/register", json=user_data) as response:
            if response.status == 201:
                data = await response.json()
                return data.get("access_token")
            else:
                print_error(f"Failed to create user {user_data['email']}: {response.status}")
                return None
    except Exception as e:
        print_error(f"Error creating user {user_data['email']}: {e}")
        return None

async def create_ticket_concurrent(session, token, service_id, priority="medium", user_id=None):
    """Create a ticket concurrently to test race conditions"""
    headers = {"Authorization": f"Bearer {token}"}
    ticket_data = {
        "service_id": service_id,
        "priority": priority,
        "notes": f"Test ticket created at {datetime.now()}"
    }
    
    try:
        start_time = time.time()
        async with session.post(f"{BASE_URL}/api/tickets/create", 
                               json=ticket_data, headers=headers) as response:
            end_time = time.time()
            
            if response.status == 201:
                data = await response.json()
                return {
                    "success": True,
                    "ticket_number": data.get("ticket_number"),
                    "position": data.get("position_in_queue"),
                    "response_time": end_time - start_time,
                    "user_id": user_id
                }
            else:
                error_data = await response.text()
                return {
                    "success": False,
                    "error": f"Status {response.status}: {error_data}",
                    "response_time": end_time - start_time,
                    "user_id": user_id
                }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time": 0,
            "user_id": user_id
        }

async def test_concurrent_ticket_creation():
    """Test concurrent ticket creation for race conditions"""
    print_header("TESTING CONCURRENT TICKET CREATION")
    
    # Get admin token for service creation
    admin_token = await get_auth_token()
    if not admin_token:
        print_error("Cannot proceed without admin token")
        return False
    
    # Create test service
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {admin_token}"}
        service_data = {
            "name": "Race Condition Test Service",
            "description": "Service for testing concurrent operations",
            "location": "Test Location",
            "max_wait_time": 30
        }
        
        async with session.post(f"{BASE_URL}/api/services/create", 
                               json=service_data, headers=headers) as response:
            if response.status != 201:
                print_error(f"Failed to create test service: {response.status}")
                return False
            
            service_data = await response.json()
            service_id = service_data["id"]
            print_info(f"Created test service with ID: {service_id}")
    
    # Create multiple test users
    test_users = []
    async with aiohttp.ClientSession() as session:
        for i in range(10):
            user_data = {
                "email": f"testuser{i}@race.test",
                "password": "testpass123",
                "full_name": f"Test User {i}",
                "phone": f"123456789{i}"
            }
            token = await create_test_user(session, user_data)
            if token:
                test_users.append((token, i))
    
    print_info(f"Created {len(test_users)} test users")
    
    # Test concurrent ticket creation
    print_info("Starting concurrent ticket creation test...")
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for token, user_id in test_users:
            task = create_ticket_concurrent(session, token, service_id, "medium", user_id)
            tasks.append(task)
        
        # Run all ticket creations concurrently
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
    
    # Analyze results
    successful_tickets = [r for r in results if isinstance(r, dict) and r.get("success")]
    failed_tickets = [r for r in results if isinstance(r, dict) and not r.get("success")]
    exceptions = [r for r in results if not isinstance(r, dict)]
    
    print_info(f"Total time for {len(test_users)} concurrent requests: {end_time - start_time:.2f}s")
    print_success(f"Successful ticket creations: {len(successful_tickets)}")
    
    if failed_tickets:
        print_error(f"Failed ticket creations: {len(failed_tickets)}")
        for failure in failed_tickets[:3]:  # Show first 3 failures
            print_error(f"  - User {failure.get('user_id')}: {failure.get('error')}")
    
    if exceptions:
        print_error(f"Exceptions occurred: {len(exceptions)}")
        for exc in exceptions[:3]:  # Show first 3 exceptions
            print_error(f"  - {str(exc)}")
    
    # Check for duplicate positions (race condition indicator)
    positions = [t["position"] for t in successful_tickets]
    unique_positions = set(positions)
    
    if len(positions) == len(unique_positions):
        print_success("✅ NO DUPLICATE POSITIONS - Race condition fix successful!")
    else:
        print_error(f"❌ DUPLICATE POSITIONS FOUND - Race condition still exists!")
        print_error(f"Positions: {sorted(positions)}")
        return False
    
    # Check position sequence integrity
    if positions and sorted(positions) == list(range(1, len(positions) + 1)):
        print_success("✅ POSITION SEQUENCE INTEGRITY - Positions are sequential!")
    else:
        print_error(f"❌ POSITION SEQUENCE BROKEN - Expected 1-{len(positions)}, got {sorted(positions)}")
    
    # Test response times
    avg_response_time = sum(t["response_time"] for t in successful_tickets) / len(successful_tickets) if successful_tickets else 0
    max_response_time = max(t["response_time"] for t in successful_tickets) if successful_tickets else 0
    
    print_info(f"Average response time: {avg_response_time:.3f}s")
    print_info(f"Maximum response time: {max_response_time:.3f}s")
    
    if max_response_time < 2.0:  # Should be fast with non-blocking operations
        print_success("✅ RESPONSE TIMES GOOD - Non-blocking operations working!")
    else:
        print_error(f"❌ SLOW RESPONSE TIMES - May indicate blocking operations")
    
    return len(positions) == len(unique_positions)

async def test_queue_operations_performance():
    """Test performance of queue operations"""
    print_header("TESTING QUEUE OPERATIONS PERFORMANCE")
    
    admin_token = await get_auth_token()
    if not admin_token:
        print_error("Cannot proceed without admin token")
        return False
    
    # Test calling next patient multiple times
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get a service with tickets
        async with session.get(f"{BASE_URL}/api/queue/service/1") as response:
            if response.status == 200:
                queue_data = await response.json()
                service_id = queue_data["service_id"]
                waiting_count = queue_data["total_waiting"]
                
                print_info(f"Service {service_id} has {waiting_count} waiting tickets")
                
                if waiting_count > 0:
                    # Test call next patient operation
                    start_time = time.time()
                    async with session.post(f"{BASE_URL}/api/queue/call-next/{service_id}", 
                                          headers=headers) as response:
                        end_time = time.time()
                        
                        if response.status == 200:
                            print_success(f"Call next patient completed in {end_time - start_time:.3f}s")
                            if end_time - start_time < 1.0:
                                print_success("✅ FAST RESPONSE - Non-blocking notifications working!")
                            else:
                                print_error("❌ SLOW RESPONSE - May indicate blocking operations")
                        else:
                            print_error(f"Call next patient failed: {response.status}")
                else:
                    print_info("No waiting tickets to test call next patient")
            else:
                print_error(f"Failed to get queue status: {response.status}")
    
    return True

async def main():
    """Main test function"""
    print_header("QUEUE MANAGEMENT RACE CONDITION TESTS")
    
    # Test if backend is running
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/") as response:
                if response.status != 200:
                    print_error("Backend is not running. Start with: python start_backend.py")
                    return
    except Exception as e:
        print_error(f"Cannot connect to backend: {e}")
        print_error("Make sure backend is running on http://localhost:8000")
        return
    
    print_success("Backend connection established")
    
    # Run tests
    race_condition_test = await test_concurrent_ticket_creation()
    performance_test = await test_queue_operations_performance()
    
    print_header("TEST SUMMARY")
    if race_condition_test:
        print_success("✅ Race condition fixes working correctly")
    else:
        print_error("❌ Race condition fixes need improvement")
    
    if performance_test:
        print_success("✅ Performance tests completed")
    else:
        print_error("❌ Performance tests failed")
    
    overall_success = race_condition_test and performance_test
    if overall_success:
        print_success("🎉 ALL TESTS PASSED - Queue management fixes successful!")
    else:
        print_error("❌ Some tests failed - Review the fixes")

if __name__ == "__main__":
    asyncio.run(main())