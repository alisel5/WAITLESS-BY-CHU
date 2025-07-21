#!/usr/bin/env python3
"""
Test script for WhatsApp integration with the queue system
This script tests the WhatsApp notification functionality
"""

import asyncio
import sys
import os

# Add the Backend directory to the path
sys.path.append(os.path.dirname(__file__))

async def test_whatsapp_integration():
    """Test WhatsApp notification integration"""
    print("🧪 Testing WhatsApp Integration for Queue Notifications")
    print("=" * 60)
    
    # Test 1: Import and initialize WhatsApp service
    print("\n1. Testing WhatsApp Service Import...")
    try:
        from whatsapp_service import (
            format_phone_number, 
            send_whatsapp_notification,
            set_test_mode,
            initialize_from_settings,
            configure_whatsapp
        )
        print("✅ WhatsApp service imported successfully")
    except ImportError as e:
        print(f"❌ Failed to import WhatsApp service: {e}")
        return False
    
    # Test 2: Initialize from settings
    print("\n2. Testing Settings Integration...")
    try:
        initialize_from_settings()
        print("✅ Settings loaded successfully")
    except Exception as e:
        print(f"⚠️  Settings load failed (using defaults): {e}")
    
    # Test 3: Phone number formatting
    print("\n3. Testing Phone Number Formatting...")
    test_phones = [
        "0693955230",  # With leading 0
        "693955230",   # Without leading 0
        "+212693955230",  # Already formatted
        "06-93-95-52-30",  # With dashes
        "06 93 95 52 30",  # With spaces
        "invalid",  # Invalid format
    ]
    
    for phone in test_phones:
        formatted = format_phone_number(phone)
        print(f"   {phone:<15} -> {formatted}")
    
    # Test 4: Enable test mode for safe testing
    print("\n4. Enabling Test Mode...")
    set_test_mode(True)
    configure_whatsapp(enabled=True, test_mode=True)
    print("✅ Test mode enabled (no actual messages will be sent)")
    
    # Test 5: Test notification sending
    print("\n5. Testing Notification Sending...")
    test_cases = [
        {
            "phone": "0693955230",
            "name": "Ahmed Benali",
            "service": "Cardiologie",
            "position": 1
        },
        {
            "phone": "693955230",
            "name": "Fatima Mansouri", 
            "service": "Dermatologie",
            "position": 2
        }
    ]
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n   Test Case {i}: {case['name']} - Position {case['position']}")
        try:
            result = await send_whatsapp_notification(
                phone_number=case["phone"],
                patient_name=case["name"],
                service_name=case["service"],
                position=case["position"]
            )
            print(f"   ✅ Notification result: {result}")
        except Exception as e:
            print(f"   ❌ Notification failed: {e}")
    
    # Test 6: Test with missing phone number
    print("\n6. Testing Error Handling...")
    try:
        result = await send_whatsapp_notification(
            phone_number="",  # Empty phone
            patient_name="Test Patient",
            service_name="Test Service",
            position=1
        )
        print(f"   ✅ Empty phone handled gracefully: {result}")
    except Exception as e:
        print(f"   ❌ Empty phone handling failed: {e}")
    
    print("\n" + "=" * 60)
    print("🎉 WhatsApp Integration Test Complete!")
    print("\nNOTE: This test ran in test mode. No actual WhatsApp messages were sent.")
    print("To send real messages, set test_mode=False in config.py")
    
    return True

async def test_integration_with_database():
    """Test WhatsApp integration with the actual database models"""
    print("\n🗄️  Testing Database Integration...")
    
    try:
        from database import SessionLocal
        from models import User, Ticket, Service, TicketStatus
        from whatsapp_service import send_whatsapp_notification, set_test_mode
        
        set_test_mode(True)  # Safe testing
        
        # Create a test database session
        db = SessionLocal()
        
        # Find a test service and user
        service = db.query(Service).first()
        user = db.query(User).filter(User.phone.isnot(None)).first()
        
        if service and user:
            print(f"   Testing with service: {service.name}")
            print(f"   Testing with user: {user.full_name} ({user.phone})")
            
            result = await send_whatsapp_notification(
                phone_number=user.phone,
                patient_name=user.full_name,
                service_name=service.name,
                position=1
            )
            
            print(f"   ✅ Database integration test result: {result}")
        else:
            print("   ⚠️  No suitable test data found in database")
            
        db.close()
        
    except Exception as e:
        print(f"   ❌ Database integration test failed: {e}")

def show_usage_instructions():
    """Show instructions for using WhatsApp notifications"""
    print("\n📋 WhatsApp Notifications Usage Instructions")
    print("=" * 50)
    print("1. WhatsApp notifications trigger automatically when a patient reaches position 1")
    print("2. Messages are sent to the phone number stored in the User model")
    print("3. Phone numbers are automatically formatted to +212 (Morocco) format")
    print("4. Notifications are sent via pywhatkit.sendwhatmsg_instantly()")
    print("5. Test mode can be enabled in config.py (whatsapp_test_mode = True)")
    print("6. Notifications can be disabled in config.py (whatsapp_enabled = False)")
    print("\nMessage Format:")
    print("🏥 Bonjour [Patient Name]!")
    print("📢 C'est votre tour au service [Service Name].")
    print("⏰ Veuillez vous présenter immédiatement au secrétariat.")
    print("✅ Merci d'utiliser WaitLess CHU - Votre temps est précieux!")
    
    print("\nConfiguration Options (in Backend/config.py):")
    print("- whatsapp_enabled: bool = True")
    print("- whatsapp_test_mode: bool = False")
    print("- whatsapp_wait_time: int = 15")
    print("- whatsapp_country_code: str = '+212'")

if __name__ == "__main__":
    print("🚀 WhatsApp Integration Test for WaitLess CHU")
    print("This test validates the WhatsApp notification system")
    
    # Run the main test
    asyncio.run(test_whatsapp_integration())
    
    # Run database integration test
    asyncio.run(test_integration_with_database())
    
    # Show usage instructions
    show_usage_instructions()