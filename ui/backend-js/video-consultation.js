import { toast } from "../js/utils.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;

const query = new URLSearchParams(window.location.search);
const requestedRole = String(query.get("role") || "").trim().toLowerCase();
const requestedRoomKey = String(query.get("roomKey") || "").trim();
const requestedAppointmentId = String(query.get("appointmentId") || "").trim();
const requestedPatientName = decodeURIComponent(String(query.get("patient") || "").trim());
const requestedDoctorName = decodeURIComponent(String(query.get("doctor") || "").trim());

const prejoinPanelEl = document.getElementById("prejoin-panel");
const prejoinTitleEl = document.getElementById("prejoin-title");
const callPanelEl = document.getElementById("call-panel");
const videoSubtitleEl = document.getElementById("video-subtitle");
const connectionPillEl = document.getElementById("connection-pill");
const leaveCallBtnEl = document.getElementById("leave-call-btn");

const displayNameInputEl = document.getElementById("display-name-input");
const emailInputEl = document.getElementById("email-input");
const roomKeyInputEl = document.getElementById("room-key-input");
const appointmentIdInputEl = document.getElementById("appointment-id-input");
const generateRoomBtnEl = document.getElementById("generate-room-btn");
const copyRoomBtnEl = document.getElementById("copy-room-btn");
const joinRoomBtnEl = document.getElementById("join-room-btn");
const roomHelpLineEl = document.getElementById("room-help-line");

const localVideoEl = document.getElementById("local-video");
const remoteVideoGridEl = document.getElementById("remote-video-grid");
const toggleMicBtnEl = document.getElementById("toggle-mic-btn");
const toggleCamBtnEl = document.getElementById("toggle-cam-btn");
const switchCameraBtnEl = document.getElementById("switch-camera-btn");
const toggleScreenBtnEl = document.getElementById("toggle-screen-btn");
const markCompleteBtnEl = document.getElementById("mark-complete-btn");
const activeRoomKeyEl = document.getElementById("active-room-key");
const activeRoleEl = document.getElementById("active-role");
const participantsListEl = document.getElementById("participants-list");
const chatMessagesEl = document.getElementById("chat-messages");
const chatFormEl = document.getElementById("chat-form");
const chatInputEl = document.getElementById("chat-input");
const feedbackSectionEl = document.getElementById("feedback-section");
const ratingStatusLineEl = document.getElementById("rating-status-line");
const openRatingPopupBtnEl = document.getElementById("open-rating-popup-btn");
const videoRatingModalEl = document.getElementById("video-rating-modal");
const videoRatingCloseBtnEl = document.getElementById("video-rating-close-btn");
const videoRatingCancelBtnEl = document.getElementById("video-rating-cancel-btn");
const videoRatingDoctorLabelEl = document.getElementById("video-rating-doctor-label");
const videoRatingStarsEl = document.getElementById("video-rating-stars");
const videoRatingValueLabelEl = document.getElementById("video-rating-value-label");
const doctorReviewInputEl = document.getElementById("doctor-review-input");
const submitRatingBtnEl = document.getElementById("submit-rating-btn");
const cameraPermissionStatusEl = document.getElementById("camera-permission-status");
const microphonePermissionStatusEl = document.getElementById("microphone-permission-status");
const speakerPermissionStatusEl = document.getElementById("speaker-permission-status");
const cameraDeviceSelectEl = document.getElementById("camera-device-select");
const micDeviceSelectEl = document.getElementById("mic-device-select");
const speakerDeviceSelectEl = document.getElementById("speaker-device-select");
const refreshPermissionsBtnEl = document.getElementById("refresh-permissions-btn");
const requestMediaPermissionBtnEl = document.getElementById("request-media-permission-btn");
const mediaSettingsHintEl = document.getElementById("media-settings-hint");

const TURN_STUN_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

const normalizeRoomKey = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

