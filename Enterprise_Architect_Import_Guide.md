# 🏗️ Enterprise Architect Import Guide - WaitLess CHU

## 📋 Overview
This guide explains how to import the WaitLess CHU UML diagrams into Sparx Systems Enterprise Architect and other professional UML tools.

---

## 🎯 **Method 1: XMI Import (Recommended)**

### **Step 1: Import XMI File**
1. Open Enterprise Architect
2. Create a new project or open existing project
3. Right-click on the model in Project Browser
4. Select **"Import/Export" → "Import Package from XMI"**
5. Browse and select `WaitLess_CHU_Class_Model.xmi`
6. Click **"Import"**

### **Step 2: Verify Import**
- Check that all classes are imported:
  - User, Service, Ticket, QueueLog, Alert
  - All enumerations (UserRole, ServicePriority, etc.)
  - All associations and relationships

### **Step 3: Create Diagrams**
1. Right-click on imported package
2. Select **"Add Diagram"**
3. Choose **"Class Diagram"**
4. Drag and drop classes from Project Browser
5. Auto-layout using **"Layout" → "Apply Layout"**

---

## 🎯 **Method 2: PlantUML Integration**

### **Option A: PlantUML Plugin**
1. Install PlantUML plugin for Enterprise Architect
2. Create new diagram
3. Import PlantUML files:
   - `WaitLess_CHU_ClassDiagram.puml`
   - `WaitLess_CHU_UseCases.puml`

### **Option B: Online PlantUML → Export**
1. Go to [PlantUML Online Server](http://www.plantuml.com/plantuml/uml/)
2. Paste PlantUML code
3. Generate diagram
4. Export as:
   - **SVG** (for high quality)
   - **PNG** (for simple import)
   - **XMI** (if supported)

---

## 🎯 **Method 3: Manual Recreation (Most Control)**

### **Step 1: Create Project Structure**
```
WaitLess CHU Project
├── Model
│   ├── Domain Model
│   │   ├── User Management
│   │   ├── Service Management
│   │   ├── Queue Management
│   │   └── Notification System
│   ├── Use Cases
│   │   ├── Patient Use Cases
│   │   ├── Staff Use Cases
│   │   ├── Doctor Use Cases
│   │   └── Admin Use Cases
│   └── System Architecture
│       ├── Component View
│       ├── Deployment View
│       └── Security View
```

### **Step 2: Create Classes**
Use the detailed specifications from `UML_DIAGRAMS.md`:

#### **User Class**
```
Class: User
Attributes:
- id: int {PK}
- email: String {unique}
- hashed_password: String
- full_name: String
- phone: String
- role: UserRole
- assigned_service_id: int {FK}
- is_active: Boolean
- created_at: DateTime
- updated_at: DateTime

Methods:
+ login(): Token
+ logout(): void
+ updateProfile(): void
+ validateCredentials(): Boolean
```

#### **Service Class**
```
Class: Service
Attributes:
- id: int {PK}
- name: String
- description: String
- location: String
- max_wait_time: int
- priority: ServicePriority
- status: ServiceStatus
- current_waiting: int
- avg_wait_time: int
- created_at: DateTime
- updated_at: DateTime

Methods:
+ addTicket(): void
+ removeTicket(): void
+ calculateWaitTime(): int
+ updateStatus(): void
```

### **Step 3: Create Enumerations**
```
Enumeration: UserRole
- PATIENT
- ADMIN
- STAFF
- DOCTOR

Enumeration: ServicePriority
- LOW
- MEDIUM
- HIGH

Enumeration: ServiceStatus
- ACTIVE
- INACTIVE
- EMERGENCY

Enumeration: TicketStatus
- WAITING
- CONSULTING
- COMPLETED
- CANCELLED
- EXPIRED
```

### **Step 4: Create Associations**
1. **User → Ticket** (1:many)
   - Role: Patient creates tickets
   - Multiplicity: 1 User to 0..* Tickets

2. **Service → Ticket** (1:many)
   - Role: Service manages tickets
   - Multiplicity: 1 Service to 0..* Tickets

3. **User → Service** (many:1)
   - Role: Staff assigned to service
   - Multiplicity: 0..* Users to 0..1 Service

---

## 🎯 **Method 4: Alternative Tools**

### **Tools that Support XMI Import:**
- **Visual Paradigm** - Excellent XMI support
- **MagicDraw/Cameo** - Professional UML tool
- **StarUML** - Free alternative
- **Lucidchart** - Web-based with import features
- **Draw.io** (now diagrams.net) - Free with limited UML

### **Tools that Support PlantUML:**
- **Visual Studio Code** with PlantUML extension
- **IntelliJ IDEA** with PlantUML plugin
- **Confluence** with PlantUML macro
- **GitLab/GitHub** with PlantUML rendering

---

## 🔧 **Enterprise Architect Specific Tips**

### **Creating Professional Diagrams:**
1. **Stereotypes**: Add custom stereotypes for system components
2. **Profiles**: Create UML profiles for hospital domain
3. **Tagged Values**: Add metadata for database mappings
4. **Notes**: Link to requirements and specifications
5. **Hyperlinks**: Connect diagrams to external documentation

### **Model Validation:**
1. Use **"Tools" → "Validate Model"**
2. Check for:
   - Orphaned elements
   - Incomplete associations
   - Missing multiplicities
   - Naming conventions

### **Generate Documentation:**
1. **"Generate" → "Documentation"**
2. Select RTF or HTML format
3. Include:
   - Class descriptions
   - Attribute details
   - Method signatures
   - Relationship descriptions

### **Database Schema Generation:**
1. **"Tools" → "Code Generation"**
2. Select **"Database Schema"**
3. Choose target database (PostgreSQL)
4. Generate DDL scripts

---

## 📊 **Diagram Checklist**

### **Class Diagram Verification:**
- [ ] All 5 main classes imported
- [ ] All 4 enumerations created
- [ ] All associations with correct multiplicities
- [ ] All attributes with correct types
- [ ] Method signatures included
- [ ] Stereotype applications

### **Use Case Diagram Verification:**
- [ ] All 4 actor types
- [ ] Patient use cases (6 cases)
- [ ] Doctor use cases (6 cases)
- [ ] Staff use cases (6 cases)
- [ ] Admin use cases (7 cases)
- [ ] System use cases (7 cases)
- [ ] Include/Extend relationships

### **Sequence Diagram Verification:**
- [ ] Patient QR journey
- [ ] Staff queue management
- [ ] Login/Authentication flow
- [ ] Real-time update flow

---

## 🚀 **Next Steps**

1. **Import base model** using XMI
2. **Create visual diagrams** from imported elements
3. **Add behavioral diagrams** (Activity, State, Sequence)
4. **Document requirements** linking to use cases
5. **Generate code** from class model
6. **Create test cases** from use case scenarios

---

## 📞 **Support Resources**

- **Enterprise Architect Help**: F1 in application
- **XMI Specification**: [OMG XMI Standard](https://www.omg.org/spec/XMI/)
- **PlantUML Documentation**: [PlantUML.com](http://plantuml.com/)
- **UML Best Practices**: Refer to UML 2.5 specification

This guide ensures professional-quality UML models suitable for enterprise development and documentation standards.