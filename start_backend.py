#!/usr/bin/env python3
"""
WaitLess CHU Backend Startup Script
Starts the FastAPI backend server from the correct directory
"""
import os
import sys
import subprocess
from pathlib import Path

def main():
    # Get the current directory
    current_dir = Path(__file__).parent
    backend_dir = current_dir / "Backend"
    
    # Check if Backend directory exists
    if not backend_dir.exists():
        print("❌ Backend directory not found!")
        print(f"   Expected: {backend_dir}")
        return 1
    
    # Change to Backend directory
    os.chdir(backend_dir)
    print(f"🚀 Starting WaitLess CHU Backend...")
    print(f"📁 Working directory: {backend_dir}")
    print(f"🌐 Server will be available at: http://localhost:8000")
    print(f"📚 API docs will be at: http://localhost:8000/docs")
    print("-" * 50)
    
    # Start uvicorn
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start server: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 