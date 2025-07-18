#!/usr/bin/env python3
"""
Test WebSocket Integration for Ticket Real-time Updates
Tests the connection between admin dashboard and ticket tracking
"""

import asyncio
import websockets
import json
import aiohttp
from datetime import datetime

# Configuration
API_BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"

class WebSocketTester:
    def __init__(self):
        self.connections = {}
        self.received_messages = []
        
    async def connect_as_admin(self):
        """Connect as admin dashboard"""
        try:
            uri = f"{WS_URL}/dashboard"
            websocket = await websockets.connect(uri)
            self.connections['dashboard'] = websocket
            print("✅ Connected as admin dashboard")
            
            # Listen for messages
            asyncio.create_task(self.listen_for_messages('dashboard', websocket))
            return True
        except Exception as e:
            print(f"❌ Failed to connect as admin: {e}")
            return False
    
    async def connect_as_ticket(self, ticket_number):
        """Connect as ticket tracker"""
        try:
            uri = f"{WS_URL}/ticket/{ticket_number}"
            websocket = await websockets.connect(uri)
            self.connections[f'ticket_{ticket_number}'] = websocket
            print(f"✅ Connected as ticket {ticket_number}")
            
            # Listen for messages
            asyncio.create_task(self.listen_for_messages(f'ticket_{ticket_number}', websocket))
            return True
        except Exception as e:
            print(f"❌ Failed to connect as ticket {ticket_number}: {e}")
            return False
    
    async def listen_for_messages(self, connection_name, websocket):
        """Listen for WebSocket messages"""
        try:
            async for message in websocket:
                data = json.loads(message)
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"📨 [{timestamp}] {connection_name} received: {data}")
                self.received_messages.append({
                    'connection': connection_name,
                    'data': data,
                    'timestamp': timestamp
                })
        except websockets.exceptions.ConnectionClosed:
            print(f"🔌 {connection_name} connection closed")
        except Exception as e:
            print(f"❌ Error listening to {connection_name}: {e}")
    
    async def simulate_admin_action(self, service_id):
        """Simulate admin calling next patient"""
        print(f"\n🔄 Simulating admin calling next patient for service {service_id}...")
        
        try:
            # This would normally be done via authenticated API call
            # For testing, we'll simulate the WebSocket message directly
            
            # Get the admin connection
            dashboard_ws = self.connections.get('dashboard')
            if dashboard_ws:
                # Send a test message (in real app this comes from backend)
                test_message = {
                    "type": "patient_called",
                    "data": {
                        "ticket_number": "A001",
                        "patient_name": "Test Patient",
                        "status": "consulting",
                        "service_id": service_id
                    }
                }
                await dashboard_ws.send(json.dumps(test_message))
                print("📤 Sent patient_called message from dashboard")
            
        except Exception as e:
            print(f"❌ Error simulating admin action: {e}")
    
    async def run_integration_test(self):
        """Run the full integration test"""
        print("🚀 Starting WebSocket Integration Test")
        print("=" * 50)
        
        # Step 1: Connect as admin dashboard
        if not await self.connect_as_admin():
            return False
        
        # Step 2: Connect as ticket tracker
        if not await self.connect_as_ticket("A001"):
            return False
        
        # Step 3: Wait a moment for connections to stabilize
        await asyncio.sleep(2)
        
        # Step 4: Simulate admin calling next patient
        await self.simulate_admin_action(1)
        
        # Step 5: Wait for messages to be received
        await asyncio.sleep(3)
        
        # Step 6: Check results
        return self.check_test_results()
    
    def check_test_results(self):
        """Check if the test was successful"""
        print("\n📊 Test Results:")
        print("=" * 30)
        
        if not self.received_messages:
            print("❌ No messages received - WebSocket integration failed")
            return False
        
        # Look for ticket status update messages
        ticket_updates = [msg for msg in self.received_messages 
                         if 'ticket_' in msg['connection']]
        
        dashboard_updates = [msg for msg in self.received_messages 
                           if 'dashboard' in msg['connection']]
        
        print(f"📈 Dashboard messages: {len(dashboard_updates)}")
        print(f"🎫 Ticket messages: {len(ticket_updates)}")
        
        for msg in self.received_messages:
            print(f"  - {msg['connection']}: {msg['data'].get('type', 'unknown')}")
        
        if ticket_updates:
            print("✅ Ticket received real-time updates!")
            return True
        else:
            print("❌ Ticket did not receive updates")
            return False
    
    async def cleanup(self):
        """Close all connections"""
        for name, ws in self.connections.items():
            try:
                await ws.close()
                print(f"🔌 Closed {name} connection")
            except:
                pass

async def main():
    """Main test function"""
    tester = WebSocketTester()
    
    try:
        success = await tester.run_integration_test()
        
        if success:
            print("\n🎉 WebSocket Integration Test PASSED!")
            print("Real-time updates are working between admin and tickets")
        else:
            print("\n💥 WebSocket Integration Test FAILED!")
            print("Check the connections and message flow")
            
    except Exception as e:
        print(f"💥 Test failed with error: {e}")
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    print("WebSocket Integration Tester")
    print("This tests real-time communication between admin dashboard and ticket tracking")
    print("Make sure the backend server is running on localhost:8000")
    print()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
    except Exception as e:
        print(f"💥 Unexpected error: {e}")