"""
WebSocket Router for Real-time Updates
Provides WebSocket endpoints for live queue updates and admin dashboard
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from database import get_db
from models import Ticket, Service, TicketStatus, ServicePriority, QueueLog, User
from websocket_manager import connection_manager
from typing import Dict, Any
import json
import logging

# Import the atomic function from queue router to prevent code duplication and race conditions
from .queue import _call_next_patient_atomic

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/service/{service_id}")
async def websocket_service_endpoint(websocket: WebSocket, service_id: str, db: Session = Depends(get_db)):
    """WebSocket endpoint for service queue updates"""
    try:
        await connection_manager.connect_to_service(websocket, service_id)
        
        # Send initial queue state
        await send_initial_queue_state(websocket, service_id, db)
        
        try:
            while True:
                # Keep connection alive and handle any incoming messages
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                elif message.get("type") == "request_update":
                    # Send fresh queue state
                    await send_initial_queue_state(websocket, service_id, db)
                    
        except WebSocketDisconnect:
            connection_manager.disconnect_from_service(websocket, service_id)
            logger.info(f"Client disconnected from service {service_id}")
        except Exception as e:
            logger.error(f"Service WebSocket error: {e}")
            connection_manager.disconnect_from_service(websocket, service_id)
            
    except Exception as e:
        logger.error(f"Service WebSocket connection error: {e}")
        await websocket.close(code=1011, reason="Internal server error")


@router.websocket("/ticket/{ticket_number}")
async def websocket_ticket_endpoint(websocket: WebSocket, ticket_number: str, db: Session = Depends(get_db)):
    """WebSocket endpoint for individual ticket updates"""
    try:
        await connection_manager.connect_to_ticket(websocket, ticket_number)
        
        # Send initial ticket state
        await send_initial_ticket_state(websocket, ticket_number, db)
        
        try:
            while True:
                # Keep connection alive and handle any incoming messages
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                elif message.get("type") == "request_update":
                    # Send fresh ticket state
                    await send_initial_ticket_state(websocket, ticket_number, db)
                    
        except WebSocketDisconnect:
            connection_manager.disconnect_from_ticket(ticket_number)
            logger.info(f"Client disconnected from ticket {ticket_number}")
        except Exception as e:
            logger.error(f"Ticket WebSocket error: {e}")
            connection_manager.disconnect_from_ticket(ticket_number)
            
    except Exception as e:
        logger.error(f"Ticket WebSocket connection error: {e}")
        await websocket.close(code=1011, reason="Internal server error")


@router.websocket("/admin/dashboard")
async def websocket_admin_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """WebSocket endpoint for admin dashboard"""
    try:
        await connection_manager.connect_admin(websocket)
        
        # Send initial dashboard state
        await send_initial_dashboard_state(websocket, db)
        
        try:
            while True:
                # Listen for admin commands
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                elif message.get("type") == "request_dashboard_update":
                    await send_initial_dashboard_state(websocket, db)
                elif message.get("type") == "call_next_patient":
                    # Handle admin actions through WebSocket using the atomic function
                    service_id = message.get("service_id")
                    if service_id:
                        await handle_call_next_patient_websocket(service_id, db)
                        
        except WebSocketDisconnect:
            connection_manager.disconnect_admin(websocket)
            logger.info("Admin WebSocket disconnected")
        except Exception as e:
            logger.error(f"Admin WebSocket error: {e}")
            connection_manager.disconnect_admin(websocket)
            
    except Exception as e:
        logger.error(f"Admin WebSocket connection error: {e}")
        await websocket.close(code=1011, reason="Internal server error")

async def send_initial_queue_state(websocket: WebSocket, service_id: str, db: Session):
    """Send the current queue state to a newly connected client"""
    try:
        # Validate service exists
        service = db.query(Service).filter(Service.id == int(service_id)).first()
        if not service:
            await websocket.send_text(json.dumps({"error": "Service not found"}))
            return
        
        # Get current queue
        waiting_tickets = db.query(Ticket).filter(
            Ticket.service_id == int(service_id),
            Ticket.status == TicketStatus.WAITING
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        # Format queue data
        queue_data = []
        for i, ticket in enumerate(waiting_tickets, 1):
            queue_data.append({
                "position": i,
                "ticket_number": ticket.ticket_number,
                "estimated_wait_time": ticket.estimated_wait_time,
                "patient_name": ticket.patient.full_name if hasattr(ticket, 'patient') else "Unknown"
            })
        
        # Send queue state
        await websocket.send_text(json.dumps({
            "type": "queue_state",
            "service_id": service_id,
            "service_name": service.name,
            "total_waiting": len(waiting_tickets),
            "queue": queue_data,
            "timestamp": datetime.now().isoformat()
        }))
        
    except Exception as e:
        logger.error(f"Error sending initial queue state: {e}")
        await websocket.send_text(json.dumps({"error": "Failed to load queue state"}))


async def send_initial_ticket_state(websocket: WebSocket, ticket_number: str, db: Session):
    """Send the current ticket state to a newly connected client"""
    try:
        ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not ticket:
            await websocket.send_text(json.dumps({"error": "Ticket not found"}))
            return
        
        service = db.query(Service).filter(Service.id == ticket.service_id).first()
        
        await websocket.send_text(json.dumps({
            "type": "ticket_state",
            "ticket_number": ticket_number,
            "status": ticket.status.value,
            "position": ticket.position_in_queue,
            "estimated_wait_time": ticket.estimated_wait_time,
            "service_name": service.name if service else "Unknown",
            "timestamp": datetime.now().isoformat()
        }))
        
    except Exception as e:
        logger.error(f"Error sending initial ticket state: {e}")
        await websocket.send_text(json.dumps({"error": "Failed to load ticket state"}))


async def send_initial_dashboard_state(websocket: WebSocket, db: Session):
    """Send the current dashboard state to admin"""
    try:
        # Get all services with their current status
        services = db.query(Service).filter(Service.is_active == True).all()
        
        dashboard_data = []
        for service in services:
            waiting_count = db.query(Ticket).filter(
                Ticket.service_id == service.id,
                Ticket.status == TicketStatus.WAITING
            ).count()
            
            dashboard_data.append({
                "service_id": service.id,
                "service_name": service.name,
                "waiting_count": waiting_count,
                "avg_wait_time": service.avg_wait_time or 15
            })
        
        await websocket.send_text(json.dumps({
            "type": "dashboard_state",
            "services": dashboard_data,
            "timestamp": datetime.now().isoformat()
        }))
        
    except Exception as e:
        logger.error(f"Error sending initial dashboard state: {e}")

async def handle_call_next_patient_websocket(service_id: str, db: Session):
    """Handle calling the next patient through WebSocket using atomic function"""
    try:
        # Use the atomic function from queue router to prevent race conditions
        result = await _call_next_patient_atomic(int(service_id), db, admin_user=None)
        
        if result["success"]:
            logger.info(f"Successfully called next patient via WebSocket for service {service_id}")
        else:
            logger.warning(f"No patients to call in service {service_id}: {result['error']}")
            
    except Exception as e:
        logger.error(f"Error handling call next patient via WebSocket: {e}")

async def update_queue_positions_realtime(service_id: str, db: Session):
    """Update and broadcast new queue positions"""
    try:
        waiting_tickets = db.query(Ticket).filter(
            Ticket.service_id == int(service_id),
            Ticket.status == TicketStatus.WAITING
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        # Update positions
        queue_data = []
        for i, ticket in enumerate(waiting_tickets, 1):
            ticket.position_in_queue = i
            queue_data.append({
                "position": i,
                "ticket_number": ticket.ticket_number,
                "estimated_wait_time": ticket.estimated_wait_time
            })
        
        db.commit()
        
        # Broadcast queue update
        await connection_manager.queue_position_update(service_id, {
            "total_waiting": len(waiting_tickets),
            "queue": queue_data
        })
        
    except Exception as e:
        logger.error(f"Error updating queue positions: {e}")

@router.get("/stats")
async def get_websocket_stats():
    """Get current WebSocket connection statistics"""
    return {
        "status": "active",
        "connections": connection_manager.get_connection_stats(),
        "timestamp": datetime.now().isoformat()
    }