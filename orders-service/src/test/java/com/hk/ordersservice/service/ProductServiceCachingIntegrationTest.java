package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.ProductResponse;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@ActiveProfiles("test")
class ProductServiceCachingIntegrationTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CacheManager cacheManager;

    private Product testProduct;

    @BeforeEach
    void setUp() {
        // Clear all caches before each test
        cacheManager.getCacheNames().forEach(cacheName -> cacheManager.getCache(cacheName).clear());

        productRepository.deleteAll();

        // Create test product
        testProduct = Product.builder()
                .name("Test Product")
                .unitPrice(new BigDecimal("50.00"))
                .quantity(10)
                .build();
        testProduct = productRepository.save(testProduct);
    }

    @Test
    void testGetProductByIdCaching() {
        // Verify cache is empty initially
        var productsCache = cacheManager.getCache("products");
        assertThat(productsCache.get(testProduct.getId())).isNull();

        // First call - should hit database and populate cache
        ProductResponse result1 = productService.getProductById(testProduct.getId());

        assertThat(result1).isNotNull();
        assertThat(result1.getProductId()).isEqualTo(testProduct.getId());
        assertThat(result1.getName()).isEqualTo(testProduct.getName());

        // Verify cache is populated after first call
        assertThat(productsCache.get(testProduct.getId())).isNotNull();

        // Second call - should use cache
        ProductResponse result2 = productService.getProductById(testProduct.getId());

        assertThat(result2).isNotNull();
        assertThat(result2.getProductId()).isEqualTo(testProduct.getId());
        assertThat(result2.getName()).isEqualTo(testProduct.getName());

        // Verify both calls return identical results
        assertThat(result1).isEqualTo(result2);

        // Verify cache still contains the entry
        assertThat(productsCache.get(testProduct.getId())).isNotNull();
    }

    @Test
    void testUpdateProductUpdatesCache() {
        // First call to populate cache
        ProductResponse result1 = productService.getProductById(testProduct.getId());
        var productsCache = cacheManager.getCache("products");

        // Verify cache is populated
        assertThat(productsCache.get(testProduct.getId())).isNotNull();

        // Update product - should update cache with new data
        var updateRequest = com.hk.ordersservice.dto.ProductUpdateRequest.builder()
                .name("Updated Product Name")
                .unitPrice(new BigDecimal("75.00"))
                .quantity(20)
                .build();

        ProductResponse updatedResult = productService.updateProduct(testProduct.getId(), updateRequest);

        // Verify cache was updated with new data (not evicted)
        assertThat(productsCache.get(testProduct.getId())).isNotNull();

        // Verify the cached value matches the updated result
        var cachedValueWrapper = productsCache.get(testProduct.getId());
        assertThat(cachedValueWrapper).isNotNull();
        var cachedValue = cachedValueWrapper.get();
        assertThat(cachedValue).isNotNull();
        assertThat(cachedValue.toString()).contains("Updated Product Name");

        // Verify update was successful
        assertThat(updatedResult.getName()).isEqualTo("Updated Product Name");
        assertThat(updatedResult.getUnitPrice()).isEqualTo(new BigDecimal("75.00"));
        assertThat(updatedResult.getQuantity()).isEqualTo(20);

        // Subsequent call should use cache (not hit database)
        ProductResponse resultAfterUpdate = productService.getProductById(testProduct.getId());

        // Verify cache still contains the updated data
        assertThat(productsCache.get(testProduct.getId())).isNotNull();
        assertThat(resultAfterUpdate.getName()).isEqualTo("Updated Product Name");
        assertThat(resultAfterUpdate.getUnitPrice()).isEqualTo(new BigDecimal("75.00"));
        assertThat(resultAfterUpdate.getQuantity()).isEqualTo(20);
    }

    @Test
    void testDeleteProductEvictsCache() {
        // First call to populate cache
        ProductResponse result1 = productService.getProductById(testProduct.getId());
        var productsCache = cacheManager.getCache("products");

        // Verify cache is populated
        assertThat(productsCache.get(testProduct.getId())).isNotNull();

        // Delete product - should evict cache
        productService.deleteProduct(testProduct.getId());

        // Verify cache was evicted
        assertThat(productsCache.get(testProduct.getId())).isNull();

        // Verify product is deleted from database
        assertThat(productRepository.existsById(testProduct.getId())).isFalse();
    }
}
