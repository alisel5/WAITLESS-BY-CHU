from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import Ticket, Service, TicketStatus, ServicePriority, QueueLog, User
from schemas import QueueStatus, QueuePosition, TicketResponse
from auth import get_admin_user, get_current_active_user
from websocket_manager import connection_manager
import asyncio

router = APIRouter()

# Lock to prevent race conditions when calling next patient
_call_next_lock = asyncio.Lock()

async def _call_next_patient_atomic(service_id: int, db: Session, admin_user: User = None) -> dict:
    """
    Atomic function to call the next patient with proper locking.
    This prevents multiple simultaneous calls from both REST API and WebSocket.
    """
    async with _call_next_lock:
        # Get next waiting ticket with a fresh query inside the lock
        next_ticket = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).first()
        
        if not next_ticket:
            return {
                "success": False,
                "error": "No patients waiting in queue",
                "code": 404
            }
        
        # Update ticket status to completed (simplified flow: WAITING -> COMPLETED)
        next_ticket.status = TicketStatus.COMPLETED
        next_ticket.consultation_start = datetime.utcnow()
        next_ticket.consultation_end = datetime.utcnow()
        next_ticket.actual_arrival = datetime.utcnow()
        
        # Update service waiting count
        service = db.query(Service).filter(Service.id == service_id).first()
        if service:
            service.current_waiting = max(0, service.current_waiting - 1)
        
        # Log the action (include admin info if available)
        admin_name = admin_user.full_name if admin_user else "System"
        queue_log = QueueLog(
            ticket_id=next_ticket.id,
            action="called_and_completed",
            details=f"Patient called and marked as completed by {admin_name}"
        )
        db.add(queue_log)
        
        # Update positions for remaining tickets
        remaining_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        for i, ticket in enumerate(remaining_tickets, 1):
            ticket.position_in_queue = i
            # Recalculate estimated wait time
            ticket.estimated_wait_time = (i - 1) * (service.avg_wait_time if service else 15)
        
        # Note: Auto-completion removed to allow proper consultation flow
        # Tickets should be manually completed by admin when consultation is done
        auto_completed = False
        
        # Commit all changes atomically
        db.commit()
        db.refresh(next_ticket)
        
        # Send real-time WebSocket notifications
        try:
            # Notify about patient being called and completed
            await connection_manager.patient_called(str(service_id), {
                "ticket_number": next_ticket.ticket_number,
                "patient_name": next_ticket.patient.full_name,
                "status": "completed",
                "service_id": service_id
            })
            
            # Notify about queue position updates
            if remaining_tickets:
                queue_data = []
                for ticket in remaining_tickets:
                    queue_data.append({
                        "position": ticket.position_in_queue,
                        "ticket_number": ticket.ticket_number,
                        "estimated_wait_time": ticket.estimated_wait_time
                    })
                
                await connection_manager.queue_position_update(str(service_id), {
                    "total_waiting": len(remaining_tickets),
                    "queue": queue_data
                })
        except Exception as e:
            # Don't fail the operation if WebSocket notification fails
            print(f"WebSocket notification failed: {e}")
        
        return {
            "success": True,
            "ticket": next_ticket,
            "patient_name": next_ticket.patient.full_name,
            "auto_completed": auto_completed,
            "remaining_count": len(remaining_tickets)
        }


@router.get("/service/{service_id}", response_model=QueueStatus)
async def get_queue_status(service_id: int, db: Session = Depends(get_db)):
    """Get current queue status for a service."""
    # Check if service exists
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Get waiting tickets ordered by priority and creation time
    waiting_tickets = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
    
    # Build queue positions
    queue_positions = []
    for i, ticket in enumerate(waiting_tickets, 1):
        queue_positions.append(QueuePosition(
            ticket_number=ticket.ticket_number,
            position=i,
            estimated_wait_time=ticket.estimated_wait_time
        ))
        
        # Update position in database
        ticket.position_in_queue = i
    
    # Calculate average wait time
    avg_wait_time = 0
    if waiting_tickets:
        total_wait = sum(ticket.estimated_wait_time for ticket in waiting_tickets)
        avg_wait_time = total_wait // len(waiting_tickets)
    
    db.commit()
    
    return QueueStatus(
        service_id=service_id,
        service_name=service.name,
        total_waiting=len(waiting_tickets),
        avg_wait_time=avg_wait_time,
        queue=queue_positions
    )


