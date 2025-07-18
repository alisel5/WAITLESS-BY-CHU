# 🏥 WaitLess CHU - Comprehensive UML Documentation

## 📊 Project Overview
WaitLess CHU is a smart hospital queue management system with QR code technology, real-time updates, and multi-role user management.

---

## 1. 👥 Use Case Diagram

```mermaid
graph TD
    %% Actors
    Patient((Patient))
    Doctor((Doctor))
    Staff((Staff/Secretary))
    Admin((Administrator))
    System((System))
    
    %% Patient Use Cases
    Patient --> UC1[Scan QR Code]
    Patient --> UC2[Join Queue Online]
    Patient --> UC3[Track Queue Position]
    Patient --> UC4[Receive Notifications]
    Patient --> UC5[View Ticket Details]
    
    %% Doctor Use Cases
    Doctor --> UC6[View Queue Dashboard]
    Doctor --> UC7[Call Next Patient]
    Doctor --> UC8[Update Patient Status]
    Doctor --> UC9[Mark Consultation Complete]
    Doctor --> UC10[View Patient History]
    
    %% Staff Use Cases
    Staff --> UC11[Manage Service Queue]
    Staff --> UC12[Generate Reports]
    Staff --> UC13[Handle Cancellations]
    Staff --> UC14[Priority Management]
    Staff --> UC6
    
    %% Admin Use Cases
    Admin --> UC15[Manage Services]
    Admin --> UC16[Manage Users]
    Admin --> UC17[System Configuration]
    Admin --> UC18[View Analytics]
    Admin --> UC19[Monitor System Health]
    Admin --> UC12
    
    %% System Use Cases
    System --> UC20[Calculate Wait Times]
    System --> UC21[Send Real-time Updates]
    System --> UC22[Generate QR Codes]
    System --> UC23[Log Queue Actions]
    System --> UC24[Auto-cleanup Expired Tickets]
```

---

## 2. 🗂️ Class Diagram - Data Models

```mermaid
classDiagram
    class User {
        +int id
        +string email
        +string hashed_password
        +string full_name
        +string phone
        +UserRole role
        +int assigned_service_id
        +bool is_active
        +datetime created_at
        +datetime updated_at
        +List~Ticket~ tickets
        +Service assigned_service
    }
    
    class Service {
        +int id
        +string name
        +string description
        +string location
        +int max_wait_time
        +ServicePriority priority
        +ServiceStatus status
        +int current_waiting
        +int avg_wait_time
        +datetime created_at
        +datetime updated_at
        +List~Ticket~ tickets
    }
    
    class Ticket {
        +int id
        +string ticket_number
        +int patient_id
        +int service_id
        +TicketStatus status
        +ServicePriority priority
        +int position_in_queue
        +int estimated_wait_time
        +string qr_code
        +string notes
        +datetime estimated_arrival
        +datetime actual_arrival
        +datetime consultation_start
        +datetime consultation_end
        +datetime created_at
        +datetime updated_at
        +User patient
        +Service service
    }
    
    class QueueLog {
        +int id
        +int ticket_id
        +string action
        +datetime timestamp
        +string details
        +Ticket ticket
    }
    
    class Alert {
        +int id
        +string type
        +string message
        +int service_id
        +bool is_read
        +datetime created_at
        +Service service
    }
    
    %% Enums
    class UserRole {
        <<enumeration>>
        PATIENT
        ADMIN
        STAFF
        DOCTOR
    }
    
    class ServicePriority {
        <<enumeration>>
        LOW
        MEDIUM
        HIGH
    }
    
    class ServiceStatus {
        <<enumeration>>
        ACTIVE
        INACTIVE
        EMERGENCY
    }
    
    class TicketStatus {
        <<enumeration>>
        WAITING
        CONSULTING
        COMPLETED
        CANCELLED
        EXPIRED
    }
    
    %% Relationships
    User ||--o{ Ticket : creates
    User ||--o| Service : assigned_to
    Service ||--o{ Ticket : manages
    Ticket ||--o{ QueueLog : generates
    Service ||--o{ Alert : triggers
    
    User }o--|| UserRole : has
    Service }o--|| ServicePriority : has
    Service }o--|| ServiceStatus : has
    Ticket }o--|| TicketStatus : has
    Ticket }o--|| ServicePriority : has
```

