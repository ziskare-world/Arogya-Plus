/**
 * 🧠 AgentMemorySystem - Multi-Tier Memory Engine for ArogyaPlus AI Agents
 *
 * Implements a four-tier cognitive memory architecture:
 * 1. Working Memory     - Active session context, conversational sliding window, dialogue slots
 * 2. Episodic Memory    - Chronological log of healthcare milestones (bookings, triage, emergencies)
 * 3. Semantic Memory    - Clinical entities, facts, preferences, allergies, chronic conditions
 * 4. Procedural Memory  - Cognitive reflection, user specialty affinities, interaction pattern synthesis
 *
 * Provides intelligent context recall (RAG) with importance weighting, recency decay, and user privacy controls.
 */

const AgentMemory = require("../models/AgentMemory");

// Clinical signal patterns for automated entity extraction from conversational turns
const CLINICAL_FACT_PATTERNS = [
  { regex: /\b(?:allergic to|allergy to|allergic:)\s+([a-zA-Z0-9\s,-]+?)(?:\.|\band\b|$)/i, keyPrefix: "allergy", category: "clinical_entity", importance: 5 },
  { regex: /\b(?:i have|diagnosed with|suffering from)\s+(diabetes|asthma|hypertension|migraine|arthritis|epilepsy|depression|thyroid|heart disease)/i, keyPrefix: "chronic_condition", category: "clinical_entity", importance: 5 },
  { regex: /\b(?:blood group|blood type)\s*(?:is|:)?\s*([a-zA-Z+-]+)/i, keyPrefix: "blood_group", category: "clinical_entity", importance: 4 },
  { regex: /\b(?:prefer|preferring)\s+(video|teleconsultation|in-person|offline)\s*(?:consultation|appointment|visit)?/i, keyPrefix: "preferred_consultation_type", category: "preference", importance: 3 },
  { regex: /\b(?:favorite doctor|preferred doctor|my doctor is)\s*(?:dr\.?|doctor)?\s*([a-zA-Z\s]+)/i, keyPrefix: "preferred_doctor", category: "preference", importance: 4 }
];

class AgentMemorySystem {
  constructor() {
    // Tier 1: In-memory Working Session Cache (TTL: 2 hours)
    this.sessionCache = new Map();
    this.SESSION_TTL_MS = 2 * 60 * 60 * 1000;
    this.MAX_SESSION_TURNS = 20;

    // Periodic sweep for expired working sessions
    setInterval(() => this._cleanupExpiredSessions(), 15 * 60 * 1000).unref();
  }

  // =========================================================================
  // TIER 1: WORKING / SESSION MEMORY
  // =========================================================================

