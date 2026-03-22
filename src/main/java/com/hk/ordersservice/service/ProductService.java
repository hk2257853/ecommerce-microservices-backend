package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.ProductCreateRequest;
import com.hk.ordersservice.dto.ProductResponse;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {
    
    private final ProductRepository productRepository;
    
    public ProductResponse createProduct(ProductCreateRequest request) {
        if (productRepository.existsByName(request.getName())) {
            throw new RuntimeException("Product with name " + request.getName() + " already exists");
        }
        
        Product product = Product.builder()
                .name(request.getName())
                .unitPrice(request.getUnitPrice())
                .build();
        
        Product savedProduct = productRepository.save(product);
        
        return ProductResponse.builder()
                .productId(savedProduct.getId())
                .name(savedProduct.getName())
                .unitPrice(savedProduct.getUnitPrice())
                .build();
    }
    
    public List<ProductResponse> getAllProducts() {
        return productRepository.findAll().stream()
                .map(product -> ProductResponse.builder()
                        .productId(product.getId())
                        .name(product.getName())
                        .unitPrice(product.getUnitPrice())
                        .build())
                .collect(Collectors.toList());
    }
}
