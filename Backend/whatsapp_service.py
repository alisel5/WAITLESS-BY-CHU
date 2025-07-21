"""
WhatsApp Notification Service for Queue Management
Non-blocking background notifications with file logging
"""

import re
import logging
import json
from typing import Optional
import asyncio
from functools import wraps
from datetime import datetime
import threading
import os

# Setup dedicated WhatsApp logger
def setup_whatsapp_logger():
    """Setup dedicated logger for WhatsApp notifications"""
    logger = logging.getLogger('whatsapp_notifications')
    logger.setLevel(logging.INFO)
    
    # Create logs directory if it doesn't exist
    os.makedirs('logs', exist_ok=True)
    
    # File handler for WhatsApp logs
    file_handler = logging.FileHandler('logs/whatsapp_notifications.log')
    file_handler.setLevel(logging.INFO)
    
    # Console handler for immediate feedback
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Add handlers
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

logger = setup_whatsapp_logger()

# Configuration - will be updated from settings
WHATSAPP_CONFIG = {
    "enabled": True,
    "wait_time": 15,
    "tab_close": True,
    "country_code": "+212",
    "test_mode": False,
    "async_mode": True  # New: Run in background
}

def initialize_from_settings():
    """Initialize WhatsApp config from application settings"""
    try:
        from config import settings
        WHATSAPP_CONFIG.update({
            "enabled": settings.whatsapp_enabled,
            "test_mode": settings.whatsapp_test_mode,
            "wait_time": settings.whatsapp_wait_time,
            "country_code": settings.whatsapp_country_code
        })
        logger.info(f"WhatsApp configuration loaded from settings: enabled={settings.whatsapp_enabled}, test_mode={settings.whatsapp_test_mode}")
    except ImportError:
        logger.warning("Could not import settings, using default WhatsApp configuration")

def format_phone_number(phone: str) -> Optional[str]:
    """
    Convert phone numbers to proper international format for Morocco (+212)
    
    Examples:
    - "0693955230" -> "+212693955230"
    - "693955230" -> "+212693955230"
    - "+212693955230" -> "+212693955230" (already formatted)
    """
    if not phone:
        return None
    
    # Remove all non-digit characters
    digits_only = re.sub(r'\D', '', phone)
    
    # Handle different input formats
    if digits_only.startswith('212'):
        # Already has country code
        return f"+{digits_only}"
    elif digits_only.startswith('0'):
        # Remove leading 0 and add country code
        return f"{WHATSAPP_CONFIG['country_code']}{digits_only[1:]}"
    elif len(digits_only) == 9:
        # 9 digits without leading 0
        return f"{WHATSAPP_CONFIG['country_code']}{digits_only}"
    else:
        logger.warning(f"Unrecognized phone number format: {phone}")
        return None

def create_queue_notification_message(patient_name: str, service_name: str, position: int = 1) -> str:
    """Create a notification message for when it's the patient's turn"""
    if position == 1:
        return (
            f"🏥 Bonjour {patient_name}!\n\n"
            f"📢 C'est votre tour au service {service_name}.\n"
            f"⏰ Veuillez vous présenter immédiatement au secrétariat.\n\n"
            f"✅ Merci d'utiliser WaitLess CHU - Votre temps est précieux!"
        )
    else:
        return (
            f"🏥 Bonjour {patient_name}!\n\n"
            f"📋 Mise à jour de votre position: {position}\n"
            f"🏥 Service: {service_name}\n"
            f"⏳ Votre tour approche!\n\n"
            f"✅ WaitLess CHU - Restez informé(e)"
        )

def log_notification_attempt(phone_number: str, patient_name: str, service_name: str, position: int, status: str, error: str = None):
    """Log notification attempt to file"""
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "phone_number": phone_number,
        "patient_name": patient_name,
        "service_name": service_name,
        "position": position,
        "status": status,  # "success", "failed", "test_mode", "disabled"
        "error": error
    }
    
    if status == "success":
        logger.info(f"✅ WhatsApp sent to {phone_number} ({patient_name}) - {service_name} - Position {position}")
    elif status == "failed":
        logger.error(f"❌ WhatsApp failed to {phone_number} ({patient_name}) - {service_name} - Error: {error}")
    elif status == "test_mode":
        logger.info(f"🧪 WhatsApp TEST MODE to {phone_number} ({patient_name}) - {service_name} - Position {position}")
    elif status == "disabled":
        logger.info(f"⚠️ WhatsApp DISABLED - Would send to {phone_number} ({patient_name}) - {service_name}")
    elif status == "invalid_phone":
        logger.warning(f"📱 Invalid phone number: {phone_number} for {patient_name} - {service_name}")

def send_whatsapp_in_background(phone_number: str, message: str, patient_name: str, service_name: str, position: int):
    """Send WhatsApp message in a separate thread (non-blocking)"""
    def _send_whatsapp():
        """Internal function to send WhatsApp in background thread"""
        try:
            # Import pywhatkit only when needed in background thread
            import pywhatkit
            
            # Send the message
            pywhatkit.sendwhatmsg_instantly(
                phone_no=phone_number,
                message=message,
                wait_time=WHATSAPP_CONFIG["wait_time"],
                tab_close=WHATSAPP_CONFIG["tab_close"]
            )
            
            # Log success
            log_notification_attempt(
                phone_number, patient_name, service_name, position, "success"
            )
            
        except Exception as e:
            # Log failure
            log_notification_attempt(
                phone_number, patient_name, service_name, position, "failed", str(e)
            )
    
    # Start background thread
    thread = threading.Thread(target=_send_whatsapp, daemon=True)
    thread.start()
    
    # Return immediately without waiting
    logger.info(f"🚀 WhatsApp notification queued for {patient_name} ({phone_number})")

