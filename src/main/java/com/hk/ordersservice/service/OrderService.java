package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.dto.OrderItemResponse;
import com.hk.ordersservice.dto.OrderResponse;
import com.hk.ordersservice.entity.*;
import com.hk.ordersservice.exception.ResourceNotFoundException;
import com.hk.ordersservice.factory.OrderFactory;
import com.hk.ordersservice.mapper.OrderMapper;
import com.hk.ordersservice.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final OrderFactory orderFactory;
    private final OrderMapper orderMapper;
    
    public OrderResponse createOrder(OrderCreateRequest request) {
        // Validate user exists
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));
        
        // Fetch all products for the order items
        List<Long> productIds = request.getItems().stream()
                .map(OrderItemRequest::getProductId) // this is method reference. lambda - item -> item.getProductId() ie for each item get the productId
                .collect(Collectors.toList());
                
        List<Product> products = productRepository.findAllById(productIds);
        
        // Add this
        if (products.size() != request.getItems().size()) {
        throw new ResourceNotFoundException("One or more products not found");
        }

        
        // Create order using factory
        Order order = orderFactory.createOrder(user, request.getItems(), products);
        
        // Save order and order items
        Order savedOrder = orderRepository.save(order);
        
        return orderMapper.toOrderResponse(savedOrder);
    }
    
    public List<OrderResponse> getOrdersByUserId(Long userId) {
        List<Order> orders = orderRepository.findByUserId(userId);
        return orders.stream()
                .map(orderMapper::toOrderResponse)
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
