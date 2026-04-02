package com.hk.ordersservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreateRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotEmpty(message = "Items cannot be empty")
    private List<OrderItemRequest> items;

    @NotNull(message = "Idempotency key is required")
    @Size(min = 8, max = 255, message = "Idempotency key must be between 8 and 255 characters")
    private String idempotencyKey;
}
