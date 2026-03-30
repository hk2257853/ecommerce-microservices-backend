package com.hk.ordersservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

// ideally we won't expose this endpoint in production, it will be part of internal network
@RestController
@RequestMapping("/api/cache")
@RequiredArgsConstructor
public class CacheController {

    private final CacheManager cacheManager;

    @GetMapping("/stats")
    @Operation(summary = "Get cache statistics")
    public ResponseEntity<Map<String, Object>> getCacheStats() {
        Map<String, Object> stats = new HashMap<>();

        cacheManager.getCacheNames().forEach(cacheName -> {
            var cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                stats.put(cacheName, "Active");
            }
        });

        return ResponseEntity.ok(stats);
    }

    @DeleteMapping("/clear/products")
    @Operation(summary = "Clear products cache")
    public ResponseEntity<String> clearProductsCache() {
        var cache = cacheManager.getCache("products");
        if (cache != null) {
            cache.clear();
            return ResponseEntity.ok("Products cache cleared");
        }
        return ResponseEntity.notFound().build();
    }
}
