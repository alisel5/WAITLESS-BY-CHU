from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import datetime
from database import get_db, reorder_queue_positions_atomic, update_wait_times_atomic
from models import Ticket, Service, TicketStatus, ServicePriority, QueueLog, User
from schemas import QueueStatus, QueuePosition, TicketResponse
from auth import get_admin_user, get_current_active_user, get_staff_user
from notification_service import notification_service

router = APIRouter()


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


@router.get("/department/{department_name}")
async def get_queue_by_department(
    department_name: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_staff_user)
):
    """Get queue status by department name (for secretary interface)."""
    # Find service by name
    service = db.query(Service).filter(Service.name.ilike(f"%{department_name}%")).first()
    if not service:
        # Return empty queue if service not found
        return {
            "service_id": 0,
            "service_name": department_name,
            "total_waiting": 0,
            "avg_wait_time": 0,
            "queue": []
        }
    
    # Use existing queue status logic
    return await get_queue_status(service.id, db)


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
    
    # Check if there are waiting tickets in the service
    waiting_count = db.query(Ticket).filter(
        and_(
            Ticket.service_id == ticket.service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).count()
    
    # AUTO-COMPLETE LOGIC: If ticket is consulting and no waiting patients, auto-complete it
    if ticket.status == TicketStatus.CONSULTING and waiting_count == 0:
        ticket.status = TicketStatus.COMPLETED
        ticket.consultation_end = datetime.utcnow()
        
        # Log the auto-completion
        auto_complete_log = QueueLog(
            ticket_id=ticket.id,
            action="auto_completed_on_status_check",
            details=f"Ticket automatically completed during status check - no waiting patients"
        )
        db.add(auto_complete_log)
        db.commit()
        db.refresh(ticket)
    
    # Determine if ticket should be considered done
    should_show_as_done = (
        ticket.status == TicketStatus.COMPLETED or
        ticket.status == TicketStatus.CANCELLED or
        ticket.status == TicketStatus.EXPIRED
    )
    
    return {
        "ticket_number": ticket.ticket_number,
        "status": ticket.status,
        "position_in_queue": ticket.position_in_queue,
        "estimated_wait_time": ticket.estimated_wait_time,
        "service_name": service.name if service else "Unknown Service",
        "service_id": ticket.service_id,
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
    # Get next waiting ticket
    next_ticket = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).first()
    
    if not next_ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patients waiting in queue"
        )
    
    # Update ticket status to consulting
    next_ticket.status = TicketStatus.CONSULTING
    next_ticket.consultation_start = datetime.utcnow()
    next_ticket.actual_arrival = datetime.utcnow()
    
    # Update service waiting count
    service = db.query(Service).filter(Service.id == service_id).first()
    if service:
        service.current_waiting = max(0, service.current_waiting - 1)
    
    # Log the action
    queue_log = QueueLog(
        ticket_id=next_ticket.id,
        action="called",
        details=f"Patient called for consultation by {current_user.full_name}"
    )
    db.add(queue_log)
    
    # Atomically reorder positions for remaining tickets (faster, race-condition free)
    updated_count = reorder_queue_positions_atomic(service_id, db)
    
    # Update wait times atomically
    avg_wait_time = service.avg_wait_time if service else 15
    update_wait_times_atomic(service_id, avg_wait_time, db)
    
    # Remove AUTO-COMPLETE LOGIC (safety improvement - let admins control completion explicitly)
    
    db.commit()
    db.refresh(next_ticket)
    
    # Send NON-BLOCKING real-time notifications (fire-and-forget)
    notification_service.notify_patient_called(service_id, {
        "ticket_number": next_ticket.ticket_number,
        "patient_name": next_ticket.patient.full_name,
        "status": "consulting",
        "service_id": service_id
    })
    
    # Get updated queue data for notifications (after commit)
    if updated_count > 0:
        remaining_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        queue_data = []
        for ticket in remaining_tickets:
            queue_data.append({
                "position": ticket.position_in_queue,
                "ticket_number": ticket.ticket_number,
                "estimated_wait_time": ticket.estimated_wait_time
            })
        
        notification_service.notify_queue_position_update(service_id, {
            "total_waiting": len(remaining_tickets),
            "queue": queue_data
        })
    
    return {
        "message": "Next patient called successfully",
        "ticket": TicketResponse.from_orm(next_ticket),
        "patient_name": next_ticket.patient.full_name,
        "updated_tickets": updated_count
    }


