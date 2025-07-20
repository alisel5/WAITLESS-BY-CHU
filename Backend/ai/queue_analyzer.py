"""
Queue Pattern Analyzer
Analyzes queue patterns and provides operational insights
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import statistics

class QueuePatternAnalyzer:
    """
    Analyzes queue patterns to identify:
    1. Peak hours and bottlenecks
    2. Efficiency trends
    3. Service optimization opportunities
    4. Staff allocation recommendations
    """
    
    def __init__(self):
        self.analysis_cache = {}
        self.cache_duration = 600  # 10 minutes cache
    
    def analyze_service_patterns(self, service_id: int, db: Session) -> Dict:
        """Comprehensive service pattern analysis"""
        from models import Ticket, TicketStatus, Service
        
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return {'error': 'Service not found'}
        
        # Get data for last 30 days
        start_date = datetime.now() - timedelta(days=30)
        
        tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= start_date
            )
        ).all()
        
        if not tickets:
            return {'message': 'Insufficient data for analysis'}
        
        analysis = {
            'service_name': service.name,
            'analysis_period': '30 days',
            'total_tickets': len(tickets),
            'peak_hours': self._analyze_peak_hours(tickets),
            'daily_patterns': self._analyze_daily_patterns(tickets),
            'efficiency_trends': self._analyze_efficiency_trends(tickets, db),
            'bottleneck_indicators': self._detect_bottlenecks(service_id, tickets, db),
            'recommendations': self._generate_recommendations(service_id, tickets, db)
        }
        
        return analysis
    
    def _analyze_peak_hours(self, tickets: List) -> Dict:
        """Analyze which hours have the most activity"""
        hour_counts = {}
        hour_wait_times = {}
        
        for ticket in tickets:
            hour = ticket.created_at.hour
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
            
            if ticket.estimated_wait_time:
                if hour not in hour_wait_times:
                    hour_wait_times[hour] = []
                hour_wait_times[hour].append(ticket.estimated_wait_time)
        
        # Find peak hours
        if hour_counts:
            avg_hourly = statistics.mean(hour_counts.values())
            peak_hours = [hour for hour, count in hour_counts.items() 
                         if count > avg_hourly * 1.2]
            
            # Calculate average wait times by hour
            hourly_wait_avg = {}
            for hour, wait_times in hour_wait_times.items():
                if wait_times:
                    hourly_wait_avg[hour] = statistics.mean(wait_times)
            
            return {
                'peak_hours': sorted(peak_hours),
                'busiest_hour': max(hour_counts.items(), key=lambda x: x[1]),
                'hourly_volume': hour_counts,
                'hourly_avg_wait': hourly_wait_avg,
                'recommended_staffing_hours': peak_hours
            }
        
        return {}
    
    def _analyze_daily_patterns(self, tickets: List) -> Dict:
        """Analyze day-of-week patterns"""
        day_counts = {}
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        for ticket in tickets:
            day = ticket.created_at.weekday()  # 0 = Monday
            day_counts[day] = day_counts.get(day, 0) + 1
        
        if day_counts:
            # Convert to day names
            daily_volume = {day_names[day]: count for day, count in day_counts.items()}
            
            # Find busiest and quietest days
            busiest_day = max(day_counts.items(), key=lambda x: x[1])
            quietest_day = min(day_counts.items(), key=lambda x: x[1])
            
            return {
                'daily_volume': daily_volume,
                'busiest_day': day_names[busiest_day[0]],
                'busiest_day_count': busiest_day[1],
                'quietest_day': day_names[quietest_day[0]],
                'quietest_day_count': quietest_day[1],
                'weekend_vs_weekday_ratio': self._calculate_weekend_ratio(day_counts)
            }
        
        return {}
    
    def _analyze_efficiency_trends(self, tickets: List, db: Session) -> Dict:
        """Analyze efficiency trends over time"""
        from models import TicketStatus
        
        # Group tickets by week
        weekly_data = {}
        completed_tickets = [t for t in tickets if t.status == TicketStatus.COMPLETED]
        
        for ticket in completed_tickets:
            # Get week number
            week_start = ticket.created_at - timedelta(days=ticket.created_at.weekday())
            week_key = week_start.strftime('%Y-%W')
            
            if week_key not in weekly_data:
                weekly_data[week_key] = {
                    'total_tickets': 0,
                    'completed_tickets': 0,
                    'total_wait_time': 0,
                    'service_times': []
                }
            
            weekly_data[week_key]['completed_tickets'] += 1
            
            if ticket.estimated_wait_time:
                weekly_data[week_key]['total_wait_time'] += ticket.estimated_wait_time
            
            # Calculate service time if available
            if ticket.consultation_start and ticket.consultation_end:
                service_time = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
                if 1 <= service_time <= 120:  # Reasonable range
                    weekly_data[week_key]['service_times'].append(service_time)
        
        # Count all tickets by week
        for ticket in tickets:
            week_start = ticket.created_at - timedelta(days=ticket.created_at.weekday())
            week_key = week_start.strftime('%Y-%W')
            if week_key in weekly_data:
                weekly_data[week_key]['total_tickets'] += 1
        
        # Calculate trends
        trends = {}
        if len(weekly_data) >= 2:
            weeks = sorted(weekly_data.keys())
            
            # Calculate completion rates
            completion_rates = []
            avg_wait_times = []
            avg_service_times = []
            
            for week in weeks:
                data = weekly_data[week]
                if data['total_tickets'] > 0:
                    completion_rate = data['completed_tickets'] / data['total_tickets']
                    completion_rates.append(completion_rate)
                    
                    if data['completed_tickets'] > 0:
                        avg_wait = data['total_wait_time'] / data['completed_tickets']
                        avg_wait_times.append(avg_wait)
                    
                    if data['service_times']:
                        avg_service = statistics.mean(data['service_times'])
                        avg_service_times.append(avg_service)
            
            trends = {
                'completion_rate_trend': self._calculate_trend(completion_rates),
                'wait_time_trend': self._calculate_trend(avg_wait_times),
                'service_time_trend': self._calculate_trend(avg_service_times),
                'weekly_data': weekly_data
            }
        
        return trends
    
    def _detect_bottlenecks(self, service_id: int, tickets: List, db: Session) -> Dict:
        """Detect potential bottlenecks and issues"""
        from models import Ticket, TicketStatus
        
        bottlenecks = []
        
        # Check for consistently long wait times
        recent_tickets = [t for t in tickets 
                         if t.created_at >= datetime.now() - timedelta(days=7)
                         and t.estimated_wait_time is not None]
        
        if recent_tickets:
            avg_wait = statistics.mean([t.estimated_wait_time for t in recent_tickets])
            if avg_wait > 60:  # More than 1 hour average
                bottlenecks.append({
                    'type': 'long_wait_times',
                    'severity': 'high' if avg_wait > 120 else 'medium',
                    'description': f'Average wait time is {avg_wait:.1f} minutes',
                    'recommendation': 'Consider adding staff during peak hours'
                })
        
        # Check for high queue abandonment (if tracked)
        cancelled_tickets = [t for t in tickets if t.status == TicketStatus.CANCELLED]
        if len(tickets) > 0:
            cancellation_rate = len(cancelled_tickets) / len(tickets)
            if cancellation_rate > 0.15:  # More than 15% cancellation
                bottlenecks.append({
                    'type': 'high_cancellation',
                    'severity': 'medium',
                    'description': f'Cancellation rate is {cancellation_rate:.1%}',
                    'recommendation': 'Investigate causes of patient departures'
                })
        
        # Check for inconsistent service times
        completed_with_times = [t for t in tickets 
                              if t.status == TicketStatus.COMPLETED 
                              and t.consultation_start and t.consultation_end]
        
        if len(completed_with_times) >= 10:
            service_times = []
            for ticket in completed_with_times:
                duration = (ticket.consultation_end - ticket.consultation_start).total_seconds() / 60
                if 1 <= duration <= 120:
                    service_times.append(duration)
            
            if len(service_times) >= 10:
                std_dev = statistics.stdev(service_times)
                mean_time = statistics.mean(service_times)
                coefficient_variation = std_dev / mean_time
                
                if coefficient_variation > 0.5:  # High variation
                    bottlenecks.append({
                        'type': 'inconsistent_service_times',
                        'severity': 'low',
                        'description': f'High variation in service times (CV: {coefficient_variation:.2f})',
                        'recommendation': 'Standardize consultation procedures'
                    })
        
        return {
            'bottlenecks_detected': len(bottlenecks),
            'bottlenecks': bottlenecks,
            'overall_health': 'good' if len(bottlenecks) == 0 else 'needs_attention'
        }
    
    def _generate_recommendations(self, service_id: int, tickets: List, db: Session) -> List[Dict]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Analyze recent patterns for recommendations
        recent_tickets = [t for t in tickets 
                         if t.created_at >= datetime.now() - timedelta(days=14)]
        
        if not recent_tickets:
            return recommendations
        
        # Peak hour recommendation
        peak_analysis = self._analyze_peak_hours(recent_tickets)
        if peak_analysis and 'peak_hours' in peak_analysis:
            peak_hours = peak_analysis['peak_hours']
            if peak_hours:
                recommendations.append({
                    'type': 'staffing',
                    'priority': 'high',
                    'title': 'Optimize Staff Scheduling',
                    'description': f'Consider additional staff during peak hours: {", ".join(map(str, peak_hours))}',
                    'expected_impact': 'Reduce wait times by 20-30%'
                })
        
        # Wait time recommendation
        avg_wait = statistics.mean([t.estimated_wait_time for t in recent_tickets 
                                  if t.estimated_wait_time is not None])
        if avg_wait > 45:
            recommendations.append({
                'type': 'efficiency',
                'priority': 'medium',
                'title': 'Improve Process Efficiency',
                'description': f'Current average wait time is {avg_wait:.1f} minutes',
                'expected_impact': 'Faster patient processing'
            })
        
        # Queue management recommendation
        current_waiting = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).count()
        
        if current_waiting > 10:
            recommendations.append({
                'type': 'immediate',
                'priority': 'high',
                'title': 'Address Current Queue Backlog',
                'description': f'{current_waiting} patients currently waiting',
                'expected_impact': 'Immediate relief for waiting patients'
            })
        
        return recommendations
    
    def _calculate_weekend_ratio(self, day_counts: Dict) -> float:
        """Calculate weekend vs weekday volume ratio"""
        weekday_total = sum(day_counts.get(i, 0) for i in range(5))  # Mon-Fri
        weekend_total = sum(day_counts.get(i, 0) for i in [5, 6])    # Sat-Sun
        
        if weekday_total == 0:
            return 0
        
        return weekend_total / weekday_total
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate if trend is increasing, decreasing, or stable"""
        if len(values) < 2:
            return 'insufficient_data'
        
        # Simple linear trend calculation
        n = len(values)
        x_values = list(range(n))
        
        # Calculate slope
        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(values)
        
        numerator = sum((x_values[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x_values[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return 'stable'
        
        slope = numerator / denominator
        
        # Determine trend
        if slope > 0.05:
            return 'increasing'
        elif slope < -0.05:
            return 'decreasing'
        else:
            return 'stable'
    
    def get_real_time_insights(self, service_id: int, db: Session) -> Dict:
        """Get real-time operational insights"""
        from models import Ticket, TicketStatus, Service
        
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return {'error': 'Service not found'}
        
        # Current queue status
        current_waiting = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.status == TicketStatus.WAITING
            )
        ).count()
        
        # Recent activity (last 2 hours)
        two_hours_ago = datetime.now() - timedelta(hours=2)
        recent_activity = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= two_hours_ago
            )
        ).count()
        
        # Completion rate today
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_tickets = db.query(Ticket).filter(
            and_(
                Ticket.service_id == service_id,
                Ticket.created_at >= today_start
            )
        ).all()
        
        today_completed = len([t for t in today_tickets if t.status == TicketStatus.COMPLETED])
        today_total = len(today_tickets)
        
        completion_rate = (today_completed / today_total * 100) if today_total > 0 else 0
        
        # Generate status and alerts
        status = 'normal'
        alerts = []
        
        if current_waiting > 15:
            status = 'busy'
            alerts.append('High queue volume - consider additional resources')
        
        if completion_rate < 70 and today_total > 5:
            alerts.append('Low completion rate - investigate delays')
        
        if recent_activity > 20:
            alerts.append('High recent activity - monitor queue closely')
        
        return {
            'service_name': service.name,
            'current_status': status,
            'current_waiting': current_waiting,
            'recent_activity_2h': recent_activity,
            'today_completion_rate': round(completion_rate, 1),
            'today_total_tickets': today_total,
            'today_completed': today_completed,
            'alerts': alerts,
            'timestamp': datetime.now().isoformat()
        }