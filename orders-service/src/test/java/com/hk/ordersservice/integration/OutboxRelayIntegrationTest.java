package com.hk.ordersservice.integration;

import com.hk.common.dto.OrderCreatedEvent;
import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import com.hk.ordersservice.publisher.OutboxOrderEventPublisher;
import com.hk.ordersservice.publisher.OutboxRelay;
import com.hk.ordersservice.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}",
        "outbox.relay.enabled=true",
        "outbox.relay.poll-interval-ms=600000"
})
@EmbeddedKafka(partitions = 1, topics = { "order.created" })
@EnableKafka
@ActiveProfiles("test")
class OutboxRelayIntegrationTest {

    @Autowired
    private OutboxOrderEventPublisher outboxPublisher;

    @Autowired
    private OutboxRelay outboxRelay;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @BeforeEach
    void setUp() {
        outboxEventRepository.deleteAll();
    }

    @Test
    void enqueueThenPollAndPublish_MarksEventSentInDb() {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(777L)
                .userId(9L)
                .totalAmount(new BigDecimal("149.99"))
                .createdAt(LocalDateTime.of(2026, 11, 28, 15, 30))
                .build();

        outboxPublisher.publishOrderCreated(event);
        assertEquals(1, outboxEventRepository.countByStatus(OutboxStatus.PENDING));

        outboxRelay.pollAndPublish();

        List<OutboxEvent> all = outboxEventRepository.findAll();
        assertEquals(1, all.size());
        assertEquals(OutboxStatus.SENT, all.get(0).getStatus());
        assertNotNull(all.get(0).getSentAt());
        assertNull(all.get(0).getLockedAt());
        assertEquals(0, outboxEventRepository.countByStatus(OutboxStatus.PENDING));
    }
}

