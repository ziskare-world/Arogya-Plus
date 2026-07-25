# 🏥 ArogyaPlus - Smart Health Management Platform

<div align="center">

![ArogyaPlus Banner](https://img.shields.io/badge/ArogyaPlus-Smart%20Healthcare%20Ecosystem-008080?style=for-the-badge&logo=hospital&logoColor=white)

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208.9-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Video%20Consultation-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**A Next-Generation, Multi-Role Smart Hospital Operations & Patient Care Platform.**  
*Seamlessly connecting Patients, Doctors, Hospital Admins, and Super Admins in real-time.*

[Explore Features](#-key-features) • [Quick Start](#-quick-start--setup-guide) • [API Documentation](#-api-reference) • [Real-Time Engine](#-real-time--webrtc-architecture) • [Database Schemas](#-database-models--schema-design)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [System Portals & User Roles](#-system-portals--user-roles)
- [Project Directory Structure](#-project-directory-structure)
- [Environment Configuration](#-environment-configuration)
- [Quick Start & Setup Guide](#-quick-start--setup-guide)
- [Real-Time & WebRTC Architecture](#-real-time--webrtc-architecture)
- [API Reference](#-api-reference)
- [Database Models & Schema Design](#-database-models--schema-design)
- [Progressive Web App (PWA) & Push Notifications](#-progressive-web-app-pwa--push-notifications)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Production Deployment & Hardening](#-production-deployment--hardening)
- [License](#-license)

---

## 🌟 Overview

**ArogyaPlus** is a comprehensive, enterprise-grade Smart Health Management Platform engineered to digitize hospital workflows, enhance patient care delivery, streamline emergency triage, and support real-time telehealth consultations.

Designed with a modular Node.js/Express backend, MongoDB database, Socket.io real-time engine, and a sleek modern PWA frontend, **ArogyaPlus** offers role-tailored dashboards for every healthcare stakeholder.

> [!IMPORTANT]
> **Zero-Config Bootstrap**: On initial application startup, ArogyaPlus automatically verifies database state and bootstraps a system **Super Admin** account if one does not exist, enabling instant system setup out-of-the-box.

---

## ✨ Key Features

### 👥 Multi-Role RBAC Dashboards
- Dedicated, secure portals for **Patients**, **Doctors**, **Hospital Admins**, and **Super Admins**.
- Fine-grained access control with JWT authentication and role middleware.

### 🚑 Emergency Triage & Real-Time Queue
- Priority-weighted emergency queueing (`critical`, `high`, `medium`, `low`).
- Real-time updates pushed instantly to online doctors via WebSockets.
- One-click doctor assignment and emergency case resolution tracking.

### 🚐 Ambulance Fleet & Live Dispatch Management
- Hospital fleet register and availability tracking (`available`, `dispatched`, `maintenance`, `inactive`).
- Live driver tracking with ETA calculation and interactive map integration.

### 📹 HD WebRTC Video Consultation
- Browser-native peer-to-peer audio/video consultation with WebRTC signaling over Socket.io.
- Built-in text chat, appointment verification, and instant consultation completion.

### 🤖 AI-Powered Symptom Checker
- Intelligent diagnostic rule engine offering preliminary health condition analysis.
- Risk level assessment and automated medical specialist recommendations.

### 🎟️ Appointment Management & Dynamic QR Tokens
- Doctor slot search, booking, rescheduling, and status management.
- Dynamic **QR Code token generation** for fast, touchless hospital check-ins.

### 💳 Online Payments & Insurance Claims
- Integrated **Razorpay** payment gateway for instant consultation fee settlement.
- Automated **Mock Payment Fallback Mode** for offline/test environments without API keys.
- Insurance claim submission with document attachment and hospital review workflows.

### 📜 EHR, Digital Prescriptions & Medicine Refills
- Centralized Electronic Health Records (EHR) with downloadable record summaries.
- Digital prescription generation by doctors with automated 24-hour rate-limited refill requests.

### 📱 PWA & VAPID Web Push Notifications
- Mobile-optimized responsive UI installable as a Progressive Web App (PWA).
- Background Web Push notifications using VAPID keys for appointment status alerts.

---

## 🏗️ Architecture & Tech Stack

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT / UI LAYER (PWA)                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ Patient Portal   │  │  Doctor Portal   │  │ Hospital / Super Admin UI │  │
│  └────────┬─────────┘  └────────┬─────────┘  └─────────────┬─────────────┘  │
└───────────┼─────────────────────┼──────────────────────────┼────────────────┘
            │ HTTP / HTTPS        │ WebSockets / WebRTC      │ REST APIs
┌───────────▼─────────────────────▼──────────────────────────▼────────────────┐
│                         BACKEND APPLICATION (NODE.JS)                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Express Server (Auth, RBAC, Validation, Error Handling)               │  │
│  ├──────────────────────────────┬────────────────────────────────────────┤  │
│  │ Socket.IO Server Engine      │ WebRTC Signaling & Room State Map      │  │
│  ├──────────────────────────────┼────────────────────────────────────────┤  │
│  │ AI Symptom Checker Module    │ Razorpay Payment & VAPID Web-Push      │  │
│  └──────────────────────────────┴────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ Mongoose ODM
┌────────────────────────────────────▼────────────────────────────────────────┐
│                              DATABASE LAYER                                 │
│    MongoDB (Users, Appointments, Emergencies, Ambulances, Payments, EHR)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Technologies

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v18+) | Server-side execution environment |
| **Framework** | Express.js (`v4.19.2`) | REST API route management & static UI hosting |
| **Database** | MongoDB & Mongoose (`v8.9.5`) | Document storage & Object Data Modeling |
| **Real-Time** | Socket.IO (`v4.8.1`) | WebSocket events & WebRTC signaling |
| **Media Stream** | WebRTC (Native API) | Real-time audio/video peer consultations |
| **Security** | JWT (`jsonwebtoken`), BcryptJS | Token-based auth & password hashing |
| **Validation** | Express-Validator (`v7.2.1`) | Strict HTTP request payload validation |
| **Push Alerts** | Web Push (`web-push v3.6.7`) | VAPID browser push notifications |
| **Payments** | Razorpay SDK (`v2.9.4`) | Secure online payment gateway |
| **QR Engine** | QRCode (`v1.5.4`) | Dynamic appointment token QR generation |
| **Testing** | Jest, Supertest, MongoDB Memory Server | Automated unit & integration testing |

---

## 👥 System Portals & User Roles

ArogyaPlus provides distinct, customized interfaces based on user authorization levels:

| Role | Portal Path | Key Capabilities |
|---|---|---|
| 🧑‍⚕️ **Patient** | `/user/dashboard` | Book appointments, request emergency/ambulance, take AI symptom checks, view prescriptions, request refills, upload medical records, pay bills online, join video consultations. |
| 🩺 **Doctor** | `/doctor/dashboard` | View daily patient schedule, manage active/priority emergency cases, conduct WebRTC video consultations, issue digital prescriptions, review patient medical history. |
| 🏥 **Hospital Admin** | `/admin/dashboard` | Manage hospital doctors & staff, oversee appointment queues, dispatch ambulance fleet, process emergency triage, review & approve insurance claims, generate hospital analytics. |
| 🛡️ **Super Admin** | `/super-admin/dashboard` | Global platform administration, onboard new hospital admin pairs (Operations + Receptionist), view system-wide logs, audit financial transactions, oversee platform configuration. |

---

## 📁 Project Directory Structure

```text
ArogyaPlus/
├── config/
│   └── db.js                        # MongoDB Mongoose connection & Super Admin bootstrap trigger
├── middleware/
│   ├── authMiddleware.js            # JWT protection & role-based authorization guards
│   ├── errorMiddleware.js           # 404 Not Found & global error handler middleware
│   └── validateMiddleware.js        # Express-validator result parser
├── models/
│   ├── Ambulance.js                 # Ambulance dispatch & booking request schema
│   ├── AmbulanceFleet.js            # Hospital ambulance vehicle fleet schema
│   ├── Appointment.js               # Consultation booking & rating schema
│   ├── Emergency.js                 # Emergency case triage schema
│   ├── Insurance.js                 # Insurance claim & review schema
│   ├── MedicalRecord.js             # Electronic Health Record (EHR) schema
│   ├── Payment.js                   # Razorpay transaction log schema
│   ├── Prescription.js              # Doctor prescription & refill schema
│   ├── PushSubscription.js          # Web-Push notification endpoint schema
│   └── User.js                      # Central user account schema (Bcrypt hashed)
├── routes/
│   ├── adminRoutes.js               # Admin & Super-Admin management endpoints
│   ├── aiRoutes.js                  # AI symptom checker diagnostic route
│   ├── ambulanceRoutes.js           # Ambulance dispatch & fleet management routes
│   ├── appointmentRoutes.js         # Appointment booking & status lifecycle routes
│   ├── authPageRoutes.js            # HTML page route navigation handlers
│   ├── authRoutes.js                # Public user auth (login/register/me) routes
│   ├── doctorRoutes.js              # Doctor schedule, emergency & prescription routes
│   ├── emergencyRoutes.js           # Emergency triage submission & queue routes
│   ├── insuranceRoutes.js           # Insurance claims submission & review routes
│   ├── notificationRoutes.js        # Web-Push subscription & dispatch routes
│   ├── paymentRoutes.js             # Razorpay order creation & signature verification
│   └── userRoutes.js                # Patient dashboard, EHR, profile & billing routes
├── scripts/
│   └── generate-vapid-keys.js       # Utility script to generate VAPID keys for Push API
├── tests/
│   ├── setup.js                     # In-memory MongoDB Jest lifecycle setup
│   ├── testUtils.js                 # JWT token generation test helpers
│   ├── appointments.test.js         # Appointment suite integration tests
│   ├── auth.test.js                 # Authentication suite integration tests
│   ├── emergency.test.js            # Emergency triage integration tests
│   └── modules.test.js              # Comprehensive module integration tests
├── ui/                              # Frontend Web Assets & PWA Application
│   ├── admin/                       # Hospital Admin web views (.html)
│   ├── doctor/                      # Doctor Portal web views (.html)
│   ├── user/                        # Patient Portal web views (.html)
│   ├── super-admin/                 # Super Admin web views (.html)
│   ├── shared/                      # Video consultation UI (.html)
│   ├── backend-js/                  # Frontend controller logic scripts
│   ├── css/                         # Custom CSS design system stylesheets
│   ├── js/                          # Utility modules & API client scripts
│   ├── manifest.webmanifest         # PWA Web Application Manifest
│   ├── service-worker.js            # PWA Service Worker for offline caching & push
│   └── offline.html                 # PWA offline fallback page
├── utils/
│   ├── emergencyQueue.js            # Socket.io emergency queue broadcaster
│   ├── ensureSuperAdmin.js          # System super-admin auto-creation utility
│   ├── pushService.js               # Web-Push notification dispatcher
│   └── symptomChecker.js            # Diagnostic rule engine for AI triage
├── .env.example                     # Environment variables configuration template
├── SECRETS.md                       # Local secrets & credentials (git-ignored)
├── index.js                         # Application entry point (Express & Socket.io server)
├── package.json                     # Node.js dependencies & scripts configuration
└── README.md                        # Complete project documentation
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables Glossary

| Variable | Type | Required | Default Value | Description |
|---|---|---|---|---|
| `PORT` | Number | No | `3000` | HTTP server port |
| `MONGO_URI` | String | Yes | `mongodb://127.0.0.1:27017/smart-health-management` | MongoDB connection string |
| `JWT_SECRET` | String | Yes | *(Configured in .env)* | JWT secret key for signature verification |
| `RAZORPAY_KEY_ID` | String | No | *(Configured in .env)* | Razorpay Key ID (*activates live mode if present*) |
| `RAZORPAY_KEY_SECRET` | String | No | *(Configured in .env)* | Razorpay Key Secret (*activates live mode if present*) |
| `GOOGLE_MAPS_API_KEY` | String | No | *(Configured in .env)* | Google Maps API key for map widgets |
| `VAPID_PUBLIC_KEY` | String | No | *(Configured in .env)* | Public VAPID key for Web Push Notifications |
| `VAPID_PRIVATE_KEY` | String | No | *(Configured in .env)* | Private VAPID key for Web Push Signing |
| `VAPID_SUBJECT` | String | No | *(Configured in .env)* | Mailto contact for Web Push service |
| `SUPER_ADMIN_EMAIL` | String | No | *(Configured in .env)* | Default super-admin email |
| `SUPER_ADMIN_PASSWORD` | String | No | *(Configured in .env)* | Default super-admin password |

> [!TIP]
> If `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are omitted, the application automatically enters **Mock Payment Mode**, allowing developers to test full payment flows without real gateway credentials.

---

## 🚀 Quick Start & Setup Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB Server (`mongodb://127.0.0.1:27017`) or MongoDB Atlas URI

### 1️⃣ Installation

Clone the repository and install project dependencies:

```bash
git clone https://github.com/ziskare-world/Arogya-Plus.git
cd Arogya-Plus
npm install
```

### 2️⃣ Generate Web Push Keys (Optional)

Generate a fresh set of VAPID keys for browser push notifications:

```bash
npm run generate:vapid
```

Copy the printed public and private keys into your `.env` file.

### 3️⃣ Start Development Server

Run the application with auto-reloading via `nodemon`:

```bash
npm run dev
```

Output:
```text
Server running at http://127.0.0.1:3000
MongoDB connected: 127.0.0.1
[Auth] Super admin created / verified
```

### 4️⃣ Production Server

Start the application in production mode:

```bash
npm start
```

---

## 🔐 Default Access Credentials & Security

> [!SECURITY]
> All default initial system credentials, passwords, and private API secret keys are maintained in a separate local file: [`SECRETS.md`](file:///d:/ArogyaPlus/SECRETS.md).
> 
> **Note**: `SECRETS.md` and `.env` are listed in `.gitignore` and are **NEVER** pushed to GitHub or public repositories. Please refer to your local `SECRETS.md` file for initial admin login credentials.


---

## 📡 Real-Time & WebRTC Architecture

ArogyaPlus integrates a high-performance **Socket.IO** engine for real-time state synchronization and peer-to-peer WebRTC video consultations.

### Real-Time Emergency Triage Queue
- **Event**: `emergencyQueue:update`
- **Behavior**: Emitted whenever an emergency case is reported, claimed by a doctor, or marked as resolved. All connected doctor and admin sockets receive immediate queue refreshes.

### WebRTC Video Consultation Room Signals

```text
 Client A (Patient)                     Socket.io Server                     Client B (Doctor)
         │                                      │                                    │
         │─────── video:join-room ─────────────>│                                    │
         │                                      │─────── video:participant-joined ──>│
         │                                      │                                    │
         │─────── video:webrtc-offer ──────────>│                                    │
         │                                      │─────── video:webrtc-offer ────────>│
         │                                      │                                    │
         │                                      │<────── video:webrtc-answer ────────│
         │<────── video:webrtc-answer ──────────│                                    │
         │                                      │                                    │
         │<══════ video:ice-candidate ═════════>│<══════ video:ice-candidate ═══════>│
         │                                      │                                    │
         │═════════════════════ DIRECT P2P MEDIA STREAM (WebRTC) ════════════════════│
```

| Socket Event | Direction | Description |
|---|---|---|
| `video:join-room` | Client ➔ Server | Join video consultation room with appointment credentials. |
| `video:participant-joined` | Server ➔ Room | Broadcast newly joined room participant. |
| `video:webrtc-offer` | Client ➔ Server ➔ Peer | Forward WebRTC SDP session description offer. |
| `video:webrtc-answer` | Client ➔ Server ➔ Peer | Forward WebRTC SDP session description answer. |
| `video:ice-candidate` | Client ➔ Server ➔ Peer | Relays ICE candidates for NAT traversal / P2P connection. |
| `video:chat` | Client ➔ Server ➔ Room | Real-time text chat message transmission during call. |
| `video:appointment-completed` | Client ➔ Server ➔ Room | Signals completion of video consultation session. |
| `video:leave-room` | Client ➔ Server | Leaves video consultation room and notifies peer. |

---

## 🔌 API Reference

### Auth & User Management (`/api/auth`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new patient account |
| `POST` | `/api/auth/login` | Public | Authenticate user & return JWT token |
| `GET` | `/api/auth/me` | Protected | Fetch current logged-in user profile |
| `GET` | `/api/auth/doctors` | Public | List active hospital doctors with clinic coordinates |

### Appointments (`/api/appointments`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/appointments` | Patient / Admin | Book a new consultation appointment |
| `GET` | `/api/appointments/my` | Patient / Doctor | Fetch appointments linked to current user |
| `GET` | `/api/appointments` | Admin / Super Admin | List all system appointments (filterable by status) |
| `GET` | `/api/appointments/doctor/:doctorId` | Doctor / Admin | Get all appointments assigned to specific doctor |
| `PATCH` | `/api/appointments/:id/reschedule` | Patient / Admin | Reschedule an existing appointment |
| `PATCH` | `/api/appointments/:id/cancel` | Patient / Admin | Cancel appointment |
| `PATCH` | `/api/appointments/:id/status` | Doctor / Admin | Update status (`confirmed`, `completed`, etc.) |
| `PATCH` | `/api/appointments/:id/rating` | Patient / Admin | Submit rating & review for completed appointment |
| `GET` | `/api/appointments/:id/token-qr` | Protected | Generate dynamic QR code data URL for token check-in |

### Emergency Triage (`/api/emergency`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/emergency` | Protected | Create new emergency triage request |
| `GET` | `/api/emergency/queue` | Protected | Get active priority emergency triage queue |
| `GET` | `/api/emergency/my` | Protected | Get emergencies submitted by logged-in patient |
| `PATCH` | `/api/emergency/:id/status` | Doctor / Admin | Update emergency case status & assign doctor |

### Ambulance & Fleet Management (`/api/ambulance`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/ambulance/book` | Patient / Admin | Request an emergency ambulance |
| `GET` | `/api/ambulance/my` | Patient / Admin | View patient ambulance requests |
| `GET` | `/api/ambulance/requests` | Admin / Super Admin | List all active ambulance requests |
| `POST` | `/api/ambulance/fleet` | Admin / Super Admin | Add new ambulance vehicle to hospital fleet |
| `GET` | `/api/ambulance/fleet` | Admin / Super Admin | List hospital ambulance fleet vehicles |
| `PATCH` | `/api/ambulance/fleet/:id` | Admin / Super Admin | Update fleet vehicle details & status |
| `DELETE` | `/api/ambulance/fleet/:id` | Admin / Super Admin | Remove vehicle from hospital fleet |
| `PATCH` | `/api/ambulance/requests/:id/assign` | Admin / Super Admin | Assign fleet ambulance & doctor to request |
| `PATCH` | `/api/ambulance/requests/:id/location` | Admin / Super Admin | Update live ambulance coordinates & ETA |
| `PATCH` | `/api/ambulance/requests/:id/status` | Admin / Super Admin | Update dispatch status (`dispatched`, `arrived`, etc.) |

### AI Diagnostic Symptom Checker (`/api/ai`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/ai/symptom-checker` | Public | Submit symptom array & age for AI triage assessment |

### Payments & Invoicing (`/api/payment`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/payment/config` | Protected | Fetch Razorpay public key & mock mode flag |
| `GET` | `/api/payment/my` | Protected | Get transaction history for current user |
| `POST` | `/api/payment/create-order` | Patient / Admin | Create Razorpay order (or mock order fallback) |
| `POST` | `/api/payment/verify` | Patient / Admin | Verify Razorpay HMAC signature & complete payment |

### Insurance Claims (`/api/insurance`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/insurance/claims` | Patient / Admin | Submit new medical insurance claim |
| `GET` | `/api/insurance/my` | Protected | View user submitted insurance claims |
| `GET` | `/api/insurance` | Admin | List all hospital insurance claim submissions |
| `PATCH` | `/api/insurance/:id/review` | Admin | Review & approve/reject insurance claim with remarks |

### Doctor Portal (`/api/doctors`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/doctors/dashboard` | Doctor | Fetch doctor daily summary metrics & schedule |
| `GET` | `/api/doctors/appointments/priority` | Doctor | Get unified schedule merged with emergency triage |
| `PATCH` | `/api/doctors/emergencies/:id/take` | Doctor | Self-assign emergency case to doctor schedule |
| `PATCH` | `/api/doctors/emergencies/:id/resolve` | Doctor | Mark assigned emergency case as resolved |
| `GET` | `/api/doctors/patients` | Doctor | Search & list doctor patient consultation history |
| `GET` | `/api/doctors/prescriptions` | Doctor | Get doctor issued prescriptions |
| `POST` | `/api/doctors/prescriptions` | Doctor | Issue new digital prescription to patient |

### Patient Portal (`/api/user`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/user/dashboard` | Patient | Get patient portal summary, metrics & activity log |
| `GET` | `/api/user/profile` | Patient | Fetch profile details |
| `PATCH` | `/api/user/profile` | Patient | Update user profile details |
| `PATCH` | `/api/user/change-password` | Patient | Update patient account password |
| `DELETE` | `/api/user/account` | Patient | Soft-deactivate patient account |
| `GET` | `/api/user/medical-records` | Patient | View Electronic Health Records (EHR) |
| `POST` | `/api/user/medical-records` | Patient | Add medical record entry |
| `GET` | `/api/user/medical-records/:id/download` | Patient | Download text formatted medical record |
| `GET` | `/api/user/prescriptions` | Patient | Get patient digital prescriptions |
| `POST` | `/api/user/prescriptions/:id/refill-request` | Patient | Request prescription medicine refill |
| `GET` | `/api/user/billing` | Patient | View billing summary & unpaid balance statements |

### Admin & Super Admin Core (`/api/admin`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/admin/dashboard` | Admin / Super Admin | Get hospital operational metrics & summary |
| `POST` | `/api/admin/admins` | Admin / Super Admin | Onboard new sub-admin account |
| `POST` | `/api/admin/admins/pair` | Super Admin | Provision hospital Operational + Receptionist pair |
| `GET` | `/api/admin/admins` | Super Admin | List all registered hospital admin accounts |
| `POST` | `/api/admin/doctors` | Admin / Super Admin | Create & onboard doctor account |
| `GET` | `/api/admin/doctors` | Admin / Super Admin | List hospital doctors |
| `GET` | `/api/admin/patients` | Admin / Super Admin | List registered hospital patients |
| `GET` | `/api/admin/reports/analytics` | Admin / Super Admin | Generate comprehensive hospital analytics report |
| `GET` | `/api/admin/system-logs` | Super Admin | Audit system logs & activity events |

### Push Notifications (`/api/notifications`)

| Method | Endpoint Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/notifications/vapid-public-key` | Protected | Retrieve public VAPID key |
| `POST` | `/api/notifications/subscribe` | Protected | Save browser Web Push subscription |
| `POST` | `/api/notifications/unsubscribe` | Protected | Deactivate Web Push subscription |
| `POST` | `/api/notifications/test` | Protected | Send test push notification to user browser |
| `POST` | `/api/notifications/send` | Admin / Super Admin | Dispatch push notification to specific user |

---

## 🗄️ Database Models & Schema Design

```text
  ┌──────────────┐         ┌─────────────────┐         ┌────────────────┐
  │     User     │1       *│   Appointment   │*       1│      User      │
  │  (Patient)   ├─────────┤                 ├─────────┤    (Doctor)    │
  └──────┬───────┘         └─────────────────┘         └────────────────┘
         │1                                                     ▲
         │                                                      │
         ├─────────────────┐                                    │
        *│                 │*                                   │
  ┌──────▼───────┐  ┌──────▼────────┐                           │
  │  Emergency   │  │   Ambulance   ├───────────────────────────┘
  └──────────────┘  └───────────────┘
```

### Primary Schemas Overview

- **`User`**: Core user entity supporting roles (`patient`, `doctor`, `admin`, `super-admin`), hospital coordinates, doctor specializations, clinic addresses, and access levels (`full`, `operations`, `limited`, `receptionist`).
- **`Appointment`**: Consultation session tracking with token numbers, dates, consultation types (`in_person`, `video`), status lifecycle, doctor ratings (1-5 stars), and reviews.
- **`Emergency`**: Real-time triage cases with symptom tags, priority weighting (`low`, `medium`, `high`, `critical`), location text, status, and assigned doctor.
- **`Ambulance`**: Patient ambulance dispatch requests detailing pickup/destination coordinates, assigned driver, vehicle number, ETA in minutes, and assigned doctor status.
- **`AmbulanceFleet`**: Hospital ambulance fleet registry indexed by vehicle number and hospital affiliation.
- **`Payment`**: Razorpay transaction log tracking order IDs, payment IDs, signatures, amounts, currencies, and verification status (`created`, `verified`, `failed`).
- **`Insurance`**: Patient insurance claim submission with document URLs, claim amounts, review status, and admin remarks.
- **`MedicalRecord`**: Electronic Health Record (EHR) entries containing document URLs, notes, and record categories.
- **`Prescription`**: Digital prescription items listing dosage, frequency, instructions, status, next refill dates, and refill request counters.
- **`PushSubscription`**: Browser Web-Push subscription endpoints storing P256DH and Auth keys.

---

## 📲 Progressive Web App (PWA) & Push Notifications

ArogyaPlus is built with progressive enhancement, making it fully installable on desktop and mobile devices.

### Key PWA Assets
- **Web App Manifest**: [`ui/manifest.webmanifest`](file:///d:/ArogyaPlus/ui/manifest.webmanifest)
- **Service Worker**: [`ui/service-worker.js`](file:///d:/ArogyaPlus/ui/service-worker.js)
- **Offline Fallback Page**: [`ui/offline.html`](file:///d:/ArogyaPlus/ui/offline.html)

### How to Install on Mobile Devices (Android / iOS)
1. Open the application URL in **Google Chrome** or **Safari**.
2. Tap the browser menu (`⋮` or Share icon).
3. Select **"Add to Home Screen"** or **"Install App"**.
4. Launch ArogyaPlus as a native app directly from your home screen!

### Local HTTPS Testing with Ngrok
Web Push APIs and Service Workers require a secure context (`HTTPS` or `localhost`). For testing on physical mobile devices over local Wi-Fi:

```bash
npx ngrok http 3000
```

Access the generated `https://xxxx.ngrok-free.app` URL on your mobile browser.

---

## 🧪 Testing & Quality Assurance

ArogyaPlus features a comprehensive, isolated test suite powered by **Jest**, **Supertest**, and **MongoDB Memory Server**.

> [!NOTE]
> Tests run entirely against an in-memory MongoDB database—no active local MongoDB server is required to execute tests!

### Running Automated Test Suite

Execute all integration and unit tests:

```bash
npm test
```

### Test Coverage Highlights
- `tests/auth.test.js`: User registration, login validation, JWT issue, and duplicate account rejection.
- `tests/appointments.test.js`: Appointment slot booking, rescheduling, cancellation, and status transitions.
- `tests/emergency.test.js`: Priority triage queue updates and real-time broadcasting.
- `tests/modules.test.js`: Complete end-to-end testing of payments, insurance, EHR records, prescriptions, and ambulance dispatch workflows.

---

## 🔒 Production Deployment & Hardening

Before deploying ArogyaPlus to production environments (AWS, DigitalOcean, Heroku, or Render):

1. **Enforce Environment Variables**:
   - Set `NODE_ENV=production`.
   - Configure a strong, randomly generated `JWT_SECRET`.
   - Supply valid MongoDB Atlas production connection URI in `MONGO_URI`.
   - Provide live Razorpay credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
2. **Restrict CORS Security**:
   - Update `cors` configuration in [`index.js`](file:///d:/ArogyaPlus/index.js) to whitelist only your production domain instead of `*`.
3. **HTTPS Enforcement**:
   - Serve application traffic strictly behind an SSL/TLS proxy (e.g., NGINX, Cloudflare, or AWS ALB).
4. **Process Manager**:
   - Use `PM2` or Docker containers to ensure zero-downtime execution and automatic process restarts:
     ```bash
     npm install -g pm2
     pm2 start index.js --name "arogya-plus"
     ```

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute it as per the license terms.

---

<div align="center">

**Designed & Developed for Modern Digital Healthcare.**  
*Built with ❤️ by the Smart Health Team.*

</div>