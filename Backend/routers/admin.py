from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List
from database import get_db
from models import User, Service, Ticket, TicketStatus, ServiceStatus
from schemas import UserResponse, ServiceResponse
from auth import get_admin_user, get_admin_or_staff_user
from models import UserRole
from models import ServicePriority
from models import QueueLog

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics for admin/staff."""
    try:
        # Get total waiting tickets
        total_waiting = db.query(Ticket).filter(Ticket.status == TicketStatus.WAITING).count()
        
        # Get average wait time (in minutes) - using estimated_wait_time instead of wait_time
        avg_wait_time = db.query(func.avg(Ticket.estimated_wait_time)).scalar() or 0
        avg_wait_time = int(avg_wait_time) if avg_wait_time else 0
        
        # Get active services count
        active_services = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).count()
        
        # Get today's tickets
        today = datetime.now().date()
        today_tickets = db.query(Ticket).filter(
            func.date(Ticket.created_at) == today
        ).count()
        
        # Get recent alerts (tickets waiting more than 2 hours) - using estimated_wait_time
        long_waiting = db.query(Ticket).filter(
            and_(
                Ticket.status == TicketStatus.WAITING,
                Ticket.estimated_wait_time > 120  # 2 hours
            )
        ).count()
        
        # Get active services with their queue information for the frontend
        active_services_data = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).all()
        services = []
        
        for service in active_services_data:
            # Count waiting tickets for this service
            waiting_count = db.query(Ticket).filter(
                and_(
                    Ticket.service_id == service.id,
                    Ticket.status == TicketStatus.WAITING
                )
            ).count()
            
            # Calculate average wait time for this service
            service_avg_wait = db.query(func.avg(Ticket.estimated_wait_time)).filter(
                and_(
                    Ticket.service_id == service.id,
                    Ticket.status == TicketStatus.WAITING
                )
            ).scalar() or 0
            service_avg_wait = int(service_avg_wait) if service_avg_wait else 0
            
            services.append({
                "id": service.id,
                "name": service.name,
                "location": service.location,
                "current_waiting": waiting_count,
                "avg_wait_time": service_avg_wait,
                "status": service.status.value,
                "priority": service.priority.value if service.priority else "medium"
            })
        
        return {
            "total_waiting": total_waiting,
            "avg_wait_time": avg_wait_time,
            "active_services": active_services,
            "today_tickets": today_tickets,
            "long_waiting_alerts": long_waiting,
            "total_patients": total_waiting,
            "services": services  # Add the services array for the frontend
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting dashboard stats: {str(e)}"
        )


@router.get("/patients")
async def get_patients(
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get all patients with their ticket information."""
    try:
        # Get all tickets with patient information
        tickets = db.query(Ticket).all()
        
        patients = []
        for ticket in tickets:
            # Calculate wait time in minutes
            if ticket.created_at is not None:
                wait_time = int((datetime.now() - ticket.created_at).total_seconds() / 60)
            else:
                wait_time = 0
            
            patient_data = {
                "id": ticket.id,
                "name": ticket.patient.full_name if ticket.patient else "Patient inconnu",
                "service": ticket.service.name if ticket.service else "Service inconnu",
                "status": ticket.status.value,
                "arrival_time": ticket.created_at.isoformat() if ticket.created_at is not None else None,
                "wait_time": wait_time,
                "priority": ticket.priority.value if ticket.priority else "medium",
                "phone": ticket.patient.phone if ticket.patient else None,
                "notes": f"Ticket: {ticket.ticket_number}"
            }
            patients.append(patient_data)
        
        return patients
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting patients: {str(e)}"
        )