const createRandomRoomKey = () => {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `ROOM-${random}-${time}`;
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatClockTime = (isoTime = "") => {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const setConnectionState = (label, color = "badge-yellow") => {
  if (!connectionPillEl) return;
  connectionPillEl.className = `badge ${color}`;
  connectionPillEl.textContent = label;
};

const session = ensureSession({
  allowedRoles: ["doctor", "patient", "admin", "super-admin"],
  onDenied: () => toast("Please login to access video consultation", "error")
});

if (!session.allowed) {
  throw new Error("Session unavailable");
}

const userRole = String(session.user?.role || "").toLowerCase();
const mode =
  requestedRole === "doctor" && (userRole === "doctor" || userRole === "admin")
    ? "doctor"
    : requestedRole === "user" || requestedRole === "patient"
      ? "user"
      : userRole === "doctor" || userRole === "admin"
        ? "doctor"
        : "user";

let socket = null;
let isJoined = false;
let joinedRoomKey = "";
let mySocketId = "";
let localStream = null;
let cameraTrack = null;
let screenTrack = null;
let isScreenSharing = false;
let completionInProgress = false;
let availableVideoInputs = [];
let availableAudioInputs = [];
let availableAudioOutputs = [];
let selectedCameraId = "";
let selectedMicId = "";
let selectedSpeakerId = "";
let appointmentCompleted = false;
let ratingSubmitting = false;
let hasSubmittedRating = false;
let selectedRatingValue = 5;
let ratingDoctorName = String(requestedDoctorName || "").trim();

const participants = new Map();
const peerConnections = new Map();
const remoteStreams = new Map();

const getAppointmentId = () => String(appointmentIdInputEl?.value || "").trim();
const normalizeId = (value = "") => String(value || "").trim();

const setRatingStatusLine = (message = "") => {
  if (!ratingStatusLineEl) return;
  ratingStatusLineEl.textContent = String(message || "");
};

const setRatingDoctorLabel = () => {
  if (!videoRatingDoctorLabelEl) return;
  const safeDoctorName = String(ratingDoctorName || "").trim() || "Doctor";
  videoRatingDoctorLabelEl.textContent = `Share your consultation feedback for ${safeDoctorName}.`;
};

const renderRatingStars = () => {
  if (!videoRatingStarsEl) return;
  const starButtons = Array.from(videoRatingStarsEl.querySelectorAll("button[data-value]"));
  starButtons.forEach((button) => {
    const value = Number(button.getAttribute("data-value") || 0);
    button.classList.toggle("active", value <= selectedRatingValue);
    button.setAttribute("aria-checked", value === selectedRatingValue ? "true" : "false");
  });
  if (videoRatingValueLabelEl) {
    videoRatingValueLabelEl.textContent = `${selectedRatingValue}/5`;
  }
};

const closeRatingModal = ({ force = false } = {}) => {
  if (ratingSubmitting && !force) return;
  if (videoRatingModalEl) videoRatingModalEl.classList.add("hidden");
};

const openRatingModal = () => {
  if (mode !== "user") return;
  if (!appointmentCompleted) {
    toast("Rating is available after consultation is completed", "info");
    return;
  }
  if (hasSubmittedRating) {
    toast("Rating already submitted", "info");
    return;
  }
  setRatingDoctorLabel();
  renderRatingStars();
  if (videoRatingModalEl) videoRatingModalEl.classList.remove("hidden");
};

const updateRatingControls = () => {
  const canShowFeedback = mode === "user" && Boolean(getAppointmentId());
  if (feedbackSectionEl) {
    feedbackSectionEl.classList.toggle("hidden", !canShowFeedback);
  }
  if (!canShowFeedback) {
    closeRatingModal({ force: true });
    return;
  }

  const canSubmit = appointmentCompleted && !hasSubmittedRating && !ratingSubmitting;
  if (openRatingPopupBtnEl) {
    openRatingPopupBtnEl.disabled = !canSubmit;
    openRatingPopupBtnEl.textContent = hasSubmittedRating ? "Rating Submitted" : "Rate Doctor";
  }
  if (submitRatingBtnEl) {
    submitRatingBtnEl.disabled = !canSubmit;
    submitRatingBtnEl.textContent = ratingSubmitting ? "Submitting..." : hasSubmittedRating ? "Rating Submitted" : "Submit Rating";
  }
  if (doctorReviewInputEl) {
    doctorReviewInputEl.disabled = hasSubmittedRating || ratingSubmitting || !appointmentCompleted;
  }

  if (!hasSubmittedRating && !appointmentCompleted) {
    setRatingStatusLine("Rating is available after consultation is completed.");
    closeRatingModal({ force: true });
  }
  if (!hasSubmittedRating && appointmentCompleted) {
    setRatingStatusLine("Consultation completed. Please rate the doctor.");
  }
  if (hasSubmittedRating) {
    closeRatingModal({ force: true });
  }
};

const loadAppointmentFeedbackState = async () => {
  if (mode !== "user") {
    updateRatingControls();
    return;
  }

  const appointmentId = normalizeId(getAppointmentId());
  if (!appointmentId) {
    updateRatingControls();
    return;
  }

  try {
    const data = await apiRequest("/api/appointments/my");
    const appointment = (data.appointments || []).find(
      (item) => normalizeId(item?._id || item?.id) === appointmentId
    );
    if (!appointment) {
      updateRatingControls();
      return;
    }

    appointmentCompleted = String(appointment.status || "").toLowerCase() === "completed";
    const ratingValue = Number(appointment.doctorRating || 0);
    hasSubmittedRating = Number.isFinite(ratingValue) && ratingValue >= 1 && ratingValue <= 5;
    ratingDoctorName = String(appointment?.doctor?.name || requestedDoctorName || "").trim();
    setRatingDoctorLabel();

    if (hasSubmittedRating && doctorReviewInputEl) {
      doctorReviewInputEl.value = String(appointment.doctorReview || "");
    }
    if (!hasSubmittedRating && doctorReviewInputEl) {
      doctorReviewInputEl.value = "";
    }
    selectedRatingValue = hasSubmittedRating ? ratingValue : 5;
    renderRatingStars();

    if (hasSubmittedRating) {
      setRatingStatusLine(`You rated this doctor: ${ratingValue}/5.`);
    }
  } catch {
    // ignore transient feedback fetch issues
  } finally {
    updateRatingControls();
  }
};

const submitDoctorRating = async () => {
  if (mode !== "user") return;
  const appointmentId = normalizeId(getAppointmentId());
  if (!appointmentId) {
    toast("Appointment ID is missing", "error");
    return;
  }
  if (!appointmentCompleted) {
    toast("Rating is available only after consultation completion", "info");
    return;
  }
  if (hasSubmittedRating) {
    toast("Rating already submitted", "info");
    return;
  }

  const rating = Number(selectedRatingValue || 0);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    toast("Please select a rating from 1 to 5", "error");
    return;
  }

  const review = String(doctorReviewInputEl?.value || "").trim().slice(0, 1000);

  ratingSubmitting = true;
  updateRatingControls();
  try {
    const response = await apiRequest(`/api/appointments/${appointmentId}/rating`, {
      method: "PATCH",
      body: JSON.stringify({ rating, review })
    });
    hasSubmittedRating = true;
    appointmentCompleted = true;

    const savedRating = Number(response?.appointment?.doctorRating || rating);
    selectedRatingValue =
      Number.isFinite(savedRating) && savedRating >= 1 && savedRating <= 5 ? savedRating : rating;
    renderRatingStars();
    if (doctorReviewInputEl && response?.appointment?.doctorReview !== undefined) {
      doctorReviewInputEl.value = String(response.appointment.doctorReview || "");
    }
    closeRatingModal({ force: true });
    setRatingStatusLine(`Thanks for rating the doctor: ${savedRating}/5.`);
    toast("Doctor rating submitted", "success");
    window.setTimeout(() => {
      window.location.reload();
    }, 600);
  } catch (error) {
    toast(error.message || "Failed to submit doctor rating", "error");
  } finally {
    ratingSubmitting = false;
    updateRatingControls();
  }
};

const setMediaSettingsHint = (message = "") => {
  if (!mediaSettingsHintEl) return;
  mediaSettingsHintEl.textContent = String(message || "");
};

const permissionBadgeClass = (state = "") => {
  const normalized = String(state || "").toLowerCase();
  if (normalized === "granted") return "badge badge-green";
  if (normalized === "denied") return "badge badge-red";
  if (normalized === "prompt") return "badge badge-yellow";
  return "badge badge-cyan";
};

const updatePermissionBadge = (element, label, state) => {
  if (!element) return;
  element.className = permissionBadgeClass(state);
  element.textContent = `${label}: ${state || "unknown"}`;
};

const queryPermissionState = async (name) => {
  try {
    if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
      return "unknown";
    }
    const result = await navigator.permissions.query({ name });
    return String(result?.state || "unknown").toLowerCase();
  } catch {
    return "unknown";
  }
};

