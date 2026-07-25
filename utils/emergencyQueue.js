const Emergency = require("../models/Emergency");

const PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const getEmergencyQueue = async () => {
  const queue = await Emergency.find({ status: { $in: ["waiting", "in_progress"] } })
    .populate("assignedDoctor", "name email")
    .sort({ createdAt: 1 })
    .lean();

  return queue.sort((a, b) => {
    const weightA = PRIORITY_WEIGHT[a.priority] || 0;
    const weightB = PRIORITY_WEIGHT[b.priority] || 0;
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
};

const emitEmergencyQueueUpdate = async (io) => {
  if (!io) {
    return;
  }
  const queue = await getEmergencyQueue();
  io.emit("emergencyQueue:update", queue);
};

module.exports = { getEmergencyQueue, emitEmergencyQueueUpdate };
