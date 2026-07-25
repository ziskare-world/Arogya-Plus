const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const ambulanceRoutes = require("./routes/ambulanceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const insuranceRoutes = require("./routes/insuranceRoutes");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const authPageRoutes = require("./routes/authPageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { getEmergencyQueue } = require("./utils/emergencyQueue");

dotenv.config({ path: path.join(__dirname, ".env") });

const resolveGoogleMapsApiKey = (() => {
  let cachedFallbackKey;

  return () => {
    const envKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
    if (envKey) return envKey;

    if (cachedFallbackKey !== undefined) {
      return cachedFallbackKey;
    }

    try {
      const fallbackPath = path.join(__dirname, ".env.example");
      const parsed = dotenv.parse(fs.readFileSync(fallbackPath));
      cachedFallbackKey = String(parsed.GOOGLE_MAPS_API_KEY || "").trim();
    } catch {
      cachedFallbackKey = "";
    }

    return cachedFallbackKey;
  };
})();

if (process.env.NODE_ENV !== "test") {
  connectDB();
}

const app = express();
const server = http.createServer(app);
const uiDirectory = path.join(__dirname, "ui");
const VIDEO_ROOM_PREFIX = "video:";
const videoRooms = new Map();

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"]
  }
});

app.use(
  cors({
    origin: "*"
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach Socket.io instance to each request for route-level real-time updates.
app.use((req, res, next) => {
  req.io = io;
  next();
});

const sendUiPage = (...segments) => (req, res) => {
  res.sendFile(path.join(uiDirectory, ...segments));
};

const normalizeRoomKey = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

const getRoomChannel = (roomKey) => `${VIDEO_ROOM_PREFIX}${roomKey}`;

const ensureVideoRoom = (roomKey) => {
  if (!videoRooms.has(roomKey)) {
    videoRooms.set(roomKey, new Map());
  }
  return videoRooms.get(roomKey);
};

const listRoomParticipants = (roomKey) => {
  const room = videoRooms.get(roomKey);
  if (!room) return [];
  return Array.from(room.values()).map((participant) => ({ ...participant }));
};

const removeSocketFromVideoRoom = (socket, roomKey) => {
  const normalizedKey = normalizeRoomKey(roomKey);
  const room = videoRooms.get(normalizedKey);
  if (!room) return null;

  const participant = room.get(socket.id);
  if (!participant) return null;

  room.delete(socket.id);
  socket.leave(getRoomChannel(normalizedKey));

  if (!room.size) {
    videoRooms.delete(normalizedKey);
  }

  return participant;
};

app.use("/", authPageRoutes);

// Public pages
app.get("/", sendUiPage("index.html"));
app.get("/index", sendUiPage("index.html"));

// Admin pages
app.get("/admin", sendUiPage("admin", "dashboard.html"));
app.get("/admin/dashboard", sendUiPage("admin", "dashboard.html"));
app.get("/admin/appointments", sendUiPage("admin", "appointments.html"));
app.get("/admin/doctors", sendUiPage("admin", "doctors.html"));
app.get("/admin/emergency", sendUiPage("admin", "emergency.html"));
app.get("/admin/ambulance", sendUiPage("admin", "ambulance.html"));
app.get("/admin/patients", sendUiPage("admin", "patients.html"));
app.get("/admin/payments", sendUiPage("admin", "payments.html"));
app.get("/admin/reports", sendUiPage("admin", "reports.html"));

// Doctor pages
app.get("/doctor", sendUiPage("doctor", "dashboard.html"));
app.get("/doctors", sendUiPage("doctor", "dashboard.html"));
app.get("/doctor/dashboard", sendUiPage("doctor", "dashboard.html"));
app.get("/doctor/appointments", sendUiPage("doctor", "appointments.html"));
app.get("/doctor/patients", sendUiPage("doctor", "patients.html"));
app.get("/doctor/prescriptions", sendUiPage("doctor", "prescriptions.html"));

// User pages
app.get("/user", sendUiPage("user", "dashboard.html"));
app.get("/user/dashboard", sendUiPage("user", "dashboard.html"));
app.get("/user/appointments", sendUiPage("user", "appointments.html"));
app.get("/user/doctors", sendUiPage("user", "doctors.html"));
app.get("/user/ambulance-booking", sendUiPage("user", "ambulance-booking.html"));
app.get("/user/medical-records", sendUiPage("user", "medical-records.html"));
app.get("/user/payments", sendUiPage("user", "payments.html"));
app.get("/user/prescriptions", sendUiPage("user", "prescriptions.html"));
app.get("/user/profile", sendUiPage("user", "profile.html"));
app.get("/video-consultation", sendUiPage("shared", "video-consultation.html"));
app.get("/doctor/video-consultation", sendUiPage("shared", "video-consultation.html"));
app.get("/user/video-consultation", sendUiPage("shared", "video-consultation.html"));

// Super admin pages
app.get("/super-admin", sendUiPage("super-admin", "dashboard.html"));
app.get("/super-admin/dashboard", sendUiPage("super-admin", "dashboard.html"));
app.get("/super-admin/admins", sendUiPage("super-admin", "admins.html"));
app.get("/super-admin/appointments", sendUiPage("super-admin", "appointments.html"));
app.get("/super-admin/doctors", sendUiPage("super-admin", "doctors.html"));
app.get("/super-admin/emergency", sendUiPage("super-admin", "emergency.html"));
app.get("/super-admin/patients", sendUiPage("super-admin", "patients.html"));
app.get("/super-admin/payments", sendUiPage("super-admin", "payments.html"));
app.get("/super-admin/reports", sendUiPage("super-admin", "reports.html"));
app.get("/super-admin/system-logs", sendUiPage("super-admin", "system-logs.html"));

app.use(express.static(uiDirectory));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Health Management API is running"
  });
});

