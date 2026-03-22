# E-commerce MVP Transformation Plan

This plan transforms the current simple order system into a proper e-commerce MVP with relational entities (User, Product, Order, OrderItem) and all required API endpoints, leveraging Lombok and other dependencies from build.gradle.

## Phase 1: Entity Layer Transformation
- **Create User entity** with id, name, email, address fields using Lombok annotations
- **Create Product entity** with id, name, unitPrice fields using Lombok annotations  
- **Create OrderItem entity** with id, orderId, productId, quantity, unitPrice fields using Lombok annotations
- **Refactor Order entity** to match new design: id, userId, totalAmount, status, createdAt with proper relationships
- **Add JPA relationships**: User 1-N Order, Order 1-N OrderItem, OrderItem N-1 Product
- **Simplify OrderStatus enum** to PENDING, CONFIRMED, CANCELLED for MVP

## Phase 2: Repository Layer
- **Create UserRepository** extending JpaRepository with findByEmail method
- **Create ProductRepository** extending JpaRepository  
- **Create OrderItemRepository** extending JpaRepository with findByOrderId method
- **Update OrderRepository** with findByUserId and custom queries

## Phase 3: DTO Layer
- **Create User DTOs**: UserCreateRequest, UserResponse
- **Create Product DTOs**: ProductCreateRequest, ProductResponse  
- **Create Order DTOs**: OrderCreateRequest (with items array), OrderResponse
- **Create OrderItem DTOs**: OrderItemResponse
- **Add validation annotations** for email format, positive prices, required fields

## Phase 4: Service Layer
- **Create UserService** with createUser and getAllUsers methods
- **Create ProductService** with createProduct, getAllProducts methods
- **Refactor OrderService** to handle new relational model with order creation logic
- **Add business logic**: calculate total amount, validate product existence, handle order items

## Phase 5: Controller Layer
- **Create UserController** with POST /users and GET /users endpoints
- **Create ProductController** with POST /products and GET /products endpoints
- **Refactor OrderController** to match new API design:
  - POST /orders (userId + items array)
  - GET /orders?userId=x 
  - GET /orders/{orderId}/items
- **Add OpenAPI annotations** for API documentation

## Phase 6: Configuration & Cleanup
- **Remove old entity files** that are no longer needed
- **Update package structure** to reflect new e-commerce domain
- **Verify database schema** creation with ddl-auto=update
- **Test all endpoints** work with new relational model

## Technical Implementation Details
- Use Lombok @Data, @Builder, @NoArgsConstructor, @AllArgsConstructor for all entities
- Use Bean Validation annotations (@NotNull, @Email, @Positive)
- Use BigDecimal for monetary values
- Use LocalDateTime for timestamps
- Implement proper exception handling for validation errors
- Use Spring Data JPA relationship annotations (@OneToMany, @ManyToOne, etc.)
