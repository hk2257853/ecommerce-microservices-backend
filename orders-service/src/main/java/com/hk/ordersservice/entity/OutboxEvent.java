package com.hk.ordersservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Persisted domain event stored atomically alongside order writes before relay to Kafka.
 */
@Entity
@Table(name = "outbox_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String aggregateId;

    @Column(nullable = false, length = 100)
    private String eventType;

    @Column(nullable = false, length = 100)
    private String topic;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OutboxStatus status;

    @Column(nullable = false)
    private int retryCount;

    @Column(length = 500)
    private String lastError;

    @Column(nullable = false)
    private LocalDateTime nextRetryAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime lockedAt;

    @Column
    private LocalDateTime sentAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (nextRetryAt == null) {
            nextRetryAt = now;
        }
        if (status == null) {
            status = OutboxStatus.PENDING;
        }
    }
}

