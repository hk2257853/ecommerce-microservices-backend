package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.ProductCreateRequest;
import com.hk.ordersservice.dto.ProductResponse;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.exception.DuplicateResourceException;
import com.hk.ordersservice.mapper.ProductMapper;
import com.hk.ordersservice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {
    
    private final ProductRepository productRepository;
    private final ProductMapper productMapper;
    
    public ProductResponse createProduct(ProductCreateRequest request) {
        if (productRepository.existsByName(request.getName())) {
            throw new DuplicateResourceException("Product", "name", request.getName());
        }
        
        Product product = Product.builder()
                .name(request.getName())
                .unitPrice(request.getUnitPrice())
                .build();
        
        Product savedProduct = productRepository.save(product);
        
        return productMapper.toProductResponse(savedProduct);
    }
    
    public List<ProductResponse> getAllProducts() {
        return productRepository.findAll().stream()
                .map(productMapper::toProductResponse)
                .collect(Collectors.toList());
    }
}