const updatePermissionStatuses = async () => {
  const [cameraState, micState] = await Promise.all([
    queryPermissionState("camera"),
    queryPermissionState("microphone")
  ]);
  updatePermissionBadge(cameraPermissionStatusEl, "Camera", cameraState);
  updatePermissionBadge(microphonePermissionStatusEl, "Mic", micState);
  if (speakerPermissionStatusEl) {
    speakerPermissionStatusEl.className = "badge badge-cyan";
    speakerPermissionStatusEl.textContent = "Speaker: browser/device setting";
  }
};

const renderDeviceOptions = ({
  selectEl,
  devices,
  selectedId,
  noneLabel,
  numberedPrefix,
  allowBrowserDefault = false
}) => {
  if (!selectEl) return;

  const options = [];
  if (allowBrowserDefault) {
    options.push('<option value="">Browser default</option>');
  }

  if (!devices.length) {
    options.push(`<option value="">${noneLabel}</option>`);
    selectEl.innerHTML = options.join("");
    selectEl.value = "";
    selectEl.disabled = true;
    return;
  }

  options.push(
    ...devices.map((device, index) => {
      const label = String(device.label || "").trim() || `${numberedPrefix} ${index + 1}`;
      return `<option value="${device.deviceId}">${escapeHtml(label)}</option>`;
    })
  );

  selectEl.innerHTML = options.join("");
  selectEl.disabled = false;

  if (selectedId && devices.some((device) => device.deviceId === selectedId)) {
    selectEl.value = selectedId;
  } else if (allowBrowserDefault) {
    selectEl.value = "";
  } else {
    selectEl.value = devices[0].deviceId;
  }
};

const enumerateMediaDevices = async () => {
  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    availableVideoInputs = devices.filter((device) => device.kind === "videoinput");
    availableAudioInputs = devices.filter((device) => device.kind === "audioinput");
    availableAudioOutputs = devices.filter((device) => device.kind === "audiooutput");

    if (!selectedCameraId || !availableVideoInputs.some((device) => device.deviceId === selectedCameraId)) {
      selectedCameraId = availableVideoInputs[0]?.deviceId || "";
    }
    if (!selectedMicId || !availableAudioInputs.some((device) => device.deviceId === selectedMicId)) {
      selectedMicId = availableAudioInputs[0]?.deviceId || "";
    }
    if (selectedSpeakerId && !availableAudioOutputs.some((device) => device.deviceId === selectedSpeakerId)) {
      selectedSpeakerId = "";
    }

    renderDeviceOptions({
      selectEl: cameraDeviceSelectEl,
      devices: availableVideoInputs,
      selectedId: selectedCameraId,
      noneLabel: "No camera device found",
      numberedPrefix: "Camera"
    });
    renderDeviceOptions({
      selectEl: micDeviceSelectEl,
      devices: availableAudioInputs,
      selectedId: selectedMicId,
      noneLabel: "No microphone found",
      numberedPrefix: "Microphone"
    });
    renderDeviceOptions({
      selectEl: speakerDeviceSelectEl,
      devices: availableAudioOutputs,
      selectedId: selectedSpeakerId,
      noneLabel: "No speaker output found",
      numberedPrefix: "Speaker",
      allowBrowserDefault: true
    });
  } catch (error) {
    setMediaSettingsHint("Device list unavailable. Check browser permissions.");
    console.error("Unable to enumerate devices:", error);
  }
};

const buildMediaDeviceConstraint = (deviceId) =>
  deviceId ? { deviceId: { exact: deviceId } } : true;

const applyAudioOutputToVideoElement = async (videoEl, sinkId = "") => {
  if (!videoEl || typeof videoEl.setSinkId !== "function") return;
  try {
    await videoEl.setSinkId(sinkId || "");
  } catch {
    // ignore unsupported/blocked sink assignment
  }
};

const applyAudioOutputPreference = async () => {
  const sinkId = selectedSpeakerId || "";
  await applyAudioOutputToVideoElement(localVideoEl, sinkId);
  if (!remoteVideoGridEl) return;
  const videos = Array.from(remoteVideoGridEl.querySelectorAll("video"));
  await Promise.allSettled(videos.map((videoEl) => applyAudioOutputToVideoElement(videoEl, sinkId)));
};

const updateActionButtons = () => {
  const hasAudioTracks = Boolean(localStream?.getAudioTracks().length);
  const hasVideoTracks = Boolean(localStream?.getVideoTracks().length);
  if (toggleMicBtnEl) {
    toggleMicBtnEl.disabled = !isJoined || !hasAudioTracks;
    const enabled = hasAudioTracks && localStream.getAudioTracks().some((track) => track.enabled);
    toggleMicBtnEl.textContent = enabled ? "Mute Mic" : "Unmute Mic";
  }
  if (toggleCamBtnEl) {
    toggleCamBtnEl.disabled = !isJoined || !hasVideoTracks;
    const enabled = hasVideoTracks && localStream.getVideoTracks().some((track) => track.enabled);
    toggleCamBtnEl.textContent = enabled ? "Hide Camera" : "Show Camera";
  }
  if (switchCameraBtnEl) {
    switchCameraBtnEl.disabled = !isJoined || isScreenSharing || availableVideoInputs.length < 2;
  }
  if (toggleScreenBtnEl) {
    toggleScreenBtnEl.disabled = !isJoined;
    toggleScreenBtnEl.textContent = isScreenSharing ? "Stop Share" : "Share Screen";
  }
  if (leaveCallBtnEl) {
    leaveCallBtnEl.disabled = !isJoined;
  }
  if (markCompleteBtnEl) {
    const shouldShow = mode === "doctor" && Boolean(getAppointmentId());
    markCompleteBtnEl.classList.toggle("hidden", !shouldShow);
    markCompleteBtnEl.disabled = !isJoined || completionInProgress;
  }
};

