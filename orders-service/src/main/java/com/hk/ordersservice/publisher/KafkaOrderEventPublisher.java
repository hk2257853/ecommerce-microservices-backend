package com.hk.ordersservice.publisher;

import com.hk.common.dto.OrderCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaOrderEventPublisher implements OrderEventPublisherIF {

    private final KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;
    private static final String TOPIC = "order.created";

    @Override
    public void publishOrderCreated(OrderCreatedEvent event) {
        try {
            log.info("Publishing order created event for orderId: {}", event.getOrderId());
            kafkaTemplate.send(TOPIC, event);
            log.info("Successfully published order created event for orderId: {}", event.getOrderId());
        } catch (Exception e) {
            log.error("Failed to publish order created event for orderId: {}", event.getOrderId(), e);
            throw e;
        }
    }
}
