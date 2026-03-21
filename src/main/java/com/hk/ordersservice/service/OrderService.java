package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderResponse;
import com.hk.ordersservice.entity.Order;
import com.hk.ordersservice.entity.OrderStatus;
import com.hk.ordersservice.repository.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@Transactional
public class OrderService {
    
    @Autowired
    private OrderRepository orderRepository;
    
    private final Random random = new Random();
    
    public OrderResponse createOrder(OrderCreateRequest request) {
        // Calculate total price
        BigDecimal totalPrice = request.getUnitPrice().multiply(BigDecimal.valueOf(request.getQuantity()));
        
        // Create order entity
        Order order = new Order();
        order.setOrderNumber(generateOrderNumber());
        order.setCustomerName(request.getCustomerName());
        order.setCustomerEmail(request.getCustomerEmail());
        order.setProductName(request.getProductName());
        order.setQuantity(request.getQuantity());
        order.setUnitPrice(request.getUnitPrice());
        order.setTotalPrice(totalPrice);
        order.setStatus(OrderStatus.PENDING);
        order.setShippingAddress(request.getShippingAddress());
        
        // Save order
        Order savedOrder = orderRepository.save(order);
        
        // Convert to response DTO
        return convertToResponse(savedOrder);
    }
    
    public OrderResponse getOrderByOrderNumber(String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new RuntimeException("Order not found with order number: " + orderNumber));
        return convertToResponse(order);
    }
    
    public List<OrderResponse> getOrdersByCustomerEmail(String customerEmail) {
        List<Order> orders = orderRepository.findByCustomerEmail(customerEmail);
        return orders.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    public List<OrderResponse> getOrdersByStatus(OrderStatus status) {
        List<Order> orders = orderRepository.findByStatus(status);
        return orders.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    private String generateOrderNumber() {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd");
        String datePart = LocalDateTime.now().format(formatter);
        int randomPart = 100000 + random.nextInt(900000);
        return "ORD-" + datePart + "-" + randomPart;
    }
    
    private OrderResponse convertToResponse(Order order) {
        return new OrderResponse( // This is converting the entity to a response DTO
                order.getId(),
                order.getOrderNumber(),
                order.getCustomerName(),
                order.getCustomerEmail(),
                order.getProductName(),
                order.getQuantity(),
                order.getUnitPrice(),
                order.getTotalPrice(),
                order.getStatus().toString(),
                order.getShippingAddress(),
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }
}
