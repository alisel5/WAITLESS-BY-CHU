#!/usr/bin/env python3
"""
Test script to verify the queue logic fix
Tests the exact scenario described in the user's issue
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"
TEST_SERVICE_ID = 1  # Assuming there's a service with ID 1

class QueueTester:
    def __init__(self):
        self.session = None
        self.tokens = {}  # Store tokens for different users
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def login_user(self, email: str, password: str) -> Dict[str, Any]:
        """Login a user and return token info"""
        login_data = {"username": email, "password": password}
        
        async with self.session.post(f"{BASE_URL}/api/auth/login", data=login_data) as resp:
            if resp.status == 200:
                result = await resp.json()
                token = result.get("access_token")
                self.tokens[email] = token
                print(f"✅ Logged in {email}")
                return result
            else:
                print(f"❌ Failed to login {email}: {resp.status}")
                return {}
    
    async def create_ticket(self, user_email: str, service_id: int = TEST_SERVICE_ID) -> Dict[str, Any]:
        """Create a ticket for a user"""
        token = self.tokens.get(user_email)
        if not token:
            print(f"❌ No token for {user_email}")
            return {}
        
        headers = {"Authorization": f"Bearer {token}"}
        ticket_data = {
            "service_id": service_id,
            "priority": "medium",
            "notes": f"Test ticket for {user_email}"
        }
        
        async with self.session.post(
            f"{BASE_URL}/api/tickets/create", 
            json=ticket_data, 
            headers=headers
        ) as resp:
            if resp.status == 201:
                result = await resp.json()
                print(f"✅ Created ticket for {user_email}: {result['ticket_number']} (Position: {result['position_in_queue']})")
                return result
            else:
                text = await resp.text()
                print(f"❌ Failed to create ticket for {user_email}: {resp.status} - {text}")
                return {}
    
    async def get_ticket_status(self, ticket_number: str) -> Dict[str, Any]:
        """Get ticket status"""
        async with self.session.get(f"{BASE_URL}/api/queue/ticket-status/{ticket_number}") as resp:
            if resp.status == 200:
                return await resp.json()
            else:
                print(f"❌ Failed to get ticket status: {resp.status}")
                return {}
    
    async def call_next_patient(self, admin_email: str, service_id: int = TEST_SERVICE_ID) -> Dict[str, Any]:
        """Call next patient (admin action)"""
        token = self.tokens.get(admin_email)
        if not token:
            print(f"❌ No token for admin {admin_email}")
            return {}
        
        headers = {"Authorization": f"Bearer {token}"}
        
        async with self.session.post(
            f"{BASE_URL}/api/queue/call-next/{service_id}",
            headers=headers
        ) as resp:
            if resp.status == 200:
                result = await resp.json()
                print(f"✅ Called next patient: {result.get('patient_name', 'Unknown')}")
                return result
            else:
                text = await resp.text()
                print(f"❌ Failed to call next patient: {resp.status} - {text}")
                return {}
    
    async def get_queue_status(self, service_id: int = TEST_SERVICE_ID) -> Dict[str, Any]:
        """Get queue status"""
        async with self.session.get(f"{BASE_URL}/api/queue/service/{service_id}") as resp:
            if resp.status == 200:
                return await resp.json()
            else:
                print(f"❌ Failed to get queue status: {resp.status}")
                return {}

async def run_queue_test():
    """Run the complete queue test scenario"""
    print("🧪 Starting Queue Logic Test")
    print("=" * 50)
    
    async with QueueTester() as tester:
        # Step 1: Login admin user (assuming admin@example.com exists)
        print("\n📋 Step 1: Login admin user")
        await tester.login_user("admin@waitless.chu", "admin123")
        
        # Step 2: Login test users A and B (create if needed)
        print("\n📋 Step 2: Login test users")
        await tester.login_user("ali@test.com", "serpent123")
        await tester.login_user("ali@test2.com", "serpent123")
        
        # Step 3: User A joins queue
        print("\n📋 Step 3: User A joins queue")
        ticket_a = await tester.create_ticket("usera@test.com")
        if not ticket_a:
            print("❌ Cannot continue test - User A ticket creation failed")
            return
        
        # Step 4: User B joins queue
        print("\n📋 Step 4: User B joins queue")
        ticket_b = await tester.create_ticket("userb@test.com")
        if not ticket_b:
            print("❌ Cannot continue test - User B ticket creation failed")
            return
        
        # Step 5: Check initial queue status
        print("\n📋 Step 5: Check initial queue status")
        queue_status = await tester.get_queue_status()
        print(f"Queue has {queue_status.get('total_waiting', 0)} people waiting")
        
        # Check individual ticket statuses
        status_a = await tester.get_ticket_status(ticket_a['ticket_number'])
        status_b = await tester.get_ticket_status(ticket_b['ticket_number'])
        
        print(f"User A position: {status_a.get('position_in_queue', 'N/A')}")
        print(f"User B position: {status_b.get('position_in_queue', 'N/A')}")
        
        # Step 6: Admin calls next patient (should be User A)
        print("\n📋 Step 6: Admin calls next patient")
        call_result = await tester.call_next_patient("admin@example.com")
        
        # Wait a moment for updates
        await asyncio.sleep(2)
        
        # Step 7: Check ticket statuses after first call
        print("\n📋 Step 7: Check statuses after first call")
        status_a_after = await tester.get_ticket_status(ticket_a['ticket_number'])
        status_b_after = await tester.get_ticket_status(ticket_b['ticket_number'])
        
        print(f"User A status: {status_a_after.get('status', 'N/A')}")
        print(f"User B position: {status_b_after.get('position_in_queue', 'N/A')} (should be 1)")
        
        # Step 8: Admin calls next patient again (should be User B)
        print("\n📋 Step 8: Admin calls next patient again")
        call_result_2 = await tester.call_next_patient("admin@example.com")
        
        # Wait a moment for updates
        await asyncio.sleep(2)
        
        # Step 9: Final status check
        print("\n📋 Step 9: Final status check")
        status_b_final = await tester.get_ticket_status(ticket_b['ticket_number'])
        queue_final = await tester.get_queue_status()
        
        print(f"User B final status: {status_b_final.get('status', 'N/A')} (should be completed)")
        print(f"Final queue waiting count: {queue_final.get('total_waiting', 0)} (should be 0)")
        
        # Verification
        print("\n🔍 VERIFICATION RESULTS:")
        print("=" * 30)
        
        success = True
        
        # Check if User B moved to position 1 after User A was called
        if status_b_after.get('position_in_queue') == 1:
            print("✅ User B correctly moved to position 1 after User A was called")
        else:
            print(f"❌ User B should be at position 1, but is at position {status_b_after.get('position_in_queue')}")
            success = False
        
        # Check if User B is completed after second call
        if status_b_final.get('status') == 'completed':
            print("✅ User B correctly completed after second call")
        else:
            print(f"❌ User B should be completed, but status is {status_b_final.get('status')}")
            success = False
        
        # Check if queue is empty
        if queue_final.get('total_waiting') == 0:
            print("✅ Queue is correctly empty after all patients called")
        else:
            print(f"❌ Queue should be empty, but has {queue_final.get('total_waiting')} waiting")
            success = False
        
        if success:
            print("\n🎉 ALL TESTS PASSED! Queue logic is working correctly.")
        else:
            print("\n❌ SOME TESTS FAILED! Queue logic needs further investigation.")

if __name__ == "__main__":
    asyncio.run(run_queue_test())