"""
Drop the waitless_chu database
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def drop_database():
    """Drop the waitless_chu database."""
    
    print("🗑️  Dropping waitless_chu database...")
    
    try:
        # Connect to PostgreSQL server (default postgres database)
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="postgres",
            password="serpent123",
            database="postgres"
        )
        
        # Set isolation level to autocommit to allow database operations
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'waitless_chu'")
        exists = cursor.fetchone()
        
        if exists:
            # Terminate all connections to the database
            print("🔌 Terminating existing connections...")
            cursor.execute("""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = 'waitless_chu' AND pid <> pg_backend_pid()
            """)
            
            # Drop the database
            print("🗑️  Dropping database 'waitless_chu'...")
            cursor.execute("DROP DATABASE waitless_chu")
            print("✅ Database 'waitless_chu' dropped successfully!")
        else:
            print("ℹ️  Database 'waitless_chu' does not exist")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Database deletion completed!")
        print("You can now run: python create_db.py")
        
    except psycopg2.Error as e:
        print(f"❌ Error dropping database: {e}")
        raise

if __name__ == "__main__":
    drop_database() 