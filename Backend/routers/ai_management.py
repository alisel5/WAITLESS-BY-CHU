"""
AI Management API Endpoints
Provides endpoints for training, monitoring, and managing AI models
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Optional
import logging
from datetime import datetime

from database import get_db
from auth import get_admin_user
from models import User

# Import AI components
from ai.wait_time_predictor import ai_predictor
from ai.data_collector import AIDataCollector

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/train")
async def train_ai_models(
    background_tasks: BackgroundTasks,
    force_retrain: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Train or retrain AI prediction models
    This is a background task to avoid blocking the API
    """
    
    try:
        # Check if training is needed
        if not force_retrain and ai_predictor.is_trained and not ai_predictor.needs_retraining():
            return {
                "message": "Models are already trained and up to date",
                "training_info": ai_predictor.get_model_info(),
                "action": "no_training_needed"
            }
        
        # Start training in background
        background_tasks.add_task(
            _train_models_background,
            db_session_factory=lambda: next(get_db()),
            force_retrain=force_retrain,
            admin_id=current_user.id
        )
        
        return {
            "message": "AI model training started in background",
            "estimated_time": "2-5 minutes",
            "status": "training_initiated",
            "force_retrain": force_retrain
        }
        
    except Exception as e:
        logger.error(f"Error initiating AI training: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start AI training: {str(e)}"
        )

async def _train_models_background(db_session_factory, force_retrain: bool, admin_id: int):
    """Background task for training models"""
    
    db = db_session_factory()
    try:
        logger.info(f"Starting AI model training (admin_id: {admin_id})")
        
        # Train the models
        training_results = ai_predictor.train_models(db, force_retrain=force_retrain)
        
        logger.info(f"AI training completed successfully: {training_results}")
        
        # Here you could send a notification to the admin
        # or update a training status in the database
        
    except Exception as e:
        logger.error(f"Background AI training failed: {e}")
    finally:
        db.close()

@router.get("/status")
async def get_ai_status(
    current_user: User = Depends(get_admin_user)
):
    """Get current AI system status and model information"""
    
    try:
        model_info = ai_predictor.get_model_info()
        
        # Calculate additional status information
        status_info = {
            "ai_enabled": ai_predictor.is_trained,
            "needs_retraining": ai_predictor.needs_retraining(),
            "model_count": len(model_info.get('available_models', [])),
            "last_training": model_info.get('model_metadata', {}).get('training_date'),
            "training_samples": model_info.get('model_metadata', {}).get('training_samples', 0),
            "best_model": model_info.get('model_metadata', {}).get('best_model'),
            "model_accuracy": None
        }
        
        # Get model accuracy if available
        model_results = model_info.get('model_metadata', {}).get('model_results', {})
        if model_results and status_info['best_model']:
            best_model_result = model_results.get(status_info['best_model'], {})
            status_info['model_accuracy'] = best_model_result.get('accuracy_percentage')
        
        return {
            "status": "healthy" if ai_predictor.is_trained else "needs_training",
            "timestamp": datetime.now().isoformat(),
            "model_info": model_info,
            "status_summary": status_info
        }
        
    except Exception as e:
        logger.error(f"Error getting AI status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI status: {str(e)}"
        )

