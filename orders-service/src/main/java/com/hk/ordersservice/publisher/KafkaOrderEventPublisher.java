package com.hk.ordersservice.publisher;

import com.hk.common.dto.OrderCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * Publishes order events synchronously to Kafka and awaits broker acknowledgement
 * so callers (such as OutboxRelay) only mark events sent after durable broker ack.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaOrderEventPublisher implements OrderEventPublisherIF {

    private static final String TOPIC = "order.created";
    private static final long SEND_TIMEOUT_MS = 2500L;

    private final KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;

    @Override
    public void publishOrderCreated(OrderCreatedEvent event) {
        String key = String.valueOf(event.getOrderId());
        try {
            log.debug("Publishing order created event for orderId: {}", event.getOrderId());
            kafkaTemplate.send(TOPIC, key, event).get(SEND_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            log.debug("Successfully published order created event for orderId: {}", event.getOrderId());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Interrupted while publishing order created event for orderId: {}", event.getOrderId(), e);
            throw new IllegalStateException("Interrupted while publishing order created event", e);
        } catch (RuntimeException e) {
            log.error("Failed to publish order created event for orderId: {}", event.getOrderId(), e);
            throw e;
        } catch (Exception e) {
            log.error("Failed to publish order created event for orderId: {}", event.getOrderId(), e);
            throw new IllegalStateException("Failed to publish order created event for orderId=" + event.getOrderId(), e);
        }
    }
}
