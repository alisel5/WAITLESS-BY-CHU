from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from database import get_db, engine
from models import Base
from config import settings
import uvicorn
from contextlib import asynccontextmanager

# Import routers
from routers import auth, services, tickets, queue, admin, websocket
from routers import tickets_enhanced
from notification_service import start_notification_service, stop_notification_service

# Create database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events"""
    # Startup: Start the notification service
    await start_notification_service()
    yield
    # Shutdown: Stop the notification service
    await stop_notification_service()

# Initialize FastAPI app with lifespan events
app = FastAPI(
    title=settings.app_name,
    description="Smart Queue Management System for CHU Hospitals with Real-time Updates",
    version="1.0.0",
    debug=settings.debug,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(tickets.router, prefix="/api/tickets", tags=["Tickets"])
app.include_router(queue.router, prefix="/api/queue", tags=["Queue"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# Include enhanced QR features
app.include_router(tickets_enhanced.router, prefix="/api/tickets-qr", tags=["QR Features"])

# Include WebSocket endpoints
app.include_router(websocket.router, prefix="/ws", tags=["Real-time Updates"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "WaitLess CHU API is running", "status": "healthy"}


@app.get("/api/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": "1.0.0"
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True if settings.debug else False
    )
