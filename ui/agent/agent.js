/* ==========================================================================
   Arogy AI Agent - Dashboard Client Logic
   Handles REST interactions, tab routing, chat execution, and telemetry.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const sessionId = "sess_" + Math.random().toString(36).substring(2, 9);

  // Tab Navigation
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const tabTitle = document.getElementById("tab-title");

  const tabTitles = {
    "tab-chat": "Autonomous Chat & Tool Execution",
    "tab-skills": "Skill Marketplace & Capabilities",
    "tab-workflows": "Automated Workflows & Triggers",
    "tab-approvals": "Pending Human Approvals",
    "tab-helpdesk": "Support Tickets & Help-Desk",
    "tab-knowledge": "Knowledge Base & RAG Engine",
    "tab-memory": "Long-Term Memory Vault",
    "tab-health": "System Telemetry & Health"
  };

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((n) => n.classList.remove("active"));
      tabContents.forEach((t) => t.classList.remove("active"));

      item.classList.add("active");
      const targetTabId = item.getAttribute("data-tab");
      const targetTab = document.getElementById(targetTabId);
      if (targetTab) targetTab.classList.add("active");
      if (tabTitle) tabTitle.textContent = tabTitles[targetTabId] || "Arogy AI Agent";

      // Lazy load tab data
      if (targetTabId === "tab-skills") loadSkills();
      if (targetTabId === "tab-workflows") loadWorkflows();
      if (targetTabId === "tab-approvals") loadApprovals();
      if (targetTabId === "tab-helpdesk") loadTickets();
      if (targetTabId === "tab-memory") loadMemory();
      if (targetTabId === "tab-health") loadHealth();
    });
  });

  // Chat Execution
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatHistory = document.getElementById("chat-history");

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    chatInput.value = "";
    chatInput.disabled = true;

    try {
      const token = localStorage.getItem("token") || "";
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, sessionId })
      });
      const data = await res.json();

      if (data.success) {
        appendAgentMessage(data.reply, data.skill, data.requiresApproval);
        if (data.requiresApproval) {
          checkApprovalCount();
        }
      } else {
        appendAgentMessage("⚠️ Error: " + (data.message || "Failed to process instruction."));
      }
    } catch (err) {
      appendAgentMessage("⚠️ Network error contacting Arogy AI Agent.");
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  // Quick prompt pills
  document.querySelectorAll(".chat-pill-btn").forEach((pill) => {
    pill.addEventListener("click", () => {
      const q = pill.getAttribute("data-query");
      if (q) {
        chatInput.value = q;
        chatForm.dispatchEvent(new Event("submit"));
      }
    });
  });

  function appendUserMessage(text) {
    const div = document.createElement("div");
    div.className = "chat-msg user";
    div.innerHTML = `<div class="chat-bubble">${escapeHtml(text)}</div>`;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  function appendAgentMessage(text, skill = "Arogy AI Agent", requiresApproval = false) {
    const div = document.createElement("div");
    div.className = "chat-msg agent";

    const badge = requiresApproval ? `<span class="badge badge-yellow">Approval Required</span>` : "";
    div.innerHTML = `
      <div class="agent-meta">🤖 ${escapeHtml(skill)} ${badge}</div>
      <div class="chat-bubble">${formatMarkdown(text)}</div>
    `;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // Load Skills
  async function loadSkills() {
    const grid = document.getElementById("skills-grid");
    grid.innerHTML = "<p>Loading registered skills...</p>";

    try {
      const res = await fetch("/api/agent/skills");
      const data = await res.json();
      if (data.skills && data.skills.length > 0) {
        grid.innerHTML = data.skills
          .map(
            (s) => `
          <div class="card">
            <div class="card-title">
              <span>${escapeHtml(s.name)}</span>
              <span class="badge ${s.isEnabled ? "badge-green" : "badge-red"}">${s.isEnabled ? "Active" : "Disabled"}</span>
            </div>
            <div class="card-desc">${escapeHtml(s.description)}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 12px;">
              Category: <strong>${s.category}</strong> • Tools: <strong>${s.toolsCount}</strong>
            </div>
            <button class="btn btn-secondary" style="margin-top:auto;" onclick="toggleSkill('${s.id}', ${s.isEnabled})">
              ${s.isEnabled ? "Disable Skill" : "Enable Skill"}
            </button>
          </div>
        `
          )
          .join("");
      }
    } catch (e) {
      grid.innerHTML = "<p>Failed to load skill catalog.</p>";
    }
  }

  window.toggleSkill = async (skillId, currentEnabled) => {
    const action = currentEnabled ? "disable" : "enable";
    const token = localStorage.getItem("token") || "";
    await fetch(`/api/agent/skills/${skillId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    loadSkills();
  };

  // Load Workflows
  async function loadWorkflows() {
    const grid = document.getElementById("workflows-grid");
    const token = localStorage.getItem("token") || "";
    grid.innerHTML = "<p>Loading automation workflows...</p>";

    try {
      const res = await fetch("/api/agent/workflows", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.workflows && data.workflows.length > 0) {
        grid.innerHTML = data.workflows
          .map(
            (w) => `
          <div class="card">
            <div class="card-title">
              <span>${escapeHtml(w.name)}</span>
              <span class="badge ${w.isPaused ? "badge-yellow" : "badge-green"}">${w.isPaused ? "Paused" : "Active"}</span>
            </div>
            <div class="card-desc">${escapeHtml(w.description || "Multi-step automated clinical routine.")}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 12px;">
              Trigger: <strong>${w.trigger?.type || "manual"}</strong> • Steps: <strong>${w.steps?.length || 0}</strong>
            </div>
            <button class="btn btn-primary" onclick="runWorkflow('${w._id}')">Execute Now</button>
          </div>
        `
          )
          .join("");
      } else {
        grid.innerHTML = "<p>No automation workflows configured. Click '+ New Automation Workflow' to create one.</p>";
      }
    } catch (e) {
      grid.innerHTML = "<p>Please sign in to view automation workflows.</p>";
    }
  }

  window.runWorkflow = async (workflowId) => {
    const token = localStorage.getItem("token") || "";
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: "run workflow", sessionId })
    });
    const d = await res.json();
    alert(d.reply || "Workflow triggered.");
  };

  // Load Approvals
  async function loadApprovals() {
    const list = document.getElementById("approvals-list");
    const token = localStorage.getItem("token") || "";
    list.innerHTML = "<p>Checking pending approval checkpoints...</p>";

    try {
      const res = await fetch("/api/agent/approvals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.approvals && data.approvals.length > 0) {
        list.innerHTML = data.approvals
          .map(
            (a) => `
          <div class="card" style="border-left: 4px solid var(--warning);">
            <div class="card-title">
              <span>${escapeHtml(a.actionName)}</span>
              <span class="badge badge-yellow">Pending Review</span>
            </div>
            <div class="card-desc">${escapeHtml(a.details?.stepDescription || a.details?.goal || "Sensitive action requires user authorization.")}</div>
            <div style="display:flex; gap: 8px; margin-top: auto;">
              <button class="btn btn-primary" onclick="handleApproval('${a._id}', true)">Approve & Resume</button>
              <button class="btn btn-secondary" onclick="handleApproval('${a._id}', false)">Reject</button>
            </div>
          </div>
        `
          )
          .join("");
      } else {
        list.innerHTML = "<p>No pending human approvals. All automated checks clear.</p>";
      }
    } catch (e) {
      list.innerHTML = "<p>Sign in to view required checkpoints.</p>";
    }
  }

  window.handleApproval = async (approvalId, isApproved) => {
    const token = localStorage.getItem("token") || "";
    const action = isApproved ? "approve" : "reject";
    await fetch(`/api/agent/approvals/${approvalId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    });
    loadApprovals();
  };

  async function checkApprovalCount() {
    const badge = document.getElementById("nav-approval-badge");
    const token = localStorage.getItem("token") || "";
    if (!token) return;
    try {
      const res = await fetch("/api/agent/approvals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.approvals && data.approvals.length > 0) {
        badge.textContent = data.approvals.length;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    } catch (e) {}
  }

  // Load Tickets
  async function loadTickets() {
    const tbody = document.getElementById("tickets-table-body");
    const token = localStorage.getItem("token") || "";
    tbody.innerHTML = "<tr><td colspan='6'>Loading support tickets...</td></tr>";

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: "view my tickets", sessionId })
      });
      const data = await res.json();
      const tickets = data.details?.tickets || [];

      if (tickets.length > 0) {
        tbody.innerHTML = tickets
          .map(
            (t) => `
          <tr>
            <td><strong>${escapeHtml(t.ticketNumber)}</strong></td>
            <td>${escapeHtml(t.title)}</td>
            <td>${escapeHtml(t.category)}</td>
            <td><span class="badge badge-${t.priority === "critical" ? "red" : "yellow"}">${t.priority}</span></td>
            <td><span class="badge badge-blue">${t.status}</span></td>
            <td>${t.slaDeadline ? new Date(t.slaDeadline).toLocaleDateString() : "24 Hours"}</td>
          </tr>
        `
          )
          .join("");
      } else {
        tbody.innerHTML = "<tr><td colspan='6'>No support tickets on record. Type in chat to create one.</td></tr>";
      }
    } catch (e) {
      tbody.innerHTML = "<tr><td colspan='6'>Please sign in to inspect support tickets.</td></tr>";
    }
  }

  // RAG Search
  const btnSearchRag = document.getElementById("btn-search-rag");
  const ragInput = document.getElementById("rag-search-input");
  const ragResults = document.getElementById("rag-search-results");

  btnSearchRag.addEventListener("click", async () => {
    const q = ragInput.value.trim();
    if (!q) return;

    ragResults.innerHTML = "Searching knowledge chunks...";
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `search document ${q}` })
      });
      const data = await res.json();
      ragResults.innerHTML = `<div style="background:#f1f5f9; padding:12px; border-radius:8px;">${formatMarkdown(data.reply)}</div>`;
    } catch (e) {
      ragResults.innerHTML = "Failed to query knowledge base.";
    }
  });

  // Load Memory
  async function loadMemory() {
    const container = document.getElementById("memory-cards");
    const token = localStorage.getItem("token") || "";
    container.innerHTML = "<p>Loading long-term memory vault...</p>";

    try {
      const res = await fetch("/api/agent/memory", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.memories && data.memories.length > 0) {
        container.innerHTML = data.memories
          .map(
            (m) => `
          <div class="card">
            <div class="card-title">
              <span>${escapeHtml(m.key)}</span>
              <span class="badge badge-blue">${escapeHtml(m.type)}</span>
            </div>
            <div class="card-desc"><pre style="font-family:inherit; white-space:pre-wrap;">${escapeHtml(JSON.stringify(m.value, null, 2))}</pre></div>
            <button class="btn btn-secondary" style="margin-top:auto;" onclick="deleteMemoryItem('${m._id}')">Forget / Delete</button>
          </div>
        `
          )
          .join("");
      } else {
        container.innerHTML = "<p>No custom memories logged for this session. Memories are captured automatically as you chat.</p>";
      }
    } catch (e) {
      container.innerHTML = "<p>Sign in to inspect your memory vault.</p>";
    }
  }

  window.deleteMemoryItem = async (id) => {
    const token = localStorage.getItem("token") || "";
    await fetch(`/api/agent/memory/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    loadMemory();
  };

  // Load Health & Telemetry
  async function loadHealth() {
    const container = document.getElementById("telemetry-container");
    container.innerHTML = "<p>Loading live telemetry...</p>";

    try {
      const res = await fetch("/api/agent/health");
      const data = await res.json();

      container.innerHTML = `
        <div class="grid-cards" style="margin-bottom:24px;">
          <div class="card">
            <div class="card-title">Model Provider</div>
            <div style="font-size:1.4rem; font-weight:700; color:var(--primary);">${data.model?.model || "Qwen3-14B"}</div>
            <div style="font-size:0.8rem; color:#64748b;">Backend: ${data.model?.provider || "Hugging Face"} • ${data.model?.latencyMs || 12}ms</div>
          </div>
          <div class="card">
            <div class="card-title">Skills Active</div>
            <div style="font-size:1.4rem; font-weight:700; color:var(--success);">${data.skillsRegistered || 15} Skills</div>
            <div style="font-size:0.8rem; color:#64748b;">Full catalog dynamically mounted</div>
          </div>
          <div class="card">
            <div class="card-title">Tools Registered</div>
            <div style="font-size:1.4rem; font-weight:700; color:var(--secondary);">${data.toolsRegistered || 30} Tools</div>
            <div style="font-size:0.8rem; color:#64748b;">Schema-validated & permission-gated</div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = "<p>Telemetry endpoint offline.</p>";
    }
  }

  document.getElementById("btn-check-health").addEventListener("click", () => {
    document.querySelector("[data-tab='tab-health']").click();
  });

  document.getElementById("btn-clear-chat").addEventListener("click", () => {
    chatHistory.innerHTML = "";
    appendAgentMessage("Chat history cleared. How may I assist you?");
  });

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatMarkdown(str) {
    return escapeHtml(str)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }

  checkApprovalCount();
});
