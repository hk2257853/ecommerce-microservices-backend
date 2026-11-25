# Control Center UI (Mission Control)

> A dark/light modern ops dashboard built with **React**, **Vite**, **TypeScript**, and **Tailwind CSS**. Visualizes and tests both the Java microservices stack and the Python GenAI platform.
>
> 🌐 **Monorepo Ecosystem**: Part of the [Enterprise Polyglot Commerce & AI Control Center](../README.md) repository.

---

## 🎬 Video Walkthrough

https://github.com/user-attachments/assets/08427a0d-0896-4b5b-bda8-18794506af79

> 🎥 **2-Minute Walkthrough** — *A comprehensive tour of the Control Center UI in action, demonstrating live dual-mode operation, Kafka event streams, Redis Lua rate limiting, 4-stage Hybrid RAG, and LangGraph HITL human approvals.*

---

## ⚡ Features

- **Dual-Mode Architecture**:
  - **Live Mode (`live`)**: Proxies to `http://localhost:8080` (`/orders-api`) and `http://localhost:8000` (`/ai-api`) with real-time SSE streaming and `X-RateLimit-*` header tracking.
  - **Simulated Sandbox (`sim`)**: Fully functional in-memory replica with stateful rate limiting, Kafka event feeds, 4-stage RAG scoring, and LangGraph HITL approval flows.
- **Calm Studio UI & Dark/Light Toggle**: Built for long sessions without eye-strain. Clean typography, generous whitespace, and instant Sun/Moon theme persistence.
- **Commerce & Idempotency Lab**: Interactive cart, user selector, and a dedicated "Replay Same Key" button to test duplicate submission protection.
- **Infra Stress Lab**: Live rate limit gauge with `Send 1`, `Burst 5x`, and `Burst 12x (Trigger 429)` actions, Redis cache inspector, and animated Kafka message streams.
- **AI Playground & Sentiment Analyzer**: Live token-by-token SSE streamer with Time-to-First-Token (TTFT) metrics, and structured sentiment extraction.
- **Hybrid RAG & HITL Workflow Visualizer**: Interactive state machine diagrams with Human-in-the-Loop approval drawers for high-risk operations.

---

## 🚀 Running Locally

```powershell
# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

*Dashboard URL:* [http://localhost:5173/](http://localhost:5173/)

