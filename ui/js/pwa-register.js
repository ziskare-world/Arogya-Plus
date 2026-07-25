(function pwaRegister() {
  const PWA_INIT_FLAG = "__arogyaPwaInitialized";
  if (window[PWA_INIT_FLAG]) return;
  window[PWA_INIT_FLAG] = true;

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
})();
