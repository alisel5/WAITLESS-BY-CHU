"""
Intelligent Chatbot Service for WaitLess CHU
Provides contextual assistance for both patients and administrators
"""

import json
import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
import httpx
from openai import OpenAI

from models import (
    ChatConversation, ChatMessage, ChatbotRole, User, Service, Ticket, 
    TicketStatus, ServiceStatus, QueueLog, UserRole
)
from config import settings


class ChatbotService:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url
        )
        
        # Knowledge base about CHU hospital departments
        self.chu_departments = {
            "cardiologie": {
                "name": "Cardiologie",
                "location": "Bâtiment A, 2ème étage",
                "description": "Diagnostic et traitement des maladies cardiovasculaires",
                "services": ["ECG", "Échographie cardiaque", "Consultation cardiologique"],
                "urgence": True
            },
            "neurologie": {
                "name": "Neurologie", 
                "location": "Bâtiment B, 3ème étage",
                "description": "Diagnostic et traitement des troubles neurologiques",
                "services": ["IRM cérébrale", "EEG", "Consultation neurologique"],
                "urgence": True
            },
            "urgences": {
                "name": "Urgences",
                "location": "Rez-de-chaussée, entrée principale",
                "description": "Prise en charge des urgences médicales",
                "services": ["Traumatologie", "Médecine d'urgence", "Tri des urgences"],
                "urgence": True
            },
            "radiologie": {
                "name": "Radiologie",
                "location": "Sous-sol, secteur imagerie",
                "description": "Examens d'imagerie médicale",
                "services": ["Scanner", "IRM", "Radiographies", "Échographies"],
                "urgence": False
            },
            "laboratoire": {
                "name": "Laboratoire",
                "location": "Rez-de-chaussée, aile droite",
                "description": "Analyses biologiques et examens médicaux",
                "services": ["Prises de sang", "Analyses urinaires", "Biochimie"],
                "urgence": False
            },
            "dermatologie": {
                "name": "Dermatologie",
                "location": "Bâtiment C, 1er étage",
                "description": "Diagnostic et traitement des maladies de la peau",
                "services": ["Consultation dermatologique", "Biopsie", "Dermatoscopie"],
                "urgence": False
            },
            "ophtalmo": {
                "name": "Ophtalmologie",
                "location": "Bâtiment A, 1er étage",
                "description": "Diagnostic et traitement des troubles oculaires",
                "services": ["Examen de la vue", "Fond d'œil", "Tonométrie"],
                "urgence": False
            },
            "pediatrie": {
                "name": "Pédiatrie",
                "location": "Bâtiment D, tous étages",
                "description": "Soins médicaux pour enfants et adolescents",
                "services": ["Consultation pédiatrique", "Vaccinations", "Urgences pédiatriques"],
                "urgence": True
            }
        }

    async def get_conversation(self, session_id: str, user_id: Optional[int], 
                             chatbot_role: ChatbotRole, db: Session) -> ChatConversation:
        """Get or create conversation for the session"""
        # Try to find existing active conversation
        conversation = db.query(ChatConversation).filter(
            and_(
                ChatConversation.session_id == session_id,
                ChatConversation.is_active == True
            )
        ).first()
        
        if not conversation:
            # Create new conversation
            conversation = ChatConversation(
                user_id=user_id,
                session_id=session_id,
                chatbot_role=chatbot_role,
                context=json.dumps({}),
                is_active=True
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            
        return conversation

    async def save_message(self, conversation_id: int, message: str, 
                          is_user_message: bool, metadata: Optional[Dict] = None, 
                          db: Session = None) -> ChatMessage:
        """Save a message to the conversation"""
        chat_message = ChatMessage(
            conversation_id=conversation_id,
            message=message,
            is_user_message=is_user_message,
            message_metadata=json.dumps(metadata) if metadata else None
        )
        db.add(chat_message)
        db.commit()
        db.refresh(chat_message)
        return chat_message

    def get_patient_system_prompt(self) -> str:
        """System prompt for patient assistance"""
        departments_text = "\n".join([
            f"- {dept['name']}: {dept['location']} - {dept['description']}"
            for dept in self.chu_departments.values()
        ])
        
        return f"""Vous êtes un assistant virtuel intelligent pour les patients du CHU (Centre Hospitalier Universitaire).

VOTRE RÔLE:
- Aider les patients à trouver le bon service médical
- Fournir des informations sur les départements et leur localisation
- Expliquer les procédures d'attente et de file d'attente
- Rassurer et guider les patients
- Répondre aux questions générales sur l'hôpital

DÉPARTEMENTS DISPONIBLES:
{departments_text}

INSTRUCTIONS:
1. Soyez chaleureux, empathique et professionnel
2. Posez des questions pour mieux comprendre les besoins du patient
3. Orientez vers le bon département en fonction des symptômes/besoins
4. Expliquez comment utiliser le système de file d'attente (scan QR code)
5. Si c'est urgent, dirigez vers les Urgences immédiatement
6. Ne donnez JAMAIS de conseils médicaux - orientez vers un professionnel
7. Répondez en français

EXEMPLE DE CONVERSATION:
Patient: "J'ai mal à la tête depuis 3 jours"
Vous: "Je comprends que vous ayez des maux de tête persistants. Pour ce type de symptômes, je vous recommande de consulter le service de Neurologie (Bâtiment B, 3ème étage). Si la douleur est très intense ou accompagnée d'autres symptômes inquiétants, n'hésitez pas à vous rendre aux Urgences. Souhaitez-vous que je vous explique comment rejoindre la file d'attente?"

Commencez toujours par saluer chaleureusement le patient."""

    def get_admin_system_prompt(self, admin_stats: Dict) -> str:
        """System prompt for admin assistance"""
        return f"""Vous êtes un assistant administratif intelligent pour le personnel du CHU WaitLess.

VOTRE RÔLE:
- Aider avec les tâches administratives quotidiennes
- Analyser les données du système
- Fournir des résumés et des insights
- Assister avec la gestion des files d'attente
- Répondre aux questions sur le système

DONNÉES ACTUELLES DU SYSTÈME:
- Patients en attente: {admin_stats.get('total_waiting', 0)}
- Services actifs: {admin_stats.get('active_services', 0)}
- Temps d'attente moyen: {admin_stats.get('avg_wait_time', 0)} minutes
- Tickets aujourd'hui: {admin_stats.get('today_tickets', 0)}

INSTRUCTIONS:
1. Soyez professionnel et efficace
2. Fournissez des analyses basées sur les données réelles
3. Proposez des actions concrètes
4. Aidez à identifier les problèmes potentiels
5. Suggérez des optimisations
6. Répondez en français

EXEMPLES DE TÂCHES:
- "Résumez l'activité d'aujourd'hui"
- "Quels services ont le plus d'attente?"
- "Comment optimiser les temps d'attente?"
- "Générez un rapport de performance"

Commencez par saluer l'administrateur et proposer votre aide."""

    async def get_context_data(self, user_id: Optional[int], chatbot_role: ChatbotRole, 
                              db: Session) -> Dict:
        """Get relevant context data for the conversation"""
        context = {}
        
        if chatbot_role == ChatbotRole.PATIENT_ASSISTANT:
            # For patients, get their current tickets and queue info
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    active_tickets = db.query(Ticket).filter(
                        and_(
                            Ticket.patient_id == user_id,
                            Ticket.status == TicketStatus.WAITING
                        )
                    ).all()
                    
                    context = {
                        "user_name": user.full_name,
                        "user_role": user.role.value,
                        "active_tickets": len(active_tickets),
                        "tickets": [
                            {
                                "ticket_number": ticket.ticket_number,
                                "service": ticket.service.name,
                                "position": ticket.position_in_queue,
                                "estimated_wait": ticket.estimated_wait_time
                            }
                            for ticket in active_tickets
                        ]
                    }
            
            # Get general queue information (including emergency services)
            services = db.query(Service).filter(
                Service.status.in_([ServiceStatus.ACTIVE, ServiceStatus.EMERGENCY])
            ).all()
            context["available_services"] = [
                {
                    "id": service.id,
                    "name": service.name,
                    "location": service.location,
                    "current_waiting": service.current_waiting,
                    "avg_wait_time": service.avg_wait_time
                }
                for service in services
            ]
            
        elif chatbot_role == ChatbotRole.ADMIN_ASSISTANT:
            # For admin, get comprehensive system data
            total_waiting = db.query(Ticket).filter(Ticket.status == TicketStatus.WAITING).count()
            active_services = db.query(Service).filter(
                Service.status.in_([ServiceStatus.ACTIVE, ServiceStatus.EMERGENCY])
            ).count()
            avg_wait_time = db.query(func.avg(Ticket.estimated_wait_time)).scalar() or 0
            
            today = datetime.now().date()
            today_tickets = db.query(Ticket).filter(
                func.date(Ticket.created_at) == today
            ).count()
            
            # Get service-specific data (including emergency services)
            services_data = db.query(Service).filter(
                Service.status.in_([ServiceStatus.ACTIVE, ServiceStatus.EMERGENCY])
            ).all()
            
            context = {
                "total_waiting": total_waiting,
                "active_services": active_services,
                "avg_wait_time": int(avg_wait_time),
                "today_tickets": today_tickets,
                "services": [
                    {
                        "name": service.name,
                        "current_waiting": service.current_waiting,
                        "avg_wait_time": service.avg_wait_time,
                        "location": service.location
                    }
                    for service in services_data
                ]
            }
            
        return context

    async def analyze_user_intent(self, message: str) -> Dict:
        """Analyze user message to understand intent"""
        message_lower = message.lower()
        
        # Health/symptom keywords
        symptom_keywords = {
            "coeur": "cardiologie",
            "cardiaque": "cardiologie", 
            "palpitations": "cardiologie",
            "tension": "cardiologie",
            "tête": "neurologie",
            "maux de tête": "neurologie",
            "migraine": "neurologie",
            "vertige": "neurologie",
            "peau": "dermatologie",
            "bouton": "dermatologie",
            "éruption": "dermatologie",
            "yeux": "ophtalmo",
            "vue": "ophtalmo",
            "vision": "ophtalmo",
            "enfant": "pediatrie",
            "bébé": "pediatrie",
            "sang": "laboratoire",
            "analyse": "laboratoire",
            "radio": "radiologie",
            "scanner": "radiologie",
            "irm": "radiologie",
            "urgent": "urgences",
            "urgence": "urgences",
            "douleur": "urgences"
        }
        
        intent = {
            "type": "general",
            "suggested_department": None,
            "urgency": "normal",
            "keywords": []
        }
        
        # Check for department-related keywords
        for keyword, department in symptom_keywords.items():
            if keyword in message_lower:
                intent["suggested_department"] = department
                intent["keywords"].append(keyword)
                
        # Check urgency indicators
        urgency_indicators = ["urgent", "urgence", "grave", "douleur forte", "ne peut pas", "très mal"]
        if any(indicator in message_lower for indicator in urgency_indicators):
            intent["urgency"] = "high"
            
        # Determine intent type
        if any(word in message_lower for word in ["où", "service", "département", "aller"]):
            intent["type"] = "department_inquiry"
        elif any(word in message_lower for word in ["attente", "file", "temps", "position"]):
            intent["type"] = "queue_inquiry"
        elif any(word in message_lower for word in ["symptôme", "mal", "douleur", "problème"]):
            intent["type"] = "symptom_inquiry"
            
        return intent

    async def generate_response(self, message: str, conversation: ChatConversation,
                              context: Dict, db: Session) -> str:
        """Generate AI response using OpenRouter with DeepSeek model"""
        try:
            # Get conversation history
            recent_messages = db.query(ChatMessage).filter(
                ChatMessage.conversation_id == conversation.id
            ).order_by(ChatMessage.created_at.desc()).limit(10).all()
            
            # Build conversation history for context
            conversation_history = []
            for msg in reversed(recent_messages):
                role = "user" if msg.is_user_message else "assistant"
                conversation_history.append({
                    "role": role,
                    "content": msg.message
                })
            
            # Get appropriate system prompt
            if conversation.chatbot_role == ChatbotRole.PATIENT_ASSISTANT:
                system_prompt = self.get_patient_system_prompt()
            else:
                system_prompt = self.get_admin_system_prompt(context)
            
            # Analyze user intent for better responses
            intent = await self.analyze_user_intent(message)
            
            # Enhance message with context if available
            enhanced_message = message
            if context.get("user_name"):
                enhanced_message = f"Patient: {context['user_name']} - {message}"
            if context.get("active_tickets"):
                enhanced_message += f"\n[CONTEXTE: Le patient a {context['active_tickets']} tickets actifs]"
            if intent["suggested_department"]:
                enhanced_message += f"\n[SUGGESTION AUTOMATIQUE: {intent['suggested_department']}]"
                
            # Build messages for API call
            messages = [
                {"role": "system", "content": system_prompt},
                *conversation_history,
                {"role": "user", "content": enhanced_message}
            ]
            
            # Call OpenRouter API with DeepSeek model
            response = self.client.chat.completions.create(
                model=settings.openrouter_model,
                messages=messages,
                max_tokens=500,
                temperature=0.7,
                stream=False
            )
            
            ai_response = response.choices[0].message.content.strip()
            
            # Post-process response for better integration
            if conversation.chatbot_role == ChatbotRole.PATIENT_ASSISTANT:
                # Add helpful action buttons or suggestions
                if intent["suggested_department"] and intent["suggested_department"] in self.chu_departments:
                    dept = self.chu_departments[intent["suggested_department"]]
                    ai_response += f"\n\n📍 **{dept['name']}** se trouve: {dept['location']}"
                    
                if intent["urgency"] == "high":
                    ai_response += "\n\n🚨 **Si c'est une urgence, rendez-vous immédiatement aux Urgences (Rez-de-chaussée, entrée principale).**"
                    
            return ai_response
            
        except Exception as e:
            print(f"Error generating AI response: {e}")
            # Fallback response
            if conversation.chatbot_role == ChatbotRole.PATIENT_ASSISTANT:
                return "Je m'excuse, je rencontre un problème technique avec l'assistant IA. Pour une aide immédiate, veuillez vous adresser à l'accueil ou composer le numéro d'urgence interne."
            else:
                return "Désolé, je rencontre un problème technique avec l'assistant IA. Veuillez réessayer dans quelques instants."

    async def chat(self, message: str, session_id: str, user_id: Optional[int],
                  chatbot_role: ChatbotRole, db: Session) -> Dict:
        """Main chat function"""
        try:
            # Get or create conversation
            conversation = await self.get_conversation(session_id, user_id, chatbot_role, db)
            
            # Save user message
            await self.save_message(
                conversation.id, message, True, 
                {"timestamp": datetime.now().isoformat()}, db
            )
            
            # Get context data
            context = await self.get_context_data(user_id, chatbot_role, db)
            
            # Generate AI response
            ai_response = await self.generate_response(message, conversation, context, db)
            
            # Save AI response
            await self.save_message(
                conversation.id, ai_response, False,
                {"timestamp": datetime.now().isoformat(), "context": context}, db
            )
            
            return {
                "success": True,
                "response": ai_response,
                "conversation_id": conversation.id,
                "session_id": session_id,
                "context": context
            }
            
        except Exception as e:
            print(f"Chat error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "Je m'excuse, une erreur s'est produite. Veuillez réessayer."
            }

    async def get_conversation_history(self, session_id: str, db: Session) -> List[Dict]:
        """Get conversation history for a session"""
        conversation = db.query(ChatConversation).filter(
            ChatConversation.session_id == session_id
        ).first()
        
        if not conversation:
            return []
            
        messages = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation.id
        ).order_by(ChatMessage.created_at.asc()).all()
        
        return [
            {
                "id": msg.id,
                "message": msg.message,
                "is_user_message": msg.is_user_message,
                "timestamp": msg.created_at.isoformat(),
                "metadata": json.loads(msg.message_metadata) if msg.message_metadata else {}
            }
            for msg in messages
        ]

    async def end_conversation(self, session_id: str, db: Session) -> bool:
        """End a conversation"""
        conversation = db.query(ChatConversation).filter(
            ChatConversation.session_id == session_id
        ).first()
        
        if conversation:
            conversation.is_active = False
            conversation.updated_at = datetime.now()
            db.commit()
            return True
        return False

# Global chatbot service instance
chatbot_service = ChatbotService()