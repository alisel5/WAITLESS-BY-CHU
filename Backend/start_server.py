#!/usr/bin/env python3
"""
Smart Hospital Queue System - AI-Enhanced Server Startup
========================================================

This script starts the FastAPI server with all AI features enabled.
It ensures the database is properly initialized and the AI system is ready.
"""

import sys
import os
import uvicorn
from sqlalchemy import text

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal
from models import Base
from ai_wait_time_estimator import ai_estimator

def initialize_system():
    """Initialize database and AI system"""
    print("🚀 Initializing Smart Hospital Queue System...")
    
    # Create tables if they don't exist
    print("📋 Setting up database...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database ready")
    
    # Test database connection
    try:
        with SessionLocal() as db:
            result = db.execute(text("SELECT COUNT(*) FROM services")).scalar()
            print(f"📊 Services in database: {result}")
            
            result = db.execute(text("SELECT COUNT(*) FROM tickets")).scalar()
            print(f"🎫 Tickets in database: {result}")
            
    except Exception as e:
        print(f"⚠️ Database check warning: {e}")
    
    # Initialize AI system
    print("🤖 Initializing AI Wait Time Estimation...")
    try:
        with SessionLocal() as db:
            # Build AI models for each service
            from models import Service
            services = db.query(Service).all()
            for service in services:
                try:
                    ai_estimator.build_service_model(db, service.id)
                    print(f"✅ AI model ready for {service.name}")
                except Exception as e:
                    print(f"⚠️ AI model warning for {service.name}: {e}")
        
        print("🧠 AI system initialized successfully!")
        
    except Exception as e:
        print(f"⚠️ AI initialization warning: {e}")
        print("🔄 AI system will initialize when first accessed")
    
    print("🎉 System initialization complete!")
    print("🌐 Starting FastAPI server...")

def main():
    """Main entry point"""
    print("=" * 60)
    print("🏥 Smart Hospital Queue System - AI Enhanced")
    print("🤖 Featuring Intelligent Wait Time Estimation")
    print("=" * 60)
    
    initialize_system()
    
    # Start the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()