@router.post("/complete-consultation/{ticket_id}")
async def complete_consultation(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Mark consultation as completed (Admin only)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    if ticket.status != TicketStatus.CONSULTING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket is not in consulting status"
        )
    
    # Update ticket status
    ticket.status = TicketStatus.COMPLETED
    ticket.consultation_end = datetime.utcnow()
    
    # Calculate actual consultation time for service statistics
    if ticket.consultation_start:
        consultation_duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
        
        # Update service average wait time
        service = db.query(Service).filter(Service.id == ticket.service_id).first()
        if service:
            # Simple moving average calculation
            if service.avg_wait_time == 0:
                service.avg_wait_time = int(consultation_duration)
            else:
                service.avg_wait_time = int((service.avg_wait_time + consultation_duration) / 2)
    
    # Log the action
    queue_log = QueueLog(
        ticket_id=ticket.id,
        action="completed",
        details=f"Consultation completed by {current_user.full_name}"
    )
    db.add(queue_log)
    
    db.commit()
    db.refresh(ticket)
    
    return {
        "message": "Consultation marked as completed",
        "ticket": TicketResponse.from_orm(ticket)
    }


@router.get("/statistics/{service_id}")
async def get_queue_statistics(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_staff_user)
):
    """Get queue statistics for a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Get today's statistics
    today = datetime.now().date()
    
    total_waiting = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).count()
    
    completed_today = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.COMPLETED,
            func.date(Ticket.consultation_end) == today
        )
    ).count()
    
    # Calculate average wait time from service
    avg_wait_time = service.avg_wait_time or 15
    
    return {
        "total_waiting": total_waiting,
        "avg_wait_time": avg_wait_time,
        "completed_today": completed_today,
        "service_name": service.name
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
        
        consulting_count = db.query(Ticket).filter(
            and_(Ticket.service_id == service.id, Ticket.status == TicketStatus.CONSULTING)
        ).count()
        
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
    """Reorder queue based on priority and arrival time (Admin only) - ATOMIC VERSION."""
    # Use atomic database operation for reordering (prevents race conditions)
    updated_count = reorder_queue_positions_atomic(service_id, db)
    
    # Get service for wait time calculation
    service = db.query(Service).filter(Service.id == service_id).first()
    if service:
        avg_time = service.avg_wait_time if service.avg_wait_time > 0 else 15
        update_wait_times_atomic(service_id, avg_time, db)
    
    # Log the reordering
    queue_log = QueueLog(
        ticket_id=None,
        action="queue_reordered",
        details=f"Queue reordered by {current_user.full_name} for service {service_id}"
    )
    db.add(queue_log)
    
    db.commit()
    
    # Send non-blocking notification about queue changes
    if updated_count > 0:
        remaining_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        queue_data = []
        for ticket in remaining_tickets:
            queue_data.append({
                "position": ticket.position_in_queue,
                "ticket_number": ticket.ticket_number,
                "estimated_wait_time": ticket.estimated_wait_time
            })
        
        notification_service.notify_queue_position_update(service_id, {
            "type": "queue_reordered",
            "total_waiting": len(remaining_tickets),
            "queue": queue_data,
            "reordered_by": current_user.full_name
        })
    
    return {
        "message": f"Queue reordered successfully. {updated_count} tickets updated.",
        "updated_count": updated_count
    } 