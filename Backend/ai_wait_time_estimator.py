"""
AI-Powered Wait Time Estimation System for Smart Hospital Queue
==============================================================

This module implements an intelligent wait time estimation system that learns from 
historical data patterns and adapts to real-time queue conditions.

Features:
- Historical pattern analysis per service
- Time-of-day and day-of-week intelligence
- Priority-based queue optimization
- Dynamic load balancing
- Real-time adaptation based on current conditions
- Service-specific modeling
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta, time
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import joblib
import os
from dataclasses import dataclass
import logging
from collections import defaultdict
import json

# Import models
from models import Ticket, Service, QueueLog, TicketStatus, ServicePriority

logger = logging.getLogger(__name__)

@dataclass
class WaitTimeFactors:
    """Factors affecting wait time estimation"""
    base_service_time: float  # Average consultation time for service
    current_queue_length: int
    priority_distribution: Dict[str, int]  # Count of each priority level
    time_of_day_factor: float  # 0.5-2.0 multiplier
    day_of_week_factor: float  # 0.7-1.3 multiplier
    historical_efficiency: float  # How fast this service typically moves
    staff_availability: float  # Estimated based on historical patterns
    emergency_load: float  # Impact of high-priority cases

@dataclass
class EstimationResult:
    """Result of wait time estimation"""
    estimated_minutes: int
    confidence_level: float  # 0-1
    factors_explanation: str
    estimated_range: Tuple[int, int]  # (min, max) in minutes
    next_update_in_minutes: int  # When to recalculate


class SmartWaitTimeEstimator:
    """
    AI-powered wait time estimation system using statistical models
    and pattern recognition without scikit-learn
    """
    
    def __init__(self, cache_dir: str = "./ai_cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
        # Model cache
        self.service_models = {}
        self.global_patterns = {}
        self.last_update = {}
        
        # Configuration
        self.min_historical_data = 10  # Minimum tickets needed for AI estimation
        self.update_frequency_minutes = 5  # How often to refresh models
        self.confidence_threshold = 0.6  # Minimum confidence for AI predictions
        
        logger.info("SmartWaitTimeEstimator initialized")
    
    def estimate_wait_time(self, service_id: int, priority: ServicePriority, 
                          position_in_queue: int, db: Session) -> EstimationResult:
        """
        Main estimation function - returns intelligent wait time prediction
        """
        try:
            # Get or build model for this service
            service_model = self._get_service_model(service_id, db)
            
            # Gather current factors
            factors = self._analyze_current_factors(service_id, priority, db)
            
            # Use AI if we have enough historical data
            if service_model["has_enough_data"]:
                return self._ai_estimation(service_id, priority, position_in_queue, 
                                         factors, service_model, db)
            else:
                return self._fallback_estimation(service_id, priority, position_in_queue, 
                                               factors, db)
                
        except Exception as e:
            logger.error(f"Error in wait time estimation: {e}")
            # Safe fallback
            return EstimationResult(
                estimated_minutes=max(1, (position_in_queue - 1) * 15),
                confidence_level=0.3,
                factors_explanation="Estimation par défaut (erreur système)",
                estimated_range=(max(1, (position_in_queue - 1) * 10), 
                               (position_in_queue - 1) * 25),
                next_update_in_minutes=5
            )
    
    def _get_service_model(self, service_id: int, db: Session) -> Dict:
        """
        Get or build statistical model for a specific service
        """
        cache_key = f"service_{service_id}"
        
        # Check if model needs update
        if (cache_key not in self.last_update or 
            (datetime.now() - self.last_update[cache_key]).seconds > 
            self.update_frequency_minutes * 60):
            
            self.service_models[cache_key] = self._build_service_model(service_id, db)
            self.last_update[cache_key] = datetime.now()
        
        return self.service_models[cache_key]
    
    def _build_service_model(self, service_id: int, db: Session) -> Dict:
        """
        Build statistical model from historical data for a service
        """
        # Get historical ticket data (last 30 days)
        cutoff_date = datetime.now() - timedelta(days=30)
        
        historical_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status.in_([TicketStatus.COMPLETED, TicketStatus.CANCELLED]),
                Ticket.created_at >= cutoff_date,
                Ticket.consultation_start.isnot(None),
                Ticket.consultation_end.isnot(None)
            )
        ).all()
        
        if len(historical_tickets) < self.min_historical_data:
            return {"has_enough_data": False, "ticket_count": len(historical_tickets)}
        
        # Convert to DataFrame for analysis
        data = []
        for ticket in historical_tickets:
            if ticket.consultation_start and ticket.consultation_end:
                consultation_duration = (
                    ticket.consultation_end - ticket.consultation_start
                ).total_seconds() / 60.0  # minutes
                
                # Extract time features
                created_hour = ticket.created_at.hour
                created_weekday = ticket.created_at.weekday()  # 0=Monday
                
                data.append({
                    'consultation_duration': consultation_duration,
                    'priority': ticket.priority.value,
                    'hour': created_hour,
                    'weekday': created_weekday,
                    'position': ticket.position_in_queue,
                    'created_at': ticket.created_at
                })
        
        df = pd.DataFrame(data)
        
        # Build statistical patterns
        model = {
            "has_enough_data": True,
            "ticket_count": len(historical_tickets),
            "avg_consultation_time": df['consultation_duration'].mean(),
            "consultation_time_std": df['consultation_duration'].std(),
            "priority_patterns": self._analyze_priority_patterns(df),
            "time_patterns": self._analyze_time_patterns(df),
            "efficiency_patterns": self._analyze_efficiency_patterns(df),
            "last_updated": datetime.now()
        }
        
        return model
    
    def _analyze_priority_patterns(self, df: pd.DataFrame) -> Dict:
        """Analyze how priority affects consultation time"""
        priority_stats = {}
        
        for priority in ['high', 'medium', 'low']:
            priority_data = df[df['priority'] == priority]
            if len(priority_data) > 0:
                priority_stats[priority] = {
                    'avg_duration': priority_data['consultation_duration'].mean(),
                    'std_duration': priority_data['consultation_duration'].std(),
                    'count': len(priority_data),
                    'percentile_75': priority_data['consultation_duration'].quantile(0.75),
                    'percentile_90': priority_data['consultation_duration'].quantile(0.90)
                }
        
        return priority_stats
    
    def _analyze_time_patterns(self, df: pd.DataFrame) -> Dict:
        """Analyze patterns by time of day and day of week"""
        patterns = {
            'hourly': {},
            'weekly': {}
        }
        
        # Hourly patterns (morning rush, lunch, afternoon, etc.)
        for hour in range(24):
            hour_data = df[df['hour'] == hour]
            if len(hour_data) > 0:
                patterns['hourly'][hour] = {
                    'avg_duration': hour_data['consultation_duration'].mean(),
                    'count': len(hour_data),
                    'efficiency_factor': 1.0  # Will be calculated relative to baseline
                }
        
        # Weekly patterns (Monday vs Friday, etc.)
        for weekday in range(7):  # 0=Monday, 6=Sunday
            weekday_data = df[df['weekday'] == weekday]
            if len(weekday_data) > 0:
                patterns['weekly'][weekday] = {
                    'avg_duration': weekday_data['consultation_duration'].mean(),
                    'count': len(weekday_data),
                    'efficiency_factor': 1.0
                }
        
        # Calculate relative efficiency factors
        baseline_duration = df['consultation_duration'].mean()
        
        for hour_data in patterns['hourly'].values():
            hour_data['efficiency_factor'] = baseline_duration / hour_data['avg_duration']
        
        for weekday_data in patterns['weekly'].values():
            weekday_data['efficiency_factor'] = baseline_duration / weekday_data['avg_duration']
        
        return patterns
    
    def _analyze_efficiency_patterns(self, df: pd.DataFrame) -> Dict:
        """Analyze overall service efficiency patterns"""
        # Group by day to see daily efficiency trends
        df['date'] = df['created_at'].dt.date
        daily_stats = df.groupby('date').agg({
            'consultation_duration': ['mean', 'count', 'std']
        }).round(2)
        
        return {
            'daily_avg_duration': daily_stats['consultation_duration']['mean'].mean(),
            'daily_volume_avg': daily_stats['consultation_duration']['count'].mean(),
            'consistency_score': 1.0 / (1.0 + daily_stats['consultation_duration']['mean'].std()),
            'volume_trends': daily_stats['consultation_duration']['count'].tolist()[-7:]  # Last 7 days
        }
    
    def _analyze_current_factors(self, service_id: int, priority: ServicePriority, 
                                db: Session) -> WaitTimeFactors:
        """
        Analyze current real-time factors affecting wait time
        """
        # Get current queue state
        current_queue = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).all()
        
        # Priority distribution
        priority_dist = defaultdict(int)
        for ticket in current_queue:
            priority_dist[ticket.priority.value] += 1
        
        # Current time factors
        now = datetime.now()
        hour = now.hour
        weekday = now.weekday()
        
        # Time of day factor (morning rush, lunch dip, afternoon efficiency)
        time_factors = {
            # Morning: slightly slower (new day startup)
            range(7, 9): 1.2,
            # Peak morning: efficient
            range(9, 12): 0.9,
            # Lunch time: slower
            range(12, 14): 1.4,
            # Afternoon: most efficient
            range(14, 17): 0.8,
            # Late afternoon: slower
            range(17, 19): 1.1,
            # Evening: variable
            range(19, 22): 1.3
        }
        
        time_factor = 1.0
        for time_range, factor in time_factors.items():
            if hour in time_range:
                time_factor = factor
                break
        
        # Day of week factor
        weekday_factors = {
            0: 1.0,  # Monday: normal
            1: 0.9,  # Tuesday: efficient
            2: 0.9,  # Wednesday: efficient  
            3: 1.0,  # Thursday: normal
            4: 1.1,  # Friday: slightly slower
            5: 1.2,  # Saturday: slower (weekend staff)
            6: 1.3   # Sunday: slowest
        }
        
        day_factor = weekday_factors.get(weekday, 1.0)
        
        # Emergency load factor (high priority cases create delays)
        emergency_ratio = priority_dist['high'] / max(1, len(current_queue))
        emergency_load = 1.0 + (emergency_ratio * 0.5)  # 50% slower with all high priority
        
        return WaitTimeFactors(
            base_service_time=15.0,  # Will be updated with AI model
            current_queue_length=len(current_queue),
            priority_distribution=dict(priority_dist),
            time_of_day_factor=time_factor,
            day_of_week_factor=day_factor,
            historical_efficiency=1.0,  # Will be set from model
            staff_availability=1.0,  # Estimated from patterns
            emergency_load=emergency_load
        )
    
    def _ai_estimation(self, service_id: int, priority: ServicePriority, 
                      position_in_queue: int, factors: WaitTimeFactors, 
                      model: Dict, db: Session) -> EstimationResult:
        """
        AI-powered estimation using historical patterns and current factors
        """
        # Get base consultation time for this priority
        priority_key = priority.value
        if priority_key in model["priority_patterns"]:
            base_time = model["priority_patterns"][priority_key]["avg_duration"]
            time_std = model["priority_patterns"][priority_key]["std_duration"]
        else:
            base_time = model["avg_consultation_time"]
            time_std = model["consultation_time_std"]
        
        # Apply time-based adjustments
        hour = datetime.now().hour
        weekday = datetime.now().weekday()
        
        # Time efficiency factor
        time_efficiency = 1.0
        if str(hour) in model["time_patterns"]["hourly"]:
            time_efficiency = model["time_patterns"]["hourly"][str(hour)]["efficiency_factor"]
        
        # Weekday efficiency factor
        weekday_efficiency = 1.0
        if str(weekday) in model["time_patterns"]["weekly"]:
            weekday_efficiency = model["time_patterns"]["weekly"][str(weekday)]["efficiency_factor"]
        
        # Combine all factors
        adjusted_consultation_time = base_time * (
            factors.time_of_day_factor * 
            factors.day_of_week_factor * 
            factors.emergency_load *
            (1.0 / time_efficiency) *  # Lower efficiency = longer time
            (1.0 / weekday_efficiency)
        )
        
        # Queue position adjustment based on priority
        queue_ahead = position_in_queue - 1
        
        # Priority jumping logic - high priority patients may jump ahead
        if priority == ServicePriority.HIGH:
            # High priority: minimal wait regardless of position
            effective_position = min(queue_ahead, 2)  # Max 2 people ahead
        elif priority == ServicePriority.MEDIUM:
            # Medium priority: normal queue with slight advantage
            high_priority_ahead = factors.priority_distribution.get('high', 0)
            effective_position = high_priority_ahead + (queue_ahead - high_priority_ahead) * 0.8
        else:  # LOW priority
            # Low priority: may wait longer as others jump ahead
            effective_position = queue_ahead * 1.2
        
        # Calculate base wait time
        estimated_wait = max(0, effective_position * adjusted_consultation_time)
        
        # Add buffer for variability (based on historical std dev)
        variability_buffer = time_std * 0.3  # 30% of standard deviation
        
        # Final estimation
        final_estimate = int(estimated_wait + variability_buffer)
        
        # Calculate confidence based on data quality
        confidence = min(0.95, 0.4 + (model["ticket_count"] / 100.0))
        
        # Create explanation
        explanation_parts = []
        explanation_parts.append(f"IA: {base_time:.1f}min/patient moyen")
        
        if factors.time_of_day_factor != 1.0:
            explanation_parts.append(f"Heure: {factors.time_of_day_factor:.1f}x")
        
        if factors.emergency_load > 1.1:
            explanation_parts.append("Urgences en cours")
        
        if priority == ServicePriority.HIGH:
            explanation_parts.append("Priorité haute")
        
        explanation = " • ".join(explanation_parts)
        
        # Estimate range (±25%)
        min_estimate = max(1, int(final_estimate * 0.75))
        max_estimate = int(final_estimate * 1.25)
        
        return EstimationResult(
            estimated_minutes=max(1, final_estimate),
            confidence_level=confidence,
            factors_explanation=explanation,
            estimated_range=(min_estimate, max_estimate),
            next_update_in_minutes=3  # More frequent updates with AI
        )
    
    def _fallback_estimation(self, service_id: int, priority: ServicePriority, 
                           position_in_queue: int, factors: WaitTimeFactors, 
                           db: Session) -> EstimationResult:
        """
        Fallback estimation when insufficient historical data
        """
        # Get service average wait time
        service = db.query(Service).filter(Service.id == service_id).first()
        base_time = service.avg_wait_time if service and service.avg_wait_time > 0 else 15
        
        # Apply basic factors
        adjusted_time = base_time * factors.time_of_day_factor * factors.day_of_week_factor
        
        # Priority adjustments
        priority_multipliers = {
            ServicePriority.HIGH: 0.3,   # Jump ahead
            ServicePriority.MEDIUM: 1.0,  # Normal
            ServicePriority.LOW: 1.4     # Wait longer
        }
        
        effective_position = (position_in_queue - 1) * priority_multipliers[priority]
        estimated_wait = max(1, int(effective_position * adjusted_time))
        
        explanation = f"Estimation standard: {base_time}min/patient"
        if factors.time_of_day_factor != 1.0:
            explanation += f" • Ajusté pour l'heure"
        
        return EstimationResult(
            estimated_minutes=estimated_wait,
            confidence_level=0.5,  # Lower confidence without AI
            factors_explanation=explanation,
            estimated_range=(max(1, int(estimated_wait * 0.8)), int(estimated_wait * 1.3)),
            next_update_in_minutes=5
        )
    
    def get_service_insights(self, service_id: int, db: Session) -> Dict:
        """
        Get AI insights about service patterns for dashboard
        """
        model = self._get_service_model(service_id, db)
        
        if not model["has_enough_data"]:
            return {
                "status": "insufficient_data",
                "message": "Pas assez de données historiques pour l'analyse IA",
                "min_tickets_needed": self.min_historical_data
            }
        
        # Best and worst times
        hourly_patterns = model["time_patterns"]["hourly"]
        if hourly_patterns:
            best_hours = sorted(hourly_patterns.items(), 
                               key=lambda x: x[1]["efficiency_factor"], reverse=True)[:3]
            worst_hours = sorted(hourly_patterns.items(), 
                                key=lambda x: x[1]["efficiency_factor"])[:3]
        else:
            best_hours = worst_hours = []
        
        return {
            "status": "ready",
            "data_quality": {
                "historical_tickets": model["ticket_count"],
                "confidence_level": min(0.95, 0.4 + (model["ticket_count"] / 100.0)),
                "last_updated": model["last_updated"].isoformat()
            },
            "insights": {
                "avg_consultation_time": round(model["avg_consultation_time"], 1),
                "consistency_score": round(model["efficiency_patterns"]["consistency_score"], 2),
                "best_hours": [{"hour": int(h), "efficiency": round(d["efficiency_factor"], 2)} 
                              for h, d in best_hours],
                "worst_hours": [{"hour": int(h), "efficiency": round(d["efficiency_factor"], 2)} 
                               for h, d in worst_hours],
                "priority_impact": {
                    p: round(data["avg_duration"], 1) 
                    for p, data in model["priority_patterns"].items()
                }
            }
        }
    
    def bulk_update_estimates(self, service_id: int, db: Session) -> Dict:
        """
        Update wait time estimates for all waiting tickets in a service
        """
        waiting_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).order_by(Ticket.priority.desc(), Ticket.created_at.asc()).all()
        
        updated_count = 0
        estimates = []
        
        for ticket in waiting_tickets:
            try:
                result = self.estimate_wait_time(
                    service_id, ticket.priority, ticket.position_in_queue, db
                )
                
                # Update ticket with new estimate
                ticket.estimated_wait_time = result.estimated_minutes
                estimates.append({
                    "ticket_id": ticket.id,
                    "ticket_number": ticket.ticket_number,
                    "new_estimate": result.estimated_minutes,
                    "confidence": result.confidence_level,
                    "explanation": result.factors_explanation
                })
                updated_count += 1
                
            except Exception as e:
                logger.error(f"Error updating estimate for ticket {ticket.id}: {e}")
        
        if updated_count > 0:
            db.commit()
        
        return {
            "updated_count": updated_count,
            "total_tickets": len(waiting_tickets),
            "estimates": estimates
        }


# Global instance
ai_estimator = SmartWaitTimeEstimator()


def get_ai_wait_time_estimate(service_id: int, priority: ServicePriority, 
                             position_in_queue: int, db: Session) -> EstimationResult:
    """
    Public interface for getting AI wait time estimates
    """
    return ai_estimator.estimate_wait_time(service_id, priority, position_in_queue, db)


def get_service_ai_insights(service_id: int, db: Session) -> Dict:
    """
    Public interface for getting AI insights about a service
    """
    return ai_estimator.get_service_insights(service_id, db)


def refresh_all_estimates(service_id: int, db: Session) -> Dict:
    """
    Public interface for bulk updating estimates
    """
    return ai_estimator.bulk_update_estimates(service_id, db)