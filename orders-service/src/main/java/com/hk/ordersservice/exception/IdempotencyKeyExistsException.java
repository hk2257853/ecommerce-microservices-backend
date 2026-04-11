package com.hk.ordersservice.exception;

public class IdempotencyKeyExistsException extends RuntimeException {
    
    private final Long existingOrderId;
    
    public IdempotencyKeyExistsException(String idempotencyKey, Long existingOrderId) {
        super("Idempotency key '" + idempotencyKey + "' already exists with order ID: " + existingOrderId);
        this.existingOrderId = existingOrderId;
    }
    
    public Long getExistingOrderId() {
        return existingOrderId;
    }
}
