package com.hk.ordersservice.mapper;

import com.hk.ordersservice.dto.ProductResponse;
import com.hk.ordersservice.entity.Product;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {
    
    public ProductResponse toProductResponse(Product product) {
        return ProductResponse.builder()
                .productId(product.getId())
                .name(product.getName())
                .unitPrice(product.getUnitPrice())
                .build();
    }
}
