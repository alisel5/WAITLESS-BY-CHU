#!/usr/bin/env python3
"""
Test script to verify enum values in the database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import engine

def test_enum_values():
    """Test that enum values are correctly defined in the database"""
    
    with engine.connect() as connection:
        # Test ticket status enum values
        result = connection.execute(text("""
            SELECT unnest(enum_range(NULL::ticketstatus)) as status_value
        """))
        
        status_values = [row[0] for row in result]
        print("Available ticket status values:")
        for status in status_values:
            print(f"  - {status}")
        
        # Test service priority enum values
        result = connection.execute(text("""
            SELECT unnest(enum_range(NULL::servicepriority)) as priority_value
        """))
        
        priority_values = [row[0] for row in result]
        print("\nAvailable service priority values:")
        for priority in priority_values:
            print(f"  - {priority}")
        
        # Test service status enum values
        result = connection.execute(text("""
            SELECT unnest(enum_range(NULL::servicestatus)) as service_status_value
        """))
        
        service_status_values = [row[0] for row in result]
        print("\nAvailable service status values:")
        for status in service_status_values:
            print(f"  - {status}")
        
        # Verify that 'WAITING' is a valid ticket status
        if 'WAITING' in status_values:
            print("\n✅ 'WAITING' is a valid ticket status")
        else:
            print("\n❌ 'WAITING' is NOT a valid ticket status")
            return False
        
        # Test a simple query with enum casting
        try:
            result = connection.execute(text("""
                SELECT COUNT(*) as waiting_count 
                FROM tickets 
                WHERE status = 'WAITING'::ticketstatus
            """))
            count = result.scalar()
            print(f"✅ Query with enum casting works. Waiting tickets: {count}")
            return True
        except Exception as e:
            print(f"❌ Query with enum casting failed: {e}")
            return False

if __name__ == "__main__":
    print("Testing enum values in database...")
    success = test_enum_values()
    if success:
        print("\n🎉 Enum test passed! Migration should work now.")
    else:
        print("\n❌ Enum test failed! Check database setup.") 