const renderParticipants = () => {
  if (!participantsListEl) return;
  const list = Array.from(participants.values());

  if (!list.length) {
    participantsListEl.innerHTML = "<li>No participants yet</li>";
    return;
  }

  participantsListEl.innerHTML = list
    .sort((a, b) => {
      if (a.socketId === mySocketId) return -1;
      if (b.socketId === mySocketId) return 1;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    })
    .map((participant) => {
      const roleLabel = participant.role === "doctor" ? "Doctor" : "User";
      const youLabel = participant.socketId === mySocketId ? " (You)" : "";
      return `
        <li>
          <span>${escapeHtml(participant.displayName || "Participant")}${youLabel}</span>
          <span class="badge badge-blue">${roleLabel}</span>
        </li>`;
    })
    .join("");
};

const createEmptyRemoteState = () => {
  if (!remoteVideoGridEl) return;
  remoteVideoGridEl.innerHTML = `
    <div class="empty-stage">
      Waiting for another participant to join this room.
    </div>`;
};

const renderRemoteVideos = () => {
  if (!remoteVideoGridEl) return;
  if (!remoteStreams.size) {
    createEmptyRemoteState();
    applyAudioOutputPreference();
    return;
  }

  remoteVideoGridEl.innerHTML = "";
  Array.from(remoteStreams.entries()).forEach(([socketId, stream]) => {
    const participant = participants.get(socketId);
    const tile = document.createElement("div");
    tile.className = "video-tile";

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const label = document.createElement("div");
    label.className = "video-label";
    label.textContent = participant?.displayName || "Participant";

    tile.appendChild(video);
    tile.appendChild(label);
    remoteVideoGridEl.appendChild(tile);
  });

  applyAudioOutputPreference();
};

const appendChatMessage = ({ message, participant, sentAt }) => {
  if (!chatMessagesEl) return;

  const item = document.createElement("div");
  item.className = "chat-item";
  const senderName = participant?.displayName || "System";
  const timeLabel = formatClockTime(sentAt);

  item.innerHTML = `
    <div class="meta">${escapeHtml(senderName)}${timeLabel ? ` - ${escapeHtml(timeLabel)}` : ""}</div>
    <div>${escapeHtml(message)}</div>`;

  chatMessagesEl.appendChild(item);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
};

const clearChat = () => {
  if (chatMessagesEl) chatMessagesEl.innerHTML = "";
};

const upsertParticipant = (participant) => {
  if (!participant?.socketId) return;
  participants.set(participant.socketId, participant);
  renderParticipants();
};

const removeParticipant = (socketId) => {
  if (!socketId) return;
  participants.delete(socketId);
  renderParticipants();
};

const cleanupPeerConnection = (socketId) => {
  const pc = peerConnections.get(socketId);
  if (pc) {
    try {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    } catch {
      // ignore close failures
    }
  }
  peerConnections.delete(socketId);
  remoteStreams.delete(socketId);
  removeParticipant(socketId);
  renderRemoteVideos();
};

const cleanupAllPeers = () => {
  Array.from(peerConnections.keys()).forEach((socketId) => cleanupPeerConnection(socketId));
  peerConnections.clear();
  remoteStreams.clear();
  renderRemoteVideos();
};

const replaceOutgoingVideoTrack = async (track) => {
  const replacements = Array.from(peerConnections.values()).map(async (pc) => {
    const sender = pc.getSenders().find((current) => current.track && current.track.kind === "video");
    if (!sender) return;
    await sender.replaceTrack(track || null);
  });
  await Promise.allSettled(replacements);
};

const replaceOutgoingAudioTrack = async (track) => {
  const replacements = Array.from(peerConnections.values()).map(async (pc) => {
    const sender = pc.getSenders().find((current) => current.track && current.track.kind === "audio");
    if (!sender) return;
    await sender.replaceTrack(track || null);
  });
  await Promise.allSettled(replacements);
};

const applyLocalStreamToPreview = (stream) => {
  if (!localVideoEl) return;
  localVideoEl.srcObject = stream;
};

const ensureLocalStreamContainer = () => {
  if (!localStream) {
    localStream = new MediaStream();
  }
  return localStream;
};

const applyNextCameraTrack = async (nextTrack) => {
  const stream = ensureLocalStreamContainer();
  const previousTracks = stream.getVideoTracks();
  const wasEnabled = previousTracks.length ? previousTracks[0].enabled : true;

  previousTracks.forEach((track) => {
    stream.removeTrack(track);
    if (track !== nextTrack) {
      track.stop();
    }
  });

  if (nextTrack) {
    nextTrack.enabled = wasEnabled;
    stream.addTrack(nextTrack);
  }

  cameraTrack = nextTrack || null;

  if (!isScreenSharing) {
    await replaceOutgoingVideoTrack(cameraTrack);
    applyLocalStreamToPreview(stream);
  }
  updateActionButtons();
};

const applyNextMicTrack = async (nextTrack) => {
  const stream = ensureLocalStreamContainer();
  const previousTracks = stream.getAudioTracks();
  const wasEnabled = previousTracks.length ? previousTracks[0].enabled : true;

  previousTracks.forEach((track) => {
    stream.removeTrack(track);
    if (track !== nextTrack) {
      track.stop();
    }
  });

  if (nextTrack) {
    nextTrack.enabled = wasEnabled;
    stream.addTrack(nextTrack);
  }

  await replaceOutgoingAudioTrack(nextTrack || null);

  if (!isScreenSharing) {
    applyLocalStreamToPreview(stream);
  }
  updateActionButtons();
};

