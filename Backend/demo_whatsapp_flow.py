#!/usr/bin/env python3
"""
Demonstration of WhatsApp Notification Flow
Shows exactly what happens when it's a patient's turn
"""

import asyncio
from whatsapp_service import (
    format_phone_number, 
    send_whatsapp_notification,
    create_queue_notification_message,
    set_test_mode,
    configure_whatsapp
)

async def demo_whatsapp_flow():
    """Demonstrate the complete WhatsApp notification flow"""
    
    print("🏥 WaitLess CHU - WhatsApp Notification Demo")
    print("=" * 50)
    
    # Enable test mode for safe demonstration
    set_test_mode(True)
    configure_whatsapp(enabled=True, test_mode=True)
    
    print("✅ Test mode enabled - No actual messages will be sent\n")
    
    # Demo scenario
    print("📋 SCENARIO: Queue Management at CHU Cardiologie")
    print("-" * 45)
    
    # Initial queue state
    patients = [
        {"name": "Ahmed Benali", "phone": "0693955230", "position": 1},
        {"name": "Fatima Mansouri", "phone": "0661234567", "position": 2},
        {"name": "Mohammed Tazi", "phone": "693987654", "position": 3}
    ]
    
    service_name = "Cardiologie"
    
    print("Initial Queue:")
    for patient in patients:
        formatted_phone = format_phone_number(patient["phone"])
        print(f"  {patient['position']}. {patient['name']} ({formatted_phone})")
    
    print(f"\n🔔 EVENT: Ahmed Benali (Position 1) is called by secretary")
    print("📊 Queue is updated...")
    
    # Simulate calling the first patient
    patients = patients[1:]  # Remove first patient
    
    # Update positions
    for i, patient in enumerate(patients):
        patient["position"] = i + 1
    
    print("\nUpdated Queue:")
    for patient in patients:
        formatted_phone = format_phone_number(patient["phone"])
        print(f"  {patient['position']}. {patient['name']} ({formatted_phone})")
    
    # Now Fatima is at position 1 - send WhatsApp notification
    next_patient = patients[0]  # Fatima Mansouri
    
    print(f"\n📱 WHATSAPP NOTIFICATION TRIGGERED")
    print(f"   Patient: {next_patient['name']}")
    print(f"   Phone: {next_patient['phone']} -> {format_phone_number(next_patient['phone'])}")
    print(f"   Position: {next_patient['position']} (their turn!)")
    
    # Show the message that would be sent
    message = create_queue_notification_message(
        next_patient['name'],
        service_name,
        next_patient['position']
    )
    
    print(f"\n📝 MESSAGE CONTENT:")
    print("-" * 30)
    print(message)
    print("-" * 30)
    
    # Send the notification (in test mode)
    print(f"\n🚀 Sending WhatsApp notification...")
    
    result = await send_whatsapp_notification(
        phone_number=next_patient['phone'],
        patient_name=next_patient['name'],
        service_name=service_name,
        position=next_patient['position']
    )
    
    print(f"✅ Notification result: {result}")
    
    # Show what would happen in real mode
    print(f"\n💡 IN REAL MODE (test_mode=False):")
    print(f"   1. WhatsApp Web would open automatically")
    print(f"   2. Message would be sent to {format_phone_number(next_patient['phone'])}")
    print(f"   3. Patient would receive the notification instantly")
    print(f"   4. WhatsApp Web tab would close after 15 seconds")
    
    print(f"\n🎯 PATIENT EXPERIENCE:")
    print(f"   📱 Fatima receives WhatsApp: 'C'est votre tour au service Cardiologie'")
    print(f"   🏃‍♀️ She heads to the secretary immediately")
    print(f"   ✅ No more waiting in uncertainty!")

async def demo_phone_formatting():
    """Demonstrate phone number formatting for different inputs"""
    
    print(f"\n📞 PHONE NUMBER FORMATTING DEMO")
    print("=" * 40)
    
    test_numbers = [
        "0693955230",      # Standard Moroccan format
        "693955230",       # Without leading 0
        "+212693955230",   # Already international
        "06-93-95-52-30",  # With dashes
        "06 93 95 52 30",  # With spaces
        "0661.234.567",    # With dots
        "212661234567",    # International without +
    ]
    
    print("Input Format        → Output Format")
    print("-" * 40)
    
    for phone in test_numbers:
        formatted = format_phone_number(phone)
        print(f"{phone:<18} → {formatted}")

def show_integration_points():
    """Show where WhatsApp notifications are integrated in the system"""
    
    print(f"\n🔗 SYSTEM INTEGRATION POINTS")
    print("=" * 35)
    
    integration_points = [
        {
            "file": "Backend/routers/queue.py",
            "function": "_call_next_patient_atomic()",
            "when": "When admin calls next patient"
        },
        {
            "file": "Backend/routers/tickets.py", 
            "function": "_update_queue_positions_after_change()",
            "when": "When queue positions are updated"
        },
        {
            "file": "Backend/whatsapp_service.py",
            "function": "send_whatsapp_notification()",
            "when": "Core notification sending logic"
        }
    ]
    
    for point in integration_points:
        print(f"📁 {point['file']}")
        print(f"   ⚙️  Function: {point['function']}")
        print(f"   🕐 Triggered: {point['when']}")
        print()

async def main():
    """Run the complete demonstration"""
    
    await demo_whatsapp_flow()
    await demo_phone_formatting()
    show_integration_points()
    
    print(f"\n🎉 DEMONSTRATION COMPLETE!")
    print("=" * 30)
    print("The WhatsApp notification system is ready to use.")
    print("Set test_mode=False in config.py to send real messages.")
    print("\nFor testing: python3 test_whatsapp_integration.py")
    print("For production: Ensure WhatsApp Web is logged in on server")

if __name__ == "__main__":
    asyncio.run(main())