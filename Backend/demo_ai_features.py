"""
AI Wait Time Estimation - Demonstration Script
==============================================

This script demonstrates the impressive AI capabilities of the Smart Hospital Queue System.
It showcases intelligent wait time estimation, pattern recognition, and predictive analytics.
"""

import sys
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import json

# Add the Backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Service, Ticket, TicketStatus, ServicePriority
from ai_wait_time_estimator import (
    get_ai_wait_time_estimate,
    get_service_ai_insights,
    refresh_all_estimates,
    ai_estimator
)

def demo_ai_estimation():
    """Demonstrate AI wait time estimation capabilities."""
    print("\n🤖 AI Wait Time Estimation Demo")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # Get all services
        services = db.query(Service).all()
        
        for service in services:
            print(f"\n📍 Service: {service.name}")
            print(f"   Location: {service.location}")
            
            # Get current queue
            waiting_tickets = db.query(Ticket).filter(
                Ticket.service_id == service.id,
                Ticket.status == TicketStatus.WAITING
            ).all()
            
            print(f"   Current queue: {len(waiting_tickets)} patients")
            
            if len(waiting_tickets) == 0:
                # Create a simulated scenario
                priorities = [ServicePriority.HIGH, ServicePriority.MEDIUM, ServicePriority.LOW]
                positions = [1, 3, 5]
                
                print("   🎭 Simulating different scenarios:")
                
                for priority, position in zip(priorities, positions):
                    try:
                        result = get_ai_wait_time_estimate(service.id, priority, position, db)
                        
                        confidence_emoji = "🎯" if result.confidence_level > 0.7 else "📊" if result.confidence_level > 0.5 else "🔮"
                        
                        print(f"      {confidence_emoji} Priority {priority.value.upper()}, Position {position}:")
                        print(f"         Estimated wait: {result.estimated_minutes} min")
                        print(f"         Confidence: {result.confidence_level:.1%}")
                        print(f"         Range: {result.estimated_range[0]}-{result.estimated_range[1]} min")
                        print(f"         Factors: {result.factors_explanation}")
                        
                    except Exception as e:
                        print(f"         ⚠️  AI estimation failed: {e}")
            else:
                # Analyze real queue
                print("   🔍 Real queue analysis:")
                for ticket in waiting_tickets[:3]:  # Show first 3
                    try:
                        result = get_ai_wait_time_estimate(
                            service.id, ticket.priority, ticket.position_in_queue, db
                        )
                        
                        print(f"      🎫 {ticket.ticket_number}:")
                        print(f"         AI Estimate: {result.estimated_minutes} min")
                        print(f"         Current Estimate: {ticket.estimated_wait_time} min")
                        print(f"         Confidence: {result.confidence_level:.1%}")
                        
                    except Exception as e:
                        print(f"         ⚠️  AI estimation failed: {e}")
    
    finally:
        db.close()

def demo_ai_insights():
    """Demonstrate AI insights and pattern recognition."""
    print("\n🧠 AI Pattern Recognition & Insights")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        services = db.query(Service).all()
        
        for service in services:
            print(f"\n🏥 {service.name} - AI Analysis")
            
            try:
                insights = get_service_ai_insights(service.id, db)
                
                if insights["status"] == "ready":
                    data_quality = insights["data_quality"]
                    ai_insights = insights["insights"]
                    
                    print(f"   📊 Data Quality:")
                    print(f"      Historical tickets: {data_quality['historical_tickets']}")
                    print(f"      Confidence level: {data_quality['confidence_level']:.1%}")
                    print(f"      Last updated: {data_quality['last_updated'][:19]}")
                    
                    print(f"   🔬 AI Insights:")
                    print(f"      Avg consultation time: {ai_insights['avg_consultation_time']:.1f} min")
                    print(f"      Consistency score: {ai_insights['consistency_score']:.2f}")
                    
                    if ai_insights['best_hours']:
                        best_hours = ai_insights['best_hours']
                        print(f"      🌟 Most efficient hours:")
                        for hour_data in best_hours:
                            print(f"         {hour_data['hour']:02d}:00 (efficiency: {hour_data['efficiency']:.2f}x)")
                    
                    if ai_insights['worst_hours']:
                        worst_hours = ai_insights['worst_hours']
                        print(f"      ⚠️  Least efficient hours:")
                        for hour_data in worst_hours:
                            print(f"         {hour_data['hour']:02d}:00 (efficiency: {hour_data['efficiency']:.2f}x)")
                    
                    if ai_insights['priority_impact']:
                        print(f"      ⏱️  Priority impact on consultation time:")
                        for priority, avg_time in ai_insights['priority_impact'].items():
                            print(f"         {priority.upper()}: {avg_time:.1f} min average")
                
                elif insights["status"] == "insufficient_data":
                    print(f"   📉 {insights['message']}")
                    print(f"      Need {insights['min_tickets_needed']} minimum tickets for AI analysis")
                
            except Exception as e:
                print(f"   ❌ Error getting insights: {e}")
    
    finally:
        db.close()

