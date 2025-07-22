from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:serpent123@localhost:5432/waitless_chu"
    
    # JWT
    secret_key: str = "waitless-chu-secret-key-2025-hospital-queue-management"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080", 
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8080",
        "http://localhost:8000",
        "null",  # For file:// protocol during development
        "*"  # Allow all origins for development (remove in production)
    ]
    
    # App
    app_name: str = "WaitLess CHU API"
    debug: bool = True
    
    # Chatbot - OpenRouter API (free DeepSeek model)
    openrouter_api_key: str = "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"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "deepseek/deepseek-chat-v3-0324:free"
    
    class Config:
        env_file = ".env"


settings = Settings() 