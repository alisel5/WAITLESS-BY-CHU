# Smart Hospital Queue System - Prioritized To-Do List

## 🚨 Critical Issues (Blocking Core Functionality)

### 1. ❌ Real-time Queue Updates Not Working
**Problem**: When admin calls next patient, other patients don't see their position update in real-time
- Frontend ticket page lacks WebSocket integration
- Queue position changes aren't broadcast to all waiting patients
- Patients stuck seeing old position until manual refresh

### 2. ❌ "Call Next" Behavior Issues  
**Problem**: Multiple issues with the Call Next functionality
- When only 1 person in queue: Call Next doesn't advance (patient stays at position 1)
- When multiple people: One gets thank you page, others remain stuck at same position
- Patient count not updating correctly on admin dashboard

### 3. ❌ Missing Status Transition Handling
**Problem**: Frontend doesn't properly handle status transitions
- No automatic redirect when patient status changes to COMPLETED
- Position 1 patients should see "Your Turn" but might still see position number
- Completed patients should see thank you page automatically

## 🔧 High Priority Fixes

### 4. ⚡ Add WebSocket Integration to Ticket Page
- Connect to WebSocket on ticket page load
- Listen for queue updates and status changes
- Update UI in real-time when positions change

### 5. ⚡ Fix Queue Position Broadcasting
- Ensure _update_queue_positions_after_change broadcasts to all affected tickets
- Send individual ticket updates to each patient when their position changes

### 6. ⚡ Handle Edge Cases in Call Next
- Fix single patient queue scenario
- Ensure all patients get proper notifications
- Update admin dashboard patient count correctly

## 🎨 Medium Priority Improvements

### 7. 📊 Improve Admin Dashboard Updates
- Real-time patient count updates
- Show current patient being served
- Better queue visualization

### 8. 🔔 Enhanced Notifications
- Audio/visual alerts when it's patient's turn
- Browser notifications support
- Clear status messages

## 📝 Low Priority Enhancements

### 9. 🎯 Code Simplification
- Remove redundant endpoints
- Consolidate duplicate logic
- Clean up unused code

### 10. 📱 Mobile Responsiveness
- Ensure queue tracking works well on mobile
- Touch-friendly buttons
- Responsive layouts

## Current Architecture Issues Found:

1. **Backend (queue.py)**:
   - ✅ Has atomic _call_next_patient_atomic with proper locking
   - ✅ Updates positions correctly
   - ⚠️ WebSocket notifications might not reach all clients

2. **Frontend (ticket.js)**:
   - ❌ No WebSocket connection for real-time updates
   - ❌ Relies on polling/manual refresh only
   - ❌ Doesn't handle status transitions automatically

3. **WebSocket Manager**:
   - ✅ Has proper broadcast methods
   - ⚠️ Not all frontend pages utilize it
   - ⚠️ Missing connection persistence/retry logic

## Next Steps:
1. Start with fixing WebSocket integration in ticket.js
2. Ensure queue updates broadcast to all waiting patients
3. Fix edge cases in Call Next functionality
4. Test with multiple concurrent users