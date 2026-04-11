package com.hk.ordersservice.repository;

import com.hk.ordersservice.entity.Order;
import com.hk.ordersservice.entity.OrderStatus;
import com.hk.ordersservice.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class OrderRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrderRepository orderRepository;

    private User testUser;
    private Order testOrder1;
    private Order testOrder2;
    private Order testOrder3;

    @BeforeEach
    void setUp() {
        // Create and persist test user
        testUser = User.builder()
                .name("Test User")
                .email("test@example.com")
                .address("123 Test St")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        testUser = entityManager.persistAndFlush(testUser);

        // Create and persist test orders
        testOrder1 = Order.builder()
                .user(testUser)
                .totalAmount(new BigDecimal("100.00"))
                .status(OrderStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        testOrder2 = Order.builder()
                .user(testUser)
                .totalAmount(new BigDecimal("200.00"))
                .status(OrderStatus.CONFIRMED)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        testOrder3 = Order.builder()
                .user(testUser)
                .totalAmount(new BigDecimal("300.00"))
                .status(OrderStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        testOrder1 = entityManager.persistAndFlush(testOrder1);
        testOrder2 = entityManager.persistAndFlush(testOrder2);
        testOrder3 = entityManager.persistAndFlush(testOrder3);

        entityManager.clear();
    }

    @Test
    void testFindByUserId() {
        List<Order> orders = orderRepository.findByUserId(testUser.getId());

        assertNotNull(orders);
        assertEquals(3, orders.size());
        
        orders.forEach(order -> assertEquals(testUser.getId(), order.getUser().getId()));
    }

    @Test
    void testFindByUserIdNoResults() {
        List<Order> orders = orderRepository.findByUserId(999L);

        assertNotNull(orders);
        assertTrue(orders.isEmpty());
    }

    @Test
    void testFindByStatus() {
        List<Order> pendingOrders = orderRepository.findByStatus(OrderStatus.PENDING);

        assertNotNull(pendingOrders);
        assertEquals(2, pendingOrders.size());
        
        pendingOrders.forEach(order -> assertEquals(OrderStatus.PENDING, order.getStatus()));
    }

    @Test
    void testFindByStatusNoResults() {
        List<Order> cancelledOrders = orderRepository.findByStatus(OrderStatus.CANCELLED);

        assertNotNull(cancelledOrders);
        assertTrue(cancelledOrders.isEmpty());
    }

    @Test
    void testFindByUserIdAndStatus() {
        List<Order> userPendingOrders = orderRepository.findByUserIdAndStatus(
                testUser.getId(), OrderStatus.PENDING);

        assertNotNull(userPendingOrders);
        assertEquals(2, userPendingOrders.size());
        
        userPendingOrders.forEach(order -> {
            assertEquals(testUser.getId(), order.getUser().getId());
            assertEquals(OrderStatus.PENDING, order.getStatus());
        });
    }

    @Test
    void testFindByUserIdAndStatusNoResults() {
        List<Order> userCancelledOrders = orderRepository.findByUserIdAndStatus(
                testUser.getId(), OrderStatus.CANCELLED);

        assertNotNull(userCancelledOrders);
        assertTrue(userCancelledOrders.isEmpty());
    }
}
