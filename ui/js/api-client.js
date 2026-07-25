const TOKEN_KEY = "smart_hospital_token";
const USER_KEY = "smart_hospital_user";
const SESSION_USER_KEY = "arogya_user";
const PWA_INIT_FLAG = "__arogyaPwaInitialized";

const ensurePwaHead = () => {
  if (typeof document === "undefined") return;

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

const isServiceWorkerAllowed = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

const initPwa = () => {
  if (typeof window === "undefined") return;
  if (window[PWA_INIT_FLAG]) return;
  window[PWA_INIT_FLAG] = true;

  ensurePwaHead();

  if (!isServiceWorkerAllowed()) return;
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {});
    },
    { once: true }
  );
};

initPwa();

const parseJson = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
};

const urlBase64ToUint8Array = (base64String = "") => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const getAuthState = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  const localUser = parseJson(localStorage.getItem(USER_KEY));
  const sessionUser = parseJson(sessionStorage.getItem(SESSION_USER_KEY));
  const user = localUser || sessionUser || null;
  return { token, user };
};

export const clearAuthState = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
};

export const ensureSession = ({
  allowedRoles = [],
  redirectTo = "/login",
  onDenied
} = {}) => {
  const { token, user } = getAuthState();
  const roleAllowed = !allowedRoles.length || (user && allowedRoles.includes(user.role));
  const allowed = Boolean(token && user && roleAllowed);

  if (!allowed && typeof onDenied === "function") {
    onDenied();
  }

  if (!allowed && redirectTo) {
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 500);
  }

  return { allowed, token, user };
};

export const apiRequest = async (url, options = {}) => {
  const { token } = getAuthState();
  const headers = {
    ...(options.headers || {})
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : {};
  }

  if (!response.ok) {
    const message = data?.errors?.[0]?.msg || data?.message || "Request failed";
    if (
      response.status === 401 ||
      message === "Invalid or expired token" ||
      message === "Authorization token missing" ||
      message === "User not found"
    ) {
      clearAuthState();
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
    throw new Error(message);
  }

  return data || {};
};

export const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

export const formatCurrencyINR = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  });

export const downloadTextFile = (fileName, content) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName || "download.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
};

export const isPushNotificationSupported = () => {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
};

export const subscribeToPushNotifications = async () => {
  if (!isPushNotificationSupported()) {
    throw new Error("Push notifications are not supported on this device/browser");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission denied");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const keyResponse = await apiRequest("/api/notifications/vapid-public-key");
    const publicKey = String(keyResponse.publicKey || "");
    if (!publicKey) {
      throw new Error("VAPID public key is missing on server");
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  await apiRequest("/api/notifications/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription })
  });

  return { success: true, subscription };
};

export const unsubscribeFromPushNotifications = async () => {
  if (!("serviceWorker" in navigator)) return { success: true };

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { success: true };

  await apiRequest("/api/notifications/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });

  await subscription.unsubscribe();
  return { success: true };
};

export const sendTestPushNotification = async (payload = {}) => {
  return apiRequest("/api/notifications/test", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

if (typeof window !== "undefined") {
  window.enableMobileNotifications = subscribeToPushNotifications;
  window.disableMobileNotifications = unsubscribeFromPushNotifications;
  window.sendTestMobileNotification = sendTestPushNotification;
}
