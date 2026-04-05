package com.hk.ordersservice.consumer;

import com.hk.ordersservice.dto.OrderCreatedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class NotificationConsumer {

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
}
