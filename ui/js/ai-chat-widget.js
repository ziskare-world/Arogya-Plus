/* ==========================================================================
   ai-chat-widget.js - Floating AI Bot Circle & Chat Panel for User Dashboard
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
          <p>Describe your symptoms, ask medical questions, or get help navigating hospital services.</p>
        </div>

        <!-- Suggestion Pills -->
        <div class="ai-quick-pills">
          <button class="ai-pill" data-prompt="I want to check my symptoms">🩺 Symptom Checker</button>
          <button class="ai-pill" data-prompt="How do I book an appointment?">📅 Book Appointment</button>
          <button class="ai-pill" data-prompt="I need an emergency ambulance">🚑 Emergency SOS</button>
          <button class="ai-pill" data-prompt="Where are my medical records?">📋 Medical Records</button>
        </div>
      </div>

      <!-- Input Footer -->
      <form id="ai-chat-form" class="ai-chat-footer">
        <input id="ai-chat-input" type="text" placeholder="Type your health query..." autocomplete="off" />
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
  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = document.getElementById('ai-chat-input');
  const messagesContainer = document.getElementById('ai-chat-messages');

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

  clearBtn.addEventListener('click', () => {
    messagesContainer.innerHTML = `
      <div class="ai-welcome-banner">
        <div class="welcome-icon">🩺</div>
        <h4>Welcome to Arogya AI!</h4>
        <p>Describe your symptoms, ask medical questions, or get help navigating hospital services.</p>
      </div>
      <div class="ai-quick-pills">
        <button class="ai-pill" data-prompt="I want to check my symptoms">🩺 Symptom Checker</button>
        <button class="ai-pill" data-prompt="How do I book an appointment?">📅 Book Appointment</button>
        <button class="ai-pill" data-prompt="I need an emergency ambulance">🚑 Emergency SOS</button>
        <button class="ai-pill" data-prompt="Where are my medical records?">📋 Medical Records</button>
      </div>
    `;
    attachPillListeners();
  });

  const formatText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  };

  const appendUserMessage = (text) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg user-msg';
    msgDiv.innerHTML = `<div class="msg-bubble">${formatText(text)}</div>`;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

  const appendBotMessage = (reply, action = null, triageLevel = 'normal') => {
    removeTypingIndicator();

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg bot-msg ${triageLevel === 'critical' ? 'critical-alert' : ''}`;

    let actionBtnHtml = '';
    if (action && action.label && action.href) {
      actionBtnHtml = `
        <div class="ai-action-wrap">
          <a href="${action.href}" class="btn btn-sm ${action.variant === 'danger' ? 'btn-red' : 'btn-blue'} ai-action-btn">
            ${action.label}
          </a>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="msg-bubble">
        ${formatText(reply)}
        ${actionBtnHtml}
      </div>
    `;

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const sendMessage = async (text) => {
    if (!text || !text.trim()) return;

    appendUserMessage(text);
    chatInput.value = '';
    chatInput.disabled = true;

    showTypingIndicator();

    try {
      const data = await apiRequest('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      appendBotMessage(data.reply, data.action, data.triageLevel);
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

  const attachPillListeners = () => {
    document.querySelectorAll('.ai-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const prompt = pill.getAttribute('data-prompt');
        if (prompt) sendMessage(prompt);
      });
    });
  };

  attachPillListeners();
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAiChatWidget);
} else {
  initAiChatWidget();
}
