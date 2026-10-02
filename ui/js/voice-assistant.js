/**
 * voice-assistant.js - Free Browser Web Speech API Voice Dictation
 * 100% Free of cost - Zero external cloud API keys or billing required.
 * Supports English (en-IN / en-US) & Hindi (hi-IN) voice dictation.
 */

export function isSpeechRecognitionSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function setupVoiceDictation({
  buttonEl,
  inputEl,
  statusEl = null,
  lang = "en-IN",
  onResult = null,
  onStart = null,
  onEnd = null
}) {
  if (!buttonEl || !inputEl) return null;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    buttonEl.title = "Voice recognition is not supported in this browser (use Chrome or Edge)";
    buttonEl.addEventListener("click", () => {
      if (window.toast) {
        window.toast("Voice speech recognition is not supported in this browser. Please use Chrome or Edge.", "warning");
      } else {
        alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      }
    });
    return null;
  }

  let recognition = null;
  let isListening = false;

  const updateUI = (listening, message = "") => {
    isListening = listening;
    buttonEl.classList.toggle("listening", listening);

    const micIcon = buttonEl.querySelector(".mic-icon");
    const micLabel = buttonEl.querySelector(".mic-label");

    if (micIcon) {
      micIcon.textContent = listening ? "⏹️" : "🎙️";
    }
    if (micLabel) {
      micLabel.textContent = listening ? "Stop" : "Speak";
    }

    if (statusEl) {
      if (listening) {
        statusEl.style.display = "block";
        statusEl.innerHTML = `<span style="color:#ef4444;font-weight:700">🔴 Listening...</span> Speak your symptoms clearly (${lang === "hi-IN" ? "Hindi / " : ""}English)`;
      } else if (message) {
        statusEl.style.display = "block";
        statusEl.textContent = message;
        setTimeout(() => {
          if (!isListening) statusEl.style.display = "none";
        }, 4000);
      } else {
        statusEl.style.display = "none";
      }
    }
  };

  const startListening = () => {
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      let recognizedText = "";

      recognition.onstart = () => {
        updateUI(true);
        if (onStart) onStart();
      };

      recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            recognizedText += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const currentText = (recognizedText + " " + interimTranscript).trim();
        if (currentText) {
          inputEl.value = currentText;
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };

      recognition.onerror = (event) => {
        console.warn("[VoiceAssistant] Speech recognition error:", event.error);
        let msg = "Voice dictation stopped.";
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          msg = "Microphone permission denied. Please allow microphone access in browser.";
        } else if (event.error === "no-speech") {
          msg = "No speech detected. Please speak closer to microphone.";
        }
        updateUI(false, msg);
        if (window.toast && event.error !== "no-speech") {
          window.toast(msg, "warning");
        }
      };

      recognition.onend = () => {
        updateUI(false);
        const finalText = inputEl.value.trim();
        if (finalText && onResult) {
          onResult(finalText);
        }
        if (onEnd) onEnd(finalText);
      };

      recognition.start();
    } catch (err) {
      console.error("[VoiceAssistant] Error starting speech recognition:", err);
      updateUI(false, "Could not start microphone.");
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (e) {
        // ignore
      }
      updateUI(false);
    }
  };

  buttonEl.addEventListener("click", () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  return {
    start: startListening,
    stop: stopListening,
    isListening: () => isListening
  };
}
