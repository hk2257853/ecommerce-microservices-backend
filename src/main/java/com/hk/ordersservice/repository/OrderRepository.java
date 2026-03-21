package com.hk.ordersservice.repository;

import com.hk.ordersservice.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    
    Optional<Order> findByOrderNumber(String orderNumber);
    
    List<Order> findByCustomerEmail(String customerEmail);
    
    List<Order> findByStatus(com.hk.ordersservice.entity.OrderStatus status);
    
    @Query("SELECT o FROM Order o WHERE o.customerName LIKE %:customerName%")
    List<Order> findByCustomerNameContaining(@Param("customerName") String customerName);
    
    @Query("SELECT o FROM Order o WHERE o.productName LIKE %:productName%")
    List<Order> findByProductNameContaining(@Param("productName") String productName);
}

/*
Spring Data JPA Repository Notes:

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

- @Query:
  - Used for complex queries (JOIN, GROUP BY, aggregations)
  - Uses JPQL (entity + field names, not table/column names)

- @Param:
  - Binds method parameter to query parameter

- Notes:
  - GROUP BY / COUNT / SUM → use @Query (not supported in method names)
  - @Repository is optional (auto-detected by Spring)
*/