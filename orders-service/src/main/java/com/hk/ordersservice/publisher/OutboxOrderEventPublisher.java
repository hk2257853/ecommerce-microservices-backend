package com.hk.ordersservice.publisher;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hk.common.dto.OrderCreatedEvent;
import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import com.hk.ordersservice.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Primary event publisher that persists domain events to the transactional outbox
 * within the caller's active database transaction instead of talking directly to Kafka.
 */
@Component
@Primary
@RequiredArgsConstructor
@Slf4j
public class OutboxOrderEventPublisher implements OrderEventPublisherIF {

    static final String TOPIC_ORDER_CREATED = "order.created";
    static final String EVENT_TYPE_ORDER_CREATED = "ORDER_CREATED";

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    @Override
    public void publishOrderCreated(OrderCreatedEvent event) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize OrderCreatedEvent for orderId=" + event.getOrderId(), e);
        }

        OutboxEvent outboxEvent = OutboxEvent.builder()
                .aggregateId(String.valueOf(event.getOrderId()))
                .eventType(EVENT_TYPE_ORDER_CREATED)
                .topic(TOPIC_ORDER_CREATED)
                .payload(payload)
                .status(OutboxStatus.PENDING)
                .retryCount(0)
                .build();

        outboxEventRepository.save(outboxEvent);
        log.debug("Enqueued outbox event for orderId={}", event.getOrderId());
    }
}

