# 🏥 ArogyaPlus - System Architecture & Workflows Flowchart

> **ArogyaPlus (Smart Health Management System)**  
> Complete operational workflows, user roles, real-time telemetry, and service interaction flowcharts.

---

## 🖼️ System High-Level Architecture Infographic

![System Flowchart Diagram](./system_flowchart.jpg)

---

## 1. End-to-End System Role & Module Flowchart

```mermaid
flowchart TD
    %% Roles
    PatientUser(["🧑 Patient / User"]):::patient
    DoctorUser(["👨‍⚕️ Doctor / Medical Staff"]):::doctor
    AdminUser(["🏢 Hospital Admin"]):::admin
    SuperAdminUser(["⚡ Super Admin"]):::superadmin

    %% Gateway & Auth
    Gateway["🌐 Express.js API Gateway & Static Server (PWA)"]:::backend
    JWTGuard{"🔐 JWT Auth & Role Authorization"}:::security

    PatientUser -->|Register / Login| Gateway
    DoctorUser -->|Login| Gateway
    AdminUser -->|Login| Gateway
    SuperAdminUser -->|MFA / Passkey Login| Gateway

    Gateway --> JWTGuard

    %% Patient Portal Flows
    JWTGuard -->|role: patient| PatientPortal["🧑 Patient Portal"]
    PatientPortal --> BookAppt["📅 Book Appointments (In-Person / Video)"]
    PatientPortal --> EmergencySOS["🚨 Trigger Emergency SOS (GPS Auto-Locate)"]
    PatientPortal --> AmbTrack["🚑 Real-Time Ambulance Booking & Live GPS Tracking"]
    PatientPortal --> WebRTCVideo["📹 WebRTC Telemedicine Consultation"]
    PatientPortal --> PrescriptionView["💊 Digital Prescriptions & Refill Requests"]
    PatientPortal --> InsuranceClaim["📄 Submit & Track Insurance Claims"]
    PatientPortal --> PayBill["💳 Razorpay Payment & Invoicing Pass"]
    PatientPortal --> AIChat["🤖 AI Health Assistant & Symptom Triage"]

    %% Doctor Portal Flows
    JWTGuard -->|role: doctor| DoctorPortal["👨‍⚕️ Doctor Clinical Dashboard"]
    DoctorPortal --> DocQueue["📋 Manage Patient Queue & Schedule"]
    DoctorPortal --> DocVideo["📹 Host WebRTC Consultation Room"]
    DoctorPortal --> DocEHR["✍️ Issue Digital Prescriptions & Diagnostic Notes"]
    DoctorPortal --> DocReviews["⭐ View Patient Ratings & Feedbacks"]

    %% Admin Portal Flows
    JWTGuard -->|role: admin| AdminPortal["🏢 Hospital Branch Admin"]
    AdminPortal --> ManageDocs["🩺 Onboard / Terminate Doctors & Set Specialties"]
    AdminPortal --> AmbDispatch["🚑 Ambulance Fleet Dispatch & Driver Management"]
    AdminPortal --> EmergencyQueue["🚨 Active Emergency Incident Response"]
    AdminPortal --> StorageMgr["📁 Clinical File & Attachment Storage Manager"]
    AdminPortal --> AdminReports["📊 Billing & Operational Analytics"]

    %% Super Admin Flows
    JWTGuard -->|role: superadmin| SuperPortal["⚡ Super Admin Command Center"]
    SuperPortal --> GlobalTelemetry["📡 Live Socket.IO Telemetry & GPS Heatmap"]
    SuperPortal --> AuditLogs["📜 System Audit Logs & Security Traces"]
    SuperPortal --> HospitalBranches["🏥 Multi-Hospital Branch Infrastructure"]
    SuperPortal --> GlobalSettings["⚙️ Platform Rate Limits & Notification VAPID Config"]

    %% Real-time Engine
    AmbTrack <-->|Socket.IO Events| SocketServer["⚡ Socket.IO Real-time Engine"]:::realtime
    EmergencySOS <-->|Socket.IO Events| SocketServer
    GlobalTelemetry <-->|Live Stream| SocketServer
    WebRTCVideo <-->|STUN/TURN WebRTC Signaling| SocketServer

    %% Database
    Gateway --> MongoCluster[("🍃 MongoDB Database")]:::database

    classDef patient fill:#0ea5e9,stroke:#0284c7,stroke-width:2px,color:#fff;
    classDef doctor fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff;
    classDef admin fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff;
    classDef superadmin fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff;
    classDef backend fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef security fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff;
    classDef realtime fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#fff;
    classDef database fill:#047857,stroke:#065f46,stroke-width:2px,color:#fff;
```

---

## 2. Real-Time Emergency Ambulance SOS & Dispatch Flow

