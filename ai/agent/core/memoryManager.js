/**
 * 💾 Arogy AI Agent - Memory Manager
 * Manages short-term conversation context, user preferences, long-term factual memories,
 * and semantic similarity search with user deletion privacy controls.
 */

const AgentMemory = require("../../../models/AgentMemory");
const { agentMemorySystem } = require("../../agentMemorySystem");

class MemoryManager {
  constructor() {
    this.agentMemorySystem = agentMemorySystem;
    this.sessionCache = agentMemorySystem.sessionCache; // short-term session storage
  }

  /**
   * Appends a message to short-term session memory
   */
  appendSessionMessage(sessionId, message) {
    return this.agentMemorySystem.appendWorkingMessage(sessionId, message);
  }

  getSessionHistory(sessionId) {
    const session = this.agentMemorySystem._ensureSession(sessionId);
    return session ? session.history : [];
  }

  clearSession(sessionId) {
    this.agentMemorySystem.clearWorkingSession(sessionId);
  }

  /**
   * Stores long-term memory entry
   * @param {Object} memoryData
   */
  async setMemory({ userId, type = "fact", key, value, category = "general", tags = [] }) {
    if (!userId || !key) return null;

    // Redact any potential credential leakage
    const cleanValue = this._sanitizeSensitiveData(value);

    try {
      const memory = await AgentMemory.findOneAndUpdate(
        { user: userId, key },
        {
          user: userId,
          type,
          key,
          value: cleanValue,
          category,
          tags,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      return memory;
    } catch (err) {
      console.error("[MemoryManager] Error saving memory:", err.message);
      return null;
    }
  }

  /**
   * Retrieves long-term memory for a user
   */
  async getMemories(userId, category = null) {
    if (!userId) return [];
    try {
      const query = { user: userId };
      if (category) query.category = category;
      return await AgentMemory.find(query).sort({ updatedAt: -1 }).lean();
    } catch (e) {
      return [];
    }
  }

  /**
   * Deletes a specific memory entry (User Privacy Control)
   */
  async deleteMemory(memoryId, userId) {
    try {
      return await AgentMemory.findOneAndDelete({ _id: memoryId, user: userId });
    } catch (e) {
      return null;
    }
  }

  /**
   * Performs semantic / keyword similarity search across memories
   */
  async searchMemories(userId, searchTerm) {
    if (!userId || !searchTerm) return [];
    const term = searchTerm.toLowerCase();
    try {
      const all = await AgentMemory.find({ user: userId }).lean();
      return all.filter(m => {
        const kMatch = m.key.toLowerCase().includes(term);
        const vMatch = JSON.stringify(m.value).toLowerCase().includes(term);
        const tMatch = (m.tags || []).some(t => t.toLowerCase().includes(term));
        return kMatch || vMatch || tMatch;
      });
    } catch (e) {
      return [];
    }
  }

  _sanitizeSensitiveData(data) {
    if (!data) return data;
    const str = typeof data === "string" ? data : JSON.stringify(data);
    if (/password|secret|cvv|api_key|token/i.test(str)) {
      if (typeof data === "object") {
        const copy = { ...data };
        for (const k of Object.keys(copy)) {
          if (/password|secret|cvv|key|token/i.test(k)) copy[k] = "[REDACTED]";
        }
        return copy;
      }
      return "[REDACTED_SENSITIVE_CONTENT]";
    }
    return data;
  }
}

module.exports = {
  MemoryManager,
  memoryManager: new MemoryManager()
};