---

## 3. 🏗️ System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI1[Patient Interface<br/>QR Scanner, Ticket Tracking]
        UI2[Staff Dashboard<br/>Queue Management]
        UI3[Doctor Interface<br/>Patient Calls]
        UI4[Admin Panel<br/>System Management]
    end
    
    subgraph "API Gateway"
        FASTAPI[FastAPI Application<br/>REST API + WebSocket]
    end
    
    subgraph "Business Logic Layer"
        AUTH[Authentication Service<br/>JWT + RBAC]
        QUEUE[Queue Manager<br/>Position Calculation]
        QR[QR Code Generator<br/>Ticket Creation]
        NOTIFY[Notification Service<br/>Real-time Updates]
        WEBSOCKET[WebSocket Manager<br/>Live Connections]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL Database<br/>Users, Services, Tickets)]
        LOGS[(Queue Logs<br/>Audit Trail)]
    end
    
    subgraph "External Services"
        EMAIL[Email Service<br/>Notifications]
        SMS[SMS Service<br/>Alerts]
    end
    
    %% Connections
    UI1 --> FASTAPI
    UI2 --> FASTAPI
    UI3 --> FASTAPI
    UI4 --> FASTAPI
    
    FASTAPI --> AUTH
    FASTAPI --> QUEUE
    FASTAPI --> QR
    FASTAPI --> NOTIFY
    FASTAPI --> WEBSOCKET
    
    AUTH --> DB
    QUEUE --> DB
    QR --> DB
    NOTIFY --> DB
    WEBSOCKET --> DB
    
    QUEUE --> LOGS
    NOTIFY --> EMAIL
    NOTIFY --> SMS
    
    WEBSOCKET -.->|Real-time| UI1
    WEBSOCKET -.->|Real-time| UI2
    WEBSOCKET -.->|Real-time| UI3
    WEBSOCKET -.->|Real-time| UI4
```

---

## 4. 🔄 Sequence Diagram - Patient QR Journey

```mermaid
sequenceDiagram
    participant P as Patient
    participant QR as QR Scanner
    participant API as FastAPI Backend
    participant DB as Database
    participant WS as WebSocket Manager
    participant STAFF as Staff Dashboard
    
    P->>QR: Scan QR Code at Service
    QR->>API: GET /api/services/{service_id}/qr-info
    API->>DB: Query service details
    DB-->>API: Service information
    API-->>QR: Service details + form
    
    QR->>P: Display patient info form
    P->>QR: Enter name, phone, priority
    QR->>API: POST /api/tickets-qr/join-online
    
    API->>DB: Create user (if new)
    API->>DB: Create ticket
    API->>API: Generate QR code
    API->>DB: Calculate queue position
    DB-->>API: Position and wait time
    
    API->>WS: Notify queue update
    WS->>STAFF: Broadcast queue changes
    
    API-->>QR: Ticket created with QR
    QR-->>P: Display ticket + position
    
    loop Real-time Updates
        WS->>P: Send position updates
        P->>API: GET /api/tickets/{ticket_id}/status
        API->>DB: Get current position
        DB-->>API: Updated position
        API-->>P: Current status
    end
    
    STAFF->>API: POST /api/queue/call-next
    API->>DB: Update ticket status
    API->>WS: Notify patient called
    WS->>P: "Your turn!" notification
