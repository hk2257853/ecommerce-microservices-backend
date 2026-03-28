package com.hk.ordersservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductFilterDTO {
    private String name;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    
    public boolean hasNameFilter() {
        return name != null && !name.trim().isEmpty();
    }
    
    public boolean hasPriceFilter() {
        return minPrice != null || maxPrice != null;
    }
    
    public boolean hasAnyFilter() {
        return hasNameFilter() || hasPriceFilter();
    }
}
