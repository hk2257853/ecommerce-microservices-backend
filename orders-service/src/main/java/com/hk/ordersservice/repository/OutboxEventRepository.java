package com.hk.ordersservice.repository;

import com.hk.ordersservice.entity.OutboxEvent;
import com.hk.ordersservice.entity.OutboxStatus;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Data access for transactional outbox events with non-blocking row claims across workers.
 */
@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    // -2 maps to Hibernate LockOptions.SKIP_LOCKED so concurrent app nodes claim distinct rows.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("SELECT e FROM OutboxEvent e " +
           "WHERE e.status = com.hk.ordersservice.entity.OutboxStatus.PENDING " +
           "AND e.nextRetryAt <= :now " +
           "ORDER BY e.id ASC")
    List<OutboxEvent> findDuePendingEvents(@Param("now") LocalDateTime now, Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OutboxEvent e " +
           "SET e.status = com.hk.ordersservice.entity.OutboxStatus.SENT, " +
           "    e.sentAt = :sentAt, " +
           "    e.lockedAt = null, " +
           "    e.lastError = null " +
           "WHERE e.id IN :ids")
    int markSent(@Param("ids") List<Long> ids, @Param("sentAt") LocalDateTime sentAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OutboxEvent e " +
           "SET e.status = com.hk.ordersservice.entity.OutboxStatus.PENDING, " +
           "    e.lockedAt = null " +
           "WHERE e.id IN :ids")
    int releaseToPending(@Param("ids") List<Long> ids);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OutboxEvent e " +
           "SET e.status = com.hk.ordersservice.entity.OutboxStatus.PENDING, " +
           "    e.lockedAt = null, " +
           "    e.nextRetryAt = :now " +
           "WHERE e.status = com.hk.ordersservice.entity.OutboxStatus.PROCESSING " +
           "AND e.lockedAt < :staleBefore")
    int reclaimStaleProcessing(@Param("staleBefore") LocalDateTime staleBefore, @Param("now") LocalDateTime now);

    long countByStatus(OutboxStatus status);
}
