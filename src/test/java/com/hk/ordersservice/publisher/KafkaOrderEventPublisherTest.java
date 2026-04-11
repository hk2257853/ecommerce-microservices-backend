package com.hk.ordersservice.publisher;

import com.hk.ordersservice.dto.OrderCreatedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KafkaOrderEventPublisherTest {

    @Mock
    private KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;

    @InjectMocks
    private KafkaOrderEventPublisher publisher;

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
    void publishOrderCreated_Success() {
        // Given
        when(kafkaTemplate.send(eq("order.created"), eq(testEvent)))
                .thenReturn(java.util.concurrent.CompletableFuture.completedFuture(null));

        // When
        assertDoesNotThrow(() -> publisher.publishOrderCreated(testEvent));

        // Then
        verify(kafkaTemplate, times(1)).send("order.created", testEvent);
    }

    @Test
    void publishOrderCreated_Failure() {
        // Given
        RuntimeException testException = new RuntimeException("Kafka connection failed");
        when(kafkaTemplate.send(eq("order.created"), eq(testEvent))).thenThrow(testException);

        // When & Then
        RuntimeException thrown = assertThrows(RuntimeException.class,
                () -> publisher.publishOrderCreated(testEvent));

        assertEquals("Kafka connection failed", thrown.getMessage());
        verify(kafkaTemplate, times(1)).send("order.created", testEvent);
    }
}