@router.get("/prediction-demo")
async def demo_prediction(
    service_id: int,
    priority: str = "medium",
    position: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Demo endpoint to test AI prediction for given parameters
    Useful for testing and debugging AI predictions
    """
    
    try:
        from models import ServicePriority
        
        # Convert priority string to enum
        priority_map = {
            "low": ServicePriority.LOW,
            "medium": ServicePriority.MEDIUM,
            "high": ServicePriority.HIGH
        }
        
        priority_enum = priority_map.get(priority.lower(), ServicePriority.MEDIUM)
        
        # Get AI prediction
        if ai_predictor.is_trained:
            prediction, metadata = ai_predictor.predict_wait_time(
                service_id, priority_enum, position, db
            )
            
            # Also get fallback prediction for comparison
            fallback_prediction, fallback_metadata = ai_predictor._fallback_prediction(
                service_id, priority_enum, position, db
            )
            
            return {
                "ai_prediction": {
                    "wait_time_minutes": prediction,
                    "metadata": metadata
                },
                "fallback_prediction": {
                    "wait_time_minutes": fallback_prediction,
                    "metadata": fallback_metadata
                },
                "improvement": {
                    "difference_minutes": prediction - fallback_prediction,
                    "percentage_change": ((prediction - fallback_prediction) / fallback_prediction * 100) if fallback_prediction > 0 else 0
                },
                "test_parameters": {
                    "service_id": service_id,
                    "priority": priority,
                    "position": position
                }
            }
        else:
            return {
                "error": "AI models not trained",
                "message": "Train the AI models first using the /train endpoint",
                "fallback_available": True
            }
            
    except Exception as e:
        logger.error(f"Error in prediction demo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction demo failed: {str(e)}"
        )

@router.get("/training-data-stats")
async def get_training_data_stats(
    days_back: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get statistics about available training data"""
    
    try:
        data_collector = AIDataCollector()
        
        # Collect historical data stats
        historical_data = data_collector.collect_training_data(db, days_back=days_back)
        
        if historical_data.empty:
            return {
                "historical_samples": 0,
                "recommendation": "Generate synthetic data for training",
                "data_quality": "insufficient",
                "days_analyzed": days_back
            }
        
        # Analyze data quality
        stats = {
            "historical_samples": len(historical_data),
            "date_range_days": days_back,
            "avg_wait_time": historical_data['actual_wait_time'].mean() if 'actual_wait_time' in historical_data else 0,
            "max_wait_time": historical_data['actual_wait_time'].max() if 'actual_wait_time' in historical_data else 0,
            "min_wait_time": historical_data['actual_wait_time'].min() if 'actual_wait_time' in historical_data else 0,
            "data_quality": "good" if len(historical_data) >= 100 else "limited",
            "recommendation": "Sufficient for training" if len(historical_data) >= 100 else "Consider synthetic data augmentation"
        }
        
        # Service distribution
        if 'service_id' in historical_data:
            service_distribution = historical_data['service_id'].value_counts().to_dict()
            stats['service_distribution'] = service_distribution
        
        # Priority distribution
        if 'priority_score' in historical_data:
            priority_distribution = historical_data['priority_score'].value_counts().to_dict()
            stats['priority_distribution'] = priority_distribution
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting training data stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get training data stats: {str(e)}"
        )

@router.post("/generate-synthetic-data")
async def generate_synthetic_training_data(
    num_samples: int = 1000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Generate synthetic training data for AI models"""
    
    try:
        if num_samples < 100 or num_samples > 10000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of samples must be between 100 and 10000"
            )
        
        data_collector = AIDataCollector()
        synthetic_data = data_collector.generate_synthetic_data(db, num_samples=num_samples)
        
        if synthetic_data.empty:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate synthetic data"
            )
        
        # Provide sample statistics
        stats = {
            "samples_generated": len(synthetic_data),
            "avg_wait_time": synthetic_data['actual_wait_time'].mean(),
            "data_range": {
                "min_wait": synthetic_data['actual_wait_time'].min(),
                "max_wait": synthetic_data['actual_wait_time'].max()
            },
            "ready_for_training": True,
            "recommendation": "You can now train the AI models with this synthetic data"
        }
        
        return {
            "message": "Synthetic training data generated successfully",
            "statistics": stats,
            "next_step": "Use the /train endpoint to train models with this data"
        }
        
    except Exception as e:
        logger.error(f"Error generating synthetic data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate synthetic data: {str(e)}"
        )

@router.delete("/reset-models")
async def reset_ai_models(
    confirm: bool = False,
    current_user: User = Depends(get_admin_user)
):
    """Reset AI models (delete trained models and start fresh)"""
    
    if not confirm:
        return {
            "message": "Model reset not confirmed",
            "warning": "This will delete all trained AI models",
            "instruction": "Add ?confirm=true to proceed with reset"
        }
    
    try:
        import shutil
        import os
        
        # Remove model files
        if os.path.exists(ai_predictor.model_dir):
            shutil.rmtree(ai_predictor.model_dir)
            os.makedirs(ai_predictor.model_dir, exist_ok=True)
        
        # Reset in-memory state
        ai_predictor.is_trained = False
        ai_predictor.model_metadata = {}
        ai_predictor.feature_columns = []
        
        # Reinitialize models
        from ai.wait_time_predictor import WaitTimePredictorAI
        global ai_predictor
        ai_predictor = WaitTimePredictorAI()
        
        return {
            "message": "AI models reset successfully",
            "status": "models_cleared",
            "next_step": "Generate training data and retrain models"
        }
        
    except Exception as e:
        logger.error(f"Error resetting AI models: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset AI models: {str(e)}"
        )