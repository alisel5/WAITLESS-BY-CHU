from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional, Dict, Any
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
    img.save(buffer, "PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"


def calculate_position_and_wait_time(service_id: int, priority: ServicePriority, db: Session) -> tuple[int, int]:
    """Calculate position in queue and estimated wait time."""
    # Get current waiting tickets for this service
    waiting_tickets = db.query(Ticket).filter(
        and_(
            Ticket.service_id == service_id,
            Ticket.status == TicketStatus.WAITING
        )
    ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
    
    # Calculate position based on priority
    position = len(waiting_tickets) + 1
    
    # Get service avg wait time
    service = db.query(Service).filter(Service.id == service_id).first()
    avg_time_per_patient = service.avg_wait_time if service and service.avg_wait_time > 0 else 15
    
    estimated_wait = (position - 1) * avg_time_per_patient
    
    return position, estimated_wait


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
            Ticket.status.in_([TicketStatus.WAITING, TicketStatus.CONSULTING])
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
        notes="Joined via service QR scan"
    )
    
    db.add(db_ticket)
    
    # Update service waiting count
    service.current_waiting = service.current_waiting + 1
    
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
    
    # Log the action after ticket is committed
    queue_log = QueueLog(
        ticket_id=db_ticket.id,
        action="joined_via_qr_scan",
        details=f"Patient {patient_name} joined queue via QR scan for {service.name}"
    )
    db.add(queue_log)
    db.commit()
    
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
            
            return {
                "type": "service_join",
                "service_id": service.id,
                "service_name": service.name,
                "location": service.location,
                "current_waiting": service.current_waiting,
                "avg_wait_time": service.avg_wait_time,
                "message": f"Scan successful! Ready to join queue for {service.name}"
            }
    
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
    
    return {
        "type": "ticket",
        "ticket_number": ticket.ticket_number,
        "position_in_queue": ticket.position_in_queue,
        "estimated_wait_time": ticket.estimated_wait_time,
        "service_name": service.name if service else "Unknown Service",
        "status": ticket.status.value,
        "qr_code": ticket.qr_code
    } 