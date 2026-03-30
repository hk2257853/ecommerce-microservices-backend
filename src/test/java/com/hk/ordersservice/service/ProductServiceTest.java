package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.ProductCreateRequest;
import com.hk.ordersservice.dto.ProductResponse;
import com.hk.ordersservice.dto.ProductUpdateRequest;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.exception.DuplicateResourceException;
import com.hk.ordersservice.mapper.ProductMapper;
import com.hk.ordersservice.repository.ProductRepository;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductMapper productMapper;

    @InjectMocks
    private ProductService productService;

    private ProductCreateRequest productCreateRequest;
    private ProductUpdateRequest productUpdateRequest;
    private Product testProduct;
    private ProductResponse productResponse;

    @BeforeEach
    void setUp() {
        // Create test product create request
        productCreateRequest = ProductCreateRequest.builder()
                .name("Test Product")
                .unitPrice(new BigDecimal("50.00"))
                .quantity(10)
                .build();

        // Create test product update request
        productUpdateRequest = ProductUpdateRequest.builder()
                .name("Updated Product")
                .unitPrice(new BigDecimal("75.00"))
                .quantity(20)
                .build();

        // Create test product entity
        testProduct = Product.builder()
                .id(1L)
                .name("Test Product")
                .unitPrice(new BigDecimal("50.00"))
                .quantity(10)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // Create test product response
        productResponse = ProductResponse.builder()
                .productId(1L)
                .name("Test Product")
                .unitPrice(new BigDecimal("50.00"))
                .quantity(10)
                .inStock(true)
                .build();
    }

    @Test
    void testCreateProductSuccess() {
        // Arrange
        when(productRepository.existsByName("Test Product")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(testProduct);
        when(productMapper.toProductResponse(testProduct)).thenReturn(productResponse);

        // Act
        ProductResponse result = productService.createProduct(productCreateRequest);

        // Assert
        assertNotNull(result);
        assertEquals(productResponse.getProductId(), result.getProductId());
        assertEquals(productResponse.getName(), result.getName());
        assertEquals(productResponse.getUnitPrice(), result.getUnitPrice());
        assertEquals(productResponse.getQuantity(), result.getQuantity());
        assertEquals(productResponse.getInStock(), result.getInStock());

        // Verify interactions
        verify(productRepository).existsByName("Test Product");
        verify(productRepository).save(any(Product.class));
        verify(productMapper).toProductResponse(testProduct);
    }

    @Test
    void testCreateProductDuplicateName() {
        // Arrange
        when(productRepository.existsByName("Test Product")).thenReturn(true);

        // Act & Assert
        DuplicateResourceException exception = assertThrows(
                DuplicateResourceException.class,
                () -> productService.createProduct(productCreateRequest));

        assertTrue(exception.getMessage().contains("Product"));
        assertTrue(exception.getMessage().contains("name"));
        assertTrue(exception.getMessage().contains("Test Product"));

        // Verify interactions
        verify(productRepository).existsByName("Test Product");
        verify(productRepository, never()).save(any());
        verify(productMapper, never()).toProductResponse(any());
    }

    @Test
    void testGetAllProductsSuccess() {
        // Arrange
        Product testProduct2 = Product.builder()
                .id(2L)
                .name("Test Product 2")
                .unitPrice(new BigDecimal("75.00"))
                .quantity(15)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        ProductResponse productResponse2 = ProductResponse.builder()
                .productId(2L)
                .name("Test Product 2")
                .unitPrice(new BigDecimal("75.00"))
                .quantity(15)
                .inStock(true)
                .build();

        List<Product> products = Arrays.asList(testProduct, testProduct2);
        when(productRepository.findAll()).thenReturn(products);
        when(productMapper.toProductResponse(testProduct)).thenReturn(productResponse);
        when(productMapper.toProductResponse(testProduct2)).thenReturn(productResponse2);

        // Act
        List<ProductResponse> result = productService.getAllProducts();

        // Assert
        assertNotNull(result);
        assertEquals(2, result.size());
        assertEquals(productResponse.getProductId(), result.get(0).getProductId());
        assertEquals(productResponse.getName(), result.get(0).getName());
        assertEquals(productResponse.getUnitPrice(), result.get(0).getUnitPrice());
        assertEquals(productResponse.getQuantity(), result.get(0).getQuantity());
        assertEquals(productResponse.getInStock(), result.get(0).getInStock());
        assertEquals(productResponse2.getProductId(), result.get(1).getProductId());
        assertEquals(productResponse2.getName(), result.get(1).getName());
        assertEquals(productResponse2.getUnitPrice(), result.get(1).getUnitPrice());
        assertEquals(productResponse2.getQuantity(), result.get(1).getQuantity());
        assertEquals(productResponse2.getInStock(), result.get(1).getInStock());

        // Verify interactions
        verify(productRepository).findAll();
        verify(productMapper).toProductResponse(testProduct);
        verify(productMapper).toProductResponse(testProduct2);
    }

    @Test
    void testGetAllProductsEmptyList() {
        // Arrange
        when(productRepository.findAll()).thenReturn(Arrays.asList());

        // Act
        List<ProductResponse> result = productService.getAllProducts();

        // Assert
        assertNotNull(result);
        assertTrue(result.isEmpty());

        // Verify interactions
        verify(productRepository).findAll();
        verify(productMapper, never()).toProductResponse(any());
    }

    @Test
    void testCreateProductWithZeroPrice() {
        // Arrange
        ProductCreateRequest zeroPriceRequest = ProductCreateRequest.builder()
                .name("Zero Price Product")
                .unitPrice(BigDecimal.ZERO)
                .build();

        when(productRepository.existsByName("Zero Price Product")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(testProduct);
        when(productMapper.toProductResponse(testProduct)).thenReturn(productResponse);

        // Act
        ProductResponse result = productService.createProduct(zeroPriceRequest);

        // Assert
        assertNotNull(result);
        assertEquals(productResponse.getProductId(), result.getProductId());

        // Verify interactions
        verify(productRepository).existsByName("Zero Price Product");
        verify(productRepository).save(any(Product.class));
        verify(productMapper).toProductResponse(testProduct);
    }

    @Test
    void testCreateProductWithNegativePrice() {
        // Arrange
        ProductCreateRequest negativePriceRequest = ProductCreateRequest.builder()
                .name("Negative Price Product")
                .unitPrice(new BigDecimal("-10.00"))
                .build();

        when(productRepository.existsByName("Negative Price Product")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(testProduct);
        when(productMapper.toProductResponse(testProduct)).thenReturn(productResponse);

        // Act
        ProductResponse result = productService.createProduct(negativePriceRequest);

        // Assert
        assertNotNull(result);
        assertEquals(productResponse.getProductId(), result.getProductId());

        // Verify interactions
        verify(productRepository).existsByName("Negative Price Product");
        verify(productRepository).save(any(Product.class));
        verify(productMapper).toProductResponse(testProduct);
    }

    @Test
    void testCreateProductWithEmptyName() {
        // Arrange
        ProductCreateRequest emptyNameRequest = ProductCreateRequest.builder()
                .name("")
                .unitPrice(new BigDecimal("50.00"))
                .build();

        when(productRepository.existsByName("")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(testProduct);
        when(productMapper.toProductResponse(testProduct)).thenReturn(productResponse);

        // Act
        ProductResponse result = productService.createProduct(emptyNameRequest);

        // Assert
        assertNotNull(result);
        assertEquals(productResponse.getProductId(), result.getProductId());

        // Verify interactions
        verify(productRepository).existsByName("");
        verify(productRepository).save(any(Product.class));
        verify(productMapper).toProductResponse(testProduct);
    }

    @Test
    void testGetProductByIdSuccess() {
        // Arrange
        when(productRepository.findById(1L)).thenReturn(java.util.Optional.of(testProduct));
        when(productMapper.toProductResponse(testProduct)).thenReturn(productResponse);

        // Act
        ProductResponse result = productService.getProductById(1L);

        // Assert
        assertNotNull(result);
        assertEquals(productResponse.getProductId(), result.getProductId());
        assertEquals(productResponse.getName(), result.getName());
        assertEquals(productResponse.getUnitPrice(), result.getUnitPrice());
        assertEquals(productResponse.getQuantity(), result.getQuantity());
        assertEquals(productResponse.getInStock(), result.getInStock());

        // Verify interactions
        verify(productRepository).findById(1L);
        verify(productMapper).toProductResponse(testProduct);
    }

    @Test
    void testGetProductByIdNotFound() {
        // Arrange
        when(productRepository.findById(1L)).thenReturn(java.util.Optional.empty());

        // Act & Assert
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> productService.getProductById(1L));

        assertTrue(exception.getMessage().contains("Product not found with id: 1"));

        // Verify interactions
        verify(productRepository).findById(1L);
        verify(productMapper, never()).toProductResponse(any());
    }

    @Test
    void testUpdateProductSuccess() {
        // Arrange
        when(productRepository.findById(1L)).thenReturn(java.util.Optional.of(testProduct));
        when(productRepository.existsByName("Updated Product")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(testProduct);
        when(productMapper.toProductResponse(testProduct)).thenReturn(productResponse);

        // Act
        ProductResponse result = productService.updateProduct(1L, productUpdateRequest);

        // Assert
        assertNotNull(result);
        assertEquals(productResponse.getProductId(), result.getProductId());

        // Verify interactions
        verify(productRepository).findById(1L);
        verify(productRepository).existsByName("Updated Product");
        verify(productRepository).save(any(Product.class));
        verify(productMapper).toProductResponse(testProduct);
    }

    @Test
    void testUpdateProductNotFound() {
        // Arrange
        when(productRepository.findById(1L)).thenReturn(java.util.Optional.empty());

        // Act & Assert
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> productService.updateProduct(1L, productUpdateRequest));

        assertTrue(exception.getMessage().contains("Product not found with id: 1"));

        // Verify interactions
        verify(productRepository).findById(1L);
        verify(productRepository, never()).existsByName(any());
        verify(productRepository, never()).save(any());
        verify(productMapper, never()).toProductResponse(any());
    }

    @Test
    void testDeleteProductSuccess() {
        // Arrange
        when(productRepository.existsById(1L)).thenReturn(true);

        // Act
        productService.deleteProduct(1L);

        // Assert - no exception thrown

        // Verify interactions
        verify(productRepository).existsById(1L);
        verify(productRepository).deleteById(1L);
    }

    @Test
    void testDeleteProductNotFound() {
        // Arrange
        when(productRepository.existsById(1L)).thenReturn(false);

        // Act & Assert
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> productService.deleteProduct(1L));

        assertTrue(exception.getMessage().contains("Product not found with id: 1"));

        // Verify interactions
        verify(productRepository).existsById(1L);
        verify(productRepository, never()).deleteById(any());
    }
}