@router.post("/patients")
async def create_patient(
    patient_data: dict,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new patient ticket."""
    try:
        # Find the service
        service = db.query(Service).filter(Service.name == patient_data.get("service")).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service not found"
            )
        
        # Create or find user for the patient
        patient_email = patient_data.get("email")
        if not patient_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for patient"
            )
        
        # Check if user exists, if not create one
        user = db.query(User).filter(User.email == patient_email).first()
        if not user:
            # Create new user for the patient
            from auth import get_password_hash
            full_name = f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}".strip()
            hashed_password = get_password_hash("patient123")  # Default password
            
            user = User(
                email=patient_email,
                hashed_password=hashed_password,
                full_name=full_name,
                phone=patient_data.get("phone"),
                role="patient"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Create ticket for the patient
        ticket = Ticket(
            patient_id=user.id,
            service_id=service.id,
            priority=patient_data.get("priority", "medium"),
            status=TicketStatus.WAITING
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        return {
            "id": ticket.id,
            "message": "Patient created successfully",
            "ticket_number": ticket.ticket_number
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating patient: {str(e)}"
        )


@router.put("/patients/{patient_id}")
async def update_patient(
    patient_id: int,
    patient_data: dict,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Update a patient ticket."""
    try:
        ticket = db.query(Ticket).filter(Ticket.id == patient_id).first()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Update patient user information
        if ticket.patient is not None:
            if "first_name" in patient_data or "last_name" in patient_data:
                first_name = patient_data.get("first_name", "")
                last_name = patient_data.get("last_name", "")
                ticket.patient.full_name = f"{first_name} {last_name}".strip()
            
            if "phone" in patient_data:
                ticket.patient.phone = patient_data["phone"]
        
        # Update ticket fields
        if "status" in patient_data:
            ticket.status = TicketStatus(patient_data["status"])
        
        if "priority" in patient_data:
            ticket.priority = patient_data["priority"]
        
        db.commit()
        db.refresh(ticket)
        
        return {
            "id": ticket.id,
            "message": "Patient updated successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating patient: {str(e)}"
        )


@router.delete("/patients/{patient_id}")
async def delete_patient(
    patient_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a patient ticket."""
    try:
        ticket = db.query(Ticket).filter(Ticket.id == patient_id).first()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        db.delete(ticket)
        db.commit()
        
        return {"message": "Patient deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting patient: {str(e)}"
        )


@router.get("/alerts")
async def get_alerts(
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get system alerts."""
    try:
        alerts = []
        
        # Long waiting tickets - using estimated_wait_time
        long_waiting = db.query(Ticket).filter(
            and_(
                Ticket.status == TicketStatus.WAITING,
                Ticket.estimated_wait_time > 120  # 2 hours
            )
        ).all()
        
        for ticket in long_waiting:
            patient_name = ticket.patient.full_name if ticket.patient is not None else "Patient inconnu"
            alerts.append({
                "type": "long_waiting",
                "message": f"Patient {patient_name} attend depuis {ticket.estimated_wait_time} minutes",
                "ticket_id": ticket.id,
                "severity": "high"
            })
        
        # Services with many waiting patients
        services = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).all()
        for service in services:
            waiting_count = db.query(Ticket).filter(
                and_(
                    Ticket.service_id == service.id,
                    Ticket.status == TicketStatus.WAITING
                )
            ).count()
            
            if waiting_count > 20:  # Alert if more than 20 waiting
                alerts.append({
                    "type": "high_queue",
                    "message": f"Service {service.name} a {waiting_count} patients en attente",
                    "service_id": service.id,
                    "severity": "medium"
                })
        
        return alerts
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting alerts: {str(e)}"
        )


@router.get("/reports/daily")
async def get_daily_reports(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get daily reports for the last 7 days."""
    try:
        reports = []
        
        for i in range(7):
            date = datetime.now().date() - timedelta(days=i)
            
            # Get tickets for this date
            day_tickets = db.query(Ticket).filter(
                func.date(Ticket.created_at) == date
            ).all()
            
            # Calculate statistics - using estimated_wait_time
            total_tickets = len(day_tickets)
            completed_tickets = len([t for t in day_tickets if t.status == TicketStatus.COMPLETED])
            avg_wait_time = sum(t.estimated_wait_time for t in day_tickets) / len(day_tickets) if day_tickets else 0
            
            reports.append({
                "date": date.strftime("%Y-%m-%d"),
                "total_tickets": total_tickets,
                "completed_tickets": completed_tickets,
                "avg_wait_time": int(avg_wait_time) if avg_wait_time else 0,
                "completion_rate": (completed_tickets / total_tickets * 100) if total_tickets > 0 else 0
            })
        
        return reports
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting daily reports: {str(e)}"
        )


# SECRETARY-SPECIFIC ENDPOINTS FOR DEPARTMENT-BASED OPERATIONS

@router.get("/secretary/queue/{service_id}")
async def get_department_queue(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get queue for a specific service/department (for secretaries)."""
    try:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get waiting tickets for this service
        waiting_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        queue_data = []
        for ticket in waiting_tickets:
            queue_data.append({
                "id": ticket.id,
                "ticket_number": ticket.ticket_number,
                "name": ticket.patient.full_name if ticket.patient else "Patient inconnu",
                "phone": ticket.patient.phone if ticket.patient else "",
                "reason": ticket.notes or "Consultation",
                "priority": ticket.priority.value,
                "status": ticket.status.value,
                "created_at": ticket.created_at.isoformat(),
                "position": ticket.position_in_queue,
                "estimated_wait_time": ticket.estimated_wait_time,
                "source": "app"  # Default source
            })
        
        return queue_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting queue: {str(e)}"
        )


