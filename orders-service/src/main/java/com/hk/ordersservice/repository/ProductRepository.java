package com.hk.ordersservice.repository;

import com.hk.ordersservice.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

        List<Product> findByNameContainingIgnoreCase(String name);

        boolean existsByName(String name);

        Page<Product> findByNameContainingIgnoreCase(String name, Pageable pageable);

        @Query("SELECT p FROM Product p WHERE " +
                        "(:name IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :name, '%'))) AND " +
                        "(:minPrice IS NULL OR p.unitPrice >= :minPrice) AND " +
                        "(:maxPrice IS NULL OR p.unitPrice <= :maxPrice)")
        Page<Product> findWithFilters(
                        @Param("name") String name,
                        @Param("minPrice") BigDecimal minPrice,
                        @Param("maxPrice") BigDecimal maxPrice,
                        Pageable pageable);
        // :name IS NULL → checks if Java parameter is null (skip this filter)
        // p.name IS NULL → checks if database column value is null
}