app.get("/api/public-config", (req, res) => {
  res.status(200).json({
    success: true,
    googleMapsApiKey: resolveGoogleMapsApiKey()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/ambulance", ambulanceRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/insurance", insuranceRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/user", userRoutes);
app.use("/api/notifications", notificationRoutes);

io.on("connection", async (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  const queue = await getEmergencyQueue();
  socket.emit("emergencyQueue:update", queue);

  socket.on("video:join-room", (payload = {}, callback) => {
    const respond = typeof callback === "function" ? callback : () => {};
    const roomKey = normalizeRoomKey(payload.roomKey);
    const displayName = String(payload.displayName || "").trim().slice(0, 80);
    const email = String(payload.email || "").trim().toLowerCase().slice(0, 160);
    const role = String(payload.role || "user").trim().toLowerCase().slice(0, 40);
    const appointmentId = String(payload.appointmentId || "").trim().slice(0, 64);

    if (!roomKey) {
      respond({ success: false, message: "Room key is required" });
      return;
    }

    if (!displayName) {
      respond({ success: false, message: "Display name is required" });
      return;
    }

    if (!email) {
      respond({ success: false, message: "Email is required" });
      return;
    }

    const previousRoomKey = normalizeRoomKey(socket.data.videoRoomKey);
    if (previousRoomKey && previousRoomKey !== roomKey) {
      const removedParticipant = removeSocketFromVideoRoom(socket, previousRoomKey);
      if (removedParticipant) {
        const previousChannel = getRoomChannel(previousRoomKey);
        socket.to(previousChannel).emit("video:participant-left", {
          roomKey: previousRoomKey,
          participant: removedParticipant
        });
        io.to(previousChannel).emit("video:participants", {
          roomKey: previousRoomKey,
          participants: listRoomParticipants(previousRoomKey)
        });
      }
    }

    const room = ensureVideoRoom(roomKey);
    const participant = {
      socketId: socket.id,
      displayName,
      email,
      role,
      appointmentId,
      joinedAt: new Date().toISOString()
    };

    room.set(socket.id, participant);
    socket.join(getRoomChannel(roomKey));
    socket.data.videoRoomKey = roomKey;

    const participants = listRoomParticipants(roomKey);
    respond({
      success: true,
      roomKey,
      participant,
      participants: participants.filter((entry) => entry.socketId !== socket.id)
    });

    const channel = getRoomChannel(roomKey);
    socket.to(channel).emit("video:participant-joined", { roomKey, participant });
    io.to(channel).emit("video:participants", { roomKey, participants });
  });

  socket.on("video:leave-room", (payload = {}, callback) => {
    const respond = typeof callback === "function" ? callback : () => {};
    const roomKey = normalizeRoomKey(payload.roomKey || socket.data.videoRoomKey);

    if (!roomKey) {
      respond({ success: true });
      return;
    }

    const removedParticipant = removeSocketFromVideoRoom(socket, roomKey);
    if (!removedParticipant) {
      respond({ success: true });
      return;
    }

    delete socket.data.videoRoomKey;
    const channel = getRoomChannel(roomKey);
    socket.to(channel).emit("video:participant-left", { roomKey, participant: removedParticipant });
    io.to(channel).emit("video:participants", { roomKey, participants: listRoomParticipants(roomKey) });
    respond({ success: true });
  });

  const forwardWebrtcSignal = (eventName, payload = {}) => {
    const roomKey = normalizeRoomKey(payload.roomKey || socket.data.videoRoomKey);
    if (!roomKey) return;

    const room = videoRooms.get(roomKey);
    if (!room || !room.has(socket.id)) return;

    const targetSocketId = String(payload.targetSocketId || "").trim();
    if (!targetSocketId || !room.has(targetSocketId)) return;

    io.to(targetSocketId).emit(eventName, {
      roomKey,
      fromSocketId: socket.id,
      sdp: payload.sdp || null,
      candidate: payload.candidate || null,
      participant: room.get(socket.id) || null
    });
  };

  socket.on("video:webrtc-offer", (payload = {}) => {
    forwardWebrtcSignal("video:webrtc-offer", payload);
  });

  socket.on("video:webrtc-answer", (payload = {}) => {
    forwardWebrtcSignal("video:webrtc-answer", payload);
  });

  socket.on("video:ice-candidate", (payload = {}) => {
    forwardWebrtcSignal("video:ice-candidate", payload);
  });

  socket.on("video:chat", (payload = {}) => {
    const roomKey = normalizeRoomKey(payload.roomKey || socket.data.videoRoomKey);
    if (!roomKey) return;

    const room = videoRooms.get(roomKey);
    if (!room || !room.has(socket.id)) return;

    const message = String(payload.message || "").trim().slice(0, 1000);
    if (!message) return;

    io.to(getRoomChannel(roomKey)).emit("video:chat", {
      roomKey,
      fromSocketId: socket.id,
      message,
      sentAt: new Date().toISOString(),
      participant: room.get(socket.id)
    });
  });

  socket.on("video:appointment-completed", (payload = {}) => {
    const roomKey = normalizeRoomKey(payload.roomKey || socket.data.videoRoomKey);
    if (!roomKey) return;

    const room = videoRooms.get(roomKey);
    if (!room || !room.has(socket.id)) return;

    const appointmentId = String(payload.appointmentId || "").trim().slice(0, 64);
    io.to(getRoomChannel(roomKey)).emit("video:appointment-completed", {
      roomKey,
      appointmentId,
      fromSocketId: socket.id,
      sentAt: new Date().toISOString(),
      participant: room.get(socket.id) || null
    });
  });

  socket.on("disconnect", () => {
    const roomKey = normalizeRoomKey(socket.data.videoRoomKey);
    if (roomKey) {
      const removedParticipant = removeSocketFromVideoRoom(socket, roomKey);
      if (removedParticipant) {
        const channel = getRoomChannel(roomKey);
        socket.to(channel).emit("video:participant-left", { roomKey, participant: removedParticipant });
        io.to(channel).emit("video:participants", { roomKey, participants: listRoomParticipants(roomKey) });
      }
    }

    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
  });
}

module.exports = { app, server, io };
