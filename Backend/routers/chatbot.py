"""
Chatbot API Router for WaitLess CHU
Provides intelligent assistance endpoints for patients and administrators
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import uuid
from datetime import datetime

from database import get_db
from models import ChatbotRole, User
from auth import get_current_active_user, get_admin_or_staff_user
from chatbot_service import chatbot_service

router = APIRouter()


# Pydantic models for request/response
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    chatbot_role: ChatbotRole


class ChatResponse(BaseModel):
    success: bool
    response: str
    session_id: str
    conversation_id: Optional[int] = None
    context: Optional[dict] = None
    error: Optional[str] = None


class ConversationHistoryResponse(BaseModel):
    session_id: str
    messages: List[dict]


# Patient Chatbot Endpoints
@router.post("/patient/chat", response_model=ChatResponse)
async def patient_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None  # Allow anonymous access for patients
):
    """
    Patient assistance chatbot endpoint.
    Provides guidance on hospital departments, queue management, and general help.
    """
    try:
        # Generate session ID if not provided
        session_id = request.session_id or f"patient_{uuid.uuid4().hex[:8]}"
        
        # Use current user ID if authenticated, otherwise None for anonymous
        user_id = current_user.id if current_user else None
        
        # Force patient assistant role for this endpoint
        chatbot_role = ChatbotRole.PATIENT_ASSISTANT
        
        # Call chatbot service
        result = await chatbot_service.chat(
            message=request.message,
            session_id=session_id,
            user_id=user_id,
            chatbot_role=chatbot_role,
            db=db
        )
        
        return ChatResponse(
            success=result["success"],
            response=result["response"],
            session_id=result["session_id"],
            conversation_id=result.get("conversation_id"),
            context=result.get("context"),
            error=result.get("error")
        )
        
    except Exception as e:
        print(f"Patient chat error: {e}")
        return ChatResponse(
            success=False,
            response="Je m'excuse, une erreur s'est produite. Veuillez réessayer.",
            session_id=request.session_id or f"error_{uuid.uuid4().hex[:8]}",
            error=str(e)
        )


@router.post("/admin/chat", response_model=ChatResponse)
async def admin_chat(
    request: ChatRequest,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    Admin assistance chatbot endpoint.
    Provides system analytics, queue management help, and operational insights.
    Requires admin or staff authentication.
    """
    try:
        # Generate session ID if not provided
        session_id = request.session_id or f"admin_{current_user.id}_{uuid.uuid4().hex[:8]}"
        
        # Force admin assistant role for this endpoint
        chatbot_role = ChatbotRole.ADMIN_ASSISTANT
        
        # Call chatbot service
        result = await chatbot_service.chat(
            message=request.message,
            session_id=session_id,
            user_id=current_user.id,
            chatbot_role=chatbot_role,
            db=db
        )
        
        return ChatResponse(
            success=result["success"],
            response=result["response"],
            session_id=result["session_id"],
            conversation_id=result.get("conversation_id"),
            context=result.get("context"),
            error=result.get("error")
        )
        
    except Exception as e:
        print(f"Admin chat error: {e}")
        return ChatResponse(
            success=False,
            response="Désolé, une erreur s'est produite. Veuillez réessayer.",
            session_id=request.session_id or f"error_{uuid.uuid4().hex[:8]}",
            error=str(e)
        )


@router.get("/patient/history/{session_id}", response_model=ConversationHistoryResponse)
async def get_patient_conversation_history(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Get conversation history for a patient session.
    Available to anyone with the session ID.
    """
    try:
        messages = await chatbot_service.get_conversation_history(session_id, db)
        
        return ConversationHistoryResponse(
            session_id=session_id,
            messages=messages
        )
        
    except Exception as e:
        print(f"Error getting patient conversation history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération de l'historique"
        )


@router.get("/admin/history/{session_id}", response_model=ConversationHistoryResponse)
async def get_admin_conversation_history(
    session_id: str,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get conversation history for an admin session.
    Requires admin or staff authentication.
    """
    try:
        messages = await chatbot_service.get_conversation_history(session_id, db)
        
        return ConversationHistoryResponse(
            session_id=session_id,
            messages=messages
        )
        
    except Exception as e:
        print(f"Error getting admin conversation history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération de l'historique"
        )


@router.post("/patient/end-conversation/{session_id}")
async def end_patient_conversation(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    End a patient conversation session.
    """
    try:
        success = await chatbot_service.end_conversation(session_id, db)
        
        return {
            "success": success,
            "message": "Conversation terminée" if success else "Session non trouvée"
        }
        
    except Exception as e:
        print(f"Error ending patient conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la fermeture de la conversation"
        )


@router.post("/admin/end-conversation/{session_id}")
async def end_admin_conversation(
    session_id: str,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    End an admin conversation session.
    Requires admin or staff authentication.
    """
    try:
        success = await chatbot_service.end_conversation(session_id, db)
        
        return {
            "success": success,
            "message": "Conversation terminée" if success else "Session non trouvée"
        }
        
    except Exception as e:
        print(f"Error ending admin conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la fermeture de la conversation"
        )


@router.get("/departments")
async def get_department_info():
    """
    Get information about hospital departments.
    Public endpoint for chatbot knowledge base.
    """
    return {
        "departments": chatbot_service.chu_departments,
        "message": "Informations sur les départements du CHU"
    }


@router.get("/health")
async def chatbot_health_check():
    """
    Health check endpoint for the chatbot service.
    """
    try:
        # Simple test to verify the service is working
        test_session = f"health_check_{uuid.uuid4().hex[:8]}"
        
        return {
            "status": "healthy",
            "service": "Chatbot WaitLess CHU",
            "deepseek_configured": bool(chatbot_service.client),
            "departments_loaded": len(chatbot_service.chu_departments),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Chatbot health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service chatbot indisponible"
        )