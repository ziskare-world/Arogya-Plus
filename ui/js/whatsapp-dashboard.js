// ui/js/whatsapp-dashboard.js
// Client-side script for the WhatsApp integration dashboard.
// Handles connection status, QR code display, and sending text/media messages.

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('connection-status');
  const qrSection = document.getElementById('qr-section');
  const qrCodeDiv = document.getElementById('qr-code');
  const sendTextBtn = document.getElementById('send-text-btn');
  const sendMediaBtn = document.getElementById('send-media-btn');
  const textResult = document.getElementById('text-result');
  const mediaResult = document.getElementById('media-result');

  const API_BASE = 'http://localhost:2836/api/whatsapp';

  // Helper to update status UI
  async function updateStatus() {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      if (data.connected) {
        statusEl.textContent = 'Connected';
        statusEl.style.color = 'var(--accent)';
        qrSection.style.display = 'none';
      } else {
        statusEl.textContent = 'Not Connected';
        statusEl.style.color = 'var(--error)';
        // Show QR if available
        showQrCode();
      }
    } catch (e) {
      statusEl.textContent = 'Error checking status';
      statusEl.style.color = 'var(--error)';
    }
  }

  // Fetch and display QR code
  async function showQrCode() {
    try {
      const res = await fetch(`${API_BASE}/qr`);
      if (!res.ok) return; // QR not ready yet
      const { qr } = await res.json();
      qrCodeDiv.innerHTML = `<img src="${qr}" alt="WhatsApp QR Code" />`;
      qrSection.style.display = 'block';
    } catch (e) {
      console.error('Failed to fetch QR code', e);
    }
  }

  // Send text message
  sendTextBtn?.addEventListener('click', async () => {
    const to = document.getElementById('to-number').value.trim();
    const message = document.getElementById('message-text').value.trim();
    if (!to || !message) {
      textResult.textContent = 'Please provide both number and message.';
      return;
    }
    sendTextBtn.disabled = true;
    textResult.textContent = 'Sending...';
    try {
      const res = await fetch(`${API_BASE}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      const data = await res.json();
      if (data.success) {
        textResult.textContent = 'Message sent successfully.';
      } else {
        textResult.textContent = `Error: ${data.error || 'unknown'}`;
      }
    } catch (e) {
      textResult.textContent = `Request failed: ${e.message}`;
    } finally {
      sendTextBtn.disabled = false;
    }
  });

  // Send media (image/document)
  sendMediaBtn?.addEventListener('click', async () => {
    const to = document.getElementById('media-to').value.trim();
    const fileInput = document.getElementById('media-file');
    const caption = document.getElementById('media-caption').value.trim();
    if (!to || !fileInput.files.length) {
      mediaResult.textContent = 'Please provide a recipient and select a file.';
      return;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('to', to);
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    sendMediaBtn.disabled = true;
    mediaResult.textContent = 'Uploading...';
    try {
      const res = await fetch(`${API_BASE}/send-media`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        mediaResult.textContent = 'Media sent successfully.';
      } else {
        mediaResult.textContent = `Error: ${data.error || 'unknown'}`;
      }
    } catch (e) {
      mediaResult.textContent = `Request failed: ${e.message}`;
    } finally {
      sendMediaBtn.disabled = false;
    }
  });

  // Initial status check
  updateStatus();

  // Poll status every 10 seconds
  setInterval(updateStatus, 10000);
});
