#!/bin/bash

echo "🏥 Smart Hospital Queue System - Test Script"
echo "============================================"

# Check if backend is running
echo "📋 Checking if backend is running..."
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running. Starting backend..."
    echo "💡 Run this in another terminal: python start_backend.py"
    echo "   Then run this script again."
    exit 1
fi

# Install test dependencies if needed
echo "📋 Installing test dependencies..."
pip install aiohttp > /dev/null 2>&1

# Run the queue test
echo "📋 Running queue logic test..."
python test_queue_fix.py

echo ""
echo "🔧 To manually test the system:"
echo "1. Open http://localhost:8000 in browser 1 (User A)"
echo "2. Open http://localhost:8000 in browser 2 (User B)"  
echo "3. Open http://localhost:8000 in browser 3 (Admin)"
echo "4. Have User A and User B join the same queue"
echo "5. Use Admin to call next patient"
echo "6. Check that User B's position updates to 1"
echo "7. Call next again to complete User B"
echo ""
echo "✨ The fix should ensure real-time position updates work correctly!"