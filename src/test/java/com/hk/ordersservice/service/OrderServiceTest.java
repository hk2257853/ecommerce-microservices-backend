package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.OrderCreateRequest;
import com.hk.ordersservice.dto.OrderItemRequest;
import com.hk.ordersservice.dto.OrderResponse;
import com.hk.ordersservice.entity.*;
import com.hk.ordersservice.exception.ResourceNotFoundException;
import com.hk.ordersservice.factory.OrderFactory;
import com.hk.ordersservice.mapper.OrderMapper;
import com.hk.ordersservice.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private OrderFactory orderFactory;

    @Mock
    private OrderMapper orderMapper;

    @InjectMocks
    private OrderService orderService;

    private User testUser;
    private Product testProduct1;
    private Product testProduct2;
    private OrderCreateRequest orderRequest;
    private Order testOrder;
    private OrderResponse orderResponse;

    @BeforeEach
    void setUp() {
        // Create test user
        testUser = User.builder()
                .id(1L)
                .name("Test User")
                .email("test@example.com")
                .address("123 Test St")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // Create test products
        testProduct1 = Product.builder()
                .id(1L)
                .name("Product 1")
                .unitPrice(new BigDecimal("50.00"))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        testProduct2 = Product.builder()
                .id(2L)
                .name("Product 2")
                .unitPrice(new BigDecimal("75.00"))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // Create order request
        orderRequest = OrderCreateRequest.builder()
                .userId(1L)
                .items(Arrays.asList(
                        OrderItemRequest.builder()
                                .productId(1L)
                                .quantity(2)
                                .build(),
                        OrderItemRequest.builder()
                                .productId(2L)
                                .quantity(1)
                                .build()
                ))
                .build();

        // Create test order
        testOrder = Order.builder()
                .id(1L)
                .user(testUser)
                .totalAmount(new BigDecimal("175.00"))
                .status(OrderStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // Create order response
        orderResponse = OrderResponse.builder()
                .orderId(1L)
                .userId(1L)
                .totalAmount(new BigDecimal("175.00"))
                .status(OrderStatus.PENDING.name())
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void testCreateOrderSuccess() {
        // Arrange - if this method gets called with this input, return this output
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(productRepository.findAllById(Arrays.asList(1L, 2L)))
                .thenReturn(Arrays.asList(testProduct1, testProduct2));
        when(orderFactory.createOrder(eq(testUser), any(), any()))
                .thenReturn(testOrder);
        when(orderRepository.save(testOrder)).thenReturn(testOrder);
        when(orderMapper.toOrderResponse(testOrder)).thenReturn(orderResponse);

        // Act - Call the actual service method with real input.
        OrderResponse result = orderService.createOrder(orderRequest);

        // Assert - Did the method return what you expected?
        assertNotNull(result);
        assertEquals(orderResponse.getOrderId(), result.getOrderId());
        assertEquals(orderResponse.getUserId(), result.getUserId());
        assertEquals(orderResponse.getTotalAmount(), result.getTotalAmount());
        assertEquals(orderResponse.getStatus(), result.getStatus());
        
        
        /*
         Say someone accidentally deletes orderRepository.save(order) from the service.
         The method still returns a response — because orderMapper.toOrderResponse(testOrder) is mocked to return orderResponse regardless.
         So your assert passes — result looks correct, all fields match.
         But verify(orderRepository).save(testOrder) fails — because save was never actually called.
        */
        // Verify interactions - checking the journey.
        verify(userRepository).findById(1L);
        verify(productRepository).findAllById(Arrays.asList(1L, 2L));
        verify(orderFactory).createOrder(eq(testUser), any(), any());
        verify(orderRepository).save(testOrder);
        verify(orderMapper).toOrderResponse(testOrder);
    }

    @Test
    void testCreateOrderUserNotFound() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        // Act & Assert
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.createOrder(orderRequest)
        );

        assertTrue(exception.getMessage().contains("User"));
        assertTrue(exception.getMessage().contains("id"));
        assertTrue(exception.getMessage().contains("1"));

        // Verify interactions
        verify(userRepository).findById(1L);
        verify(productRepository, never()).findAllById(any());
        verify(orderFactory, never()).createOrder(any(), any(), any());
        verify(orderRepository, never()).save(any());
        verify(orderMapper, never()).toOrderResponse(any());
    }

    @Test
    void testCreateOrderProductsNotFound() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(productRepository.findAllById(Arrays.asList(1L, 2L)))
                .thenReturn(Arrays.asList(testProduct1));

        // Act & Assert
        assertThrows(
                RuntimeException.class,
                () -> orderService.createOrder(orderRequest)
        );

        // Verify — factory and save should never be reached
        verify(userRepository).findById(1L);
        verify(productRepository).findAllById(Arrays.asList(1L, 2L));
        verify(orderFactory, never()).createOrder(any(), any(), any());
        verify(orderRepository, never()).save(any());
        verify(orderMapper, never()).toOrderResponse(any());
        }

    @Test
    void testGetOrdersByUserIdSuccess() {
        // Arrange
        List<Order> orders = Arrays.asList(testOrder);
        when(orderRepository.findByUserId(1L)).thenReturn(orders);
        when(orderMapper.toOrderResponse(testOrder)).thenReturn(orderResponse);

        // Act
        List<OrderResponse> result = orderService.getOrdersByUserId(1L);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(orderResponse.getOrderId(), result.get(0).getOrderId());

        // Verify interactions
        verify(orderRepository).findByUserId(1L);
        verify(orderMapper).toOrderResponse(testOrder);
    }

    @Test
    void testGetOrdersByUserIdNoOrders() {
        // Arrange
        when(orderRepository.findByUserId(999L)).thenReturn(Arrays.asList());

        // Act
        List<OrderResponse> result = orderService.getOrdersByUserId(999L);

        // Assert
        assertNotNull(result);
        assertTrue(result.isEmpty());

        // Verify interactions
        verify(orderRepository).findByUserId(999L);
        verify(orderMapper, never()).toOrderResponse(any());
    }

    @Test
    void testGetOrderItemsByOrderIdSuccess() {
        // Arrange
        OrderItem orderItem1 = OrderItem.builder()
                .id(1L)
                .order(testOrder)
                .product(testProduct1)
                .quantity(2)
                .unitPrice(new BigDecimal("50.00"))
                .build();

        OrderItem orderItem2 = OrderItem.builder()
                .id(2L)
                .order(testOrder)
                .product(testProduct2)
                .quantity(1)
                .unitPrice(new BigDecimal("75.00"))
                .build();

        List<OrderItem> orderItems = Arrays.asList(orderItem1, orderItem2);
        when(orderItemRepository.findByOrderId(1L)).thenReturn(orderItems);

        // Act
        List<com.hk.ordersservice.dto.OrderItemResponse> result = 
                orderService.getOrderItemsByOrderId(1L);

        // Assert
        assertNotNull(result);
        assertEquals(2, result.size());

        assertEquals(1L, result.get(0).getProductId());
        assertEquals(2, result.get(0).getQuantity());
        assertEquals(new BigDecimal("50.00"), result.get(0).getUnitPrice());

        assertEquals(2L, result.get(1).getProductId());
        assertEquals(1, result.get(1).getQuantity());
        assertEquals(new BigDecimal("75.00"), result.get(1).getUnitPrice());

        // Verify interactions
        verify(orderItemRepository).findByOrderId(1L);
    }

    @Test
    void testGetOrderItemsByOrderIdNoItems() {
        // Arrange
        when(orderItemRepository.findByOrderId(999L)).thenReturn(Arrays.asList());

        // Act
        List<com.hk.ordersservice.dto.OrderItemResponse> result = 
                orderService.getOrderItemsByOrderId(999L);

        // Assert
        assertNotNull(result);
        assertTrue(result.isEmpty());

        // Verify interactions
        verify(orderItemRepository).findByOrderId(999L);
    }
}