def demo_bulk_update():
    """Demonstrate bulk AI estimate updates."""
    print("\n⚡ Bulk AI Estimate Update Demo")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        services = db.query(Service).all()
        
        for service in services:
            print(f"\n🔄 Updating estimates for {service.name}...")
            
            try:
                result = refresh_all_estimates(service.id, db)
                
                print(f"   ✅ Updated {result['updated_count']} out of {result['total_tickets']} tickets")
                
                if result['estimates']:
                    print(f"   📋 Sample updates:")
                    for estimate in result['estimates'][:3]:  # Show first 3
                        print(f"      🎫 {estimate['ticket_number']}: {estimate['new_estimate']} min "
                              f"(confidence: {estimate['confidence']:.1%})")
                
            except Exception as e:
                print(f"   ❌ Error updating estimates: {e}")
    
    finally:
        db.close()

def demo_model_building():
    """Demonstrate AI model building process."""
    print("\n🏗️  AI Model Building Process")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        services = db.query(Service).all()
        
        print("🧮 Building AI models for each service...")
        
        for service in services:
            print(f"\n📊 Building model for {service.name}...")
            
            try:
                # Force rebuild model to show the process
                model = ai_estimator._build_service_model(service.id, db)
                
                if model["has_enough_data"]:
                    print(f"   ✅ Model built successfully!")
                    print(f"      Historical data: {model['ticket_count']} tickets")
                    print(f"      Avg consultation: {model['avg_consultation_time']:.1f} ± {model['consultation_time_std']:.1f} min")
                    print(f"      Priority patterns: {len(model['priority_patterns'])} categories")
                    print(f"      Time patterns: {len(model['time_patterns']['hourly'])} hourly, {len(model['time_patterns']['weekly'])} weekly")
                    print(f"      Efficiency metrics: Calculated")
                else:
                    print(f"   ⚠️  Insufficient data: {model['ticket_count']} tickets")
                    print(f"      Need minimum {ai_estimator.min_historical_data} tickets for AI")
                
            except Exception as e:
                print(f"   ❌ Error building model: {e}")
    
    finally:
        db.close()

