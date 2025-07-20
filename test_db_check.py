#!/usr/bin/env python3
"""
Quick database check script
"""
from sqlalchemy.orm import Session
from database import get_db, engine
from models import Ticket, User, Service
from sqlalchemy.orm import joinedload

def check_database():
    """Check database state"""
    db = next(get_db())
    
    try:
        # Check tickets
        tickets = db.query(Ticket).options(
            joinedload(Ticket.patient),
            joinedload(Ticket.service)
        ).all()
        
        print(f"Total tickets: {len(tickets)}")
        
        for ticket in tickets:
            print(f"Ticket {ticket.id}: {ticket.ticket_number}")
            print(f"  Patient: {ticket.patient.full_name if ticket.patient else 'None'}")
            print(f"  Service: {ticket.service.name if ticket.service else 'None'}")
            print(f"  Status: {ticket.status.value}")
            print("---")
        
        # Check users
        users = db.query(User).all()
        print(f"\nTotal users: {len(users)}")
        
        for user in users:
            print(f"User {user.id}: {user.full_name} ({user.email}) - Role: {user.role.value}")
        
        # Check services
        services = db.query(Service).all()
        print(f"\nTotal services: {len(services)}")
        
        for service in services:
            print(f"Service {service.id}: {service.name} - Status: {service.status.value}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_database() 