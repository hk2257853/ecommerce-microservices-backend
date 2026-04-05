package com.hk.ordersservice.publisher;

import com.hk.ordersservice.dto.OrderCreatedEvent;

/**
 * Strategy interface for publishing order events.
 * Different implementations can use different message brokers like Kafka,
 * RabbitMQ, etc.
 */
public interface OrderEventPublisherIF {

    /**
     * Publishes an order created event.
     * 
     * @param event the order created event to publish
     */
    void publishOrderCreated(OrderCreatedEvent event);
}
