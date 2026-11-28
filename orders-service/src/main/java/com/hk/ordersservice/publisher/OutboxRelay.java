package com.hk.ordersservice.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hk.common.dto.OrderCreatedEvent;
import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import com.hk.ordersservice.repository.OutboxEventRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Periodically claims pending outbox events and relays them to Kafka,
 * short-circuiting the current tick on broker failure to avoid hammering Kafka.
 */
@Component
@ConditionalOnProperty(name = "outbox.relay.enabled", havingValue = "true", matchIfMissing = true)
@Slf4j
public class OutboxRelay {

    private static final int MAX_BATCHES_PER_TICK = 20;

    private final OutboxStore outboxStore;
    private final KafkaOrderEventPublisher kafkaPublisher;
    private final ObjectMapper objectMapper;
    private final int batchSize;
    private final int maxRetries;
    private final long maxBackoffSeconds;
    private final long staleLockSeconds;
    private final Counter publishedCounter;
    private final Counter failedCounter;

    public OutboxRelay(
            OutboxStore outboxStore,
            KafkaOrderEventPublisher kafkaPublisher,
            ObjectMapper objectMapper,
            OutboxEventRepository outboxEventRepository,
            MeterRegistry meterRegistry,
            @Value("${outbox.relay.batch-size:50}") int batchSize,
            @Value("${outbox.relay.max-retries:50}") int maxRetries,
            @Value("${outbox.relay.max-backoff-seconds:30}") long maxBackoffSeconds,
            @Value("${outbox.relay.stale-lock-seconds:60}") long staleLockSeconds) {
        this.outboxStore = outboxStore;
        this.kafkaPublisher = kafkaPublisher;
        this.objectMapper = objectMapper;
        this.batchSize = batchSize;
        this.maxRetries = maxRetries;
        this.maxBackoffSeconds = maxBackoffSeconds;
        this.staleLockSeconds = staleLockSeconds;

        this.publishedCounter = Counter.builder("outbox.events.published")
                .description("Total outbox events published to Kafka")
                .register(meterRegistry);
        this.failedCounter = Counter.builder("outbox.events.failed")
                .description("Total failed outbox event publish attempts")
                .register(meterRegistry);
        Gauge.builder("outbox.events.pending", outboxEventRepository,
                        repo -> repo.countByStatus(OutboxStatus.PENDING))
                .description("Current number of pending outbox events waiting for Kafka")
                .register(meterRegistry);
    }

    @Scheduled(fixedDelayString = "${outbox.relay.poll-interval-ms:1000}")
    public void pollAndPublish() {
        for (int batchNum = 0; batchNum < MAX_BATCHES_PER_TICK; batchNum++) {
            List<OutboxEvent> batch = outboxStore.claimPendingBatch(batchSize, staleLockSeconds);
            if (batch.isEmpty()) {
                return;
            }
            boolean allSucceeded = processBatch(batch);
            if (!allSucceeded || batch.size() < batchSize) {
                return;
            }
        }
    }

    boolean processBatch(List<OutboxEvent> batch) {
        List<Long> sentIds = new ArrayList<>(batch.size());
        for (int i = 0; i < batch.size(); i++) {
            OutboxEvent row = batch.get(i);
            try {
                OrderCreatedEvent event = objectMapper.readValue(row.getPayload(), OrderCreatedEvent.class);
                kafkaPublisher.publishOrderCreated(event);
                sentIds.add(row.getId());
                publishedCounter.increment();
            } catch (Exception ex) {
                failedCounter.increment();
                log.warn("Outbox publish failed for id={} aggregateId={} (attempt {}): {}",
                        row.getId(), row.getAggregateId(), row.getRetryCount() + 1, ex.getMessage());

                outboxStore.markSent(sentIds);
                List<Long> untriedIds = batch.subList(i + 1, batch.size()).stream()
                        .map(OutboxEvent::getId)
                        .toList();
                outboxStore.markFailureAndReleaseUntried(row, ex, maxRetries, maxBackoffSeconds, untriedIds);
                return false;
            }
        }
        outboxStore.markSent(sentIds);
        return true;
    }
}

