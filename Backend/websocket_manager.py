"""
WebSocket Manager for Real-time Queue Updates
Handles live connections and broadcasts queue changes to connected clients
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
import json
import logging
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        # Store connections by service_id
        self.service_connections: Dict[str, List[WebSocket]] = {}
        # Store connections by ticket_number for individual updates
        self.ticket_connections: Dict[str, WebSocket] = {}
        # Store admin connections for dashboard updates
        self.admin_connections: List[WebSocket] = []
        
    async def connect_to_service(self, websocket: WebSocket, service_id: str):
        """Connect client to service queue updates"""
        await websocket.accept()
        
        if service_id not in self.service_connections:
            self.service_connections[service_id] = []
        
        self.service_connections[service_id].append(websocket)
        logger.info(f"Client connected to service {service_id}. Total connections: {len(self.service_connections[service_id])}")
        
        # Send welcome message with current connection count
        await self.send_personal_message(websocket, {
            "type": "connection_established",
            "service_id": service_id,
            "timestamp": datetime.now().isoformat(),
            "message": "Connected to real-time updates"
        })
    
    async def connect_to_ticket(self, websocket: WebSocket, ticket_number: str):
        """Connect client to specific ticket updates"""
        await websocket.accept()
        self.ticket_connections[ticket_number] = websocket
        logger.info(f"Client connected to ticket {ticket_number}")
        
        await self.send_personal_message(websocket, {
            "type": "ticket_connection_established",
            "ticket_number": ticket_number,
            "timestamp": datetime.now().isoformat(),
            "message": "Connected to ticket updates"
        })
    
    async def connect_admin(self, websocket: WebSocket):
        """Connect admin to dashboard updates"""
        await websocket.accept()
        self.admin_connections.append(websocket)
        logger.info(f"Admin connected. Total admin connections: {len(self.admin_connections)}")
        
        await self.send_personal_message(websocket, {
            "type": "admin_connection_established",
            "timestamp": datetime.now().isoformat(),
            "message": "Connected to admin dashboard updates"
        })
    
    def disconnect_from_service(self, websocket: WebSocket, service_id: str):
        """Disconnect client from service updates"""
        if service_id in self.service_connections:
            if websocket in self.service_connections[service_id]:
                self.service_connections[service_id].remove(websocket)
                logger.info(f"Client disconnected from service {service_id}")
                
                # Clean up empty service connections
                if not self.service_connections[service_id]:
                    del self.service_connections[service_id]
    
    def disconnect_from_ticket(self, ticket_number: str):
        """Disconnect client from ticket updates"""
        if ticket_number in self.ticket_connections:
            del self.ticket_connections[ticket_number]
            logger.info(f"Client disconnected from ticket {ticket_number}")
    
    def disconnect_admin(self, websocket: WebSocket):
        """Disconnect admin from dashboard updates"""
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)
            logger.info(f"Admin disconnected. Remaining connections: {len(self.admin_connections)}")
    
    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Send message to specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
    
    async def broadcast_to_service(self, service_id: str, message: dict):
        """Broadcast message to all clients connected to a service"""
        if service_id not in self.service_connections:
            return
        
        message["timestamp"] = datetime.now().isoformat()
        message_text = json.dumps(message)
        
        # Send to all connected clients
        disconnected = []
        for connection in self.service_connections[service_id]:
            try:
                await connection.send_text(message_text)
            except Exception as e:
                logger.error(f"Error broadcasting to service {service_id}: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.service_connections[service_id].remove(connection)
        
        logger.info(f"Broadcasted to {len(self.service_connections[service_id])} clients in service {service_id}")
    
    async def send_to_ticket(self, ticket_number: str, message: dict):
        """Send update to specific ticket holder"""
        if ticket_number not in self.ticket_connections:
            return
        
        message["timestamp"] = datetime.now().isoformat()
        
        try:
            await self.ticket_connections[ticket_number].send_text(json.dumps(message))
            logger.info(f"Sent update to ticket {ticket_number}")
        except Exception as e:
            logger.error(f"Error sending to ticket {ticket_number}: {e}")
            # Remove disconnected ticket connection
            del self.ticket_connections[ticket_number]
    
    async def broadcast_to_admins(self, message: dict):
        """Broadcast message to all admin connections"""
        if not self.admin_connections:
            return
        
        message["timestamp"] = datetime.now().isoformat()
        message_text = json.dumps(message)
        
        disconnected = []
        for connection in self.admin_connections:
            try:
                await connection.send_text(message_text)
            except Exception as e:
                logger.error(f"Error broadcasting to admin: {e}")
                disconnected.append(connection)
        
        # Remove disconnected admins
        for connection in disconnected:
            self.admin_connections.remove(connection)
        
        logger.info(f"Broadcasted to {len(self.admin_connections)} admin connections")
    
    async def queue_position_update(self, service_id: str, queue_data: dict):
        """Broadcast queue position updates to service subscribers"""
        message = {
            "type": "queue_update",
            "service_id": service_id,
            "data": queue_data,
            "event": "position_change"
        }
        await self.broadcast_to_service(service_id, message)
    
    async def ticket_status_update(self, ticket_number: str, status_data: dict):
        """Send status update to specific ticket holder"""
        message = {
            "type": "ticket_update",
            "ticket_number": ticket_number,
            "data": status_data,
            "event": "status_change"
        }
        await self.send_to_ticket(ticket_number, message)
    
    async def new_patient_joined(self, service_id: str, patient_data: dict):
        """Notify about new patient joining the queue"""
        message = {
            "type": "queue_update",
            "service_id": service_id,
            "event": "patient_joined",
            "data": patient_data
        }
        await self.broadcast_to_service(service_id, message)
        await self.broadcast_to_admins(message)
    
    async def patient_called(self, service_id: str, ticket_data: dict):
        """Notify about patient being called"""
        message = {
            "type": "queue_update",
            "service_id": service_id,
            "event": "patient_called",
            "data": ticket_data
        }
        await self.broadcast_to_service(service_id, message)
        await self.broadcast_to_admins(message)
        
        # Also send specific update to the called patient
        await self.ticket_status_update(ticket_data.get("ticket_number", ""), {
            "status": "completed",
            "message": "C'est votre tour! Présentez-vous au service."
        })
    
    async def consultation_completed(self, service_id: str, ticket_data: dict):
        """Notify about completed consultation"""
        message = {
            "type": "queue_update",
            "service_id": service_id,
            "event": "consultation_completed",
            "data": ticket_data
        }
        await self.broadcast_to_service(service_id, message)
        await self.broadcast_to_admins(message)
    
    async def emergency_alert(self, service_id: str, alert_data: dict):
        """Send emergency alerts"""
        message = {
            "type": "emergency_alert",
            "service_id": service_id,
            "event": "emergency",
            "data": alert_data,
            "priority": "high"
        }
        await self.broadcast_to_service(service_id, message)
        await self.broadcast_to_admins(message)
    
    def get_connection_stats(self) -> dict:
        """Get current connection statistics"""
        service_stats = {}
        for service_id, connections in self.service_connections.items():
            service_stats[service_id] = len(connections)
        
        return {
            "total_service_connections": sum(len(conns) for conns in self.service_connections.values()),
            "service_breakdown": service_stats,
            "ticket_connections": len(self.ticket_connections),
            "admin_connections": len(self.admin_connections),
            "active_services": len(self.service_connections)
        }

# Global connection manager instance
connection_manager = ConnectionManager()