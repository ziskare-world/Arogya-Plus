/* ==========================================================================
   ai-chat-widget.js - Floating AI Bot Circle & Universal Chat Panel
   Enhanced with In-Chat Operations, Direct Booking, Bed Telemetry,
   Nearest Hospital Discovery, Guest Local Storage, and In-Chat Auth Flow
   ========================================================================== */

import { apiRequest } from './api-client.js';

let widgetInitialized = false;
const GUEST_STORAGE_KEY = 'arogya_guest_chat_history';

export function initAiChatWidget() {
  if (window.__arogyaAiWidgetInitialized || widgetInitialized || document.getElementById('ai-bot-widget-wrapper')) {
    return;
  }

  window.__arogyaAiWidgetInitialized = true;
  widgetInitialized = true;

  // Ensure dashboard.css styles are loaded on public pages (index, login, register)
  if (!document.querySelector('link[href*="dashboard.css"]')) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/css/dashboard.css';
    document.head.appendChild(cssLink);
  }

  // Detect User Role & Portal Page (Doctor vs Patient)
  const userRaw = localStorage.getItem('smart_hospital_user') || sessionStorage.getItem('smart_hospital_user');
  let currentUser = null;
  try { currentUser = userRaw ? JSON.parse(userRaw) : null; } catch (e) {}
  const isDoctorPage = window.location.pathname.includes('/doctor');
  const isDoctor = (currentUser && currentUser.role === 'doctor') || isDoctorPage;

  const chatTitle = isDoctor ? 'Arogya Clinical Copilot' : 'Arogya AI Health Bot';
  const chatStatus = isDoctor ? 'Online • Doctor Clinical Automation' : 'Online • Medical Assistant';
  const headerClass = isDoctor ? 'ai-chat-header doctor-mode' : 'ai-chat-header';
  const welcomeIcon = isDoctor ? '👨‍⚕️' : '🩺';

  const isSuperAdmin = window.location.pathname.includes('/super-admin');

  let welcomeTitle;
  let welcomeDesc;
  if (isSuperAdmin) {
    welcomeTitle = 'Arogya AI Assistant';
    welcomeDesc = `🩺 Arogya AI Assistant<br>👋 Welcome to your Patient Dashboard, Super Admin!<br><br>Your Arogya AI Health Assistant is running and ready. You can:<br>• 📅 Book a doctor by chatting with me or picking specialists<br>• 🏥 Check live hospital beds & emergency services<br>• ✕ Close this chat anytime (click ✕) to continue manually!`;
  } else if (isDoctor) {
    welcomeTitle = `Welcome, ${currentUser?.name ? 'Dr. ' + currentUser.name : 'Doctor'}!`;
    welcomeDesc = 'Your Clinical Automation Copilot is ready. Ask for clinical guidance, patient queue, auto SOAP notes, bed telemetry, or type "help" for all available commands.';
  } else {
    welcomeTitle = 'Welcome to Arogya AI!';
    welcomeDesc = 'Hello! I am Arogya AI, your 24/7 intelligent healthcare companion. Type "hi" to learn about our platform and services, or type "help" to explore any feature.';
  }

  // Create Widget Container HTML
  const container = document.createElement('div');
  container.id = 'ai-bot-widget-wrapper';
  container.innerHTML = `
    <!-- Floating AI Bot Circle Trigger (Bottom-Right) -->
    <button id="ai-bot-trigger" class="ai-bot-trigger" aria-label="Open AI Health Assistant Chat" title="Chat with Arogya AI Assistant">
      <div class="ai-bot-icon-wrap">
        <svg class="ai-bot-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
          <rect x="4" y="8" width="16" height="12" rx="3"></rect>
          <circle cx="9" cy="13" r="1.5" fill="currentColor"></circle>
          <circle cx="15" cy="13" r="1.5" fill="currentColor"></circle>
          <path d="M9 17c1 1 3 1 4 0"></path>
          <path d="M2 14h2"></path>
          <path d="M20 14h2"></path>
        </svg>
      </div>
      <span class="ai-bot-pulse-ring"></span>
      <span class="ai-bot-badge">AI</span>
    </button>

    <!-- Floating Chat Panel Box (Anchored above circle) -->
    <div id="ai-chat-box" class="ai-chat-box hidden" aria-hidden="true">
      <!-- Header -->
      <div class="${headerClass}">
        <div class="ai-chat-header-info">
          <div class="ai-chat-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="8" width="16" height="12" rx="3"></rect>
              <circle cx="9" cy="13" r="1.5" fill="currentColor"></circle>
              <circle cx="15" cy="13" r="1.5" fill="currentColor"></circle>
              <path d="M9 17c1 1 3 1 4 0"></path>
            </svg>
          </div>
          <div>
            <div class="ai-chat-title">${chatTitle}</div>
            <div class="ai-chat-status"><span class="status-dot"></span> ${chatStatus}</div>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <!-- Expand / Minimize Screen Toggle Button -->
          <button id="ai-chat-expand-btn" class="ai-header-btn" title="Expand to Wide Screen" aria-label="Toggle screen size">
            <svg id="ai-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
            </svg>
            <svg id="ai-compress-icon" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"></path>
            </svg>
          </button>
          <button id="ai-chat-clear-btn" class="ai-header-btn" title="Clear Chat History">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <button id="ai-chat-close-btn" class="ai-header-btn" title="Minimize Panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <!-- Messages Body -->
      <div id="ai-chat-messages" class="ai-chat-messages">
        <div class="ai-welcome-banner">
          <div class="welcome-icon">${welcomeIcon}</div>
          <h4>${welcomeTitle}</h4>
          <p>${welcomeDesc}</p>
        </div>
      </div>

      <!-- Input Footer -->
      <form id="ai-chat-form" class="ai-chat-footer">
        <input id="ai-chat-input" type="text" placeholder="${isDoctor ? 'Type clinical query, patient symptoms for SOAP note, or bed status...' : 'Type health query, \'nearest hospital\', or book appointment...'}" autocomplete="off" />
        <button id="ai-chat-send" type="submit" aria-label="Send Message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2Z"></path></svg>
        </button>
      </form>
      <div class="ai-disclaimer">Informational AI Assistant. In emergency, call 108 or your hospital immediately.</div>
    </div>
  `;

  document.body.appendChild(container);

  // Setup Event Handlers
  const triggerBtn = document.getElementById('ai-bot-trigger');
  const chatBox = document.getElementById('ai-chat-box');
  const closeBtn = document.getElementById('ai-chat-close-btn');
  const clearBtn = document.getElementById('ai-chat-clear-btn');
  const expandBtn = document.getElementById('ai-chat-expand-btn');
  const expandIcon = document.getElementById('ai-expand-icon');
  const compressIcon = document.getElementById('ai-compress-icon');
  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = document.getElementById('ai-chat-input');
  const messagesContainer = document.getElementById('ai-chat-messages');

  let chatHistory = [];
  let isExpanded = localStorage.getItem('arogya_ai_expanded') === 'true';
  let guestTurnCount = 0;
  let guestAuthPromptShown = false;

  const applyExpandedState = (expanded) => {
    isExpanded = expanded;
    if (expanded) {
      chatBox.classList.add('expanded');
      expandIcon.style.display = 'none';
      compressIcon.style.display = 'block';
      expandBtn.title = 'Compress to Normal Size';
      localStorage.setItem('arogya_ai_expanded', 'true');
    } else {
      chatBox.classList.remove('expanded');
      expandIcon.style.display = 'block';
      compressIcon.style.display = 'none';
      expandBtn.title = 'Expand to Wide Screen';
      localStorage.setItem('arogya_ai_expanded', 'false');
    }
  };

  // Restore previous size preference
  if (isExpanded) {
    applyExpandedState(true);
  }

  const toggleExpand = (forcedState = null) => {
    const nextState = forcedState !== null ? forcedState : !chatBox.classList.contains('expanded');
    applyExpandedState(nextState);
  };

  expandBtn.addEventListener('click', () => toggleExpand());

  const toggleChat = () => {
    const isHidden = chatBox.classList.contains('hidden');
    if (isHidden) {
      chatBox.classList.remove('hidden');
      chatBox.setAttribute('aria-hidden', 'false');
      chatInput.focus();
    } else {
      chatBox.classList.add('hidden');
      chatBox.setAttribute('aria-hidden', 'true');
    }
  };

  triggerBtn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

  // Save guest chats locally in Chrome localStorage
  const persistGuestChat = () => {
    const token = localStorage.getItem('smart_hospital_token');
    if (!token) {
      try {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(chatHistory.slice(-20)));
      } catch (e) {
        // Storage limit protection
      }
    }
  };

  // Format text and strip any internal model/agent names
  const formatText = (text = '') => {
    return String(text)
      .replace(/Qwen3-30B-A3B|Qwen3-14B|Qwen3|Qwen|qwen/g, 'Arogya AI')
      .replace(/TalkingAgent\+TriageAgent|TalkingAgent|AppointmentAgent|ClinicalNotesAgent|HospitalOperationsAgent/g, 'Arogya Clinical Assistant')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  };

  const appendUserMessage = (text, scroll = true) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg user-msg';
    msgDiv.innerHTML = `<div class="msg-bubble">${formatText(text)}</div>`;
    messagesContainer.appendChild(msgDiv);
    if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const showTypingIndicator = () => {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.className = 'ai-msg bot-msg';
    typingDiv.innerHTML = `
      <div class="msg-bubble typing">
        <span></span><span></span><span></span>
      </div>`;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const removeTypingIndicator = () => {
    const indicator = document.getElementById('ai-typing-indicator');
    if (indicator) indicator.remove();
  };

  // 1. Render Doctor Cards right inside the chat window
  const renderDoctorCards = (doctors = []) => {
    if (!doctors || !doctors.length) {
      return '<div class="muted" style="padding:10px;font-size:0.8rem">No doctors currently available in this specialty.</div>';
    }

    const cardsHtml = doctors.map(doc => {
      const name = doc.name || 'Doctor';
      const spec = doc.specialization || 'General Physician';
      const hospital = doc.hospitalName || doc.clinicAddress || 'City Medical Hospital';
      const exp = doc.experienceYears ? `${doc.experienceYears}+ Yrs Exp` : 'Verified';
      const rating = doc.rating ? `⭐ ${Number(doc.rating).toFixed(1)}` : '⭐ 4.9';
      const docId = doc._id || doc.id || '';

      return `
        <div class="ai-doctor-card" data-doc-id="${docId}">
          <div>
            <div class="ai-doc-header">
              <div class="ai-doc-avatar">DR</div>
              <div>
                <div class="ai-doc-name">${name}</div>
                <div class="ai-doc-spec">🩺 ${spec}</div>
              </div>
            </div>
            <div class="ai-doc-meta">
              <span>🏥 ${hospital}</span>
              <span>${rating} • ${exp}</span>
            </div>
            <div style="margin-bottom:8px">
              <span class="ai-doc-badge ai-doc-badge-green">🟢 Available for Consultation</span>
            </div>
          </div>
          <button type="button" class="ai-doc-book-btn" data-action="in-chat-book" data-doc-id="${docId}" data-doc-name="${name}" data-doc-spec="${spec}">
            📅 Book Appointment
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="ai-doctor-explorer-wrap" style="width:100%;margin-top:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:700;font-size:0.82rem;color:var(--text-1,#0f172a)">Verified Doctors (${doctors.length})</span>
          <button type="button" class="ai-pill" style="padding:2px 8px;font-size:0.7rem;" data-action="toggle-expand">⛶ ${isExpanded ? 'Normal' : 'Expand'}</button>
        </div>
        <div class="ai-doctor-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  };

  // 2. Render Live Hospital Operations Card right inside the chat
  const renderOperationsCard = (ops) => {
    if (!ops || !ops.metrics) return '';
    return `
      <div class="ai-interactive-card">
        <div class="ai-card-title">
          <span>🏥 Live Hospital Telemetry</span>
          <span class="badge ${ops.systemLoad === 'Critical Surge' ? 'badge-red' : 'badge-green'}">${ops.systemLoad || 'Normal Operations'}</span>
        </div>
        <div class="ai-telemetry-grid">
          <div class="ai-telemetry-item">
            <span class="ai-telemetry-label">Bed Occupancy</span>
            <span class="ai-telemetry-val">${ops.metrics.occupancyRate || '65%'}</span>
            <span style="font-size:0.68rem;color:#64748b">${ops.metrics.availableBeds} of ${ops.metrics.totalBeds} Free</span>
          </div>
          <div class="ai-telemetry-item">
            <span class="ai-telemetry-label">ER Queue</span>
            <span class="ai-telemetry-val" style="color:#dc2626">${ops.metrics.activeEmergencies || 0} Critical</span>
            <span style="font-size:0.68rem;color:#64748b">Immediate Triage</span>
          </div>
          <div class="ai-telemetry-item">
            <span class="ai-telemetry-label">108 Ambulances</span>
            <span class="ai-telemetry-val" style="color:#16a34a">${ops.metrics.availableAmbulances || 4} Ready</span>
            <span style="font-size:0.68rem;color:#64748b">On Standby</span>
          </div>
          <div class="ai-telemetry-item">
            <span class="ai-telemetry-label">Hospital Units</span>
            <span class="ai-telemetry-val">${ops.hospitalCount || 1} Active</span>
            <span style="font-size:0.68rem;color:#64748b">Verified Center</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-sm btn-blue ai-action-btn" data-action="explore-doctors">🩺 View Specialists</button>
          <button type="button" class="btn btn-sm btn-outline ai-action-btn" data-action="nearest-hospital">🏥 Nearest Hospital & Beds</button>
          <button type="button" class="btn btn-sm btn-red ai-action-btn" data-action="in-chat-sos">🚨 Request 108 Ambulance</button>
        </div>
      </div>
    `;
  };

  // 3. Render Interactive In-Chat Appointment Booking Form Card
  const renderBookingFormCard = (details = {}) => {
    const docName = details.recommendedDoctor?.name || 'Dr. Priya Sharma';
    const docId = details.recommendedDoctor?.id || details.recommendedDoctor?._id || '';
    const dept = details.department || 'General Medicine';
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    return `
      <div class="ai-interactive-card" id="ai-booking-form-box">
        <div class="ai-card-title">
          <span>📅 Direct Appointment Booking</span>
          <span class="badge badge-blue">Interactive</span>
        </div>
        <div style="font-size:0.82rem;margin-bottom:8px;color:#1e293b">
          Physician: <strong>${docName}</strong> (${dept})
        </div>
        <div class="ai-form-group">
          <label class="ai-form-label">Consultation Date</label>
          <input type="date" class="ai-form-input" id="ai-book-date" value="${tomorrow}" min="${new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="ai-form-group">
          <label class="ai-form-label">Available Time Slots</label>
          <div class="ai-slot-pills" id="ai-slot-pills">
            <button type="button" class="ai-slot-pill active" data-slot="10:00 AM">10:00 AM</button>
            <button type="button" class="ai-slot-pill" data-slot="11:30 AM">11:30 AM</button>
            <button type="button" class="ai-slot-pill" data-slot="02:00 PM">02:00 PM</button>
            <button type="button" class="ai-slot-pill" data-slot="04:30 PM">04:30 PM</button>
            <button type="button" class="ai-slot-pill" data-slot="06:00 PM">06:00 PM</button>
          </div>
        </div>
        <div class="ai-form-group">
          <label class="ai-form-label">Reason / Symptoms</label>
          <input type="text" class="ai-form-input" id="ai-book-reason" placeholder="e.g. Regular medical checkup or headache" value="Clinical consultation" />
        </div>
        <button type="button" class="ai-doc-book-btn" id="ai-btn-confirm-appointment" data-doc-id="${docId}" data-doc-name="${docName}">
          ✅ Confirm & Book Appointment
        </button>
      </div>
    `;
  };

  // 4. Render Emergency SOS Dispatch Card
  const renderEmergencySOSCard = () => {
    return `
      <div class="ai-sos-card" id="ai-sos-box">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:800;color:#dc2626;font-size:0.92rem">🚨 EMERGENCY 108 AMBULANCE DISPATCH</span>
          <span class="badge badge-red">CRITICAL</span>
        </div>
        <p style="font-size:0.78rem;color:#7f1d1d;margin:0 0 8px">
          Acute medical distress detected. Confirm pickup details to dispatch the nearest emergency ambulance team immediately:
        </p>
        <div class="ai-form-group">
          <label class="ai-form-label" style="color:#991b1b">Pickup Address / Location</label>
          <input type="text" class="ai-form-input" id="ai-sos-location" placeholder="Street address or nearest landmark" value="Current User Location (Hospital Vicinity)" />
        </div>
        <div class="ai-form-group">
          <label class="ai-form-label" style="color:#991b1b">Emergency Contact Phone</label>
          <input type="tel" class="ai-form-input" id="ai-sos-phone" placeholder="Contact number" value="9999999999" />
        </div>
        <button type="button" class="ai-sos-btn" id="ai-btn-dispatch-sos">
          🚨 Dispatch 108 Ambulance Now
        </button>
      </div>
    `;
  };

  // 5. Render In-Chat Prescriptions
  const renderPrescriptionsCard = (prescriptions = []) => {
    if (!prescriptions || !prescriptions.length) {
      return '';
    }
    const rxHtml = prescriptions.map(rx => `
      <div class="ai-rx-item">
        <div style="display:flex;justify-content:space-between">
          <span class="ai-rx-name">💊 ${rx.medicineName || 'Medication'}</span>
          <span class="badge badge-green" style="font-size:0.65rem">${rx.status || 'Active'}</span>
        </div>
        <div class="ai-rx-dose"><strong>Dosage:</strong> ${rx.dosage || 'As prescribed'} • ${rx.frequency || 'Daily'}</div>
        <div style="font-size:0.7rem;color:#64748b;margin-top:2px">Prescribed by: ${rx.doctor?.name || 'Hospital Physician'}</div>
      </div>
    `).join('');

    return `
      <div class="ai-interactive-card">
        <div class="ai-card-title">
          <span>📋 Your Active Prescriptions (${prescriptions.length})</span>
          <a href="/user/prescriptions.html" class="btn btn-sm btn-outline" style="font-size:0.7rem;padding:2px 6px">Full EHR ↗</a>
        </div>
        ${rxHtml}
      </div>
    `;
  };

  // 6. Render Nearest Hospital & Live Bed Occupancy Card
  const renderNearestHospitalCard = (hospital) => {
    if (!hospital) return '';
    const beds = hospital.beds || {};
    const total = beds.total || hospital.totalBeds || 100;
    const available = beds.available !== undefined ? beds.available : (hospital.availableBeds || 50);
    const occupied = beds.occupied !== undefined ? beds.occupied : (hospital.occupiedBeds || 50);
    const icuAvail = beds.icu?.available !== undefined ? beds.icu.available : (hospital.icuBeds?.available || 6);
    const oxygenAvail = beds.oxygen?.available !== undefined ? beds.oxygen.available : (hospital.oxygenBeds?.available || 12);
    const isBedCrit = available < 10;
    const hospDisplayName = String(hospital.name || 'Hospital').replace(/_/g, ' ');

    const docs = hospital.doctors || [];
    let doctorsHtml = '';
    if (docs.length > 0) {
      const docItems = docs.map(doc => {
        const rawName = String(doc.name || 'Physician');
        const docName = rawName.toLowerCase().startsWith('dr') ? rawName : `Dr. ${rawName}`;
        const spec = doc.specialization || 'Consultant Specialist';
        const exp = doc.experienceYears ? `${doc.experienceYears}+ Yrs Experience` : 'Verified Physician';
        const phone = doc.phone ? ` • 📞 ${doc.phone}` : '';
        const docId = doc._id || doc.id || '';

        return `
          <div class="ai-hosp-doctor-row" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;margin-top:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-weight:700;font-size:0.85rem;color:#0f172a">👨‍⚕️ ${docName}</div>
              <div style="font-size:0.75rem;color:#2563eb;font-weight:600">🩺 ${spec} <span style="color:#64748b;font-weight:400">(${exp}${phone})</span></div>
            </div>
            <button type="button" class="btn btn-sm btn-blue ai-action-btn" style="padding:4px 10px;font-size:0.75rem" data-action="in-chat-book" data-doc-id="${docId}" data-doc-name="${docName}" data-doc-spec="${spec}">
              📅 Book Consultation
            </button>
          </div>
        `;
      }).join('');

      doctorsHtml = `
        <div style="margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:8px">
          <div style="font-size:0.82rem;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span>👨‍⚕️ Doctors Assigned Under This Hospital (${docs.length}):</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${docItems}
          </div>
        </div>
      `;
    } else {
      doctorsHtml = `
        <div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:6px;font-size:0.75rem;color:#64748b">
          ℹ️ No doctors currently registered under this hospital.
        </div>
      `;
    }

    return `
      <div class="ai-hospital-card">
        <div class="ai-hospital-header">
          <div>
            <div class="ai-hospital-name">🏥 ${hospDisplayName}</div>
            <div style="font-size:0.75rem;color:#2563eb;font-weight:600">${hospital.specialty || 'Emergency & Trauma Care'}</div>
          </div>
          <span class="ai-hospital-dist-tag">📍 ${hospital.distanceKm !== undefined ? hospital.distanceKm + ' km' : 'Verified'} • ETA: ~${hospital.etaMinutes || 8} min</span>
        </div>
        <div class="ai-hospital-meta">
          <div>📍 ${hospital.address || hospital.city || 'Central Healthcare District'}</div>
          <div>📞 Contact: <strong>${hospital.phone || '+91-11-23456789'}</strong> | ⭐ ${hospital.rating || '4.8'}</div>
        </div>

        <div style="font-size:0.75rem;font-weight:700;color:#0f172a;margin-top:6px">Live Bed Occupancy & Capacity:</div>
        <div class="ai-bed-stat-grid">
          <div class="ai-bed-stat-box">
            <span class="ai-bed-stat-label">Total Beds</span>
            <span class="ai-bed-stat-val">${total}</span>
          </div>
          <div class="ai-bed-stat-box">
            <span class="ai-bed-stat-label">Available</span>
            <span class="ai-bed-stat-val ${isBedCrit ? 'critical' : 'available'}">${available}</span>
          </div>
          <div class="ai-bed-stat-box">
            <span class="ai-bed-stat-label">Occupied</span>
            <span class="ai-bed-stat-val">${occupied}</span>
          </div>
          <div class="ai-bed-stat-box">
            <span class="ai-bed-stat-label">ICU Free</span>
            <span class="ai-bed-stat-val available">${icuAvail}</span>
          </div>
          <div class="ai-bed-stat-box">
            <span class="ai-bed-stat-label">O2 Free</span>
            <span class="ai-bed-stat-val available">${oxygenAvail}</span>
          </div>
          <div class="ai-bed-stat-box">
            <span class="ai-bed-stat-label">Ambulance</span>
            <span class="ai-bed-stat-val available" style="font-size:0.72rem">108 READY</span>
          </div>
        </div>

        ${doctorsHtml}

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          <button type="button" class="btn btn-sm btn-red ai-action-btn" data-action="in-chat-sos">🚨 Request 108 Ambulance</button>
          <a href="tel:${hospital.phone || '108'}" class="btn btn-sm btn-outline ai-action-btn">📞 Call Hospital</a>
          <button type="button" class="btn btn-sm btn-blue ai-action-btn" data-action="explore-doctors">🩺 View Specialists</button>
        </div>
      </div>
    `;
  };

  // 7. Render In-Chat Prolonged Guest Auth Prompt Card
  const renderGuestAuthPromptCard = () => {
    return `
      <div class="ai-guest-auth-prompt" id="ai-guest-auth-prompt">
        <h5>🔐 Save Your Consultation & Unlock Patient Profile</h5>
        <p>You've had an active consultation session. Sign in or create an account to permanently sync your medical history, book specialist consultations, and access patient health records.</p>
        <div class="ai-prompt-btn-group">
          <button type="button" class="btn btn-sm btn-blue ai-action-btn" data-action="open-in-chat-login">🔑 Sign In in Chat</button>
          <button type="button" class="btn btn-sm btn-outline ai-action-btn" data-action="open-in-chat-register">✨ Create Free Account</button>
          <a href="/login.html" class="btn btn-sm btn-outline ai-action-btn" target="_blank">Open Full Login Page ↗</a>
        </div>
      </div>
    `;
  };

  // 8. Render In-Chat Login Form
  const renderInChatLoginForm = () => {
    return `
      <div class="ai-auth-form-card" id="ai-in-chat-login-box">
        <h5>🔑 Sign In to Arogya Plus</h5>
        <div class="ai-auth-input-group">
          <label>Email Address</label>
          <input type="email" class="ai-auth-input" id="ai-login-email" placeholder="patient@example.com" />
        </div>
        <div class="ai-auth-input-group">
          <label>Password</label>
          <input type="password" class="ai-auth-input" id="ai-login-password" placeholder="••••••••" />
        </div>
        <button type="button" class="ai-auth-submit-btn" id="ai-btn-submit-login">Sign In & Continue Booking</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:0.74rem">
          <span class="ai-auth-toggle-link" data-action="open-in-chat-register" style="margin:0">Create Free Account</span>
          <a href="/login.html" style="color:#64748b;text-decoration:underline">Full Login Page ↗</a>
        </div>
      </div>
    `;
  };

  // 9. Render In-Chat Registration Form
  const renderInChatRegisterForm = () => {
    return `
      <div class="ai-auth-form-card" id="ai-in-chat-register-box">
        <h5>✨ Create Patient Account</h5>
        <div class="ai-auth-input-group">
          <label>Full Name</label>
          <input type="text" class="ai-auth-input" id="ai-reg-name" placeholder="John Doe" />
        </div>
        <div class="ai-auth-input-group">
          <label>Email Address</label>
          <input type="email" class="ai-auth-input" id="ai-reg-email" placeholder="john@example.com" />
        </div>
        <div class="ai-auth-input-group">
          <label>Mobile Number</label>
          <input type="tel" class="ai-auth-input" id="ai-reg-phone" placeholder="9876543210" />
        </div>
        <div class="ai-auth-input-group">
          <label>Password (min 6 characters)</label>
          <input type="password" class="ai-auth-input" id="ai-reg-password" placeholder="••••••••" />
        </div>
        <button type="button" class="ai-auth-submit-btn" id="ai-btn-submit-register">Create Account & Continue Booking</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:0.74rem">
          <span class="ai-auth-toggle-link" data-action="open-in-chat-login" style="margin:0">Already have account? Sign In</span>
          <a href="/register.html" style="color:#64748b;text-decoration:underline">Full Register Page ↗</a>
        </div>
      </div>
    `;
  };

  // 10. Render Doctor Clinical SOAP Note Tool Card
  const renderSoapGeneratorCard = (patientName = '', initialNotes = '') => {
    return `
      <div class="ai-soap-generator-card" id="ai-soap-tool-box">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:800;font-size:0.86rem;color:#0369a1">📝 AI Clinical SOAP Note Synthesis</span>
          <span class="badge badge-blue">Clinical Copilot</span>
        </div>
        ${patientName ? `<div style="font-size:0.78rem;font-weight:700;color:#0f172a;margin-bottom:6px">Patient: <strong>${patientName}</strong></div>` : ''}
        <div class="ai-form-group" style="margin-bottom:8px">
          <label class="ai-form-label" style="font-size:0.72rem;color:#475569">Clinical Observations, Exam Findings & Vitals</label>
          <textarea class="ai-soap-textarea" id="ai-soap-input-text" placeholder="e.g. 45yo male, complaints of acute fever (102F), dry cough x3 days. Throat mildly erythematous, chest clear, BP 120/80, pulse 84.">${initialNotes ? 'Chief Complaint: ' + initialNotes + '. ' : ''}</textarea>
        </div>
        <button type="button" class="btn btn-sm btn-blue ai-action-btn" id="ai-btn-generate-soap" style="width:100%;padding:8px;font-weight:700">
          ⚡ Generate Structured SOAP Note
        </button>
        <div id="ai-soap-result-area" style="display:none;margin-top:10px"></div>
      </div>
    `;
  };

  const displaySoapGeneratorInChat = (patientName = '', initialNotes = '') => {
    appendBotMessage(
      `📝 **AI Clinical SOAP Note Generator**\nEnter shorthand patient observations or examination findings below to synthesize structured medical documentation:`,
      null,
      'normal',
      'Arogya Clinical Copilot'
    );
    const div = document.createElement('div');
    div.className = 'ai-msg bot-msg';
    div.innerHTML = `<div class="msg-bubble">${renderSoapGeneratorCard(patientName, initialNotes)}</div>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  let isFetchingDoctorQueue = false;
  const displayDoctorQueueInChat = async () => {
    if (isFetchingDoctorQueue) return;
    isFetchingDoctorQueue = true;
    const token = localStorage.getItem('smart_hospital_token') || sessionStorage.getItem('smart_hospital_token');
    if (!token) {
      appendBotMessage("🔐 Please sign in with your doctor credentials below to access your patient consultation queue:");
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${renderInChatLoginForm()}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      isFetchingDoctorQueue = false;
      return;
    }

    showTypingIndicator();
    try {
      const data = await apiRequest('/api/doctors/appointments/me');
      removeTypingIndicator();
      const appointments = data.appointments || [];

      if (!appointments.length) {
        appendBotMessage("📋 **Your Patient Queue:**\n\nYou currently have no scheduled consultations in your queue for today. Your schedule is clear!");
        return;
      }

      const rows = appointments.slice(0, 10).map((appt, idx) => {
        const pName = appt.patient?.name || 'Patient';
        const tokenNum = appt.tokenNumber || `#TKN-${idx + 1}`;
        const time = appt.timeSlot || 'Scheduled';
        const dateStr = new Date(appt.appointmentDate).toLocaleDateString();
        const status = appt.status || 'confirmed';
        const symptoms = appt.symptoms || 'General clinical consultation';

        return `
          <div class="ai-queue-patient-row">
            <div>
              <div style="font-weight:700;font-size:0.84rem;color:#0f172a">${pName} <span class="badge badge-blue" style="font-size:0.68rem">${tokenNum}</span></div>
              <div style="font-size:0.75rem;color:#64748b">📅 ${dateStr} at ${time} • <span class="badge ${status === 'confirmed' ? 'badge-green' : 'badge-yellow'}">${status}</span></div>
              <div style="font-size:0.72rem;color:#475569;margin-top:2px">Reason: ${symptoms}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button type="button" class="btn btn-sm btn-blue ai-action-btn" data-action="doctor-start-soap" data-patient-name="${pName}" data-patient-symptoms="${symptoms.replace(/"/g, '&quot;')}">
                📝 SOAP Note
              </button>
            </div>
          </div>
        `;
      }).join('');

      const cardHtml = `
        <div class="ai-doctor-queue-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-weight:800;font-size:0.88rem;color:#0f172a">📋 Active Patient Queue (${appointments.length})</span>
            <a href="/doctor/appointments.html" class="btn btn-sm btn-outline" style="font-size:0.7rem;padding:2px 8px">Full Schedule ↗</a>
          </div>
          ${rows}
        </div>
      `;

      appendBotMessage(
        `Here is your **upcoming patient appointment queue**. You can generate an automated clinical SOAP note for any patient below:`,
        null,
        'normal',
        'Arogya Clinical Copilot'
      );
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${cardHtml}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (err) {
      removeTypingIndicator();
      appendBotMessage(`⚠️ Unable to fetch patient queue: ${err.message || 'Please check connection'}`);
    } finally {
      isFetchingDoctorQueue = false;
    }
  };

  const displayDoctorRxHelpInChat = () => {
    appendBotMessage(
      `💊 **Doctor Rx & Formulation Assistant:**\n\nI can assist you with:\n• Therapeutic medication dosing guidelines (e.g. Antibiotics, Antipyretics, Antihypertensives)\n• Renal & hepatic dosing adjustments\n• Identifying contraindications and adverse drug interactions\n• Discharge instructions & patient compliance counseling\n\nType your clinical question (e.g. *"Pediatric dose for Paracetamol 15kg"* or *"Check interaction between Clopidogrel and Omeprazole"*).`,
      null,
      'normal',
      'Arogya Clinical Copilot'
    );
  };

  // Guest self-learning memory tracker in localStorage
  const recordGuestLearning = (userMsg, botReply, intent) => {
    const token = localStorage.getItem('smart_hospital_token');
    if (token) return; // Authenticated users learn directly in DB
    try {
      const existing = JSON.parse(localStorage.getItem('arogya_guest_learning_profile') || '{}');
      const text = String(userMsg).toLowerCase();

      // Track topics
      const topics = existing.topics || [];
      if (text.includes('appointment') || text.includes('doctor') || text.includes('book')) topics.push('appointments');
      if (text.includes('hospital') || text.includes('bed')) topics.push('hospitals');
      if (text.includes('ambulance') || text.includes('sos')) topics.push('emergency');
      if (text.includes('prescription') || text.includes('medicine')) topics.push('prescriptions');

      existing.topics = [...new Set(topics)];
      existing.lastQuery = userMsg;
      existing.lastIntent = intent;
      existing.interactionCount = (existing.interactionCount || 0) + 1;
      existing.updatedAt = new Date().toISOString();

      localStorage.setItem('arogya_guest_learning_profile', JSON.stringify(existing));
    } catch (e) {
      // LocalStorage non-blocking
    }
  };

  const appendBotMessage = (reply, action = null, triageLevel = 'normal', agent = null, doctors = null, operations = null, bookingRecommendation = null, prescriptions = null, scroll = true, hospital = null, suggestions = null) => {
    removeTypingIndicator();

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg bot-msg ${triageLevel === 'critical' ? 'critical-alert' : ''}`;

    let actionBtnHtml = '';
    if (action && action.label) {
      if (action.type === 'explore_doctors' || action.label.toLowerCase().includes('explore doctor')) {
        actionBtnHtml = `
          <div class="ai-action-wrap">
            <button type="button" class="btn btn-sm btn-blue ai-action-btn" data-action="explore-doctors">
              ${action.label}
            </button>
          </div>
        `;
      } else if (action.href) {
        actionBtnHtml = `
          <div class="ai-action-wrap">
            <a href="${action.href}" class="btn btn-sm ${action.variant === 'danger' ? 'btn-red' : 'btn-blue'} ai-action-btn" target="_blank">
              ${action.label} ↗
            </a>
          </div>
        `;
      }
    }

    let doctorListHtml = doctors && doctors.length ? renderDoctorCards(doctors) : '';
    let operationsHtml = operations ? renderOperationsCard(operations) : '';
    let bookingHtml = bookingRecommendation ? renderBookingFormCard(bookingRecommendation) : '';
    let emergencyHtml = triageLevel === 'critical' ? renderEmergencySOSCard() : '';
    let prescriptionsHtml = prescriptions && prescriptions.length ? renderPrescriptionsCard(prescriptions) : '';
    let hospitalHtml = hospital ? renderNearestHospitalCard(hospital) : '';

    // Render Dynamic Context-Aware Suggestion Chips only when provided
    let suggestionsHtml = '';
    if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
      const chips = suggestions.map(s => {
        if (s.action) {
          return `<button type="button" class="ai-pill" data-action="${s.action}">${s.label}</button>`;
        }
        if (s.prompt) {
          return `<button type="button" class="ai-pill" data-prompt="${s.prompt.replace(/"/g, '&quot;')}">${s.label}</button>`;
        }
        return '';
      }).join('');

      if (chips) {
        suggestionsHtml = `
          <div class="ai-quick-pills" style="margin-top:10px;padding-top:6px;border-top:1px dashed #e2e8f0">
            ${chips}
          </div>
        `;
      }
    }

    const agentBadge = `<div class="ai-agent-badge" style="font-size: 0.72rem; opacity: 0.85; margin-bottom: 4px; font-weight: 700; color:#2563eb">🩺 Arogya AI Assistant</div>`;

    msgDiv.innerHTML = `
      <div class="msg-bubble">
        ${agentBadge}
        ${formatText(reply)}
        ${hospitalHtml}
        ${operationsHtml}
        ${bookingHtml}
        ${emergencyHtml}
        ${prescriptionsHtml}
        ${doctorListHtml}
        ${actionBtnHtml}
        ${suggestionsHtml}
      </div>
    `;

    messagesContainer.appendChild(msgDiv);
    if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  let isFetchingDoctors = false;
  // Fetch doctors and display them directly inside the chat
  const displayDoctorsInChat = async () => {
    if (isFetchingDoctors) return;
    isFetchingDoctors = true;
    showTypingIndicator();
    try {
      const data = await apiRequest('/api/auth/doctors');
      const docs = data.doctors || [];
      removeTypingIndicator();

      if (!docs.length) {
        appendBotMessage("I couldn't locate any active doctors right now. Please try again in a moment.");
        return;
      }

      appendBotMessage(
        `Here is our list of **${docs.length} verified specialists** available across departments. You can schedule an appointment directly below:`,
        null,
        'normal',
        'Arogya AI Assistant',
        docs
      );
    } catch (err) {
      removeTypingIndicator();
      appendBotMessage(`⚠️ Unable to fetch doctors list: ${err.message || 'Please check connection'}`);
    } finally {
      isFetchingDoctors = false;
    }
  };

  let isFetchingHospital = false;
  // Fetch nearest hospital from user location and show live beds & assigned doctors
  const displayNearestHospitalInChat = async (userLat = null, userLng = null) => {
    if (isFetchingHospital) return;
    isFetchingHospital = true;
    showTypingIndicator();
    let lat = userLat;
    let lng = userLng;

    if (!lat || !lng) {
      try {
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("Geolocation unsupported"));
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3500 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (geoErr) {
        // Fallback default coordinates (Gunupur, Odisha or facility location)
        lat = 19.0715;
        lng = 83.8095;
      }
    }

    try {
      const data = await apiRequest(`/api/map/nearest-hospital?lat=${lat}&lng=${lng}`);
      removeTypingIndicator();

      if (data.success && data.nearestHospital) {
        appendBotMessage(
          `Here is the **hospital** from our database with live bed capacity, emergency ambulance fleet, and assigned specialist doctors:`,
          null,
          'normal',
          'Arogya AI Assistant',
          null,
          null,
          null,
          null,
          true,
          data.nearestHospital
        );
      } else {
        appendBotMessage("⚠️ Could not retrieve nearest hospital details. Please check connection.");
      }
    } catch (err) {
      removeTypingIndicator();
      appendBotMessage(`⚠️ Unable to locate nearest hospital: ${err.message || 'Service offline'}`);
    } finally {
      isFetchingHospital = false;
    }
  };

  // Expose global explorer so buttons anywhere on the platform can open it
  window.openAiDoctorExplorer = () => {
    if (chatBox.classList.contains('hidden')) {
      toggleChat();
    }
    toggleExpand(true);
    displayDoctorsInChat();
  };

  window.openAiNearestHospital = () => {
    if (chatBox.classList.contains('hidden')) {
      toggleChat();
    }
    displayNearestHospitalInChat();
  };

  // Execute in-chat Login
  const executeInChatLogin = async (email, password, containerBox) => {
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    const btn = containerBox.querySelector('#ai-btn-submit-login');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Authenticating...';
    }

    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.token && res.user) {
        localStorage.setItem('smart_hospital_token', res.token);
        localStorage.setItem('smart_hospital_user', JSON.stringify(res.user));
        try {
          localStorage.setItem('arogya_ai_auto_open', 'true');
        } catch (e) {}

        // Sync local guest history into newly authenticated user's DB record
        const guestHistory = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) || '[]');
        if (guestHistory.length > 0) {
          try {
            await apiRequest('/api/ai/sync-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ history: guestHistory })
            });
            localStorage.removeItem(GUEST_STORAGE_KEY);
          } catch (syncErr) {
            console.warn('Sync history warning:', syncErr);
          }
        }

        const role = res.user.role || 'user';
        const dashboardUrl = role === 'admin' ? '/admin/dashboard.html' : role === 'doctor' ? '/doctor/dashboard.html' : role === 'super-admin' ? '/super-admin/dashboard.html' : '/user/dashboard.html';

        containerBox.innerHTML = `
          <div class="ai-confirmed-pass" style="background:#f0fdf4;border-color:#86efac">
            <div class="ai-pass-header">
              <span style="font-weight:800;color:#166534">🎉 Welcome back, ${res.user.name || 'User'}!</span>
              <span class="ai-pass-token" style="background:#16a34a">AUTHENTICATED</span>
            </div>
            <p style="font-size:0.8rem;color:#15803d;margin:4px 0 6px">Sign in successful. Opening your dashboard with Arogya AI active...</p>
          </div>
        `;

        // Directly open dashboard with AI assistant running
        setTimeout(() => {
          window.location.href = dashboardUrl;
        }, 400);
      } else {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Sign In & Continue Booking';
        }
        alert(res.message || 'Login failed. Please verify credentials.');
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sign In & Continue Booking';
      }
      alert('Login error: ' + (err.message || 'Please try again.'));
    }
  };

  // Execute in-chat Register
  const executeInChatRegister = async (name, email, phone, password, containerBox) => {
    if (!name || !email || !password) {
      alert("Please fill in Name, Email, and Password.");
      return;
    }

    const btn = containerBox.querySelector('#ai-btn-submit-register');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Creating Account...';
    }

    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || '9876543210', password, role: 'patient' })
      });

      if (res.token && res.user) {
        localStorage.setItem('smart_hospital_token', res.token);
        localStorage.setItem('smart_hospital_user', JSON.stringify(res.user));
        try {
          localStorage.setItem('arogya_ai_auto_open', 'true');
        } catch (e) {}

        const guestHistory = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) || '[]');
        if (guestHistory.length > 0) {
          try {
            await apiRequest('/api/ai/sync-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ history: guestHistory })
            });
            localStorage.removeItem(GUEST_STORAGE_KEY);
          } catch (syncErr) {
            console.warn('Sync history warning:', syncErr);
          }
        }

        containerBox.innerHTML = `
          <div class="ai-confirmed-pass" style="background:#f0fdf4;border-color:#86efac">
            <div class="ai-pass-header">
              <span style="font-weight:800;color:#166534">🎉 Account Created Successfully!</span>
              <span class="ai-pass-token" style="background:#16a34a">PATIENT VERIFIED</span>
            </div>
            <p style="font-size:0.8rem;color:#15803d;margin:4px 0 6px">Welcome, <strong>${res.user.name}</strong>! Opening your dashboard with Arogya AI active...</p>
          </div>
        `;

        // Directly open dashboard with AI assistant running
        setTimeout(() => {
          window.location.href = '/user/dashboard.html';
        }, 400);
      } else {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Create Account & Continue Booking';
        }
        alert(res.message || 'Registration failed. Please check your details.');
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create Account & Continue Booking';
      }
      alert('Registration error: ' + (err.message || 'Please try again.'));
    }
  };

  let isSendingMessage = false;
  const sendMessage = async (text) => {
    if (isSendingMessage || !text || !text.trim()) return;
    isSendingMessage = true;

    appendUserMessage(text);
    chatHistory.push({ role: 'user', content: text });
    persistGuestChat();
    chatInput.value = '';
    chatInput.disabled = true;

    const lowerText = text.trim().toLowerCase();
    const token = localStorage.getItem('smart_hospital_token') || sessionStorage.getItem('smart_hospital_token');

    // 1. Check if an unauthenticated user asks to book or schedule an appointment
    if (!token && (
      lowerText.includes('book appointment') ||
      lowerText.includes('book an appointment') ||
      lowerText.includes('book doctor') ||
      lowerText.includes('schedule appointment') ||
      lowerText.includes('schedule a doctor') ||
      lowerText.includes('consult doctor') ||
      lowerText.includes('book doc')
    )) {
      chatInput.disabled = false;
      chatInput.focus();
      isSendingMessage = false;
      appendBotMessage(
        "🔐 **Sign In or Register to Book Appointments**\n\nTo schedule a consultation and reserve a confirmed time slot, please sign in or create a free account below. Your chat history will be preserved and you'll be redirected to your dashboard with this assistant ready to finalize your booking:"
      );
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${renderInChatLoginForm()}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    // 2. Doctor portal automated workflow shortcuts
    if (isDoctor) {
      if (
        lowerText.includes('my queue') ||
        lowerText.includes('patient queue') ||
        lowerText.includes('show patients') ||
        lowerText.includes('my appointments') ||
        lowerText.includes('today\'s schedule')
      ) {
        chatInput.disabled = false;
        chatInput.focus();
        isSendingMessage = false;
        await displayDoctorQueueInChat();
        return;
      }

      if (
        lowerText.includes('soap note') ||
        lowerText.includes('clinical note') ||
        lowerText.includes('auto soap')
      ) {
        chatInput.disabled = false;
        chatInput.focus();
        isSendingMessage = false;
        displaySoapGeneratorInChat();
        return;
      }

      if (
        lowerText.includes('rx help') ||
        lowerText.includes('dosage assistant') ||
        lowerText.includes('drug formula') ||
        lowerText.includes('prescribe help')
      ) {
        chatInput.disabled = false;
        chatInput.focus();
        isSendingMessage = false;
        displayDoctorRxHelpInChat();
        return;
      }
    }

    // 3. Check if user specifically typed "explore doctor" or "show doctors"
    if (lowerText === 'explore doctors' || lowerText === 'explore doctor' || lowerText === 'show doctors') {
      chatInput.disabled = false;
      chatInput.focus();
      isSendingMessage = false;
      await displayDoctorsInChat();
      return;
    }

    // 4. Check if user typed "nearest hospital", "find hospital", "bed occupy", "bed occupancy"
    if (
      lowerText.includes('nearest hospital') ||
      lowerText.includes('find hospital') ||
      lowerText.includes('hospital bed') ||
      lowerText.includes('bed occupy') ||
      lowerText.includes('bed availability')
    ) {
      chatInput.disabled = false;
      chatInput.focus();
      isSendingMessage = false;
      await displayNearestHospitalInChat();
      return;
    }

    // 5. Check if user specifically asks for login or signup in chat
    if (lowerText === 'login' || lowerText === 'sign in' || lowerText === 'signin' || lowerText === 'log in') {
      chatInput.disabled = false;
      chatInput.focus();
      isSendingMessage = false;
      appendBotMessage("Please enter your login credentials below to access your account:");
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${renderInChatLoginForm()}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    if (lowerText === 'signup' || lowerText === 'sign up' || lowerText === 'register' || lowerText === 'create account') {
      chatInput.disabled = false;
      chatInput.focus();
      isSendingMessage = false;
      appendBotMessage("Fill in your details below to create your free patient profile:");
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${renderInChatRegisterForm()}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    showTypingIndicator();

    try {
      const data = await apiRequest('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-8)
        })
      });

      chatHistory.push({ role: 'assistant', content: data.reply });
      persistGuestChat();
      recordGuestLearning(text, data.reply, data.intent);

      appendBotMessage(
        data.reply,
        data.action,
        data.triageLevel,
        data.agent,
        data.doctors,
        data.operations,
        data.bookingRecommendation,
        data.prescriptions,
        true,
        data.hospital || null,
        data.suggestions || null
      );

      // Prolonged conversation check for non-logged-in guest users
      const token = localStorage.getItem('smart_hospital_token');
      if (!token) {
        guestTurnCount++;
        if (guestTurnCount >= 3 && !guestAuthPromptShown) {
          guestAuthPromptShown = true;
          setTimeout(() => {
            const promptDiv = document.createElement('div');
            promptDiv.className = 'ai-msg bot-msg';
            promptDiv.innerHTML = `<div class="msg-bubble">${renderGuestAuthPromptCard()}</div>`;
            messagesContainer.appendChild(promptDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 600);
        }
      }

      // If doctors or operations were returned, auto-expand to give user room
      if ((data.doctors && data.doctors.length || data.operations) && !chatBox.classList.contains('expanded')) {
        toggleExpand(true);
      }
    } catch (err) {
      removeTypingIndicator();
      appendBotMessage(`⚠️ Unable to connect to AI Assistant. ${err.message || 'Please try again.'}`);
    } finally {
      isSendingMessage = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  };

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(chatInput.value);
  });

  // Global click delegate for chat buttons (doctor bookings, slot selection, SOS, nearest hospital, auth)
  messagesContainer.addEventListener('click', async (e) => {
    // 1. Explore Doctors action button
    const exploreBtn = e.target.closest('[data-action="explore-doctors"]');
    if (exploreBtn) {
      e.preventDefault();
      toggleExpand(true);
      displayDoctorsInChat();
      return;
    }

    // 2. Nearest Hospital action button
    const nearestHospBtn = e.target.closest('[data-action="nearest-hospital"]');
    if (nearestHospBtn) {
      e.preventDefault();
      displayNearestHospitalInChat();
      return;
    }

    // 3. Toggle expand button inside doctor list
    const expandToggle = e.target.closest('[data-action="toggle-expand"]');
    if (expandToggle) {
      e.preventDefault();
      toggleExpand();
      return;
    }

    // 4. Quick in-chat booking trigger from doctor card
    const bookDoctorBtn = e.target.closest('[data-action="in-chat-book"]');
    if (bookDoctorBtn) {
      e.preventDefault();
      const docName = bookDoctorBtn.getAttribute('data-doc-name');
      const docId = bookDoctorBtn.getAttribute('data-doc-id');
      const docSpec = bookDoctorBtn.getAttribute('data-doc-spec');

      const token = localStorage.getItem('smart_hospital_token') || sessionStorage.getItem('smart_hospital_token');
      if (!token) {
        try {
          localStorage.setItem('arogya_ai_pending_booking', JSON.stringify({ docId, docName, docSpec }));
        } catch (err) {}

        appendBotMessage(
          `🔐 **Sign In or Register to Book with ${docName}**\n\nTo schedule your consultation with **${docName}** (${docSpec}), please sign in or create a free patient account below. Your selected doctor is saved, and you will be redirected to your dashboard with this assistant open to finalize your appointment:`
        );
        const div = document.createElement('div');
        div.className = 'ai-msg bot-msg';
        div.innerHTML = `<div class="msg-bubble">${renderInChatLoginForm()}</div>`;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return;
      }

      appendBotMessage(
        `Let's schedule your consultation with **${docName}** (${docSpec}). Please choose your date and time below:`,
        null,
        'normal',
        'Arogya AI Assistant',
        null,
        null,
        {
          department: docSpec,
          recommendedDoctor: { id: docId, name: docName }
        }
      );
      return;
    }

    // 5. Time slot pill selection inside booking form
    const slotPill = e.target.closest('.ai-slot-pill');
    if (slotPill) {
      e.preventDefault();
      const containerPills = slotPill.closest('.ai-slot-pills');
      if (containerPills) {
        containerPills.querySelectorAll('.ai-slot-pill').forEach(p => p.classList.remove('active'));
      }
      slotPill.classList.add('active');
      return;
    }

    // 6. Confirm in-chat appointment booking execution
    const confirmApptBtn = e.target.closest('#ai-btn-confirm-appointment');
    if (confirmApptBtn) {
      e.preventDefault();
      const bookingBox = confirmApptBtn.closest('#ai-booking-form-box');
      const docId = confirmApptBtn.getAttribute('data-doc-id');
      const docName = confirmApptBtn.getAttribute('data-doc-name');
      const dateVal = document.getElementById('ai-book-date')?.value || new Date().toISOString();
      const slotVal = bookingBox?.querySelector('.ai-slot-pill.active')?.getAttribute('data-slot') || '10:00 AM';
      const reasonVal = document.getElementById('ai-book-reason')?.value || 'Clinical consultation';

      const token = localStorage.getItem('smart_hospital_token') || sessionStorage.getItem('smart_hospital_token');
      if (!token) {
        try {
          localStorage.setItem('arogya_ai_pending_booking', JSON.stringify({ docId, docName, docSpec: 'Clinical consultation' }));
        } catch (err) {}

        bookingBox.innerHTML = `
          <div style="font-size:0.84rem;color:#b45309;font-weight:700;margin-bottom:8px">
            🔐 Please sign in or create an account to finalize your booking with ${docName}:
          </div>
          ${renderInChatLoginForm()}
        `;
        return;
      }

      confirmApptBtn.disabled = true;
      confirmApptBtn.textContent = '⏳ Processing Booking with Hospital...';

      try {
        const res = await apiRequest('/api/ai/appointments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId: docId,
            date: dateVal,
            timeSlot: slotVal,
            symptoms: reasonVal
          })
        });

        if (res.success && res.appointment) {
          bookingBox.innerHTML = `
            <div class="ai-confirmed-pass">
              <div class="ai-pass-header">
                <span style="font-weight:800;color:#065f46">✅ Appointment Confirmed!</span>
                <span class="ai-pass-token">${res.appointment.tokenNumber || '#TKN-CONFIRMED'}</span>
              </div>
              <div style="font-size:0.8rem;color:#047857;line-height:1.4">
                <div>👨‍⚕️ <strong>Doctor:</strong> ${docName}</div>
                <div>📅 <strong>Date:</strong> ${new Date(res.appointment.appointmentDate).toLocaleDateString()} at ${res.appointment.timeSlot}</div>
                <div>🏥 <strong>Status:</strong> ${res.appointment.status.toUpperCase()}</div>
              </div>
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
                <a href="/user/appointments.html" class="btn btn-sm btn-blue ai-action-btn">View Appointments ↗</a>
                <button type="button" class="btn btn-sm btn-outline ai-action-btn" data-action="minimize-chat">✕ Close & Return to Dashboard</button>
              </div>
            </div>
          `;
        } else {
          bookingBox.innerHTML = `<div class="muted" style="color:#dc2626">⚠️ Booking was not completed: ${res.message || 'Please log in to finalize appointment.'}</div>`;
        }
      } catch (err) {
        bookingBox.innerHTML = `<div class="muted" style="color:#dc2626">⚠️ Booking error: ${err.message || 'Please sign in to schedule appointments.'}</div>`;
      }
      return;
    }

    // 7. Confirm Emergency 108 Ambulance Dispatch execution
    const dispatchSosBtn = e.target.closest('#ai-btn-dispatch-sos');
    if (dispatchSosBtn) {
      e.preventDefault();
      const sosBox = dispatchSosBtn.closest('#ai-sos-card') || document.getElementById('ai-sos-box');
      const locationVal = document.getElementById('ai-sos-location')?.value || 'Current Location';
      const phoneVal = document.getElementById('ai-sos-phone')?.value || '9999999999';

      dispatchSosBtn.disabled = true;
      dispatchSosBtn.textContent = '🚨 Contacting 108 Emergency Dispatch...';

      try {
        const res = await apiRequest('/api/emergency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientName: 'Emergency Patient',
            contact: phoneVal,
            location: locationVal,
            priority: 'critical',
            symptoms: ['Urgent Medical SOS via AI Agent']
          })
        });

        if (res.success && res.emergency) {
          sosBox.innerHTML = `
            <div class="ai-confirmed-pass" style="background:#fef2f2;border-color:#f87171">
              <div class="ai-pass-header">
                <span style="font-weight:800;color:#dc2626">🚑 Ambulance Dispatched!</span>
                <span class="ai-pass-token" style="background:#dc2626">108 ACTIVE</span>
              </div>
              <div style="font-size:0.8rem;color:#991b1b;line-height:1.4">
                <div>📍 <strong>Location:</strong> ${locationVal}</div>
                <div>🚨 <strong>Emergency ID:</strong> ${res.emergency._id}</div>
                <div>⏱️ <strong>ETA:</strong> 8 - 12 Minutes (Emergency Unit En Route)</div>
              </div>
              <div style="margin-top:10px">
                <a href="/user/ambulance-booking.html" class="btn btn-sm btn-red ai-action-btn" target="_blank">Live GPS Ambulance Tracker ↗</a>
              </div>
            </div>
          `;
        } else {
          sosBox.innerHTML = `<div style="color:#dc2626;font-size:0.8rem">⚠️ Emergency request registered. Dial 108 immediately for urgent rescue.</div>`;
        }
      } catch (err) {
        sosBox.innerHTML = `<div style="color:#dc2626;font-size:0.8rem">⚠️ Dial 108 immediately. Emergency logged locally: ${err.message}</div>`;
      }
      return;
    }

    // 8. Open In-Chat Login form
    const openLoginBtn = e.target.closest('[data-action="open-in-chat-login"]');
    if (openLoginBtn) {
      e.preventDefault();
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${renderInChatLoginForm()}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    // 9. Open In-Chat Register form
    const openRegBtn = e.target.closest('[data-action="open-in-chat-register"]');
    if (openRegBtn) {
      e.preventDefault();
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${renderInChatRegisterForm()}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    // 10. Submit In-Chat Login
    const submitLoginBtn = e.target.closest('#ai-btn-submit-login');
    if (submitLoginBtn) {
      e.preventDefault();
      const formCard = submitLoginBtn.closest('#ai-in-chat-login-box');
      const email = formCard?.querySelector('#ai-login-email')?.value?.trim();
      const password = formCard?.querySelector('#ai-login-password')?.value;
      await executeInChatLogin(email, password, formCard);
      return;
    }

    // 11. Submit In-Chat Register
    const submitRegBtn = e.target.closest('#ai-btn-submit-register');
    if (submitRegBtn) {
      e.preventDefault();
      const formCard = submitRegBtn.closest('#ai-in-chat-register-box');
      const name = formCard?.querySelector('#ai-reg-name')?.value?.trim();
      const email = formCard?.querySelector('#ai-reg-email')?.value?.trim();
      const phone = formCard?.querySelector('#ai-reg-phone')?.value?.trim();
      const password = formCard?.querySelector('#ai-reg-password')?.value;
      await executeInChatRegister(name, email, phone, password, formCard);
      return;
    }

    // 12. Continue Chatting after auth
    const continueChatBtn = e.target.closest('[data-action="continue-chat"]');
    if (continueChatBtn) {
      e.preventDefault();
      chatInput.focus();
      return;
    }

    // 13. In-Chat Booking Pill
    const bookingPill = e.target.closest('[data-action="in-chat-booking"]');
    if (bookingPill) {
      e.preventDefault();
      const token = localStorage.getItem('smart_hospital_token') || sessionStorage.getItem('smart_hospital_token');
      if (!token) {
        appendBotMessage(
          "🔐 **Sign In or Register to Book Appointments**\n\nTo schedule a consultation and reserve a confirmed time slot, please sign in or create a free account below. After logging in, you will be redirected to your dashboard where this assistant will automatically open to finalize your appointment:"
        );
        const div = document.createElement('div');
        div.className = 'ai-msg bot-msg';
        div.innerHTML = `<div class="msg-bubble">${renderInChatLoginForm()}</div>`;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return;
      }
      sendMessage("I want to schedule an appointment with a doctor");
      return;
    }

    // 14. Emergency SOS Pill
    const sosPill = e.target.closest('[data-action="in-chat-sos"]');
    if (sosPill) {
      e.preventDefault();
      appendBotMessage(
        "Emergency SOS requested. Please confirm your location below to dispatch the nearest 108 ambulance immediately:",
        null,
        'critical',
        'Arogya AI Assistant'
      );
      return;
    }

    // 15. Sign In Pill
    const signinPill = e.target.closest('[data-action="in-chat-signin"]');
    if (signinPill) {
      e.preventDefault();
      const div = document.createElement('div');
      div.className = 'ai-msg bot-msg';
      div.innerHTML = `<div class="msg-bubble">${renderInChatLoginForm()}</div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    // 16. Doctor Queue Pill & Action
    const doctorQueueBtn = e.target.closest('[data-action="doctor-queue"]');
    if (doctorQueueBtn) {
      e.preventDefault();
      await displayDoctorQueueInChat();
      return;
    }

    // 17. Doctor SOAP Note Pill & Action
    const doctorSoapBtn = e.target.closest('[data-action="doctor-soap"]');
    if (doctorSoapBtn) {
      e.preventDefault();
      displaySoapGeneratorInChat();
      return;
    }

    // 18. Doctor Start SOAP Note from Queue item
    const startSoapBtn = e.target.closest('[data-action="doctor-start-soap"]');
    if (startSoapBtn) {
      e.preventDefault();
      const pName = startSoapBtn.getAttribute('data-patient-name') || '';
      const pSymp = startSoapBtn.getAttribute('data-patient-symptoms') || '';
      displaySoapGeneratorInChat(pName, pSymp);
      return;
    }

    // 19. Generate SOAP Note Execution
    const genSoapBtn = e.target.closest('#ai-btn-generate-soap');
    if (genSoapBtn) {
      e.preventDefault();
      const toolBox = genSoapBtn.closest('#ai-soap-tool-box');
      const text = toolBox?.querySelector('#ai-soap-input-text')?.value?.trim();
      const resultArea = toolBox?.querySelector('#ai-soap-result-area');

      if (!text) {
        alert("Please enter patient clinical observations or notes.");
        return;
      }

      genSoapBtn.disabled = true;
      genSoapBtn.textContent = '⏳ Synthesizing SOAP Note...';

      try {
        const res = await apiRequest('/api/ai/clinical-notes/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: text })
        });

        if (res && res.soap) {
          const s = res.soap;
          const rxList = res.suggestedPrescriptions || [];
          const rxText = rxList.map(r => `• ${r.medicineName || 'Medication'} (${r.dosage || 'Standard'} - ${r.frequency || 'Daily'})`).join('\n');

          const plainNote = `SOAP CLINICAL DOCUMENTATION\n===========================\nSUBJECTIVE:\n${s.subjective || text}\n\nOBJECTIVE:\n${s.objective || 'Vitals and physical examination as recorded.'}\n\nASSESSMENT:\n${s.assessment || 'Clinical assessment based on presentation.'}\n\nPLAN:\n${s.plan || 'Standard symptomatic management.'}${rxList.length ? '\n\nPrescriptions:\n' + rxText : ''}`;

          resultArea.style.display = 'block';
          resultArea.innerHTML = `
            <div class="ai-soap-output">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <span style="font-weight:800;color:#0369a1">✅ Synthesized SOAP Note</span>
                <button type="button" class="btn btn-sm btn-outline ai-action-btn" id="ai-btn-copy-soap" style="padding:2px 8px;font-size:0.7rem">📋 Copy Note</button>
              </div>
              <div><strong class="ai-soap-section-title">S (Subjective):</strong> ${formatText(s.subjective || text)}</div>
              <div style="margin-top:4px"><strong class="ai-soap-section-title">O (Objective):</strong> ${formatText(s.objective || 'Vitals & exam findings recorded')}</div>
              <div style="margin-top:4px"><strong class="ai-soap-section-title">A (Assessment):</strong> ${formatText(s.assessment || 'Primary clinical presentation')}</div>
              <div style="margin-top:4px"><strong class="ai-soap-section-title">P (Plan):</strong> ${formatText(s.plan || 'Treatment regimen initiated')}</div>
              ${rxList.length ? `<div style="margin-top:6px;font-weight:700;color:#0f172a">Suggested Rx:</div><div style="font-size:0.75rem;color:#475569">${rxList.map(r => `• ${r.medicineName} (${r.dosage})`).join('<br>')}</div>` : ''}
              <textarea id="ai-soap-raw-copy" style="display:none;">${plainNote}</textarea>
            </div>
          `;
        } else {
          resultArea.style.display = 'block';
          resultArea.innerHTML = `<div style="color:#dc2626;font-size:0.75rem">⚠️ Could not generate note. Please try again.</div>`;
        }
      } catch (soapErr) {
        resultArea.style.display = 'block';
        resultArea.innerHTML = `<div style="color:#dc2626;font-size:0.75rem">⚠️ Error analyzing notes: ${soapErr.message}</div>`;
      } finally {
        genSoapBtn.disabled = false;
        genSoapBtn.textContent = '⚡ Generate Structured SOAP Note';
      }
      return;
    }

    // 20. Copy SOAP Note Execution
    const copySoapBtn = e.target.closest('#ai-btn-copy-soap');
    if (copySoapBtn) {
      e.preventDefault();
      const rawText = copySoapBtn.closest('.ai-soap-output')?.querySelector('#ai-soap-raw-copy')?.value || '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(rawText).then(() => {
          copySoapBtn.textContent = '✅ Copied!';
          setTimeout(() => { copySoapBtn.textContent = '📋 Copy Note'; }, 2000);
        });
      } else {
        alert("SOAP Note copied to clipboard!");
      }
      return;
    }

    // 21. Doctor Rx Help Pill
    const rxHelpBtn = e.target.closest('[data-action="doctor-rx-help"]');
    if (rxHelpBtn) {
      e.preventDefault();
      displayDoctorRxHelpInChat();
      return;
    }

    // 22. Minimize / Close Chat Button (for continuing manually)
    const minimizeBtn = e.target.closest('[data-action="minimize-chat"]');
    if (minimizeBtn) {
      e.preventDefault();
      chatBox.classList.add('hidden');
      chatBox.setAttribute('aria-hidden', 'true');
      return;
    }

    // 23. Quick Prompts with data-prompt
    const promptPill = e.target.closest('.ai-pill[data-prompt]');
    if (promptPill) {
      e.preventDefault();
      const p = promptPill.getAttribute('data-prompt');
      if (p) sendMessage(p);
      return;
    }
  });

  // Clear Chat History & Sync with Server or LocalStorage
  clearBtn.addEventListener('click', async () => {
    chatHistory = [];
    localStorage.removeItem(GUEST_STORAGE_KEY);
    messagesContainer.innerHTML = `
      <div class="ai-welcome-banner">
        <div class="welcome-icon">${welcomeIcon}</div>
        <h4>${welcomeTitle}</h4>
        <p>${welcomeDesc}</p>
      </div>
    `;

    try {
      await apiRequest('/api/ai/history', { method: 'DELETE' });
    } catch (e) {
      // Non-blocking
    }
  });

  // Check auto-open on dashboard and resume any pending bookings
  const checkAutoOpenAndPending = () => {
    const shouldAutoOpen = localStorage.getItem('arogya_ai_auto_open') === 'true';
    if (shouldAutoOpen) {
      localStorage.removeItem('arogya_ai_auto_open');
      chatBox.classList.remove('hidden');
      chatBox.setAttribute('aria-hidden', 'false');
    }

    const pendingBookingStr = localStorage.getItem('arogya_ai_pending_booking');
    const token = localStorage.getItem('smart_hospital_token') || sessionStorage.getItem('smart_hospital_token');

    if (pendingBookingStr && token) {
      try {
        const pending = JSON.parse(pendingBookingStr);
        localStorage.removeItem('arogya_ai_pending_booking');
        chatBox.classList.remove('hidden');
        chatBox.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
          appendBotMessage(
            `🎉 **Welcome to your Dashboard!**\n\nYour session is active. Let's finish your consultation booking with **${pending.docName || 'Doctor'}** (${pending.docSpec || 'Specialist'}). Confirm your slot below, or continue chatting with me to customize your consultation:`,
            null,
            'normal',
            isDoctor ? 'Arogya Clinical Copilot' : 'Arogya AI Assistant',
            null,
            null,
            {
              department: pending.docSpec || 'General Consultation',
              recommendedDoctor: { id: pending.docId, name: pending.docName }
            }
          );
        }, 500);
      } catch (e) {
        localStorage.removeItem('arogya_ai_pending_booking');
      }
    } else if (shouldAutoOpen) {
      setTimeout(() => {
        const uName = currentUser?.name ? `, ${currentUser.name}` : '';
        if (isDoctor) {
          appendBotMessage(
            `👨‍⚕️ **Welcome to your Doctor Portal${uName}!**\n\nYour Clinical Automation Copilot is active. You can:\n• 📋 **Check your patient queue**\n• 📝 **Auto-generate structured SOAP notes**\n• 🏥 **Monitor hospital beds & ER telemetry**\n• ✕ **Close this chat anytime** (click ✕) to continue manually!`,
            null,
            'normal',
            'Arogya Clinical Copilot'
          );
        } else {
          appendBotMessage(
            `👋 **Welcome to your Patient Dashboard${uName}!**\n\nYour Arogya AI Health Assistant is running and ready. You can:\n• 📅 **Book a doctor** by chatting with me or picking specialists\n• 🏥 **Check live hospital beds & emergency services**\n• ✕ **Close this chat anytime** (click ✕) to continue manually!`,
            null,
            'normal',
            'Arogya AI Assistant'
          );
        }
      }, 500);
    }
  };

  // Load Past User Consultation History from DB or Chrome LocalStorage (for guests)
  const loadPastHistory = async () => {
    const token = localStorage.getItem('smart_hospital_token') || sessionStorage.getItem('smart_hospital_token');

    if (token) {
      // Authenticated user: load from server
      try {
        const data = await apiRequest('/api/ai/history');
        if (data && data.history && data.history.length > 0) {
          const divider = document.createElement('div');
          divider.className = 'ai-history-divider';
          divider.innerHTML = `<span>Past Consultation History</span>`;
          messagesContainer.appendChild(divider);

          data.history.forEach(item => {
            chatHistory.push({ role: item.role, content: item.content });
            if (item.role === 'user') {
              appendUserMessage(item.content, false);
            } else {
              appendBotMessage(item.content, null, item.triageLevel || 'normal', isDoctor ? 'Arogya Clinical Copilot' : 'Arogya AI Assistant', null, null, null, null, false);
            }
          });

          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      } catch (e) {
        // Fallback
      }
    } else {
      // Guest User: restore from Chrome localStorage
      try {
        const guestData = localStorage.getItem(GUEST_STORAGE_KEY);
        if (guestData) {
          const guestHistory = JSON.parse(guestData);
          if (Array.isArray(guestHistory) && guestHistory.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'ai-history-divider';
            divider.innerHTML = `<span>Previous Guest Consultation</span>`;
            messagesContainer.appendChild(divider);

            guestHistory.forEach(item => {
              chatHistory.push({ role: item.role, content: item.content });
              if (item.role === 'user') {
                guestTurnCount++;
                appendUserMessage(item.content, false);
              } else {
                appendBotMessage(item.content, null, 'normal', isDoctor ? 'Arogya Clinical Copilot' : 'Arogya AI Assistant', null, null, null, null, false);
              }
            });

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      } catch (err) {
        console.warn('Guest history load error:', err);
      }
    }

    // Always run auto-open and pending booking checks
    checkAutoOpenAndPending();
  };

  loadPastHistory();
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAiChatWidget);
} else {
  initAiChatWidget();
}
