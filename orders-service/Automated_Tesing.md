# Unit and Repository Tests Implementation Plan

This plan implements comprehensive unit tests for services and repository tests following AAA pattern with Mockito and AssertJ.

## Test Structure Overview

### Unit Tests (Pure Unit Tests - @ExtendWith(MockitoExtension.class))
- **OrderServiceTest**: 5 test cases covering createOrder and getOrdersByUserId
- **UserServiceTest**: 2 test cases covering createUser scenarios  
- **ProductServiceTest**: 1 test case covering createProduct happy path

### Repository Tests (@DataJpaTest)
- **UserRepositoryTest**: 3 test cases for email operations
- **OrderRepositoryTest**: 1 test case for user order queries

## Implementation Approach

### 1. Unit Tests Strategy
- Mock all external dependencies (repositories, factories, mappers)
- Test business logic in isolation
- Verify interactions with mocks
- Use AssertJ for fluent assertions

### 2. Repository Tests Strategy  
- Use @DataJpaTest for in-memory database testing
- Test actual JPA query methods
- Verify data persistence and retrieval
- Use TestEntityManager for setup

### 3. Test Coverage
- Happy path scenarios (successful operations)
- Error scenarios (exceptions, validation failures)
- Edge cases and boundary conditions
- Mock interaction verification

### 4. File Organization
```
src/test/java/com/hk/ordersservice/
├── service/
│   ├── OrderServiceTest.java
│   ├── UserServiceTest.java
│   └── ProductServiceTest.java
└── repository/
    ├── UserRepositoryTest.java
    └── OrderRepositoryTest.java
```

### 5. Key Testing Patterns
- **AAA Pattern**: Clear Arrange, Act, Assert sections with comments
- **Mockito**: Mock all dependencies, verify interactions
- **AssertJ**: Fluent assertions for readable test code
- **Test Data Builders**: Create test objects efficiently
- **Exception Testing**: Verify exception types and messages

### 6. Dependencies Required
All dependencies already available in build.gradle:
- spring-boot-starter-test (includes JUnit 5, Mockito, AssertJ)
- spring-boot-starter-data-jpa (for @DataJpaTest)

### 7. Test Scenarios Detailed

#### OrderService Tests
1. **createOrder happy path**: Valid user + products → order created
2. **createOrder user not found**: Invalid userId → ResourceNotFoundException
3. **createOrder product not found**: Invalid productId → RuntimeException
4. **getOrdersByUserId happy path**: Valid userId → returns order list
5. **getOrdersByUserId user not found**: Invalid userId → empty list

#### UserService Tests  
1. **createUser happy path**: Valid request → user created
2. **createUser duplicate email**: Existing email → DuplicateResourceException

#### ProductService Tests
1. **createProduct happy path**: Valid request → product created

#### Repository Tests
1. **UserRepository**: existsByEmail, findByEmail functionality
2. **OrderRepository**: findByUserId functionality

This plan ensures comprehensive test coverage while maintaining clean, readable test code following best practices.
