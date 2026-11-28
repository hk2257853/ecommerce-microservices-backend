package com.hk.ordersservice.publisher;

import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import com.hk.ordersservice.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxStoreTest {

    @Mock
    private OutboxEventRepository repository;

    private OutboxStore outboxStore;

    @BeforeEach
    void setUp() {
        outboxStore = new OutboxStore(repository);
    }

    @Test
    void claimPendingBatch_ReclaimsStaleAndMarksProcessing() {
        OutboxEvent row = OutboxEvent.builder()
                .id(1L)
                .aggregateId("10")
                .status(OutboxStatus.PENDING)
                .build();

        when(repository.findDuePendingEvents(any(LocalDateTime.class), eq(PageRequest.of(0, 50))))
                .thenReturn(List.of(row));
        when(repository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<OutboxEvent> claimed = outboxStore.claimPendingBatch(50, 60);

        assertEquals(1, claimed.size());
        assertEquals(OutboxStatus.PROCESSING, claimed.get(0).getStatus());
        assertNotNull(claimed.get(0).getLockedAt());
        verify(repository).reclaimStaleProcessing(any(LocalDateTime.class), any(LocalDateTime.class));
        verify(repository).saveAll(List.of(row));
    }

    @Test
    void markFailureAndReleaseUntried_ReschedulesWithBackoffAndReleasesRest() {
        LocalDateTime before = LocalDateTime.now();
        OutboxEvent failed = OutboxEvent.builder()
                .id(1L)
                .aggregateId("10")
                .status(OutboxStatus.PROCESSING)
                .retryCount(2)
                .lockedAt(before)
                .build();

        outboxStore.markFailureAndReleaseUntried(
                failed,
                new RuntimeException("Kafka broker down"),
                50,
                30,
                List.of(2L, 3L));

        assertEquals(OutboxStatus.PENDING, failed.getStatus());
        assertEquals(3, failed.getRetryCount());
        assertNull(failed.getLockedAt());
        assertEquals("Kafka broker down", failed.getLastError());
        // retry 3 => 2^(3-1) = 4s backoff
        assertTrue(failed.getNextRetryAt().isAfter(before.plusSeconds(3)));

        verify(repository).save(failed);
        verify(repository).releaseToPending(List.of(2L, 3L));
    }

    @Test
    void markFailureAndReleaseUntried_MovesToFailedAtMaxRetriesAndTruncatesError() {
        OutboxEvent failed = OutboxEvent.builder()
                .id(5L)
                .aggregateId("55")
                .status(OutboxStatus.PROCESSING)
                .retryCount(4)
                .build();

        String longMessage = "x".repeat(700);
        outboxStore.markFailureAndReleaseUntried(
                failed,
                new IllegalStateException("outer", new RuntimeException(longMessage)),
                5,
                30,
                List.of());

        assertEquals(OutboxStatus.FAILED, failed.getStatus());
        assertEquals(5, failed.getRetryCount());
        assertEquals(500, failed.getLastError().length());
        verify(repository).save(failed);
        verify(repository, never()).releaseToPending(any());
    }
}

