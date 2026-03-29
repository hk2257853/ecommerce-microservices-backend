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