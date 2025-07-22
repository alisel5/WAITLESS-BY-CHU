"""
Create chatbot database tables for WaitLess CHU
"""

from sqlalchemy import create_engine
from models import Base, ChatConversation, ChatMessage
from database import SQLALCHEMY_DATABASE_URL
import sys

def create_chatbot_tables():
    """Create the chatbot-related database tables"""
    try:
        # Create engine
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        
        print("🤖 Creating chatbot tables...")
        
        # Create all tables (will only create new ones)
        Base.metadata.create_all(bind=engine)
        
        print("✅ Chatbot tables created successfully!")
        print("📋 Tables created:")
        print("   - chat_conversations")
        print("   - chat_messages")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating chatbot tables: {e}")
        return False

if __name__ == "__main__":
    success = create_chatbot_tables()
    if not success:
        sys.exit(1)