package com.hk.ordersservice.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hk.common.dto.OrderCreatedEvent;
import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import com.hk.ordersservice.repository.OutboxEventRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxRelayTest {

    @Mock
    private OutboxStore outboxStore;

    @Mock
    private KafkaOrderEventPublisher kafkaPublisher;

    @Mock
    private OutboxEventRepository outboxEventRepository;

    private ObjectMapper objectMapper;
    private SimpleMeterRegistry meterRegistry;
    private OutboxRelay outboxRelay;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        meterRegistry = new SimpleMeterRegistry();
        outboxRelay = new OutboxRelay(
                outboxStore,
                kafkaPublisher,
                objectMapper,
                outboxEventRepository,
                meterRegistry,
                50,
                50,
                30,
                60);
    }

    @Test
    void pollAndPublish_HappyPathMarksBatchSent() throws Exception {
        OutboxEvent e1 = outboxEvent(1L, 101L);
        OutboxEvent e2 = outboxEvent(2L, 102L);
        when(outboxStore.claimPendingBatch(50, 60)).thenReturn(List.of(e1, e2));

        outboxRelay.pollAndPublish();

        verify(kafkaPublisher, times(2)).publishOrderCreated(any(OrderCreatedEvent.class));
        verify(outboxStore).markSent(List.of(1L, 2L));
        verify(outboxStore, never()).markFailureAndReleaseUntried(any(), any(), anyInt(), anyLong(), any());
        assertEquals(2.0, meterRegistry.counter("outbox.events.published").count());
        assertEquals(0.0, meterRegistry.counter("outbox.events.failed").count());
    }

    @Test
    void pollAndPublish_ShortCircuitsOnKafkaFailureAndPreservesUntried() throws Exception {
        OutboxEvent e1 = outboxEvent(1L, 101L);
        OutboxEvent e2 = outboxEvent(2L, 102L);
        OutboxEvent e3 = outboxEvent(3L, 103L);
        when(outboxStore.claimPendingBatch(50, 60)).thenReturn(List.of(e1, e2, e3));

        doNothing()
                .doThrow(new IllegalStateException("Kafka down"))
                .when(kafkaPublisher).publishOrderCreated(any(OrderCreatedEvent.class));

        outboxRelay.pollAndPublish();

        verify(kafkaPublisher, times(2)).publishOrderCreated(any(OrderCreatedEvent.class));
        verify(outboxStore).markSent(List.of(1L));
        verify(outboxStore).markFailureAndReleaseUntried(
                eq(e2), any(IllegalStateException.class), eq(50), eq(30L), eq(List.of(3L)));
        assertEquals(1.0, meterRegistry.counter("outbox.events.published").count());
        assertEquals(1.0, meterRegistry.counter("outbox.events.failed").count());
    }

    private OutboxEvent outboxEvent(Long id, Long orderId) throws Exception {
        OrderCreatedEvent payload = OrderCreatedEvent.builder()
                .orderId(orderId)
                .userId(1L)
                .totalAmount(new BigDecimal("50.00"))
                .createdAt(LocalDateTime.of(2026, 11, 28, 12, 0))
                .build();
        return OutboxEvent.builder()
                .id(id)
                .aggregateId(String.valueOf(orderId))
                .eventType("ORDER_CREATED")
                .topic("order.created")
                .payload(objectMapper.writeValueAsString(payload))
                .status(OutboxStatus.PROCESSING)
                .retryCount(0)
                .build();
    }
}

