"""
Smart Wait Time Prediction Engine
Uses statistical learning and pattern analysis without external ML libraries
"""

import json
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import statistics

class SmartWaitTimePredictor:
    """
    Intelligent wait time prediction using:
    1. Historical pattern analysis
    2. Time-based adjustments (hour, day of week)
    3. Service load and efficiency factors
    4. Priority queue dynamics
    5. Staff performance patterns
    """
    
    def __init__(self):
        self.cache_duration = 300  # 5 minutes cache
        self.prediction_cache = {}
        self.pattern_cache = {}
        self.last_cache_update = {}
        
        # Weighted factors for prediction
        self.weights = {
            'historical_avg': 0.3,
            'recent_trend': 0.25,
            'time_adjustment': 0.2,
            'load_factor': 0.15,
            'priority_impact': 0.1
        }
    
    def predict_wait_time(self, service_id: int, position: int, priority: str, 
                         current_time: datetime, db: Session) -> Dict:
        """
        Main prediction function that combines multiple factors
        """
        try:
            # Get cached prediction if available
            cache_key = f"{service_id}_{position}_{priority}_{current_time.hour}"
            if self._is_cache_valid(cache_key):
                cached_result = self.prediction_cache[cache_key]
                # Adjust for exact position
                cached_result['estimated_wait_minutes'] = max(1, 
                    int(cached_result['base_time_per_patient'] * (position - 1)))
                return cached_result
            
            # Calculate base time per patient from recent data
            base_time = self._calculate_base_service_time(service_id, db)
            
            # Apply time-of-day adjustments
            time_factor = self._get_time_adjustment_factor(current_time, service_id, db)
            
            # Calculate service load factor
            load_factor = self._get_current_load_factor(service_id, db)
            
            # Apply priority adjustments
            priority_factor = self._get_priority_factor(priority, service_id, db)
            
            # Calculate trend factor from recent performance
            trend_factor = self._get_recent_trend_factor(service_id, db)
            
            # Combine all factors using weighted approach
            adjusted_time_per_patient = base_time * time_factor * load_factor * trend_factor
            
            # Calculate final wait time
            estimated_wait = max(1, int((position - 1) * adjusted_time_per_patient * priority_factor))
            
            # Calculate confidence score
            confidence = self._calculate_confidence_score(service_id, db)
            
            # Prepare result
            result = {
                'estimated_wait_minutes': estimated_wait,
                'base_time_per_patient': adjusted_time_per_patient,
                'confidence_score': confidence,
                'factors': {
                    'base_time': base_time,
                    'time_factor': time_factor,
                    'load_factor': load_factor,
                    'priority_factor': priority_factor,
                    'trend_factor': trend_factor
                },
                'prediction_quality': self._get_quality_rating(confidence),
                'estimated_call_time': (current_time + timedelta(minutes=estimated_wait)).isoformat()
            }
            
            # Cache the result
            self.prediction_cache[cache_key] = result.copy()
            self.last_cache_update[cache_key] = datetime.now()
            
            return result
            
        except Exception as e:
            # Fallback to simple calculation
            return self._fallback_prediction(position, service_id, db)
    
    def _calculate_base_service_time(self, service_id: int, db: Session) -> float:
        """Calculate base service time from recent completed tickets"""
        from models import Ticket, TicketStatus
        
        # Get recent completed tickets (last 7 days)
        week_ago = datetime.now() - timedelta(days=7)
        
        completed_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.COMPLETED,
                Ticket.consultation_start.isnot(None),
                Ticket.consultation_end.isnot(None),
                Ticket.created_at >= week_ago
            )
        ).all()
        
        if not completed_tickets:
            # Fallback to service avg_wait_time or default
            from models import Service
            service = db.query(Service).filter(Service.id == service_id).first()
            return service.avg_wait_time if service and service.avg_wait_time > 0 else 15.0
        
        # Calculate actual service times
        service_times = []
        for ticket in completed_tickets:
            if ticket.consultation_start and ticket.consultation_end:
                duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
                if 1 <= duration <= 120:  # Reasonable range: 1-120 minutes
                    service_times.append(duration)
        
        if not service_times:
            return 15.0  # Default fallback
        
        # Use weighted average with more weight on recent data
        service_times.sort(key=lambda x: completed_tickets[service_times.index(x)].created_at, reverse=True)
        
        # Calculate weighted average (more recent = higher weight)
        total_weight = 0
        weighted_sum = 0
        for i, time in enumerate(service_times[:20]):  # Use last 20 tickets max
            weight = 1.0 / (i + 1)  # Decreasing weight for older data
            weighted_sum += time * weight
            total_weight += weight
        
        return weighted_sum / total_weight if total_weight > 0 else statistics.median(service_times)
    
    def _get_time_adjustment_factor(self, current_time: datetime, service_id: int, db: Session) -> float:
        """Adjust prediction based on time of day and day of week patterns"""
        hour = current_time.hour
        day_of_week = current_time.weekday()  # 0 = Monday
        
        # Get historical patterns for this time
        patterns = self._get_time_patterns(service_id, db)
        
        # Base time factors (general hospital patterns)
        hour_factors = {
            8: 1.3,   # Morning rush
            9: 1.4,   # Peak morning
            10: 1.2,
            11: 1.1,
            12: 0.8,  # Lunch break - less patients
            13: 0.9,
            14: 1.0,  # Normal afternoon
            15: 1.1,
            16: 1.2,
            17: 1.0,
            18: 0.7,  # Evening slowdown
        }
        
        # Day of week factors
        day_factors = {
            0: 1.2,  # Monday - busy
            1: 1.1,  # Tuesday
            2: 1.0,  # Wednesday - normal
            3: 1.0,  # Thursday
            4: 0.9,  # Friday - lighter
            5: 0.6,  # Saturday - much lighter
            6: 0.4,  # Sunday - very light
        }
        
        hour_factor = hour_factors.get(hour, 1.0)
        day_factor = day_factors.get(day_of_week, 1.0)
        
        # Combine with historical data if available
        if patterns:
            historical_factor = patterns.get(f"{day_of_week}_{hour}", 1.0)
            # Weighted combination: 60% historical, 40% general pattern
            final_factor = (historical_factor * 0.6) + ((hour_factor * day_factor) * 0.4)
        else:
            final_factor = hour_factor * day_factor
        
        return max(0.3, min(2.0, final_factor))  # Reasonable bounds
    
    def _get_current_load_factor(self, service_id: int, db: Session) -> float:
        """Calculate load factor based on current queue length vs normal"""
        from models import Ticket, TicketStatus
        
        # Current waiting count
        current_waiting = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).count()
        
        # Get average waiting count for this time period
        current_hour = datetime.now().hour
        historical_avg = self._get_historical_avg_waiting(service_id, current_hour, db)
        
        if historical_avg == 0:
            return 1.0
        
        # Calculate load factor
        load_ratio = current_waiting / historical_avg
        
        # Convert to factor (more waiting = slower service)
        if load_ratio <= 0.5:
            return 0.8  # Light load - faster service
        elif load_ratio <= 1.0:
            return 1.0  # Normal load
        elif load_ratio <= 1.5:
            return 1.2  # Heavy load
        elif load_ratio <= 2.0:
            return 1.4  # Very heavy load
        else:
            return 1.6  # Extreme load
    
    def _get_priority_factor(self, priority: str, service_id: int, db: Session) -> float:
        """Calculate how priority affects wait time in this service's queue"""
        from models import Ticket, TicketStatus, ServicePriority
        
        # Priority multipliers based on queue jumping behavior
        priority_multipliers = {
            'low': 1.1,      # Might wait a bit longer
            'medium': 1.0,   # Standard wait
            'high': 0.7,     # Gets seen faster
            'emergency': 0.2 # Almost immediate
        }
        
        # Check recent priority distribution to adjust
        recent_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= datetime.now() - timedelta(hours=24)
            )
        ).all()
        
        if recent_tickets:
            priority_counts = {}
            for ticket in recent_tickets:
                p = ticket.priority.value if ticket.priority else 'medium'
                priority_counts[p] = priority_counts.get(p, 0) + 1
            
            total_tickets = len(recent_tickets)
            high_priority_ratio = (priority_counts.get('high', 0) + 
                                 priority_counts.get('emergency', 0)) / total_tickets
            
            # If many high priority patients, adjust factors
            if high_priority_ratio > 0.3:  # More than 30% high priority
                if priority in ['low', 'medium']:
                    return priority_multipliers[priority] * 1.2  # Wait longer
        
        return priority_multipliers.get(priority, 1.0)
    
    def _get_recent_trend_factor(self, service_id: int, db: Session) -> float:
        """Analyze recent performance trends"""
        from models import Ticket, TicketStatus
        
        # Get tickets from last 2 hours
        two_hours_ago = datetime.now() - timedelta(hours=2)
        
        recent_completed = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.COMPLETED,
                Ticket.consultation_end >= two_hours_ago,
                Ticket.consultation_start.isnot(None),
                Ticket.consultation_end.isnot(None)
            )
        ).all()
        
        if len(recent_completed) < 3:
            return 1.0  # Not enough data
        
        # Calculate recent average service time
        recent_times = []
        for ticket in recent_completed:
            duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
            if 1 <= duration <= 120:
                recent_times.append(duration)
        
        if not recent_times:
            return 1.0
        
        recent_avg = statistics.mean(recent_times)
        
        # Compare with historical average
        historical_avg = self._calculate_base_service_time(service_id, db)
        
        # Calculate trend factor
        trend_ratio = recent_avg / historical_avg
        
        # Smooth the factor to avoid extreme adjustments
        return max(0.7, min(1.5, trend_ratio))
    
    def _calculate_confidence_score(self, service_id: int, db: Session) -> float:
        """Calculate confidence in the prediction based on data quality"""
        from models import Ticket, TicketStatus
        
        # Factors that affect confidence
        factors = []
        
        # 1. Amount of historical data
        week_ago = datetime.now() - timedelta(days=7)
        historical_count = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= week_ago
            )
        ).count()
        
        data_confidence = min(1.0, historical_count / 50)  # 50+ tickets = full confidence
        factors.append(data_confidence)
        
        # 2. Consistency of recent service times
        recent_completed = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.COMPLETED,
                Ticket.created_at >= datetime.now() - timedelta(days=3),
                Ticket.consultation_start.isnot(None),
                Ticket.consultation_end.isnot(None)
            )
        ).all()
        
        if len(recent_completed) >= 3:
            service_times = []
            for ticket in recent_completed:
                duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
                if 1 <= duration <= 120:
                    service_times.append(duration)
            
            if len(service_times) >= 3:
                # Lower standard deviation = higher confidence
                std_dev = statistics.stdev(service_times)
                mean_time = statistics.mean(service_times)
                coefficient_variation = std_dev / mean_time if mean_time > 0 else 1
                consistency_confidence = max(0.3, 1.0 - coefficient_variation)
                factors.append(consistency_confidence)
        
        # 3. Time since last update
        current_hour = datetime.now().hour
        if 8 <= current_hour <= 18:  # Normal working hours
            time_confidence = 0.9
        else:
            time_confidence = 0.6  # Less confidence outside normal hours
        factors.append(time_confidence)
        
        # Calculate overall confidence
        return statistics.mean(factors) if factors else 0.5
    
    def _get_quality_rating(self, confidence: float) -> str:
        """Convert confidence score to quality rating"""
        if confidence >= 0.8:
            return "high"
        elif confidence >= 0.6:
            return "medium"
        else:
            return "low"
    
    def _get_time_patterns(self, service_id: int, db: Session) -> Dict:
        """Get time-based patterns for this service"""
        from models import Ticket, TicketStatus
        
        # Check cache first
        cache_key = f"patterns_{service_id}"
        if self._is_cache_valid(cache_key):
            return self.pattern_cache[cache_key]
        
        # Calculate patterns from last 30 days
        month_ago = datetime.now() - timedelta(days=30)
        
        tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= month_ago,
                Ticket.consultation_start.isnot(None),
                Ticket.consultation_end.isnot(None)
            )
        ).all()
        
        patterns = {}
        time_buckets = {}
        
        for ticket in tickets:
            day_of_week = ticket.created_at.weekday()
            hour = ticket.created_at.hour
            key = f"{day_of_week}_{hour}"
            
            duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
            
            if key not in time_buckets:
                time_buckets[key] = []
            time_buckets[key].append(duration)
        
        # Calculate averages for each time bucket
        overall_avg = 15.0  # Default
        all_durations = [d for bucket in time_buckets.values() for d in bucket]
        if all_durations:
            overall_avg = statistics.mean(all_durations)
        
        for key, durations in time_buckets.items():
            if len(durations) >= 3:  # Need at least 3 data points
                avg_duration = statistics.mean(durations)
                patterns[key] = avg_duration / overall_avg  # Relative factor
        
        # Cache the patterns
        self.pattern_cache[cache_key] = patterns
        self.last_cache_update[cache_key] = datetime.now()
        
        return patterns
    
    def _get_historical_avg_waiting(self, service_id: int, hour: int, db: Session) -> float:
        """Get historical average waiting count for this hour"""
        from models import Ticket, TicketStatus
        
        # Get data from last 30 days for this hour
        waiting_counts = []
        
        for days_back in range(1, 31):
            check_time = datetime.now() - timedelta(days=days_back)
            if check_time.hour == hour:
                # Count tickets that were waiting at this time
                count = db.query(Ticket).filter(
                    and_(
                        Ticket.service_id == service_id,
                        Ticket.status == TicketStatus.WAITING,
                        Ticket.created_at <= check_time
                    )
                ).count()
                waiting_counts.append(count)
        
        return statistics.mean(waiting_counts) if waiting_counts else 5.0
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.last_cache_update:
            return False
        
        age = (datetime.now() - self.last_cache_update[cache_key]).total_seconds()
        return age < self.cache_duration
    
    def _fallback_prediction(self, position: int, service_id: int, db: Session) -> Dict:
        """Simple fallback prediction when main algorithm fails"""
        from models import Service
        
        service = db.query(Service).filter(Service.id == service_id).first()
        base_time = service.avg_wait_time if service and service.avg_wait_time > 0 else 15
        
        estimated_wait = max(1, (position - 1) * base_time)
        
        return {
            'estimated_wait_minutes': estimated_wait,
            'base_time_per_patient': base_time,
            'confidence_score': 0.5,
            'factors': {'fallback': True},
            'prediction_quality': 'low',
            'estimated_call_time': (datetime.now() + timedelta(minutes=estimated_wait)).isoformat()
        }
    
    def get_service_performance_insights(self, service_id: int, db: Session) -> Dict:
        """Get detailed performance insights for a service"""
        from models import Ticket, TicketStatus, Service
        
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return {}
        
        # Get recent performance data
        week_ago = datetime.now() - timedelta(days=7)
        
        tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= week_ago
            )
        ).all()
        
        if not tickets:
            return {'message': 'Insufficient data for analysis'}
        
        # Calculate various metrics
        completed_tickets = [t for t in tickets if t.status == TicketStatus.COMPLETED 
                           and t.consultation_start and t.consultation_end]
        
        insights = {
            'service_name': service.name,
            'analysis_period': '7 days',
            'total_tickets': len(tickets),
            'completed_tickets': len(completed_tickets),
            'completion_rate': len(completed_tickets) / len(tickets) * 100,
        }
        
        if completed_tickets:
            # Service time analysis
            service_times = []
            wait_times = []
            
            for ticket in completed_tickets:
                # Service duration
                service_duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
                if 1 <= service_duration <= 120:
                    service_times.append(service_duration)
                
                # Wait time (from creation to consultation start)
                wait_duration = (ticket.consultation_start - ticket.created_at).total_seconds() / 60
                if 0 <= wait_duration <= 480:  # Max 8 hours
                    wait_times.append(wait_duration)
            
            if service_times:
                insights.update({
                    'avg_service_time': round(statistics.mean(service_times), 1),
                    'median_service_time': round(statistics.median(service_times), 1),
                    'service_time_std': round(statistics.stdev(service_times) if len(service_times) > 1 else 0, 1)
                })
            
            if wait_times:
                insights.update({
                    'avg_wait_time': round(statistics.mean(wait_times), 1),
                    'median_wait_time': round(statistics.median(wait_times), 1),
                    'max_wait_time': round(max(wait_times), 1)
                })
        
        # Current prediction quality
        current_prediction = self.predict_wait_time(service_id, 1, 'medium', datetime.now(), db)
        insights['prediction_confidence'] = current_prediction['confidence_score']
        insights['prediction_quality'] = current_prediction['prediction_quality']
        
        return insights