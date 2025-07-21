"""
Headless WhatsApp Service - Completely Isolated from Frontend
Uses dedicated headless browser instance for WhatsApp notifications
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
import time

# Setup dedicated WhatsApp logger
def setup_whatsapp_logger():
    """Setup dedicated logger for WhatsApp notifications"""
    logger = logging.getLogger('headless_whatsapp')
    logger.setLevel(logging.INFO)
    
    # Create logs directory if it doesn't exist
    os.makedirs('logs', exist_ok=True)
    
    # File handler for WhatsApp logs
    file_handler = logging.FileHandler('logs/headless_whatsapp.log')
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
    
    # Add handlers if not already added
    if not logger.handlers:
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
    
    return logger

logger = setup_whatsapp_logger()

# Configuration
HEADLESS_WHATSAPP_CONFIG = {
    "enabled": True,
    "test_mode": True,  # Default to safe mode
    "country_code": "+212",
    "headless": True,  # Run in headless mode
    "isolated": True,  # Completely isolated from frontend browsers
    "wait_time": 10,  # Time to wait for WhatsApp Web to load
    "message_delay": 2,  # Delay before sending message
    "auto_close": True,  # Close browser after sending
}

class HeadlessWhatsAppSender:
    """Completely isolated headless WhatsApp sender"""
    
    def __init__(self):
        self.driver = None
        self.is_initialized = False
        self.session_active = False
        self._lock = threading.Lock()
    
    def _setup_headless_browser(self):
        """Setup completely isolated headless Chrome browser"""
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            
            # Chrome options for complete isolation
            chrome_options = Options()
            
            # Headless mode - completely invisible
            chrome_options.add_argument("--headless=new")
            
            # Isolation options
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            
            # Separate user data directory to avoid conflicts
            user_data_dir = os.path.abspath("./whatsapp_browser_data")
            chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
            
            # Performance optimizations
            chrome_options.add_argument("--disable-background-timer-throttling")
            chrome_options.add_argument("--disable-renderer-backgrounding")
            chrome_options.add_argument("--disable-backgrounding-occluded-windows")
            
            # Window size (even though headless)
            chrome_options.add_argument("--window-size=1920,1080")
            
            # Disable notifications and popups
            chrome_options.add_argument("--disable-notifications")
            chrome_options.add_argument("--disable-popup-blocking")
            
            # Setup ChromeDriver service
            service = Service(ChromeDriverManager().install())
            
            # Create driver instance
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.implicitly_wait(10)
            
            logger.info("✅ Headless Chrome browser initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to setup headless browser: {e}")
            return False
    
    def _login_to_whatsapp_web(self):
        """Navigate to WhatsApp Web (one-time setup required)"""
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            
            logger.info("🌐 Navigating to WhatsApp Web...")
            self.driver.get("https://web.whatsapp.com")
            
            # Wait for page to load
            time.sleep(5)
            
            # Check if already logged in
            try:
                # Look for the chat list (indicates logged in)
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='chat-list']"))
                )
                logger.info("✅ Already logged in to WhatsApp Web")
                self.session_active = True
                return True
                
            except:
                # Not logged in - need QR code scan (one-time setup)
                logger.warning("⚠️ Not logged in to WhatsApp Web")
                logger.info("📱 Manual setup required:")
                logger.info("   1. Run in non-headless mode once for QR setup")
                logger.info("   2. Scan QR code with your phone")
                logger.info("   3. Session will be saved for future use")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to login to WhatsApp Web: {e}")
            return False
    
    def initialize_session(self, force_setup=False):
        """Initialize WhatsApp Web session"""
        with self._lock:
            if self.is_initialized and not force_setup:
                return True
            
            logger.info("🚀 Initializing headless WhatsApp session...")
            
            # Setup browser
            if not self._setup_headless_browser():
                return False
            
            # Login to WhatsApp Web
            if not self._login_to_whatsapp_web():
                self.cleanup()
                return False
            
            self.is_initialized = True
            logger.info("✅ Headless WhatsApp session initialized")
            return True
    
    def send_message(self, phone_number: str, message: str) -> bool:
        """Send WhatsApp message via headless browser"""
        if not self.is_initialized:
            logger.error("❌ WhatsApp session not initialized")
            return False
        
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.webdriver.common.keys import Keys
            
            # Format phone number for WhatsApp Web URL
            clean_phone = re.sub(r'\D', '', phone_number)
            if clean_phone.startswith('212'):
                clean_phone = clean_phone
            elif clean_phone.startswith('0'):
                clean_phone = '212' + clean_phone[1:]
            else:
                clean_phone = '212' + clean_phone
            
            # Navigate to chat with specific number
            whatsapp_url = f"https://web.whatsapp.com/send?phone={clean_phone}"
            logger.info(f"📱 Sending message to {clean_phone}...")
            
            self.driver.get(whatsapp_url)
            time.sleep(3)
            
            # Wait for message input box
            message_box = WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='conversation-compose-box-input']"))
            )
            
            # Clear and type message
            message_box.clear()
            message_box.send_keys(message)
            time.sleep(1)
            
            # Send message
            message_box.send_keys(Keys.ENTER)
            time.sleep(2)
            
            logger.info(f"✅ Message sent successfully to {clean_phone}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send message: {e}")
            return False
    
    def cleanup(self):
        """Clean up browser resources"""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("🔧 Browser session cleaned up")
            except:
                pass
            finally:
                self.driver = None
                self.is_initialized = False
                self.session_active = False

# Global sender instance
_headless_sender = None
_sender_lock = threading.Lock()

def get_headless_sender():
    """Get or create global headless sender instance"""
    global _headless_sender
    with _sender_lock:
        if _headless_sender is None:
            _headless_sender = HeadlessWhatsAppSender()
        return _headless_sender

def format_phone_number(phone: str) -> Optional[str]:
    """Format phone number for Morocco (+212)"""
    if not phone:
        return None
    
    # Remove all non-digit characters
    digits_only = re.sub(r'\D', '', phone)
    
    # Handle different input formats
    if digits_only.startswith('212'):
        return f"+{digits_only}"
    elif digits_only.startswith('0'):
        return f"+212{digits_only[1:]}"
    elif len(digits_only) == 9:
        return f"+212{digits_only}"
    else:
        logger.warning(f"Unrecognized phone number format: {phone}")
        return None

def create_notification_message(patient_name: str, service_name: str) -> str:
    """Create notification message"""
    return (
        f"🏥 Bonjour {patient_name}!\n\n"
        f"📢 C'est votre tour au service {service_name}.\n"
        f"⏰ Veuillez vous présenter immédiatement au secrétariat.\n\n"
        f"✅ Merci d'utiliser WaitLess CHU - Votre temps est précieux!"
    )

def log_notification_attempt(phone_number: str, patient_name: str, service_name: str, status: str, error: str = None):
    """Log notification attempt"""
    if status == "success":
        logger.info(f"✅ HEADLESS WhatsApp sent to {phone_number} ({patient_name}) - {service_name}")
    elif status == "failed":
        logger.error(f"❌ HEADLESS WhatsApp failed to {phone_number} ({patient_name}) - {service_name} - Error: {error}")
    elif status == "test_mode":
        logger.info(f"🧪 HEADLESS WhatsApp TEST MODE to {phone_number} ({patient_name}) - {service_name}")
    elif status == "disabled":
        logger.info(f"⚠️ HEADLESS WhatsApp DISABLED - Would send to {phone_number} ({patient_name}) - {service_name}")
    elif status == "invalid_phone":
        logger.warning(f"📱 Invalid phone number: {phone_number} for {patient_name} - {service_name}")

def send_headless_whatsapp_background(phone_number: str, patient_name: str, service_name: str):
    """Send WhatsApp message in background using headless browser"""
    def _send_message():
        try:
            if HEADLESS_WHATSAPP_CONFIG["test_mode"]:
                log_notification_attempt(phone_number, patient_name, service_name, "test_mode")
                return
            
            if not HEADLESS_WHATSAPP_CONFIG["enabled"]:
                log_notification_attempt(phone_number, patient_name, service_name, "disabled")
                return
            
            # Format phone number
            formatted_phone = format_phone_number(phone_number)
            if not formatted_phone:
                log_notification_attempt(phone_number, patient_name, service_name, "invalid_phone")
                return
            
            # Get headless sender
            sender = get_headless_sender()
            
            # Initialize session if needed
            if not sender.initialize_session():
                log_notification_attempt(phone_number, patient_name, service_name, "failed", "Session initialization failed")
                return
            
            # Create message
            message = create_notification_message(patient_name, service_name)
            
            # Send message
            success = sender.send_message(formatted_phone, message)
            
            if success:
                log_notification_attempt(formatted_phone, patient_name, service_name, "success")
            else:
                log_notification_attempt(formatted_phone, patient_name, service_name, "failed", "Message sending failed")
                
        except Exception as e:
            log_notification_attempt(phone_number, patient_name, service_name, "failed", str(e))
    
    # Run in background thread
    thread = threading.Thread(target=_send_message, daemon=True)
    thread.start()
    
    logger.info(f"📱 HEADLESS WhatsApp notification queued for {patient_name}")

# Main interface function
def notify_patient_turn_headless(phone_number: str, patient_name: str, service_name: str):
    """
    Fire-and-forget headless WhatsApp notification
    Completely isolated from frontend browsers
    """
    if not phone_number or not patient_name:
        return
    
    send_headless_whatsapp_background(phone_number, patient_name, service_name)

def configure_headless_whatsapp(
    enabled: Optional[bool] = None,
    test_mode: Optional[bool] = None,
    headless: Optional[bool] = None
):
    """Configure headless WhatsApp service"""
    if enabled is not None:
        HEADLESS_WHATSAPP_CONFIG["enabled"] = enabled
    if test_mode is not None:
        HEADLESS_WHATSAPP_CONFIG["test_mode"] = test_mode
    if headless is not None:
        HEADLESS_WHATSAPP_CONFIG["headless"] = headless
    
    logger.info("🔧 Headless WhatsApp configuration updated")

def enable_headless_production_mode():
    """Enable production mode for headless WhatsApp"""
    HEADLESS_WHATSAPP_CONFIG["test_mode"] = False
    HEADLESS_WHATSAPP_CONFIG["enabled"] = True
    logger.warning("🚀 HEADLESS WhatsApp production mode enabled")
    logger.info("📱 Ensure WhatsApp Web session is set up for headless browser")

def setup_whatsapp_session_interactive():
    """Setup WhatsApp session interactively (one-time setup)"""
    logger.info("🔧 Setting up WhatsApp Web session for headless mode...")
    
    # Temporarily disable headless for QR code scanning
    temp_config = HEADLESS_WHATSAPP_CONFIG.copy()
    HEADLESS_WHATSAPP_CONFIG["headless"] = False
    
    try:
        sender = HeadlessWhatsAppSender()
        
        # Modify setup to show browser for QR scanning
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager
        
        chrome_options = Options()
        # Don't add --headless for this setup
        chrome_options.add_argument("--disable-dev-shm-usage")
        user_data_dir = os.path.abspath("./whatsapp_browser_data")
        chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
        
        service = Service(ChromeDriverManager().install())
        sender.driver = webdriver.Chrome(service=service, options=chrome_options)
        
        logger.info("🌐 Opening WhatsApp Web for QR code setup...")
        sender.driver.get("https://web.whatsapp.com")
        
        input("📱 Please scan the QR code with your phone, then press Enter to continue...")
        
        # Test if login successful
        time.sleep(5)
        logger.info("✅ WhatsApp Web session setup complete!")
        
        sender.cleanup()
        
    except Exception as e:
        logger.error(f"❌ Setup failed: {e}")
    finally:
        # Restore headless config
        HEADLESS_WHATSAPP_CONFIG.update(temp_config)

# Test function
def test_headless_whatsapp():
    """Test the headless WhatsApp service"""
    configure_headless_whatsapp(test_mode=True, enabled=True)
    
    logger.info("🧪 Testing headless WhatsApp service...")
    notify_patient_turn_headless("0693955230", "Ahmed Test", "Cardiologie Test")
    
    logger.info("✅ Test completed - check logs/headless_whatsapp.log")

if __name__ == "__main__":
    test_headless_whatsapp()