# Backend Development Notes - Table of Contents

- [Project Initialization](#project-initialization)
- [Project Structure](#project-structure)
- [API Design Best Practices](#api-design-best-practices)
- [Spring Data JPA Repository](#spring-data-jpa-repository)
- [Service Layer Architecture](#service-layer-architecture)
- [Automated Testing](#automated-testing)
- [Flyway Database Migrations](#flyway-database-migrations)
- [Redis Caching](#redis-caching)
  - [Annotations](#annotations)
  - [Cache Invalidation Strategies](#cache-invalidation-strategies)
  - [TTL Tradeoffs](#ttl-tradeoffs)
  - [Cache Stampede](#cache-stampede)
  - [When NOT to Cache](#when-not-to-cache)
  - [Mental Model](#mental-model)
  - [Places to Cache](#places-to-do-caching)
  - [CacheManager](#cachemanager)
  - [In-Memory vs Redis](#in-memory-cache-vs-redis)
- [Idempotency](#idempotency)
- [Logging Conventions](#logging-conventions)
- [Exception Handling](#exception-handling--when-to-throw-swallow-rethrow)
- [Load Testing](#load-testing)
- [Rate Limiting](#rate-limiting)
- [Kafka](#kafka)
  - [Kafka Basics](#kafka)
  - [Failure Handling](#kafka--failure-handling)
  - [Eventual Consistency](#eventual-consistency)
  - [Deep Concepts](#kafka--deeper-concepts)
  - [More on Kafka](#more-on-kafka)
- [Multi-Module Projects](#multi-module-project-microservices-structure)
- [Distributed Systems](#distributed-systems--sde-2-concepts)
  - [Core Concepts](#distributed-systems--sde-2-concepts)
  - [At Scale Implementation](#distributed-systems--how-our-implementations-change-at-scale)
- [Multi-Instance Service Architecture](#multi-instance-service-architecture-nginx--multiple-app-nodes)

---

## Project Initialization

Initialised project using spring initializr. - https://start.spring.io/
Initially it just had SpringBootApplication.
The endponits were defined in seperate classes (RestController).

Project Structure:
* **config:** app setup (DB config, beans, configs like CORS, etc.), no business logic
* **controller:** handles API requests and sends responses
* **dto:** API input/output objects (what client sends and receives), keeps API separate from DB
* **entity:** represents DB table; used by ORM
  * Entity → DB: you write entity, ORM creates/updates table
  * DB → Entity: table exists, you create/generate class to map it
* **exception:** handles errors globally and sends proper API error responses
* **repository:** interacts with DB (CRUD operations via JPA, no SQL needed usually)
* **service:** contains business logic, sits between controller and repository

Run command:
./gradlew bootRun

com.h2database:h2 - in memory db, great for testing

Postgres db setup: 
- Install postgresql
- Create database
- Add application.yml with db credentials

Next steps:
1. Study the current codebase to understand the structure and functionality. Verify if things like ORM are properly used - done
2. Add Swagger - done. Really have a lot of trouble due to version conflicts and .gradle cache issues
3. Attach db - done
* Setup is completed. 
4. Now I need a proper project plan - created the design by chatting with claude and implemented the design with windsurf terminal.
5. Look like we not taking advantage of libraries we added like lombok - done we using it now
6. verify and study the codebase if it's as per the MVP_design.
damn the output is too good. Done
7. switch to constructor injection instead of autowired - done
8. Design patterns in the current code (make sure we not overdoing) - stuff like builder (lombok), factory pattern for create order. TODO: factory part and learn .map(OrderItemRequest::getProductId) - NOTE: gotta practice stream well
Additionally added response mappers along with not null in response java files (to avoid sending null in response) - reduced code significantly.
boolean myMethod() { return true; }  // primitive, never null, direct use fine
Boolean redisTemplate.delete()       // object, can be null, use Boolean.TRUE.equals()
10. add automated testing... unit test and repository test for now. 
Integration test - It tests multiple layers of your app working together end-to-end (HTTP → controller → service → database), as opposed to a unit test which tests a single class in isolation. 
NOTE: all this is on h2 not real db.
9. logger?
Enough. Move to next phase! Will build the endpoints as required. also i can do mass entries via sql.

**1. Nouns not verbs**
`/orders` not `/createOrder` or `/getOrders`

**2. Plural nouns**
`/users`, `/orders`, `/products` always

**3. HTTP method conveys the action**
- `POST` → create
- `GET` → read
- `PUT/PATCH` → update
- `DELETE` → delete

**4. Path param for specific resource**
`/orders/{orderId}` — identifying one specific thing

**5. Query param for filtering/optional**
`/orders?userId=x&status=PENDING`

**6. Sub-resources for relationships**
`/orders/{orderId}/items` — items belonging to a specific order

**7. HTTP status codes**
- `200` → success
- `201` → created (POST responses)
- `400` → bad request (client's fault)
- `404` → not found
- `500` → server error

**8. Versioning**
`/api/v1/orders` — so you can evolve the API without breaking existing clients

---

These 8 will cover 90% of real world API design conversations. The order endpoints you just designed follow all of them correctly.


Data Migration: Since you're changing from the current simple Order structure to the new relational model, should I:
Drop and recreate tables (ddl-auto=update will handle this) -> for this project this works.
Or do you want me to create data migration scripts? -> TODO: gotta learn this later, look imp in real life.

/*
Spring Data JPA Repository Notes: (TODO: current notes is not very useful, kinda confusing)

- Extends JpaRepository → gives built-in CRUD methods (save, findById, delete, etc.)
- No implementation needed → Spring generates queries automatically using ORM
- Spring Data JPA handles query generation, execution, and connection pooling, so we usually don’t write SQL or JDBC code.

- Query Derivation (method name → query):
  - findBy<FieldName> → uses ENTITY field name (not DB column)
  - Supports keywords:
    - And, Or
    - GreaterThan, LessThan, Between
    - Containing, StartingWith, EndingWith
    - In, NotIn
    - IsNull, IsNotNull
    - OrderBy<Field>Asc/Desc
    - IgnoreCase
  - Examples:
    - findByCustomerEmailAndStatus
    - findByNameContainingIgnoreCase
    - findTop5ByStatusOrderByCreatedAtDesc

- Return types:
  - Optional<T> → safe null handling
  - List<T> → multiple results
  - boolean → existsBy...
  - long → countBy...

- JpaRepository gives the follwoing out of the box, we don't need to define in repository:
  - save(T entity)
  - findById(Long id)
  - delete(T entity)
  - findAll()
  - count()
  - existsById(Long id)

  - for things like findByEmail — JPA doesn't know about email by default, you need to tell it.
  - It translates method names into SQL queries automatically. (findByEmail → WHERE email = ?)

- @Query:
  - Used for complex queries (JOIN, GROUP BY, aggregations)
  - Uses JPQL (entity + field names, not table/column names)

- @Param:
  - Binds method parameter to query parameter

- Notes:
  - GROUP BY / COUNT / SUM → use @Query (not supported in method names)
  - @Repository is optional (auto-detected by Spring)
*/


Service file main structure:
validate, eg check if user exists
create the entity
save the entity
build the response and return it (if it's a list n all ofcourse have to use stream n stuff)
another thing is all validations — check if product exists, check if stock is sufficient, etc. happen in the service layer, not in the factory n all.

Automated testing (unit test and repository test):
**Entity tests**
Only test your own lifecycle methods — `@PrePersist`, `@PreUpdate`. Don't test Lombok generated code like getters, setters, constructors.

**Repository tests**
Only test custom query methods you defined yourself — like `findByEmail`, `existsByEmail`, `findByUserId`. Don't test built-in JPA methods like `findById`, `save`, `delete`, `count`.

**Service tests**
Test every branch in your business logic — happy path and every `if`/`throw` in the method. Mock all dependencies so no real DB calls happen. Verify interactions to confirm the right methods were called or skipped.

---

**Unit test — core idea**

You're testing one class in isolation. All its dependencies are **faked (mocked)** — you don't want real DB calls, real network calls, nothing. Just test the logic of that one class.

Three steps every time — AAA:
- **Arrange** — set up your mocks, create input data
- **Act** — call the method you're testing
- **Assert** — verify the output is what you expected

---

**Mockito — one idea**

When your service calls `userRepository.findById(1L)`, in a unit test there's no real DB. So you tell Mockito:

> "When findById is called with 1L, pretend to return this user object"

That's it. You control what the dependency returns.

---

**Repository test — core idea**

Here you're not mocking anything. You're testing that your JPA query methods actually work against a real (in-memory) DB.

`@DataJpaTest` spins up a lightweight H2 in-memory DB, you insert some data, call your repository method, and verify it returns the right thing.

---

**The distinction:**

- Unit test — does my **business logic** work correctly?
- Repository test — does my **query** return the right data?

That's all there is at a high level. Clear?


GET /api/products with pagination, sort and filter
@PathVariable → /api/products/{id} (part of the URL path)
@RequestBody → data in the request body (POST/PUT)
@RequestParam → ?key=value in the URL (query string)
Good Design decisions: 
PageResponse DTO - Standardized pagination format, reusable
ProductFilterDTO - Flexible filtering, easy to extend

Pageable - Spring object carrying page number, page size, sort column, sort direction
Passed as 2nd arg to repository methods so Spring auto-generates LIMIT/OFFSET/ORDER BY SQL

(:param IS NULL OR ...) JPQL pattern - single query handles optional filters, no need for multiple query methods
@ModelAttribute - auto binds query params (?name=X&minPrice=10) directly into a DTO object. Less boilerplate than individual @RequestParam fields. Use for GET params, @RequestBody for POST/PUT JSON body.

DataInitializer - seeds 100 fake products into dev database on startup using Faker for realistic data. @Profile("dev") ensures it never runs in production.

About hibernatio options i can add in application.properties:
spring.jpa.hibernate.ddl-auto=update
Controls what Hibernate does to your schema on startup:

update — adds new columns/tables if your entities changed, keeps existing data
create-drop — drops and recreates everything on every restart (what your test uses)
none — don't touch the schema at all (production)
validate — just check schema matches entities, throw error if not

spring.jpa.show-sql=true
Prints every SQL query Hibernate runs to the console. You've been seeing this — all those Hibernate: select...insert... lines in your logs.

ring.sql.init.mode=never
Don't run data.sql on startup. You override this to always in application-dev.properties so seed data only loads in dev.


Database Indexes
What it does: Builds a sorted data structure (B-tree by default) so DB finds rows fast without scanning the whole table.

CREATE INDEX idx_order_item_order_id ON order_items(order_id);
Index needs a name so that we can do stuff like drop it if needed.

Core tradeoff:
- SELECT gets faster
- INSERT/UPDATE/DELETE get slower (every write must update the index too)
- Extra disk space

When to add: column appears in WHERE/ORDER BY/JOIN frequently, large tables, high cardinality columns (email good, status with 3 values questionable)
When NOT to add: small tables, rarely queried columns, write-heavy tables

Types:
- B-tree (default) → equality and range queries (=, >, <, BETWEEN)
- Hash → only equality (=)
- GIN/GiST → full text search, arrays (PostgreSQL specific)

Composite index: index on multiple columns e.g. (user_id, status). Order matters — (user_id, status) helps WHERE user_id=? AND status=? but not WHERE status=? alone.

Auto-indexed (no action needed):
- Unique constraints → automatically creates index
- Foreign keys in PostgreSQL → automatically indexed

Golden rule: don't add indexes preemptively. Use EXPLAIN ANALYZE in PostgreSQL to spot slow sequential scans, then add indexes based on actual performance data. Additionally people might add index when actual slowness is reported.


N+1 Query Problem
Happens when you load a list of entities and then access a lazy-loaded relation in a loop.

Example:
1 query to fetch all order items → returns 10 items
Then for each item in a loop → 1 query to fetch its product
= 1 + 10 = 11 queries instead of 1
Basically if me doing a db call in a loop, get alert.

1 = the initial query to fetch the list
N = one query per item in the list

Lazy loading: JPA doesn't load related entities until you access them (default behavior)
Eager loading: loads everything upfront in one query

How to spot it: enable show-sql=true and count the queries in logs

Fix: JOIN FETCH loads everything in one query
@Query("SELECT oi FROM OrderItem oi JOIN FETCH oi.product WHERE oi.order.id = :orderId")

Rule: don't fix it preemptively, confirm it's actually happening via SQL logs first.


PLAN:
EXPLAIN ANALYZE - shows how PostgreSQL executes a query and actual performance metrics

Usage:
EXPLAIN ANALYZE SELECT * FROM products WHERE name LIKE '%phone%';

Key things to look at:
- Seq Scan → reading every row, no index being used (bad for large tables)
- Index Scan → using an index to find rows directly (what you want)
- cost=0.00..25.00 → estimated cost, lower is better (startup cost..total cost)
- rows=100 → how many rows DB expects to return
- actual time=0.1..0.5 → real execution time in milliseconds (this is what actually matters)

Workflow:
1. Query feels slow
2. Run EXPLAIN ANALYZE on it
3. See Seq Scan on large table → add an index
4. Run again → confirm it switched to Index Scan
5. Check actual time dropped

It's basically what i did in pl sql once.

Introduced product quantity thus need to handle simultaneous updates to the same product.

Optimistic vs Pessimistic Locking

Problem both solve: two transactions updating the same row simultaneously

---

Optimistic Locking
Assumes conflicts are rare. No lock upfront, detect conflict at save time via @Version field.

In Product entity:
@Version  // Hibernate manages automatically, increments on every update
private Long version;

Flow:
- Transaction 1 reads version=0, saves → version becomes 1 ✅
- Transaction 2 reads version=0, tries to save → version mismatch → ObjectOptimisticLockingFailureException ❌

Generated SQL: UPDATE products SET quantity=?, version=1 WHERE id=? AND version=0
If 0 rows updated → Hibernate throws exception

---

Pessimistic Locking
Assumes conflicts will happen. Locks the row on read, others wait. in some dbs even reads are blocked until the lock is released.

In ProductRepository:
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT p FROM Product p WHERE p.id = :id")
Optional<Product> findByIdWithLock(@Param("id") Long id);

Generated SQL: SELECT * FROM products WHERE id=? FOR UPDATE
Lock held until transaction commits, others block.

---

When to use which:
- Low conflict, read-heavy → Optimistic
- High conflict guaranteed (flash sales, limited tickets) → Pessimistic
- Distributed systems / microservices → Optimistic (pessimistic locks don't cross service boundaries). TODO: study locking and rollback mechanisms in distributed systems.
- Must never fail, short critical section → Pessimistic
- Long operations → Optimistic (can't hold locks too long)

Business use case egs:
- Flash sales (limited stock, high concurrency), payment processing, booking systems, low inventory scenarios  → Pessimistic
- Wiki editing, inventory updates (read-heavy, occasional writes) → Optimistic (rare conflicts, read-heavy)
---

Tradeoffs:
Optimistic  → better throughput, needs retry logic, bad under high contention
Pessimistic → simpler (no retries), slower, risk of deadlocks, doesn't scale across services

Golden rule: start with optimistic, switch to pessimistic only when proven high contention.

synchronized vs DB Locking:
synchronized works at JVM level — locks a thread within a single JVM process.
Problem: modern backends run multiple instances behind a load balancer.
Instance 1 and Instance 2 have separate JVMs — synchronized on one has no effect on the other.
Two requests hitting different instances can still update the same DB row simultaneously.

For anything touching a database → use DB-level locking (optimistic/pessimistic)
Database is the shared source of truth across all instances — locking there is global.

Eg: 
- In-memory cache, object pool, request counter → synchronized
- Database rows, inventory, user balances → DB locking


@Transactional
- If any operation fails, the entire transaction is rolled back, ensuring data consistency.
When to use? Multiple DB writes in one operation
- In the context of order creation, this means that if any part of the process fails (e.g., stock update, order creation, order item creation), all changes are rolled back, preventing partial updates.


I added a new column quantity to products thus i need to create a new migration file to add this column to the database.
### Flyway Notes

Version control for DB schema — runs numbered SQL files automatically on startup and tracks them in `flyway_schema_history`.

**Files:** `src/main/resources/db/migration/V1__description.sql`, `V2__...` etc — runs in order, never reruns.

**Gotcha:** `baseline-on-migrate: true` marks everything as done without running it — only use when first adding Flyway to existing project, remove after.

**Tests:** always set `spring.flyway.enabled=false` — let `ddl-auto: create-drop` handle H2 instead.

> Never edit an existing migration — add a new one.

Hibernate vs Flyway:
- Hibernate: ORM — maps Java entities to DB tables, generates SQL, manages transactions. 
  Can also manage schema via ddl-auto (create/update/validate/none) but not recommended for prod.
- Flyway: manages schema changes via versioned SQL migration files. 
  Single source of truth for schema in prod.

When used together:
- Set ddl-auto: validate — Hibernate checks schema matches entities but never changes it
- Flyway owns all schema changes via migration files

So hibernate is no longer responsible for managing the database schema in my case



## Redis Caching

### Annotations
- @EnableCaching — enables caching, goes on config/main class
- @Cacheable(value = "products", key = "#id") - returns from cache if key exists, else runs method and caches result
  - value = cache name (logical namespace, e.g. "products")
  - key = cache key built from method param (e.g. #id → "products::5")
  - above 2 show up in redis
  - cachedValue - what's actually stored in redis is the method's return value
  - Think: HashMap<cacheName, HashMap<key, cachedValue>>
- @CacheEvict — removes from cache, use on deletes/updates
- @CachePut — always runs method AND updates cache, use on updates
- @Caching — combine multiple cache ops on one method
NOTE: these tags are from spring cache annotation not specific to redis thus i can use them with any cache provider.

### Cache Invalidation Strategies
- TTL (Time To Live) expiry — cache auto-expires after set time
- Cache-aside — app checks cache first, on miss hits DB and populates cache (Spring default)
- Endpoint to manually clear cache

- Write-through — write to DB and cache together, synchronously ie db updates and saved to cache. (@CachePut)
- Write-behind — write to cache first, return success, then update DB asynchronously in the background. Faster response time but risk of data loss if cache crashes before DB write happens.

### TTL Tradeoffs
- Too short → too many DB hits
- Too long → stale data
- Right TTL depends on how often data changes.
User profile — changes rarely, TTL of hours is fine
Stock price — changes every second, TTL of seconds or don't cache at all

### Cache Stampede
When cache expires and many requests hit DB simultaneously
Fix: locking (only one request rebuilds cache) or probabilistic early expiry
Will have to acctually see the end point behavior - if such spikes are often, then can go with locking and all.

### When NOT to cache
- Frequently changing data
- User-specific data (watch your cache keys)
- Financial/transactional data where stale = dangerous

### Mental model
Cache-aside: check cache → if miss, hit DB → populate cache → evict on writes

# Places to do caching:
Service
Not controller (caches before validation)
Repository - same query gets reused across multiple services

# CacheManager
- will allow me to access cache in other places like in another service file if needed.

In memory cache vs Redis:
- In memory cache is faster but only available in the current application instance
- Redis is slower but available across multiple application instances and can be shared across multiple applications (distributed system, multiple backend instances - inmemory cache will be out of sync)
- Additionally redis gives extra durability (if backend crashes, cache is not lost)


## Idempotency

GET, PUT, DELETE are idempotent by nature — multiple calls = same effect.
POST is not — multiple calls create multiple resources (e.g. user charged twice).

For non-idempotent operations, client sends a unique `idempotencyKey` with the request.
Server uses it to detect and deduplicate retries.

### Flow
Request → get(key) from Redis
- JSON found → return cached response (duplicate, skip processing)
- null → tryStart(key) → atomic SETNX in Redis
  - false → another thread has the lock → get() one more time → return or throw
  - true (a 5min TTL added) → process → save(key, response) → return response
  - exception → clear(key) so client can retry
- See: IdempotencyService.java, OrderService.java for full details.

### Key points
- Redis SETNX is atomic — handles concurrency, no DB-level locking needed
- PROCESSING state (5 min TTL) = safety net if app crashes mid-operation
- Final response TTL = 24h
- Threads don't share return values — each caller must fetch from Redis themselves


## Logging conventions

### Where to log
- **Service** — main place. Business logic lives here, logs live here.
- **Controller** — only for significant events (auth failure, bad request). Not every endpoint — RequestIdFilter covers request entry/exit.
- **Repository** — never. Too noisy, framework handles DB logging.
- **Factory/mapper** — never. No side effects, nothing meaningful.

### What to log in a method
- Entry with key inputs — `method started param1={} param2={}`
- Exit with key result — `method completed result={} elapsed={}ms`
- Every branch that changes behavior — cache hit, lock not acquired, validation failure, return
- ERROR on every exception with context — never swallow silently

### Common review failures
- Exception caught but nothing logged — caller has no idea what went wrong
- Logging sensitive data (passwords, tokens, PII) — security issue
- Too many DEBUG logs in prod — noise

### Rule of thumb
If something goes wrong at 2am, can you debug it from logs alone? If no, add more logs.

```markdown
## Exception Handling — When to throw, swallow, rethrow

### Throw
Caller needs to know, can't proceed without it.
```java
throw new ResourceNotFoundException("User", "id", userId);
```

### Swallow (catch + log, don't throw)
Optional/cleanup operation — failing it shouldn't break main flow.
```java
try {
    redisTemplate.delete(redisKey);
} catch (Exception e) {
    log.error("Failed to clear lock", e); // don't throw, original exception matters more
}
```

### Catch + rethrow
Need to do cleanup but caller must still know it failed.
```java
} catch (Exception e) {
    idempotencyService.clear(...); // cleanup
    throw e;                       // caller still gets the error
}
```

### Catch + wrap + rethrow
Convert low-level exception to a meaningful one.
```java
} catch (SQLException e) {
    throw new DatabaseException("Failed to save order", e); // hides SQL detail, exposes intent
}
```

### Rule of thumb
- Caller needs to know / can't proceed → throw
- Cleanup / optional → swallow + log
- Cleanup but caller must know → catch + rethrow
- Low-level exception leaking up → wrap + rethrow
```

## Load Testing

### Why
Verify service handles concurrent load — find bottlenecks before prod does.

### Key metrics
- **Throughput** — requests/sec the service handles (higher = better)
- **Latency p95/p99** — 95th/99th percentile response time. Don't use average — one slow request skews it.
  - eg: p95=200ms means 95% of requests finished in 200ms or less
- **Error rate** — % of failed requests under load
- **Bottleneck** — what breaks first: DB, Redis, thread pool, CPU
eg: you ramp to 100 virtual users. DB connection pool is set to 10 (maximum-pool-size: 10). 90 threads are waiting for a connection → latency spikes → requests timeout. DB is the bottleneck, not the code.

### Tools
- **k6** — write tests in JS, simple setup, good reports
- **Gatling** — Java/Scala, more enterprise
- **JMeter** — old but widely used in big companies

### k6 basics
```js
import http from 'k6/http';

export let options = {
  vus: 10,        // virtual users (concurrent)
  duration: '30s' // how long to run
};

export default function () {
  http.post('http://localhost:8080/api/orders', payload);
}
```

### What to look for in results
```
scenarios: 10 VUs, 30s
✓ status 201: 95%
http_req_duration: avg=120ms p95=340ms p99=800ms
http_reqs: 1200 total, 40/s throughput
```
- p95 spike → DB or Redis slow under load
- high error rate → thread pool exhausted or connection pool full
- low throughput → service can't handle concurrency

### Interview talking points
- Always use p95/p99, never average for latency
- Idempotency key must be unique per load test request — otherwise Redis cache skews results
- Redis caching should visibly reduce latency on duplicate requests
- Connection pool size (`maximum-pool-size` in yml) is often first bottleneck


*Rate Limiting — Personal Notes*

---

*What it is*

Controlling how many requests a client can make in a time window. Protects your service from abuse, DoS, and runaway clients.

---

*Core algorithms*

*Fixed Window* — count requests in a fixed time slot (e.g. 100 req/min). Simple. Problem: burst attack at window boundary — 100 requests at 11:59 + 100 at 12:00 = 200 requests in 2 seconds, both technically "valid".

*Sliding Window* — tracks request timestamps, counts only those within the last N seconds from now. Fixes boundary burst. More memory-heavy (stores timestamps per user).

*Token Bucket* — bucket fills with tokens at a fixed rate, each request consumes one. Allows controlled bursting (if bucket is full). Used by AWS, Stripe. More natural for APIs.

*Leaky Bucket* — requests enter a queue, processed at a fixed rate. Smooths traffic completely. No bursting allowed.

---

*What you implemented*

Fixed window via Redis Lua. The INCR + EXPIRE on first hit = one counter per window per IP. Window resets hard when key expires.

---

*Why Lua script*

INCR and EXPIRE are two separate Redis commands. If your app crashes between them, key never expires → client permanently rate-limited. Lua runs atomically in Redis — both ops happen as one unit or not at all.

---

*Fail-open vs fail-closed*

- *Fail-open* — Redis down? Let requests through. Availability > protection. What you implemented.
- *Fail-closed* — Redis down? Block all requests (503). Protection > availability.

Choose based on what's more dangerous for your use case. Payment endpoints → fail-closed. General API → fail-open usually fine.

---

*IP extraction header priority*


X-Forwarded-For → X-Real-IP → request.getRemoteAddr()


- X-Forwarded-For: set by proxies/load balancers, contains chain of IPs — take [0] for original client
- X-Real-IP: set by Nginx, single clean IP
- getRemoteAddr(): whoever is directly connected — useless behind a proxy (you'd get the proxy's IP)

*Security note: these headers can be spoofed by clients. In production you'd validate or only trust headers set by *your infrastructure.

---

*Standard response headers*


X-RateLimit-Limit: 100        # max allowed
X-RateLimit-Remaining: 73     # left in current window
X-RateLimit-Reset: 60         # seconds until window resets


Return 429 Too Many Requests when exceeded.

---

*Where rate limiting actually lives in production*

Usually not in your app. Common real-world setups:

- *API Gateway* (Kong, AWS API Gateway) — handles rate limiting before traffic even hits your service
- *Nginx/Envoy* — limit_req_zone directive, done at proxy level
- *App-level* (what you built) — useful for per-user/per-endpoint granularity that infra-level tools can't easily do

In big tech, multiple layers are common — gateway for global limits, app-level for fine-grained business rules.

---

*Rate limiting granularity options*

- Per IP (what you built)
- Per user ID (auth token)
- Per endpoint (/api/orders vs /api/products get different limits)
- Per tenant (SaaS multi-tenancy)
- Combination (user + endpoint)

Key design changes per key: rate_limit:{ip} vs rate_limit:{userId} vs rate_limit:{endpoint} vs rate_limit:{tenant} vs rate_limit:{user}:{endpoint}

---

*Strategy pattern relevance here*

Different algorithms suit different use cases. Extracting a RateLimiter interface means you can swap Fixed Window → Token Bucket without touching the filter. Config-driven selection = no code change to switch.

I should be able to explain tradeoffs - the algo, rate limiter in app vs gateway (for global limits or granular control), fail-open vs fail-closed, why lua, why redis over in memory, ip vs user id vs endpoint vs combination


## Kafka

Async messaging — producer publishes, consumer processes independently.
Order service doesn't wait for notification to complete.
ie Kafka is a message broker — a middleman that sits between services.
Service A puts a message in Kafka. Service B picks it up whenever it's ready. They don't talk to each other directly.

Event-driven just means instead of Service A calling Service B directly (HTTP), it fires an event ("order created") and doesn't wait. Anyone who cares about that event can listen — notification service, analytics service, inventory service. Service A doesn't know or care who's listening.

### Core terms
- Producer — publishes messages to a topic
- Consumer — listens to a topic and processes messages
- Topic — named channel (`order.created`)
- Consumer Group — multiple consumers sharing load. Each message goes to ONE consumer in the group.
- Broker — Kafka server that stores and serves messages
- Offset — position of a message in a partition. Kafka tracks what each consumer group has read. Kinda like array index

### Spring Boot
- `KafkaTemplate.send(topic, event)` — publish
- `@KafkaListener(topics = "order.created", groupId = "notification-group")` — consume
- JSON serializer/deserializer — configure in `application.yml` with trusted packages

### KRaft vs Zookeeper
- Zookeeper was a separate process Kafka needed for metadata management
- KRaft (Kafka 3.3+) — Kafka manages its own metadata, no Zookeeper needed
- Always use KRaft for new setups

### Key points
- `@KafkaListener` is Spring AOP — bypassed in unit tests, mock the publisher
- Consumer group load balancing — 3 instances + 1 partition = only 1 instance consumes
- See: KafkaOrderEventPublisher.java, NotificationConsumer.java, application.yml

## Kafka — Failure Handling

Without retry/DLQ: consumer fails → message lost (kafka marks offset as read) → offset moves forward → never processed again.

### Retries
`@RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2))`
- Retries 3 times with exponential backoff: 1s → 2s → 4s
- Spring Kafka creates retry topics automatically behind the scenes
- `@Retryable` (Spring Retry) does NOT work for Kafka consumers — use `@RetryableTopic`

### DLQ (Dead Letter Queue)
After all retries exhausted → message moves to `order.created.DLT` topic instead of being dropped. Or it can be sent to a database or alert email to the ops team.

`@DltHandler` — method that handles DLT messages.

### Key points
- `@RetryableTopic` sets up DLQ automatically — no extra config needed
- DLT topic name = original topic + suffix (default `.DLT`)
- Each consumer group tracks its own retry/DLT independently
- See: NotificationConsumer.java

### Transactional Outbox (Producer Side)
- **Earlier:** `orders-service` saved the order to Postgres, then handed the event to Kafka **in memory**. If Kafka stayed down too long or the backend crashed, the event in memory disappeared forever.
- **Now:**
  1. When creating an order, Postgres saves **both** the order (`orders`) and the event (`outbox_events`, `status = PENDING`) in the **same database transaction** — so either both save or neither does.
  2. A background poller inside `orders-service` (`OutboxRelay`, every `1s`) reads any `PENDING` rows from `outbox_events` and sends them to Kafka. *(Small detail: our Spring Boot poller reads Postgres and pushes to Kafka — Kafka itself doesn't read the DB.)*
  3. Only after Kafka confirms "got it" does the poller update the DB row to `SENT`. If Kafka is down, rows just stay `PENDING` safely on disk in Postgres and get sent as soon as Kafka comes back.

## Eventual Consistency

System will be consistent eventually, just not instantly.
Gap between operation completing and side effects finishing.

### Current flow
createOrder() → saves to DB → decrements stock → publishes to Kafka → returns 201
                                                          ↓
                                            NotificationConsumer picks it up
                                            (milliseconds to seconds later)

Client gets 201 immediately. Notification hasn't fired yet. That's eventual consistency.

### When acceptable
- Notifications, emails — user doesn't care if email arrives 2s later
- Audit logs, analytics — slight delay is fine
- Any non-critical side effect

### When NOT acceptable
- Payment confirmation — user needs immediate feedback
- Inventory — async stock decrement = overselling window
- Anything financial or safety-critical
- So these are synchronous and part of the same transaction, won't put in kafka. We use HTTP/REST or gRPC.

### Strong vs Eventual consistency
- Strong — everything in one transaction, slower, tightly coupled, guaranteed
- Eventual — faster, decoupled, temporary inconsistency accepted

### Right split in our codebase
- Stock decrement → synchronous, inside createOrder transaction (strong consistency)
- Notification → async via Kafka (eventual consistency)
- Core business logic stays transactional, side effects go async

### Interview answer
"We use eventual consistency for non-critical side effects like notifications.
Core business logic — stock decrement, payment — stays in the same transaction
for strong consistency."

### Kafka — Deeper Concepts

#### Partitions
- Topic is split into partitions for parallelism
- Without partitions: one consumer processes all messages sequentially — bottleneck
- With N partitions: N consumer instances process in parallel — N times throughput
- Each partition handled by exactly one consumer instance at a time
- Rule: num consumer instances ≤ num partitions (extra instances sit idle)
- Consumer instances = same code running multiple times (multiple pods/threads)

Example: Topic order.created (3 partitions, 3 instances of NotificationConsumer)

Partition 0: [order-101, order-104, order-107]
Partition 1: [order-102, order-105, order-108]
Partition 2: [order-103, order-106, order-109]

Consumer A (instance 1) → Partition 0
Consumer B (instance 2) → Partition 1
Consumer C (instance 3) → Partition 2

All 3 processing in parallel. Add 4th instance → sits idle, no partition left.
Add 4th partition → 4th instance activates.

All 3 processing in parallel. Add a 4th consumer → sits idle, no partition left.

#### Message Ordering
- Ordering guaranteed WITHIN a partition, not across partitions
- If order matters (e.g. order events for same orderId) → use same partition key
- `kafkaTemplate.send(topic, key, event)` — same key = same partition

#### At-least-once vs Exactly-once
- Kafka default = at-least-once — consumer could process same message twice
  (e.g. consumer crashes after processing but before committing offset - so not marked as read)
- Exactly-once = possible but complex, requires idempotent consumers
- Practical fix: make your consumer idempotent — processing same message twice
  has no extra effect (e.g. check if notification already sent before sending)

#### Consumer Lag
- Gap between latest message in topic and what consumer has processed
- High lag = consumer falling behind producer
- Visible in Kafka UI → Consumer Groups tab
- Fix: add more consumers (up to partition count) or optimize consumer logic


## More on Kafka

### Architecture Diagram

```text
PRODUCERS SIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  User 1 ──┐
  User 2 ──┤──► Load Balancer ──► Payment Service (instance 1) ──┐
  User 3 ──┤                  ──► Payment Service (instance 2) ──┤
  User 4 ──┘                  ──► Payment Service (instance 3) ──┘
                                                                  │
                        each instance publishes to Kafka          │
                        topic: "payment-events"                   │
                                                                  ▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        KAFKA BROKER (cluster)

   topic: payment-events
   ┌──────────────────────────────────────────────────────────┐
   │  Partition 0  │  msg1  │  msg4  │  msg7  │  ...          │
   │  Partition 1  │  msg2  │  msg5  │  msg8  │  ...          │
   │  Partition 2  │  msg3  │  msg6  │  msg9  │  ...          │
   └──────────────────────────────────────────────────────────┘
          │                │               │
          │   each partition is an ordered, append-only log
          │   message stays here until retention period expires
          │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        CONSUMERS SIDE

   Consumer Group A: "fraud-detection-service"
          │
          ├── Fraud Worker 1  ◄──  Partition 0
          ├── Fraud Worker 2  ◄──  Partition 1
          └── Fraud Worker 3  ◄──  Partition 2
                    │
                    ▼
            flags suspicious txn
            writes to DB / emits alert

   Consumer Group B: "notification-service"
          │
          ├── Notif Worker 1  ◄──  Partition 0
          └── Notif Worker 2  ◄──  Partition 1, 2
                    │
                    ▼
            sends email / SMS to user

   Consumer Group C: "analytics-service"
          │
          └── Analytics Worker ◄── Partition 0, 1, 2  (single instance)
                    │
                    ▼
            writes to data warehouse

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### When to Use Kafka vs. Other Solutions

Choosing the right tool for event-driven architectures involves weighing decoupling and throughput against complexity. Use Kafka when you need high-throughput event streaming, replayability, or fan-out communication. Avoid it for simple request-response or single-consumer queue scenarios where REST/gRPC or RabbitMQ/SQS are better suited.

| Use Kafka | Don't Use Kafka |
|---|---|
| **Fan-out**: Same event, multiple consumers. | **Simple job queue**: One consumer only → use RabbitMQ/SQS. |
| **High throughput**: Write-heavy systems. | **Small scale**: Low message volume. |
| **Replayability**: Need to audit or reprocess messages later. | **Request-response pattern**: Synchronous communication → use REST/gRPC. |
| **Decoupling microservices**: Independent scaling and failure domains. | **Exactly-once constraint**: If you need strict, transactional exactly-once writes to an external DB (extremely complex to achieve). |

### Partition Trade-offs

Partitions are the fundamental unit of scalability in Kafka. A topic is split into multiple partitions, allowing Kafka to scale horizontally by spreading partitions across different brokers. However, choosing the partition count is a critical design decision with significant trade-offs:

*   **More partitions = more parallelism = more throughput**: Multiple consumers within a consumer group can read from different partitions simultaneously.
*   **More partitions = more open file handles**: Each partition corresponds to a directory on the broker containing log segment files.
*   **Leader election overhead**: If a broker dies, Kafka must elect new leaders for all partitions that were hosted on it. More partitions can slow down this election process.
*   **Immutability**: You cannot decrease the number of partitions on a topic once it is created (decreasing partition count would destroy message keys and ordering). Always plan partition sizing ahead.

**Rule of Thumb:** Set the partition count to `2x` or `3x` the maximum expected number of consumer instances to allow for scaling.

**Key vs. No-Key Decision:**
When a producer publishes a message, it can choose whether or not to specify a partition key. This decision impacts message routing and ordering:
*   **Using a key** (e.g., `user_id` or `order_id`): Kafka hashes the key to determine the partition. This guarantees that all messages with the same key always go to the same partition, preserving strict message ordering for that specific entity.
*   **No key**: Messages are distributed using a round-robin strategy. This ensures an even load distribution across partitions, but message ordering is not guaranteed across different messages.

### Replication & High Availability

Kafka achieves high availability and fault tolerance through replication. Each partition has one leader broker (handling reads/writes) and zero or more follower brokers (replicas).

*   **In-Sync Replicas (ISR)**: The set of replica brokers that are actively caught up with the leader's log. If a follower falls behind due to network issues or slow disk writes, it is removed from the ISR list to prevent it from delaying writes.
*   **Leader Election**: If the leader broker for a partition crashes, Kafka automatically promotes one of the in-sync replicas to take over as the new leader. This transition happens within seconds, and clients automatically reconnect with no manual intervention.

The producer configuration `acks` (acknowledgments) controls the trade-off between write performance and durability:
*   `acks=0`: Fire-and-forget. The producer sends the message and considers it successful immediately. Fastest throughput, but highest risk of data loss.
*   `acks=1`: The leader broker writes the message to its local log and immediately acknowledges the producer. Moderate speed, but data can be lost if the leader dies before followers sync.
*   `acks=all` (or `-1`): The leader waits for all ISRs to write the message to their logs before acknowledging. Slowest throughput, but guarantees zero data loss as long as at least one ISR is online.

### Delivery Semantics

Delivery semantics define the delivery guarantees between the producer, broker, and consumer. In any distributed system, networks can fail, leading to retries and potential duplicates or losses. The three primary modes are:

1.  **At-most-once**: Messages are written or read once, but may be lost on failure (e.g., consumer commits offsets *before* processing is complete).
2.  **At-least-once**: Messages are guaranteed to be delivered and processed, but duplicate messages may occur (e.g., consumer commits offsets *after* processing, but fails before the commit finishes, causing a replay on restart).
3.  **Exactly-once**: Messages are processed exactly once, even in the event of failures, using Kafka's Transactions API and idempotent producers. This comes with a performance penalty (~30% throughput drop) and complex setup.

| Mode | How | Risk | Use when |
|---|---|---|---|
| **At-most-once** | Consumer commits offset before processing. | Data loss. | Log collection, metrics. |
| **At-least-once** | Consumer commits offset after processing. | Duplicates. | Most production systems. |
| **Exactly-once** | Idempotent producer + Transactions API. | ~30% performance penalty. | Financial/payment processing, inventory. |

**Practical Approach for Production:**
Rather than paying the performance penalty of exactly-once transactions, standard practice is to use **at-least-once** delivery paired with **idempotent consumers** (de-duplication at the application/database layer).

**How to Implement Idempotent Consumers:**
*   **Database Level**: Use unique constraints (e.g., on a unique `event_id`) and perform `INSERT ... ON CONFLICT DO NOTHING` or upsert queries to ignore duplicate events.
*   **Distributed Cache (Redis)**: Perform an atomic `SETNX` using the event ID as the key before processing the message. If the key exists, skip processing.
*   **Idempotent Business Logic**: Design state modifications to be idempotent (e.g., `SET status = 'PAID'` instead of `incrementCount()`).

### Failures & Resilience

#### Producer Failures
*   **Duplicate Messages on Retry**: If a network glitch occurs after a broker writes a message but before sending the ack to the producer, the producer will retry and send the message again, causing duplicates.
    *   *Fix*: Enable `enable.idempotence=true` on the producer. The broker assigns each producer a unique ID and assigns a sequence number to each message. The broker then discards any message with a duplicate sequence number.
*   **Backpressure (Producer Sending Too Fast)**: If the producer sends messages faster than the broker can accept them, the producer's internal buffer fills up.
    *   *Fix*: The producer uses `buffer.memory` to store unsent messages. If this buffer fills, the producer blocks for up to `max.block.ms` before throwing a buffer-exhausted exception.

#### Consumer Failures
*   **Crashes before Offset Commit**: If a consumer crashes after processing a message but before committing its offset to Kafka, the new consumer taking over the partition will read the same message again. This requires idempotent consumers.
*   **Slow Processing & Rebalances**: If a consumer takes too long to process a batch of messages (exceeding `max.poll.interval.ms`), the broker assumes the consumer has hung or died. The broker kicks it out of the group and triggers a partition rebalance.
    *   *Fix*: Increase `max.poll.interval.ms` or reduce the maximum number of records returned in a single poll (`max.poll.records`).
*   **Consumer Lag**: When the rate of incoming messages exceeds the rate at which the consumer processes them.
    *   *Fix*: Scale out by adding more consumer instances to the group (up to the partition count) or optimize the consumer's processing logic.
*   **Partition Rebalances**: A rebalance occurs when the partition assignment changes within a consumer group.
    *   *Triggers*: A consumer joins or leaves the group, a consumer crashes or fails to send heartbeats within `session.timeout.ms`, or new partitions are added.
    *   *Mitigation*: Use the `CooperativeStickyAssignor` strategy. Instead of a traditional "stop-the-world" rebalance where all consumers pause processing, cooperative rebalancing only stops and reassigns the specific partitions that are changing.

#### Broker Failures
*   **Single Broker Failure**: If the leader broker for a partition dies, one of the follower brokers in the ISR is elected as the new leader. If `acks=all` was used, no data is lost.
*   **Complete ISR Outage**: If all brokers in the ISR die, the partition becomes unavailable.
    *   *Trade-off (Durability vs. Availability)*: You can configure the topic with `unclean.leader.election.enable`. If set to `true`, a non-in-sync replica can be elected as leader when it comes back online, prioritizing availability but risking data loss/corruption. If `false`, Kafka waits for an ISR broker to recover, prioritizing durability.
*   **Split-Brain Scenario**: Occurs when network partitioning causes a cluster to split, and two different nodes believe they are the active controller.
    *   *Prevention*: KRaft (and ZooKeeper previously) prevents this by requiring a quorum (majority vote) to elect a controller, ensuring only one node can manage the metadata.

### Kafka vs. RabbitMQ

While both are message brokers, Kafka and RabbitMQ are designed for different architectural patterns:

RabbitMQ keeps a list of jobs that are picked up by the workers and processed asynchronously. 

| Feature | Kafka | RabbitMQ |
|---|---|---|
| **Model** | Append-only log. Messages persist on disk after consumption. | Smart queue. Messages are deleted after consumption. |
| **Fan-out** | Efficient. Each consumer group maintains its own offset and reads independently. | Requires creating separate queues for each consumer bound to an exchange. |
| **Replayability** | Supported. You can reset the consumer offset to replay past messages. | Not supported (once acknowledged, messages are gone). |
| **Ordering** | Guaranteed within a partition. | Guaranteed within a queue. |
| **Throughput** | High throughput. Optimized for sequential disk I/O. | Moderate throughput. Optimized for complex routing. |
| **Primary Use Cases** | Event streaming, audit logging, telemetry, data pipelines. | Task queues, background jobs, RPC, complex message routing. |

**The One-Line Summary for Any Kafka Question:**
> "Kafka is an append-only distributed log. Parallelism comes from partitions, isolation comes from consumer groups, durability comes from replication. Everything else is a configuration trade-off between throughput and safety."


## Multi-Module Project (Microservices Structure)

Single repo (monorepo), multiple deployable services.
Common pattern when services need to share DTOs/contracts without duplicating code.

### Structure
Backend/                        ← root (has settings.gradle + gradlew)
├── settings.gradle             ← ties all modules together
├── gradlew                     ← controls the whole project from root
├── common/                     ← shared library (NOT a Spring Boot app)
│   └── src/main/java/com/hk/common/dto/
│       └── OrderCreatedEvent.java
├── orders-service/             ← Spring Boot app, port 8080, produces events
└── notification-service/       ← Spring Boot app, port 8081, consumes events

### Setup
- Root `settings.gradle` — lists all modules, folder names must match exactly
- `common/build.gradle` — plain Java library, no Spring Boot plugin, use Spring BOM for versions
- Reference common in other modules: `implementation project(':common')`
- Delete individual `settings.gradle` from each service — only root one needed
- Full build: `.\gradlew clean build` | Single service: `cd orders-service && .\gradlew bootRun`

### Key points
- Each service has its own `application.yml`, port, dependencies
- Services communicate only via Kafka — no direct calls, no shared DB
- `common` = shared contracts. Change once, both services pick it up
- In interviews: "shared contracts in common module, schema registry + Avro for larger scale"

### Why split?
- Notification-service can crash without affecting order creation
- Deploy and scale independently

```markdown
## Distributed Systems — SDE-2 Concepts

### Service Communication

**Sync (HTTP/REST or gRPC)**
- Service A calls Service B and waits for response
- Use when: you need immediate response (payment, stock check)
- REST — simple, widely used, JSON
- gRPC — binary (faster), strict schema, good for internal service-to-service

**Async (Kafka)**
- Service A fires event, doesn't wait
- Use when: side effects that don't need immediate response (notifications, analytics)
- Rule: need a response → HTTP. Fire and forget → Kafka

---

### Service Discovery
How does Service A know where Service B is running?
- Services register themselves on startup (Eureka, Consul)
- Other services look up by name, not hardcoded IP
- In Kubernetes — DNS handles it automatically, services find each other by name
- Without it: hardcoded URLs break when services scale or move

---

### API Gateway
Single entry point for all external clients.
Client talks to gateway, gateway routes to correct service.

Handles:
- Auth (validate JWT before request reaches service)
- Rate limiting (block abusive clients at edge)
- Routing (POST /orders → orders-service, GET /products → product-service)
- SSL termination

Examples: Kong, AWS API Gateway, Nginx
Without it: every service handles auth/rate limiting independently = duplication

---

### Distributed Tracing
Request spans multiple services — how do you debug a slow request?

- Trace ID generated at API Gateway, passed through every service via headers
- Each service logs with the same Trace ID
- Tools stitch logs together into a single trace timeline
- You already did request IDs in Week 2 — same concept, extended across services
- Tools: Jaeger, Zipkin, Datadog

---

### Circuit Breaker
Problem: Service B is slow → Service A keeps retrying → threads pile up → Service A crashes too → cascades into full outage.

Circuit breaker states:
- **Closed** — normal, requests pass through
- **Open** — too many failures, fail fast, return fallback immediately (no waiting)
- **Half-open** — after timeout, let one request through to test if B recovered

Spring Boot: Resilience4j
```java
@CircuitBreaker(name = "notificationService", fallbackMethod = "fallback")
public void sendNotification() { ... }
```

Interview answer: "Circuit breaker prevents cascading failures by failing fast instead of waiting for a slow downstream service."

---

### CAP Theorem
Distributed system can only guarantee 2 of 3:
- **C**onsistency — every read gets the latest write
- **A**vailability — every request gets a response (not guaranteed to be latest)
- **P**artition tolerance — system works even if network between nodes breaks

Partition tolerance is non-negotiable in distributed systems (networks always fail eventually).
So real choice is **CP vs AP**:
- **CP** — consistent but may reject requests during partition (banks, payments)
- **AP** — always responds but data may be stale (social media likes, notifications)

Your eventual consistency discussion from Kafka notes = AP tradeoff.

---

### Database Per Service
Each microservice owns its own database — no shared DB between services.

Why:
- Shared DB = tight coupling. One service's schema change breaks another.
- Independent deployability requires independent data

Tradeoff: joining data across services requires API calls or event-driven sync, not SQL joins.

In your codebase: orders-service has its own Postgres. notification-service has no DB (stateless).

---

### Read Replicas (Scale Reads)
Spreads query load by routing write traffic to a Primary database and read traffic to one or more Read Replica nodes.

- **Primary DB**: Handles all state changes (INSERT, UPDATE, DELETE).
- **Read Replicas**: Copy data from the Primary and handle read queries (SELECT).
- **Replication**: Typically asynchronous to maintain write throughput.

**Trade-offs & Considerations:**
*   **Replication Lag & Stale Reads**: Replicas lag milliseconds/seconds behind the primary. A user could perform a write, refresh immediately, and see stale data.
    *   *Mitigation*: Route "read-your-own-writes" queries (e.g., viewing your own profile immediately after updating it) to the Primary DB, while routing general traffic (e.g., product browsing) to Replicas.
*   **Routing Logic**: The application must manage multiple data sources. In Spring Boot, this is achieved by defining a routing data source that inspects `@Transactional(readOnly = true)` to route queries to replicas.
*   **Failover & Recovery**: If the primary node dies, a read replica must be promoted to primary. During promotion, the system may briefly reject writes.

---

### Database Sharding (Scale Writes & Reads Horizontally)
Horizontally partitions a dataset across multiple independent database servers (nodes). While read replicas only scale read throughput, sharding distributes both reads and writes by dividing the dataset, bypassing single-node hardware limits (CPU, memory, and disk I/O).

- **Shard Key**: A column value (e.g., `user_id`, `tenant_id`) used to determine which database node holds a specific row of data.
- **Routing**: `hash(Shard Key) % Number of Shards` determines the destination node.

**Trade-offs & Considerations:**
*   **Choosing a Shard Key**: This is the most critical design decision.
    *   *Good Key*: High cardinality, even distribution of data and traffic (e.g., `user_id`).
    *   *Bad Key / Hotspots*: Low cardinality or uneven distribution (e.g., sharding by `country_id` if 90% of traffic is from one country leads to a single hot database node).
*   **Cross-Shard Joins**: Traditional SQL JOINs cannot cross database instances.
    *   *Mitigation*: Denormalize static reference data (e.g., lookup tables like states or countries) by duplicating it on all shards, or perform manual application-level stitching in memory.
*   **Re-sharding Overhead**: If a shard runs out of disk/CPU and you need to add more shards, simple modulo hashing requires moving a massive amount of data.
    *   *Mitigation*: Use Consistent Hashing (Hash Ring) to minimize the amount of data that needs to be relocated when adding shards.

---

### CQRS (Command Query Responsibility Segregation)
Completely separates the operations that write data (Commands) from the operations that read data (Queries).

- **Command Model**: Handled by a database optimized for transactions, normalization, and strict validation (e.g., write-heavy PostgreSQL).
- **Query Model**: Handled by a database optimized for search, aggregations, and high-read speeds (e.g., Elasticsearch, denormalized read-optimized tables). Instead of performing expensive, CPU-heavy table joins on the spot, the query model stores precomputed views of the data.
- **Sync**: Changes to the write model publish domain events (e.g., via Kafka). Background event handlers consume these events to precompute and update the read model's data store, ensuring it is ready for instant retrieval.

**Trade-offs & Considerations:**
*   **Why CQRS? (Precomputed Views vs. On-the-Fly Joins)**: At high scale, executing complex queries with multiple table joins on the fly takes significant computation and time. CQRS shifts this overhead by **precomputing queries beforehand**. When a write occurs, background handlers capture the event, format the denormalized result, and store it. Read requests then simply fetch these precomputed, query-ready data "containers" instantly.
*   **Eventual Consistency (AP)**: The read model lags behind the write model due to async event propagation. UI must be designed to handle this (e.g., optimistic UI updates).
*   **High Complexity**: Introducing event-driven synchronization between databases increases operational overhead, risk of desynchronized state, and query debugging difficulty. Do not use CQRS for standard CRUD applications.

---

### Saga Pattern
Problem: distributed transaction across services — order created, payment charged, stock decremented. If payment fails, how do you roll back order and stock?

Two approaches:
- **Choreography** — each service publishes events, others react. No central coordinator.
  ```
  orders-service → order.created → payment-service → payment.processed → inventory-service
  if payment fails → payment.failed → orders-service rolls back
  ```
- **Orchestration** — central saga orchestrator tells each service what to do step by step

Choreography = simpler, more decoupled. Orchestration = easier to reason about complex flows.

You don't need 2PC (two-phase commit) — too slow, too complex for microservices.

---

### Interview cheat sheet
| Concept | One-liner |
|---------|-----------|
| **Service Discovery** | Services find each other by name/registry, not hardcoded IPs |
| **API Gateway** | Single entry point — handles auth, rate limiting, and dynamic routing |
| **Circuit Breaker** | Fails fast when downstream is down, preventing cascading failures |
| **CAP Theorem** | Trade-off between Consistency and Availability during network Partitions |
| **Saga Pattern** | Manages distributed transactions via sequential local transactions and compensating actions |
| **Database per Service** | Ensures loose coupling and independent deployability of microservices |
| **Read Replicas** | Diverts read load away from primary DB to secondary read-only nodes |
| **Database Sharding** | Horizontally partitions database rows across multiple servers using a shard key |
| **CQRS** | Segregates write (Command) and read (Query) paths to scale them independently |
```

```markdown
## Distributed Systems — How Our Implementations Change at Scale

### Redis Caching in Distributed Setup
Single service + Redis = fine as is.
Multiple instances of same service + Redis = still fine (that's the whole point of external cache).

Problems at scale:
- **Cache stampede** — all instances cache expires same time → all hit DB simultaneously
  Fix: probabilistic early expiry or distributed lock (Redisson) for cache rebuild
- **Cache invalidation across services** — orders-service updates product, but product-service
  has stale cache. No easy fix — TTL is your friend, or publish a `product.updated` Kafka event
  that all services listen to and evict their own cache
- **Redis goes down** — all services lose cache, hit DB directly → DB overwhelmed
  Fix: circuit breaker around Redis calls, fallback to DB

---

### Idempotency in Distributed Setup
Single service = works as is (Redis SETNX is atomic).

Problems at scale:
- **Multiple instances, same Redis** = still fine, SETNX is atomic across all instances
- **Redis goes down mid-request** — PROCESSING lock never set, duplicate request goes through
  Fix: accept this rare edge case or use Redis Sentinel/Cluster for HA
- **Different services need idempotency** — your `IdempotencyService` is already generic
  (`service`, `operation`, `key`) so it works across services as-is
- **Key namespace collision** — two services using same key prefix
  Fix: already solved with `idempotency:orders:create:{key}` pattern

---

### Rate Limiting in Distributed Setup
Single instance rate limiter (in-memory) = broken in distributed setup.
3 instances × 100 req/min limit = 300 req/min actually allowed.

Fix: move state to Redis (you already did this with Lua scripts).
Redis-based rate limiter = correct across all instances.

Problems at scale:
- **Redis goes down** — rate limiter fails. Two strategies:
  - Fail open — allow all requests (availability > correctness)
  - Fail closed — block all requests (correctness > availability)
  - Your call based on use case. APIs usually fail open.
- **Rate limit per user vs per IP** — in multi-service setup, user identity
  comes from JWT. API Gateway is better place for rate limiting than individual services.
- **Different limits per service** — API Gateway handles this centrally

---

### Kafka in Distributed Setup
Single consumer = works as is.

Problems at scale:
- **Consumer lag** — notification-service falling behind orders-service publish rate
  Fix: add more consumer instances (up to partition count)
- **Consumer rebalancing** — new instance joins group → Kafka rebalances partitions
  → brief pause in consumption. Normal behavior, just be aware.
- **Schema changes** — you rename `orderId` to `id` in `OrderCreatedEvent` in common module
  → notification-service gets `null` silently
  Fix: never remove/rename fields, only add. Or use Avro + Schema Registry.
- **Ordering across services** — if notification-service and analytics-service both consume
  `order.created`, they process in parallel but independently. Fine for most cases.
- **DLQ monitoring** — in production, `order.created.DLT` needs alerting.
  Nobody watching DLT = silent data loss.

---

### Logging + Tracing in Distributed Setup
You have request IDs + MDC in orders-service.

Problem: request hits API Gateway → orders-service → notification-service via Kafka.
Each service has its own logs. How do you trace one user's request end to end?

Fix:
- Pass `X-Request-ID` header through all HTTP calls
- Include same request ID in Kafka event payload
- Each service picks it up and adds to MDC
- Tools like Jaeger/Zipkin stitch logs into a single trace

Your current setup handles the HTTP part. Kafka part needs request ID in `OrderCreatedEvent`.

---

### General failure handling pattern
Every external call (Redis, Kafka, DB) can fail. Standard pattern:

```
try {
    // call external system
} catch (Exception e) {
    log.error(...)
    // fail open or fail closed depending on criticality
    // never let one system's failure bring down the whole service
}
```

You already do this in `IdempotencyService` — Redis fails → log → return null → proceed.
Same pattern applies to Kafka publish failures, cache misses, etc.
```

---

## Multi-Instance Service Architecture (Nginx + Multiple App Nodes)

**Core idea:** Putting Nginx in front of 2+ `orders-service` nodes is ~55 lines of config. **The real engineering isn't the load balancer — it's keeping the backend nodes stateless so splitting traffic across them never corrupts shared state.**

### 1. Nginx Edge (Load Balancing & Failover)
- **Shared state (`zone`) + `least_conn`:** distributes requests evenly across `:8081` & `:8082`; `zone` shares live connection counts and failure counters across all Nginx workers.
- **Passive health checks (`max_fails=2 fail_timeout=5s`):** after 2 dead socket hits, Nginx marks the crashed node down for `5s` and sends 100% of traffic to the surviving node.
- **Keep `X-Forwarded-For` (`$proxy_add_x_forwarded_for`):** append instead of overwriting, or every shopper looks like Nginx's single IP and hits `429` rate limits.
- **Strict `POST` safety:** by default Nginx won't replay a partially-sent `POST` — only requests in flight at the moment of crash get a brief `502`, then traffic routes cleanly to the survivor.

### 2. Why Multi-Node Backends Stay Safe (Zero In-Memory State)
- **Redis owns shared request state:** rate limiting (Lua script) and idempotency (`SETNX`) live in Redis, so 2 nodes share the same limits and duplicate checks.
- **Postgres owns concurrency & outbox handoff:** `@Version` prevents double-selling stock across nodes, and `OutboxRelay` uses `SKIP LOCKED` + `reclaimStaleProcessing` (`60s`) so surviving nodes pick up work orphaned by a crashed node.
- **Production sizing & drains:** `nodes × Hikari max < Postgres max_connections` (e.g., `2 × 30 = 60 < 100`), plus `server.shutdown: graceful` and readiness/liveness probes for rolling restarts.
