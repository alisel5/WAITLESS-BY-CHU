"""
Database migration to add queue position constraints
This prevents race conditions in queue position assignment
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine
import logging

logger = logging.getLogger(__name__)

def apply_queue_constraints():
    """Apply database constraints to prevent queue race conditions"""
    
    with engine.connect() as connection:
        # Start a transaction
        trans = connection.begin()
        
        try:
            # Add unique constraint on queue positions within each service (for waiting tickets only)
            # This prevents duplicate positions from race conditions
            logger.info("Adding unique constraint on queue positions...")
            connection.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS 
                idx_unique_queue_position 
                ON tickets (service_id, position_in_queue) 
                WHERE status = 'WAITING'::ticketstatus
            """))
            
            # Add composite index for efficient queue queries
            logger.info("Adding composite index for queue queries...")
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS 
                idx_tickets_queue_lookup 
                ON tickets (service_id, status, priority DESC, created_at ASC)
            """))
            
            # Add index for patient active ticket lookups
            logger.info("Adding index for patient active tickets...")
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS 
                idx_tickets_patient_active 
                ON tickets (patient_id, status) 
                WHERE status IN ('WAITING'::ticketstatus, 'CONSULTING'::ticketstatus)
            """))
            
            # Add a check constraint to ensure position_in_queue is positive
            logger.info("Adding check constraint for positive queue positions...")
            try:
                connection.execute(text("""
                    ALTER TABLE tickets 
                    ADD CONSTRAINT chk_positive_queue_position 
                    CHECK (position_in_queue > 0)
                """))
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info("Check constraint already exists, skipping...")
                else:
                    raise
            
            # Create a function to automatically validate queue integrity
            logger.info("Creating queue integrity validation function...")
            connection.execute(text("""
                CREATE OR REPLACE FUNCTION validate_queue_integrity(p_service_id INTEGER)
                RETURNS TABLE(
                    missing_positions INTEGER[],
                    duplicate_positions INTEGER[],
                    max_position INTEGER
                ) AS $$
                DECLARE
                    expected_positions INTEGER[];
                    actual_positions INTEGER[];
                    max_pos INTEGER;
                BEGIN
                    -- Get all positions for waiting tickets in the service
                    SELECT ARRAY_AGG(position_in_queue ORDER BY position_in_queue), 
                           MAX(position_in_queue)
                    INTO actual_positions, max_pos
                    FROM tickets 
                    WHERE service_id = p_service_id AND status = 'WAITING'::ticketstatus;
                    
                    -- Generate expected sequence (1 to max_position)
                    IF max_pos IS NOT NULL THEN
                        SELECT ARRAY_AGG(generate_series) 
                        INTO expected_positions
                        FROM generate_series(1, max_pos);
                        
                        -- Find missing positions
                        missing_positions := ARRAY(
                            SELECT unnest(expected_positions) 
                            EXCEPT 
                            SELECT unnest(actual_positions)
                        );
                        
                        -- Find duplicate positions
                        duplicate_positions := ARRAY(
                            SELECT position_in_queue 
                            FROM tickets 
                            WHERE service_id = p_service_id AND status = 'WAITING'::ticketstatus
                            GROUP BY position_in_queue 
                            HAVING COUNT(*) > 1
                        );
                    END IF;
                    
                    max_position := max_pos;
                    RETURN NEXT;
                END;
                $$ LANGUAGE plpgsql;
            """))
            
            trans.commit()
            logger.info("Queue constraints applied successfully")
            
        except Exception as e:
            trans.rollback()
            logger.error(f"Error applying queue constraints: {e}")
            raise

def remove_queue_constraints():
    """Remove queue constraints (for rollback purposes)"""
    
    with engine.connect() as connection:
        trans = connection.begin()
        
        try:
            # Remove constraints in reverse order
            logger.info("Removing queue constraints...")
            
            connection.execute(text("DROP FUNCTION IF EXISTS validate_queue_integrity(INTEGER)"))
            connection.execute(text("ALTER TABLE tickets DROP CONSTRAINT IF EXISTS chk_positive_queue_position"))
            connection.execute(text("DROP INDEX IF EXISTS idx_tickets_patient_active"))
            connection.execute(text("DROP INDEX IF EXISTS idx_tickets_queue_lookup"))
            connection.execute(text("DROP INDEX IF EXISTS idx_unique_queue_position"))
            
            trans.commit()
            logger.info("Queue constraints removed successfully")
            
        except Exception as e:
            trans.rollback()
            logger.error(f"Error removing queue constraints: {e}")
            raise

if __name__ == "__main__":
    # Run migration
    print("Applying queue management constraints...")
    apply_queue_constraints()
    print("Migration completed successfully!")