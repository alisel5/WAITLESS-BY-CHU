"""
AI Analytics Router - Advanced Analytics and Insights
=====================================================

This router provides AI-powered analytics endpoints for the Smart Hospital Queue System.
It showcases the intelligent wait time estimation capabilities and provides insights
for hospital administrators and staff.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from database import get_db
from models import Ticket, Service, QueueLog, TicketStatus, ServicePriority, User
from auth import get_admin_user, get_admin_or_staff_user
import logging

# Import AI modules
from ai_wait_time_estimator import (
    get_ai_wait_time_estimate, 
    get_service_ai_insights, 
    refresh_all_estimates,
    ai_estimator
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/ai-status")
async def get_ai_system_status(
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get overall AI system status and capabilities."""
    try:
        # Get all active services
        services = db.query(Service).filter(Service.status.name == "ACTIVE").all()
        
        service_statuses = []
        total_tickets_analyzed = 0
        ai_ready_services = 0
        
        for service in services:
            insights = get_service_ai_insights(service.id, db)
            
            if insights["status"] == "ready":
                ai_ready_services += 1
                total_tickets_analyzed += insights["data_quality"]["historical_tickets"]
            
            service_statuses.append({
                "service_id": service.id,
                "service_name": service.name,
                "ai_status": insights["status"],
                "data_quality": insights.get("data_quality", {}),
                "message": insights.get("message", "")
            })
        
        return {
            "ai_system_active": True,
            "total_services": len(services),
            "ai_ready_services": ai_ready_services,
            "total_historical_tickets": total_tickets_analyzed,
            "system_confidence": min(0.95, total_tickets_analyzed / 1000.0),
            "services": service_statuses,
            "features": {
                "historical_analysis": True,
                "real_time_adaptation": True,
                "priority_intelligence": True,
                "time_pattern_recognition": True,
                "service_specific_models": True
            }
        }
    except Exception as e:
        logger.error(f"Error getting AI status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving AI system status: {str(e)}"
        )


@router.get("/service/{service_id}/ai-insights")
async def get_service_insights(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Get detailed AI insights for a specific service."""
    try:
        # Verify service exists
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Get AI insights
        insights = get_service_ai_insights(service_id, db)
        
        # Add current queue analysis
        current_queue = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).all()
        
        # Analyze current queue with AI
        queue_analysis = []
        if current_queue:
            for ticket in current_queue:
                try:
                    ai_estimate = get_ai_wait_time_estimate(
                        service_id, ticket.priority, ticket.position_in_queue, db
                    )
                    queue_analysis.append({
                        "ticket_number": ticket.ticket_number,
                        "position": ticket.position_in_queue,
                        "priority": ticket.priority.value,
                        "ai_estimate": ai_estimate.estimated_minutes,
                        "confidence": ai_estimate.confidence_level,
                        "factors": ai_estimate.factors_explanation,
                        "range": ai_estimate.estimated_range
                    })
                except Exception as e:
                    logger.warning(f"Failed to get AI estimate for ticket {ticket.id}: {e}")
        
        # Add current queue analysis to insights
        insights["current_queue_analysis"] = {
            "total_waiting": len(current_queue),
            "queue_details": queue_analysis,
            "analyzed_at": datetime.now().isoformat()
        }
        
        return insights
    except Exception as e:
        logger.error(f"Error getting service insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving service insights: {str(e)}"
        )


@router.post("/service/{service_id}/refresh-estimates")
async def refresh_service_estimates(
    service_id: int,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Refresh AI wait time estimates for all waiting tickets in a service."""
    try:
        # Verify service exists
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )
        
        # Refresh estimates
        result = refresh_all_estimates(service_id, db)
        
        # Log the action
        from models import QueueLog
        queue_log = QueueLog(
            ticket_id=None,
            action="ai_estimates_refreshed",
            details=f"AI estimates refreshed by {current_user.full_name} for service {service.name}. "
                   f"Updated {result['updated_count']} tickets."
        )
        db.add(queue_log)
        db.commit()
        
        return {
            "message": "AI estimates refreshed successfully",
            "service_name": service.name,
            "updated_count": result["updated_count"],
            "total_tickets": result["total_tickets"],
            "estimates": result["estimates"]
        }
    except Exception as e:
        logger.error(f"Error refreshing estimates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing estimates: {str(e)}"
        )


