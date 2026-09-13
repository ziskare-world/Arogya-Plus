/* ==========================================================================
   ai-chat-widget.js - Floating AI Bot Circle & Chat Panel for User Dashboard
   Enhanced with In-Chat Doctor Explorer, Expandable Screen, & Past Memory
   ========================================================================== */

import { apiRequest } from './api-client.js';

let widgetInitialized = false;

export function initAiChatWidget() {
  if (widgetInitialized || document.getElementById('ai-bot-widget-wrapper')) {
    return;
  }

  widgetInitialized = true;

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
      <div class="ai-chat-header">
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
            <div class="ai-chat-title">Arogya AI Health Bot</div>
            <div class="ai-chat-status"><span class="status-dot"></span> Online • Medical Assistant</div>
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
          <div class="welcome-icon">🩺</div>
          <h4>Welcome to Arogya AI!</h4>
          <p>Describe your symptoms, explore verified medical specialists, or get guidance on hospital services.</p>
        </div>

        <!-- Suggestion Pills -->
        <div class="ai-quick-pills">
          <button class="ai-pill ai-pill-doc" data-action="explore-doctors">🩺 Explore Doctors</button>
          <button class="ai-pill" data-prompt="I want to check my symptoms">🔍 Symptom Checker</button>
          <button class="ai-pill" data-prompt="How do I book an appointment?">📅 Book Appointment</button>
          <button class="ai-pill" data-prompt="I need an emergency ambulance">🚑 Emergency SOS</button>
          <button class="ai-pill" data-prompt="Where are my medical records?">📋 Medical Records</button>
        </div>
      </div>

      <!-- Input Footer -->
      <form id="ai-chat-form" class="ai-chat-footer">
        <input id="ai-chat-input" type="text" placeholder="Type health query or ask for a specialist..." autocomplete="off" />
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

  const formatText = (text) => {
    return text
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

  // Render Doctor Cards right inside the chat window
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
          <button type="button" class="ai-doc-book-btn" data-doc-name="${name}" data-doc-spec="${spec}">
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

  const appendBotMessage = (reply, action = null, triageLevel = 'normal', agent = null, doctors = null, scroll = true) => {
    removeTypingIndicator();

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg bot-msg ${triageLevel === 'critical' ? 'critical-alert' : ''}`;

    let actionBtnHtml = '';
    if (action && action.label) {
      if (action.type === 'explore_doctors' || action.label.toLowerCase().includes('doctor')) {
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
            <a href="${action.href}" class="btn btn-sm ${action.variant === 'danger' ? 'btn-red' : 'btn-blue'} ai-action-btn">
              ${action.label}
            </a>
          </div>
        `;
      }
    }

    let doctorListHtml = '';
    if (doctors && doctors.length) {
      doctorListHtml = renderDoctorCards(doctors);
    }

    const agentBadge = agent ? `<div class="ai-agent-badge" style="font-size: 0.72rem; opacity: 0.75; margin-bottom: 4px; font-weight: 600;">🤖 ${agent}</div>` : '';

    msgDiv.innerHTML = `
      <div class="msg-bubble">
        ${agentBadge}
        ${formatText(reply)}
        ${doctorListHtml}
        ${actionBtnHtml}
      </div>
    `;

    messagesContainer.appendChild(msgDiv);
    if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  // Fetch doctors and display them directly inside the chat
  const displayDoctorsInChat = async () => {
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
        `Here is our list of **${docs.length} verified doctors** available across departments. You can schedule an appointment directly below:`,
        null,
        'normal',
        'AppointmentAgent',
        docs
      );
    } catch (err) {
      removeTypingIndicator();
      appendBotMessage(`⚠️ Unable to fetch doctors list: ${err.message || 'Please check connection'}`);
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

  const sendMessage = async (text) => {
    if (!text || !text.trim()) return;

    appendUserMessage(text);
    chatHistory.push({ role: 'user', content: text });
    chatInput.value = '';
    chatInput.disabled = true;

    // Check if user specifically typed "explore doctor" or "show doctors"
    const lowerText = text.trim().toLowerCase();
    if (lowerText === 'explore doctors' || lowerText === 'explore doctor' || lowerText === 'show doctors') {
      chatInput.disabled = false;
      chatInput.focus();
      await displayDoctorsInChat();
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
      appendBotMessage(data.reply, data.action, data.triageLevel, data.agent, data.doctors);

      // If doctors were returned, optionally expand to give user room
      if (data.doctors && data.doctors.length && !chatBox.classList.contains('expanded')) {
        toggleExpand(true);
      }
    } catch (err) {
      removeTypingIndicator();
      appendBotMessage(`⚠️ Unable to connect to AI Assistant. ${err.message || 'Please try again.'}`);
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  };

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(chatInput.value);
  });

  // Global click delegate for chat buttons (doctor bookings, explore doctors, quick pills)
  messagesContainer.addEventListener('click', (e) => {
    // 1. Explore Doctors action button
    const exploreBtn = e.target.closest('[data-action="explore-doctors"]');
    if (exploreBtn) {
      e.preventDefault();
      toggleExpand(true);
      displayDoctorsInChat();
      return;
    }

    // 2. Toggle expand button inside doctor list
    const expandToggle = e.target.closest('[data-action="toggle-expand"]');
    if (expandToggle) {
      e.preventDefault();
      toggleExpand();
      return;
    }

    // 3. Book Appointment with specific doctor
    const bookBtn = e.target.closest('.ai-doc-book-btn');
    if (bookBtn) {
      e.preventDefault();
      const docName = bookBtn.getAttribute('data-doc-name');
      const docSpec = bookBtn.getAttribute('data-doc-spec');
      sendMessage(`I want to book an appointment with ${docName} (${docSpec})`);
      return;
    }
  });

  // Clear Chat History & Sync with Server
  clearBtn.addEventListener('click', async () => {
    chatHistory = [];
    messagesContainer.innerHTML = `
      <div class="ai-welcome-banner">
        <div class="welcome-icon">🩺</div>
        <h4>Welcome to Arogya AI!</h4>
        <p>Describe your symptoms, explore verified medical specialists, or get guidance on hospital services.</p>
      </div>
      <div class="ai-quick-pills">
        <button class="ai-pill ai-pill-doc" data-action="explore-doctors">🩺 Explore Doctors</button>
        <button class="ai-pill" data-prompt="I want to check my symptoms">🔍 Symptom Checker</button>
        <button class="ai-pill" data-prompt="How do I book an appointment?">📅 Book Appointment</button>
        <button class="ai-pill" data-prompt="I need an emergency ambulance">🚑 Emergency SOS</button>
        <button class="ai-pill" data-prompt="Where are my medical records?">📋 Medical Records</button>
      </div>
    `;
    attachPillListeners();

    try {
      await apiRequest('/api/ai/history', { method: 'DELETE' });
    } catch (e) {
      // Non-blocking
    }
  });

  const attachPillListeners = () => {
    document.querySelectorAll('.ai-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const action = pill.getAttribute('data-action');
        if (action === 'explore-doctors') {
          toggleExpand(true);
          displayDoctorsInChat();
          return;
        }

        const prompt = pill.getAttribute('data-prompt');
        if (prompt) sendMessage(prompt);
      });
    });
  };

  attachPillListeners();

  // Load Past User Consultation History from DB
  const loadPastHistory = async () => {
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
            appendBotMessage(item.content, null, item.triageLevel || 'normal', item.agent || 'ArogyaAI', null, false);
          }
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } catch (e) {
      // Not logged in or history unavailable
    }
  };

  loadPastHistory();
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAiChatWidget);
} else {
  initAiChatWidget();
}
