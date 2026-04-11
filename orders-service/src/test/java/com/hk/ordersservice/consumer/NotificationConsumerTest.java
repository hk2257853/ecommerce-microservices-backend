package com.hk.ordersservice.consumer;

import com.hk.ordersservice.dto.OrderCreatedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class NotificationConsumerTest {

    @InjectMocks
    private NotificationConsumer notificationConsumer;

    private OrderCreatedEvent testEvent;

    @BeforeEach
    void setUp() {
        testEvent = OrderCreatedEvent.builder()
                .orderId(1L)
                .userId(100L)
                .totalAmount(new BigDecimal("99.99"))
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void handleOrderCreatedEvent_Success() {
        // When & Then
        assertDoesNotThrow(() -> notificationConsumer.handleOrderCreatedEvent(testEvent));
    }

    @Test
    void handleDlt_Success() {
        // When & Then
        assertDoesNotThrow(() -> notificationConsumer.handleDlt(testEvent));
    }
}