```

---

## 5. 🔄 Sequence Diagram - Staff Queue Management

```mermaid
sequenceDiagram
    participant S as Staff/Doctor
    participant DASH as Dashboard
    participant API as FastAPI Backend
    participant DB as Database
    participant WS as WebSocket Manager
    participant P as Patient
    
    S->>DASH: Login to dashboard
    DASH->>API: POST /api/auth/login
    API->>DB: Validate credentials
    DB-->>API: User authenticated
    API-->>DASH: JWT token + user info
    
    DASH->>API: GET /api/admin/dashboard
    API->>DB: Query queue statistics
    DB-->>API: Queue data
    API-->>DASH: Dashboard metrics
    
    DASH->>WS: Connect to real-time updates
    WS-->>DASH: Connection established
    
    loop Queue Management
        S->>DASH: View service queue
        DASH->>API: GET /api/queue/service/{service_id}
        API->>DB: Get waiting tickets
        DB-->>API: Queue positions
        API-->>DASH: Current queue status
        
        S->>DASH: Call next patient
        DASH->>API: POST /api/queue/call-next/{service_id}
        API->>DB: Update ticket to CONSULTING
        API->>DB: Recalculate positions
        API->>WS: Broadcast queue update
        
        WS->>P: Notify patient called
        WS->>DASH: Update queue display
        
        S->>DASH: Mark consultation complete
        DASH->>API: PUT /api/tickets/{ticket_id}/complete
        API->>DB: Update ticket to COMPLETED
        API->>DB: Log queue action
        API->>WS: Broadcast completion
        WS->>DASH: Remove from queue
    end
```

---

## 6. 🔄 Activity Diagram - Queue Processing Flow

```mermaid
flowchart TD
    START([Patient Arrives]) --> SCAN{Scan QR Code?}
    
    SCAN -->|Yes| QR_SCAN[Process QR Scan]
    SCAN -->|No| MANUAL[Manual Entry Online]
    
    QR_SCAN --> VALIDATE[Validate Service]
    MANUAL --> VALIDATE
    
    VALIDATE --> INFO[Enter Patient Info]
    INFO --> CREATE[Create Ticket]
    CREATE --> POSITION[Calculate Queue Position]
    POSITION --> QR_GEN[Generate QR Ticket]
    QR_GEN --> NOTIFY_JOIN[Notify Queue Join]
    
    NOTIFY_JOIN --> WAITING[Patient Waiting]
    
    WAITING --> CHECK{Position Changed?}
    CHECK -->|Yes| UPDATE[Send Position Update]
    UPDATE --> WAITING
    CHECK -->|No| CALLED{Called by Staff?}
    
    CALLED -->|Yes| CONSULTING[Consultation Started]
    CALLED -->|No| EXPIRED{Ticket Expired?}
    
    EXPIRED -->|Yes| CLEANUP[Auto Cleanup]
    EXPIRED -->|No| WAITING
    
    CONSULTING --> COMPLETE{Consultation Done?}
    COMPLETE -->|Yes| FINISH[Mark Complete]
    COMPLETE -->|No| CONSULTING
    
    CLEANUP --> END([End])
    FINISH --> LOG[Log Queue Action]
    LOG --> END
    
    style START fill:#e1f5fe
    style END fill:#f3e5f5
    style WAITING fill:#fff3e0
    style CONSULTING fill:#e8f5e8
