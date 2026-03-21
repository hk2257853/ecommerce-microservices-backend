30-Day System Design Prep Roadmap (SDE-2 Backend)
Daily Plan: 2 hours per day
• 1 hour implementation (coding)
• 1 hour theory/interview preparation

Goal: Master only what is needed for SDE-2 system design interviews — REST, DB design, caching, async, and scaling.

Week 1 – Backend Fundamentals (Spring + DB)
• Day 1–2: Setup Spring Boot project, MySQL/Postgres, layered architecture, basic CRUD (Orders).
• Day 3: Proper HTTP codes, DTOs, validation, global exception handling.
• Day 4: Pagination, filtering, sorting APIs.
• Day 5: DB schema design, indexes, explain plans, avoid N+1 queries.
• Day 6: Unit + integration tests.
• Day 7: Revise REST best practices and normalization vs denormalization.

Week 2 – Performance + Correctness
• Day 8: Add Redis caching for read-heavy endpoints.
• Day 9: Cache invalidation strategies and TTL tuning.
• Day 10: Implement idempotency keys for payments/orders.
• Day 11: Add rate limiting (token bucket or library).
• Day 12: Logging, request IDs, structured logs.
• Day 13: Basic load testing and performance measurement.
• Day 14: Revise caching + idempotency theory.

Week 3 – Async & Distributed Systems
• Day 15: Install Kafka or RabbitMQ.
• Day 16: Produce events (order.created).
• Day 17: Consume events (notification worker).
• Day 18: Retries, DLQ, failure handling.
• Day 19: Eventual consistency and tradeoffs.
• Day 20: Optionally split into 2 services.
• Day 21: Revise queues and async workflows.

Week 4 – Pure System Design (Interview Mode)
• Day 22: Load balancers and horizontal scaling.
• Day 23: Caching strategies and Redis basics.
• Day 24: DB scaling: read replicas and sharding.
• Day 25: Message queues and backpressure.
• Day 26: Rate limiting and consistent hashing.
• Day 27–29: Practice designing systems: URL shortener, E-commerce orders, Chat app, Ticket booking.
• Day 30: Mock interviews — explain architecture, scaling, failures, tradeoffs.

Final Readiness Checklist
• Can design clean REST APIs.
• Can design DB schema with indexes.
• Know when and how to use caching.
• Understand idempotency and retries.
• Know queues and async flows.
• Can explain scaling and tradeoffs clearly.
