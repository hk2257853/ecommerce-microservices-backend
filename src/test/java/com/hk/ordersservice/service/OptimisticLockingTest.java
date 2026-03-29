package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.repository.OrderItemRepository;
import com.hk.ordersservice.repository.OrderRepository;
import com.hk.ordersservice.repository.ProductRepository;
import com.hk.ordersservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class OptimisticLockingTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private OrderRepository orderRepository;

    private User testUser;
    private Product testProduct;

    @BeforeEach
    void setUp() {
        // Correct cleanup order - child tables first
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
        productRepository.deleteAll();
        userRepository.deleteAll();

        // Create test user
        testUser = User.builder()
                .name("Test User")
                .email("test-optimistic@example.com") // Unique email
                .address("123 Test St")
                .build();
        testUser = userRepository.save(testUser);

        // Create test product
        testProduct = Product.builder()
                .name("Test Product")
                .unitPrice(new BigDecimal("50.00"))
                .quantity(10)
                .build();
        testProduct = productRepository.save(testProduct);
    }

    @Test
    void testConcurrentOrderCreationOptimisticLocking() {
        OrderCreateRequest orderRequest1 = OrderCreateRequest.builder()
                .userId(testUser.getId())
                .items(List.of(
                        OrderItemRequest.builder()
                                .productId(testProduct.getId())
                                .quantity(3)
                                .build()))
                .build();

        // Load product before first order (simulating concurrent transaction)
        Product product2 = productRepository.findById(testProduct.getId()).orElseThrow();

        // First order succeeds - in this the product quantity will be updated
        // (decremented by 3) and committed thus incrementing the version
        assertDoesNotThrow(() -> orderService.createOrder(orderRequest1));

        // Second transaction tries to save stale data → should throw optimistic locking
        // exception
        product2.setQuantity(product2.getQuantity() - 1);

        assertThrows(ObjectOptimisticLockingFailureException.class, () -> {
            productRepository.save(product2);
        });
    }
}
