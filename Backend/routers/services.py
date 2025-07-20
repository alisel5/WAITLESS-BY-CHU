from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import qrcode
import io
import base64
import json
from database import get_db
from models import Service, User
from schemas import ServiceCreate, ServiceUpdate, ServiceResponse
from auth import get_admin_user

router = APIRouter()


def generate_service_qr_code(service_id: int, service_name: str) -> str:
    """Generate QR code for service that users can scan to join queue."""
    # Add timestamp for validation
    from datetime import datetime
    
    # Create service join data with enhanced security
    service_data = {
        "type": "service_join",
        "service_id": service_id,
        "service_name": service_name,
        "action": "join_queue",
        "timestamp": datetime.utcnow().isoformat(),
        "validation_key": f"waitless_qr_{service_id}_{service_name.lower().replace(' ', '_')}"
    }
    
    # Convert to JSON string
    qr_data = json.dumps(service_data)
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"


@router.get("/", response_model=List[ServiceResponse])
async def get_all_services(db: Session = Depends(get_db)):
    """Get all medical services."""
    services = db.query(Service).all()
    return services


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(service_id: int, db: Session = Depends(get_db)):
    """Get a specific service by ID."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    return service


@router.get("/{service_id}/qr-code")
async def get_service_qr_code(service_id: int, db: Session = Depends(get_db)):
    """Get QR code for service that users can scan to join queue."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    if service.status.value != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate QR code for inactive service"
        )
    
    qr_code = generate_service_qr_code(service.id, service.name)
    
    return {
        "service_id": service.id,
        "service_name": service.name,
        "qr_code": qr_code,
        "scan_instructions": "Scan this QR code to join the queue for this service",
        "location": service.location
    }


@router.post("/", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    service: ServiceCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new medical service (Admin only)."""
    # Check if service name already exists
    existing_service = db.query(Service).filter(Service.name == service.name).first()
    if existing_service:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service with this name already exists"
        )
    
    db_service = Service(**service.dict())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service


@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    service_update: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update a service (Admin only)."""
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Update only provided fields
    update_data = service_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_service, field, value)
    
    db.commit()
    db.refresh(db_service)
    return db_service


@router.delete("/{service_id}")
async def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete a service (Admin only)."""
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Check if service has active tickets
    from models import Ticket, TicketStatus
    active_tickets = db.query(Ticket).filter(
        Ticket.service_id == service_id,
        Ticket.status == TicketStatus.WAITING
    ).count()
    
    if active_tickets > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete service with active tickets"
        )
    
    db.delete(db_service)
    db.commit()
    return {"message": "Service deleted successfully"}


@router.get("/active/list", response_model=List[ServiceResponse])
async def get_active_services(db: Session = Depends(get_db)):
    """Get all active services."""
    from models import ServiceStatus
    services = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).all()
    return services


@router.get("/active/with-qr")
async def get_active_services_with_qr(db: Session = Depends(get_db)):
    """Get all active services with their QR codes."""
    from models import ServiceStatus
    services = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).all()
    
    services_with_qr = []
    for service in services:
        qr_code = generate_service_qr_code(service.id, service.name)
        service_data = {
            "id": service.id,
            "name": service.name,
            "description": service.description,
            "location": service.location,
            "priority": service.priority.value,
            "current_waiting": service.current_waiting,
            "avg_wait_time": service.avg_wait_time,
            "qr_code": qr_code
        }
        services_with_qr.append(service_data)
    
    return {"services": services_with_qr}


@router.patch("/{service_id}/status")
async def toggle_service_status(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Toggle service status between active and inactive."""
    from models import ServiceStatus
    
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Toggle status
    if db_service.status == ServiceStatus.ACTIVE:
        db_service.status = ServiceStatus.INACTIVE
    else:
        db_service.status = ServiceStatus.ACTIVE
    
    db.commit()
    db.refresh(db_service)
    
    return {
        "message": f"Service status updated to {db_service.status.value}",
        "service": ServiceResponse.from_orm(db_service)
    }


@router.get("/stats/{service_id}")
async def get_service_stats(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get service statistics."""
    from models import Ticket, TicketStatus
    
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Calculate statistics
    total_tickets = db.query(Ticket).filter(Ticket.service_id == service_id).count()
    waiting_tickets = db.query(Ticket).filter(
        Ticket.service_id == service_id,
        Ticket.status == TicketStatus.WAITING
    ).count()
    completed_tickets = db.query(Ticket).filter(
        Ticket.service_id == service_id,
        Ticket.status == TicketStatus.COMPLETED
    ).count()
    
    return {
        "service_id": service_id,
        "service_name": service.name,
        "total_tickets": total_tickets,
        "waiting_tickets": waiting_tickets,
        "completed_tickets": completed_tickets,
        "current_waiting": service.current_waiting,
        "avg_wait_time": service.avg_wait_time
    } 