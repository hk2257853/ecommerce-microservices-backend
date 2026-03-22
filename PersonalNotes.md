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
8. Design patterns in the current code (make sure we not overdoing) - stuff like builder, 

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

