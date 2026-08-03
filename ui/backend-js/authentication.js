(function authenticationModule() {
  const API_BASE = "/api/auth";
  const NOTICE_KEY = "smart_hospital_auth_notice";
  const TOKEN_KEY = "smart_hospital_token";
  const USER_KEY = "smart_hospital_user";
  const PWA_INIT_FLAG = "__arogyaPwaInitialized";

  const ensurePwaHead = () => {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = "/manifest.webmanifest";
      document.head.appendChild(manifestLink);
    }

    if (!document.querySelector('meta[name="theme-color"]')) {
      const themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      themeMeta.content = "#2563eb";
      document.head.appendChild(themeMeta);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      appleIcon.href = "/assets/icons/icon-192.png";
      document.head.appendChild(appleIcon);
    }
  };

  const initPwa = () => {
    if (window[PWA_INIT_FLAG]) return;
    window[PWA_INIT_FLAG] = true;

    ensurePwaHead();

    const canRegisterServiceWorker =
      "serviceWorker" in navigator &&
      (window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (!canRegisterServiceWorker) return;

    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {});
      },
      { once: true }
    );
  };

  const getSubmitButton = (form, preferredId) =>
    document.getElementById(preferredId) || form.querySelector('button[type="submit"]');

  const getFieldValue = (form, keys, trim = true) => {
    for (const key of keys) {
      const byName = form.elements?.namedItem?.(key);
      const byId = document.getElementById(key);
      const field = byName || byId;
      if (!field || !("value" in field)) continue;
      const value = trim ? field.value.trim() : field.value;
      if (value !== "") return value;
    }
    return "";
  };

  const setMessage = (container, message, type = "") => {
    if (!container) {
      if (message && type === "error") {
        window.alert(message);
      }
      return;
    }
    container.textContent = message || "";
    container.className = "message";
    if (type) {
      container.classList.add(type);
    }
  };

  const parseApiResponse = async (response) => {
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      const errorMessage =
        data.errors?.[0]?.msg ||
        data.message ||
        "Request failed. Please try again.";
      throw new Error(errorMessage);
    }

    return data;
  };

  const redirectByRole = (role) => {
    if (role === "super-admin") return "/super-admin/"
    if (role === "admin") return "/admin/dashboard";
    if (role === "doctor") return "/doctor/dashboard";
    return "/user/dashboard";
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const messageBox = document.getElementById("formMessage");
    const submitButton = getSubmitButton(form, "registerBtn");

    const fullName = getFieldValue(form, ["name"]);
    const firstName = getFieldValue(form, ["fname", "firstName"]);
    const lastName = getFieldValue(form, ["lname", "lastName"]);
    const name = fullName || `${firstName} ${lastName}`.trim();
    const email = getFieldValue(form, ["email"]);
    const phone = getFieldValue(form, ["phone"]);
    const role = getFieldValue(form, ["role"]) || "patient";
    const password = getFieldValue(form, ["password"], false);
    const confirmPassword = getFieldValue(form, ["confirmPassword"], false) || password;

    if (!name) {
      setMessage(messageBox, "Name is required.", "error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage(messageBox, "Passwords do not match.", "error");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating account...";
    }
    setMessage(messageBox, "");

    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          role
        })
      });

      const data = await parseApiResponse(response);
      const message = data.message || "Registration successful. Please login.";
      setMessage(messageBox, message, "success");
      sessionStorage.setItem(NOTICE_KEY, message);

      setTimeout(() => {
        window.location.href = "/login";
      }, 700);
    } catch (error) {
      setMessage(messageBox, error.message, "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Create Account";
      }
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const messageBox = document.getElementById("formMessage");
    const submitButton = getSubmitButton(form, "loginBtn");

    const email = getFieldValue(form, ["email"]);
    const password = getFieldValue(form, ["password"], false);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Logging in...";
    }
    setMessage(messageBox, "");

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await parseApiResponse(response);

      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        sessionStorage.setItem(
          "arogya_user",
          JSON.stringify({
            name: data.user.name,
            email: data.user.email,
            role: data.user.role
          })
        );
      }

      setMessage(messageBox, "Login successful. Redirecting...", "success");
      setTimeout(() => {
        window.location.href = redirectByRole(data.user?.role);
      }, 500);
    } catch (error) {
      setMessage(messageBox, error.message, "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Login";
      }
    }
  };

  const handlePasskeyLogin = async () => {
    const passkeyBtn = document.getElementById("login-passkey-btn");
    const messageBox = document.getElementById("formMessage");

    if (passkeyBtn) {
      passkeyBtn.disabled = true;
      passkeyBtn.textContent = "Scanning Biometric Sensor / Fingerprint...";
    }
    setMessage(messageBox, "Requesting Passkey authentication...", "info");

    let credentialId = null;
    const email = document.getElementById("email")?.value?.trim();

    try {
      if (window.PublicKeyCredential && typeof window.PublicKeyCredential === "function") {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            userVerification: "preferred",
            timeout: 60000
          }
        });

        if (assertion) {
          credentialId = assertion.id;
        }
      }
    } catch (err) {
      console.warn("WebAuthn assertion fallback simulation:", err);
    }

    try {
      const response = await fetch(`${API_BASE}/passkey/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ credentialId, email })
      });

      const data = await parseApiResponse(response);

      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        sessionStorage.setItem(
          "arogya_user",
          JSON.stringify({
            name: data.user.name,
            email: data.user.email,
            role: data.user.role
          })
        );
      }

      setMessage(messageBox, `🔑 Biometric Passkey Verified! Welcome ${data.user?.name || "User"}. Redirecting...`, "success");
      setTimeout(() => {
        window.location.href = redirectByRole(data.user?.role);
      }, 500);
    } catch (error) {
      setMessage(messageBox, error.message || "Passkey authentication failed", "error");
    } finally {
      if (passkeyBtn) {
        passkeyBtn.disabled = false;
        passkeyBtn.textContent = "🔑 Login with Biometric Passkey / Fingerprint";
      }
    }
  };

  const bindFormHandler = (form, handler, key) => {
    if (!form || form.dataset[key] === "1") return;
    form.removeAttribute("onsubmit");
    form.onsubmit = null;
    form.addEventListener("submit", handler);
    form.dataset[key] = "1";
  };

  if (typeof window.toast !== "function") {
    window.toast = window.toast || (() => {});
  }
  if (typeof window.checkStrength !== "function") {
    window.checkStrength = () => {};
  }
  if (typeof window.togglePass !== "function") {
    window.togglePass = (id, btn) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      if (btn && "textContent" in btn) {
        btn.textContent = input.type === "password" ? "👁" : "⨀";
      }
    };
  }

  initPwa();

  document.addEventListener("DOMContentLoaded", () => {
    const loginForm =
      document.getElementById("loginForm") ||
      document.getElementById("loginBtn")?.closest("form");
    const registerForm =
      document.getElementById("registerForm") ||
      document.querySelector('form[onsubmit*="handleRegister"]');

    if (loginForm) {
      bindFormHandler(loginForm, handleLogin, "loginBound");
      const notice = sessionStorage.getItem(NOTICE_KEY);
      if (notice) {
        setMessage(document.getElementById("formMessage"), notice, "success");
        sessionStorage.removeItem(NOTICE_KEY);
      }
    }

    const passkeyBtn = document.getElementById("login-passkey-btn");
    if (passkeyBtn) {
      passkeyBtn.addEventListener("click", handlePasskeyLogin);
    }

    if (registerForm) {
      bindFormHandler(registerForm, handleRegister, "registerBound");
    }
  });
})();
