from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
import qrcode
import io
import base64
import json
from datetime import datetime, timedelta
from database import get_db
from models import Ticket, Service, User, TicketStatus, ServicePriority, QueueLog
from schemas import (
    TicketCreate, TicketJoinOnline, TicketUpdate, TicketResponse, 
    TicketSimpleResponse, QRCodeScan, QRScanResponse, UserCreate
)
from auth import get_current_active_user, get_admin_user, get_password_hash

router = APIRouter()


def generate_ticket_number() -> str:
    """Generate unique ticket number."""
    import uuid
    timestamp = datetime.now().strftime("%Y%m%d")
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"T-{timestamp}-{unique_id}"


def generate_qr_code(ticket_number: str) -> str:
    """Generate QR code for ticket."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(ticket_number)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"


def calculate_position_and_wait_time(service_id: int, priority: ServicePriority, db: Session):
    """Calculate position in queue and estimated wait time."""
    # Get current waiting tickets for this service, ordered consistently with queue.py
    waiting_tickets = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
    
    # Simple position calculation: new ticket goes at the end of its priority group
    position = 1
    for i, ticket in enumerate(waiting_tickets, 1):
        if ticket.priority.value < priority.value:
            # New ticket has higher priority, insert before this ticket
            position = i
            break
        else:
            # Continue to next position
            position = i + 1
    
    # Get service avg wait time
    service = db.query(Service).filter(Service.id == service_id).first()
    avg_time_per_patient = service.avg_wait_time if service and service.avg_wait_time > 0 else 15
    
    estimated_wait = (position - 1) * avg_time_per_patient
    
    return position, estimated_wait

async def _update_queue_positions_after_change(service_id: int, db: Session):
    """
    Update queue positions for all waiting tickets after a change.
    This ensures consistency across the queue.
    """
    try:
        # Get all waiting tickets in proper order
        waiting_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        # Update positions
        service = db.query(Service).filter(Service.id == service_id).first()
        avg_time_per_patient = service.avg_wait_time if service and service.avg_wait_time > 0 else 15
        
        queue_data = []
        for i, ticket in enumerate(waiting_tickets, 1):
            ticket.position_in_queue = i
            ticket.estimated_wait_time = (i - 1) * avg_time_per_patient
            queue_data.append({
                "position": i,
                "ticket_number": ticket.ticket_number,
                "estimated_wait_time": ticket.estimated_wait_time
            })
        
        # Update service waiting count to match reality
        if service:
            service.current_waiting = len(waiting_tickets)
        
        db.commit()
        
        # Send real-time updates if websocket_manager is available
        try:
            from websocket_manager import connection_manager
            
            # Send general queue update
            await connection_manager.queue_position_update(str(service_id), {
                "total_waiting": len(waiting_tickets),
                "queue": queue_data
            })
            
            # Send individual ticket updates to each patient
            for ticket in waiting_tickets:
                await connection_manager.ticket_status_update(ticket.ticket_number, {
                    "status": "waiting",
                    "position": ticket.position_in_queue,
                    "estimated_wait_time": ticket.estimated_wait_time,
                    "service_name": service.name if service else "Service",
                    "message": f"Position mise à jour: {ticket.position_in_queue}" + 
                             (f" - C'est votre tour!" if ticket.position_in_queue == 1 else 
                              f" - {ticket.estimated_wait_time} min d'attente estimée")
                })
                
                # Send WhatsApp notification when it's patient's turn (position 1)
                if ticket.position_in_queue == 1:
                    try:
                        from whatsapp_service import notify_patient_turn
                        
                        # Get patient info
                        patient = ticket.patient
                        if patient and patient.phone:
                            # Fire-and-forget notification (non-blocking)
                            notify_patient_turn(
                                phone_number=patient.phone,
                                patient_name=patient.full_name,
                                service_name=service.name if service else "Service"
                            )
                    except Exception as e:
                        # Don't fail the operation if WhatsApp notification fails
                        print(f"WhatsApp notification failed for ticket {ticket.ticket_number}: {e}")
                
        except ImportError:
            # websocket_manager not available, skip notifications
            pass
        except Exception as e:
            # Don't fail the operation if WebSocket notification fails
            print(f"WebSocket notification failed: {e}")
            
    except Exception as e:
        print(f"Error updating queue positions: {e}")


@router.post("/create", response_model=TicketSimpleResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new ticket for authenticated user."""
    # Check if service exists and is active
    service = db.query(Service).filter(Service.id == ticket.service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    if service.status.value != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service is not currently active"
        )
    
    # Check if user already has an active ticket
    existing_ticket = db.query(Ticket).filter(
        and_(
            Ticket.patient_id == current_user.id,
            Ticket.status == TicketStatus.WAITING
        )
    ).first()
    
    if existing_ticket:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active ticket"
        )
    
    # Generate ticket number and calculate position
    ticket_number = generate_ticket_number()
    position, estimated_wait = calculate_position_and_wait_time(
        ticket.service_id, ticket.priority, db
    )
    
    # Generate QR code
    qr_code = generate_qr_code(ticket_number)
    
    # Create ticket
    db_ticket = Ticket(
        ticket_number=ticket_number,
        patient_id=current_user.id,
        service_id=ticket.service_id,
        priority=ticket.priority,
        position_in_queue=position,
        estimated_wait_time=estimated_wait,
        qr_code=qr_code,
        notes=ticket.notes,
        estimated_arrival=ticket.estimated_arrival
    )
    
    db.add(db_ticket)
    
    # Commit to get ticket ID
    db.commit()
    db.refresh(db_ticket)
    
    # Log the action after ticket is committed and has an ID
    queue_log = QueueLog(
        ticket_id=db_ticket.id,
        action="joined",
        details=f"Patient {current_user.full_name} joined queue for {service.name}"
    )
    db.add(queue_log)
    db.commit()
    
    # Update queue positions for all waiting tickets to ensure consistency
    await _update_queue_positions_after_change(ticket.service_id, db)
    
    # Send real-time notification about new patient joining
    try:
        from websocket_manager import connection_manager
        await connection_manager.new_patient_joined(str(ticket.service_id), {
            "ticket_number": ticket_number,
            "patient_name": current_user.full_name,
            "position": position,
            "total_waiting": position  # New patient is at this position
        })
    except Exception as e:
        print(f"WebSocket notification failed for new patient: {e}")
    
    return TicketSimpleResponse(
        ticket_number=ticket_number,
        position_in_queue=position,
        estimated_wait_time=estimated_wait,
        service_name=service.name,
        status=TicketStatus.WAITING,
        qr_code=qr_code
    )


