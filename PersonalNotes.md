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
6. TODO: verify and study the codebase if it's as per the MVP_design.
damn the output is too good. Done
7. switch to constructor injection instead of autowired - done
8. Design patterns in the current code (make sure we not overdoing) - stuff like builder (lombok), factory pattern for create order. TODO: factory part and learn .map(OrderItemRequest::getProductId) - NOTE: gotta practice stream well
Additionally added response mappers along with not null in response java files (to avoid sending null in response) - reduced code significantly.
10. add automated testing... unit test and repository test for now. will add integration test later.
have saved the plan
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
Spring Data JPA Repository Notes: (TODO: current notes is not very useful)

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