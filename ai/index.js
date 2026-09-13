/**
 * 🏥 ArogyaPlus - AI Subsystem Index
 * Central export for Hugging Face integration, specialized agents, and multi-agent orchestrator.
 */

const { HuggingFaceClient, huggingFaceClient } = require("./huggingfaceClient");
const { TalkingAgent, talkingAgent } = require("./agents/talkingAgent");
const { TriageAgent, triageAgent } = require("./agents/triageAgent");
const { AppointmentAgent, appointmentAgent } = require("./agents/appointmentAgent");
const { ClinicalNotesAgent, clinicalNotesAgent } = require("./agents/clinicalNotesAgent");
const { HospitalOperationsAgent, hospitalOperationsAgent } = require("./agents/hospitalOperationsAgent");
const { AgentOrchestrator, agentOrchestrator } = require("./agents/agentOrchestrator");
const { queryQwenAgent, DEFAULT_QWEN_MODEL } = require("./qwenBridge");

module.exports = {
  HuggingFaceClient,
  huggingFaceClient,
  queryQwenAgent,
  DEFAULT_QWEN_MODEL,
  TalkingAgent,
  talkingAgent,
  TriageAgent,
  triageAgent,
  AppointmentAgent,
  appointmentAgent,
  ClinicalNotesAgent,
  clinicalNotesAgent,
  HospitalOperationsAgent,
  hospitalOperationsAgent,
  AgentOrchestrator,
  agentOrchestrator
};
