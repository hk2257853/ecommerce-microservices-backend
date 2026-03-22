package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemResponse;
import com.hk.ordersservice.dto.OrderResponse;
import com.hk.ordersservice.entity.*;
import com.hk.ordersservice.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class OrderService {
    
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final OrderItemRepository orderItemRepository;
    
    public OrderResponse createOrder(OrderCreateRequest request) {
        // Validate user exists
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + request.getUserId()));
        
        // Create order items and calculate total
        List<OrderItem> orderItems = request.getItems().stream()
                .map(itemRequest -> {
                    Product product = productRepository.findById(itemRequest.getProductId())
                            .orElseThrow(() -> new RuntimeException("Product not found with ID: " + itemRequest.getProductId()));
                    
                    return OrderItem.builder()
                            .product(product)
                            .quantity(itemRequest.getQuantity())
                            .unitPrice(product.getUnitPrice())
                            .build();
                })
                .collect(Collectors.toList());
        
        // Calculate total amount
        BigDecimal totalAmount = orderItems.stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        // Create order
        Order order = Order.builder()
                .user(user)
                .totalAmount(totalAmount)
                .status(OrderStatus.PENDING)
                .orderItems(orderItems)
                .build();
        
        // Set order reference in order items
        orderItems.forEach(item -> item.setOrder(order));
        
        // Save order and order items
        Order savedOrder = orderRepository.save(order);
        
        return OrderResponse.builder()
                .orderId(savedOrder.getId())
                .userId(savedOrder.getUser().getId())
                .totalAmount(savedOrder.getTotalAmount())
                .status(savedOrder.getStatus().toString())
                .createdAt(savedOrder.getCreatedAt())
                .build();
    }
    
    public List<OrderResponse> getOrdersByUserId(Long userId) {
        List<Order> orders = orderRepository.findByUserId(userId);
        return orders.stream()
                .map(order -> OrderResponse.builder()
                        .orderId(order.getId())
                        .userId(order.getUser().getId())
                        .totalAmount(order.getTotalAmount())
                        .status(order.getStatus().toString())
                        .createdAt(order.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }
    
    public List<OrderItemResponse> getOrderItemsByOrderId(Long orderId) {
        List<OrderItem> orderItems = orderItemRepository.findByOrderId(orderId);
        return orderItems.stream()
                .map(item -> OrderItemResponse.builder()
                        .productId(item.getProduct().getId())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .build())
                .collect(Collectors.toList());
    }
}
