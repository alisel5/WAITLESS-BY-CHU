"""
WhatsApp Notification Service for Queue Management
Sends notifications when it's a patient's turn in the queue
"""

import re
import logging
from typing import Optional
import asyncio
from functools import wraps

# Lazy import to avoid issues if pywhatkit is not installed
def _import_pywhatkit():
    try:
        import pywhatkit
        return pywhatkit
    except ImportError:
        logging.warning("pywhatkit not installed. WhatsApp notifications disabled.")
        return None

logger = logging.getLogger(__name__)

# Configuration - will be updated from settings
WHATSAPP_CONFIG = {
    "enabled": True,  # Can be controlled via environment variable
    "wait_time": 15,  # seconds to wait before sending
    "tab_close": True,  # close WhatsApp web tab after sending
    "country_code": "+212",  # Morocco country code
    "test_mode": False  # If True, only logs messages without sending
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
    """
    Create a notification message for when it's the patient's turn
    """
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

def handle_whatsapp_errors(func):
    """Decorator to handle WhatsApp sending errors gracefully"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"WhatsApp notification failed: {str(e)}")
            # Never raise the exception to avoid affecting the main queue flow
            return False
    return wrapper

@handle_whatsapp_errors
async def send_whatsapp_notification(
    phone_number: str, 
    patient_name: str, 
    service_name: str,
    position: int = 1
) -> bool:
    """
    Send WhatsApp notification when it's patient's turn
    
    Args:
        phone_number: Patient's phone number in any format
        patient_name: Patient's full name
        service_name: Name of the medical service
        position: Position in queue (1 means it's their turn)
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not WHATSAPP_CONFIG["enabled"]:
        logger.info("WhatsApp notifications are disabled")
        return False
    
    # Format phone number
    formatted_phone = format_phone_number(phone_number)
    if not formatted_phone:
        logger.warning(f"Invalid phone number format: {phone_number}")
        return False
    
    # Create message
    message = create_queue_notification_message(patient_name, service_name, position)
    
    # Test mode - just log the message
    if WHATSAPP_CONFIG["test_mode"]:
        logger.info(f"TEST MODE - Would send WhatsApp to {formatted_phone}: {message}")
        return True
    
    # Import pywhatkit when needed
    pywhatkit = _import_pywhatkit()
    if not pywhatkit:
        logger.error("pywhatkit not available for WhatsApp notifications")
        return False
    
    try:
        # Send WhatsApp message
        logger.info(f"Sending WhatsApp notification to {formatted_phone} for {patient_name}")
        
        # Run pywhatkit in a thread to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: pywhatkit.sendwhatmsg_instantly(
                phone_no=formatted_phone,
                message=message,
                wait_time=WHATSAPP_CONFIG["wait_time"],
                tab_close=WHATSAPP_CONFIG["tab_close"]
            )
        )
        
        logger.info(f"✅ WhatsApp notification sent successfully to {formatted_phone}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {formatted_phone}: {str(e)}")
        return False

@handle_whatsapp_errors
async def send_position_update_notification(
    phone_number: str,
    patient_name: str,
    service_name: str,
    new_position: int
) -> bool:
    """
    Send position update notification (optional feature)
    Only sends if position is 1 or 2 to avoid spam
    """
    if new_position > 2:
        return False  # Don't send for positions > 2
    
    return await send_whatsapp_notification(
        phone_number=phone_number,
        patient_name=patient_name,
        service_name=service_name,
        position=new_position
    )

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
    
    logger.info(f"WhatsApp configuration updated: {WHATSAPP_CONFIG}")

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
    return result

if __name__ == "__main__":
    # Test the service when run directly
    asyncio.run(test_whatsapp_service())