@router.get("/my-position", response_model=Optional[QueuePosition])
async def get_my_position(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's position in queue."""
    # Find user's active ticket
    ticket = db.query(Ticket).filter(
        and_(
            Ticket.patient_id == current_user.id,
            Ticket.status == TicketStatus.WAITING
        )
    ).first()
    
    if not ticket:
        return None
    
    return QueuePosition(
        ticket_number=ticket.ticket_number,
        position=ticket.position_in_queue,
        estimated_wait_time=ticket.estimated_wait_time
    )


@router.get("/ticket-status/{ticket_number}")
async def get_ticket_status_with_queue_info(
    ticket_number: str,
    db: Session = Depends(get_db)
):
    """Get ticket status with additional queue information."""
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Get service info
    service = db.query(Service).filter(Service.id == ticket.service_id).first()
    
    # Check if this patient should be automatically completed
    should_show_as_done = False
    
    # Get waiting count for the service
    waiting_count = db.query(Ticket).filter(
        and_(
            Ticket.service_id == ticket.service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).count()
    
    # Note: Auto-completion logic removed to allow proper consultation flow
    # Consulting tickets should remain consulting until manually completed by admin
    should_show_as_done = (
        ticket.status == TicketStatus.COMPLETED or
        ticket.status == TicketStatus.CANCELLED or
        ticket.status == TicketStatus.EXPIRED
    )
    
    return {
        "ticket_number": ticket.ticket_number,
        "patient_name": ticket.patient.full_name,
        "service_name": service.name if service else "Unknown",
        "status": ticket.status.value,
        "created_at": ticket.created_at,
        "estimated_wait_time": ticket.estimated_wait_time,
        "position_in_queue": ticket.position_in_queue,
        "consultation_start": ticket.consultation_start,
        "consultation_end": ticket.consultation_end,
        "waiting_count": waiting_count,
        "should_show_as_done": should_show_as_done,
        "created_at": ticket.created_at
    }


@router.post("/call-next/{service_id}")
async def call_next_patient(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Call the next patient in queue (Admin only)."""
    result = await _call_next_patient_atomic(service_id, db, current_user)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result["code"],
            detail=result["error"]
        )
    
    return {
        "message": "Next patient called and completed successfully",
        "ticket": TicketResponse.from_orm(result["ticket"]),
        "patient_name": result["patient_name"],
        "auto_completed": result["auto_completed"]
    }


# Note: Complete consultation endpoint removed since we now use simplified WAITING -> COMPLETED flow
# The call_next_patient endpoint now handles both calling and completing in one step

@router.get("/statistics/{service_id}")
async def get_queue_statistics(
    service_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed queue statistics for a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Get ticket counts by status
    total_tickets = db.query(Ticket).filter(Ticket.service_id == service_id).count()
    waiting_count = db.query(Ticket).filter(
        and_(Ticket.service_id == service_id, Ticket.status == TicketStatus.WAITING)
    ).count()
    # Note: No more consulting status in simplified flow
    consulting_count = 0
    completed_count = db.query(Ticket).filter(
        and_(Ticket.service_id == service_id, Ticket.status == TicketStatus.COMPLETED)
    ).count()
    cancelled_count = db.query(Ticket).filter(
        and_(Ticket.service_id == service_id, Ticket.status == TicketStatus.CANCELLED)
    ).count()
    
    # Get priority breakdown
    high_priority = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.priority == ServicePriority.HIGH,
            Ticket.status == TicketStatus.WAITING
        )
    ).count()
    
    medium_priority = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.priority == ServicePriority.MEDIUM,
            Ticket.status == TicketStatus.WAITING
        )
    ).count()
    
    low_priority = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.priority == ServicePriority.LOW,
            Ticket.status == TicketStatus.WAITING
        )
    ).count()
    
    return {
        "service_id": service_id,
        "service_name": service.name,
        "total_tickets": total_tickets,
        "waiting_count": waiting_count,
        "consulting_count": consulting_count,
        "completed_count": completed_count,
        "cancelled_count": cancelled_count,
        "avg_wait_time": service.avg_wait_time,
        "priority_breakdown": {
            "high": high_priority,
            "medium": medium_priority,
            "low": low_priority
        }
    }


@router.get("/all-services")
async def get_all_queues_overview(db: Session = Depends(get_db)):
    """Get overview of all service queues."""
    services = db.query(Service).all()
    
    overview = []
    for service in services:
        waiting_count = db.query(Ticket).filter(
            and_(Ticket.service_id == service.id, Ticket.status == TicketStatus.WAITING)
        ).count()
        
        # Note: No more consulting status in simplified flow
        consulting_count = 0
        
        overview.append({
            "service_id": service.id,
            "service_name": service.name,
            "status": service.status.value,
            "waiting_count": waiting_count,
            "consulting_count": consulting_count,
            "avg_wait_time": service.avg_wait_time,
            "location": service.location
        })
    
    return {
        "services": overview,
        "total_waiting": sum(s["waiting_count"] for s in overview),
        "total_consulting": sum(s["consulting_count"] for s in overview)
    }


@router.post("/reorder-queue/{service_id}")
async def reorder_queue(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Reorder queue based on priority and arrival time (Admin only)."""
    # Get all waiting tickets for the service
    waiting_tickets = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
    
    # Update positions
    for i, ticket in enumerate(waiting_tickets, 1):
        ticket.position_in_queue = i
        # Recalculate estimated wait time
        service = db.query(Service).filter(Service.id == service_id).first()
        avg_time = service.avg_wait_time if service and service.avg_wait_time > 0 else 15
        ticket.estimated_wait_time = (i - 1) * avg_time
    
    # Log the reordering
    queue_log = QueueLog(
        ticket_id=None,
        action="queue_reordered",
        details=f"Queue reordered by {current_user.full_name} for service {service_id}"
    )
    db.add(queue_log)
    
    db.commit()
    
    return {
        "message": f"Queue reordered successfully. {len(waiting_tickets)} tickets updated.",
        "updated_count": len(waiting_tickets)
    } 