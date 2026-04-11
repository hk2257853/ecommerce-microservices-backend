package com.hk.ordersservice.factory;

import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.entity.Order;
import com.hk.ordersservice.entity.OrderItem;
import com.hk.ordersservice.entity.OrderStatus;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.exception.InsufficientStockException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class OrderFactory {

    public Order createOrder(User user, List<OrderItemRequest> itemRequests, List<Product> products) {
        List<OrderItem> orderItems = createOrderItems(itemRequests, products);
        BigDecimal totalAmount = calculateTotalAmount(orderItems);

        Order order = Order.builder()
                .user(user)
                .totalAmount(totalAmount)
                .status(OrderStatus.PENDING)
                .orderItems(orderItems)
                .build();

        // Set order reference in order items
        orderItems.forEach(item -> item.setOrder(order));

        return order;
    }

    private List<OrderItem> createOrderItems(List<OrderItemRequest> itemRequests, List<Product> products) {
        return itemRequests.stream()
                .map(itemRequest -> {
                    Product product = findProductById(products, itemRequest.getProductId());
                    return createOrderItem(product, itemRequest.getQuantity());
                })
                .collect(Collectors.toList());
    }

    private OrderItem createOrderItem(Product product, Integer quantity) {
        return OrderItem.builder()
                .product(product)
                .quantity(quantity)
                .unitPrice(product.getUnitPrice())
                .build();
    }

    private BigDecimal calculateTotalAmount(List<OrderItem> orderItems) {
        return orderItems.stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Product findProductById(List<Product> products, Long productId) {
        return products.stream()
                .filter(product -> product.getId().equals(productId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Product not found with ID: " + productId));
    }
}
