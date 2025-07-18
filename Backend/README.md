# WaitLess CHU Backend API

## 🏥 Smart Queue Management System for CHU Hospitals

A comprehensive FastAPI backend system designed to minimize patient waiting time through intelligent queue management.

## ✨ Features Implemented

### 🔐 Authentication System
- JWT-based authentication with role-based access control
- User registration and login endpoints
- Admin, Doctor, and Patient roles
- Secure password hashing with bcrypt

### 🏢 Service Management
- CRUD operations for medical services
- Service status management (Active/Inactive/Emergency)
- Priority levels and wait time configuration
- Location and capacity management

### 🎫 Ticket System
- QR code generation for each ticket
- Online queue joining without registration
- Position tracking and wait time estimation
- Priority-based queue ordering

### 📱 **NEW: Enhanced QR Code Features**
- **Service QR Code Generation** - Generate QR codes for each service location
- **Scan-to-Join Functionality** - Patients scan QR codes to instantly join queues
- **Smart QR Detection** - Automatically handles both service and ticket QR codes
- **Contactless Queue Management** - No app installation required

### 📊 Queue Management
- Real-time queue status monitoring
- Next patient calling functionality
- Position calculation and updates
- Queue statistics and analytics

### 👨‍⚕️ Admin Dashboard
- Real-time dashboard statistics
- Patient management (CRUD operations)
- System alerts and notifications
- Daily reports and activity logs

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- PostgreSQL 12+
- pip (Python package manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd WAITLESS-BY-CHU/Backend
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   pip install email-validator  # Additional dependency
   ```

3. **Setup PostgreSQL Database**
   - Ensure PostgreSQL is running
   - Update credentials in `config.py` if needed (default: user=postgres, password=serpent123)

4. **Create Database**
   ```bash
   python create_db.py
   ```

5. **Initialize Database with Sample Data**
   ```bash
   python init_db.py
   ```

6. **Start the API Server**
   ```bash
   python main.py
   ```
   or
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## 📝 API Documentation

Once the server is running, visit:
- **Interactive API Docs**: http://localhost:8000/docs
- **ReDoc Documentation**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - User logout

### Services
- `GET /api/services/` - List all services
- `POST /api/services/` - Create service (Admin)
- `GET /api/services/{id}` - Get service details
- `PUT /api/services/{id}` - Update service (Admin)
- `DELETE /api/services/{id}` - Delete service (Admin)

### **NEW: QR Code Features**
- `GET /api/services/{id}/qr-code` - **Generate service QR code**
- `GET /api/services/active/with-qr` - **Get all services with QR codes**
- `POST /api/tickets-qr/scan-to-join` - **Scan QR to join queue instantly**
- `POST /api/tickets/scan` - **Enhanced QR scan detection**

### Tickets
- `POST /api/tickets/create` - Create ticket (Authenticated)
- `POST /api/tickets/join-online` - Join queue online
- `GET /api/tickets/my-tickets` - Get user's tickets
- `PATCH /api/tickets/{id}/status` - Update ticket status (Admin)

### Queue Management
- `GET /api/queue/service/{id}` - Get queue status
- `POST /api/queue/call-next/{service_id}` - Call next patient (Admin)
- `POST /api/queue/complete-consultation/{ticket_id}` - Complete consultation (Admin)
- `GET /api/queue/statistics/{service_id}` - Queue statistics

### Admin Dashboard
- `GET /api/admin/dashboard` - Dashboard statistics (Admin)
- `GET /api/admin/patients` - List all patients (Admin)
- `POST /api/admin/patients` - Create patient ticket (Admin)
- `GET /api/admin/alerts` - System alerts (Admin)
- `GET /api/admin/reports/daily` - Daily reports (Admin)

## 👥 Sample Users

The system comes with pre-populated sample data:

### Admin Users
- **Email**: `admin@waitless.chu`
- **Password**: `admin123`
- **Role**: Administrator

- **Email**: `doctor@waitless.chu`
- **Password**: `doctor123`
- **Role**: Doctor

### Sample Patients
- **Email**: `ahmed.benali@email.com`
- **Password**: `patient123`

- **Email**: `fatima.mansouri@email.com`
- **Password**: `patient123`

(Additional patients available - all with password: `patient123`)

## 🏥 Medical Services

Pre-configured services include:
- **Cardiologie** (High Priority) - Building A, 2nd floor
- **Dermatologie** (Medium Priority) - Building B, 1st floor
- **Pédiatrie** (High Priority) - Building C, Ground floor
- **Radiologie** (Medium Priority) - Building D, Basement
- **Urgences** (Emergency) - Main Building, Ground floor
- **Neurologie** (Medium Priority) - Building A, 3rd floor
- **Orthopédie** (Medium Priority) - Building E, 1st floor

## 🧪 Testing

### Basic API Testing
```bash
python test_api.py
```

### **NEW: QR Code Features Testing**
```bash
python qr_demo.py
```

This comprehensive demo will test:
- ✅ Service QR code generation
- ✅ QR scan detection
- ✅ Automatic queue joining
- ✅ Ticket creation and positioning
- ✅ Real-time admin monitoring

## 📱 **QR Code Workflow**

### For Hospital Staff:
1. **Generate QR codes** for each service: `GET /api/services/{id}/qr-code`
2. **Print and display** QR codes at service locations
3. **Monitor queues** in real-time through admin dashboard

### For Patients:
1. **Scan QR code** at any service location
2. **Enter basic info** (name, phone, email)
3. **Instantly join queue** and receive ticket
4. **Get real-time position** and wait time updates

### Example QR Scan Response:
```json
{
  "ticket_number": "T-20250717-ABC123",
  "position_in_queue": 1,
  "estimated_wait_time": 25,
  "service_name": "Cardiologie",
  "status": "waiting"
}
```

## 🗂️ Database Schema

### Key Tables
- **users** - User accounts and authentication
- **services** - Medical services configuration
- **tickets** - Queue tickets with QR codes
- **queue_logs** - Activity logging
- **alerts** - System notifications

## 📋 Environment Configuration

Key settings in `config.py`:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT token secret
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration (default: 30)
- `CORS_ORIGINS` - Allowed frontend origins

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check credentials in config.py
   - Verify database "waitless_chu" exists

2. **Import Errors**
   - Install missing dependencies: `pip install email-validator`
   - Ensure all packages from requirements.txt are installed

3. **Port Already in Use**
   - Change port in main.py or use: `uvicorn main:app --port 8001`

4. **CORS Issues**
   - Update `CORS_ORIGINS` in config.py
   - Add your frontend URL to allowed origins

5. **QR Code Generation Issues**
   - Ensure `qrcode[pil]` is installed
   - Check service is active before generating QR

## 🚧 Latest Updates

### ✅ **QR Code Features (Latest)**
- [x] Service QR code generation
- [x] Scan-to-join functionality  
- [x] Smart QR detection
- [x] Contactless queue management
- [x] Real-time position tracking

### ✅ **Previously Completed**
- [x] Authentication system
- [x] Service management
- [x] Ticket system with QR codes
- [x] Queue management
- [x] Admin dashboard
- [x] Database models and relationships

### 🔄 **Upcoming Features**
- [ ] WebSocket implementation for real-time updates
- [ ] Advanced analytics and reporting
- [ ] Email/SMS notifications
- [ ] Mobile app API enhancements
- [ ] Multi-hospital support

## 📞 Support

For issues or questions:
1. Check the API documentation at `/docs`
2. Review the logs for error messages
3. Test QR features with `python qr_demo.py`
4. Ensure all dependencies are properly installed
5. Verify database connection and permissions

## 🔄 Development Status

✅ **Completed:**
- Authentication system
- Service management
- Ticket system with QR codes
- Queue management
- Admin dashboard
- **QR scan-to-join functionality** ⭐ **NEW**

🔄 **In Progress:**
- WebSocket real-time updates
- Comprehensive testing suite

📋 **Planned:**
- Advanced notifications
- Performance optimizations
- Mobile API improvements

---

**WaitLess CHU** - Revolutionizing hospital queue management with smart QR technology! 📱🏥 