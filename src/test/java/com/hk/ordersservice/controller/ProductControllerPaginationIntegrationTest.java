package com.hk.ordersservice.controller;

import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.repository.ProductRepository;
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

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebMvc
@ActiveProfiles("test")
class ProductControllerPaginationIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ProductRepository productRepository;

    @BeforeEach
    void setUp() {
        productRepository.deleteAll();

        // Create test products
        for (int i = 1; i <= 25; i++) {
            Product product = Product.builder()
                    .name("Product " + i)
                    .unitPrice(new BigDecimal(10 + i))
                    .build();
            productRepository.save(product);
        }
    }

    @Test
    void testGetProductsPaginated_DefaultParameters() {
        String url = "http://localhost:" + port + "/api/products";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();

        // Verify pagination structure
        assertThat(response.getBody()).contains("\"currentPage\":0");
        assertThat(response.getBody()).contains("\"pageSize\":10");
        assertThat(response.getBody()).contains("\"totalElements\":25");
        assertThat(response.getBody()).contains("\"totalPages\":3");
        assertThat(response.getBody()).contains("\"first\":true");
        assertThat(response.getBody()).contains("\"last\":false");
    }

    @Test
    void testGetProductsPaginated_CustomPageAndSize() {
        String url = "http://localhost:" + port + "/api/products?page=1&size=5";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"currentPage\":1");
        assertThat(response.getBody()).contains("\"pageSize\":5");
        assertThat(response.getBody()).contains("\"totalPages\":5");
    }

    @Test
    void testGetProductsPaginated_SortByIdDesc() {
        String url = "http://localhost:" + port + "/api/products?sortBy=id&sortDir=desc";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Should return products in descending order by ID
        assertThat(response.getBody()).contains("\"currentPage\":0");
    }

    @Test
    void testGetProductsPaginated_SortByName() {
        String url = "http://localhost:" + port + "/api/products?sortBy=name&sortDir=asc";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"currentPage\":0");
    }

    @Test
    void testGetProductsPaginated_FilterByName() {
        String url = "http://localhost:" + port + "/api/products?name=Product 1";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Should return products containing "Product 1" (Product 1, Product 10-19)
        assertThat(response.getBody()).contains("\"totalElements\":11");
    }

    @Test
    void testGetProductsPaginated_FilterByPriceRange() {
        String url = "http://localhost:" + port + "/api/products?minPrice=15&maxPrice=20";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Should return products with prices between 15 and 20
        assertThat(response.getBody()).contains("\"totalElements\":6"); // Products 5-10
    }

    @Test
    void testGetProductsPaginated_CombinedFilters() {
        String url = "http://localhost:" + port + "/api/products?name=Product&minPrice=20&maxPrice=30&page=0&size=5";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"pageSize\":5");
    }

    @Test
    void testGetProductsPaginated_LastPage() {
        String url = "http://localhost:" + port + "/api/products?page=2&size=10";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"currentPage\":2");
        assertThat(response.getBody()).contains("\"last\":true");
    }

    @Test
    void testGetProductsPaginated_EmptyPage() {
        String url = "http://localhost:" + port + "/api/products?page=10&size=10";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"empty\":true");
        assertThat(response.getBody()).contains("\"totalElements\":25"); // Global count, not per-page
        assertThat(response.getBody()).contains("\"content\":[]"); // No content on empty page
    }

    @Test
    void testGetProductsLegacy_AllProducts() {
        String url = "http://localhost:" + port + "/api/products/all";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Verify it returns all 25 products
        assertThat(response.getBody()).contains("\"name\":\"Product 1\"");
        assertThat(response.getBody()).contains("\"name\":\"Product 25\"");
    }
}
