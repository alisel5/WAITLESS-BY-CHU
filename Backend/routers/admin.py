from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List
from datetime import datetime, timedelta
from database import get_db
from models import Ticket, Service, User, Alert, QueueLog, TicketStatus, ServiceStatus
from schemas import DashboardStats, AlertCreate, AlertResponse, PatientCreate, PatientUpdate
from auth import get_admin_user

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get dashboard statistics (Admin only)."""
    # Count tickets by status
    total_waiting = db.query(Ticket).filter(Ticket.status == TicketStatus.WAITING).count()
    total_consulting = db.query(Ticket).filter(Ticket.status == TicketStatus.CONSULTING).count()
    
    # Count active services
    active_services_count = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).count()
    
    # Calculate average wait time across all services
    avg_wait_times = db.query(Service.avg_wait_time).filter(
        and_(Service.avg_wait_time > 0, Service.status == ServiceStatus.ACTIVE)
    ).all()
    
    overall_avg_wait = 0
    if avg_wait_times:
        overall_avg_wait = sum(time[0] for time in avg_wait_times) // len(avg_wait_times)
    
    # Get all services with their current stats
    services = db.query(Service).all()
    
    return DashboardStats(
        total_waiting=total_waiting,
        total_consulting=total_consulting,
        active_services=active_services_count,
        avg_wait_time=overall_avg_wait,
        services=services
    )


@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get system alerts (Admin only)."""
    query = db.query(Alert)
    
    if unread_only:
        query = query.filter(Alert.is_read == False)
    
    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    return alerts


