package com.hk.ordersservice.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InsufficientStockException extends RuntimeException {
    
    public InsufficientStockException(String message) {
        super(message);
    }
    
    public InsufficientStockException(Long productId, String productName, Integer requestedQuantity, Integer availableQuantity) {
        super(String.format("Insufficient stock for product '%s' (ID: %d). Requested: %d, Available: %d", 
                productName, productId, requestedQuantity, availableQuantity));
    }
}
