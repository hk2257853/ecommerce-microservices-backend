# ⚡ Local Chaos Engineering Lab (Production Observability Stack)

A production-grade, local Chaos Engineering setup modeled after real-world SRE and platform engineering practices.

---

## 🏗️ Architecture

```
                                  [k6 Traffic Blaster]
                                           │
                                           ▼ (POST /api/orders)
                              ┌─────────────────────────┐
                              │ orders-service (:8080)  │
                              └────────────┬────────────┘
                                           │ (Metrics via Actuator)
                                           ▼
                              ┌─────────────────────────┐
                              │   Prometheus (:9090)    │
                              └────────────┬────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │     Grafana (:3000)     │
                              │ (Live Resilience HUD)   │
                              └─────────────────────────┘

                                 [Target Dependencies]
                                           │
                        ┌──────────────────┼──────────────────┐
                        │                  │                  │
                        ▼                  ▼                  ▼
             [Toxiproxy :26379]    [PostgreSQL :5432]   [Kafka :9092]
                        │
                        ▼ (Chaos Injection)
                 [Redis :6379]
```

---

## ✅ Prerequisites (Fresh Clone)

* **Docker Desktop** installed and running (`Engine running`)
* **Java 17+** (for `orders-service` Gradle wrapper)
* **k6** installed for load testing:
  ```powershell
  winget install k6 --source winget
  ```

---

## 🚀 Quickstart: Fresh Clone to Running Lab

### Step 1: Start Base Microservice Infra (Redis & Kafka)
From the repo root, start the existing Redis and Kafka containers in `orders-service`:
```powershell
cd orders-service
docker compose up -d
cd ..
```
This starts **Redis** (`:6379`), **Kafka** (`:9092`), and **Kafka UI** (`:8090`).

### Step 2: Start the Chaos & Observability Stack
```powershell
cd chaos-lab
docker compose up -d
```
This spins up:
* **Grafana** at `http://localhost:3000` (User: `admin`, Pass: `admin`)
* **Prometheus** at `http://localhost:9090`
* **Toxiproxy** API at `http://localhost:8474` (Toxic Redis port: `26379`, Toxic Postgres port: `25432`)
* **Redis Exporter** at `http://localhost:9121`
* **PostgreSQL** (`ecommerce_system`) at `localhost:5432`

### Step 3: Initialize Toxiproxy
Register the toxic proxies for Redis and Postgres:
```powershell
cd scripts
.\init-toxiproxy.ps1
cd ..\..
```

### Step 4: Start `orders-service` Pointing to the Toxic Proxy
From the repo root, run `orders-service` so it talks to Redis via Toxiproxy (port `26379`):
```powershell
$env:REDIS_PORT=26379
.\gradlew.bat :orders-service:bootRun
```
Verify metrics are scraping: Open `http://localhost:8080/actuator/prometheus` in your browser.

### Step 5: Open Grafana
Open your browser to:
👉 **`http://localhost:3000`**

The **"Chaos Engineering Lab — Resilience & Observability"** dashboard is already set as your default homepage!

---

## 📊 Grafana Dashboard Guide (`localhost:3000`)

| Row | Panel | What to Watch |
|---|---|---|
| **Top** | **Throughput / p99 Latency / Tomcat Threads / Redis Memory** | Live snapshot of RPS, slowest 1% latency (`<150ms` target), busy Java worker threads (max 200), and Redis RAM. |
| **Middle** | **Latency (`p50`/`p95`/`p99`) & HTTP Status Codes** | Spikes in latency and `201` (OK) vs `429` (rate-limited) vs `5xx` (errors/timeouts). |
| **Bottom** | **HikariCP DB Pool & Redis Commands/Sec** | **HikariCP:** 10 Postgres connections — if `Active = 10` & `Pending > 0`, DB is choked.<br>**Redis:** Ops/sec (`EVAL`, `SETNX`, `GET`) & connected clients. |

---

## 💥 The Chaos Experiment: "The Redis Meltdown"

### 1. Start Baseline Traffic
In a new terminal, launch the k6 traffic generator:
```powershell
cd chaos-lab\load-tests
k6 run traffic-blaster.js
```
* Observe Grafana: Throughput rises to ~50–150 RPS.
* **p99 Latency**: Cruises at **< 30ms**.
* **Tomcat Threads**: ~10–15 busy threads.
* **HTTP Errors**: 0%.

### 2. Inject Chaos (Choke Redis)
In another terminal, inject 500ms network latency into Redis:
```powershell
cd chaos-lab\scripts
.\chaos.ps1 choke-redis 500
```
* **Immediate Cascade in Grafana**:
  1. The Redis response slows down by 500ms.
  2. The Redis fixed-window Lua rate limiter and SETNX idempotency locks block.
  3. **Tomcat Busy Threads** spikes from 15 to 200 (all threads stuck in I/O wait).
  4. **p99 Latency** spikes to **4,500ms+**.
  5. **HTTP 504 Gateway Timeouts** start piling up on the error panel!

### 3. Heal the System
Remove the latency toxic:
```powershell
.\chaos.ps1 heal-redis
```
* **Observe Recovery**:
  1. Queued requests drain within seconds.
  2. Tomcat threads release back to baseline.
  3. p99 latency plunges back to **25ms**.
  4. SLA returns to 100%.

---

## 📋 Chaos Command Reference (`chaos.ps1`)

| Command | Action |
|---|---|
| `.\chaos.ps1 status` | Shows active proxies and all currently injected toxics. |
| `.\chaos.ps1 choke-redis 500` | Injects 500ms latency (+- 50ms jitter) into Redis. |
| `.\chaos.ps1 heal-redis` | Clears Redis latency. |
| `.\chaos.ps1 cut-redis` | Severs TCP link to Redis (Connection Refused). |
| `.\chaos.ps1 restore-redis` | Restores Redis connection. |
| `.\chaos.ps1 choke-db 1000` | Injects 1,000ms latency into PostgreSQL. |
| `.\chaos.ps1 heal-db` | Clears PostgreSQL latency. |
| `.\chaos.ps1 reset` | Clears all toxics across all proxies. |

---

## 🧹 Teardown

To stop all containers cleanly:
```powershell
cd chaos-lab; docker compose down
cd ..\orders-service; docker compose down
```

