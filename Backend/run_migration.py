#!/usr/bin/env python3
"""
Script to run the queue constraints migration
Run this from the Backend directory
"""

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from migrations.add_queue_constraints import apply_queue_constraints
    print("Starting queue constraints migration...")
    apply_queue_constraints()
    print("✅ Migration completed successfully!")
except Exception as e:
    print(f"❌ Migration failed: {e}")
    sys.exit(1) 