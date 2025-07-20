from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Database
    # Use SQLite for local demonstration, PostgreSQL for production
    use_sqlite: bool = True
    database_url: str = "postgresql://postgres:serpent123@localhost:5432/waitless_chu"
    sqlite_url: str = "sqlite:///./waitless_chu_demo.db"
    
    @property
    def get_database_url(self) -> str:
        """Get the appropriate database URL based on environment"""
        if self.use_sqlite or not os.getenv("DATABASE_URL"):
            return self.sqlite_url
        return self.database_url
    
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

    class Config:
        env_file = ".env"


settings = Settings() 