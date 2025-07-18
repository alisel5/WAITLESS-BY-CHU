from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import UserRole, ServicePriority, ServiceStatus, TicketStatus


# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.PATIENT
    assigned_service_id: Optional[int] = None  # For staff/doctors


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    role: UserRole
    assigned_service_id: Optional[int]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Service schemas
class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: str
    max_wait_time: int = 30
    priority: ServicePriority = ServicePriority.MEDIUM
    status: ServiceStatus = ServiceStatus.ACTIVE


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    max_wait_time: Optional[int] = None
    priority: Optional[ServicePriority] = None
    status: Optional[ServiceStatus] = None


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    location: str
    max_wait_time: int
    priority: ServicePriority
    status: ServiceStatus
    current_waiting: int
    avg_wait_time: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Ticket schemas
class TicketCreate(BaseModel):
    service_id: int
    priority: ServicePriority = ServicePriority.MEDIUM
    estimated_arrival: Optional[datetime] = None
    notes: Optional[str] = None


class TicketJoinOnline(BaseModel):
    patient_name: str
    patient_phone: str
    patient_email: EmailStr
    service_id: int
    priority: ServicePriority = ServicePriority.MEDIUM
    estimated_arrival: Optional[datetime] = None
    notes: Optional[str] = None


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[ServicePriority] = None
    notes: Optional[str] = None


class TicketResponse(BaseModel):
    id: int
    ticket_number: str
    patient_id: int
    service_id: int
    status: TicketStatus
    priority: ServicePriority
    position_in_queue: int
    estimated_wait_time: int
    qr_code: Optional[str]
    notes: Optional[str]
    estimated_arrival: Optional[datetime]
    actual_arrival: Optional[datetime]
    created_at: datetime
    
    # Relationships
    patient: UserResponse
    service: ServiceResponse
    
    class Config:
        from_attributes = True


class TicketSimpleResponse(BaseModel):
    ticket_number: str
    position_in_queue: int
    estimated_wait_time: int
    service_name: str
    status: TicketStatus
    qr_code: Optional[str]


# Queue schemas
class QueuePosition(BaseModel):
    ticket_number: str
    position: int
    estimated_wait_time: int


class QueueStatus(BaseModel):
    service_id: int
    service_name: str
    total_waiting: int
    current_position: Optional[int] = None
    avg_wait_time: int
    queue: List[QueuePosition]


# Dashboard schemas
class DashboardStats(BaseModel):
    total_waiting: int
    total_consulting: int
    active_services: int
    avg_wait_time: int
    services: List[ServiceResponse]


class AlertCreate(BaseModel):
    type: str
    message: str
    service_id: Optional[int] = None


class AlertResponse(BaseModel):
    id: int
    type: str
    message: str
    service_id: Optional[int]
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# QR Code scan
class QRCodeScan(BaseModel):
    qr_data: str


# Flexible QR scan response
class QRScanResponse(BaseModel):
    type: str  # "service_join" or "ticket_status"
    service_id: Optional[int] = None
    service_name: Optional[str] = None
    location: Optional[str] = None
    current_waiting: Optional[int] = None
    avg_wait_time: Optional[int] = None
    message: Optional[str] = None
    ticket_number: Optional[str] = None
    position_in_queue: Optional[int] = None
    estimated_wait_time: Optional[int] = None
    status: Optional[TicketStatus] = None
    qr_code: Optional[str] = None


class PatientCreate(BaseModel):
    firstName: str
    lastName: str
    age: int
    phone: str
    service: str
    priority: ServicePriority
    notes: Optional[str] = None


class PatientUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    age: Optional[int] = None
    phone: Optional[str] = None
    service: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[ServicePriority] = None
    notes: Optional[str] = None 