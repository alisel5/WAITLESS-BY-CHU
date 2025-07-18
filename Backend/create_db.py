"""
Create the PostgreSQL database for WaitLess CHU
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_database():
    """Create the waitless_chu database."""
    
    print("Connecting to PostgreSQL server...")
    
    try:
        # Connect to PostgreSQL server (default postgres database)
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="postgres",
            password="serpent123",
            database="postgres"
        )
        
        # Set isolation level to autocommit to allow database creation
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'waitless_chu'")
        exists = cursor.fetchone()
        
        if exists:
            print("✓ Database 'waitless_chu' already exists!")
        else:
            # Create the database
            cursor.execute("CREATE DATABASE waitless_chu")
            print("✓ Database 'waitless_chu' created successfully!")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Database setup completed!")
        print("You can now run: python init_db.py")
        
    except psycopg2.Error as e:
        print(f"❌ Error creating database: {e}")
        print("\n🔧 Please check:")
        print("   • PostgreSQL is running")
        print("   • Credentials are correct (user: postgres, password: serpent123)")
        print("   • PostgreSQL is accessible on localhost:5432")
        raise

if __name__ == "__main__":
    create_database() 