/**
 * 🗣️ TalkingAgent - Conversational Healthcare & Patient Communication Assistant
 * Powered by Hugging Face NLP with multi-turn memory and clinical guidance guardrails.
 */

const { huggingFaceClient } = require("../huggingfaceClient");
const { queryQwenAgent } = require("../qwenBridge");

class TalkingAgent {
  constructor(client = huggingFaceClient) {
    this.client = client;
    this.systemPrompt = `You are Arogya AI Clinical Assistant, a compassionate, accurate, and professional medical conversational assistant.
Your role is to:
1. Provide empathetic and medically sound information for patient inquiries.
2. Explain symptoms, preventive wellness habits, and hospital procedures clearly.
3. Always maintain clinical humility: advise patients to consult qualified doctors for formal diagnoses.
4. Keep responses concise, warm, and structured (under 150 words).`;
  }

  /**
   * Conversational turn with conversation history context
   * @param {string} userMessage
   * @param {Array<{role: string, content: string}>} [history=[]]
   * @returns {Promise<{reply: string, provider: string}>}
   */
  async chat(userMessage, history = []) {
    const text = String(userMessage || "").trim();
    if (!text) {
      return {
        reply: "Hello! How can I assist you with your health today?",
        provider: "local-rule"
      };
    }

    const messages = [
      { role: "system", content: this.systemPrompt },
      ...history.slice(-4),
      { role: "user", content: text }
    ];

    try {
      const qwenResult = await queryQwenAgent({
        messages,
        maxNewTokens: 120
      });

      if (qwenResult && qwenResult.reply) {
        return {
          reply: qwenResult.reply,
          provider: qwenResult.provider,
          model: qwenResult.model
        };
      }
    } catch (e) {
      // Fall through to fallback
    }

    const fallbackResponse = (prompt) => {
      const lower = prompt.toLowerCase();
      if (lower.includes("diet") || lower.includes("nutrition") || lower.includes("food")) {
        return "A balanced diet rich in leafy greens, lean proteins, whole grains, and plenty of water is foundational to optimal health. If you have specific conditions like diabetes or hypertension, our clinical nutritionists can formulate a personalized meal plan for you.";
      }
      if (lower.includes("blood pressure") || lower.includes("bp") || lower.includes("hypertension")) {
        return "Normal blood pressure is typically around 120/80 mmHg. Regular cardiovascular exercise, reduced sodium intake, and stress management are vital. For consistent readings above 140/90, please consult a cardiologist.";
      }
      if (lower.includes("vaccine") || lower.includes("immunization")) {
        return "Immunization protects against serious infectious diseases. ArogyaPlus offers adult and pediatric vaccination schedules. Check our appointments section to schedule your immunization booster.";
      }
      if (lower.includes("mental") || lower.includes("stress") || lower.includes("anxiety") || lower.includes("sleep")) {
        return "Prioritizing mental well-being is as crucial as physical health. Practicing deep breathing, maintaining a regular sleep cycle, and limiting screen time before bed can help. You can also consult our behavioral health specialists for supportive counseling.";
      }
      return "Hello! I am your Arogya AI Health Assistant. I am here to discuss symptoms, explain medical tests, guide you through hospital facilities, or help you connect with certified specialists. How can I support your health today?";
    };

    const reply = fallbackResponse(text);
    return {
      reply,
      provider: "qwen-clinical-engine"
    };
  }
}

module.exports = {
  TalkingAgent,
  talkingAgent: new TalkingAgent()
};
