package com.hk.ordersservice.controller;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.entity.Order;
import com.hk.ordersservice.entity.OrderItem;
import com.hk.ordersservice.entity.OrderStatus;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.repository.OrderItemRepository;
import com.hk.ordersservice.repository.OrderRepository;
import com.hk.ordersservice.repository.ProductRepository;
import com.hk.ordersservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// This is an integration test for an order creation API endpoint
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)

class OrderControllerIntegrationTest {

        @LocalServerPort
        private int port;

        @Autowired
        private TestRestTemplate restTemplate;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private ProductRepository productRepository;

        @Autowired
        private OrderRepository orderRepository;

        @Autowired
        private OrderItemRepository orderItemRepository;

        private User testUser;
        private Product testProduct1;
        private Product testProduct2;
        private OrderCreateRequest orderRequest;

        @BeforeEach
        void setUp() {
                // Clean up first - as the database is shared across tests, we need to clear it
                // before each test other wise the data will interfere with other tests
                orderItemRepository.deleteAll();
                orderRepository.deleteAll();
                productRepository.deleteAll();
                userRepository.deleteAll();

                // Create test user
                testUser = User.builder()
                                .name("Test User")
                                .email("test@example.com")
                                .address("123 Test St")
                                .build();
                testUser = userRepository.save(testUser);

                // Create test products
                testProduct1 = Product.builder()
                                .name("Product 1")
                                .unitPrice(new BigDecimal("50.00"))
                                .quantity(10)
                                .build();
                testProduct1 = productRepository.save(testProduct1);

                testProduct2 = Product.builder()
                                .name("Product 2")
                                .unitPrice(new BigDecimal("75.00"))
                                .quantity(5)
                                .build();
                testProduct2 = productRepository.save(testProduct2);

                // Build order request
                orderRequest = OrderCreateRequest.builder()
                                .userId(testUser.getId())
                                .idempotencyKey(UUID.randomUUID().toString())
                                .items(List.of(
                                                OrderItemRequest.builder()
                                                                .productId(testProduct1.getId())
                                                                .quantity(2)
                                                                .build(),
                                                OrderItemRequest.builder()
                                                                .productId(testProduct2.getId())
                                                                .quantity(1)
                                                                .build()))
                                .build();
        }

        @Test
        void testCreateOrderHappyPath() {
                // Calculate expected total amount
                BigDecimal expectedTotalAmount = testProduct1.getUnitPrice().multiply(BigDecimal.valueOf(2))
                                .add(testProduct2.getUnitPrice().multiply(BigDecimal.valueOf(1)));

                // Make HTTP request
                String url = "http://localhost:" + port + "/api/orders";
                ResponseEntity<com.hk.ordersservice.dto.OrderResponse> response = restTemplate.postForEntity(
                                url, orderRequest, com.hk.ordersservice.dto.OrderResponse.class);

                // Assert HTTP response
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
                assertThat(response.getBody()).isNotNull();
                com.hk.ordersservice.dto.OrderResponse responseBody = response.getBody();
                assertThat(responseBody.getOrderId()).isNotNull();
                assertThat(responseBody.getUserId()).isEqualTo(testUser.getId());
                assertThat(responseBody.getTotalAmount()).isEqualTo(expectedTotalAmount);
                assertThat(responseBody.getStatus()).isEqualTo("PENDING");
                assertThat(responseBody.getCreatedAt()).isNotNull();

                Long savedOrderId = responseBody.getOrderId();

                // Verify order was saved in database
                List<Order> savedOrders = orderRepository.findByUserId(testUser.getId());
                assertThat(savedOrders).hasSize(1);

                Order savedOrder = savedOrders.get(0);
                assertThat(savedOrder.getId()).isEqualTo(savedOrderId);
                assertThat(savedOrder.getUser().getId()).isEqualTo(testUser.getId());
                assertThat(savedOrder.getTotalAmount()).isEqualTo(expectedTotalAmount);
                assertThat(savedOrder.getStatus()).isEqualTo(OrderStatus.PENDING);
                assertThat(savedOrder.getCreatedAt()).isNotNull();

                // Verify order items were saved in database
                List<OrderItem> savedOrderItems = orderItemRepository.findByOrderId(savedOrderId);
                assertThat(savedOrderItems).hasSize(2);

                // Verify first order item
                OrderItem savedOrderItem1 = savedOrderItems.stream()
                                .filter(item -> item.getProduct().getId().equals(testProduct1.getId()))
                                .findFirst()
                                .orElseThrow();
                assertThat(savedOrderItem1.getProduct().getId()).isEqualTo(testProduct1.getId());
                assertThat(savedOrderItem1.getQuantity()).isEqualTo(2);
                assertThat(savedOrderItem1.getUnitPrice()).isEqualTo(testProduct1.getUnitPrice());

                // Verify second order item
                OrderItem savedOrderItem2 = savedOrderItems.stream()
                                .filter(item -> item.getProduct().getId().equals(testProduct2.getId()))
                                .findFirst()
                                .orElseThrow();
                assertThat(savedOrderItem2.getProduct().getId()).isEqualTo(testProduct2.getId());
                assertThat(savedOrderItem2.getQuantity()).isEqualTo(1);
                assertThat(savedOrderItem2.getUnitPrice()).isEqualTo(testProduct2.getUnitPrice());

                // Verify stock was decremented
                Product updatedProduct1 = productRepository.findById(testProduct1.getId()).orElseThrow();
                Product updatedProduct2 = productRepository.findById(testProduct2.getId()).orElseThrow();
                assertThat(updatedProduct1.getQuantity()).isEqualTo(8); // 10 - 2 = 8
                assertThat(updatedProduct2.getQuantity()).isEqualTo(4); // 5 - 1 = 4
        }
}
