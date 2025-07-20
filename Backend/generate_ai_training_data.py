"""
AI Training Data Generator for Smart Hospital Queue System
=========================================================

This script generates realistic historical data to train the AI wait time estimation system.
It creates realistic patterns based on:
- Time of day variations
- Day of week patterns
- Priority distributions
- Service-specific consultation times
- Seasonal variations
"""

import random
import sys
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import numpy as np

# Add the Backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
from models import (
    Base, User, Service, Ticket, QueueLog, 
    TicketStatus, ServicePriority, UserRole, ServiceStatus
)
from auth import get_password_hash

def create_sample_services(db: Session):
    """Create realistic hospital services."""
    services_data = [
        {
            "name": "Consultation Générale",
            "description": "Médecine générale et consultations de routine",
            "location": "Aile A - Rez-de-chaussée",
            "max_wait_time": 45,
            "avg_wait_time": 20,
            "priority": ServicePriority.MEDIUM,
            "status": ServiceStatus.ACTIVE
        },
        {
            "name": "Cardiologie",
            "description": "Consultations spécialisées du cœur",
            "location": "Aile B - 2ème étage",
            "max_wait_time": 60,
            "avg_wait_time": 25,
            "priority": ServicePriority.HIGH,
            "status": ServiceStatus.ACTIVE
        },
        {
            "name": "Dermatologie",
            "description": "Soins de la peau et diagnostics",
            "location": "Aile C - 1er étage",
            "max_wait_time": 30,
            "avg_wait_time": 15,
            "priority": ServicePriority.MEDIUM,
            "status": ServiceStatus.ACTIVE
        },
        {
            "name": "Urgences",
            "description": "Service des urgences 24h/24",
            "location": "Aile D - Rez-de-chaussée",
            "max_wait_time": 120,
            "avg_wait_time": 45,
            "priority": ServicePriority.HIGH,
            "status": ServiceStatus.ACTIVE
        },
        {
            "name": "Pédiatrie",
            "description": "Soins pour enfants et adolescents",
            "location": "Aile E - 1er étage",
            "max_wait_time": 40,
            "avg_wait_time": 18,
            "priority": ServicePriority.MEDIUM,
            "status": ServiceStatus.ACTIVE
        }
    ]
    
    services = []
    for service_data in services_data:
        # Check if service already exists
        existing = db.query(Service).filter(Service.name == service_data["name"]).first()
        if not existing:
            service = Service(**service_data)
            db.add(service)
            services.append(service)
        else:
            services.append(existing)
    
    db.commit()
    return services

def create_sample_users(db: Session, count: int = 200):
    """Create sample patients and staff users."""
    users = []
    
    # Create patients
    first_names = [
        "Mohamed", "Fatima", "Ahmed", "Aicha", "Youssef", "Khadija", "Omar", "Amina",
        "Ali", "Zeinab", "Hassan", "Malika", "Karim", "Laila", "Rachid", "Nadia",
        "Saad", "Samira", "Adil", "Hajar", "Hamid", "Zineb", "Khalid", "Imane"
    ]
    
    last_names = [
        "Alami", "Bennani", "Cherif", "Drissi", "El Fassi", "Ghazi", "Hajji",
        "Idrissi", "Jaber", "Kettani", "Lahlou", "Mansouri", "Naciri", "Ouali",
        "Qadiri", "Rifai", "Sabri", "Tazi", "Umayyad", "Wahbi", "Yamani", "Zaki"
    ]
    
    for i in range(count):
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        email = f"{first_name.lower()}.{last_name.lower()}_{i}@waitless.test"
        
        # Check if user exists
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            user = User(
                email=email,
                hashed_password=get_password_hash("test123"),
                full_name=f"{first_name} {last_name}",
                phone=f"0{random.randint(600000000, 799999999)}",
                role=UserRole.PATIENT,
                is_active=True
            )
            db.add(user)
            users.append(user)
    
    # Create some staff users
    staff_data = [
        ("admin@waitless.chu", "Admin", "Système", UserRole.ADMIN, None),
        ("secretary1@waitless.chu", "Aicha", "Bennani", UserRole.STAFF, 1),
        ("secretary2@waitless.chu", "Fatima", "Alami", UserRole.STAFF, 2),
        ("doctor1@waitless.chu", "Dr. Mohamed", "Cherif", UserRole.DOCTOR, 1),
        ("doctor2@waitless.chu", "Dr. Laila", "Mansouri", UserRole.DOCTOR, 2)
    ]
    
    for email, first_name, last_name, role, service_id in staff_data:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            user = User(
                email=email,
                hashed_password=get_password_hash("admin123"),
                full_name=f"{first_name} {last_name}",
                phone=f"0{random.randint(500000000, 599999999)}",
                role=role,
                assigned_service_id=service_id,
                is_active=True
            )
            db.add(user)
            users.append(user)
    
    db.commit()
    return users

