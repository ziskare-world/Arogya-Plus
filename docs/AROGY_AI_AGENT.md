# 🤖 Arogy AI Agent - Production Architecture & Operations Guide

## 1. System Overview

**Arogy AI Agent** is a production-ready, modular agentic AI system engineered to automate healthcare workflows, support help-desk inquiries, retrieve knowledge through RAG, manage projects, and execute approved operations safely.

### Primary Capabilities
- **Model Adapter**: Integrates Qwen3-14B, Qwen3-30B-A3B, Hugging Face Serverless APIs, and local fallback inference.
- **5-Tier Permission Governance**: Strict role and permission checks (`READ_ONLY`, `DRAFT_ONLY`, `USER_APPROVAL_REQUIRED`, `ADMIN_APPROVAL_REQUIRED`, `FULLY_AUTOMATED_APPROVED_TASK`).
- **15 Independent Skills**: Fully cataloged with standardized manifests, validators, and registered tools.
- **Zero Arbitrary Execution**: Never interprets arbitrary user strings as executable code, SQL, or shell commands.
- **Human Approval Checkpoints**: Sensitive actions pause execution and request explicit authorization.
- **Full REST APIs**: Complete `/api/agent/*` suite with JWT protection.
- **Responsive Dashboard**: Web UI at `/agent` for chat, workflows, approvals, tickets, knowledge RAG, memory, and telemetry.

---

## 2. 15 Complete Modular Skills

1. `general-chatbot`: Conversational dialog, explanations, and summarization.
2. `helpdesk-support`: FAQ search, support ticket creation, priority escalation, and SLA tracking.
3. `personal-assistant`: Scheduled reminders, user notes, and daily agendas.
4. `automation-engine`: Multi-step JSON workflows with scheduled cron and event triggers.
5. `email-messaging`: Provider-independent drafting with mandatory user approval before sending.
6. `document-knowledge`: Document ingestion, chunking, and source-aware RAG vector search.
7. `project-management`: Tasks, milestones, deadlines, and progress summaries.
8. `coding-assistant`: Code explanations, architecture review, and unit test generation.
9. `database-assistant`: Schema inspection and safe read-only data statistics.
10. `notification-reporting`: Daily clinical activity summaries and alerts.
11. `web-api-integration`: Validated REST API caller with rate limiting.
12. `finance-payment`: Razorpay billing explanations and receipt lookup (never stores card CVV).
13. `healthcare-support`: Clinical triage (108 SOS escalation), doctor booking, and EHR navigation.
14. `system-monitoring`: Uptime checks, DB connectivity, and hospital load telemetry.
15. `multi-agent-coordination`: Delegation across 8 specialized sub-agents with bounded execution depth (max 4).

---

## 3. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `AI_MODEL_PROVIDER` | Model provider backend (`huggingface`, `local`) | `huggingface` |
| `AI_MODEL_NAME` | Primary Hugging Face model | `Qwen/Qwen3-14B` |
| `HUGGINGFACE_API_KEY` | Hugging Face API token | *(Optional)* |
| `JWT_SECRET` | Secret for user authorization tokens | Required in prod |
| `MONGO_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/...` |

---

## 4. REST API Reference

- `POST /api/agent/chat`: Send instruction or chat query.
- `POST /api/agent/plan`: Formulate a multi-step plan.
- `POST /api/agent/execute`: Execute a plan.
- `GET /api/agent/tasks/:id`: Inspect task status.
- `POST /api/agent/tasks/:id/cancel`: Cancel task.
- `GET /api/agent/skills`: List discovered skills.
- `POST /api/agent/skills/:id/(enable|disable)`: Toggle skill.
- `GET /api/agent/tools`: Inspect registered tools.
- `GET /api/agent/memory`: View long-term memories.
- `DELETE /api/agent/memory/:id`: Forget/delete memory.
- `GET /api/agent/approvals`: List pending approval checkpoints.
- `POST /api/agent/approvals/:id/approve`: Approve checkpoint & resume.
- `POST /api/agent/approvals/:id/reject`: Reject checkpoint.
- `GET /api/agent/workflows`: List automated workflows.
- `POST /api/agent/workflows`: Create workflow.
- `GET /api/agent/health`: Health & telemetry stats.

---

## 5. Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d --build
```
Access the dashboard at `http://localhost:5000/agent`.