@router.post("/join-online", response_model=TicketSimpleResponse, status_code=status.HTTP_201_CREATED)
async def join_queue_online(ticket_data: TicketJoinOnline, db: Session = Depends(get_db)):
    """Join queue online without registration (creates temporary user)."""
    # Check if service exists
    service = db.query(Service).filter(Service.id == ticket_data.service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    if service.status.value != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service is not currently active"
        )
    
    # Check if user exists or create temporary user
    user = db.query(User).filter(User.email == ticket_data.patient_email).first()
    if not user:
        # Create temporary user
        user = User(
            email=ticket_data.patient_email,
            hashed_password=get_password_hash("temp123"),  # Temporary password
            full_name=ticket_data.patient_name,
            phone=ticket_data.patient_phone,
            is_active=True
        )
        db.add(user)
        db.flush()  # Get the ID
    
    # Check if user already has an active ticket
    existing_ticket = db.query(Ticket).filter(
        and_(
            Ticket.patient_id == user.id,
            Ticket.status == TicketStatus.WAITING
        )
    ).first()
    
    if existing_ticket:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email already has an active ticket"
        )
    
    # Generate ticket and calculate position
    ticket_number = generate_ticket_number()
    position, estimated_wait = calculate_position_and_wait_time(
        ticket_data.service_id, ticket_data.priority, db
    )
    
    # Generate QR code
    qr_code = generate_qr_code(ticket_number)
    
    # Create ticket
    db_ticket = Ticket(
        ticket_number=ticket_number,
        patient_id=user.id,
        service_id=ticket_data.service_id,
        priority=ticket_data.priority,
        position_in_queue=position,
        estimated_wait_time=estimated_wait,
        qr_code=qr_code,
        notes=ticket_data.notes,
        estimated_arrival=ticket_data.estimated_arrival
    )
    
    db.add(db_ticket)
    
    # Commit to get ticket ID
    db.commit()
    db.refresh(db_ticket)
    
    # Log the action after ticket is committed and has an ID
    queue_log = QueueLog(
        ticket_id=db_ticket.id,
        action="joined_online",
        details=f"Patient {ticket_data.patient_name} joined queue online for {service.name}"
    )
    db.add(queue_log)
    db.commit()
    
    # Update queue positions for all waiting tickets to ensure consistency
    await _update_queue_positions_after_change(ticket_data.service_id, db)
    
    return TicketSimpleResponse(
        ticket_number=ticket_number,
        position_in_queue=position,
        estimated_wait_time=estimated_wait,
        service_name=service.name,
        status=TicketStatus.WAITING,
        qr_code=qr_code
    )


