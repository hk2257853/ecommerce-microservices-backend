# Chaos Lab Scope & Benchmark Targets

## Why Things Break in Production (Common Causes)
- **Redis goes down / stalls:** Out-of-memory (missing TTLs or payload spikes), single-threaded blocking commands (`KEYS *`, huge `HGETALL`/`DEL`), snapshot/AOF fork stalls, or primary-replica failover blips.
- **Database goes slow:** Missing indexes / full table scans at scale, lock contention (long transactions or `ALTER TABLE` blocking normal queries), cache-miss stampedes hitting the DB all at once, noisy neighbors (auto-vacuum, backups, analytics), or cloud disk IOPS throttling.
- **Cascading failures:** One slow dependency ties up threads/DB connections until healthy endpoints stall too, amplified by blind client retries.

## Real-World Reference (SDE-2 / Mid-Size to Tier-1 E-Commerce Writes)
- **Mid-size (~500k orders/day):** ~6 req/s avg, **50–150 req/s peak**
- **Tier-1 (~5M–10M orders/day):** ~60–120 req/s avg, **500–2,000 req/s peak** (served across 5–15 stateless app nodes)

## Single-Node SLO Targets (`orders-service`)
- **Throughput:** 150–250 req/s sustained
- **Latency:** p95 < 200ms, p99 < 500ms
- **Errors:** 0% `5xx` (under healthy dependencies)

## Test Plan (4 Core Scenarios)
1. **Saturation Point (How much can 1 server handle?)**
   - **Test:** Keep turning up traffic until the app slows down.
   - **Expected:** Find the exact max req/s handled cleanly before latency crosses `500ms` or requests wait in line for a DB connection.
   
| Panel | Healthy | Warning (Getting Saturated) | Bad (Broken / Saturated) |
| --- | --- | --- | --- |
| Throughput (RPS) | Climbs smoothly (`150–250+ req/s`) | Stops climbing even as `k6` adds users (flatline) | Drops sharply while users are still ramping |
| p99 Response Latency | `< 200 ms` (99 of 100 under has response time < 200ms) | `200 – 500 ms` | `> 500 ms` (SLO breached) |
| HikariCP Connection Pool | Active `< 8`, Pending `0` | Active `8–10`, Pending `0–2` | Active `10` (maxed) & Pending `> 5` |
| HTTP Status Codes | Mostly `201`, `~10%` `429`, `0` `5xx` | `409` or `429` climbing unexpectedly | Any `500` / `503` spikes |

   - **Steps / Scripts:**
     1. Open Grafana (`http://localhost:3000/?orgId=1&refresh=5s`).
     2. Clear any active chaos lag and run the ramp test (`15 → 60 → 100` VUs):
        ```powershell
        .\chaos-lab\scripts\chaos.ps1 reset
        k6 run chaos-lab\load-tests\traffic-blaster.js
        ```
     3. *(Optional)* Push past `100` VUs to force a breaking point:
        ```powershell
        k6 run --stage 15s:100 --stage 20s:250 --stage 20s:400 --stage 10s:0 chaos-lab\load-tests\traffic-blaster.js
        ```

Testing results:
| Metric | Before (10 DB conns, 20 items) | Now (30 DB conns, 200 items) |
| --- | --- | --- |
| Throughput | `107.9 req/s` | `245.9 req/s` |
| p95 Latency | `1.16 s` (failed SLO) | `223.4 ms` (passed `< 500ms`) |
| HikariCP Pending | `180` queued threads | `38` queued threads (`30/30` active) |
| Timeouts / 5xx | Multiple `5s` timeouts | `0` timeouts, `0` `500`s |


2. **Cache Degradation (What if Redis lags or dies?)**
   - **Test:** Slow down or unplug Redis while orders are coming in.
   - **Expected:** App skips Redis or fails fast so it doesn't freeze. Bad sign: threads get stuck waiting and the whole app stalls.

