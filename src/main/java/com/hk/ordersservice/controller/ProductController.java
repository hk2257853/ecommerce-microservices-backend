package com.hk.ordersservice.controller;

import com.hk.ordersservice.dto.PageResponse;
import com.hk.ordersservice.dto.ProductCreateRequest;
import com.hk.ordersservice.dto.ProductUpdateRequest;
import com.hk.ordersservice.dto.ProductFilterDTO;
import com.hk.ordersservice.dto.ProductResponse;
import com.hk.ordersservice.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

        private final ProductService productService;

        @PostMapping
        @Operation(summary = "Create a new product")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "201", description = "Product created successfully"),
                        @ApiResponse(responseCode = "400", description = "Invalid input"),
                        @ApiResponse(responseCode = "409", description = "Product already exists")
        })
        public ResponseEntity<ProductResponse> createProduct(@Valid @RequestBody ProductCreateRequest request) {
                ProductResponse response = productService.createProduct(request);
                return new ResponseEntity<>(response, HttpStatus.CREATED);
        }

        @GetMapping
        @Operation(summary = "Get all products with pagination, sorting, and filtering")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Products retrieved successfully")
        })
        public ResponseEntity<PageResponse<ProductResponse>> getAllProducts(
                        @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
                        @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
                        @Parameter(description = "Sort by field") @RequestParam(defaultValue = "id") String sortBy,
                        @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "asc") String sortDir,
                        @ModelAttribute ProductFilterDTO filter) {

                PageResponse<ProductResponse> products = productService.getProductsPaginated(page, size, sortBy,
                                sortDir, filter);
                return ResponseEntity.ok(products);
        }

        @GetMapping("/all")
        @Operation(summary = "Get all products (without pagination)")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Products retrieved successfully")
        })
        public ResponseEntity<List<ProductResponse>> getAllProductsLegacy() {
                List<ProductResponse> products = productService.getAllProducts();
                return ResponseEntity.ok(products);
        }

        @GetMapping("/{id}")
        @Operation(summary = "Get product by ID")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Product retrieved successfully"),
                        @ApiResponse(responseCode = "404", description = "Product not found")
        })
        public ResponseEntity<ProductResponse> getProductById(@PathVariable Long id) {
                ProductResponse product = productService.getProductById(id);
                return ResponseEntity.ok(product);
        }

        @PutMapping("/{id}")
        @Operation(summary = "Update product by ID")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Product updated successfully"),
                        @ApiResponse(responseCode = "400", description = "Invalid input"),
                        @ApiResponse(responseCode = "404", description = "Product not found"),
                        @ApiResponse(responseCode = "409", description = "Product with this name already exists")
        })
        public ResponseEntity<ProductResponse> updateProduct(
                        @PathVariable Long id,
                        @Valid @RequestBody ProductUpdateRequest request) {
                ProductResponse product = productService.updateProduct(id, request);
                return ResponseEntity.ok(product);
        }

        @DeleteMapping("/{id}")
        @Operation(summary = "Delete product by ID")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "204", description = "Product deleted successfully"),
                        @ApiResponse(responseCode = "404", description = "Product not found")
        })
        public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
                productService.deleteProduct(id);
                return ResponseEntity.noContent().build();
        }
}