@router.post("/scan-to-join", response_model=TicketSimpleResponse, status_code=status.HTTP_201_CREATED)
async def scan_to_join_queue(
    scan_data: QRCodeScan,
    patient_name: str,
    patient_phone: str,
    patient_email: str,
    priority: ServicePriority = ServicePriority.MEDIUM,
    db: Session = Depends(get_db)
):
    """Scan service QR code to automatically join queue."""
    try:
        # Try to parse as JSON (service QR code)
        qr_data = json.loads(scan_data.qr_data)
        
        # Validate it's a service join QR code
        if qr_data.get("type") != "service_join" or qr_data.get("action") != "join_queue":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid QR code for joining queue"
            )
        
        service_id = qr_data.get("service_id")
        if not service_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service ID not found in QR code"
            )
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid QR code format"
        )
    
    # Check if service exists and is active
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    if service.status.value != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service is not currently active"
        )
    
    # Check if user exists or create temporary user
    user = db.query(User).filter(User.email == patient_email).first()
    if not user:
        # Create temporary user
        user = User(
            email=patient_email,
            hashed_password=get_password_hash("temp123"),
            full_name=patient_name,
            phone=patient_phone,
            is_active=True
        )
        db.add(user)
        db.flush()
    
    # Check if user already has an active ticket for this service
    existing_ticket = db.query(Ticket).filter(
        and_(
            Ticket.patient_id == user.id,
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).first()
    
    if existing_ticket:
        # Return existing ticket info
        return TicketSimpleResponse(
            ticket_number=existing_ticket.ticket_number,
            position_in_queue=existing_ticket.position_in_queue,
            estimated_wait_time=existing_ticket.estimated_wait_time,
            service_name=service.name,
            status=existing_ticket.status,
            qr_code=existing_ticket.qr_code
        )
    
    # Generate new ticket
    ticket_number = generate_ticket_number()
    position, estimated_wait = calculate_position_and_wait_time(service_id, priority, db)
    qr_code = generate_qr_code(ticket_number)
    
    # Create ticket
    db_ticket = Ticket(
        ticket_number=ticket_number,
        patient_id=user.id,
        service_id=service_id,
        priority=priority,
        position_in_queue=position,
        estimated_wait_time=estimated_wait,
        qr_code=qr_code,
        notes=f"Joined via service QR scan"
    )
    
    db.add(db_ticket)
    
    # Commit first to get ticket ID
    db.commit()
    db.refresh(db_ticket)
    
    # Log the action after getting ticket ID
    queue_log = QueueLog(
        ticket_id=db_ticket.id,
        action="joined_via_qr_scan",
        details=f"Patient {patient_name} joined queue via QR scan for {service.name}"
    )
    db.add(queue_log)
    db.commit()
    
    # Update queue positions for all waiting tickets to ensure consistency
    await _update_queue_positions_after_change(qr_data["service_id"], db)
    
    return TicketSimpleResponse(
        ticket_number=ticket_number,
        position_in_queue=position,
        estimated_wait_time=estimated_wait,
        service_name=service.name,
        status=TicketStatus.WAITING,
        qr_code=qr_code
    )


@router.post("/scan", response_model=QRScanResponse)
async def scan_qr_code(qr_data: QRCodeScan, db: Session = Depends(get_db)):
    """Process QR code scan - handles both ticket QR codes and service QR codes."""
    try:
        # Try to parse as JSON first (service QR code)
        parsed_data = json.loads(qr_data.qr_data)
        
        if parsed_data.get("type") == "service_join":
            # This is a service QR code - return service info for joining
            service_id = parsed_data.get("service_id")
            service = db.query(Service).filter(Service.id == service_id).first()
            
            if not service:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Service not found"
                )
            
            # Enhanced validation for security
            action = parsed_data.get("action")
            if action != "join_queue":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid QR code action"
                )
            
            # Validate timestamp (optional, for enhanced security)
            timestamp_str = parsed_data.get("timestamp")
            if timestamp_str:
                try:
                    from datetime import datetime, timedelta
                    qr_timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    current_time = datetime.utcnow()
                    
                    # QR code is valid for 24 hours
                    if (current_time - qr_timestamp) > timedelta(hours=24):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="QR code has expired"
                        )
                except (ValueError, TypeError):
                    # If timestamp parsing fails, continue (backward compatibility)
                    pass
            
            # Validate service is active
            if service.status.value != "active":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Service is not currently active"
                )
            
            return QRScanResponse(
                type="service_join",
                service_id=service.id,
                service_name=service.name,
                location=service.location,
                current_waiting=service.current_waiting,
                avg_wait_time=service.avg_wait_time,
                message=f"Scan successful! Ready to join queue for {service.name}"
            )
    
    except json.JSONDecodeError:
        # Not JSON, treat as ticket number
        pass
    
    # Try as ticket number
    ticket_number = qr_data.qr_data.strip()
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid QR code - neither valid service nor ticket"
        )
    
    # Get service info
    service = db.query(Service).filter(Service.id == ticket.service_id).first()
    
    return QRScanResponse(
        type="ticket_status",
        ticket_number=ticket.ticket_number,
        position_in_queue=ticket.position_in_queue,
        estimated_wait_time=ticket.estimated_wait_time,
        service_name=service.name if service else "Unknown Service",
        status=ticket.status,
        qr_code=ticket.qr_code
    )


