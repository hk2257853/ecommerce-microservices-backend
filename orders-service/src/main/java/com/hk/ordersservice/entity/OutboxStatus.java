package com.hk.ordersservice.entity;

/**
 * Lifecycle states for a transactional outbox row.
 */
public enum OutboxStatus {
    PENDING,
    PROCESSING,
    SENT,
    FAILED
}