def generate_ai_report():
    """Generate comprehensive AI system report."""
    print("\n📄 Comprehensive AI System Report")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # System overview
        services = db.query(Service).all()
        total_services = len(services)
        ai_ready_services = 0
        total_tickets_analyzed = 0
        
        # Collect data for each service
        service_reports = []
        
        for service in services:
            try:
                insights = get_service_ai_insights(service.id, db)
                
                report = {
                    "name": service.name,
                    "location": service.location,
                    "ai_status": insights["status"],
                    "data_available": insights.get("data_quality", {}).get("historical_tickets", 0),
                    "confidence": insights.get("data_quality", {}).get("confidence_level", 0),
                }
                
                if insights["status"] == "ready":
                    ai_ready_services += 1
                    total_tickets_analyzed += insights["data_quality"]["historical_tickets"]
                    
                    ai_insights = insights["insights"]
                    report.update({
                        "avg_consultation": ai_insights["avg_consultation_time"],
                        "consistency": ai_insights["consistency_score"],
                        "best_efficiency_hour": ai_insights["best_hours"][0]["hour"] if ai_insights["best_hours"] else None,
                        "worst_efficiency_hour": ai_insights["worst_hours"][0]["hour"] if ai_insights["worst_hours"] else None,
                        "priority_variations": ai_insights["priority_impact"]
                    })
                
                service_reports.append(report)
                
            except Exception as e:
                service_reports.append({
                    "name": service.name,
                    "ai_status": "error",
                    "error": str(e)
                })
        
        # Print comprehensive report
        print(f"\n🎯 System Overview:")
        print(f"   Total services: {total_services}")
        print(f"   AI-ready services: {ai_ready_services} ({ai_ready_services/total_services:.1%})")
        print(f"   Total historical tickets analyzed: {total_tickets_analyzed:,}")
        system_confidence = min(0.95, total_tickets_analyzed / 1000.0)
        print(f"   Overall system confidence: {system_confidence:.1%}")
        
        print(f"\n📋 Service-by-Service Analysis:")
        
        for report in service_reports:
            print(f"\n   🏥 {report['name']}")
            print(f"      Location: {report['location']}")
            print(f"      AI Status: {report['ai_status'].upper()}")
            
            if report['ai_status'] == 'ready':
                print(f"      Data: {report['data_available']} tickets (confidence: {report['confidence']:.1%})")
                print(f"      Avg consultation: {report['avg_consultation']:.1f} min")
                print(f"      Consistency score: {report['consistency']:.2f}")
                
                if report['best_efficiency_hour']:
                    print(f"      Peak efficiency: {report['best_efficiency_hour']:02d}:00")
                if report['worst_efficiency_hour']:
                    print(f"      Low efficiency: {report['worst_efficiency_hour']:02d}:00")
                
                if report['priority_variations']:
                    print(f"      Priority impact:")
                    for priority, time in report['priority_variations'].items():
                        print(f"         {priority.upper()}: {time:.1f} min")
            
            elif report['ai_status'] == 'insufficient_data':
                print(f"      Data: {report['data_available']} tickets (need minimum 10)")
            
            elif report['ai_status'] == 'error':
                print(f"      Error: {report['error']}")
        
        print(f"\n🚀 AI Capabilities Demonstrated:")
        print(f"   ✅ Historical pattern analysis")
        print(f"   ✅ Time-of-day optimization")
        print(f"   ✅ Priority-based queue intelligence")
        print(f"   ✅ Service-specific modeling")
        print(f"   ✅ Real-time adaptation")
        print(f"   ✅ Confidence scoring")
        print(f"   ✅ Predictive analytics")
        
        # Save report to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "system_overview": {
                "total_services": total_services,
                "ai_ready_services": ai_ready_services,
                "total_tickets_analyzed": total_tickets_analyzed,
                "system_confidence": system_confidence
            },
            "services": service_reports,
            "ai_features": [
                "Historical pattern analysis",
                "Time-of-day optimization", 
                "Priority-based queue intelligence",
                "Service-specific modeling",
                "Real-time adaptation",
                "Confidence scoring",
                "Predictive analytics"
            ]
        }
        
        report_filename = f"ai_system_report_{timestamp}.json"
        with open(report_filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"\n💾 Detailed report saved to: {report_filename}")
        
    finally:
        db.close()

def main():
    """Main demonstration function."""
    print("🎉 Smart Hospital Queue - AI Wait Time Estimation Demo")
    print("🤖 Showcasing Impressive AI Capabilities")
    print("=" * 60)
    print(f"⏰ Demo started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # Run all demonstrations
        demo_ai_estimation()
        demo_ai_insights()
        demo_bulk_update()
        demo_model_building()
        generate_ai_report()
        
        print(f"\n🎊 Demo completed successfully!")
        print(f"🔬 The AI system demonstrates sophisticated wait time estimation")
        print(f"📈 Using statistical models, pattern recognition, and real-time adaptation")
        print(f"🏆 Ready to impress your PFE jury!")
        
    except Exception as e:
        print(f"\n❌ Demo error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()