| Panel | Healthy (Resilient) | Warning (Degraded) | Bad (Frozen / Broken) |
| --- | --- | --- | --- |
| p99 Response Latency | `< 300 ms` (fails fast / skips cache) | `300 ms – 1 s` (adds Redis lag) | `> 2 s` (hits Redis/request timeout) |
| Tomcat Worker Threads | `< 50` busy | `50 – 150` busy (threads piling up) | `> 180` / `200` (server thread pool exhausted) |
| Throughput (RPS) | Holds `150–250 req/s` | Drops `20–50%` while lagging | Collapses near `0 req/s` |
| HTTP Status Codes | `201` (cache bypassed) or fast `503` | `429` rate-limit behavior changes / minor `5xx` | Mass `500`s or `5s` `k6` timeouts |

   - **Steps / Scripts:**
     1. **Terminal 1** — Start traffic (needs two terminals so chaos hits mid-load):
        ```powershell
        .\chaos-lab\scripts\chaos.ps1 reset
        k6 run chaos-lab\load-tests\traffic-blaster.js
        ```
     2. **Terminal 2 (Phase A — Slow Redis, 500ms lag):** Run ~15s into load, watch Grafana for 15–20s, then heal:
        ```powershell
        .\chaos-lab\scripts\chaos.ps1 choke-redis 500
        .\chaos-lab\scripts\chaos.ps1 heal-redis
        ```
     3. **Terminal 2 (Phase B — Dead Redis, TCP cut):** Run on a fresh `k6` run (or after healing), watch 15–20s, then restore:
        ```powershell
        .\chaos-lab\scripts\chaos.ps1 cut-redis
        .\chaos-lab\scripts\chaos.ps1 restore-redis
        ```
     4. Always finish clean: `.\chaos-lab\scripts\chaos.ps1 reset`

Testing results (Phase A — Slow Redis `500ms`):
- **Goal vs. Ideal Server:** Unlike Scenario 1 (peak speed under healthy deps), the goal here is **graceful degradation** — survive a degraded cache without stalling Tomcat threads, even if tail latency rises and rate-limiting/idempotency temporarily degrade.

| Metric | Before Fix | After Fix (Circuit Breaker + `200ms` timeout) |
| --- | --- | --- |
| Throughput | `20.15 req/s` (`-92%` collapse) | `158.9 req/s` |
| Avg Latency | `2.2 s` | `186.1 ms` |
| p95 Latency | `4.84 s` (k6 timeouts) | `641.99 ms` |
| Orders (`201`) | `201` | `7,237` |
| Rate-Limited (`429`) | `181` | `9` (rate limiter failed open while breaker was open) |
| Timeouts / `5xx` | Mass `5s` timeouts (`88%` failed) | `0` timeouts, `0` `500`s |

- **What the fix was:**
  1. **Fail fast:** Lowered Redis timeout `2s` → `200ms` so threads don't hang.
  2. **Skip lagging Redis:** Added a circuit breaker (`RedisResilienceGuard`) that bypasses Redis for `10s` (`< 1ms`) once calls exceed `200ms` — avoiding `4 × 500ms` lag (4 sequential Redis calls per order: rate-limit + idempotency check/lock/save).
  3. **Fail open on orders:** Updated `tryStart()` to allow orders when Redis errors instead of rejecting them as duplicates.

Testing results (Phase B — Dead Redis `cut-redis` → `restore-redis` mid-run):
- **Goal vs. Ideal Server:** Survive a total Redis outage without `500`s or crashes, and self-heal automatically once Redis returns.

| Metric | Result (With Circuit Breaker) |
| --- | --- |
| Throughput | `55.9 req/s` (`2,169` orders `201`) |
| Median / p95 Latency | `240.1 ms` median / `2.6 s` p95 (Lettuce TCP teardown & reconnect spike) |
| Timeouts / `5xx` | `0` timeouts, `0` `500`s |
| Self-Healing | Auto-recovered mid-run (`open → half_open → closed` in Prometheus) |

- **Production caveat:** Failing open on rate-limiting is standard; for idempotency, pair fail-open Redis with a DB `UNIQUE` constraint on `idempotency_key` so double-clicks can't duplicate orders during a Redis outage.

3. **DB Pool Exhaustion (What if Postgres gets slow?)**
   - **Test:** Inject `1000ms` latency on PostgreSQL (`choke-db 1000`) during load, then `heal-db` mid-run.
   - **Expected:** All `30` DB connections fill up; extra requests fail fast instead of hanging 20s+ and freezing Tomcat threads.
   - **What to expect on Grafana + k6:**

