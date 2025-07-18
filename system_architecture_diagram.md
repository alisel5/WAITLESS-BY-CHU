# WAITLESS-CHU System Architecture Diagram

## System Flow Diagram

```
                                   🏥 WAITLESS-CHU System Architecture
                                   
┌─────────────────┐                   ┌─────────────────┐                   ┌─────────────────┐
│   👤 Patient    │                   │  🖥️ Frontend     │                   │  ⚙️ Backend      │
│   (Utilisateur) │                   │   (Next.js)     │                   │   (FastAPI)     │
└─────────────────┘                   └─────────────────┘                   └─────────────────┘
         │                                       │                                       │
         │ 📱 Scan QR Code                      │                                       │
         │ + Enter Info                         │                                       │
         ├─────────────────────────────────────▶│                                       │
         │                                      │ 🔐 POST /api/auth/login              │
         │                                      ├─────────────────────────────────────▶│
         │                                      │                                       │
         │                                      │ ✅ JWT Token                          │
         │                                      │◀─────────────────────────────────────┤
         │ 🎫 Digital Ticket                    │                                       │
         │ + Queue Position                     │                                       │
         │◀─────────────────────────────────────┤                                       │
         │                                      │                                       │
         │                                      │ 📊 GET /api/queue/status             │
         │ 📍 Real-time Position Updates        │◀─────────────────────────────────────▶│
         │◀─────────────────────────────────────┤                                       │
         │                                      │                                       │
         │                                      │ 🎯 POST /api/tickets/create          │
         │ 🆔 Ticket Generation                 │├─────────────────────────────────────▶│
         │◀─────────────────────────────────────┤│                                      │
         │                                      ││ ✅ Ticket Created                     │
         │                                      │◀─────────────────────────────────────┤│
         │                                      │                                       │
                                                │                                       │
┌─────────────────┐                            │                                       │
│  👨‍⚕️ Medical     │                            │                                       │
│    Staff        │                            │                                       │
│ (Personnel)     │                            │                                       │
└─────────────────┘                            │                                       │
         │                                      │                                       │
         │ 🔐 Login to Dashboard                │                                       │
         ├─────────────────────────────────────▶│                                       │
         │                                      │ 🔑 POST /api/auth/staff-login        │
         │                                      ├─────────────────────────────────────▶│
         │                                      │                                       │
         │                                      │ ✅ Staff JWT Token                    │
         │                                      │◀─────────────────────────────────────┤
         │ 📊 Access Dashboard                  │                                       │
         │◀─────────────────────────────────────┤                                       │
         │                                      │                                       │
         │ 📋 Manage Queue                      │ 🎯 PUT /api/queue/next               │
         │ (Next Patient)                       │├─────────────────────────────────────▶│
         │├─────────────────────────────────────▶││                                      │
         ││                                     ││ ✅ Queue Updated                      │
         ││ 📊 Updated Queue Status             │◀─────────────────────────────────────┤│
         │◀─────────────────────────────────────┤│                                      │
         │                                      │                                       │
         │ 📈 View Analytics                    │ 📊 GET /api/admin/reports            │
         │├─────────────────────────────────────▶│├─────────────────────────────────────▶│
         ││                                     ││                                      │
         ││ 📊 Reports & Analytics              ││ 📈 Analytics Data                     │
         │◀─────────────────────────────────────┤│◀─────────────────────────────────────┤│
         │                                      │                                       │
                                                │                                       │
┌─────────────────┐                            │                                       │
│  🛡️ Admin       │                            │                                       │
│ (Administrateur)│                            │                                       │
└─────────────────┘                            │                                       │
         │                                      │                                       │
         │ 🔐 Admin Login                       │                                       │
         ├─────────────────────────────────────▶│                                       │
         │                                      │ 🔑 POST /api/auth/admin-login        │
         │                                      ├─────────────────────────────────────▶│
         │                                      │                                       │
         │                                      │ ✅ Admin JWT Token                    │
         │                                      │◀─────────────────────────────────────┤
         │ ⚙️ System Configuration              │                                       │
         │◀─────────────────────────────────────┤                                       │
         │                                      │                                       │
         │ 🏥 Manage Services                   │ ⚙️ POST /api/admin/services          │
         │├─────────────────────────────────────▶│├─────────────────────────────────────▶│
         ││                                     ││                                      │
         ││ ✅ Services Updated                 ││ ✅ Service Configuration              │
         │◀─────────────────────────────────────┤│◀─────────────────────────────────────┤│
         │                                      │                                       │
         │ 👥 User Management                   │ 👤 GET/POST /api/admin/users         │
         │├─────────────────────────────────────▶│├─────────────────────────────────────▶│
         ││                                     ││                                      │
         ││ 👥 User List & Roles                ││ 👥 User Data                          │
         │◀─────────────────────────────────────┤│◀─────────────────────────────────────┤│
         │                                      │                                       │
                                                │                                       │
                                                │                                       ┌─────────────────┐
                                                │                                       │  🗄️ Database    │
                                                │                                       │  (PostgreSQL)   │
                                                │                                       └─────────────────┘
                                                │                                                │
                                                │                                                │
                                                │                            📊 Database Operations │
                                                │                                       ├────────────────│
                                                │                                       │ • Users        │
                                                │                                       │ • Services     │
                                                │                                       │ • Tickets      │
                                                │                                       │ • Queue        │
                                                │                                       │ • Analytics    │
                                                │                                       └────────────────┘
```

## Key System Components

### 🎯 **Main User Flows**

1. **Patient Flow (QR Scan-to-Join)**
   - Scan QR code at service location
   - Enter basic information (no registration)
   - Receive digital ticket with queue position
   - Get real-time updates and notifications

2. **Medical Staff Flow**
   - Login to staff dashboard
   - Monitor real-time queue status
   - Call next patient
   - View service analytics

3. **Admin Flow**
   - System configuration and monitoring
   - Service management
   - User role management
   - Analytics and reporting

### 🏗️ **Technical Architecture**

#### **Frontend Structure**
```
Frontend/
├── 🏠 Acceuil/          # Landing page
├── 📱 qr-display/       # QR code display system
├── 🎫 tickets/          # Ticket management
├── 👥 patients/         # Patient interface
├── 📊 dashboard/        # Staff dashboard
├── 📈 reports/          # Analytics interface
├── 🔐 signup/           # User registration
└── ⚙️ services/         # Service management
```

#### **Backend API Endpoints**
```
Backend/
├── 🔐 /api/auth/        # Authentication
├── 🏥 /api/services/    # Service management
├── 🎫 /api/tickets/     # Ticket operations
├── 📊 /api/queue/       # Queue management
├── 🛡️ /api/admin/      # Admin operations
└── 📱 /api/tickets-qr/  # QR features
```

### 🔐 **Security & Authentication**
- JWT-based authentication
- Role-based access control (Patient/Staff/Admin)
- Secure QR code generation and validation
- CORS protection

### 📊 **Data Flow**
- Real-time queue updates
- Automatic position tracking
- Smart wait time estimation
- Comprehensive analytics collection

---

## 🚀 **Quick Start Instructions**

1. **Backend Setup:**
   ```bash
   cd Backend/
   pip install -r requirements.txt
   python main.py
   ```

2. **Frontend Setup:**
   ```bash
   cd Frontend/
   python start_https_server.py
   ```

3. **Access Points:**
   - API: `http://localhost:8000`
   - Frontend: `https://localhost:8443`
   - API Docs: `http://localhost:8000/docs`