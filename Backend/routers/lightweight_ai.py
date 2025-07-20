"""
Lightweight AI Management Endpoints
Simple API for managing the statistical AI predictor
No heavy dependencies - pure Python only!
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict
from datetime import datetime

from database import get_db
from auth import get_admin_user
from models import User
from ai.lightweight_predictor import lightweight_ai

router = APIRouter()

@router.get("/status")
async def get_lightweight_ai_status(
    current_user: User = Depends(get_admin_user)
):
    """Get lightweight AI system status"""
    
    try:
        status = lightweight_ai.get_status()
        
        return {
            "ai_type": "Lightweight Statistical AI",
            "status": "healthy" if status['is_trained'] else "needs_learning",
            "timestamp": datetime.now().isoformat(),
            "details": status,
            "features": [
                "Statistical pattern recognition",
                "Time-based multipliers",
                "Service-specific learning", 
                "Priority effects modeling",
                "Zero external dependencies"
            ],
            "memory_usage": "< 1MB",
            "training_time": "< 10 seconds"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting AI status: {str(e)}")

@router.post("/learn")
async def learn_from_data(
    days_back: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Learn patterns from historical data"""
    
    try:
        # Learn from historical data
        lightweight_ai.learn_from_historical_data(db, days_back=days_back)
        
        # Get updated status
        status = lightweight_ai.get_status()
        
        return {
            "message": "AI learning completed successfully",
            "learning_duration": "< 10 seconds",
            "days_analyzed": days_back,
            "patterns_learned": status['patterns_count'],
            "services_analyzed": status['services_learned'],
            "confidence": status['avg_confidence'],
            "data_source": "historical_tickets"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Learning failed: {str(e)}")

@router.get("/insights")
async def get_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get AI-generated insights and recommendations"""
    
    try:
        insights = lightweight_ai.get_ai_insights(db)
        
        return {
            "insights": insights,
            "generated_at": datetime.now().isoformat(),
            "ai_type": "Statistical Analysis",
            "recommendations_count": len(insights.get('efficiency_recommendations', [])),
            "data_quality": insights.get('data_quality', 'unknown')
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")

@router.get("/prediction-demo")
async def demo_prediction(
    service_id: int,
    priority: str = "medium",
    position: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Demo AI prediction with comparison to simple calculation"""
    
    try:
        from models import ServicePriority, Service
        
        # Convert priority
        priority_map = {
            "low": ServicePriority.LOW,
            "medium": ServicePriority.MEDIUM,
            "high": ServicePriority.HIGH
        }
        priority_enum = priority_map.get(priority.lower(), ServicePriority.MEDIUM)
        
        # Get AI prediction
        ai_prediction, ai_metadata = lightweight_ai.predict_wait_time(
            service_id, priority_enum, position, db
        )
        
        # Get simple prediction for comparison
        service = db.query(Service).filter(Service.id == service_id).first()
        simple_prediction = (position - 1) * (service.avg_wait_time if service else 15)
        simple_prediction = max(5, simple_prediction)
        
        # Calculate improvement
        improvement = simple_prediction - ai_prediction
        improvement_percentage = (improvement / simple_prediction * 100) if simple_prediction > 0 else 0
        
        return {
            "ai_prediction": {
                "wait_time_minutes": ai_prediction,
                "prediction_type": ai_metadata.get('prediction_type'),
                "confidence": ai_metadata.get('confidence', 0),
                "factors": ai_metadata.get('factors_used', {})
            },
            "simple_prediction": {
                "wait_time_minutes": simple_prediction,
                "method": "position * average_time"
            },
            "comparison": {
                "improvement_minutes": improvement,
                "improvement_percentage": improvement_percentage,
                "ai_better": improvement > 0
            },
            "test_parameters": {
                "service_id": service_id,
                "priority": priority,
                "position": position,
                "service_name": service.name if service else "Unknown"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction demo failed: {str(e)}")

@router.get("/patterns")
async def get_learned_patterns(
    current_user: User = Depends(get_admin_user)
):
    """Get current AI patterns and multipliers"""
    
    try:
        patterns = lightweight_ai.patterns
        
        # Prepare readable patterns
        readable_patterns = {
            "hourly_patterns": {
                f"{hour}h00": f"×{mult:.2f}" 
                for hour, mult in patterns.get('hourly_multipliers', {}).items()
            },
            "daily_patterns": {
                ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][day]: f"×{mult:.2f}"
                for day, mult in patterns.get('daily_multipliers', {}).items()
            },
            "priority_effects": {
                priority: f"×{effect:.2f}"
                for priority, effect in patterns.get('priority_effects', {}).items()
            },
            "service_patterns": {
                str(service_id): {
                    "name": pattern.get('service_name', f'Service {service_id}'),
                    "avg_time": f"{pattern.get('avg_time', 0):.1f} min",
                    "confidence": f"{pattern.get('confidence', 0):.0%}",
                    "samples": pattern.get('sample_count', 0)
                }
                for service_id, pattern in patterns.get('service_patterns', {}).items()
            }
        }
        
        return {
            "patterns": readable_patterns,
            "total_patterns": sum(len(p) for p in readable_patterns.values()),
            "last_updated": datetime.now().isoformat(),
            "pattern_file": lightweight_ai.data_file
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting patterns: {str(e)}")

@router.delete("/reset")
async def reset_ai_patterns(
    confirm: bool = False,
    current_user: User = Depends(get_admin_user)
):
    """Reset AI patterns to default values"""
    
    if not confirm:
        return {
            "message": "Reset not confirmed",
            "warning": "This will reset all learned AI patterns",
            "instruction": "Add ?confirm=true to proceed"
        }
    
    try:
        # Reset patterns
        lightweight_ai.patterns = {
            'hourly_multipliers': {},
            'daily_multipliers': {},
            'service_patterns': {},
            'priority_effects': {},
            'moving_averages': {},
            'trend_data': {},
            'confidence_scores': {}
        }
        
        # Reinitialize with defaults
        lightweight_ai._initialize_default_patterns()
        
        # Save reset patterns
        lightweight_ai.save_patterns()
        
        return {
            "message": "AI patterns reset successfully",
            "status": "reset_complete",
            "default_patterns_loaded": True,
            "next_step": "Use /learn endpoint to learn from historical data"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

@router.post("/feedback")
async def submit_prediction_feedback(
    service_id: int,
    predicted_time: int,
    actual_time: int,
    context: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Submit feedback on prediction accuracy for continuous learning"""
    
    try:
        # Update AI with real outcome
        lightweight_ai.update_with_real_outcome(
            service_id=service_id,
            predicted_time=predicted_time,
            actual_time=actual_time,
            context=context or {}
        )
        
        # Calculate accuracy
        error = abs(predicted_time - actual_time)
        accuracy = max(0, 1.0 - (error / max(actual_time, 1)))
        
        return {
            "message": "Feedback submitted successfully",
            "accuracy": f"{accuracy:.1%}",
            "error_minutes": error,
            "learning_enabled": True,
            "continuous_improvement": "AI patterns updated with real outcome"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback submission failed: {str(e)}")