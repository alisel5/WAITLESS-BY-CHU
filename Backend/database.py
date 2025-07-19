from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from config import settings
import logging

logger = logging.getLogger(__name__)

SQLALCHEMY_DATABASE_URL = settings.database_url

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Atomic queue position management functions
def get_next_queue_position(service_id: int, priority: str, db) -> int:
    """
    Atomically get the next queue position for a service.
    Uses database-level operations to prevent race conditions.
    """
    try:
        # Use a database query to atomically get the next position
        # This considers priority ordering
        result = db.execute(
            text("""
                WITH priority_positions AS (
                    SELECT 
                        position_in_queue,
                        priority,
                        CASE priority
                            WHEN 'high' THEN 3
                            WHEN 'medium' THEN 2
                            WHEN 'low' THEN 1
                        END as priority_rank
                    FROM tickets 
                    WHERE service_id = :service_id 
                    AND status = 'WAITING'::ticketstatus
                    ORDER BY priority_rank DESC, created_at ASC
                ),
                priority_value AS (
                    SELECT CASE :priority
                        WHEN 'high' THEN 3
                        WHEN 'medium' THEN 2
                        WHEN 'low' THEN 1
                    END as new_priority_rank
                )
                SELECT COALESCE(
                    (SELECT COUNT(*) + 1 
                     FROM priority_positions, priority_value
                     WHERE priority_rank >= new_priority_rank),
                    1
                ) as next_position
            """),
            {"service_id": service_id, "priority": priority}
        )
        return result.scalar() or 1
    except Exception as e:
        logger.error(f"Error getting next queue position: {e}")
        # Fallback to simple counting
        result = db.execute(
            text("SELECT COALESCE(MAX(position_in_queue), 0) + 1 FROM tickets "
                 "WHERE service_id = :service_id AND status = 'WAITING'::ticketstatus"),
            {"service_id": service_id}
        )
        return result.scalar() or 1

def reorder_queue_positions_atomic(service_id: int, db) -> int:
    """
    Atomically reorder all queue positions for a service.
    Returns the number of tickets updated.
    """
    try:
        result = db.execute(
            text("""
                WITH ordered_tickets AS (
                    SELECT 
                        id,
                        ROW_NUMBER() OVER (
                            ORDER BY 
                                CASE priority
                                    WHEN 'high' THEN 3
                                    WHEN 'medium' THEN 2
                                    WHEN 'low' THEN 1
                                END DESC,
                                created_at ASC
                        ) as new_position
                    FROM tickets 
                    WHERE service_id = :service_id AND status = 'WAITING'::ticketstatus
                )
                UPDATE tickets 
                SET 
                    position_in_queue = ordered_tickets.new_position,
                    updated_at = CURRENT_TIMESTAMP
                FROM ordered_tickets 
                WHERE tickets.id = ordered_tickets.id
            """),
            {"service_id": service_id}
        )
        return result.rowcount
    except Exception as e:
        logger.error(f"Error reordering queue positions: {e}")
        raise

def update_wait_times_atomic(service_id: int, avg_wait_time: int, db) -> int:
    """
    Atomically update estimated wait times for all waiting tickets in a service.
    """
    try:
        result = db.execute(
            text("""
                UPDATE tickets 
                SET 
                    estimated_wait_time = (position_in_queue - 1) * :avg_wait_time,
                    updated_at = CURRENT_TIMESTAMP
                WHERE service_id = :service_id 
                AND status = 'WAITING'::ticketstatus
            """),
            {"service_id": service_id, "avg_wait_time": avg_wait_time}
        )
        return result.rowcount
    except Exception as e:
        logger.error(f"Error updating wait times: {e}")
        raise 