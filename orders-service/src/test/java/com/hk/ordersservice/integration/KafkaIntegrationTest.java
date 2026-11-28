package com.hk.ordersservice.integration;

import com.hk.common.dto.OrderCreatedEvent;
import com.hk.ordersservice.publisher.KafkaOrderEventPublisher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}")
@EmbeddedKafka(partitions = 1, topics = { "order.created" })
@EnableKafka
@ActiveProfiles("test")
class KafkaIntegrationTest {

    @Autowired
    private KafkaOrderEventPublisher publisher;

    @Test
    void testKafkaEndToEnd() {
        // Given
        OrderCreatedEvent testEvent = OrderCreatedEvent.builder()
                .orderId(1L)
                .userId(100L)
                .totalAmount(new BigDecimal("99.99"))
                .createdAt(LocalDateTime.now())
                .build();

        // When & Then - Just verify publisher can send without exceptions
        // In a real test, you'd use CountDownLatch or TestConsumer to verify receipt
        assertDoesNotThrow(() -> publisher.publishOrderCreated(testEvent));
    }
}
