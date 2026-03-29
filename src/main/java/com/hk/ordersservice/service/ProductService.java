package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.PageResponse;
import com.hk.ordersservice.dto.ProductCreateRequest;
import com.hk.ordersservice.dto.ProductFilterDTO;
import com.hk.ordersservice.dto.ProductResponse;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.exception.DuplicateResourceException;
import com.hk.ordersservice.mapper.ProductMapper;
import com.hk.ordersservice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
                .quantity(request.getQuantity() != null ? request.getQuantity() : 5)
                .build();

        Product savedProduct = productRepository.save(product);

        return productMapper.toProductResponse(savedProduct);
    }

    public List<ProductResponse> getAllProducts() {
        return productRepository.findAll().stream()
                .map(productMapper::toProductResponse)
                .collect(Collectors.toList());
    }

    public PageResponse<ProductResponse> getProductsPaginated(
            int page,
            int size,
            String sortBy, // which column to sort by
            String sortDir, // ascending or descending
            ProductFilterDTO filter) {

        Sort sort = Sort.by(sortDir.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC, sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Product> productPage;

        if (filter != null && filter.hasAnyFilter()) {
            productPage = productRepository.findWithFilters(
                    filter.hasNameFilter() ? filter.getName() : null,
                    filter.getMinPrice(),
                    filter.getMaxPrice(),
                    pageable);
        } else {
            productPage = productRepository.findAll(pageable);
        }

        Page<ProductResponse> responsePage = productPage.map(productMapper::toProductResponse);

        return PageResponse.from(responsePage);
    }
}
