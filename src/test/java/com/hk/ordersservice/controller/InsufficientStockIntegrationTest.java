package com.hk.ordersservice.controller;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.repository.OrderRepository;
import com.hk.ordersservice.repository.ProductRepository;
import com.hk.ordersservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebMvc
@ActiveProfiles("test")
class InsufficientStockIntegrationTest {

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

        private User testUser;
        private Product lowStockProduct;

        @BeforeEach
        void setUp() {
                // Clean up database in correct order to respect foreign key constraints
                orderRepository.deleteAll(); // First: Delete order items (via cascade)
                productRepository.deleteAll(); // Second: Delete products
                userRepository.deleteAll(); // Third: Delete users

                // Create test user
                testUser = User.builder()
                                .name("Test User")
                                .email("test-insufficient@example.com") // Unique email
                                .address("123 Test St")
                                .build();
                testUser = userRepository.save(testUser);

                // Create product with low stock
                lowStockProduct = Product.builder()
                                .name("Low Stock Product")
                                .unitPrice(new BigDecimal("25.00"))
                                .quantity(2) // Only 2 items available
                                .build();
                lowStockProduct = productRepository.save(lowStockProduct);
        }

        @Test
        void testCreateOrderWithInsufficientStock() {
                // Create order request with quantity exceeding available stock
                OrderCreateRequest orderRequest = OrderCreateRequest.builder()
                                .userId(testUser.getId())
                                .items(List.of(
                                                OrderItemRequest.builder()
                                                                .productId(lowStockProduct.getId())
                                                                .quantity(5) // Requesting 5, but only 2 available
                                                                .build()))
                                .build();

                // Make HTTP request
                String url = "http://localhost:" + port + "/api/orders";
                ResponseEntity<String> response = restTemplate.postForEntity(url, orderRequest, String.class);

                // Assert HTTP response - should return 400 Bad Request
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(response.getBody()).isNotNull();
                assertThat(response.getBody()).contains("Insufficient stock");
                assertThat(response.getBody()).contains("Low Stock Product");
                assertThat(response.getBody()).contains("Requested: 5");
                assertThat(response.getBody()).contains("Available: 2");

                // Verify no order was created and stock was not decremented
                Product unchangedProduct = productRepository.findById(lowStockProduct.getId()).orElseThrow();
                assertThat(unchangedProduct.getQuantity()).isEqualTo(2); // Should still be 2
        }

        @Test
        void testCreateOrderWithExactStock() {
                // Create order request with quantity exactly matching available stock
                OrderCreateRequest orderRequest = OrderCreateRequest.builder()
                                .userId(testUser.getId())
                                .items(List.of(
                                                OrderItemRequest.builder()
                                                                .productId(lowStockProduct.getId())
                                                                .quantity(2) // Requesting exactly 2, which is available
                                                                .build()))
                                .build();

                // Make HTTP request
                String url = "http://localhost:" + port + "/api/orders";
                ResponseEntity<String> response = restTemplate.postForEntity(url, orderRequest, String.class);

                // Assert HTTP response - should succeed
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

                // Verify stock was decremented to 0
                Product updatedProduct = productRepository.findById(lowStockProduct.getId()).orElseThrow();
                assertThat(updatedProduct.getQuantity()).isEqualTo(0);
        }

        @Test
        void testCreateOrderWithMultipleItemsOneInsufficient() {
                // Create another product with sufficient stock
                Product sufficientProduct = Product.builder()
                                .name("Sufficient Stock Product")
                                .unitPrice(new BigDecimal("15.00"))
                                .quantity(10)
                                .build();
                sufficientProduct = productRepository.save(sufficientProduct);

                // Create order request with one sufficient and one insufficient item
                OrderCreateRequest orderRequest = OrderCreateRequest.builder()
                                .userId(testUser.getId())
                                .items(List.of(
                                                OrderItemRequest.builder()
                                                                .productId(sufficientProduct.getId())
                                                                .quantity(3) // This should be fine
                                                                .build(),
                                                OrderItemRequest.builder()
                                                                .productId(lowStockProduct.getId())
                                                                .quantity(5) // This should fail
                                                                .build()))
                                .build();

                // Make HTTP request
                String url = "http://localhost:" + port + "/api/orders";
                ResponseEntity<String> response = restTemplate.postForEntity(url, orderRequest, String.class);

                // Assert HTTP response - should fail due to insufficient stock
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(response.getBody()).contains("Insufficient stock");

                // Verify no stock was decremented for either product
                Product unchangedLowStock = productRepository.findById(lowStockProduct.getId()).orElseThrow();
                Product unchangedSufficient = productRepository.findById(sufficientProduct.getId()).orElseThrow();
                assertThat(unchangedLowStock.getQuantity()).isEqualTo(2);
                assertThat(unchangedSufficient.getQuantity()).isEqualTo(10);
        }
}
