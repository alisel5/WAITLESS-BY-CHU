"""
Lightweight AI Wait Time Predictor
Uses statistical analysis and mathematical models without heavy ML dependencies
Perfect for constrained environments with limited disk space
"""

import json
import os
import math
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from collections import defaultdict, deque
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import Ticket, Service, ServicePriority, TicketStatus

class LightweightAIPredictor:
    """
    Lightweight AI Predictor using statistical analysis and pattern recognition
    
    Features:
    - Moving averages with trend detection
    - Time-pattern learning (hourly/daily)
    - Service-specific behavior modeling
    - Priority impact analysis
    - No external ML libraries required
    """
    
    def __init__(self, data_file: str = "ai_data/patterns.json"):
        self.data_file = data_file
        self.patterns = {
            'hourly_multipliers': {},    # Hour-based wait time multipliers
            'daily_multipliers': {},     # Day-based multipliers
            'service_patterns': {},      # Service-specific patterns
            'priority_effects': {},      # Priority impact data
            'moving_averages': {},       # Rolling averages
            'trend_data': {},           # Trend analysis
            'confidence_scores': {}      # Prediction confidence
        }
        
        # Ensure data directory exists
        os.makedirs(os.path.dirname(data_file) if os.path.dirname(data_file) else "ai_data", exist_ok=True)
        
        # Load existing patterns
        self.load_patterns()
        
        # Initialize default patterns if none exist
        if not self.patterns['hourly_multipliers']:
            self._initialize_default_patterns()
    
    def _initialize_default_patterns(self):
        """Initialize with realistic hospital patterns"""
        
        # Hospital peak hours (realistic multipliers)
        self.patterns['hourly_multipliers'] = {
            8: 1.2, 9: 1.4, 10: 1.5, 11: 1.3,    # Morning peak
            12: 1.1, 13: 1.0, 14: 1.3, 15: 1.4,  # Afternoon
            16: 1.5, 17: 1.2, 18: 0.9, 19: 0.8,  # Evening decline
            20: 0.7, 21: 0.6, 22: 0.5            # Night
        }
        
        # Day of week patterns (Monday=0, Sunday=6)
        self.patterns['daily_multipliers'] = {
            0: 1.3, 1: 1.4, 2: 1.2, 3: 1.1,     # Mon-Thu (busier)
            4: 1.0, 5: 0.8, 6: 0.7              # Fri-Sun (lighter)
        }
        
        # Priority effects (how much faster high priority patients are seen)
        self.patterns['priority_effects'] = {
            'high': 0.6,    # 40% faster
            'medium': 1.0,  # Normal
            'low': 1.3      # 30% slower
        }
    
    def learn_from_historical_data(self, db: Session, days_back: int = 30):
        """
        Learn patterns from historical data using statistical analysis
        """
        try:
            # Get historical completed tickets
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            completed_tickets = db.query(Ticket).filter(
                and_(
                    Ticket.status == TicketStatus.COMPLETED,
                    Ticket.created_at >= start_date,
                    Ticket.consultation_start.isnot(None)
                )
            ).all()
            
            if not completed_tickets:
                print("⚠️ No historical data found, using default patterns")
                return
            
            # Analyze patterns
            hourly_data = defaultdict(list)
            daily_data = defaultdict(list)
            service_data = defaultdict(list)
            priority_data = defaultdict(list)
            
            for ticket in completed_tickets:
                # Calculate actual wait time
                wait_time = (ticket.consultation_start - ticket.created_at).total_seconds() / 60
                
                # Group by hour
                hour = ticket.created_at.hour
                hourly_data[hour].append(wait_time)
                
                # Group by day of week
                day = ticket.created_at.weekday()
                daily_data[day].append(wait_time)
                
                # Group by service
                service_data[ticket.service_id].append(wait_time)
                
                # Group by priority
                priority_data[ticket.priority.value].append(wait_time)
            
            # Calculate intelligent averages and patterns
            self._update_hourly_patterns(hourly_data)
            self._update_daily_patterns(daily_data)
            self._update_service_patterns(service_data, db)
            self._update_priority_patterns(priority_data)
            
            # Save learned patterns
            self.save_patterns()
            
            print(f"✅ AI learned from {len(completed_tickets)} historical tickets")
            
        except Exception as e:
            print(f"⚠️ Error learning from data: {e}")
    
    def _update_hourly_patterns(self, hourly_data: Dict):
        """Update hourly multipliers based on statistical analysis"""
        
        # Calculate overall average
        all_times = [time for times in hourly_data.values() for time in times]
        if not all_times:
            return
            
        overall_avg = sum(all_times) / len(all_times)
        
        # Calculate hourly multipliers
        for hour, times in hourly_data.items():
            if times:
                hour_avg = sum(times) / len(times)
                multiplier = hour_avg / overall_avg if overall_avg > 0 else 1.0
                
                # Smooth with existing data (weighted average)
                existing = self.patterns['hourly_multipliers'].get(hour, multiplier)
                self.patterns['hourly_multipliers'][hour] = (existing * 0.7) + (multiplier * 0.3)
    
    def _update_daily_patterns(self, daily_data: Dict):
        """Update daily multipliers"""
        
        all_times = [time for times in daily_data.values() for time in times]
        if not all_times:
            return
            
        overall_avg = sum(all_times) / len(all_times)
        
        for day, times in daily_data.items():
            if times:
                day_avg = sum(times) / len(times)
                multiplier = day_avg / overall_avg if overall_avg > 0 else 1.0
                
                existing = self.patterns['daily_multipliers'].get(day, multiplier)
                self.patterns['daily_multipliers'][day] = (existing * 0.7) + (multiplier * 0.3)
    
    def _update_service_patterns(self, service_data: Dict, db: Session):
        """Update service-specific patterns"""
        
        for service_id, times in service_data.items():
            if times:
                avg_time = sum(times) / len(times)
                std_dev = self._calculate_std_dev(times)
                
                # Get service info
                service = db.query(Service).filter(Service.id == service_id).first()
                
                self.patterns['service_patterns'][service_id] = {
                    'avg_time': avg_time,
                    'std_dev': std_dev,
                    'confidence': min(1.0, len(times) / 50),  # More data = higher confidence
                    'service_name': service.name if service else f"Service {service_id}",
                    'sample_count': len(times)
                }
    
    def _update_priority_patterns(self, priority_data: Dict):
        """Update priority effect patterns"""
        
        if 'medium' in priority_data and priority_data['medium']:
            medium_avg = sum(priority_data['medium']) / len(priority_data['medium'])
            
            for priority, times in priority_data.items():
                if times:
                    priority_avg = sum(times) / len(times)
                    effect = priority_avg / medium_avg if medium_avg > 0 else 1.0
                    
                    existing = self.patterns['priority_effects'].get(priority, effect)
                    self.patterns['priority_effects'][priority] = (existing * 0.7) + (effect * 0.3)
    
    def _calculate_std_dev(self, values: List[float]) -> float:
        """Calculate standard deviation"""
        if len(values) < 2:
            return 0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return math.sqrt(variance)
    
    def predict_wait_time(self, service_id: int, priority: ServicePriority, 
                         position: int, db: Session) -> Tuple[int, Dict]:
        """
        Predict wait time using learned patterns and statistical analysis
        """
        
        try:
            # Get base service time
            service = db.query(Service).filter(Service.id == service_id).first()
            base_time = service.avg_wait_time if service else 15
            
            # Apply learned service pattern
            if service_id in self.patterns['service_patterns']:
                service_pattern = self.patterns['service_patterns'][service_id]
                base_time = service_pattern['avg_time']
            
            # Get current context
            now = datetime.now()
            hour = now.hour
            day = now.weekday()
            
            # Apply time-based multipliers
            hour_multiplier = self.patterns['hourly_multipliers'].get(hour, 1.0)
            day_multiplier = self.patterns['daily_multipliers'].get(day, 1.0)
            
            # Apply priority effect
            priority_effect = self.patterns['priority_effects'].get(priority.value, 1.0)
            
            # Calculate queue effect (non-linear - more realistic)
            queue_effect = self._calculate_queue_effect(position, service_id, db)
            
            # Combine all factors
            predicted_time = base_time * hour_multiplier * day_multiplier * priority_effect * queue_effect
            
            # Apply intelligent bounds
            predicted_time = max(2, min(180, int(predicted_time)))  # 2 min to 3 hours
            
            # Calculate confidence
            confidence = self._calculate_prediction_confidence(service_id, hour, day)
            
            # Prepare metadata
            metadata = {
                'prediction_type': 'lightweight_ai',
                'base_time': base_time,
                'hour_multiplier': hour_multiplier,
                'day_multiplier': day_multiplier,
                'priority_effect': priority_effect,
                'queue_effect': queue_effect,
                'confidence': confidence,
                'factors_used': {
                    'time_patterns': True,
                    'service_learning': service_id in self.patterns['service_patterns'],
                    'historical_data': len(self.patterns.get('service_patterns', {})) > 0
                }
            }
            
            return predicted_time, metadata
            
        except Exception as e:
            print(f"⚠️ AI prediction error: {e}")
            return self._fallback_prediction(service_id, priority, position, db)
    
    def _calculate_queue_effect(self, position: int, service_id: int, db: Session) -> float:
        """
        Calculate non-linear queue effect based on current load
        """
        
        # Get current queue length
        current_queue = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).count()
        
        # Non-linear queue effect (congestion modeling)
        if position <= 1:
            return 0.1  # Almost no wait for first person
        elif position <= 3:
            return position * 0.8  # Linear for small queue
        else:
            # Non-linear increase for longer queues (congestion effect)
            return 3 * 0.8 + (position - 3) * 1.2
    
    def _calculate_prediction_confidence(self, service_id: int, hour: int, day: int) -> float:
        """Calculate confidence score for prediction"""
        
        confidence_factors = []
        
        # Service-specific data confidence
        if service_id in self.patterns['service_patterns']:
            service_conf = self.patterns['service_patterns'][service_id]['confidence']
            confidence_factors.append(service_conf)
        else:
            confidence_factors.append(0.5)  # Medium confidence for unknown services
        
        # Time pattern confidence (peak hours = higher confidence)
        if hour in self.patterns['hourly_multipliers']:
            confidence_factors.append(0.9)
        else:
            confidence_factors.append(0.7)
        
        # Day pattern confidence
        if day in self.patterns['daily_multipliers']:
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.6)
        
        # Return weighted average
        return sum(confidence_factors) / len(confidence_factors)
    
    def _fallback_prediction(self, service_id: int, priority: ServicePriority, 
                           position: int, db: Session) -> Tuple[int, Dict]:
        """Simple fallback when AI fails"""
        
        service = db.query(Service).filter(Service.id == service_id).first()
        base_time = service.avg_wait_time if service else 15
        
        prediction = int((position - 1) * base_time)
        prediction = max(5, min(prediction, 120))
        
        metadata = {
            'prediction_type': 'simple_fallback',
            'base_time': base_time,
            'confidence': 0.6
        }
        
        return prediction, metadata
    
    def update_with_real_outcome(self, service_id: int, predicted_time: int, 
                                actual_time: int, context: Dict):
        """
        Update patterns based on real outcomes (online learning)
        """
        
        try:
            # Calculate prediction accuracy
            error = abs(predicted_time - actual_time)
            accuracy = 1.0 - (error / max(actual_time, 1))
            
            # Update moving averages for this service
            if service_id not in self.patterns['moving_averages']:
                self.patterns['moving_averages'][service_id] = deque(maxlen=50)
            
            self.patterns['moving_averages'][service_id].append({
                'actual_time': actual_time,
                'predicted_time': predicted_time,
                'accuracy': accuracy,
                'timestamp': datetime.now().isoformat(),
                'context': context
            })
            
            # Update confidence scores
            service_accuracies = [item['accuracy'] for item in self.patterns['moving_averages'][service_id]]
            avg_accuracy = sum(service_accuracies) / len(service_accuracies)
            self.patterns['confidence_scores'][service_id] = avg_accuracy
            
            # Auto-save patterns periodically
            if len(self.patterns['moving_averages'][service_id]) % 10 == 0:
                self.save_patterns()
            
        except Exception as e:
            print(f"⚠️ Error updating with real outcome: {e}")
    
    def get_ai_insights(self, db: Session) -> Dict:
        """
        Generate AI insights and recommendations
        """
        
        insights = {
            'peak_hours': [],
            'bottleneck_services': [],
            'efficiency_recommendations': [],
            'prediction_accuracy': {},
            'data_quality': 'good'
        }
        
        try:
            # Find peak hours
            if self.patterns['hourly_multipliers']:
                peak_hours = sorted(self.patterns['hourly_multipliers'].items(), 
                                  key=lambda x: x[1], reverse=True)[:3]
                insights['peak_hours'] = [f"{hour}h00 (×{mult:.1f})" 
                                        for hour, mult in peak_hours]
            
            # Identify bottleneck services
            for service_id, pattern in self.patterns.get('service_patterns', {}).items():
                if pattern['avg_time'] > 30:  # More than 30 min average
                    insights['bottleneck_services'].append({
                        'service': pattern['service_name'],
                        'avg_time': f"{pattern['avg_time']:.0f} min",
                        'confidence': f"{pattern['confidence']:.0%}"
                    })
            
            # Generate recommendations
            if insights['peak_hours']:
                insights['efficiency_recommendations'].append(
                    f"Heures de pointe: {', '.join(insights['peak_hours'][:2])} - Prévoir personnel supplémentaire"
                )
            
            if insights['bottleneck_services']:
                worst_service = max(insights['bottleneck_services'], 
                                  key=lambda x: float(x['avg_time'].split()[0]))
                insights['efficiency_recommendations'].append(
                    f"Service {worst_service['service']}: optimiser les processus (attente: {worst_service['avg_time']})"
                )
            
            # Prediction accuracy
            for service_id, accuracy in self.patterns.get('confidence_scores', {}).items():
                service_name = self.patterns.get('service_patterns', {}).get(service_id, {}).get('service_name', f'Service {service_id}')
                insights['prediction_accuracy'][service_name] = f"{accuracy:.0%}"
            
        except Exception as e:
            print(f"⚠️ Error generating insights: {e}")
        
        return insights
    
    def save_patterns(self):
        """Save learned patterns to file"""
        try:
            with open(self.data_file, 'w') as f:
                # Convert deque objects to lists for JSON serialization
                serializable_patterns = {}
                for key, value in self.patterns.items():
                    if key == 'moving_averages':
                        serializable_patterns[key] = {k: list(v) for k, v in value.items()}
                    else:
                        serializable_patterns[key] = value
                
                json.dump(serializable_patterns, f, indent=2)
        except Exception as e:
            print(f"⚠️ Error saving patterns: {e}")
    
    def load_patterns(self):
        """Load learned patterns from file"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'r') as f:
                    loaded_patterns = json.load(f)
                    
                    # Convert lists back to deques for moving averages
                    if 'moving_averages' in loaded_patterns:
                        loaded_patterns['moving_averages'] = {
                            k: deque(v, maxlen=50) 
                            for k, v in loaded_patterns['moving_averages'].items()
                        }
                    
                    self.patterns.update(loaded_patterns)
        except Exception as e:
            print(f"⚠️ Error loading patterns: {e}")
    
    def get_status(self) -> Dict:
        """Get AI system status"""
        
        total_services = len(self.patterns.get('service_patterns', {}))
        total_patterns = len(self.patterns.get('hourly_multipliers', {}))
        
        avg_confidence = 0
        if self.patterns.get('confidence_scores'):
            avg_confidence = sum(self.patterns['confidence_scores'].values()) / len(self.patterns['confidence_scores'])
        
        return {
            'type': 'lightweight_ai',
            'is_trained': total_services > 0 or total_patterns > 0,
            'services_learned': total_services,
            'patterns_count': total_patterns,
            'avg_confidence': avg_confidence,
            'data_file': self.data_file,
            'memory_usage': 'minimal',
            'dependencies': 'none'
        }

# Global instance
lightweight_ai = LightweightAIPredictor()