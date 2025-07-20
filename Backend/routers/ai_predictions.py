"""
AI Predictions API Router
Provides endpoints for smart wait time predictions and queue analytics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from database import get_db
from auth import get_current_active_user, get_admin_or_staff_user
from models import User, Service, ServicePriority
from ai.wait_time_predictor import SmartWaitTimePredictor
from ai.queue_analyzer import QueuePatternAnalyzer
from sqlalchemy import and_
import statistics

router = APIRouter()

# Initialize AI components
wait_time_predictor = SmartWaitTimePredictor()
queue_analyzer = QueuePatternAnalyzer()


@router.post("/predict-wait-time")
async def predict_wait_time(
    service_id: int,
    position: int,
    priority: ServicePriority = ServicePriority.MEDIUM,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get smart AI-powered wait time prediction for a specific position in queue
    """
    try:
        # Validate service exists
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get AI prediction
        prediction = wait_time_predictor.predict_wait_time(
            service_id=service_id,
            position=position,
            priority=priority.value,
            current_time=datetime.now(),
            db=db
        )
        
        # Add service information
        prediction['service_name'] = service.name
        prediction['service_location'] = service.location
        prediction['your_position'] = position
        prediction['priority'] = priority.value
        
        return {
            "success": True,
            "prediction": prediction,
            "ai_enabled": True,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating prediction: {str(e)}"
        )


@router.get("/service-insights/{service_id}")
async def get_service_insights(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed AI-powered insights for a specific service
    """
    try:
        # Validate service access
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Check if user has access to this service
        if current_user.role.value not in ['admin'] and current_user.assigned_service_id != service_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this service"
            )
        
        # Get AI insights
        performance_insights = wait_time_predictor.get_service_performance_insights(service_id, db)
        pattern_analysis = queue_analyzer.analyze_service_patterns(service_id, db)
        real_time_insights = queue_analyzer.get_real_time_insights(service_id, db)
        
        return {
            "success": True,
            "service_id": service_id,
            "insights": {
                "performance": performance_insights,
                "patterns": pattern_analysis,
                "real_time": real_time_insights
            },
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating insights: {str(e)}"
        )


@router.get("/real-time-analytics/{service_id}")
async def get_real_time_analytics(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get real-time AI analytics for a service (for live dashboard updates)
    """
    try:
        # Validate service
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get real-time insights
        insights = queue_analyzer.get_real_time_insights(service_id, db)
        
        # Get current prediction quality
        sample_prediction = wait_time_predictor.predict_wait_time(
            service_id, 1, 'medium', datetime.now(), db
        )
        
        return {
            "success": True,
            "service_id": service_id,
            "real_time_data": insights,
            "prediction_quality": {
                "confidence": sample_prediction.get('confidence_score', 0.5),
                "quality_rating": sample_prediction.get('prediction_quality', 'medium')
            },
            "last_updated": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting real-time analytics: {str(e)}"
        )


@router.get("/admin/all-services-overview")
async def get_all_services_overview(
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get AI-powered overview of all services (for admin dashboard)
    """
    try:
        # Get all services
        services = db.query(Service).all()
        
        overview = {
            "total_services": len(services),
            "services_data": [],
            "overall_insights": {
                "services_needing_attention": 0,
                "high_performance_services": 0,
                "average_prediction_quality": 0
            }
        }
        
        prediction_qualities = []
        
        for service in services:
            try:
                # Get basic insights for each service
                real_time = queue_analyzer.get_real_time_insights(service.id, db)
                sample_prediction = wait_time_predictor.predict_wait_time(
                    service.id, 1, 'medium', datetime.now(), db
                )
                
                service_data = {
                    "service_id": service.id,
                    "service_name": service.name,
                    "location": service.location,
                    "current_status": real_time.get('current_status', 'unknown'),
                    "current_waiting": real_time.get('current_waiting', 0),
                    "today_completion_rate": real_time.get('today_completion_rate', 0),
                    "prediction_confidence": sample_prediction.get('confidence_score', 0.5),
                    "prediction_quality": sample_prediction.get('prediction_quality', 'medium'),
                    "alerts": real_time.get('alerts', [])
                }
                
                overview["services_data"].append(service_data)
                prediction_qualities.append(sample_prediction.get('confidence_score', 0.5))
                
                # Count services needing attention
                if real_time.get('current_status') == 'busy' or len(real_time.get('alerts', [])) > 0:
                    overview["overall_insights"]["services_needing_attention"] += 1
                
                # Count high performance services
                if (real_time.get('today_completion_rate', 0) > 80 and 
                    sample_prediction.get('confidence_score', 0) > 0.7):
                    overview["overall_insights"]["high_performance_services"] += 1
                    
            except Exception as e:
                # If we can't get data for a service, add basic info
                overview["services_data"].append({
                    "service_id": service.id,
                    "service_name": service.name,
                    "location": service.location,
                    "current_status": "unknown",
                    "error": f"Could not load AI data: {str(e)}"
                })
        
        # Calculate overall prediction quality
        if prediction_qualities:
            overview["overall_insights"]["average_prediction_quality"] = sum(prediction_qualities) / len(prediction_qualities)
        
        return {
            "success": True,
            "overview": overview,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating overview: {str(e)}"
        )


@router.get("/queue-optimization-suggestions/{service_id}")
async def get_optimization_suggestions(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get AI-powered optimization suggestions for a service
    """
    try:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get pattern analysis with recommendations
        analysis = queue_analyzer.analyze_service_patterns(service_id, db)
        
        if 'error' in analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=analysis['error']
            )
        
        # Extract recommendations and add priority scoring
        recommendations = analysis.get('recommendations', [])
        bottlenecks = analysis.get('bottleneck_indicators', {}).get('bottlenecks', [])
        
        # Combine recommendations with bottleneck solutions
        all_suggestions = recommendations.copy()
        
        for bottleneck in bottlenecks:
            all_suggestions.append({
                'type': 'bottleneck_resolution',
                'priority': bottleneck.get('severity', 'medium'),
                'title': f"Address {bottleneck.get('type', 'Issue')}",
                'description': bottleneck.get('description', ''),
                'recommendation': bottleneck.get('recommendation', ''),
                'expected_impact': 'Resolve operational bottleneck'
            })
        
        # Sort by priority
        priority_order = {'high': 3, 'medium': 2, 'low': 1}
        all_suggestions.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 1), reverse=True)
        
        return {
            "success": True,
            "service_id": service_id,
            "service_name": service.name,
            "optimization_suggestions": all_suggestions,
            "analysis_summary": {
                "total_suggestions": len(all_suggestions),
                "high_priority_items": len([s for s in all_suggestions if s.get('priority') == 'high']),
                "bottlenecks_detected": len(bottlenecks),
                "overall_health": analysis.get('bottleneck_indicators', {}).get('overall_health', 'unknown')
            },
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating suggestions: {str(e)}"
        )


