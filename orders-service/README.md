# Orders Service (Commerce Core)

> High-throughput, transactional e-commerce order management microservice built with **Java 17**, **Spring Boot 3**, **PostgreSQL**, **Redis**, and **Apache Kafka**.

---

## ⚡ Highlights

- **Flyway Database Migrations**: Version-controlled DDL schema evolutions for users, products, orders, and order items.
- **Idempotency Protection**: Ensures duplicate requests (network retries, replay attacks) do not result in double charges or duplicate inventory reservations.
- **Redis Lua Atomic Rate Limiter**: Servlet filter running ahead of controllers that enforces fixed-window IP limits (10 req / 60s) using atomic Redis Lua scripts, with fail-open safety.
- **Redis Dynamic Caching**: Spring `@Cacheable` integration on product catalogs with dedicated cache eviction endpoints (`/api/cache/clear/products`).
- **Asynchronous Kafka Event Streaming**: Automatically emits `OrderCreatedEvent` to Kafka topics upon successful checkout.

---

## 🛠️ API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/users` | Register a new user |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/products` | Create a catalog product |
| `GET` | `/api/products` | Paginated, filtered, and sorted products catalog |
| `GET` | `/api/products/{id}` | Get product details (cached in Redis) |
| `PUT` | `/api/products/{id}` | Update product details & price |
| `DELETE` | `/api/products/{id}` | Delete product |
| `POST` | `/api/orders` | Place order with validation & idempotency key |
| `GET` | `/api/orders?userId={id}` | Retrieve orders for a user |
| `GET` | `/api/orders/{id}/items` | List line items for an order |
| `GET` | `/api/cache/stats` | Inspect Redis cache namespaces |
| `DELETE` | `/api/cache/clear/products`| Flush product cache entries |

---

## 🚀 Running Locally

```powershell
# 1. Start Redis & Kafka infrastructure
docker compose up -d

# 2. Run the application
cd ..
.\gradlew.bat :orders-service:bootRun
```

*Interactive OpenAPI / Swagger Docs:* [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)