| Signal | Healthy (Surviving) | Warning (Degraded) | Bad (Frozen / Crashing) |
| --- | --- | --- | --- |
| HikariCP Pool | Hits `30/30` active, pending bounded | Pending threads climbing steadily | `30/30` stuck, pending queue maxed |
| Latency (p95) | Bounded (~1–3s fail-fast) | 5–10s waiting on pool | **20s+** (`connection-timeout: 20000ms`) |
| Errors | Fast `503`/`500` when pool full | Mix of slow `201` and timeouts | All requests hang & time out (`500` / `0`) |
| Recovery (`heal-db`) | Pending drops to `0`, RPS rebounds in <5s | Slow drain over 15–30s | Threads stay wedged / app unresponsive |

   - **Commands:**
     ```powershell
     # Terminal 1: Start load
     k6 run chaos-lab\load-tests\traffic-blaster.js

     # Terminal 2: Once traffic is steady (~15s in), choke Postgres (1000ms delay)
     .\chaos-lab\scripts\chaos.ps1 choke-db 1000

     # Terminal 2: After ~20s, heal Postgres and watch recovery
     .\chaos-lab\scripts\chaos.ps1 heal-db
     ```
   - **Observed Results (Before Fix — `choke-db 1000`, `connection-timeout: 20000ms`):**
     - **Throughput:** Dropped to `19.75 req/s` (`847` orders `201`, `169` `429`).
     - **Latency:** `avg = 2.38 s`, `p95 = 5 s` (k6's 5s client timeout ceiling).
     - **Failures:** `1,451` failed orders (`~1,282` client `request timeout`s at 5s). `0` `500`s only because k6 gave up at 5s before HikariCP's **20s** `connection-timeout` fired — server Tomcat threads were stuck waiting up to 20s.
     - *(Note: Postgres healed manually after test via `heal-db`.)*
   - **Observed Results (After Fail-Fast Fix — `connection-timeout: 1500ms`, `@Transactional(timeout = 3)`, `choke-db 1000` at `25s` → `heal-db` at `65s`):**
     - **Throughput:** **`62.82 req/s`** (`2,919` orders `201`, `7,475` iterations — up from `19.75 req/s`).
     - **Latency:** **`avg = 681.12 ms`**, **`med = 96.76 ms`**, **`p95 = 1.68 s`** (bounded right at HikariCP's `1500ms` fail-fast cutoff, down from `5s` client timeouts).
     - **Self-Healing:** Recovered immediately after `heal-db` at `65s` (**0 `500`s** from `0.9s` after `heal-db` through the `100 VU` peak; Grafana's `rate(...[1m])` window just lags visually for ~30–60s).
     - **Note on `500`s during choke:** `1,366` requests returned `500` (`transaction timeout expired`) instead of `503` because JPA/Spring wraps DB/transaction timeouts before they reach `GlobalExceptionHandler`. Adding `CannotCreateTransactionException` / `JpaSystemException` to `GlobalExceptionHandler` turns those into clean `503`s.
4. **Abuse & Retry Safety (Do spammers or double-clicks break things?)**
   - **Test:** Run `k6 run chaos-lab\load-tests\abuse-and-retry.js` (60s) with 3 simultaneous flows:
     1. `spammer_ip`: 5 VUs hammering `/api/orders` from `10.99.99.99` (rate limit is `10 req / 60s`).
     2. `normal_buyers`: 10 VUs with unique IPs buying normally.
     3. `double_click_retries`: 5 concurrent identical requests + 1 sequential retry per `idempotencyKey`.
   - **Expectations:**

   | Metric | Healthy (Target) | Warning | Bad |
   | :--- | :--- | :--- | :--- |
   | **Spammer (`10.99.99.99`)** | First ~10 get `201`, rest get `429` | Spammer leaks >10/min | Spammer gets `201` all the way or causes `500`s |
   | **Normal Buyers** | `100%` `201`, `0` `429`, `0` `5xx` | Latency spikes slightly | Normal buyers get `429` or `500` |
   | **Double-Click / Retries** | Concurrent gets `201` or `409`; sequential gets `201` with **same `orderId`** (`1` row in DB per key) | Extra `409`s on sequential retry | `>1` `orderId` created for the same `idempotencyKey` |
   - **Commands:**
     ```powershell
     k6 run chaos-lab\load-tests\abuse-and-retry.js
     ```
   - **Observed Results (60s `abuse-and-retry.js`, 16 VUs — `131.0 req/s` total):**
     - **Spammer (`10.99.99.99`, 5 VUs):** `4,652` blocked with `429` (`74.7/s`), only `10` allowed in the 60s window (`3` `201` + `7` `409` optimistic lock).
     - **Normal Buyers (10 VUs, unique IPs):** `3,137` `201` (`50.4/s`), **`0` `429`**, **`0` `5xx`** (`p95 = 109.76ms`, well under `200ms` SLO; `159` `409` optimistic-lock conflicts from 10 VUs sharing 30 products).
     - **Double-Click / Retries (28 rounds × [5 concurrent + 1 sequential]):** `56` `201`s (`2` per round, **exact same `orderId`**), `112` `409`s (`4` concurrent losers per round), **`0` duplicate orders**.
     - **Takeaway:** Fixed-window Redis rate limiting isolated the abusive IP completely without affecting normal buyers, and Redis `SETNX` idempotency prevented every double-click/retry from creating duplicate orders.
5. **Kafka Down (What if the event broker dies mid-traffic?)**
   - **Test:** Stop Kafka (`docker stop orders-kafka`) mid-load during `traffic-blaster.js`, then bring it back (`docker start orders-kafka`) and check latency, HikariCP pool, and whether `order.created` events were lost.
   - **Expected (Before Fix vs After Fix):**
     - *Before fix:* `OrderService.createOrder` calls `kafkaTemplate.send()` inside `@Transactional` with no producer timeout overrides (`max.block.ms` defaults to `60s`), risking silent event loss (async fire-and-forget) or `60s` hangs holding DB connections until HikariCP saturates.
     - *After fix (timeout + decouple / Transactional Outbox):* `POST /api/orders` stays fast (`201`), HikariCP stays flat, and zero events are lost once Kafka recovers.
   - **What to expect on Grafana + k6:**

   | Signal | Healthy (Target) | Warning (Degraded) | Bad (Broken / Event Loss) |
   | --- | --- | --- | --- |
   | HTTP Status Codes | `201`s keep flowing (`0` `5xx`) | Brief `5xx` spike if fail-fast without outbox | `500`s or client timeouts across all endpoints |
   | Latency (p95 / p99) | Stays `< 200ms / < 500ms` | Bounded fail-fast (`1–3s`) | Spikes to **60s** (`max.block.ms` default) |
   | HikariCP Pool | Active low, Pending `0` | Brief bump while metadata times out | `30/30` active stuck waiting on Kafka inside `@Transactional` |
   | Event Delivery | `100%` of created orders reach `order.created` after recovery | Events delayed until Kafka restarts | Orders saved in Postgres but events **silently dropped** |

   - **Commands:**
     ```powershell
     # Terminal 1: Start load
     k6 run chaos-lab\load-tests\traffic-blaster.js

     # Terminal 2: Once traffic is steady (~15s in), kill Kafka
     docker stop orders-kafka

     # Terminal 2: After ~20-30s, bring Kafka back and verify recovery / outbox drain
     docker start orders-kafka
     ```
   - **Note — Why `201` when Kafka is down?** Postgres saves the order (`201` = "order accepted"); Kafka just notifies other services later. Without an Outbox, `201` loses events; with an Outbox (save order + event together in Postgres), `201` stays safe and events send once Kafka is back.
   - **Observed Results (Before vs After Transactional Outbox):**

   | Metric | Before Fix (In-Memory Kafka Producer, ~25s outage) | After Fix (Transactional Outbox, ~2m outage) |
   | :--- | :--- | :--- |
   | **Throughput (`traffic-blaster.js`)** | `94.4 req/s` (`11,530` reqs) | `82.1 req/s` (`9,826` iterations / `10,027` reqs) |
   | **Latency (`p95`)** | `1.51s` | `1.19s` (`avg = 499.29ms`) |
   | **`POST /api/orders` Statuses** | `5,005` `201`, `5,282` `409`, `1,032` `429`, `10` `503`, `0` `500`s | `4,367` `201`, `4,826` `409`, `817` `429`, `7` `503`, **`0` `500`s** |
   | **HikariCP Pool** | Stayed healthy | `active = 0`, `pending = 0` after drain |
   | **During Outage** | Buffered only in app RAM (`buffer.memory` / `120s` delivery window; lost on `>2m` outage or restart) | **`2,440` events** persisted in Postgres `outbox_events` (`2,390` `PENDING`, `50` `PROCESSING`; `32` failed retries, max `8`, capped `30s` backoff) |
   | **After Recovery (`docker start orders-kafka`)** | `0` expired batches in 25s window (unverified under longer outage/crash) | **`4,367 / 4,367` `SENT` (`100%` delivered, `0` lost, `outbox_events_pending = 0`)** |

   - **Note on DB Pool Queueing (`52` Waiting Threads at Peak):** At `100` VUs, `30` Tomcat threads held the `30` HikariCP connections while `~52` queued (`p95 = 1.19s`, `7` `503`s at `1500ms` timeout). Turned off `spring.jpa.show-sql` (`${SHOW_SQL:false}`) and `hibernate.format_sql` in `orders-service/src/main/resources/application.yml` so console SQL logging stops slowing down DB transactions and inflating pool wait time.

