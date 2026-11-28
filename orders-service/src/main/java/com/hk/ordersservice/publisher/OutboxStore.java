package com.hk.ordersservice.publisher;

import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import com.hk.ordersservice.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Encapsulates short database transactions for claiming and updating outbox rows
 * so HikariCP connections are never held across Kafka network I/O.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxStore {

    private static final int MAX_ERROR_LENGTH = 500;

    private final OutboxEventRepository outboxEventRepository;

    @Transactional
    public List<OutboxEvent> claimPendingBatch(int batchSize, long staleLockSeconds) {
        LocalDateTime now = LocalDateTime.now();
        int reclaimed = outboxEventRepository.reclaimStaleProcessing(now.minusSeconds(staleLockSeconds), now);
        if (reclaimed > 0) {
            log.warn("Reclaimed {} stale PROCESSING outbox rows back to PENDING", reclaimed);
        }

        List<OutboxEvent> dueEvents = outboxEventRepository.findDuePendingEvents(now, PageRequest.of(0, batchSize));
        if (dueEvents.isEmpty()) {
            return List.of();
        }

        for (OutboxEvent event : dueEvents) {
            event.setStatus(OutboxStatus.PROCESSING);
            event.setLockedAt(now);
        }
        return outboxEventRepository.saveAll(dueEvents);
    }

    @Transactional
    public void markSent(List<Long> sentIds) {
        if (sentIds == null || sentIds.isEmpty()) {
            return;
        }
        outboxEventRepository.markSent(sentIds, LocalDateTime.now());
    }

    @Transactional
    public void markFailureAndReleaseUntried(
            OutboxEvent failedEvent,
            Throwable error,
            int maxRetries,
            long maxBackoffSeconds,
            List<Long> untriedIds) {
        LocalDateTime now = LocalDateTime.now();
        int nextRetry = failedEvent.getRetryCount() + 1;
        failedEvent.setRetryCount(nextRetry);
        failedEvent.setLockedAt(null);
        failedEvent.setLastError(truncateError(error));

        if (nextRetry >= maxRetries) {
            failedEvent.setStatus(OutboxStatus.FAILED);
            log.error("Outbox event id={} aggregateId={} reached maxRetries={} and moved to FAILED",
                    failedEvent.getId(), failedEvent.getAggregateId(), maxRetries);
        } else {
            long delaySeconds = computeBackoffSeconds(nextRetry, maxBackoffSeconds);
            failedEvent.setStatus(OutboxStatus.PENDING);
            failedEvent.setNextRetryAt(now.plusSeconds(delaySeconds));
        }

        outboxEventRepository.save(failedEvent);
        if (untriedIds != null && !untriedIds.isEmpty()) {
            outboxEventRepository.releaseToPending(untriedIds);
        }
    }

    private long computeBackoffSeconds(int attempt, long maxBackoffSeconds) {
        long exponential = 1L << Math.min(attempt - 1, 10);
        return Math.min(maxBackoffSeconds, exponential);
    }

    private String truncateError(Throwable error) {
        if (error == null) {
            return null;
        }
        Throwable root = error.getCause() != null ? error.getCause() : error;
        String message = root.getMessage() != null ? root.getMessage() : root.getClass().getSimpleName();
        if (message.length() <= MAX_ERROR_LENGTH) {
            return message;
        }
        return message.substring(0, MAX_ERROR_LENGTH);
    }
}

