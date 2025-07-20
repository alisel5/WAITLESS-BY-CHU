"""
AI Data Collector for Wait Time Prediction
Collects and prepares training data from the hospital queue system
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Dict, Optional
import logging

# Import your existing models
from models import Ticket, Service, User, TicketStatus, ServicePriority, QueueLog

class AIDataCollector:
    """Collects and prepares data for AI training"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    def collect_training_data(self, db: Session, days_back: int = 30) -> pd.DataFrame:
        """
        Collect historical data for training the wait time prediction model
        
        Args:
            db: Database session
            days_back: Number of days to look back for training data
            
        Returns:
            pandas DataFrame with features and target variables
        """
        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Get completed tickets with timing information
            completed_tickets = db.query(Ticket).filter(
                and_(
                    Ticket.status == TicketStatus.COMPLETED,
                    Ticket.created_at >= start_date,
                    Ticket.consultation_start.isnot(None),
                    Ticket.consultation_end.isnot(None)
                )
            ).all()
            
            if not completed_tickets:
                self.logger.warning("No completed tickets found for training data")
                return pd.DataFrame()
            
            # Prepare data
            training_data = []
            
            for ticket in completed_tickets:
                # Calculate actual wait time (from creation to consultation start)
                if ticket.consultation_start and ticket.created_at:
                    actual_wait_minutes = (ticket.consultation_start - ticket.created_at).total_seconds() / 60
                    
                    # Calculate actual consultation duration
                    consultation_duration = 0
                    if ticket.consultation_end and ticket.consultation_start:
                        consultation_duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
                    
                    # Extract features
                    features = self._extract_features(ticket, db)
                    
                    # Add target variables
                    features.update({
                        'actual_wait_time': actual_wait_minutes,
                        'consultation_duration': consultation_duration,
                        'total_time': actual_wait_minutes + consultation_duration
                    })
                    
                    training_data.append(features)
            
            df = pd.DataFrame(training_data)
            self.logger.info(f"Collected {len(df)} training samples")
            
            return df
            
        except Exception as e:
            self.logger.error(f"Error collecting training data: {e}")
            return pd.DataFrame()
    
    def _extract_features(self, ticket: Ticket, db: Session) -> Dict:
        """Extract features from a ticket for ML training"""
        
        created_time = ticket.created_at
        
        # Time-based features
        hour_of_day = created_time.hour
        day_of_week = created_time.weekday()  # 0=Monday, 6=Sunday
        is_weekend = day_of_week >= 5
        is_peak_hour = hour_of_day in [9, 10, 11, 14, 15, 16]  # Typical hospital peak hours
        
        # Priority features
        priority_mapping = {
            ServicePriority.LOW: 1,
            ServicePriority.MEDIUM: 2, 
            ServicePriority.HIGH: 3
        }
        priority_score = priority_mapping.get(ticket.priority, 2)
        
        # Service features
        service_id = ticket.service_id
        service = ticket.service
        service_avg_time = service.avg_wait_time if service else 15
        
        # Queue context at time of joining
        queue_position = ticket.position_in_queue or 1
        
        # Count of patients in queue when this patient joined (approximate)
        concurrent_patients = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at <= created_time,
                Ticket.created_at >= created_time - timedelta(hours=2),
                Ticket.status.in_([TicketStatus.WAITING])
            )
        ).count()
        
        # Historical service load (patients in last hour)
        recent_load = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at <= created_time,
                Ticket.created_at >= created_time - timedelta(hours=1)
            )
        ).count()
        
        return {
            'service_id': service_id,
            'hour_of_day': hour_of_day,
            'day_of_week': day_of_week,
            'is_weekend': int(is_weekend),
            'is_peak_hour': int(is_peak_hour),
            'priority_score': priority_score,
            'queue_position': queue_position,
            'service_avg_time': service_avg_time,
            'concurrent_patients': concurrent_patients,
            'recent_load': recent_load,
            'created_timestamp': created_time.timestamp()
        }
    
    def get_current_context_features(self, service_id: int, priority: ServicePriority, 
                                   position: int, db: Session) -> Dict:
        """Get current context features for real-time prediction"""
        
        now = datetime.now()
        
        # Time features
        hour_of_day = now.hour
        day_of_week = now.weekday()
        is_weekend = day_of_week >= 5
        is_peak_hour = hour_of_day in [9, 10, 11, 14, 15, 16]
        
        # Priority features
        priority_mapping = {
            ServicePriority.LOW: 1,
            ServicePriority.MEDIUM: 2,
            ServicePriority.HIGH: 3
        }
        priority_score = priority_mapping.get(priority, 2)
        
        # Service features
        service = db.query(Service).filter(Service.id == service_id).first()
        service_avg_time = service.avg_wait_time if service else 15
        
        # Current queue load
        current_waiting = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).count()
        
        # Recent activity (last hour)
        recent_load = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= now - timedelta(hours=1)
            )
        ).count()
        
        return {
            'service_id': service_id,
            'hour_of_day': hour_of_day,
            'day_of_week': day_of_week,
            'is_weekend': int(is_weekend),
            'is_peak_hour': int(is_peak_hour),
            'priority_score': priority_score,
            'queue_position': position,
            'service_avg_time': service_avg_time,
            'concurrent_patients': current_waiting,
            'recent_load': recent_load,
            'created_timestamp': now.timestamp()
        }
    
    def generate_synthetic_data(self, db: Session, num_samples: int = 1000) -> pd.DataFrame:
        """
        Generate synthetic training data if historical data is insufficient
        This creates realistic but artificial data based on hospital patterns
        """
        
        synthetic_data = []
        services = db.query(Service).all()
        
        if not services:
            return pd.DataFrame()
        
        # Generate samples
        for _ in range(num_samples):
            # Random service
            service = np.random.choice(services)
            
            # Random time (business hours mostly)
            hour = np.random.choice([8, 9, 10, 11, 14, 15, 16, 17], p=[0.1, 0.2, 0.2, 0.15, 0.15, 0.15, 0.04, 0.01])
            day_of_week = np.random.randint(0, 7)
            is_weekend = day_of_week >= 5
            is_peak_hour = hour in [9, 10, 11, 14, 15, 16]
            
            # Random priority (realistic distribution)
            priority_score = np.random.choice([1, 2, 3], p=[0.3, 0.6, 0.1])  # Most are medium priority
            
            # Queue position and context
            queue_position = np.random.randint(1, 20)
            concurrent_patients = queue_position + np.random.randint(0, 10)
            recent_load = np.random.randint(1, 15)
            
            # Generate realistic wait time based on factors
            base_wait = service.avg_wait_time or 15
            
            # Apply modifiers
            time_modifier = 1.0
            if is_peak_hour:
                time_modifier *= 1.3
            if is_weekend:
                time_modifier *= 0.8
            if priority_score == 3:  # High priority
                time_modifier *= 0.7
            elif priority_score == 1:  # Low priority
                time_modifier *= 1.2
            
            # Position effect
            position_effect = (queue_position - 1) * base_wait * 0.8
            
            # Randomness
            randomness = np.random.normal(1.0, 0.2)
            
            actual_wait_time = max(5, int((base_wait + position_effect) * time_modifier * randomness))
            consultation_duration = max(5, int(np.random.normal(base_wait, base_wait * 0.3)))
            
            synthetic_data.append({
                'service_id': service.id,
                'hour_of_day': hour,
                'day_of_week': day_of_week,
                'is_weekend': int(is_weekend),
                'is_peak_hour': int(is_peak_hour),
                'priority_score': priority_score,
                'queue_position': queue_position,
                'service_avg_time': base_wait,
                'concurrent_patients': concurrent_patients,
                'recent_load': recent_load,
                'created_timestamp': datetime.now().timestamp(),
                'actual_wait_time': actual_wait_time,
                'consultation_duration': consultation_duration,
                'total_time': actual_wait_time + consultation_duration
            })
        
        df = pd.DataFrame(synthetic_data)
        self.logger.info(f"Generated {len(df)} synthetic training samples")
        
        return df