@router.get("/secretary/patients/{service_id}")
async def get_department_patients(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get all patients for a specific service/department (for secretaries)."""
    try:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get all tickets for this service from today
        today = datetime.now().date()
        tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                func.date(Ticket.created_at) == today
            )
        ).order_by(Ticket.created_at.desc()).all()
        
        patients_data = []
        for ticket in tickets:
            patients_data.append({
                "id": ticket.id,
                "name": ticket.patient.full_name if ticket.patient else "Patient inconnu",
                "phone": ticket.patient.phone if ticket.patient else "",
                "ticket_number": ticket.ticket_number,
                "reason": ticket.notes or "Consultation",
                "priority": ticket.priority.value,
                "status": ticket.status.value,
                "created_at": ticket.created_at.isoformat(),
                "age": None,  # Not stored in current model
                "gender": None,  # Not stored in current model
                "source": "app"  # Default source
            })
        
        return patients_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting patients: {str(e)}"
        )


@router.get("/secretary/stats/{service_id}")
async def get_department_stats(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get statistics for a specific service/department (for secretaries)."""
    try:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get today's tickets
        today = datetime.now().date()
        
        total_patients = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                func.date(Ticket.created_at) == today
            )
        ).count()
        
        completed_today = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.COMPLETED,
                func.date(Ticket.created_at) == today
            )
        ).count()
        
        # Calculate average wait time
        avg_wait_time = db.query(func.avg(Ticket.estimated_wait_time)).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).scalar() or 0
        
        return {
            "total_patients": total_patients,
            "completed_today": completed_today,
            "avg_wait_time": int(avg_wait_time) if avg_wait_time else 0
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting stats: {str(e)}"
        )