const stopLocalStream = () => {
  if (!localStream) return;
  localStream.getTracks().forEach((track) => track.stop());
  localStream = null;
  cameraTrack = null;
  screenTrack = null;
  isScreenSharing = false;
  applyLocalStreamToPreview(null);
};

const stopScreenShare = async () => {
  if (!isScreenSharing) return;
  isScreenSharing = false;
  if (screenTrack) {
    try {
      screenTrack.onended = null;
      screenTrack.stop();
    } catch {
      // no-op
    }
    screenTrack = null;
  }

  if (cameraTrack) {
    await replaceOutgoingVideoTrack(cameraTrack);
    applyLocalStreamToPreview(localStream);
  } else {
    await replaceOutgoingVideoTrack(null);
  }

  updateActionButtons();
};

const ensureLocalMedia = async () => {
  if (localStream) return localStream;
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    toast("Your browser does not support camera/microphone access.", "error");
    return null;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: buildMediaDeviceConstraint(selectedCameraId),
      audio: buildMediaDeviceConstraint(selectedMicId)
    });
  } catch (error) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      // continue with audio-only fallback
    }
  }

  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: buildMediaDeviceConstraint(selectedMicId)
      });
      toast("Camera unavailable. Joined with audio only.", "info");
    } catch {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      });
      toast("Camera unavailable. Joined with audio only.", "info");
    }
  }

  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: buildMediaDeviceConstraint(selectedCameraId),
        audio: false
      });
      toast("Microphone unavailable. Joined with camera only.", "info");
    } catch {
      localStream = null;
      toast("Could not access camera or microphone.", "error");
      return null;
    }
  }

  cameraTrack = localStream.getVideoTracks()[0] || null;
  applyLocalStreamToPreview(localStream);
  await enumerateMediaDevices();
  await updatePermissionStatuses();
  await applyAudioOutputPreference();
  updateActionButtons();
  return localStream;
};

const switchToSelectedCamera = async ({ notify = true } = {}) => {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    toast("Camera switching is not supported in this browser.", "error");
    return;
  }
  if (!selectedCameraId) {
    toast("No camera device selected.", "error");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: buildMediaDeviceConstraint(selectedCameraId),
      audio: false
    });
    const nextTrack = stream.getVideoTracks()[0] || null;
    if (!nextTrack) {
      throw new Error("Selected camera not available");
    }
    await applyNextCameraTrack(nextTrack);
    if (notify) toast("Camera switched", "success");
  } catch (error) {
    toast(error.message || "Unable to switch camera", "error");
  }
};

const switchToSelectedMic = async ({ notify = true } = {}) => {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    toast("Microphone switching is not supported in this browser.", "error");
    return;
  }
  if (!selectedMicId) {
    toast("No microphone selected.", "error");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: buildMediaDeviceConstraint(selectedMicId)
    });
    const nextTrack = stream.getAudioTracks()[0] || null;
    if (!nextTrack) {
      throw new Error("Selected microphone not available");
    }
    await applyNextMicTrack(nextTrack);
    if (notify) toast("Microphone switched", "success");
  } catch (error) {
    toast(error.message || "Unable to switch microphone", "error");
  }
};

const requestMediaPermissions = async () => {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    toast("Media permissions are not supported in this browser.", "error");
    return;
  }

  try {
    const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    permissionStream.getTracks().forEach((track) => track.stop());
    await enumerateMediaDevices();
    await updatePermissionStatuses();
    setMediaSettingsHint("Permissions granted. You can now choose camera, mic, and speaker.");
    toast("Camera and microphone permissions granted", "success");
  } catch {
    await updatePermissionStatuses();
    setMediaSettingsHint("Permission denied. Allow camera and mic access from your browser site settings.");
    toast("Could not get camera/microphone permission", "error");
  }
};

const createPeerConnection = (remoteSocketId) => {
  if (peerConnections.has(remoteSocketId)) {
    return peerConnections.get(remoteSocketId);
  }

  const pc = new RTCPeerConnection(TURN_STUN_CONFIG);
  peerConnections.set(remoteSocketId, pc);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  pc.onicecandidate = (event) => {
    if (!event.candidate || !socket || !joinedRoomKey) return;
    socket.emit("video:ice-candidate", {
      roomKey: joinedRoomKey,
      targetSocketId: remoteSocketId,
      candidate: event.candidate
    });
  };

  pc.ontrack = (event) => {
    const incomingStream = event.streams?.[0];
    if (!incomingStream) return;

    remoteStreams.set(remoteSocketId, incomingStream);
    renderRemoteVideos();
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === "failed" || state === "closed" || state === "disconnected") {
      cleanupPeerConnection(remoteSocketId);
    }
  };

  return pc;
};