```

---

## 7. 🗄️ Database ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    USERS ||--o{ TICKETS : creates
    USERS ||--o| SERVICES : assigned_to
    SERVICES ||--o{ TICKETS : manages
    SERVICES ||--o{ ALERTS : triggers
    TICKETS ||--o{ QUEUE_LOGS : generates
    
    USERS {
        int id PK
        string email UK
        string hashed_password
        string full_name
        string phone
        enum role
        int assigned_service_id FK
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    SERVICES {
        int id PK
        string name
        text description
        string location
        int max_wait_time
        enum priority
        enum status
        int current_waiting
        int avg_wait_time
        timestamp created_at
        timestamp updated_at
    }
    
    TICKETS {
        int id PK
        string ticket_number UK
        int patient_id FK
        int service_id FK
        enum status
        enum priority
        int position_in_queue
        int estimated_wait_time
        string qr_code
        text notes
        timestamp estimated_arrival
        timestamp actual_arrival
        timestamp consultation_start
        timestamp consultation_end
        timestamp created_at
        timestamp updated_at
    }
    
    QUEUE_LOGS {
        int id PK
        int ticket_id FK
        string action
        timestamp timestamp
        text details
    }
    
    ALERTS {
        int id PK
        string type
        string message
        int service_id FK
        boolean is_read
        timestamp created_at
    }
```

---

## 8. 🚀 Deployment Diagram

```mermaid
graph TB
    subgraph "Client Devices"
        MOBILE[📱 Mobile Browsers<br/>QR Scanner + Tracking]
        DESKTOP[💻 Desktop Browsers<br/>Staff Dashboards]
        TABLET[📟 Tablets<br/>Doctor Interfaces]
    end
    
    subgraph "Load Balancer"
        LB[⚖️ NGINX<br/>Load Balancer + SSL]
    end
    
    subgraph "Application Servers"
        APP1[🐍 FastAPI Instance 1<br/>Port 8000]
        APP2[🐍 FastAPI Instance 2<br/>Port 8001]
        APP3[🐍 FastAPI Instance 3<br/>Port 8002]
    end
    
    subgraph "Database Cluster"
        PRIMARY[(🗄️ PostgreSQL Primary<br/>Read/Write)]
        REPLICA1[(🗄️ PostgreSQL Replica 1<br/>Read Only)]
        REPLICA2[(🗄️ PostgreSQL Replica 2<br/>Read Only)]
    end
    
    subgraph "Cache Layer"
        REDIS[📦 Redis Cache<br/>Session + Queue State]
    end
    
    subgraph "File Storage"
        STATIC[📁 Static Files<br/>QR Codes + Assets]
    end
    
    subgraph "Monitoring"
        LOGS[📊 Log Aggregation<br/>ELK Stack]
        METRICS[📈 Metrics<br/>Prometheus + Grafana]
    end
    
    %% Connections
    MOBILE --> LB
    DESKTOP --> LB
    TABLET --> LB
    
    LB --> APP1
    LB --> APP2
    LB --> APP3
    
    APP1 --> PRIMARY
    APP1 --> REPLICA1
    APP1 --> REDIS
    APP1 --> STATIC
    
    APP2 --> PRIMARY
    APP2 --> REPLICA2
    APP2 --> REDIS
    APP2 --> STATIC
    
    APP3 --> PRIMARY
    APP3 --> REPLICA1
    APP3 --> REDIS
    APP3 --> STATIC
    
    PRIMARY --> REPLICA1
    PRIMARY --> REPLICA2
    
    APP1 --> LOGS
    APP2 --> LOGS
    APP3 --> LOGS
    
    APP1 --> METRICS
    APP2 --> METRICS
    APP3 --> METRICS
```

---

## 9. 🔧 Component Diagram - Backend Services

