package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.dto.OrderItemResponse;
import com.hk.ordersservice.dto.OrderResponse;
import com.hk.ordersservice.entity.*;
import com.hk.ordersservice.exception.IdempotencyKeyExistsException;
import com.hk.ordersservice.exception.InsufficientStockException;
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
        private final IdempotencyService idempotencyService;

        public OrderResponse createOrder(OrderCreateRequest request) {
                // Check idempotency first - if result already exists, return it
                OrderResponse existingOrderResponse = idempotencyService.get("orders", "create",
                                request.getIdempotencyKey(), OrderResponse.class);
                if (existingOrderResponse != null) {
                        return existingOrderResponse;
                }

                boolean lockAcquired = idempotencyService.tryStart("orders", "create", request.getIdempotencyKey());

                // Incase i don't get a lock Ideally would just throw
                // IdempotencyKeyExistsException, but there's an edge case where the other
                // thread has already processed the request (as we have a 5min TTL on the
                // PROCESSING state n try start returns null for it). That thread's response
                // goes back to
                // its own caller, not ours (latest caller).
                if (!lockAcquired) {
                        OrderResponse concurrentResponse = idempotencyService.get("orders", "create",
                                        request.getIdempotencyKey(), OrderResponse.class);
                        if (concurrentResponse != null) {
                                return concurrentResponse;
                        }
                        throw new IdempotencyKeyExistsException(request.getIdempotencyKey(), null);
                }

                try {
                        User user = userRepository.findById(request.getUserId())
                                        .orElseThrow(() -> new ResourceNotFoundException("User", "id",
                                                        request.getUserId()));

                        List<Long> productIds = request.getItems().stream()
                                        .map(OrderItemRequest::getProductId)
                                        .collect(Collectors.toList());

                        List<Product> products = productRepository.findAllById(productIds);

                        if (products.size() != request.getItems().size()) {
                                throw new ResourceNotFoundException("One or more products not found");
                        }

                        // Validate all preconditions (sufficient stock, valid products, etc.) here -
                        // factory assumes clean, trusted input
                        request.getItems().forEach(itemRequest -> {
                                Product product = findProductById(products, itemRequest.getProductId());
                                if (product.getQuantity() < itemRequest.getQuantity()) {
                                        throw new InsufficientStockException(
                                                        product.getId(),
                                                        product.getName(),
                                                        itemRequest.getQuantity(),
                                                        product.getQuantity());
                                }
                        });

                        Order order = orderFactory.createOrder(user, request.getItems(), products);
                        Order savedOrder = orderRepository.save(order);
                        decrementStock(request.getItems(), products);

                        OrderResponse orderResponse = orderMapper.toOrderResponse(savedOrder);

                        // Store idempotency mapping with full OrderResponse
                        idempotencyService.save("orders", "create", request.getIdempotencyKey(), orderResponse);

                        return orderResponse;
                } catch (Exception e) {
                        // Clean up the PROCESSING lock on failure
                        idempotencyService.clear("orders", "create", request.getIdempotencyKey());
                        throw e;
                }
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

        private void decrementStock(List<OrderItemRequest> items, List<Product> products) {
                items.forEach(itemRequest -> {
                        Product product = findProductById(products, itemRequest.getProductId());
                        product.setQuantity(product.getQuantity() - itemRequest.getQuantity());
                        productRepository.save(product);
                });
        }

        private Product findProductById(List<Product> products, Long productId) {
                return products.stream()
                                .filter(product -> product.getId().equals(productId))
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("Product not found with ID: " + productId));
        }
}
