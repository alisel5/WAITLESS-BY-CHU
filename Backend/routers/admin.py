from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List
from database import get_db
from models import User, Service, Ticket, TicketStatus, ServiceStatus
from schemas import UserResponse, ServiceResponse
from auth import get_admin_user, get_admin_or_staff_user

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics for admin/staff."""
    try:
        # Get total waiting and consulting tickets
        total_waiting = db.query(Ticket).filter(Ticket.status == TicketStatus.WAITING).count()
        total_consulting = db.query(Ticket).filter(Ticket.status == TicketStatus.CONSULTING).count()
        
        # Get average wait time (in minutes)
        avg_wait_time = db.query(func.avg(Ticket.wait_time)).scalar() or 0
        avg_wait_time = int(avg_wait_time) if avg_wait_time else 0
        
        # Get active services count
        active_services = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).count()
        
        # Get today's tickets
        today = datetime.now().date()
        today_tickets = db.query(Ticket).filter(
            func.date(Ticket.created_at) == today
        ).count()
        
        # Get recent alerts (tickets waiting more than 2 hours)
        long_waiting = db.query(Ticket).filter(
            and_(
                Ticket.status == TicketStatus.WAITING,
                Ticket.wait_time > 120  # 2 hours
            )
        ).count()
        
        return {
            "total_waiting": total_waiting,
            "total_consulting": total_consulting,
            "avg_wait_time": avg_wait_time,
            "active_services": active_services,
            "today_tickets": today_tickets,
            "long_waiting_alerts": long_waiting,
            "total_patients": total_waiting + total_consulting
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
            if ticket.created_at:
                wait_time = int((datetime.now() - ticket.created_at).total_seconds() / 60)
            else:
                wait_time = 0
            
            patient_data = {
                "id": ticket.id,
                "name": ticket.patient_name,
                "service": ticket.service.name if ticket.service else "Service inconnu",
                "status": ticket.status.value,
                "arrival_time": ticket.created_at.isoformat() if ticket.created_at else None,
                "wait_time": wait_time,
                "priority": ticket.priority.value if ticket.priority else "medium",
                "phone": ticket.patient_phone,
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
        
        # Create ticket for the patient
        ticket = Ticket(
            patient_name=f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}".strip(),
            patient_phone=patient_data.get("phone"),
            patient_email=patient_data.get("email"),
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
        
        # Update ticket fields
        if "first_name" in patient_data or "last_name" in patient_data:
            first_name = patient_data.get("first_name", "")
            last_name = patient_data.get("last_name", "")
            ticket.patient_name = f"{first_name} {last_name}".strip()
        
        if "phone" in patient_data:
            ticket.patient_phone = patient_data["phone"]
        
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
        
        # Long waiting tickets
        long_waiting = db.query(Ticket).filter(
            and_(
                Ticket.status == TicketStatus.WAITING,
                Ticket.wait_time > 120  # 2 hours
            )
        ).all()
        
        for ticket in long_waiting:
            alerts.append({
                "type": "long_waiting",
                "message": f"Patient {ticket.patient_name} attend depuis {ticket.wait_time} minutes",
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
            
            # Calculate statistics
            total_tickets = len(day_tickets)
            completed_tickets = len([t for t in day_tickets if t.status == TicketStatus.COMPLETED])
            avg_wait_time = sum(t.wait_time for t in day_tickets) / len(day_tickets) if day_tickets else 0
            
            reports.append({
                "date": date.strftime("%Y-%m-%d"),
                "total_tickets": total_tickets,
                "completed_tickets": completed_tickets,
                "avg_wait_time": int(avg_wait_time),
                "completion_rate": (completed_tickets / total_tickets * 100) if total_tickets > 0 else 0
            })
        
        return reports
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting daily reports: {str(e)}"
        ) 