from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(enum.Enum):
    PATIENT = "patient"
    ADMIN = "admin"  # Full system access
    STAFF = "staff"  # Department secretary/nurse
    DOCTOR = "doctor"  # Medical staff


class ServicePriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ServiceStatus(enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    EMERGENCY = "emergency"


class TicketStatus(enum.Enum):
    WAITING = "waiting"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ChatbotRole(enum.Enum):
    PATIENT_ASSISTANT = "patient_assistant"
    ADMIN_ASSISTANT = "admin_assistant"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.PATIENT)
    assigned_service_id = Column(Integer, ForeignKey("services.id"), nullable=True)  # For staff/doctors
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    tickets = relationship("Ticket", back_populates="patient")
    assigned_service = relationship("Service", foreign_keys=[assigned_service_id])
    chat_conversations = relationship("ChatConversation", back_populates="user")


class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=False)
    max_wait_time = Column(Integer, default=30)  # in minutes
    priority = Column(Enum(ServicePriority), default=ServicePriority.MEDIUM)
    status = Column(Enum(ServiceStatus), default=ServiceStatus.ACTIVE)
    current_waiting = Column(Integer, default=0)
    avg_wait_time = Column(Integer, default=0)  # in minutes
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    tickets = relationship("Ticket", back_populates="service")


class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    status = Column(Enum(TicketStatus), default=TicketStatus.WAITING)
    priority = Column(Enum(ServicePriority), default=ServicePriority.MEDIUM)
    position_in_queue = Column(Integer, nullable=False)
    estimated_wait_time = Column(Integer, default=0)  # in minutes
    qr_code = Column(String, nullable=True)  # QR code data
    notes = Column(Text, nullable=True)
    estimated_arrival = Column(DateTime(timezone=True), nullable=True)
    actual_arrival = Column(DateTime(timezone=True), nullable=True)
    consultation_start = Column(DateTime(timezone=True), nullable=True)
    consultation_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    patient = relationship("User", back_populates="tickets")
    service = relationship("Service", back_populates="tickets")


class QueueLog(Base):
    __tablename__ = "queue_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True)  # Allow null for system actions
    action = Column(String, nullable=False)  # joined, called, completed, cancelled
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    details = Column(Text, nullable=True)
    
    # Relationships
    ticket = relationship("Ticket")


class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # warning, info, success, error
    message = Column(String, nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    service = relationship("Service")


class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null for anonymous patients
    session_id = Column(String, nullable=False, index=True)  # For anonymous sessions
    chatbot_role = Column(Enum(ChatbotRole), nullable=False)
    context = Column(Text, nullable=True)  # JSON string with conversation context
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="chat_conversations")
    messages = relationship("ChatMessage", back_populates="conversation")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_user_message = Column(Boolean, default=True)  # True for user, False for bot
    message_metadata = Column(Text, nullable=True)  # JSON string for additional data
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("ChatConversation", back_populates="messages") 