package com.hk.ordersservice.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OrderTest {

    @Mock
    private User mockUser;
    
    @Mock
    private List<OrderItem> mockOrderItems;

    private Order order;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        order = Order.builder()
                .id(1L)
                .user(mockUser)
                .totalAmount(new BigDecimal("100.50"))
                .status(OrderStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .orderItems(mockOrderItems)
                .build();
    }

    @Test
    void testPrePersistSetsDefaultValues() {
        Order newOrder = new Order();
        newOrder.setUser(mockUser);
        newOrder.setTotalAmount(new BigDecimal("50.00"));
        
        // Simulate @PrePersist
        newOrder.onCreate();
        
        assertNotNull(newOrder.getCreatedAt());
        assertNotNull(newOrder.getUpdatedAt());
        assertEquals(OrderStatus.PENDING, newOrder.getStatus());
    }

    @Test
    void testPrePersistKeepsExistingStatus() {
        Order newOrder = new Order();
        newOrder.setUser(mockUser);
        newOrder.setTotalAmount(new BigDecimal("50.00"));
        newOrder.setStatus(OrderStatus.CONFIRMED);
        
        // Simulate @PrePersist
        newOrder.onCreate();
        
        assertEquals(OrderStatus.CONFIRMED, newOrder.getStatus());
    }

    @Test
    void testPreUpdateUpdatesTimestamp() {
        LocalDateTime originalUpdatedAt = order.getUpdatedAt();
        
        // Wait a bit to ensure different timestamp
        try {
            Thread.sleep(1);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Simulate @PreUpdate
        order.onUpdate();
        
        assertTrue(order.getUpdatedAt().isAfter(originalUpdatedAt));
    }

    @Test
    void testOrderStatusEnum() {
        assertEquals(3, OrderStatus.values().length);
        assertTrue(Arrays.asList(OrderStatus.values()).contains(OrderStatus.PENDING));
        assertTrue(Arrays.asList(OrderStatus.values()).contains(OrderStatus.CONFIRMED));
        assertTrue(Arrays.asList(OrderStatus.values()).contains(OrderStatus.CANCELLED));
    }
}