@router.get("/analytics/wait-time-trends")
async def get_wait_time_trends(
    days: int = 7,
    service_id: Optional[int] = None,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get wait time trends and analytics over the specified period."""
    try:
        # Date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Build query
        query = db.query(Ticket).filter(
            and_(
                Ticket.created_at >= start_date,
                Ticket.status.in_([TicketStatus.COMPLETED, TicketStatus.CANCELLED])
            )
        )
        
        if service_id:
            query = query.filter(Ticket.service_id == service_id)
        
        tickets = query.all()
        
        # Analyze trends by day
        daily_trends = {}
        for ticket in tickets:
            day_key = ticket.created_at.date().isoformat()
            
            if day_key not in daily_trends:
                daily_trends[day_key] = {
                    "date": day_key,
                    "total_tickets": 0,
                    "avg_estimated_wait": 0,
                    "avg_actual_wait": 0,
                    "accuracy_score": 0,
                    "priority_breakdown": {"high": 0, "medium": 0, "low": 0}
                }
            
            daily_trends[day_key]["total_tickets"] += 1
            daily_trends[day_key]["avg_estimated_wait"] += ticket.estimated_wait_time
            daily_trends[day_key]["priority_breakdown"][ticket.priority.value] += 1
            
            # Calculate actual wait time if available
            if ticket.consultation_start and ticket.created_at:
                actual_wait = (ticket.consultation_start - ticket.created_at).total_seconds() / 60
                daily_trends[day_key]["avg_actual_wait"] += actual_wait
        
        # Calculate averages and accuracy
        for day_data in daily_trends.values():
            if day_data["total_tickets"] > 0:
                day_data["avg_estimated_wait"] = round(
                    day_data["avg_estimated_wait"] / day_data["total_tickets"], 1
                )
                day_data["avg_actual_wait"] = round(
                    day_data["avg_actual_wait"] / day_data["total_tickets"], 1
                )
                
                # Calculate accuracy (how close estimates were to actual)
                if day_data["avg_actual_wait"] > 0:
                    accuracy = 1 - abs(day_data["avg_estimated_wait"] - day_data["avg_actual_wait"]) / day_data["avg_actual_wait"]
                    day_data["accuracy_score"] = round(max(0, accuracy), 2)
        
        # Overall statistics
        total_tickets = len(tickets)
        overall_avg_estimated = sum(t.estimated_wait_time for t in tickets) / max(1, total_tickets)
        
        actual_waits = []
        for ticket in tickets:
            if ticket.consultation_start and ticket.created_at:
                actual_wait = (ticket.consultation_start - ticket.created_at).total_seconds() / 60
                actual_waits.append(actual_wait)
        
        overall_avg_actual = sum(actual_waits) / max(1, len(actual_waits)) if actual_waits else 0
        overall_accuracy = 1 - abs(overall_avg_estimated - overall_avg_actual) / max(1, overall_avg_actual) if overall_avg_actual > 0 else 0
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "overall_stats": {
                "total_tickets": total_tickets,
                "avg_estimated_wait": round(overall_avg_estimated, 1),
                "avg_actual_wait": round(overall_avg_actual, 1),
                "accuracy_score": round(max(0, overall_accuracy), 2),
                "ai_utilization": "Active" if total_tickets > 0 else "No data"
            },
            "daily_trends": sorted(daily_trends.values(), key=lambda x: x["date"]),
            "insights": {
                "best_accuracy_day": max(daily_trends.values(), key=lambda x: x["accuracy_score"])["date"] if daily_trends else None,
                "highest_volume_day": max(daily_trends.values(), key=lambda x: x["total_tickets"])["date"] if daily_trends else None,
                "trend_direction": "stable"  # Could be enhanced with statistical analysis
            }
        }
    except Exception as e:
        logger.error(f"Error getting wait time trends: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving trends: {str(e)}"
        )


@router.get("/analytics/efficiency-analysis")
async def get_efficiency_analysis(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Advanced efficiency analysis using AI insights."""
    try:
        services = db.query(Service).filter(Service.status.name == "ACTIVE").all()
        
        service_analysis = []
        for service in services:
            insights = get_service_ai_insights(service.id, db)
            
            if insights["status"] == "ready":
                # Get current queue performance
                current_waiting = db.query(Ticket).filter(
                    and_(
                        Ticket.service_id == service.id,
                        Ticket.status == TicketStatus.WAITING
                    )
                ).count()
                
                analysis = {
                    "service_id": service.id,
                    "service_name": service.name,
                    "ai_insights": insights["insights"],
                    "current_load": current_waiting,
                    "efficiency_score": insights["insights"]["consistency_score"],
                    "recommendations": []
                }
                
                # Generate AI-powered recommendations
                if insights["insights"]["best_hours"]:
                    best_hour = insights["insights"]["best_hours"][0]["hour"]
                    analysis["recommendations"].append(
                        f"Meilleure efficacité observée à {best_hour}h - considérer plus de staff"
                    )
                
                if insights["insights"]["worst_hours"]:
                    worst_hour = insights["insights"]["worst_hours"][0]["hour"]
                    analysis["recommendations"].append(
                        f"Efficacité réduite à {worst_hour}h - optimiser les ressources"
                    )
                
                if current_waiting > 10:
                    analysis["recommendations"].append(
                        "File d'attente élevée - intervention recommandée"
                    )
                
                service_analysis.append(analysis)
        
        return {
            "analysis_timestamp": datetime.now().isoformat(),
            "total_services_analyzed": len(service_analysis),
            "services": service_analysis,
            "system_recommendations": [
                "Utiliser les insights IA pour optimiser les horaires du personnel",
                "Surveiller les scores de consistance pour identifier les problèmes",
                "Adapter les estimations selon les patterns observés"
            ]
        }
    except Exception as e:
        logger.error(f"Error in efficiency analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in efficiency analysis: {str(e)}"
        )


@router.post("/ai/retrain-models")
async def retrain_ai_models(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Force retrain AI models with latest data (Admin only)."""
    try:
        # Clear cache to force model rebuild
        ai_estimator.service_models.clear()
        ai_estimator.last_update.clear()
        
        # Get all services and rebuild models
        services = db.query(Service).all()
        results = []
        
        for service in services:
            try:
                model = ai_estimator._build_service_model(service.id, db)
                results.append({
                    "service_id": service.id,
                    "service_name": service.name,
                    "status": "success" if model["has_enough_data"] else "insufficient_data",
                    "tickets_analyzed": model.get("ticket_count", 0)
                })
            except Exception as e:
                results.append({
                    "service_id": service.id,
                    "service_name": service.name,
                    "status": "error",
                    "error": str(e)
                })
        
        # Log the action
        from models import QueueLog
        queue_log = QueueLog(
            ticket_id=None,
            action="ai_models_retrained",
            details=f"AI models retrained by {current_user.full_name}"
        )
        db.add(queue_log)
        db.commit()
        
        return {
            "message": "AI models retrained successfully",
            "retrained_at": datetime.now().isoformat(),
            "services": results,
            "total_services": len(services),
            "successful_retrains": len([r for r in results if r["status"] == "success"])
        }
    except Exception as e:
        logger.error(f"Error retraining models: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retraining AI models: {str(e)}"
        )


@router.get("/predictive/peak-times")
async def predict_peak_times(
    service_id: Optional[int] = None,
    current_user: User = Depends(get_admin_or_staff_user),
    db: Session = Depends(get_db)
):
    """Predict peak times based on historical patterns."""
    try:
        # If specific service, analyze that service; otherwise, all services
        if service_id:
            services = [db.query(Service).filter(Service.id == service_id).first()]
            if not services[0]:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Service not found"
                )
        else:
            services = db.query(Service).filter(Service.status.name == "ACTIVE").all()
        
        predictions = []
        for service in services:
            insights = get_service_ai_insights(service.id, db)
            
            if insights["status"] == "ready":
                # Extract hourly patterns for peak prediction
                hourly_data = insights["insights"]["best_hours"] + insights["insights"]["worst_hours"]
                
                # Simple peak detection (could be enhanced with more sophisticated algorithms)
                peak_hours = [h for h in hourly_data if h["efficiency"] < 0.8]  # Lower efficiency = higher load
                efficient_hours = [h for h in hourly_data if h["efficiency"] > 1.2]
                
                predictions.append({
                    "service_id": service.id,
                    "service_name": service.name,
                    "predicted_peak_hours": sorted(peak_hours, key=lambda x: x["efficiency"]),
                    "recommended_low_load_hours": sorted(efficient_hours, key=lambda x: x["efficiency"], reverse=True),
                    "confidence": insights["data_quality"]["confidence_level"],
                    "data_quality": insights["data_quality"]["historical_tickets"]
                })
        
        return {
            "prediction_timestamp": datetime.now().isoformat(),
            "services": predictions,
            "general_recommendations": [
                "Planifier plus de personnel pendant les heures de pointe prédites",
                "Utiliser les heures à faible charge pour la maintenance",
                "Communiquer les heures optimales aux patients"
            ]
        }
    except Exception as e:
        logger.error(f"Error predicting peak times: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error predicting peak times: {str(e)}"
        )