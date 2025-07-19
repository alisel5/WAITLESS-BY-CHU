"""
Async Notification Service
Handles WebSocket broadcasting without blocking API responses
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import json
from websocket_manager import connection_manager

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Handles asynchronous notifications to prevent API blocking.
    Uses fire-and-forget pattern for WebSocket broadcasts.
    """
    
    def __init__(self):
        self._notification_queue = asyncio.Queue()
        self._background_task = None
        self._is_running = False
    
    async def start(self):
        """Start the background notification processor"""
        if self._is_running:
            return
        
        self._is_running = True
        self._background_task = asyncio.create_task(self._process_notifications())
        logger.info("Notification service started")
    
    async def stop(self):
        """Stop the background notification processor"""
        self._is_running = False
        if self._background_task:
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass
        logger.info("Notification service stopped")
    
    async def _process_notifications(self):
        """Background task to process notification queue"""
        while self._is_running:
            try:
                # Wait for notifications with timeout to allow graceful shutdown
                notification = await asyncio.wait_for(
                    self._notification_queue.get(), 
                    timeout=1.0
                )
                await self._handle_notification(notification)
                self._notification_queue.task_done()
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing notification: {e}")
    
    async def _handle_notification(self, notification: Dict[str, Any]):
        """Handle individual notification based on type"""
        try:
            notification_type = notification.get("type")
            
            if notification_type == "patient_called":
                await self._notify_patient_called(notification)
            elif notification_type == "queue_position_update":
                await self._notify_queue_position_update(notification)
            elif notification_type == "ticket_update":
                await self._notify_ticket_update(notification)
            elif notification_type == "admin_alert":
                await self._notify_admin_alert(notification)
            else:
                logger.warning(f"Unknown notification type: {notification_type}")
        
        except Exception as e:
            logger.error(f"Error handling notification {notification.get('type')}: {e}")
    
    async def _notify_patient_called(self, notification: Dict[str, Any]):
        """Handle patient called notifications"""
        service_id = notification.get("service_id")
        data = notification.get("data", {})
        
        if service_id:
            await connection_manager.patient_called(str(service_id), data)
            
            # Also notify the specific patient
            ticket_number = data.get("ticket_number")
            if ticket_number:
                await connection_manager.send_to_ticket(ticket_number, {
                    "type": "called_for_consultation",
                    "message": "You are being called for consultation",
                    **data
                })
    
    async def _notify_queue_position_update(self, notification: Dict[str, Any]):
        """Handle queue position update notifications"""
        service_id = notification.get("service_id")
        data = notification.get("data", {})
        
        if service_id:
            await connection_manager.queue_position_update(str(service_id), data)
    
    async def _notify_ticket_update(self, notification: Dict[str, Any]):
        """Handle individual ticket update notifications"""
        ticket_number = notification.get("ticket_number")
        data = notification.get("data", {})
        
        if ticket_number:
            await connection_manager.send_to_ticket(ticket_number, data)
    
    async def _notify_admin_alert(self, notification: Dict[str, Any]):
        """Handle admin alert notifications"""
        data = notification.get("data", {})
        await connection_manager.broadcast_to_admins(data)
    
    # Public methods for enqueueing notifications (fire-and-forget)
    
    def notify_patient_called(self, service_id: int, data: Dict[str, Any]):
        """Queue a patient called notification (non-blocking)"""
        notification = {
            "type": "patient_called",
            "service_id": service_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._enqueue_notification(notification)
    
    def notify_queue_position_update(self, service_id: int, data: Dict[str, Any]):
        """Queue a queue position update notification (non-blocking)"""
        notification = {
            "type": "queue_position_update",
            "service_id": service_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._enqueue_notification(notification)
    
    def notify_ticket_update(self, ticket_number: str, data: Dict[str, Any]):
        """Queue a ticket update notification (non-blocking)"""
        notification = {
            "type": "ticket_update",
            "ticket_number": ticket_number,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._enqueue_notification(notification)
    
    def notify_admin_alert(self, data: Dict[str, Any]):
        """Queue an admin alert notification (non-blocking)"""
        notification = {
            "type": "admin_alert",
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._enqueue_notification(notification)
    
    def _enqueue_notification(self, notification: Dict[str, Any]):
        """Add notification to queue (non-blocking)"""
        try:
            # Use put_nowait to avoid blocking
            self._notification_queue.put_nowait(notification)
        except asyncio.QueueFull:
            logger.warning("Notification queue is full, dropping notification")
        except Exception as e:
            logger.error(f"Error enqueueing notification: {e}")

# Global notification service instance
notification_service = NotificationService()

async def start_notification_service():
    """Start the global notification service"""
    await notification_service.start()

async def stop_notification_service():
    """Stop the global notification service"""
    await notification_service.stop()