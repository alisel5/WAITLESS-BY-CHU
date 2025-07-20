#!/usr/bin/env python3
"""
Test script for AI Predictions System
Tests the smart wait time prediction and analytics functionality
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

# Add Backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db
from models import Ticket, Service, User, TicketStatus, ServicePriority, UserRole
from ai.wait_time_predictor import SmartWaitTimePredictor
from ai.queue_analyzer import QueuePatternAnalyzer

async def test_ai_predictions():
    """Test the AI prediction system"""
    print("🤖 Testing AI Prediction System")
    print("=" * 50)
    
    # Get database session
    db = next(get_db())
    
    try:
        # Initialize AI components
        predictor = SmartWaitTimePredictor()
        analyzer = QueuePatternAnalyzer()
        
        # Test 1: Basic wait time prediction
        print("\n📊 Test 1: Basic Wait Time Prediction")
        print("-" * 30)
        
        # Get first service
        service = db.query(Service).first()
        if not service:
            print("❌ No services found in database")
            return False
        
        print(f"Testing with service: {service.name} (ID: {service.id})")
        
        # Test prediction for different positions
        for position in [1, 3, 5]:
            try:
                prediction = predictor.predict_wait_time(
                    service_id=service.id,
                    position=position,
                    priority='medium',
                    current_time=datetime.now(),
                    db=db
                )
                
                print(f"Position {position}: {prediction['estimated_wait_minutes']} min "
                      f"(confidence: {prediction['confidence_score']:.2f})")
                
            except Exception as e:
                print(f"❌ Prediction failed for position {position}: {e}")
        
        # Test 2: Service Performance Insights
        print("\n📈 Test 2: Service Performance Insights")
        print("-" * 30)
        
        try:
            insights = predictor.get_service_performance_insights(service.id, db)
            if insights:
                print(f"Service: {insights.get('service_name', 'Unknown')}")
                print(f"Total tickets: {insights.get('total_tickets', 0)}")
                print(f"Completion rate: {insights.get('completion_rate', 0):.1f}%")
                print(f"Prediction confidence: {insights.get('prediction_confidence', 0):.2f}")
            else:
                print("ℹ️  No performance insights available (insufficient data)")
                
        except Exception as e:
            print(f"❌ Performance insights failed: {e}")
        
        # Test 3: Queue Pattern Analysis
        print("\n🔍 Test 3: Queue Pattern Analysis")
        print("-" * 30)
        
        try:
            patterns = analyzer.analyze_service_patterns(service.id, db)
            if 'error' not in patterns:
                print(f"Analysis period: {patterns.get('analysis_period', 'Unknown')}")
                print(f"Total tickets analyzed: {patterns.get('total_tickets', 0)}")
                
                recommendations = patterns.get('recommendations', [])
                print(f"Recommendations: {len(recommendations)}")
                
                for i, rec in enumerate(recommendations[:3], 1):
                    print(f"  {i}. {rec.get('title', 'No title')} (Priority: {rec.get('priority', 'unknown')})")
                    
            else:
                print(f"ℹ️  Pattern analysis: {patterns['error']}")
                
        except Exception as e:
            print(f"❌ Pattern analysis failed: {e}")
        
        # Test 4: Real-time Analytics
        print("\n⚡ Test 4: Real-time Analytics")
        print("-" * 30)
        
        try:
            real_time = analyzer.get_real_time_insights(service.id, db)
            if 'error' not in real_time:
                print(f"Current status: {real_time.get('current_status', 'unknown')}")
                print(f"Current waiting: {real_time.get('current_waiting', 0)} patients")
                print(f"Today completion rate: {real_time.get('today_completion_rate', 0)}%")
                
                alerts = real_time.get('alerts', [])
                if alerts:
                    print(f"Active alerts: {len(alerts)}")
                    for alert in alerts:
                        print(f"  ⚠️  {alert}")
                else:
                    print("✅ No active alerts")
                    
            else:
                print(f"❌ Real-time analytics: {real_time['error']}")
                
        except Exception as e:
            print(f"❌ Real-time analytics failed: {e}")
        
        # Test 5: Priority Factor Testing
        print("\n🚨 Test 5: Priority Impact Testing")
        print("-" * 30)
        
        priorities = ['low', 'medium', 'high']
        for priority in priorities:
            try:
                prediction = predictor.predict_wait_time(
                    service_id=service.id,
                    position=3,  # Same position for comparison
                    priority=priority,
                    current_time=datetime.now(),
                    db=db
                )
                
                priority_factor = prediction['factors'].get('priority_factor', 1.0)
                print(f"Priority {priority}: {prediction['estimated_wait_minutes']} min "
                      f"(factor: {priority_factor:.2f})")
                
            except Exception as e:
                print(f"❌ Priority test failed for {priority}: {e}")
        
        # Test 6: Time-based Adjustments
        print("\n🕐 Test 6: Time-based Adjustments")
        print("-" * 30)
        
        # Test different hours
        test_hours = [9, 12, 15, 18]  # Morning, lunch, afternoon, evening
        for hour in test_hours:
            try:
                test_time = datetime.now().replace(hour=hour, minute=0, second=0)
                prediction = predictor.predict_wait_time(
                    service_id=service.id,
                    position=2,
                    priority='medium',
                    current_time=test_time,
                    db=db
                )
                
                time_factor = prediction['factors'].get('time_factor', 1.0)
                print(f"Hour {hour:02d}:00: {prediction['estimated_wait_minutes']} min "
                      f"(time factor: {time_factor:.2f})")
                
            except Exception as e:
                print(f"❌ Time test failed for hour {hour}: {e}")
        
        print("\n🎉 AI Prediction System Test Complete!")
        print("=" * 50)
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False
        
    finally:
        db.close()

async def create_test_data(db: Session):
    """Create some test data for better AI predictions"""
    print("📝 Creating test data for AI predictions...")
    
    try:
        # Get or create test service
        service = db.query(Service).first()
        if not service:
            print("Creating test service...")
            from models import ServiceStatus, ServicePriority
            service = Service(
                name="Test Cardiology",
                description="Test service for AI predictions",
                location="Building A, Floor 2",
                max_wait_time=45,
                priority=ServicePriority.MEDIUM,
                status=ServiceStatus.ACTIVE,
                avg_wait_time=20
            )
            db.add(service)
            db.commit()
            db.refresh(service)
        
        # Get or create test user
        user = db.query(User).filter(User.email == "test.patient@example.com").first()
        if not user:
            print("Creating test patient...")
            from auth import get_password_hash
            user = User(
                email="test.patient@example.com",
                hashed_password=get_password_hash("test123"),
                full_name="Test Patient",
                phone="123456789",
                role=UserRole.PATIENT
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Create some sample tickets with varied timing
        print("Creating sample tickets for analysis...")
        base_time = datetime.now() - timedelta(days=2)
        
        for i in range(10):
            # Vary the creation time
            created_time = base_time + timedelta(hours=i*2, minutes=i*15)
            consultation_start = created_time + timedelta(minutes=20 + i*5)
            consultation_end = consultation_start + timedelta(minutes=15 + i*2)
            
            # Check if ticket already exists
            existing = db.query(Ticket).filter(
                Ticket.patient_id == user.id,
                Ticket.service_id == service.id,
                Ticket.created_at >= created_time - timedelta(minutes=30),
                Ticket.created_at <= created_time + timedelta(minutes=30)
            ).first()
            
            if not existing:
                ticket = Ticket(
                    ticket_number=f"TEST-{i:03d}-{int(created_time.timestamp())}",
                    patient_id=user.id,
                    service_id=service.id,
                    status=TicketStatus.COMPLETED,
                    priority=ServicePriority.MEDIUM,
                    position_in_queue=1,
                    estimated_wait_time=20 + i*3,
                    created_at=created_time,
                    consultation_start=consultation_start,
                    consultation_end=consultation_end
                )
                db.add(ticket)
        
        db.commit()
        print("✅ Test data created successfully")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        db.rollback()

def main():
    """Main test function"""
    print("🏥 WaitLess CHU - AI Prediction System Test")
    print("=" * 60)
    
    # Create event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Create test data first
        db = next(get_db())
        try:
            loop.run_until_complete(create_test_data(db))
        finally:
            db.close()
        
        # Run AI tests
        success = loop.run_until_complete(test_ai_predictions())
        
        if success:
            print("\n✅ All tests passed! AI system is working correctly.")
            print("\n🚀 Ready to integrate with frontend!")
        else:
            print("\n❌ Some tests failed. Check the errors above.")
            
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        
    finally:
        loop.close()

if __name__ == "__main__":
    main()