def generate_realistic_timestamp(base_date: datetime, hour_weight: dict, weekday_weight: dict):
    """Generate realistic timestamp based on hospital patterns."""
    
    # Choose hour based on weights (higher weight = more likely)
    hours = list(hour_weight.keys())
    weights = list(hour_weight.values())
    chosen_hour = int(np.random.choice(hours, p=np.array(weights) / sum(weights)))
    
    # Choose weekday
    weekdays = list(weekday_weight.keys())
    weekday_weights = list(weekday_weight.values())
    chosen_weekday = int(np.random.choice(weekdays, p=np.array(weekday_weights) / sum(weekday_weights)))
    
    # Find a date with the chosen weekday
    days_ahead = (chosen_weekday - base_date.weekday()) % 7
    if days_ahead == 0 and random.random() < 0.5:
        days_ahead = 7  # Sometimes choose next week
    
    target_date = base_date + timedelta(days=days_ahead)
    
    # Add some randomness to minutes
    minutes = random.randint(0, 59)
    
    return target_date.replace(hour=chosen_hour, minute=minutes, second=0, microsecond=0)

def generate_consultation_duration(service_name: str, priority: ServicePriority, hour: int):
    """Generate realistic consultation duration based on service and conditions."""
    
    # Base durations by service (in minutes)
    base_durations = {
        "Consultation Générale": 15,
        "Cardiologie": 25,
        "Dermatologie": 12,
        "Urgences": 30,
        "Pédiatrie": 18
    }
    
    base_duration = base_durations.get(service_name, 20)
    
    # Priority affects duration
    priority_multipliers = {
        ServicePriority.HIGH: 1.4,     # Emergency cases take longer
        ServicePriority.MEDIUM: 1.0,   # Normal duration
        ServicePriority.LOW: 0.8       # Quick consultations
    }
    
    # Time of day affects efficiency
    hour_efficiency = {
        8: 1.2,   # Morning slower (startup)
        9: 1.0,   # Normal
        10: 0.9,  # Efficient morning
        11: 0.9,  # Efficient morning
        12: 1.3,  # Lunch disruption
        13: 1.4,  # Lunch slower
        14: 0.8,  # Post-lunch efficient
        15: 0.8,  # Afternoon efficient
        16: 0.9,  # Still good
        17: 1.1,  # End of day slower
        18: 1.2,  # Evening slower
        19: 1.3,  # Late evening
        20: 1.5,  # Night shift handover
    }
    
    duration = base_duration * priority_multipliers[priority] * hour_efficiency.get(hour, 1.0)
    
    # Add some randomness (±30%)
    variation = random.uniform(0.7, 1.3)
    final_duration = duration * variation
    
    # Ensure minimum 5 minutes, maximum 120 minutes
    return max(5, min(120, int(final_duration)))