@router.get("/prediction-accuracy/{service_id}")
async def get_prediction_accuracy(
    service_id: int,
    days_back: int = Query(7, ge=1, le=30, description="Number of days to analyze"),
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get accuracy metrics for AI predictions (for system evaluation)
    """
    try:
        from models import Ticket, TicketStatus
        from datetime import timedelta
        
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get completed tickets from the specified period
        start_date = datetime.now() - timedelta(days=days_back)
        
        completed_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.COMPLETED,
                Ticket.created_at >= start_date,
                Ticket.consultation_start.isnot(None),
                Ticket.estimated_wait_time.isnot(None)
            )
        ).all()
        
        if not completed_tickets:
            return {
                "success": True,
                "message": "No completed tickets with timing data in the specified period",
                "service_id": service_id,
                "period_days": days_back
            }
        
        # Calculate accuracy metrics
        prediction_errors = []
        
        for ticket in completed_tickets:
            if ticket.consultation_start and ticket.created_at:
                # Actual wait time
                actual_wait = (ticket.consultation_start - ticket.created_at).total_seconds() / 60
                
                # Predicted wait time
                predicted_wait = ticket.estimated_wait_time
                
                # Calculate error
                error = abs(actual_wait - predicted_wait)
                relative_error = error / max(actual_wait, 1) * 100  # Percentage error
                
                prediction_errors.append({
                    'actual_wait': actual_wait,
                    'predicted_wait': predicted_wait,
                    'absolute_error': error,
                    'relative_error': relative_error
                })
        
        if prediction_errors:
            # Calculate accuracy metrics
            absolute_errors = [e['absolute_error'] for e in prediction_errors]
            relative_errors = [e['relative_error'] for e in prediction_errors]
            
            accuracy_metrics = {
                'total_predictions': len(prediction_errors),
                'mean_absolute_error': statistics.mean(absolute_errors),
                'median_absolute_error': statistics.median(absolute_errors),
                'mean_relative_error_percent': statistics.mean(relative_errors),
                'accuracy_within_10_min': len([e for e in absolute_errors if e <= 10]) / len(absolute_errors) * 100,
                'accuracy_within_20_min': len([e for e in absolute_errors if e <= 20]) / len(absolute_errors) * 100,
                'max_error': max(absolute_errors),
                'min_error': min(absolute_errors)
            }
            
            # Determine accuracy rating
            avg_relative_error = accuracy_metrics['mean_relative_error_percent']
            if avg_relative_error < 20:
                accuracy_rating = 'excellent'
            elif avg_relative_error < 35:
                accuracy_rating = 'good'
            elif avg_relative_error < 50:
                accuracy_rating = 'fair'
            else:
                accuracy_rating = 'needs_improvement'
            
            return {
                "success": True,
                "service_id": service_id,
                "service_name": service.name,
                "analysis_period": f"{days_back} days",
                "accuracy_metrics": accuracy_metrics,
                "accuracy_rating": accuracy_rating,
                "generated_at": datetime.now().isoformat()
            }
        
        return {
            "success": True,
            "message": "No valid prediction data available",
            "service_id": service_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating accuracy: {str(e)}"
        )