async def send_whatsapp_notification(
    phone_number: str, 
    patient_name: str, 
    service_name: str,
    position: int = 1
) -> bool:
    """
    Queue WhatsApp notification to be sent in background (non-blocking)
    
    Args:
        phone_number: Patient's phone number in any format
        patient_name: Patient's full name
        service_name: Name of the medical service
        position: Position in queue (1 means it's their turn)
    
    Returns:
        bool: True if queued successfully, False otherwise
    """
    try:
        if not WHATSAPP_CONFIG["enabled"]:
            log_notification_attempt(
                phone_number, patient_name, service_name, position, "disabled"
            )
            return False
        
        # Format phone number
        formatted_phone = format_phone_number(phone_number)
        if not formatted_phone:
            log_notification_attempt(
                phone_number, patient_name, service_name, position, "invalid_phone"
            )
            return False
        
        # Create message
        message = create_queue_notification_message(patient_name, service_name, position)
        
        # Test mode - just log the message
        if WHATSAPP_CONFIG["test_mode"]:
            log_notification_attempt(
                formatted_phone, patient_name, service_name, position, "test_mode"
            )
            return True
        
        # Queue the message to be sent in background
        send_whatsapp_in_background(
            formatted_phone, message, patient_name, service_name, position
        )
        
        return True
        
    except Exception as e:
        log_notification_attempt(
            phone_number, patient_name, service_name, position, "failed", str(e)
        )
        return False

# Fire-and-forget function for queue integration
def notify_patient_turn(phone_number: str, patient_name: str, service_name: str):
    """
    Fire-and-forget notification for when it's patient's turn
    This function returns immediately and doesn't block the queue
    """
    if not phone_number or not patient_name:
        return
    
    # Create async task that runs in background
    def queue_notification():
        try:
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Send notification
            loop.run_until_complete(
                send_whatsapp_notification(phone_number, patient_name, service_name, 1)
            )
            
            loop.close()
        except Exception as e:
            logger.error(f"Background notification failed: {e}")
    
    # Start in daemon thread (won't block main process)
    thread = threading.Thread(target=queue_notification, daemon=True)
    thread.start()
    
    # Return immediately
    logger.info(f"📱 Notification queued for {patient_name} at {service_name}")

def enable_whatsapp_notifications(enabled: bool = True):
    """Enable or disable WhatsApp notifications globally"""
    WHATSAPP_CONFIG["enabled"] = enabled
    logger.info(f"WhatsApp notifications {'enabled' if enabled else 'disabled'}")

def set_test_mode(test_mode: bool = True):
    """Enable or disable test mode (logs instead of sending)"""
    WHATSAPP_CONFIG["test_mode"] = test_mode
    logger.info(f"WhatsApp test mode {'enabled' if test_mode else 'disabled'}")

def configure_whatsapp(
    enabled: Optional[bool] = None,
    wait_time: Optional[int] = None,
    test_mode: Optional[bool] = None,
    country_code: Optional[str] = None
):
    """Configure WhatsApp service parameters"""
    if enabled is not None:
        WHATSAPP_CONFIG["enabled"] = enabled
    if wait_time is not None:
        WHATSAPP_CONFIG["wait_time"] = wait_time
    if test_mode is not None:
        WHATSAPP_CONFIG["test_mode"] = test_mode
    if country_code is not None:
        WHATSAPP_CONFIG["country_code"] = country_code
    
    logger.info(f"WhatsApp configuration updated")

# Test function for development
async def test_whatsapp_service(phone: str = "0693955230", name: str = "Ahmed Test"):
    """Test the WhatsApp service with a sample notification"""
    set_test_mode(True)  # Enable test mode for safety
    
    result = await send_whatsapp_notification(
        phone_number=phone,
        patient_name=name,
        service_name="Cardiologie",
        position=1
    )
    
    print(f"Test result: {result}")
    print(f"Formatted phone: {format_phone_number(phone)}")
    print(f"Check logs/whatsapp_notifications.log for details")
    return result

# Simple test for the fire-and-forget function
def test_fire_and_forget(phone: str = "0693955230", name: str = "Ahmed Test"):
    """Test the fire-and-forget notification"""
    set_test_mode(True)
    notify_patient_turn(phone, name, "Cardiologie")
    print(f"✅ Fire-and-forget notification queued for {name}")
    print(f"Check logs/whatsapp_notifications.log for results")

if __name__ == "__main__":
    # Test the service when run directly
    print("Testing fire-and-forget notification...")
    test_fire_and_forget()
    
    # Wait a moment for background processing
    import time
    time.sleep(2)
    
    print("\nTesting async notification...")
    asyncio.run(test_whatsapp_service())