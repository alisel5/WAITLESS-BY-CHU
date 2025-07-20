"""
Create sample tickets for testing the patients page
"""

import sys
sys.path.append('.')

from database import SessionLocal
from models import User, Service, Ticket, UserRole, ServicePriority, TicketStatus, ServiceStatus
from datetime import datetime, timedelta
import random

def create_sample_tickets():
    """Create sample tickets for testing."""
    
    print("Creating sample tickets...")
    db = SessionLocal()
    
    try:
        # Get all patients
        patients = db.query(User).filter(User.role == UserRole.PATIENT).all()
        if not patients:
            print("❌ No patients found in database. Please run init_db.py first.")
            return
        
        # Get all services
        services = db.query(Service).filter(Service.status == ServiceStatus.ACTIVE).all()
        if not services:
            print("❌ No active services found in database. Please run init_db.py first.")
            return
        
        # Create sample tickets
        sample_tickets = []
        
        # Create tickets for each patient
        for i, patient in enumerate(patients):
            # Assign each patient to a different service
            service = services[i % len(services)]
            
            # Create 1-3 tickets per patient
            num_tickets = random.randint(1, 3)
            
            for j in range(num_tickets):
                # Create ticket with different statuses
                statuses = [TicketStatus.WAITING, TicketStatus.COMPLETED, TicketStatus.CANCELLED]
                status = statuses[j % len(statuses)]
                
                # Create ticket with different priorities
                priorities = [ServicePriority.LOW, ServicePriority.MEDIUM, ServicePriority.HIGH]
                priority = priorities[j % len(priorities)]
                
                # Create ticket with different creation times
                hours_ago = random.randint(1, 48)
                created_at = datetime.now() - timedelta(hours=hours_ago)
                
                # Generate ticket number
                ticket_number = f"T{datetime.now().strftime('%Y%m%d')}{patient.id:03d}{j+1:02d}"
                
                ticket = Ticket(
                    ticket_number=ticket_number,
                    patient_id=patient.id,
                    service_id=service.id,
                    status=status,
                    priority=priority,
                    position_in_queue=random.randint(1, 20),
                    estimated_wait_time=random.randint(10, 60),
                    created_at=created_at,
                    notes=f"Sample ticket {j+1} for {patient.full_name}"
                )
                
                sample_tickets.append(ticket)
                print(f"✓ Created ticket {ticket_number} for {patient.full_name} in {service.name}")
        
        # Add all tickets to database
        db.add_all(sample_tickets)
        db.commit()
        
        print(f"\n🎉 Successfully created {len(sample_tickets)} sample tickets!")
        print(f"📊 Tickets created for {len(patients)} patients across {len(services)} services")
        
    except Exception as e:
        print(f"❌ Error creating sample tickets: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_tickets() 