const createOfferFor = async (remoteSocketId) => {
  if (!remoteSocketId || remoteSocketId === mySocketId || !socket || !joinedRoomKey) return;
  const pc = createPeerConnection(remoteSocketId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("video:webrtc-offer", {
    roomKey: joinedRoomKey,
    targetSocketId: remoteSocketId,
    sdp: offer
  });
};

const handleIncomingOffer = async ({ fromSocketId, sdp, participant }) => {
  if (!fromSocketId || !sdp) return;
  upsertParticipant(participant);

  const pc = createPeerConnection(fromSocketId);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("video:webrtc-answer", {
    roomKey: joinedRoomKey,
    targetSocketId: fromSocketId,
    sdp: answer
  });
};

const handleIncomingAnswer = async ({ fromSocketId, sdp }) => {
  if (!fromSocketId || !sdp) return;
  const pc = createPeerConnection(fromSocketId);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
};

const handleIncomingIceCandidate = async ({ fromSocketId, candidate }) => {
  if (!fromSocketId || !candidate) return;
  const pc = createPeerConnection(fromSocketId);
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
};

const initializeSocket = () => {
  if (socket) return socket;
  if (typeof window.io !== "function") {
    throw new Error("Socket client is unavailable");
  }

  socket = window.io({
    transports: ["websocket", "polling"]
  });

  socket.on("connect", () => {
    mySocketId = socket.id || "";
    setConnectionState(isJoined ? "Connected" : "Ready", "badge-blue");
  });

  socket.on("disconnect", () => {
    setConnectionState("Disconnected", "badge-red");
  });

  socket.on("video:participant-joined", (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;
    upsertParticipant(payload.participant);
    appendChatMessage({
      message: `${payload.participant?.displayName || "Participant"} joined the room.`,
      participant: { displayName: "System" },
      sentAt: new Date().toISOString()
    });
  });

  socket.on("video:participant-left", (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;
    const participantName = payload.participant?.displayName || "Participant";
    cleanupPeerConnection(payload.participant?.socketId);
    appendChatMessage({
      message: `${participantName} left the room.`,
      participant: { displayName: "System" },
      sentAt: new Date().toISOString()
    });
  });

  socket.on("video:participants", (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;
    participants.clear();
    (payload.participants || []).forEach((participant) => upsertParticipant(participant));
    renderParticipants();
  });

  socket.on("video:webrtc-offer", async (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;
    try {
      await handleIncomingOffer(payload);
    } catch (error) {
      console.error("Offer handling failed:", error);
    }
  });

  socket.on("video:webrtc-answer", async (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;
    try {
      await handleIncomingAnswer(payload);
    } catch (error) {
      console.error("Answer handling failed:", error);
    }
  });

  socket.on("video:ice-candidate", async (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;
    try {
      await handleIncomingIceCandidate(payload);
    } catch {
      // ignore stale ICE candidates
    }
  });

  socket.on("video:chat", (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;
    appendChatMessage(payload);
  });

  socket.on("video:appointment-completed", (payload = {}) => {
    if (!isJoined || payload.roomKey !== joinedRoomKey) return;

    const completedAppointmentId = normalizeId(payload.appointmentId);
    const currentAppointmentId = normalizeId(getAppointmentId());
    appendChatMessage({
      message: "Consultation marked as completed.",
      participant: { displayName: "System" },
      sentAt: payload.sentAt || new Date().toISOString()
    });

    if (mode === "user" && currentAppointmentId && (!completedAppointmentId || completedAppointmentId === currentAppointmentId)) {
      appointmentCompleted = true;
      if (!hasSubmittedRating) {
        setRatingStatusLine("Consultation completed. Please rate the doctor.");
      }
      updateRatingControls();
      loadAppointmentFeedbackState();
    }
  });

  return socket;
};

const emitWithAck = (eventName, payload = {}) =>
  new Promise((resolve) => {
    const client = initializeSocket();
    client.emit(eventName, payload, (response = {}) => resolve(response));
  });

const setViewForJoinedRoom = () => {
  if (prejoinPanelEl) prejoinPanelEl.classList.add("hidden");
  if (callPanelEl) callPanelEl.classList.remove("hidden");
  if (activeRoomKeyEl) activeRoomKeyEl.textContent = joinedRoomKey || "-";
  if (activeRoleEl) activeRoleEl.textContent = mode === "doctor" ? "Doctor" : "User";
};

const setViewForPrejoin = () => {
  if (callPanelEl) callPanelEl.classList.add("hidden");
  if (prejoinPanelEl) prejoinPanelEl.classList.remove("hidden");
};

const leaveVideoRoom = async () => {
  if (!isJoined) return;

  try {
    await emitWithAck("video:leave-room", { roomKey: joinedRoomKey });
  } catch {
    // ignore
  }

  isJoined = false;
  joinedRoomKey = "";
  participants.clear();
  renderParticipants();
  cleanupAllPeers();
  clearChat();
  createEmptyRemoteState();
  stopLocalStream();
  closeRatingModal({ force: true });
  setViewForPrejoin();
  setConnectionState("Not Connected", "badge-yellow");
  updateActionButtons();
};

const joinVideoRoom = async () => {
  const displayName = String(displayNameInputEl?.value || "").trim();
  const email = String(emailInputEl?.value || "").trim().toLowerCase();
  const roomKey = normalizeRoomKey(roomKeyInputEl?.value || "");
  const appointmentId = getAppointmentId();

  if (!displayName) {
    toast("Display name is required", "error");
    return;
  }
  if (!email) {
    toast("Email is required", "error");
    return;
  }
  if (!roomKey) {
    toast("Room key is required", "error");
    return;
  }

  joinRoomBtnEl.disabled = true;
  joinRoomBtnEl.textContent = mode === "doctor" ? "Starting..." : "Joining...";

  try {
    const localMedia = await ensureLocalMedia();
    if (!localMedia) {
      throw new Error("Camera or microphone permission is required to join the room");
    }
    setConnectionState("Connecting", "badge-cyan");

    const response = await emitWithAck("video:join-room", {
      roomKey,
      displayName,
      email,
      role: mode === "doctor" ? "doctor" : "user",
      appointmentId
    });

    if (!response.success) {
      throw new Error(response.message || "Unable to join room");
    }

    isJoined = true;
    joinedRoomKey = response.roomKey;
    mySocketId = response.participant?.socketId || mySocketId;
    participants.clear();
    upsertParticipant(response.participant);
    (response.participants || []).forEach((participant) => upsertParticipant(participant));

    setViewForJoinedRoom();
    setConnectionState("In Room", "badge-green");
    appendChatMessage({
      message: `You joined room ${joinedRoomKey}.`,
      participant: { displayName: "System" },
      sentAt: new Date().toISOString()
    });

    const remoteParticipants = (response.participants || []).filter(
      (participant) => participant?.socketId && participant.socketId !== mySocketId
    );
    for (const participant of remoteParticipants) {
      await createOfferFor(participant.socketId);
    }

    updateActionButtons();
  } catch (error) {
    setConnectionState("Join Failed", "badge-red");
    toast(error.message || "Failed to join room", "error");
  } finally {
    joinRoomBtnEl.disabled = false;
    joinRoomBtnEl.textContent = mode === "doctor" ? "Start Room" : "Join Video Room";
  }
};

const toggleMicrophone = () => {
  if (!localStream) return;
  const tracks = localStream.getAudioTracks();
  if (!tracks.length) {
    toast("No microphone track found", "error");
    return;
  }
  const nextEnabled = !tracks[0].enabled;
  tracks.forEach((track) => {
    track.enabled = nextEnabled;
  });
  updateActionButtons();
};

const toggleCamera = () => {
  if (!localStream) return;
  const tracks = localStream.getVideoTracks();
  if (!tracks.length) {
    toast("No camera track found", "error");
    return;
  }
  const nextEnabled = !tracks[0].enabled;
  tracks.forEach((track) => {
    track.enabled = nextEnabled;
  });
  updateActionButtons();
};

const switchCamera = async () => {
  if (!availableVideoInputs.length) {
    toast("No camera device found", "error");
    return;
  }
  if (availableVideoInputs.length === 1) {
    toast("Only one camera device is available", "info");
    return;
  }
  if (isScreenSharing) {
    toast("Stop screen sharing before switching camera", "info");
    return;
  }

  const currentIndex = availableVideoInputs.findIndex((device) => device.deviceId === selectedCameraId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % availableVideoInputs.length : 0;
  selectedCameraId = availableVideoInputs[nextIndex]?.deviceId || "";
  if (cameraDeviceSelectEl) {
    cameraDeviceSelectEl.value = selectedCameraId;
  }

  if (!localStream) {
    await ensureLocalMedia();
    return;
  }

  await switchToSelectedCamera({ notify: false });
  const label = availableVideoInputs[nextIndex]?.label || `Camera ${nextIndex + 1}`;
  toast(`Switched to ${label}`, "success");
};

const toggleScreenShare = async () => {
  if (!isJoined) return;

  if (isScreenSharing) {
    await stopScreenShare();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenTrack = stream.getVideoTracks()[0];
    if (!screenTrack) {
      throw new Error("Screen share track unavailable");
    }

    screenTrack.onended = async () => {
      if (isScreenSharing) {
        await stopScreenShare();
      }
    };

    isScreenSharing = true;
    await replaceOutgoingVideoTrack(screenTrack);

    const previewStream = new MediaStream();
    previewStream.addTrack(screenTrack);
    localStream?.getAudioTracks().forEach((audioTrack) => previewStream.addTrack(audioTrack));
    applyLocalStreamToPreview(previewStream);
    updateActionButtons();
  } catch (error) {
    toast(error.message || "Unable to start screen share", "error");
    isScreenSharing = false;
    updateActionButtons();
  }
};

const markAppointmentCompleted = async () => {
  if (mode !== "doctor") return;
  const appointmentId = getAppointmentId();
  if (!appointmentId) {
    toast("Appointment ID is missing", "error");
    return;
  }

  completionInProgress = true;
  updateActionButtons();
  try {
    await apiRequest(`/api/appointments/${appointmentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" })
    });

    if (socket && joinedRoomKey) {
      socket.emit("video:appointment-completed", {
        roomKey: joinedRoomKey,
        appointmentId
      });
    }

    toast("Appointment marked completed", "success");
  } catch (error) {
    toast(error.message || "Failed to update appointment status", "error");
  } finally {
    completionInProgress = false;
    updateActionButtons();
  }
};

const copyRoomKey = async () => {
  const roomKey = normalizeRoomKey(roomKeyInputEl?.value || "");
  if (!roomKey) {
    toast("Room key is empty", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(roomKey);
    toast("Room key copied", "success");
  } catch {
    toast("Copy failed. Please copy manually.", "error");
  }
};

const configureModeUi = () => {
  const userName = String(session.user?.name || "").trim();
  const userEmail = String(session.user?.email || "").trim();

  if (displayNameInputEl && userName) displayNameInputEl.value = userName;
  if (emailInputEl && userEmail) emailInputEl.value = userEmail;
  if (appointmentIdInputEl) appointmentIdInputEl.value = requestedAppointmentId;
  ratingDoctorName = String(requestedDoctorName || "").trim();
  setRatingDoctorLabel();
  renderRatingStars();

  if (mode === "doctor") {
    if (prejoinTitleEl) prejoinTitleEl.textContent = "Start Video Consultancy Room";
    if (joinRoomBtnEl) joinRoomBtnEl.textContent = "Start Room";
    if (roomKeyInputEl) {
      roomKeyInputEl.readOnly = true;
      roomKeyInputEl.value = normalizeRoomKey(requestedRoomKey) || createRandomRoomKey();
    }
    if (roomHelpLineEl) {
      roomHelpLineEl.textContent =
        "Generate and share this room key with the patient. Patient joins using email and room key.";
    }
    if (videoSubtitleEl) {
      const patientPart = requestedPatientName ? ` Patient: ${requestedPatientName}.` : "";
      videoSubtitleEl.textContent = `Doctor call panel.${patientPart}`;
    }
  } else {
    if (prejoinTitleEl) prejoinTitleEl.textContent = "Join Doctor Video Room";
    if (joinRoomBtnEl) joinRoomBtnEl.textContent = "Join Video Room";
    if (roomKeyInputEl) {
      roomKeyInputEl.readOnly = false;
      roomKeyInputEl.value = normalizeRoomKey(requestedRoomKey);
    }
    if (roomHelpLineEl) {
      roomHelpLineEl.textContent =
        "Enter your email and room key shared by doctor, then click Join Video Room.";
    }
    if (videoSubtitleEl) {
      const doctorPart = requestedDoctorName ? ` Doctor: ${requestedDoctorName}.` : "";
      videoSubtitleEl.textContent = `Patient join panel.${doctorPart}`;
    }
  }

  const showDoctorRoomActions = mode === "doctor";
  if (generateRoomBtnEl) generateRoomBtnEl.classList.toggle("hidden", !showDoctorRoomActions);
  if (copyRoomBtnEl) copyRoomBtnEl.classList.toggle("hidden", !showDoctorRoomActions);

  if (mode !== "user") {
    appointmentCompleted = false;
    hasSubmittedRating = false;
    if (feedbackSectionEl) feedbackSectionEl.classList.add("hidden");
  } else {
    updateRatingControls();
  }
};

const initializeEventListeners = () => {
  if (generateRoomBtnEl) {
    generateRoomBtnEl.addEventListener("click", () => {
      if (!roomKeyInputEl) return;
      roomKeyInputEl.value = createRandomRoomKey();
      toast("New room key generated", "success");
    });
  }

  if (copyRoomBtnEl) {
    copyRoomBtnEl.addEventListener("click", () => {
      copyRoomKey();
    });
  }

  if (joinRoomBtnEl) {
    joinRoomBtnEl.addEventListener("click", () => {
      joinVideoRoom();
    });
  }

  if (leaveCallBtnEl) {
    leaveCallBtnEl.addEventListener("click", async () => {
      await leaveVideoRoom();
    });
  }

  if (toggleMicBtnEl) {
    toggleMicBtnEl.addEventListener("click", () => {
      toggleMicrophone();
    });
  }

  if (toggleCamBtnEl) {
    toggleCamBtnEl.addEventListener("click", () => {
      toggleCamera();
    });
  }

  if (switchCameraBtnEl) {
    switchCameraBtnEl.addEventListener("click", () => {
      switchCamera();
    });
  }

  if (toggleScreenBtnEl) {
    toggleScreenBtnEl.addEventListener("click", () => {
      toggleScreenShare();
    });
  }

  if (markCompleteBtnEl) {
    markCompleteBtnEl.addEventListener("click", () => {
      markAppointmentCompleted();
    });
  }

  if (openRatingPopupBtnEl) {
    openRatingPopupBtnEl.addEventListener("click", () => {
      openRatingModal();
    });
  }

  if (videoRatingCloseBtnEl) {
    videoRatingCloseBtnEl.addEventListener("click", () => {
      closeRatingModal();
    });
  }

  if (videoRatingCancelBtnEl) {
    videoRatingCancelBtnEl.addEventListener("click", () => {
      closeRatingModal();
    });
  }

  if (videoRatingModalEl) {
    videoRatingModalEl.addEventListener("click", (event) => {
      if (event.target === videoRatingModalEl) {
        closeRatingModal();
      }
    });
  }

  if (videoRatingStarsEl) {
    videoRatingStarsEl.addEventListener("click", (event) => {
      const starButton = event.target.closest("button[data-value]");
      if (!starButton) return;
      const nextValue = Number(starButton.getAttribute("data-value") || 0);
      if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > 5) return;
      selectedRatingValue = nextValue;
      renderRatingStars();
    });
  }

  if (submitRatingBtnEl) {
    submitRatingBtnEl.addEventListener("click", () => {
      submitDoctorRating();
    });
  }

  if (cameraDeviceSelectEl) {
    cameraDeviceSelectEl.addEventListener("change", async () => {
      selectedCameraId = String(cameraDeviceSelectEl.value || "").trim();
      if (!selectedCameraId) return;
      if (!localStream) {
        setMediaSettingsHint("Camera will be used when you join the room.");
        return;
      }
      await switchToSelectedCamera();
    });
  }

  if (micDeviceSelectEl) {
    micDeviceSelectEl.addEventListener("change", async () => {
      selectedMicId = String(micDeviceSelectEl.value || "").trim();
      if (!selectedMicId) return;
      if (!localStream) {
        setMediaSettingsHint("Microphone will be used when you join the room.");
        return;
      }
      await switchToSelectedMic();
    });
  }

  if (speakerDeviceSelectEl) {
    speakerDeviceSelectEl.addEventListener("change", async () => {
      selectedSpeakerId = String(speakerDeviceSelectEl.value || "").trim();
      await applyAudioOutputPreference();
      if (selectedSpeakerId) {
        toast("Speaker output updated", "success");
      } else {
        toast("Using browser default speaker", "info");
      }
    });
  }

  if (refreshPermissionsBtnEl) {
    refreshPermissionsBtnEl.addEventListener("click", async () => {
      await enumerateMediaDevices();
      await updatePermissionStatuses();
      await applyAudioOutputPreference();
      setMediaSettingsHint("Device list refreshed.");
    });
  }

  if (requestMediaPermissionBtnEl) {
    requestMediaPermissionBtnEl.addEventListener("click", async () => {
      await requestMediaPermissions();
    });
  }

  if (chatFormEl) {
    chatFormEl.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isJoined || !socket || !joinedRoomKey) return;

      const message = String(chatInputEl?.value || "").trim();
      if (!message) return;

      socket.emit("video:chat", {
        roomKey: joinedRoomKey,
        message
      });

      if (chatInputEl) chatInputEl.value = "";
    });
  }

  window.addEventListener("beforeunload", () => {
    if (socket && joinedRoomKey) {
      socket.emit("video:leave-room", { roomKey: joinedRoomKey });
    }
  });

  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
    navigator.mediaDevices.addEventListener("devicechange", async () => {
      await enumerateMediaDevices();
      await applyAudioOutputPreference();
      updateActionButtons();
    });
  }
};

const init = async () => {
  setConnectionState("Not Connected", "badge-yellow");
  setViewForPrejoin();
  createEmptyRemoteState();
  configureModeUi();
  if (mode === "user") {
    await loadAppointmentFeedbackState();
  }
  await enumerateMediaDevices();
  await updatePermissionStatuses();
  setMediaSettingsHint("Choose camera/mic/speaker before joining the room.");
  initializeEventListeners();
  updateActionButtons();
  initializeSocket();
};

init();
