/**
 * 🤖 ArogyaPlus - Hugging Face AI Client
 * Handles communication with Hugging Face Serverless Inference API / Router.
 * Provides resilient fallback to local clinical NLP when API key is not configured or service is unavailable.
 */

const DEFAULT_MODEL = process.env.HUGGINGFACE_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct";
const HF_ROUTER_URL = "https://router.huggingface.co/hf-inference/models";
const HF_LEGACY_URL = "https://api-inference.huggingface.co/models";

class HuggingFaceClient {
  constructor(apiKey = null, defaultModel = DEFAULT_MODEL) {
    this.apiKey = apiKey || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "";
    this.defaultModel = defaultModel;
    this.timeoutMs = 12000;
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5 && !this.apiKey.includes("your_"));
  }

  /**
   * Generates text response using Hugging Face Inference API with fallback.
   * @param {Object} options
   * @param {string} options.prompt - The prompt or instructions
   * @param {string} [options.systemPrompt] - System instructions
   * @param {string} [options.model] - Specific model override
   * @param {number} [options.maxTokens] - Maximum tokens to generate
   * @param {number} [options.temperature] - Sampling temperature
   * @param {Function} [options.fallbackFn] - Heuristic fallback function
   * @returns {Promise<string>}
   */
  async generateText({
    prompt,
    systemPrompt = "You are Arogya AI, a helpful, empathetic, and knowledgeable clinical medical assistant.",
    model = this.defaultModel,
    maxTokens = 256,
    temperature = 0.5,
    fallbackFn = null
  }) {
    if (!this.isConfigured) {
      if (typeof fallbackFn === "function") {
        return fallbackFn(prompt);
      }
      return this._defaultLocalFallback(prompt);
    }

    try {
      const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`;
      const url = `${HF_ROUTER_URL}/${model}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: maxTokens,
            temperature,
            return_full_text: false
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (typeof fallbackFn === "function") {
          return fallbackFn(prompt);
        }
        return this._defaultLocalFallback(prompt);
      }

      const data = await response.json();
      let generatedText = "";

      if (Array.isArray(data) && data[0]?.generated_text) {
        generatedText = data[0].generated_text.trim();
      } else if (typeof data === "object" && data?.generated_text) {
        generatedText = data.generated_text.trim();
      }

      if (generatedText) {
        return generatedText.replace(/^Assistant:\s*/i, "").trim();
      }

      if (typeof fallbackFn === "function") {
        return fallbackFn(prompt);
      }
      return this._defaultLocalFallback(prompt);
    } catch (err) {
      if (typeof fallbackFn === "function") {
        return fallbackFn(prompt);
      }
      return this._defaultLocalFallback(prompt);
    }
  }

  _defaultLocalFallback(prompt) {
    const p = String(prompt || "").toLowerCase();
    if (p.includes("fever") || p.includes("temperature")) {
      return "For a mild fever, stay well hydrated, rest, and monitor your temperature every 4-6 hours. If your fever exceeds 102°F (38.9°C) or lasts more than 3 days, please schedule a consultation with an ArogyaPlus general physician.";
    }
    if (p.includes("headache") || p.includes("migraine")) {
      return "Headaches can be triggered by stress, dehydration, lack of sleep, or screen strain. Try resting in a dim, quiet room and hydrating. If you experience sudden, severe headache with visual disturbance or neck stiffness, seek emergency care.";
    }
    if (p.includes("appointment") || p.includes("doctor") || p.includes("schedule")) {
      return "You can easily schedule an appointment through our online clinical scheduling portal. Choose your specialty, select your preferred doctor, and pick an available time slot.";
    }
    return "Thank you for consulting Arogya AI. For tailored medical guidance, please describe any specific symptoms you are experiencing, or book a consultation with one of our specialized doctors.";
  }
}

module.exports = {
  HuggingFaceClient,
  huggingFaceClient: new HuggingFaceClient()
};