```mermaid
graph TB
    subgraph "FastAPI Application"
        MAIN[main.py<br/>Application Entry]
        
        subgraph "Routers"
            AUTH_R[auth.py<br/>Authentication]
            SERVICES_R[services.py<br/>Service Management]
            TICKETS_R[tickets.py<br/>Ticket Operations]
            QUEUE_R[queue.py<br/>Queue Management]
            ADMIN_R[admin.py<br/>Administration]
            WS_R[websocket.py<br/>Real-time Updates]
        end
        
        subgraph "Core Services"
            AUTH_S[auth.py<br/>JWT + Security]
            MODELS[models.py<br/>Data Models]
            SCHEMAS[schemas.py<br/>Pydantic DTOs]
            CONFIG[config.py<br/>Settings]
            DATABASE[database.py<br/>DB Connection]
        end
        
        subgraph "Business Logic"
            WS_MANAGER[websocket_manager.py<br/>Connection Manager]
            QR_GEN[QR Generator<br/>Ticket Creation]
            QUEUE_CALC[Queue Calculator<br/>Position & Time]
        end
    end
    
    subgraph "External Dependencies"
        DB[(PostgreSQL<br/>Database)]
        JWT[JWT Library<br/>jose]
        QR_LIB[QR Code Library<br/>qrcode]
        BCRYPT[Password Hashing<br/>bcrypt]
    end
    
    %% Component Relationships
    MAIN --> AUTH_R
    MAIN --> SERVICES_R
    MAIN --> TICKETS_R
    MAIN --> QUEUE_R
    MAIN --> ADMIN_R
    MAIN --> WS_R
    
    AUTH_R --> AUTH_S
    SERVICES_R --> MODELS
    TICKETS_R --> QR_GEN
    QUEUE_R --> QUEUE_CALC
    WS_R --> WS_MANAGER
    
    MODELS --> DATABASE
    AUTH_S --> JWT
    AUTH_S --> BCRYPT
    QR_GEN --> QR_LIB
    DATABASE --> DB
    
    WS_MANAGER -.->|Real-time| AUTH_R
    WS_MANAGER -.->|Real-time| QUEUE_R
    WS_MANAGER -.->|Real-time| TICKETS_R
```

---

## 10. 🔧 Component Diagram - Frontend Structure

```mermaid
graph TB
    subgraph "Frontend Applications"
        
        subgraph "Shared Components"
            API_CLIENT[api.js<br/>HTTP Client]
            WS_CLIENT[websocket-client.js<br/>Real-time Client]
            MSG_MANAGER[message-manager.js<br/>UI Messages]
            LOADING[loading-manager.js<br/>Loading States]
            SHARED_CSS[api.css<br/>Shared Styles]
        end
        
        subgraph "Patient Interface"
            QR_SCANNER[qr.js + qr.html<br/>QR Code Scanner]
            TICKET_TRACK[track-status.js<br/>Ticket Tracking]
            PATIENT_CSS[qr.css<br/>QR Styles]
        end
        
        subgraph "Ticket Management"
            TICKET_GEN[generate-tickets.js<br/>Ticket Creation]
            TICKET_VIEW[ticket.js + ticket.html<br/>Ticket Display]
            TICKET_CSS[ticket.css<br/>Ticket Styles]
        end
        
        subgraph "Staff Dashboard"
            DASHBOARD[dashboard.js<br/>Queue Dashboard]
            DASHBOARD_HTML[dashboard.html<br/>Dashboard UI]
            DASHBOARD_CSS[dashboard.css<br/>Dashboard Styles]
        end
        
        subgraph "Admin Interface"
            PATIENT_MGMT[patients.js<br/>Patient Management]
            SERVICE_MGMT[services.js<br/>Service Management]
            REPORTS[reports.js<br/>Analytics & Reports]
        end
    end
    
    %% Dependencies
    QR_SCANNER --> API_CLIENT
    QR_SCANNER --> WS_CLIENT
    QR_SCANNER --> MSG_MANAGER
    
    TICKET_TRACK --> API_CLIENT
    TICKET_TRACK --> WS_CLIENT
    
    DASHBOARD --> API_CLIENT
    DASHBOARD --> WS_CLIENT
    DASHBOARD --> LOADING
    
    PATIENT_MGMT --> API_CLIENT
    SERVICE_MGMT --> API_CLIENT
    REPORTS --> API_CLIENT
    
    TICKET_GEN --> API_CLIENT
    TICKET_VIEW --> WS_CLIENT
```

---

## 11. 🔐 Security Architecture Diagram

