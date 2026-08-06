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

  let isVerifyingTotp = false;

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await parseApiResponse(response);

      const mfaEnabled = Boolean(
        data.user && (data.user.mfaEnabled || data.user.hasPasskey || data.user.hasTotp)
      );

      if (mfaEnabled) {
        setMessage(messageBox, "Primary login verified. Please complete 2FA verification below.", "info");

        // Show post-login 2FA section
        const mfaSection = document.getElementById("mfa-section");
        if (mfaSection) mfaSection.style.display = "flex";

        // Show passkey button ONLY if user has passkey enabled
        const passkeyBtn = document.getElementById("login-passkey-btn");
        if (passkeyBtn) {
          passkeyBtn.style.display = data.user.hasPasskey ? "block" : "none";
        }

        // Show 6-digit code container ONLY if user has TOTP enabled (or by default if 2FA active)
        const totpContainer = document.getElementById("totp-login-container");
        const totpInput = document.getElementById("totp-code-input");
        const showTotp = Boolean(data.user.hasTotp || !data.user.hasPasskey);

        if (totpContainer) {
          totpContainer.style.display = showTotp ? "flex" : "none";
        }
        if (totpInput && showTotp) {
          totpInput.value = "";
          totpInput.focus();
        }

        return; // Pause login flow until 2FA is verified
      }

      // Store session helper
      const storeAuthSession = (tokenData) => {
        const rememberCheckbox = document.getElementById("remember");
        const isRemember = rememberCheckbox ? rememberCheckbox.checked : true;
        const storage = isRemember ? localStorage : sessionStorage;

        if (tokenData.token) {
          storage.setItem(TOKEN_KEY, tokenData.token);
        }
        if (tokenData.user) {
          storage.setItem(USER_KEY, JSON.stringify(tokenData.user));
          sessionStorage.setItem(
            "arogya_user",
            JSON.stringify({
              name: tokenData.user.name,
              email: tokenData.user.email,
              role: tokenData.user.role
            })
          );
        }
      };

      // Save token & user if no 2FA required
      storeAuthSession(data);

      setMessage(messageBox, "Login successful. Redirecting...", "success");
      setTimeout(() => {
        window.location.href = redirectByRole(data.user?.role);
      }, 500);
    } catch (error) {
      setMessage(messageBox, error.message, "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign In";
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

    const email = document.getElementById("email")?.value?.trim();

    try {
      const response = await fetch(`${API_BASE}/passkey/login-options?email=${encodeURIComponent(email)}`);
      const options = await parseApiResponse(response);

      const assertion = await navigator.credentials.get({ publicKey: options });

      const authResponse = await fetch(`${API_BASE}/passkey/login-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: assertion.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
          response: {
            authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
            signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature))),
            userHandle: assertion.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(assertion.response.userHandle))) : null
          }
        })
      });

      const data = await parseApiResponse(authResponse);

      storeAuthSession(data);

      setMessage(messageBox, "Passkey verified! Opening dashboard...", "success");
      setTimeout(() => {
        window.location.href = redirectByRole(data.user?.role);
      }, 500);
    } catch (error) {
      setMessage(messageBox, error.message, "error");
    } finally {
      if (passkeyBtn) {
        passkeyBtn.disabled = false;
        passkeyBtn.textContent = "🔑 Verify with Biometric Passkey / Fingerprint";
      }
    }
  };

  const handleTotpLogin = async () => {
    if (isVerifyingTotp) return;
    const messageBox = document.getElementById("formMessage");
    const totpInput = document.getElementById("totp-code-input");
    const totpCode = totpInput?.value?.trim();
    const email = document.getElementById("email")?.value?.trim();

    if (!totpCode || totpCode.length !== 6 || !/^\d{6}$/.test(totpCode)) {
      setMessage(messageBox, "Please enter a valid 6-digit numeric code.", "error");
      return;
    }

    isVerifyingTotp = true;
    setMessage(messageBox, "Verifying 6-digit code...", "info");

    try {
      const response = await fetch(`${API_BASE}/login/totp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: totpCode })
      });
      const data = await parseApiResponse(response);

      storeAuthSession(data);

      setMessage(messageBox, "2FA Verified! Opening dashboard...", "success");
      setTimeout(() => {
        window.location.href = redirectByRole(data.user?.role);
      }, 400);
    } catch (error) {
      setMessage(messageBox, error.message, "error");
      if (totpInput) {
        totpInput.value = "";
        totpInput.focus();
      }
    } finally {
      isVerifyingTotp = false;
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
      // Check if user is already logged in with Remember Me / active session
      const existingToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      const existingUserStr = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      if (existingToken && existingUserStr) {
        try {
          const userObj = JSON.parse(existingUserStr);
          if (userObj && userObj.role) {
            window.location.href = redirectByRole(userObj.role);
            return;
          }
        } catch (e) {}
      }

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

    const loginTotpBtn = document.getElementById("login-totp-btn");
    if (loginTotpBtn) {
      loginTotpBtn.addEventListener("click", handleTotpLogin);
    }

    // Auto-process verification when user inputs 6 digits
    const totpInput = document.getElementById("totp-code-input");
    if (totpInput) {
      totpInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (val.length === 6 && /^\d{6}$/.test(val)) {
          handleTotpLogin();
        }
      });
    }

    if (registerForm) {
      bindFormHandler(registerForm, handleRegister, "registerBound");
    }
  });
})();
