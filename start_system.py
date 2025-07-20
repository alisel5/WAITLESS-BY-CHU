#!/usr/bin/env python3
"""
WaitLess CHU Hospital Queue System - Startup Script
Starts both backend and frontend servers for local development
"""

import subprocess
import sys
import os
import time
import signal
from pathlib import Path

def check_requirements():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import psycopg2
        print("✅ Backend dependencies found")
    except ImportError as e:
        print(f"❌ Missing backend dependency: {e}")
        print("Please run: pip install -r Backend/requirements.txt")
        return False
    return True

def start_backend():
    """Start the FastAPI backend server"""
    print("🚀 Starting Backend Server...")
    backend_path = Path("Backend")
    
    if not backend_path.exists():
        print("❌ Backend directory not found")
        return None
    
    try:
        # Change to backend directory and start server
        backend_process = subprocess.Popen(
            [sys.executable, "main.py"],
            cwd=backend_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Give the server time to start
        time.sleep(3)
        
        if backend_process.poll() is None:
            print("✅ Backend server started on http://localhost:8000")
            print("📚 API Documentation: http://localhost:8000/docs")
            return backend_process
        else:
            stdout, stderr = backend_process.communicate()
            print(f"❌ Backend failed to start:")
            print(f"Error: {stderr.decode()}")
            return None
            
    except Exception as e:
        print(f"❌ Error starting backend: {e}")
        return None

def start_frontend():
    """Start the frontend HTTP server"""
    print("🌐 Starting Frontend Server...")
    frontend_path = Path("Frontend")
    
    if not frontend_path.exists():
        print("❌ Frontend directory not found")
        return None
    
    try:
        # Start frontend server
        frontend_process = subprocess.Popen(
            [sys.executable, "start_https_server.py"],
            cwd=frontend_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Give the server time to start
        time.sleep(2)
        
        if frontend_process.poll() is None:
            print("✅ Frontend server started on http://localhost:8080")
            print("🏥 Staff Management: http://localhost:8080/staff/staff.html")
            print("👩‍⚕️ Secretary Interface: http://localhost:8080/secretary/secretary.html")
            return frontend_process
        else:
            stdout, stderr = frontend_process.communicate()
            print(f"❌ Frontend failed to start:")
            print(f"Error: {stderr.decode()}")
            return None
            
    except Exception as e:
        print(f"❌ Error starting frontend: {e}")
        return None

def main():
    """Main startup function"""
    print("=" * 60)
    print("🏥 WaitLess CHU Hospital Queue System")
    print("=" * 60)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    processes = []
    
    try:
        # Start backend
        backend_process = start_backend()
        if backend_process:
            processes.append(backend_process)
        else:
            print("❌ Failed to start backend server")
            sys.exit(1)
        
        # Start frontend
        frontend_process = start_frontend()
        if frontend_process:
            processes.append(frontend_process)
        else:
            print("❌ Failed to start frontend server")
            # Kill backend if frontend fails
            if backend_process:
                backend_process.terminate()
            sys.exit(1)
        
        print("\n" + "=" * 60)
        print("🎉 System Started Successfully!")
        print("=" * 60)
        print("\n📋 Quick Access URLs:")
        print("   • Backend API: http://localhost:8000")
        print("   • API Docs: http://localhost:8000/docs")
        print("   • Staff Management: http://localhost:8080/staff/staff.html")
        print("   • Secretary Interface: http://localhost:8080/secretary/secretary.html")
        print("   • WebSocket: ws://localhost:8000/ws")
        
        print("\n🔧 Default Login Credentials:")
        print("   • Admin: admin@waitless.app / admin123")
        print("   • Staff: staff@waitless.app / staff123")
        
        print("\n📝 System Features:")
        print("   ✅ Real-time queue management")
        print("   ✅ Staff and service management")
        print("   ✅ QR code generation and scanning")
        print("   ✅ WebSocket live updates")
        print("   ✅ Role-based access control")
        
        print("\n⚡ Press Ctrl+C to stop all servers")
        print("=" * 60)
        
        # Wait for interrupt
        try:
            while True:
                time.sleep(1)
                # Check if processes are still running
                for process in processes:
                    if process.poll() is not None:
                        print(f"\n⚠️  Process {process.pid} has stopped unexpectedly")
                        raise KeyboardInterrupt
        except KeyboardInterrupt:
            pass
    
    except KeyboardInterrupt:
        pass
    finally:
        # Cleanup
        print("\n🛑 Shutting down servers...")
        for process in processes:
            try:
                process.terminate()
                process.wait(timeout=5)
                print(f"✅ Process {process.pid} terminated")
            except subprocess.TimeoutExpired:
                print(f"⚠️  Force killing process {process.pid}")
                process.kill()
            except Exception as e:
                print(f"⚠️  Error stopping process {process.pid}: {e}")
        
        print("👋 System shutdown complete")

if __name__ == "__main__":
    main()