@router.post("/alerts", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    alert: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new alert (Admin only)."""
    db_alert = Alert(**alert.dict())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.patch("/alerts/{alert_id}/read")
async def mark_alert_as_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Mark alert as read (Admin only)."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    alert.is_read = True
    db.commit()
    
    return {"message": "Alert marked as read"}


@router.get("/patients", response_model=List[dict])
async def get_all_patients(
    skip: int = 0,
    limit: int = 100,
    status_filter: str = None,
    service_filter: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all patients with their tickets (Admin only)."""
    query = db.query(Ticket).join(User).join(Service)
    
    if status_filter:
        try:
            status_enum = TicketStatus(status_filter)
            query = query.filter(Ticket.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter"
            )
    
    if service_filter:
        query = query.filter(Ticket.service_id == service_filter)
    
    tickets = query.order_by(Ticket.created_at.desc()).offset(skip).limit(limit).all()
    
    patients_data = []
    for ticket in tickets:
        patient_data = {
            "id": ticket.patient.id,
            "firstName": ticket.patient.full_name.split()[0] if ticket.patient.full_name else "",
            "lastName": " ".join(ticket.patient.full_name.split()[1:]) if len(ticket.patient.full_name.split()) > 1 else "",
            "email": ticket.patient.email,
            "phone": ticket.patient.phone,
            "service": ticket.service.name,
            "status": ticket.status.value,
            "priority": ticket.priority.value,
            "ticket_number": ticket.ticket_number,
            "position": ticket.position_in_queue,
            "wait_time": f"{ticket.estimated_wait_time} min",
            "arrival_time": ticket.created_at.strftime("%H:%M"),
            "notes": ticket.notes
        }
        patients_data.append(patient_data)
    
    return patients_data


@router.post("/patients", status_code=status.HTTP_201_CREATED)
async def create_patient_ticket(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new patient ticket (Admin only)."""
    from auth import get_password_hash
    from routers.tickets import generate_ticket_number, generate_qr_code, calculate_position_and_wait_time
    
    # Find service by name
    service = db.query(Service).filter(Service.name == patient_data.service).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Create or find user
    full_name = f"{patient_data.firstName} {patient_data.lastName}"
    email = f"{patient_data.firstName.lower()}.{patient_data.lastName.lower()}@waitless.chu"
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            hashed_password=get_password_hash("temp123"),
            full_name=full_name,
            phone=patient_data.phone,
            is_active=True
        )
        db.add(user)
        db.flush()
    
    # Generate ticket
    ticket_number = generate_ticket_number()
    position, estimated_wait = calculate_position_and_wait_time(
        service.id, patient_data.priority, db
    )
    qr_code = generate_qr_code(ticket_number)
    
    # Create ticket
    ticket = Ticket(
        ticket_number=ticket_number,
        patient_id=user.id,
        service_id=service.id,
        priority=patient_data.priority,
        position_in_queue=position,
        estimated_wait_time=estimated_wait,
        qr_code=qr_code,
        notes=patient_data.notes
    )
    
    db.add(ticket)
    
    # Update service waiting count
    service.current_waiting += 1
    
    # Log the action
    queue_log = QueueLog(
        ticket_id=ticket.id,
        action="created_by_admin",
        details=f"Patient {full_name} added by admin {current_user.full_name}"
    )
    db.add(queue_log)
    
    db.commit()
    db.refresh(ticket)
    
    return {
        "message": "Patient created successfully",
        "ticket_number": ticket_number,
        "patient_id": user.id
    }


@router.put("/patients/{patient_id}")
async def update_patient(
    patient_id: int,
    patient_update: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update patient information (Admin only)."""
    # Find patient's active ticket
    ticket = db.query(Ticket).filter(
        and_(
            Ticket.patient_id == patient_id,
            Ticket.status.in_([TicketStatus.WAITING, TicketStatus.CONSULTING])
        )
    ).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active ticket not found for this patient"
        )
    
    user = ticket.patient
    
    # Update user information
    if patient_update.firstName or patient_update.lastName:
        first_name = patient_update.firstName or user.full_name.split()[0]
        last_name = patient_update.lastName or " ".join(user.full_name.split()[1:])
        user.full_name = f"{first_name} {last_name}"
    
    if patient_update.phone:
        user.phone = patient_update.phone
    
    # Update ticket information
    if patient_update.service:
        service = db.query(Service).filter(Service.name == patient_update.service).first()
        if service:
            ticket.service_id = service.id
    
    if patient_update.status:
        old_status = ticket.status
        ticket.status = patient_update.status
        
        # Update service waiting count
        if old_status == TicketStatus.WAITING and ticket.status != TicketStatus.WAITING:
            ticket.service.current_waiting = max(0, ticket.service.current_waiting - 1)
        elif old_status != TicketStatus.WAITING and ticket.status == TicketStatus.WAITING:
            ticket.service.current_waiting += 1
    
    if patient_update.priority:
        ticket.priority = patient_update.priority
    
    if patient_update.notes is not None:
        ticket.notes = patient_update.notes
    
    # Log the update
    queue_log = QueueLog(
        ticket_id=ticket.id,
        action="updated_by_admin",
        details=f"Patient information updated by admin {current_user.full_name}"
    )
    db.add(queue_log)
    
    db.commit()
    
    return {"message": "Patient updated successfully"}


@router.delete("/patients/{patient_id}")
async def delete_patient_ticket(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Cancel patient's active ticket (Admin only)."""
    # Find patient's active ticket
    ticket = db.query(Ticket).filter(
        and_(
            Ticket.patient_id == patient_id,
            Ticket.status.in_([TicketStatus.WAITING, TicketStatus.CONSULTING])
        )
    ).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active ticket not found for this patient"
        )
    
    # Update ticket status
    if ticket.status == TicketStatus.WAITING:
        ticket.service.current_waiting = max(0, ticket.service.current_waiting - 1)
    
    ticket.status = TicketStatus.CANCELLED
    
    # Log the cancellation
    queue_log = QueueLog(
        ticket_id=ticket.id,
        action="cancelled_by_admin",
        details=f"Ticket cancelled by admin {current_user.full_name}"
    )
    db.add(queue_log)
    
    db.commit()
    
    return {"message": "Patient ticket cancelled successfully"}


@router.get("/reports/daily")
async def get_daily_report(
    date: str = None,  # Format: YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get daily report of activities (Admin only)."""
    if date:
        try:
            report_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
    else:
        report_date = datetime.now().date()
    
    # Get tickets created on the specified date
    start_datetime = datetime.combine(report_date, datetime.min.time())
    end_datetime = datetime.combine(report_date, datetime.max.time())
    
    tickets = db.query(Ticket).filter(
        and_(
            Ticket.created_at >= start_datetime,
            Ticket.created_at <= end_datetime
        )
    ).all()
    
    # Calculate statistics
    total_tickets = len(tickets)
    completed_tickets = len([t for t in tickets if t.status == TicketStatus.COMPLETED])
    cancelled_tickets = len([t for t in tickets if t.status == TicketStatus.CANCELLED])
    
    # Service breakdown
    service_stats = {}
    for ticket in tickets:
        service_name = ticket.service.name
        if service_name not in service_stats:
            service_stats[service_name] = {
                "total": 0,
                "completed": 0,
                "cancelled": 0,
                "waiting": 0
            }
        
        service_stats[service_name]["total"] += 1
        if ticket.status == TicketStatus.COMPLETED:
            service_stats[service_name]["completed"] += 1
        elif ticket.status == TicketStatus.CANCELLED:
            service_stats[service_name]["cancelled"] += 1
        elif ticket.status == TicketStatus.WAITING:
            service_stats[service_name]["waiting"] += 1
    
    return {
        "date": report_date.isoformat(),
        "total_tickets": total_tickets,
        "completed_tickets": completed_tickets,
        "cancelled_tickets": cancelled_tickets,
        "completion_rate": (completed_tickets / total_tickets * 100) if total_tickets > 0 else 0,
        "service_breakdown": service_stats
    }


@router.get("/logs")
async def get_system_logs(
    skip: int = 0,
    limit: int = 100,
    action_filter: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get system activity logs (Admin only)."""
    query = db.query(QueueLog)
    
    if action_filter:
        query = query.filter(QueueLog.action.ilike(f"%{action_filter}%"))
    
    logs = query.order_by(QueueLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    return {
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "details": log.details,
                "timestamp": log.timestamp,
                "ticket_id": log.ticket_id
            }
            for log in logs
        ],
        "total": query.count()
    } 