  /**
   * Get or initialize session state
   */
  _ensureSession(sessionId) {
    if (!sessionId) return null;
    let session = this.sessionCache.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        history: [],
        slots: {},
        activeGoal: null,
        activeWorkflow: null,
        createdAt: new Date(),
        lastActiveAt: new Date()
      };
      this.sessionCache.set(sessionId, session);
    } else {
      session.lastActiveAt = new Date();
    }
    return session;
  }

  /**
   * Append a dialogue turn to working session memory
   */
  appendWorkingMessage(sessionId, message) {
    if (!sessionId || !message) return;
    const session = this._ensureSession(sessionId);
    if (!session) return;

    session.history.push({
      role: message.role || "user",
      content: message.content || "",
      intent: message.intent || null,
      timestamp: new Date()
    });

    if (session.history.length > this.MAX_SESSION_TURNS) {
      session.history.shift();
    }
    session.lastActiveAt = new Date();
  }

  /**
   * Set a slot value in the active dialogue working memory
   */
  setWorkingSlot(sessionId, key, value) {
    const session = this._ensureSession(sessionId);
    if (session) {
      session.slots[key] = value;
    }
  }

  /**
   * Get all slots in the active working memory
   */
  getWorkingSlots(sessionId) {
    const session = this.sessionCache.get(sessionId);
    return session ? { ...session.slots } : {};
  }

  /**
   * Clear working memory session
   */
  clearWorkingSession(sessionId) {
    if (sessionId) {
      this.sessionCache.delete(sessionId);
    }
  }

  _cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessionCache.entries()) {
      if (now - new Date(session.lastActiveAt).getTime() > this.SESSION_TTL_MS) {
        this.sessionCache.delete(id);
      }
    }
  }

  // =========================================================================
  // TIER 2: EPISODIC MEMORY (HEALTHCARE MILESTONES & EVENTS)
  // =========================================================================

  /**
   * Record a significant episodic healthcare event in user's permanent timeline
   */
  async recordEpisodicEvent({
    userId,
    eventType,
    summary,
    outcome = "completed",
    metadata = {},
    importance = 3
  }) {
    if (!userId || !eventType || !summary) return null;

    try {
      const cleanMetadata = this._sanitizeData(metadata);
      const timestamp = new Date();
      const key = `episode_${eventType}_${timestamp.getTime()}`;

      const episode = await AgentMemory.create({
        user: userId,
        tier: "episodic",
        type: "task_history",
        key,
        value: {
          eventType,
          summary,
          outcome,
          metadata: cleanMetadata,
          timestamp
        },
        category: "healthcare_event",
        importance: Math.min(5, Math.max(1, importance)),
        confidence: 1.0,
        tags: [eventType, outcome],
        source: "episodic_tracker"
      });

      return episode;
    } catch (err) {
      console.warn("[AgentMemorySystem] recordEpisodicEvent notice:", err.message);
      return null;
    }
  }

  /**
   * Retrieve recent episodic timeline events for a user
   */
  async getRecentEpisodes(userId, limit = 5) {
    if (!userId) return [];
    try {
      return await AgentMemory.find({
        user: userId,
        tier: "episodic"
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (err) {
      return [];
    }
  }

  // =========================================================================
  // TIER 3: SEMANTIC MEMORY (FACTS, ENTITIES & PREFERENCES)
  // =========================================================================

  /**
   * Store or update a semantic fact or user preference
   */
  async rememberFact({
    userId,
    key,
    value,
    category = "general",
    importance = 3,
    confidence = 1.0,
    pinned = false,
    tags = [],
    source = "conversation"
  }) {
    if (!userId || !key) return null;

    const cleanValue = this._sanitizeData(value);
    const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, "_");

    try {
      const memory = await AgentMemory.findOneAndUpdate(
        { user: userId, key: normalizedKey },
        {
          user: userId,
          tier: "semantic",
          type: category === "preference" ? "preference" : "fact",
          key: normalizedKey,
          value: cleanValue,
          category,
          importance: Math.min(5, Math.max(1, importance)),
          confidence: Math.min(1.0, Math.max(0.1, confidence)),
          pinned: Boolean(pinned),
          tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
          source,
          lastAccessedAt: new Date(),
          $inc: { accessCount: 1 }
        },
        { upsert: true, new: true }
      );
      return memory;
    } catch (err) {
      console.warn("[AgentMemorySystem] rememberFact error:", err.message);
      return null;
    }
  }

  /**
   * Retrieve stored semantic memories for a user, sorted by pinned and importance
   */
  async getSemanticMemories(userId, category = null) {
    if (!userId) return [];
    try {
      const query = { user: userId, tier: "semantic" };
      if (category) query.category = category;

      return await AgentMemory.find(query)
        .sort({ pinned: -1, importance: -1, updatedAt: -1 })
        .lean();
    } catch (err) {
      return [];
    }
  }

  /**
   * Delete a single memory item (Right to be Forgotten)
   */
  async forgetMemory(userId, memoryId) {
    if (!userId || !memoryId) return false;
    try {
      const result = await AgentMemory.findOneAndDelete({
        _id: memoryId,
        user: userId
      });
      return Boolean(result);
    } catch (err) {
      return false;
    }
  }

  /**
   * Clear all memories for a user (Full Memory Reset)
   */
  async wipeUserMemories(userId) {
    if (!userId) return 0;
    try {
      const res = await AgentMemory.deleteMany({ user: userId });
      return res.deletedCount || 0;
    } catch (err) {
      return 0;
    }
  }

  // =========================================================================
  // TIER 4: PROCEDURAL MEMORY & COGNITIVE REFLECTION
  // =========================================================================

  /**
   * Synthesizes user interaction patterns into high-level procedural reflection
   */
  async updateReflectionProfile(userId, { topSpecialty, specialtyCount, preferredDoctor, preferredFacility }) {
    if (!userId) return null;

    try {
      const profile = {
        topSpecialty: topSpecialty || "General Medicine",
        specialtyInteractions: specialtyCount || 1,
        preferredDoctor: preferredDoctor || null,
        preferredFacility: preferredFacility || "Arogya Central Clinical Hub",
        synthesizedAt: new Date()
      };

      return await AgentMemory.findOneAndUpdate(
        { user: userId, key: "cognitive_reflection_summary" },
        {
          user: userId,
          tier: "procedural",
          type: "reflection",
          key: "cognitive_reflection_summary",
          value: profile,
          category: "reflection",
          importance: 4,
          confidence: 0.95,
          source: "reflection_engine"
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      return null;
    }
  }

  // =========================================================================
  // RECALL ENGINE: SMART CONTEXT RETRIEVAL (RAG FOR MEMORY)
  // =========================================================================

  /**
   * Intelligent Context Recall for multi-agent reasoning
   * Given a user inquiry, retrieves relevant memories across all 4 tiers
   * based on relevance, clinical importance, recency, and pinned flags.
   */
  async recallContext({ userId, sessionId, message = "", intent = "" }) {
    const memoryContext = {
      workingSlots: {},
      pinnedFacts: [],
      relevantFacts: [],
      recentMilestones: [],
      reflection: null,
      contextPromptBlock: ""
    };

    // 1. Working Memory (Slots & Session State)
    if (sessionId) {
      memoryContext.workingSlots = this.getWorkingSlots(sessionId);
    }

    if (!userId) {
      return memoryContext;
    }

    const textLower = String(message).toLowerCase();

    try {
      // 2. Fetch Pinned Facts (Always injected - e.g. critical allergies, blood group)
      const pinned = await AgentMemory.find({
        user: userId,
        tier: "semantic",
        pinned: true
      }).lean();
      memoryContext.pinnedFacts = pinned;

      // 3. Fetch Relevant Semantic Facts (Keywords + Importance)
      const allSemantic = await AgentMemory.find({
        user: userId,
        tier: "semantic",
        pinned: false
      }).lean();

      const scored = allSemantic.map((mem) => {
        let score = (mem.importance || 3) * 1.5;
        const keyMatch = textLower.includes(String(mem.key).toLowerCase().replace(/_/g, " "));
        const valMatch = textLower.includes(String(JSON.stringify(mem.value)).toLowerCase());
        const tagMatch = (mem.tags || []).some((t) => textLower.includes(String(t).toLowerCase()));

        if (keyMatch) score += 5;
        if (valMatch) score += 3;
        if (tagMatch) score += 2;

        // Recency decay: memory accessed or updated recently gets slight boost
        const ageHours = (Date.now() - new Date(mem.updatedAt).getTime()) / (1000 * 60 * 60);
        score += Math.max(0, 3 - ageHours / 24);

        return { ...mem, relevanceScore: score };
      });

      scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
      memoryContext.relevantFacts = scored.slice(0, 5);

      // Touch accessed memory items for frequency tracking
      const touchedIds = [...pinned, ...memoryContext.relevantFacts].map((m) => m._id);
      if (touchedIds.length > 0) {
        AgentMemory.updateMany(
          { _id: { $in: touchedIds } },
          { $set: { lastAccessedAt: new Date() }, $inc: { accessCount: 1 } }
        ).exec().catch(() => {});
      }

      // 4. Fetch Recent Episodic Healthcare Milestones
      memoryContext.recentMilestones = await this.getRecentEpisodes(userId, 3);

      // 5. Fetch Procedural Reflection Summary
      const reflection = await AgentMemory.findOne({
        user: userId,
        tier: "procedural",
        key: "cognitive_reflection_summary"
      }).lean();
      memoryContext.reflection = reflection?.value || null;

      // 6. Format Compact, High-Density System Context Block for LLM / Agents
      const promptLines = [];

      if (memoryContext.pinnedFacts.length > 0) {
        promptLines.push("CRITICAL CLINICAL FLAGS & ALLERGIES:");
        memoryContext.pinnedFacts.forEach((f) => {
          promptLines.push(`  * ${this._formatMemoryEntry(f)}`);
        });
      }

      if (memoryContext.relevantFacts.length > 0) {
        promptLines.push("PATIENT RECALLED PREFERENCES & FACTS:");
        memoryContext.relevantFacts.forEach((f) => {
          promptLines.push(`  * ${this._formatMemoryEntry(f)}`);
        });
      }

      if (memoryContext.recentMilestones.length > 0) {
        promptLines.push("RECENT HEALTHCARE ENCOUNTERS:");
        memoryContext.recentMilestones.forEach((m) => {
          const val = m.value || {};
          promptLines.push(`  * [${val.eventType || "event"}] ${val.summary || ""} (${val.outcome || "completed"})`);
        });
      }

      if (memoryContext.reflection?.topSpecialty) {
        promptLines.push(`PRIMARY CLINICAL AFFINITY: ${memoryContext.reflection.topSpecialty}`);
      }

      if (promptLines.length > 0) {
        memoryContext.contextPromptBlock = `\n[AROGYA AGENT MEMORY CONTEXT]\n${promptLines.join("\n")}\n`;
      }

      return memoryContext;
    } catch (err) {
      console.warn("[AgentMemorySystem] recallContext error:", err.message);
      return memoryContext;
    }
  }

  // =========================================================================
  // INGESTION ENGINE: EXTRACT & LEARN FROM EACH CONVERSATION TURN
  // =========================================================================

  /**
   * Ingest a conversation turn: update working memory, extract semantic facts,
   * record episodic milestones if an action was executed.
   */
  async ingestTurn({
    userId,
    sessionId,
    userMessage = "",
    botReply = "",
    intent = "",
    triageLevel = null,
    action = null,
    details = null
  }) {
    // 1. Working Memory Ingestion
    if (sessionId) {
      this.appendWorkingMessage(sessionId, { role: "user", content: userMessage, intent });
      this.appendWorkingMessage(sessionId, { role: "assistant", content: botReply, intent });
    }

    if (!userId) return;

    try {
      const userText = String(userMessage);

      // 2. Extract Clinical Facts / Allergies / Conditions automatically
      for (const pattern of CLINICAL_FACT_PATTERNS) {
        const match = userText.match(pattern.regex);
        if (match && match[1]) {
          const extractedVal = match[1].trim();
          const factKey = `${pattern.keyPrefix}_${extractedVal.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

          await this.rememberFact({
            userId,
            key: factKey,
            value: extractedVal,
            category: pattern.category,
            importance: pattern.importance,
            pinned: pattern.importance >= 5, // Automatically pin severe clinical facts (allergies, chronic conditions)
            tags: [pattern.keyPrefix, "auto_extracted"],
            source: "conversation_turn"
          });
        }
      }

      // 3. Record Episodic Events for Significant Milestones
      if (intent === "emergency_triage" && (triageLevel === "critical" || triageLevel === "emergency")) {
        await this.recordEpisodicEvent({
          userId,
          eventType: "emergency_triage_alert",
          summary: `Critical emergency triage alert triggered: ${userMessage.slice(0, 80)}`,
          outcome: "sos_alert_dispatched",
          importance: 5,
          metadata: { triageLevel, userMessage }
        });
      } else if (intent === "appointment_booking" && action === "book_appointment") {
        await this.recordEpisodicEvent({
          userId,
          eventType: "appointment_booking_initiated",
          summary: `Appointment consultation search for specialist: ${details?.doctor || details?.specialty || "Specialist"}`,
          outcome: "in_progress",
          importance: 4,
          metadata: details || {}
        });
      }
    } catch (err) {
      console.warn("[AgentMemorySystem] ingestTurn notice:", err.message);
    }
  }

  // =========================================================================
  // HELPER UTILITIES
  // =========================================================================

  _formatMemoryEntry(mem) {
    const key = String(mem.key || "").replace(/_/g, " ");
    const val = typeof mem.value === "object" ? JSON.stringify(mem.value) : String(mem.value);
    const pinnedMark = mem.pinned ? " [PINNED]" : "";
    return `${key}: ${val}${pinnedMark}`;
  }

  _sanitizeData(data) {
    if (!data) return data;
    if (typeof data === "string") {
      return data.replace(/(?:password|secret|cvv|api_key|jwt|token)\s*[:=]\s*[^\s,]+/gi, "[REDACTED]");
    }
    if (typeof data === "object") {
      try {
        const copy = JSON.parse(JSON.stringify(data));
        const redactKeys = ["password", "secret", "cvv", "api_key", "token", "jwt", "pin"];
        const recurse = (obj) => {
          for (const k of Object.keys(obj)) {
            if (redactKeys.some((rk) => k.toLowerCase().includes(rk))) {
              obj[k] = "[REDACTED]";
            } else if (typeof obj[k] === "object" && obj[k] !== null) {
              recurse(obj[k]);
            }
          }
        };
        recurse(copy);
        return copy;
      } catch (e) {
        return data;
      }
    }
    return data;
  }
}

const agentMemorySystem = new AgentMemorySystem();

module.exports = {
  AgentMemorySystem,
  agentMemorySystem
};
