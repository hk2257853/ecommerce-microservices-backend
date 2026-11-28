package com.hk.ordersservice.publisher;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hk.common.dto.OrderCreatedEvent;
import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import com.hk.ordersservice.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxOrderEventPublisherTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    private ObjectMapper objectMapper;
    private OutboxOrderEventPublisher publisher;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        publisher = new OutboxOrderEventPublisher(outboxEventRepository, objectMapper);
    }

    @Test
    void publishOrderCreated_SavesPendingOutboxEvent() throws Exception {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(42L)
                .userId(7L)
                .totalAmount(new BigDecimal("199.50"))
                .createdAt(LocalDateTime.of(2026, 11, 28, 12, 0))
                .build();

        publisher.publishOrderCreated(event);

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository).save(captor.capture());

        OutboxEvent saved = captor.getValue();
        assertEquals("42", saved.getAggregateId());
        assertEquals("ORDER_CREATED", saved.getEventType());
        assertEquals("order.created", saved.getTopic());
        assertEquals(OutboxStatus.PENDING, saved.getStatus());
        assertEquals(0, saved.getRetryCount());

        OrderCreatedEvent deserialized = objectMapper.readValue(saved.getPayload(), OrderCreatedEvent.class);
        assertEquals(event, deserialized);
    }

    @Test
    void publishOrderCreated_SerializationFailureThrowsWithoutSaving() throws Exception {
        ObjectMapper brokenMapper = mock(ObjectMapper.class);
        when(brokenMapper.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") {});
        OutboxOrderEventPublisher brokenPublisher = new OutboxOrderEventPublisher(outboxEventRepository, brokenMapper);

        OrderCreatedEvent event = OrderCreatedEvent.builder().orderId(9L).build();

        assertThrows(IllegalStateException.class, () -> brokenPublisher.publishOrderCreated(event));
        verify(outboxEventRepository, never()).save(any());
    }
}

