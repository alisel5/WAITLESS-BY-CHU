# 📱 QR Code Features - WaitLess CHU

## 🚀 Enhanced QR Code System

The WaitLess CHU system now supports **automatic queue joining via QR code scanning**! This revolutionary feature allows patients to simply scan a QR code at any service location and instantly join the queue.

## ✨ Key Features

### 🔗 Service QR Codes
- **Generate QR codes for each medical service**
- **Display at service locations** (entrances, waiting areas, etc.)
- **Contains service information** and join instructions
- **Works offline** - no internet required for scanning

### 📱 Scan-to-Join Workflow
1. **Patient arrives** at service location
2. **Scans QR code** with their phone camera
3. **Enters basic information** (name, phone, email)
4. **Automatically joins queue** and gets ticket
5. **Receives position and wait time** instantly

### 🔍 Smart QR Detection
- **Automatically detects QR code type** (service vs. ticket)
- **Handles both workflows** seamlessly
- **Provides appropriate responses** based on QR content

## 🔗 API Endpoints

### Service QR Code Generation
```
GET /api/services/{service_id}/qr-code
```
**Response:**
```json
{
  "service_id": 1,
  "service_name": "Cardiologie",
  "qr_code": "data:image/png;base64,iVBORw0KGgo...",
  "scan_instructions": "Scan this QR code to join the queue",
  "location": "Bâtiment A - 2ème étage"
}
```

### Get All Services with QR Codes
```
GET /api/services/active/with-qr
```
**Response:**
```json
{
  "services": [
    {
      "id": 1,
      "name": "Cardiologie",
      "location": "Bâtiment A - 2ème étage",
      "current_waiting": 3,
      "avg_wait_time": 25,
      "qr_code": "data:image/png;base64,..."
    }
  ]
}
```

### Scan-to-Join Queue
```
POST /api/tickets-qr/scan-to-join
```
**Request:**
```json
{
  "qr_data": "{\"type\":\"service_join\",\"service_id\":1,\"action\":\"join_queue\"}"
}
```
**Query Parameters:**
- `patient_name`: "John Doe"
- `patient_phone`: "0612345678"
- `patient_email`: "john@email.com"
- `priority`: "medium" (optional)

**Response:**
```json
{
  "ticket_number": "T-20250717-ABC123",
  "position_in_queue": 1,
  "estimated_wait_time": 25,
  "service_name": "Cardiologie",
  "status": "waiting",
  "qr_code": "data:image/png;base64,..."
}
```

### Enhanced QR Scan Detection
```
POST /api/tickets/scan
```
**Handles both service QR codes and ticket QR codes automatically**

## 📊 Demo Results

✅ **Successfully tested complete workflow:**
- ✓ Generated QR codes for 6 active services
- ✓ Service QR scan detection working
- ✓ Automatic queue joining functional
- ✓ Ticket creation with proper positioning
- ✓ Real-time admin dashboard updates
- ✓ Queue status tracking operational

## 🎯 Usage Scenarios

### 🏥 Hospital Implementation
1. **Print QR codes** for each service
2. **Display prominently** at service locations
3. **Patients scan** when they arrive
4. **No registration required** - instant access
5. **Real-time queue management** for staff

### 📱 Patient Experience
```
Patient arrives → Scans QR → Enters info → Gets ticket → Knows position & wait time
```

### 👨‍⚕️ Admin Benefits
- **Real-time queue monitoring**
- **Automatic patient registration**
- **Reduced wait times**
- **Better resource allocation**
- **Enhanced patient satisfaction**

## 🔧 Technical Implementation

### QR Code Content Structure
**Service QR Code:**
```json
{
  "type": "service_join",
  "service_id": 1,
  "service_name": "Cardiologie",
  "action": "join_queue"
}
```

**Ticket QR Code:**
```
"T-20250717-ABC123"
```

### Smart Detection Logic
1. **Try parsing as JSON** (service QR)
2. **Validate service join format**
3. **Fallback to ticket number** if not JSON
4. **Return appropriate response** based on type

## 🚀 Integration Guide

### Frontend Integration
```javascript
// Scan QR code
const qrData = scanQRCode();

// Send to API
const response = await fetch('/api/tickets/scan', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({qr_data: qrData})
});

const result = await response.json();

if (result.type === 'service_join') {
  // Show join form
  showJoinForm(result);
} else {
  // Show ticket info
  showTicketInfo(result);
}
```

### Mobile App Integration
```javascript
// Auto-join via QR scan
const joinQueue = async (qrData, patientInfo) => {
  const response = await fetch('/api/tickets-qr/scan-to-join', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({qr_data: qrData}),
    params: patientInfo
  });
  
  return await response.json();
};
```

## 📈 Performance Benefits

- **Instant queue joining** - no manual service selection
- **Reduced errors** - automatic service detection
- **Contactless operation** - safer for patients
- **Streamlined workflow** - fewer steps for patients
- **Real-time updates** - immediate queue position

## 🔮 Future Enhancements

- [ ] **Multi-language QR codes** for international patients
- [ ] **Priority scanning** for emergency cases
- [ ] **SMS notifications** when position changes
- [ ] **NFC support** for non-QR capable devices
- [ ] **Batch QR printing** for multiple services

---

**🏥 WaitLess CHU - Making healthcare queues smarter, one scan at a time!** 