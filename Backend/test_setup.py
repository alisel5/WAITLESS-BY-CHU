#!/usr/bin/env python3
"""
Simple test setup script for WaitLess CHU
Creates basic test data for integration testing
"""
import sys
import os

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import engine, get_db
from models import Base, User, Service, UserRole, ServiceStatus, ServicePriority
from auth import get_password_hash

def create_test_data():
    """Create basic test data for the application."""
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Get database session
    db = next(get_db())
    
    try:
        # Create admin user if not exists
        admin_user = db.query(User).filter(User.email == "admin@waitless.chu").first()
        if not admin_user:
            admin_user = User(
                email="admin@waitless.chu",
                hashed_password=get_password_hash("admin123"),
                full_name="Administrateur CHU",
                phone="+212600000000",
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin_user)
            print("✅ Created admin user: admin@waitless.chu / admin123")
        
        # Create staff user for secretary
        staff_user = db.query(User).filter(User.email == "secretary@waitless.chu").first()
        if not staff_user:
            staff_user = User(
                email="secretary@waitless.chu",
                hashed_password=get_password_hash("secretary123"),
                full_name="Secrétaire Cardiologie",
                phone="+212600000001",
                role=UserRole.STAFF,
                assigned_service_id=1,  # Will be assigned to Cardiologie
                is_active=True
            )
            db.add(staff_user)
            print("✅ Created secretary user: secretary@waitless.chu / secretary123")
        
        # Create test services
        services_data = [
            {
                "name": "Cardiologie",
                "description": "Service de cardiologie",
                "location": "Bâtiment A - 1er étage",
                "status": ServiceStatus.ACTIVE,
                "priority": ServicePriority.HIGH,
                "avg_wait_time": 25
            },
            {
                "name": "Pédiatrie",
                "description": "Service de pédiatrie",
                "location": "Bâtiment B - 2ème étage",
                "status": ServiceStatus.ACTIVE,
                "priority": ServicePriority.MEDIUM,
                "avg_wait_time": 20
            },
            {
                "name": "Urgences",
                "description": "Service des urgences",
                "location": "Rez-de-chaussée",
                "status": ServiceStatus.ACTIVE,
                "priority": ServicePriority.HIGH,
                "avg_wait_time": 15
            }
        ]
        
        for service_data in services_data:
            service = db.query(Service).filter(Service.name == service_data["name"]).first()
            if not service:
                service = Service(**service_data)
                db.add(service)
                print(f"✅ Created service: {service_data['name']}")
        
        # Update staff user's service assignment
        if staff_user:
            cardiologie = db.query(Service).filter(Service.name == "Cardiologie").first()
            if cardiologie:
                staff_user.assigned_service_id = cardiologie.id
        
        # Create a test patient
        patient_user = db.query(User).filter(User.email == "patient@test.com").first()
        if not patient_user:
            patient_user = User(
                email="patient@test.com",
                hashed_password=get_password_hash("patient123"),
                full_name="Patient Test",
                phone="+212600000002",
                role=UserRole.PATIENT,
                is_active=True
            )
            db.add(patient_user)
            print("✅ Created test patient: patient@test.com / patient123")
        
        db.commit()
        print("\n🎉 Test data created successfully!")
        print("\nYou can now login with:")
        print("👨‍💼 Admin: admin@waitless.chu / admin123")
        print("👩‍💼 Secretary: secretary@waitless.chu / secretary123")
        print("👤 Patient: patient@test.com / patient123")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()