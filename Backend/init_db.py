"""
Database initialization script for WaitLess CHU
Creates tables and populates with sample data
"""

import sys
sys.path.append('.')

from database import engine, SessionLocal
from models import Base, User, Service, Ticket, Alert, QueueLog
from models import UserRole, ServicePriority, ServiceStatus, TicketStatus
from auth import get_password_hash
from datetime import datetime, timedelta
import uuid

def init_database():
    """Initialize database with tables and sample data."""
    
    print("Creating database tables...")
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully!")
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Create admin users
        print("\nCreating admin users...")
        admin_users = [
            {
                "email": "admin@waitless.chu",
                "password": "admin123",
                "full_name": "Dr. Administrator",
                "phone": "0612345678",
                "role": UserRole.ADMIN
            },
            {
                "email": "doctor@waitless.chu", 
                "password": "doctor123",
                "full_name": "Dr. Sarah Martin",
                "phone": "0687654321",
                "role": UserRole.DOCTOR
            }
        ]
        
        for user_data in admin_users:
            existing_user = db.query(User).filter(User.email == user_data["email"]).first()
            if not existing_user:
                hashed_password = get_password_hash(user_data["password"])
                user = User(
                    email=user_data["email"],
                    hashed_password=hashed_password,
                    full_name=user_data["full_name"],
                    phone=user_data["phone"],
                    role=user_data["role"]
                )
                db.add(user)
                print(f"✓ Created user: {user_data['email']}")
        
        # Create sample services
        print("\nCreating medical services...")
        services_data = [
            {
                "name": "Cardiologie",
                "description": "Service de cardiologie pour les consultations et examens cardiaques",
                "location": "Bâtiment A - 2ème étage",
                "max_wait_time": 30,
                "priority": ServicePriority.HIGH,
                "status": ServiceStatus.ACTIVE,
                "current_waiting": 0,
                "avg_wait_time": 25
            },
            {
                "name": "Dermatologie", 
                "description": "Consultations dermatologiques et traitements de la peau",
                "location": "Bâtiment B - 1er étage",
                "max_wait_time": 20,
                "priority": ServicePriority.MEDIUM,
                "status": ServiceStatus.ACTIVE,
                "current_waiting": 0,
                "avg_wait_time": 18
            },
            {
                "name": "Pédiatrie",
                "description": "Soins pédiatriques et consultations enfants",
                "location": "Bâtiment C - Rez-de-chaussée", 
                "max_wait_time": 15,
                "priority": ServicePriority.HIGH,
                "status": ServiceStatus.ACTIVE,
                "current_waiting": 0,
                "avg_wait_time": 15
            },
            {
                "name": "Radiologie",
                "description": "Examens radiologiques et imagerie médicale",
                "location": "Bâtiment D - Sous-sol",
                "max_wait_time": 45,
                "priority": ServicePriority.MEDIUM,
                "status": ServiceStatus.ACTIVE,
                "current_waiting": 0,
                "avg_wait_time": 30
            },
            {
                "name": "Urgences",
                "description": "Service d'urgences médicales 24h/24",
                "location": "Bâtiment Principal - Rez-de-chaussée",
                "max_wait_time": 10,
                "priority": ServicePriority.HIGH,
                "status": ServiceStatus.EMERGENCY,
                "current_waiting": 0,
                "avg_wait_time": 8
            },
            {
                "name": "Neurologie",
                "description": "Consultations neurologiques et examens du système nerveux",
                "location": "Bâtiment A - 3ème étage",
                "max_wait_time": 35,
                "priority": ServicePriority.MEDIUM,
                "status": ServiceStatus.ACTIVE,
                "current_waiting": 0,
                "avg_wait_time": 28
            },
            {
                "name": "Orthopédie", 
                "description": "Consultations orthopédiques et traumatologie",
                "location": "Bâtiment E - 1er étage",
                "max_wait_time": 25,
                "priority": ServicePriority.MEDIUM,
                "status": ServiceStatus.ACTIVE,
                "current_waiting": 0,
                "avg_wait_time": 22
            }
        ]
        
        for service_data in services_data:
            existing_service = db.query(Service).filter(Service.name == service_data["name"]).first()
            if not existing_service:
                service = Service(**service_data)
                db.add(service)
                print(f"✓ Created service: {service_data['name']}")
        
        # Create sample patients
        print("\nCreating sample patients...")
        sample_patients = [
            {
                "email": "ahmed.benali@email.com",
                "full_name": "Ahmed Benali",
                "phone": "0612345678"
            },
            {
                "email": "fatima.mansouri@email.com", 
                "full_name": "Fatima El Mansouri",
                "phone": "0623456789"
            },
            {
                "email": "mohammed.tazi@email.com",
                "full_name": "Mohammed Tazi", 
                "phone": "0634567890"
            },
            {
                "email": "amina.bouazza@email.com",
                "full_name": "Amina Bouazza",
                "phone": "0645678901"
            },
            {
                "email": "karim.lahlou@email.com",
                "full_name": "Karim Lahlou",
                "phone": "0656789012"
            }
        ]
        
        for patient_data in sample_patients:
            existing_patient = db.query(User).filter(User.email == patient_data["email"]).first()
            if not existing_patient:
                patient = User(
                    email=patient_data["email"],
                    hashed_password=get_password_hash("patient123"),
                    full_name=patient_data["full_name"],
                    phone=patient_data["phone"],
                    role=UserRole.PATIENT
                )
                db.add(patient)
                print(f"✓ Created patient: {patient_data['full_name']}")
        
        # Commit all changes
        db.commit()
        
        # Create some sample alerts
        print("\nCreating sample alerts...")
        alerts_data = [
            {
                "type": "warning",
                "message": "File d'attente longue en Cardiologie",
                "service_id": 1
            },
            {
                "type": "info", 
                "message": "Nouveau patient prioritaire en Urgences",
                "service_id": 5
            },
            {
                "type": "success",
                "message": "Service de Dermatologie libéré",
                "service_id": 2
            }
        ]
        
        for alert_data in alerts_data:
            alert = Alert(**alert_data)
            db.add(alert)
            print(f"✓ Created alert: {alert_data['message']}")
        
        db.commit()
        
        print("\n🎉 Database initialized successfully!")
        print("\n📋 Sample Data Created:")
        print("   • Admin Users: admin@waitless.chu (password: admin123)")
        print("   • Doctor Users: doctor@waitless.chu (password: doctor123)")
        print("   • 7 Medical Services")
        print("   • 5 Sample Patients (password: patient123)")
        print("   • 3 Sample Alerts")
        
        print("\n🚀 You can now start the API server with:")
        print("   python main.py")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_database() 