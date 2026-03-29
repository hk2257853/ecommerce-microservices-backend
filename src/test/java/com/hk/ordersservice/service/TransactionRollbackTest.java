package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.exception.InsufficientStockException;
import com.hk.ordersservice.repository.OrderRepository;
import com.hk.ordersservice.repository.ProductRepository;
import com.hk.ordersservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class TransactionRollbackTest {

        @Autowired
        private OrderService orderService;

        @Autowired
        private ProductRepository productRepository;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private OrderRepository orderRepository;

        private User testUser;
        private Product sufficientProduct;
        private Product insufficientProduct;

        @BeforeEach
        void setUp() {
                // Clean up database in correct order to respect foreign key constraints
                orderRepository.deleteAll(); // First: Delete order items (via cascade)
                productRepository.deleteAll(); // Second: Delete products
                userRepository.deleteAll(); // Third: Delete users

                // Create test user
                testUser = User.builder()
                                .name("Test User")
                                .email("test-rollback@example.com") // Unique email
                                .address("123 Test St")
                                .build();
                testUser = userRepository.save(testUser);

                // Create product with sufficient stock
                sufficientProduct = Product.builder()
                                .name("Sufficient Stock Product")
                                .unitPrice(new BigDecimal("50.00"))
                                .quantity(10)
                                .build();
                sufficientProduct = productRepository.save(sufficientProduct);

                // Create product with insufficient stock
                insufficientProduct = Product.builder()
                                .name("Insufficient Stock Product")
                                .unitPrice(new BigDecimal("75.00"))
                                .quantity(2)
                                .build();
                insufficientProduct = productRepository.save(insufficientProduct);
        }

        @Test
        void testTransactionRollbackOnInsufficientStock() {
                // Record initial stock levels
                Integer initialSufficientStock = sufficientProduct.getQuantity();
                Integer initialInsufficientStock = insufficientProduct.getQuantity();

                // Create order request with mixed items - one sufficient, one insufficient
                OrderCreateRequest orderRequest = OrderCreateRequest.builder()
                                .userId(testUser.getId())
                                .items(List.of(
                                                OrderItemRequest.builder()
                                                                .productId(sufficientProduct.getId())
                                                                .quantity(3) // This should be fine
                                                                .build(),
                                                OrderItemRequest.builder()
                                                                .productId(insufficientProduct.getId())
                                                                .quantity(5) // This should fail (only 2 available)
                                                                .build()))
                                .build();

                // Attempt to create order - should fail due to insufficient stock
                InsufficientStockException exception = assertThrows(
                                InsufficientStockException.class,
                                () -> orderService.createOrder(orderRequest));

                // Verify the exception message
                assertTrue(exception.getMessage().contains("Insufficient stock"));
                assertTrue(exception.getMessage().contains("Insufficient Stock Product"));

                // Verify no order was created
                assertEquals(0, orderRepository.count());

                // Verify stock levels were NOT changed (transaction rolled back)
                Product unchangedSufficient = productRepository.findById(sufficientProduct.getId()).orElseThrow();
                Product unchangedInsufficient = productRepository.findById(insufficientProduct.getId()).orElseThrow();

                assertEquals(initialSufficientStock, unchangedSufficient.getQuantity());
                assertEquals(initialInsufficientStock, unchangedInsufficient.getQuantity());
        }

        @Test
        void testSuccessfulOrderCommitsStockChanges() {
                // Record initial stock level
                Integer initialStock = sufficientProduct.getQuantity();

                // Create order request with sufficient stock
                OrderCreateRequest orderRequest = OrderCreateRequest.builder()
                                .userId(testUser.getId())
                                .items(List.of(
                                                OrderItemRequest.builder()
                                                                .productId(sufficientProduct.getId())
                                                                .quantity(3) // This should be fine
                                                                .build()))
                                .build();

                // Create order - should succeed
                assertDoesNotThrow(() -> {
                        orderService.createOrder(orderRequest);
                });

                // Verify order was created
                assertEquals(1, orderRepository.count());

                // Verify stock was decremented (transaction committed)
                Product updatedProduct = productRepository.findById(sufficientProduct.getId()).orElseThrow();
                assertEquals(initialStock - 3, updatedProduct.getQuantity());
        }

}
