# Stock/Inventory Management Implementation Plan

This plan implements comprehensive stock/inventory management with optimistic locking, immediate stock decrement on order creation, restocking functionality, and out-of-stock handling.

## Core Requirements
- Stock decrements immediately upon order creation
- Restocking via separate API endpoint (PUT /api/products/{id}/restock)
- Products marked as "out of stock" when quantity reaches 0
- Default stock quantity of 5 for existing products
- Optimistic locking for concurrency control
- Transactional safety with automatic rollback

## Phase 1: Entity & Exception Changes

### Product Entity Updates
- Add `quantity` field with `@Min(0)` validation
- Add `@Version` field for optimistic locking
- Add `isInStock()` helper method

### New Exception
- Create `InsufficientStockException` extending `BusinessRuleException`
- Add proper HTTP status handling in `GlobalExceptionHandler`

## Phase 2: Business Logic Implementation

### OrderFactory Changes
- Add stock validation before order item creation
- Throw `InsufficientStockException` for insufficient quantities

### OrderService Updates
- Implement stock decrement logic within existing transaction
- Ensure atomic operation: validate → decrement → create order

### ProductService Enhancements
- Add stock validation for product creation
- Add restocking functionality
- Update product listing to include stock status

### New Controller Methods
- Add restocking endpoint: `PUT /api/products/{id}/restock`
- Add stock check endpoint: `GET /api/products/{id}/stock`

## Phase 3: DTO Updates

### ProductCreateRequest
- Add `quantity` field with `@Min(0)` validation
- Default quantity of 5 for backward compatibility

### ProductResponse
- Add `quantity` field
- Add `inStock` boolean field

### New DTO
- Create `RestockRequest` DTO for restocking operations

## Phase 4: Data Migration & Seeding

### Database Migration
- Add `quantity` column with default value of 5
- Add `version` column for optimistic locking

### DataInitializer Updates
- Include random quantities (1-50) for seed products
- Ensure realistic stock distribution

## Phase 5: Comprehensive Testing

### Unit Test Updates
- Update `ProductServiceTest` with quantity field
- Update `OrderServiceTest` with stock validation scenarios
- Add tests for insufficient stock exceptions
- Add tests for successful stock decrement

### Integration Test Updates
- Update `OrderControllerIntegrationTest` with stock verification
- Update `ProductControllerPaginationIntegrationTest` with quantity data
- Add tests for restocking endpoint
- Add tests for out-of-stock product behavior

### New Test Classes
- `StockManagementIntegrationTest`: End-to-end stock scenarios
- `OptimisticLockingTest`: Concurrency and race conditions
- `TransactionRollbackTest`: Failure and rollback scenarios

## Phase 6: API Response Enhancements

### Product Listing Updates
- Include `quantity` and `inStock` fields in all product responses
- Maintain backward compatibility

### Error Responses
- Proper HTTP 400 for insufficient stock
- Proper HTTP 409 for optimistic locking failures
- Clear error messages with product details

## Implementation Order

1. **Entity & Exception Changes** (Foundation)
2. **Business Logic** (Core functionality)
3. **DTO & API Updates** (Interface)
4. **Data Migration** (Database)
5. **Testing** (Validation)
6. **Integration** (End-to-end)

## Key Technical Decisions

### Restocking Approach
- Separate endpoint for clear audit trail
- Positive-only quantity increases
- Validation for minimum restock amounts

### Concurrency Handling
- JPA `@Version` for automatic optimistic locking
- Custom exception handling for user-friendly errors
- Retry mechanism guidance in API documentation

### Stock Status Logic
- `inStock = quantity > 0`
- Filter out-of-stock products from search results if needed
- Clear visual indicators in API responses

## Success Criteria

- All orders properly decrement stock
- Concurrent orders handled safely
- Insufficient stock scenarios properly rejected
- Restocking functionality works correctly
- All existing tests pass
- New tests achieve >90% coverage
- API responses remain backward compatible