```mermaid
sequenceDiagram
    autonumber
    actor Patient as 🧑 Patient (SOS)
    participant Browser as 📱 Leaflet / Browser GPS
    participant API as 🌐 ArogyaPlus API
    participant Socket as ⚡ Socket.IO Broker
    participant Admin as 🏢 Admin / Dispatcher
    participant Driver as 🚑 Ambulance Driver
    participant Doctor as 👨‍⚕️ Assigned Doctor

    Patient->>Browser: Click Emergency SOS / Book Ambulance
    Browser->>Browser: Resolve GPS (lat, lng) via Geolocation API
    Browser->>API: POST /api/ambulances or /api/emergency
    API->>API: Create Emergency / Ambulance Record (status: 'requested')
    API->>Socket: Emit 'emergency:new' & 'ambulance:requested'
    
    Socket-->>Admin: Real-time Alert on Live Incident Map
    Admin->>API: POST /api/ambulances/:id/assign (Driver + Doctor)
    API->>Socket: Emit 'ambulance:dispatched'
    
    Socket-->>Driver: Dispatch Alert with Turn-by-Turn GPS Route
    Socket-->>Patient: Live Driver Marker & Updated ETA (Minutes)
    Socket-->>Doctor: Hospital Emergency Arrival Notice
    
    loop Every 3-5 Seconds
        Driver->>Socket: Emit 'ambulance:location_update' { lat, lng, speed }
        Socket-->>Patient: Smooth Marker Interpolation on Leaflet Map
        Socket-->>Admin: Live Fleet Telemetry Update
    end

    Driver->>API: PATCH /api/ambulances/:id/status (status: 'arrived' -> 'completed')
    API->>Socket: Emit 'ambulance:completed'
    Socket-->>Patient: Trip Completed & Emergency Resolved
```

---

## 3. Appointment Booking, QR Pass & Telemedicine Video Flow

```mermaid
flowchart LR
    subgraph Booking [1. Booking & Scheduling]
        A[User opens Find Doctors] --> B[Sorts by Distance / Specialty]
        B --> C[Selects Date & Consultation Type: In-Person / Video]
        C --> D[Submits Booking POST /api/appointments]
        D --> E[Generates Unique Token & QR Check-in Pass]
    end

    subgraph InPerson [2. In-Person Flow]
        E -->|In-Person| F[Arrives at Hospital]
        F --> G[Admin Scans QR Pass for Instant Check-in]
        G --> H[Doctor Consultation & Digital EHR]
    end

    subgraph Telemedicine [3. Video Consultation Flow]
        E -->|Video| I[Receives Video Room Key & Link]
        I --> J[Patient & Doctor Join /user/video-consultation]
        J --> K[WebRTC Peer Connection via STUN/TURN Traversal]
        K --> L[High-Definition Two-Way Audio/Video & Chat]
    end

    subgraph Completion [4. Prescription & Review]
        H --> M[Doctor Submits Prescription & Medical Advice]
        L --> M
        M --> N[Patient Receives WebPush Notification]
        N --> O[Patient Rates Doctor 1-5 Stars with Feedback]
    end
```

---

## 4. Digital Prescription, Medicine Refill & EHR Flow

```mermaid
stateDiagram-v2
    [*] --> Issued: Doctor creates Prescription (medicine, dosage, frequency)
    Issued --> Active: Patient Views in EHR Portal
    Active --> RefillRequested: Patient Clicks "Request Refill"
    RefillRequested --> DoctorReview: Alert sent to Prescribing Doctor
    DoctorReview --> Active: Doctor Approves Refill (Updated Date)
    DoctorReview --> Discontinued: Doctor Denies / Changes Treatment
    Active --> Completed: Course Finished
    Completed --> [*]
    Discontinued --> [*]
```

---

## 5. Razorpay Clinical Payment & Webhook Verification Flow

```mermaid
sequenceDiagram
    actor Patient as 🧑 Patient
    participant Frontend as 🖥️ Client Web App
    participant Backend as 🌐 ArogyaPlus Server
    participant Razorpay as 💳 Razorpay Gateway
    participant DB as 🍃 MongoDB

    Patient->>Frontend: Click "Pay Outstanding Balance / Consultation Fee"
    Frontend->>Backend: POST /api/payments/create-order { amount, appointmentId }
    Backend->>Razorpay: razorpay.orders.create({ amount, currency: 'INR' })
    Razorpay-->>Backend: Return order_id (e.g., order_XYZ123)
    Backend->>DB: Save Payment record (status: 'created')
    Backend-->>Frontend: Return order_id, key_id, amount

    Frontend->>Razorpay: Open Razorpay Checkout Modal (UPI, Cards, NetBanking)
    Patient->>Razorpay: Authorizes Payment
    Razorpay-->>Frontend: Returns { razorpay_payment_id, razorpay_signature }

    Frontend->>Backend: POST /api/payments/verify
    Backend->>Backend: Verify HMAC-SHA256 Signature with RAZORPAY_KEY_SECRET
    alt Signature Valid
        Backend->>DB: Update Payment (status: 'verified') & mark Appointment paid
        Backend-->>Frontend: { success: true, message: "Payment Verified" }
        Frontend-->>Patient: Display Instant Receipt & QR Pass
    else Signature Invalid
        Backend->>DB: Update Payment (status: 'failed')
        Backend-->>Frontend: { success: false, message: "Signature Mismatch" }
        Frontend-->>Patient: Display Payment Error & Retry
    end
```