```mermaid
graph TB
    subgraph "Authentication Flow"
        LOGIN[User Login] --> VALIDATE[Credential Validation]
        VALIDATE --> JWT_CREATE[JWT Token Creation]
        JWT_CREATE --> RESPONSE[Login Response]
    end
    
    subgraph "Authorization Layers"
        REQUEST[API Request] --> JWT_CHECK[JWT Validation]
        JWT_CHECK --> ROLE_CHECK[Role-Based Access]
        ROLE_CHECK --> PERMISSION[Permission Check]
        PERMISSION --> ACCESS[Grant/Deny Access]
    end
    
    subgraph "Security Components"
        BCRYPT[Password Hashing<br/>bcrypt]
        JWT_TOKEN[JWT Tokens<br/>jose library]
        CORS[CORS Middleware<br/>Cross-Origin Policy]
        RBAC[Role-Based Access Control<br/>Admin/Staff/Doctor/Patient]
    end
    
    subgraph "User Roles & Permissions"
        PATIENT_ROLE[👤 Patient<br/>- Join Queue<br/>- Track Status<br/>- View Own Tickets]
        STAFF_ROLE[👩‍💼 Staff<br/>- Manage Queue<br/>- View Reports<br/>- Handle Cancellations]
        DOCTOR_ROLE[👨‍⚕️ Doctor<br/>- Call Patients<br/>- Update Status<br/>- View Queue]
        ADMIN_ROLE[🛡️ Admin<br/>- Full System Access<br/>- User Management<br/>- System Config]
    end
    
    %% Connections
    VALIDATE --> BCRYPT
    JWT_CREATE --> JWT_TOKEN
    JWT_CHECK --> JWT_TOKEN
    ROLE_CHECK --> RBAC
    
    RBAC --> PATIENT_ROLE
    RBAC --> STAFF_ROLE
    RBAC --> DOCTOR_ROLE
    RBAC --> ADMIN_ROLE
```

---

## 12. 🔄 State Diagram - Ticket Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CREATED : Patient joins queue
    
    CREATED --> WAITING : Ticket generated
    WAITING --> WAITING : Position updates
    WAITING --> CONSULTING : Staff calls patient
    WAITING --> CANCELLED : Patient/Staff cancels
    WAITING --> EXPIRED : Timeout reached
    
    CONSULTING --> COMPLETED : Consultation finished
    CONSULTING --> CANCELLED : Emergency cancel
    CONSULTING --> WAITING : Return to queue
    
    COMPLETED --> [*] : Process complete
    CANCELLED --> [*] : End process
    EXPIRED --> [*] : Auto cleanup
    
    note right of WAITING
        - Real-time position updates
        - Estimated wait time calculation
        - Notification sending
    end note
    
    note right of CONSULTING
        - Timer tracking
        - Status broadcasting
        - Queue recalculation
    end note
```

---

## 📝 Summary

This comprehensive UML documentation covers all aspects of the WaitLess CHU system:

### 🎯 **Key Diagrams Created:**
1. **Use Case Diagram** - User interactions and system functions
2. **Class Diagram** - Data model structure and relationships
3. **System Architecture** - High-level system design
4. **Sequence Diagrams** - Patient journey and staff workflows
5. **Activity Diagram** - Queue processing flow
6. **Database ERD** - Data relationships and structure
7. **Deployment Diagram** - Infrastructure and scaling
8. **Component Diagrams** - Frontend and backend architecture
9. **Security Architecture** - Authentication and authorization
10. **State Diagram** - Ticket lifecycle management

### 🚀 **System Highlights:**
- **QR Code Integration** for contactless queue joining
- **Real-time Updates** via WebSocket connections
- **Role-based Access Control** for different user types
- **Scalable Architecture** with load balancing
- **Comprehensive Security** with JWT authentication
- **Modern Frontend** with responsive design
- **Database Optimization** for high concurrency

This documentation provides a complete technical overview for developers, architects, and stakeholders to understand the WaitLess CHU system design and implementation.