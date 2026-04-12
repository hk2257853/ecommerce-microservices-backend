package com.hk.notification_service.consumer;

import com.hk.common.dto.OrderCreatedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class NotificationConsumer {

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2), dltTopicSuffix = ".DLT")
    @KafkaListener(topics = "order.created", groupId = "notification-group")
    public void handleOrderCreatedEvent(OrderCreatedEvent event) {
        log.info("Received order created event: orderId={}, userId={}, totalAmount={}, createdAt={}",
                event.getOrderId(),
                event.getUserId(),
                event.getTotalAmount(),
                event.getCreatedAt());

        // Simulate notification processing
        log.info("Processing notification for order: {}", event.getOrderId());

        // Here you would typically send email, SMS, push notification, etc.
        // For now, we just log to simulate the notification
    }

    @DltHandler
    public void handleDlt(OrderCreatedEvent event) {
        log.error("Message failed all retries, sent to DLT: orderId={}", event.getOrderId());
        // In production: send to db or another group in kafka or just send alert
    }
}