def create_historical_tickets(db: Session, services: list, users: list, days_back: int = 30):
    """Generate realistic historical ticket data for AI training."""
    
    # Hospital operating patterns
    hour_weights = {
        8: 0.15,   # 15% of daily volume
        9: 0.18,   # Morning rush
        10: 0.15,  # High morning activity
        11: 0.12,  # Late morning
        12: 0.05,  # Lunch dip
        13: 0.04,  # Lunch continues
        14: 0.08,  # Post-lunch pickup
        15: 0.10,  # Afternoon activity
        16: 0.08,  # Late afternoon
        17: 0.03,  # End of regular hours
        18: 0.02,  # Evening
    }
    
    weekday_weights = {
        0: 0.20,   # Monday (20% of weekly volume)
        1: 0.18,   # Tuesday
        2: 0.17,   # Wednesday
        3: 0.16,   # Thursday
        4: 0.15,   # Friday
        5: 0.08,   # Saturday (reduced)
        6: 0.06,   # Sunday (minimal)
    }
    
    # Priority distributions by service
    service_priority_dist = {
        "Consultation Générale": {ServicePriority.HIGH: 0.1, ServicePriority.MEDIUM: 0.7, ServicePriority.LOW: 0.2},
        "Cardiologie": {ServicePriority.HIGH: 0.3, ServicePriority.MEDIUM: 0.6, ServicePriority.LOW: 0.1},
        "Dermatologie": {ServicePriority.HIGH: 0.05, ServicePriority.MEDIUM: 0.5, ServicePriority.LOW: 0.45},
        "Urgences": {ServicePriority.HIGH: 0.6, ServicePriority.MEDIUM: 0.3, ServicePriority.LOW: 0.1},
        "Pédiatrie": {ServicePriority.HIGH: 0.2, ServicePriority.MEDIUM: 0.6, ServicePriority.LOW: 0.2}
    }
    
    patient_users = [u for u in users if u.role == UserRole.PATIENT]
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)
    ticket_counter = 1000  # Initialize unique ticket counter
    
    total_tickets = 0
    
    for service in services:
        print(f"Generating data for {service.name}...")
        
        # Number of tickets per day for this service (varies by service type)
        daily_volume = {
            "Consultation Générale": random.randint(25, 40),
            "Cardiologie": random.randint(15, 25),
            "Dermatologie": random.randint(20, 30),
            "Urgences": random.randint(30, 50),
            "Pédiatrie": random.randint(18, 28)
        }
        
        service_daily_volume = daily_volume.get(service.name, 25)
        total_service_tickets = service_daily_volume * days_back
        
        priority_dist = service_priority_dist.get(service.name, 
                                                 {ServicePriority.HIGH: 0.2, ServicePriority.MEDIUM: 0.6, ServicePriority.LOW: 0.2})
        
        for i in range(total_service_tickets):
            # Choose random patient
            patient = random.choice(patient_users)
            
            # Generate realistic timestamp
            random_day = start_date + timedelta(days=random.randint(0, days_back-1))
            created_at = generate_realistic_timestamp(random_day, hour_weights, weekday_weights)
            
            # Skip if too recent (avoid overlap with current system)
            if (end_date - created_at).days < 1:
                continue
            
            # Choose priority based on service distribution
            priorities = list(priority_dist.keys())
            weights = list(priority_dist.values())
            priority = np.random.choice(priorities, p=weights)
            
            # Generate unique ticket number
            timestamp = created_at.strftime("%Y%m%d")
            ticket_number = f"T-{timestamp}-{ticket_counter}"
            ticket_counter += 1
            
            # Calculate position (simulate queue at time of creation)
            position = random.randint(1, 15)
            
            # Generate consultation times
            consultation_duration = generate_consultation_duration(service.name, priority, created_at.hour)
            
            # Consultation starts some time after creation (simulate wait)
            wait_minutes = random.randint(5, position * 20)  # Realistic wait based on position
            consultation_start = created_at + timedelta(minutes=wait_minutes)
            consultation_end = consultation_start + timedelta(minutes=consultation_duration)
            
            # Most tickets are completed, some cancelled
            status = TicketStatus.COMPLETED if random.random() < 0.85 else TicketStatus.CANCELLED
            
            # Create ticket
            ticket = Ticket(
                ticket_number=ticket_number,
                patient_id=patient.id,
                service_id=service.id,
                status=status,
                priority=priority,
                position_in_queue=position,
                estimated_wait_time=wait_minutes,  # Store actual wait as estimated for training
                created_at=created_at,
                consultation_start=consultation_start if status == TicketStatus.COMPLETED else None,
                consultation_end=consultation_end if status == TicketStatus.COMPLETED else None,
                actual_arrival=consultation_start if status == TicketStatus.COMPLETED else None
            )
            
            db.add(ticket)
            
            # Create queue log entries
            queue_log_join = QueueLog(
                ticket_id=None,  # Will be set after commit
                action="joined",
                timestamp=created_at,
                details=f"Patient {patient.full_name} joined queue for {service.name}"
            )
            db.add(queue_log_join)
            
            if status == TicketStatus.COMPLETED:
                queue_log_completed = QueueLog(
                    ticket_id=None,
                    action="completed",
                    timestamp=consultation_end,
                    details=f"Consultation completed for {patient.full_name}"
                )
                db.add(queue_log_completed)
            
            total_tickets += 1
            
            # Commit in batches to avoid memory issues
            if total_tickets % 100 == 0:
                db.commit()
                print(f"Generated {total_tickets} tickets so far...")
    
    # Final commit
    db.commit()
    print(f"✅ Generated {total_tickets} historical tickets for AI training")
    
    return total_tickets

def main():
    """Main function to generate all training data."""
    print("🚀 Starting AI Training Data Generation...")
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Ensure tables exist
        Base.metadata.create_all(bind=engine)
        
        # Create services
        print("📋 Creating hospital services...")
        services = create_sample_services(db)
        print(f"✅ Created {len(services)} services")
        
        # Create users
        print("👥 Creating sample users...")
        users = create_sample_users(db, count=150)
        print(f"✅ Created sample users")
        
        # Generate historical tickets (30 days of realistic data)
        print("🎫 Generating historical tickets for AI training...")
        ticket_count = create_historical_tickets(db, services, users, days_back=30)
        
        print(f"\n🎉 AI Training Data Generation Complete!")
        print(f"📊 Generated {ticket_count} tickets across {len(services)} services")
        print(f"💡 The AI system now has sufficient data to provide intelligent estimates")
        print(f"🔬 Services with AI capabilities: {[s.name for s in services]}")
        
    except Exception as e:
        print(f"❌ Error generating training data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()