@router.post("/secretary/patients/{ticket_id}/call")
async def call_patient_by_secretary(
    ticket_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Call a specific patient (secretary action)."""
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        if ticket.status != TicketStatus.WAITING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient is not waiting"
            )
        
        # Mark as completed (simplified flow)
        ticket.status = TicketStatus.COMPLETED
        ticket.consultation_start = datetime.utcnow()
        ticket.consultation_end = datetime.utcnow()
        
        # Log the action
        queue_log = QueueLog(
            ticket_id=ticket.id,
            action="called_by_secretary",
            details=f"Patient called by secretary {current_user.full_name}"
        )
        db.add(queue_log)
        
        db.commit()
        
        # Update queue positions for remaining tickets
        from routers.queue import _call_next_patient_atomic
        # Just update positions without calling the atomic function
        remaining_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == ticket.service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        for i, remaining_ticket in enumerate(remaining_tickets, 1):
            remaining_ticket.position_in_queue = i
        
        db.commit()
        
        return {"message": "Patient called successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calling patient: {str(e)}"
        )


@router.post("/secretary/patients/{ticket_id}/complete")
async def complete_patient_consultation(
    ticket_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Complete a patient consultation (secretary action)."""
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Mark as completed
        ticket.status = TicketStatus.COMPLETED
        ticket.consultation_end = datetime.utcnow()
        
        # Log the action
        queue_log = QueueLog(
            ticket_id=ticket.id,
            action="completed_by_secretary",
            details=f"Consultation completed by secretary {current_user.full_name}"
        )
        db.add(queue_log)
        
        db.commit()
        
        return {"message": "Consultation completed successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing consultation: {str(e)}"
        )


@router.post("/secretary/patients")
async def create_patient_for_secretary(
    patient_data: dict,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Create a new patient ticket (secretary action)."""
    try:
        # Get user's assigned service or use provided service
        service_id = patient_data.get("service_id")
        if not service_id and current_user.assigned_service_id:
            service_id = current_user.assigned_service_id
        
        if not service_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service ID required"
            )
        
        # Find or create user for the patient
        patient_name = patient_data.get("name")
        patient_phone = patient_data.get("phone")
        patient_email = patient_data.get("email", f"{patient_phone}@temp.waitless.app")
        
        user = db.query(User).filter(User.email == patient_email).first()
        if not user:
            from auth import get_password_hash
            user = User(
                email=patient_email,
                hashed_password=get_password_hash("temp123"),
                full_name=patient_name,
                phone=patient_phone,
                role=UserRole.PATIENT
            )
            db.add(user)
            db.flush()
        
        # Generate ticket
        import uuid
        timestamp = datetime.now().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4())[:8].upper()
        ticket_number = f"T-{timestamp}-{unique_id}"
        
        # Calculate position
        waiting_count = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).count()
        position = waiting_count + 1
        
        # Map priority
        priority_map = {
            "emergency": ServicePriority.HIGH,
            "high": ServicePriority.HIGH,
            "medium": ServicePriority.MEDIUM,
            "low": ServicePriority.LOW
        }
        priority = priority_map.get(patient_data.get("priority", "medium"), ServicePriority.MEDIUM)
        
        # Create ticket
        ticket = Ticket(
            ticket_number=ticket_number,
            patient_id=user.id,
            service_id=service_id,
            priority=priority,
            position_in_queue=position,
            estimated_wait_time=(position - 1) * 15,  # 15 min per patient
            status=TicketStatus.WAITING,
            notes=patient_data.get("reason") or patient_data.get("notes")
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        # Log the action
        queue_log = QueueLog(
            ticket_id=ticket.id,
            action="created_by_secretary",
            details=f"Patient {patient_name} added by secretary {current_user.full_name}"
        )
        db.add(queue_log)
        db.commit()
        
        return {
            "id": ticket.id,
            "ticket_number": ticket_number,
            "message": "Patient added successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating patient: {str(e)}"
        )


# STAFF MANAGEMENT ENDPOINTS

@router.get("/staff")
async def get_staff(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get all staff members."""
    try:
        # Get all users with staff, doctor, or admin roles
        staff_members = db.query(User).filter(
            User.role.in_([UserRole.STAFF, UserRole.DOCTOR, UserRole.ADMIN])
        ).all()
        
        staff_data = []
        for staff in staff_members:
            staff_data.append({
                "id": staff.id,
                "full_name": staff.full_name,
                "email": staff.email,
                "phone": staff.phone,
                "role": staff.role.value,
                "is_active": staff.is_active,
                "created_at": staff.created_at,
                "assigned_service_id": staff.assigned_service_id,
                "assigned_service": {
                    "id": staff.assigned_service.id,
                    "name": staff.assigned_service.name
                } if staff.assigned_service else None
            })
        
        return staff_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting staff: {str(e)}"
        )


@router.get("/staff/stats")
async def get_staff_stats(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get staff statistics."""
    try:
        total_staff = db.query(User).filter(
            User.role.in_([UserRole.STAFF, UserRole.DOCTOR, UserRole.ADMIN])
        ).count()
        
        active_staff = db.query(User).filter(
            and_(
                User.role.in_([UserRole.STAFF, UserRole.DOCTOR, UserRole.ADMIN]),
                User.is_active == True
            )
        ).count()
        
        total_services = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).count()
        
        return {
            "total_staff": total_staff,
            "active_staff": active_staff,
            "total_services": total_services
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting staff stats: {str(e)}"
        )


@router.post("/staff")
async def create_staff(
    staff_data: dict,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new staff member."""
    try:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == staff_data["email"]).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        
        # Create full name
        full_name = f"{staff_data.get('first_name', '')} {staff_data.get('last_name', '')}".strip()
        
        # Hash password
        from auth import get_password_hash
        hashed_password = get_password_hash(staff_data["password"])
        
        # Create user
        user = User(
            email=staff_data["email"],
            hashed_password=hashed_password,
            full_name=full_name,
            phone=staff_data.get("phone"),
            role=UserRole(staff_data["role"]),
            assigned_service_id=staff_data.get("service_id"),
            is_active=True
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return {
            "id": user.id,
            "message": "Staff member created successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating staff member: {str(e)}"
        )


@router.put("/staff/{staff_id}")
async def update_staff(
    staff_id: int,
    staff_data: dict,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Update a staff member."""
    try:
        user = db.query(User).filter(User.id == staff_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found"
            )
        
        # Update basic information
        if "first_name" in staff_data or "last_name" in staff_data:
            first_name = staff_data.get("first_name", "")
            last_name = staff_data.get("last_name", "")
            user.full_name = f"{first_name} {last_name}".strip()
        
        if "email" in staff_data:
            # Check if email is already taken by another user
            existing_user = db.query(User).filter(
                and_(
                    User.email == staff_data["email"],
                    User.id != staff_id
                )
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already exists"
                )
            user.email = staff_data["email"]
        
        if "phone" in staff_data:
            user.phone = staff_data["phone"]
        
        if "role" in staff_data:
            user.role = UserRole(staff_data["role"])
        
        if "service_id" in staff_data:
            user.assigned_service_id = staff_data["service_id"]
        
        # Update password if provided
        if "password" in staff_data and staff_data["password"]:
            from auth import get_password_hash
            user.hashed_password = get_password_hash(staff_data["password"])
        
        db.commit()
        db.refresh(user)
        
        return {
            "id": user.id,
            "message": "Staff member updated successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating staff member: {str(e)}"
        )


@router.put("/staff/{staff_id}/deactivate")
async def deactivate_staff(
    staff_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Deactivate a staff member."""
    try:
        user = db.query(User).filter(User.id == staff_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found"
            )
        
        user.is_active = False
        db.commit()
        
        return {"message": "Staff member deactivated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deactivating staff member: {str(e)}"
        )


@router.post("/staff/{staff_id}/assign-service")
async def assign_service_to_staff(
    staff_id: int,
    assignment_data: dict,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Assign a service to a staff member."""
    try:
        user = db.query(User).filter(User.id == staff_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found"
            )
        
        service_id = assignment_data.get("service_id")
        if service_id:
            service = db.query(Service).filter(Service.id == service_id).first()
            if not service:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Service not found"
                )
        
        user.assigned_service_id = service_id
        db.commit()
        
        return {"message": "Service assigned successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error assigning service: {str(e)}"
        )


@router.delete("/staff/{staff_id}/service-assignment")
async def remove_service_assignment(
    staff_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Remove service assignment from a staff member."""
    try:
        user = db.query(User).filter(User.id == staff_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found"
            )
        
        user.assigned_service_id = None
        db.commit()
        
        return {"message": "Service assignment removed successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing service assignment: {str(e)}"
        )


@router.get("/staff/{staff_id}/activity")
async def get_staff_activity(
    staff_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get activity log for a staff member."""
    try:
        user = db.query(User).filter(User.id == staff_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found"
            )
        
        # Get recent queue logs related to this staff member's service
        activities = []
        
        if user.assigned_service_id:
            # Get tickets managed by this staff member
            tickets = db.query(Ticket).filter(
                Ticket.service_id == user.assigned_service_id
            ).order_by(Ticket.created_at.desc()).limit(10).all()
            
            for ticket in tickets:
                activities.append({
                    "type": "manage_ticket",
                    "title": f"Ticket {ticket.ticket_number} - {ticket.status.value}",
                    "timestamp": ticket.updated_at or ticket.created_at,
                    "details": f"Patient: {ticket.patient.full_name if ticket.patient else 'Unknown'}"
                })
        
        # Add login activity (simulated)
        activities.append({
            "type": "login",
            "title": "Connexion au système",
            "timestamp": user.updated_at or user.created_at,
            "details": "Accès au système de gestion"
        })
        
        # Sort by timestamp
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return activities[:20]  # Return last 20 activities
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting staff activity: {str(e)}"
        ) 