@router.get("/my-tickets", response_model=List[TicketResponse])
async def get_my_tickets(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's tickets."""
    tickets = db.query(Ticket).filter(Ticket.patient_id == current_user.id).all()
    return tickets


@router.get("/{ticket_number}", response_model=TicketResponse)
async def get_ticket_by_number(ticket_number: str, db: Session = Depends(get_db)):
    """Get ticket details by ticket number."""
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    return ticket


@router.patch("/{ticket_id}/status", response_model=TicketResponse)
async def update_ticket_status(
    ticket_id: int,
    ticket_update: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update ticket status (Admin only)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    old_status = ticket.status
    
    # Update ticket
    if ticket_update.status:
        ticket.status = ticket_update.status
        
        # Update timestamps based on status
        if ticket_update.status == TicketStatus.COMPLETED:
            ticket.consultation_start = datetime.utcnow()
            ticket.consultation_end = datetime.utcnow()
    
    if ticket_update.priority:
        ticket.priority = ticket_update.priority
    
    if ticket_update.notes is not None:
        ticket.notes = ticket_update.notes
    
    # Log the action
    queue_log = QueueLog(
        ticket_id=ticket.id,
        action=f"status_changed_to_{ticket.status.value}",
        details=f"Status changed from {old_status.value} to {ticket.status.value} by {current_user.full_name}"
    )
    db.add(queue_log)
    
    db.commit()
    db.refresh(ticket)
    
    # Update queue positions if status change affects the queue
    if (old_status == TicketStatus.WAITING or ticket.status == TicketStatus.WAITING or 
        (ticket_update.priority and old_status == TicketStatus.WAITING)):
        await _update_queue_positions_after_change(ticket.service_id, db)
    
    return ticket


@router.delete("/{ticket_id}")
async def cancel_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancel/delete a ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check if user owns the ticket or is admin
    if ticket.patient_id != current_user.id and current_user.role.value not in ["admin", "doctor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Log the cancellation
    queue_log = QueueLog(
        ticket_id=ticket.id,
        action="cancelled",
        details=f"Ticket cancelled by {current_user.full_name}"
    )
    db.add(queue_log)
    
    # Mark as cancelled instead of deleting
    was_waiting = ticket.status == TicketStatus.WAITING
    service_id = ticket.service_id
    ticket.status = TicketStatus.CANCELLED
    
    db.commit()
    
    # Update queue positions if a waiting ticket was cancelled
    if was_waiting:
        await _update_queue_positions_after_change(service_id, db)
    
    return {"message": "Ticket cancelled successfully"} 