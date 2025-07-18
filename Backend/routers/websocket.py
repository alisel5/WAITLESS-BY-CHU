"""
WebSocket Router for Real-time Updates
Provides WebSocket endpoints for live queue updates and admin dashboard
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import json
import logging
import asyncio
from datetime import datetime

from database import get_db
from models import Service, Ticket, User, TicketStatus
from websocket_manager import connection_manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/service/{service_id}")
async def websocket_service_endpoint(
    websocket: WebSocket, 
    service_id: str,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for service queue updates"""
    try:
        # Verify service exists
        service = db.query(Service).filter(Service.id == int(service_id)).first()
        if not service:
            await websocket.close(code=1000, reason="Service not found")
            return
        
        # Connect to service updates
        await connection_manager.connect_to_service(websocket, service_id)
        
        # Send initial queue state
        await send_initial_queue_state(websocket, service_id, db)
        
        try:
            while True:
                # Keep connection alive and handle incoming messages
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                elif message.get("type") == "request_update":
                    await send_initial_queue_state(websocket, service_id, db)
                
        except WebSocketDisconnect:
            connection_manager.disconnect_from_service(websocket, service_id)
            logger.info(f"WebSocket disconnected from service {service_id}")
        except Exception as e:
            logger.error(f"WebSocket error for service {service_id}: {e}")
            connection_manager.disconnect_from_service(websocket, service_id)
            
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        await websocket.close(code=1011, reason="Internal server error")

@router.websocket("/ticket/{ticket_number}")
async def websocket_ticket_endpoint(
    websocket: WebSocket,
    ticket_number: str,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for individual ticket updates"""
    try:
        # Verify ticket exists
        ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not ticket:
            await websocket.close(code=1000, reason="Ticket not found")
            return
        
        # Connect to ticket updates
        await connection_manager.connect_to_ticket(websocket, ticket_number)
        
        # Send initial ticket state
        await send_initial_ticket_state(websocket, ticket_number, db)
        
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                elif message.get("type") == "request_update":
                    await send_initial_ticket_state(websocket, ticket_number, db)
                    
        except WebSocketDisconnect:
            connection_manager.disconnect_from_ticket(ticket_number)
            logger.info(f"WebSocket disconnected from ticket {ticket_number}")
        except Exception as e:
            logger.error(f"WebSocket error for ticket {ticket_number}: {e}")
            connection_manager.disconnect_from_ticket(ticket_number)
            
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        await websocket.close(code=1011, reason="Internal server error")

@router.websocket("/admin/dashboard")
async def websocket_admin_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """WebSocket endpoint for admin dashboard updates"""
    try:
        # Connect admin
        await connection_manager.connect_admin(websocket)
        
        # Send initial dashboard state
        await send_initial_dashboard_state(websocket, db)
        
        try:
            while True:
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
                    # Handle admin actions through WebSocket
                    service_id = message.get("service_id")
                    if service_id:
                        await handle_call_next_patient(service_id, db)
                        
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
        service = db.query(Service).filter(Service.id == int(service_id)).first()
        if not service:
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
                "priority": ticket.priority.value,
                "created_at": ticket.created_at.isoformat()
            })
        
        initial_state = {
            "type": "initial_queue_state",
            "service_id": service_id,
            "service_name": service.name,
            "total_waiting": len(waiting_tickets),
            "avg_wait_time": service.avg_wait_time,
            "queue": queue_data,
            "timestamp": datetime.now().isoformat()
        }
        
        await websocket.send_text(json.dumps(initial_state))
        
    except Exception as e:
        logger.error(f"Error sending initial queue state: {e}")

async def send_initial_ticket_state(websocket: WebSocket, ticket_number: str, db: Session):
    """Send the current ticket state to a newly connected client"""
    try:
        ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not ticket:
            return
        
        service = db.query(Service).filter(Service.id == ticket.service_id).first()
        
        # Calculate current position
        waiting_tickets = db.query(Ticket).filter(
            Ticket.service_id == ticket.service_id,
            Ticket.status == TicketStatus.WAITING,
            Ticket.priority >= ticket.priority,
            Ticket.created_at <= ticket.created_at
        ).count()
        
        initial_state = {
            "type": "initial_ticket_state",
            "ticket_number": ticket_number,
            "status": ticket.status.value,
            "position_in_queue": waiting_tickets if ticket.status == TicketStatus.WAITING else 0,
            "estimated_wait_time": ticket.estimated_wait_time,
            "service_name": service.name if service else "Unknown",
            "service_location": service.location if service else "Unknown",
            "priority": ticket.priority.value,
            "created_at": ticket.created_at.isoformat(),
            "timestamp": datetime.now().isoformat()
        }
        
        await websocket.send_text(json.dumps(initial_state))
        
    except Exception as e:
        logger.error(f"Error sending initial ticket state: {e}")

async def send_initial_dashboard_state(websocket: WebSocket, db: Session):
    """Send the current dashboard state to admin"""
    try:
        # Get all active services with queue info
        services = db.query(Service).filter(Service.status == 'active').all()
        
        dashboard_data = {
            "type": "initial_dashboard_state",
            "stats": {
                "total_waiting": db.query(Ticket).filter(Ticket.status == TicketStatus.WAITING).count(),
                "total_consulting": db.query(Ticket).filter(Ticket.status == TicketStatus.CONSULTING).count(),
                "active_services": len(services),
                "total_completed_today": db.query(Ticket).filter(
                    Ticket.status == TicketStatus.COMPLETED,
                    Ticket.created_at >= datetime.now().date()
                ).count()
            },
            "services": [],
            "connection_stats": connection_manager.get_connection_stats(),
            "timestamp": datetime.now().isoformat()
        }
        
        # Add service details
        for service in services:
            waiting_count = db.query(Ticket).filter(
                Ticket.service_id == service.id,
                Ticket.status == TicketStatus.WAITING
            ).count()
            
            consulting_count = db.query(Ticket).filter(
                Ticket.service_id == service.id,
                Ticket.status == TicketStatus.CONSULTING
            ).count()
            
            dashboard_data["services"].append({
                "id": service.id,
                "name": service.name,
                "location": service.location,
                "waiting_count": waiting_count,
                "consulting_count": consulting_count,
                "avg_wait_time": service.avg_wait_time,
                "priority": service.priority.value,
                "status": service.status.value
            })
        
        await websocket.send_text(json.dumps(dashboard_data))
        
    except Exception as e:
        logger.error(f"Error sending initial dashboard state: {e}")

async def handle_call_next_patient(service_id: str, db: Session):
    """Handle calling the next patient through WebSocket"""
    try:
        # Get next waiting ticket
        next_ticket = db.query(Ticket).filter(
            Ticket.service_id == int(service_id),
            Ticket.status == TicketStatus.WAITING
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).first()
        
        if next_ticket:
            # Update ticket status
            next_ticket.status = TicketStatus.CONSULTING
            next_ticket.consultation_start = datetime.now()
            db.commit()
            
            # Broadcast the update
            await connection_manager.patient_called(service_id, {
                "ticket_number": next_ticket.ticket_number,
                "patient_name": next_ticket.patient.full_name,
                "status": "consulting"
            })
            
            # Update queue positions for remaining patients
            await update_queue_positions_realtime(service_id, db)
            
    except Exception as e:
        logger.error(f"Error handling call next patient: {e}")

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
        
        # Broadcast updates
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