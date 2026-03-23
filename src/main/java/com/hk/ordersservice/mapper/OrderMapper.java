package com.hk.ordersservice.mapper;

import com.hk.ordersservice.dto.OrderResponse;
import com.hk.ordersservice.entity.Order;
import org.springframework.stereotype.Component;

@Component
public class OrderMapper {
    
    public OrderResponse toOrderResponse(Order order) {
        return OrderResponse.builder()
                .orderId(order.getId())
                .userId(order.getUser().getId())
                .totalAmount(order.getTotalAmount())
                .status(order.getStatus().toString())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
