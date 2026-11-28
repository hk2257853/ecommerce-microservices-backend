package com.hk.ordersservice.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Guards Redis calls with the shared Resilience4j "redis" circuit breaker.
 * When Redis is slow or unavailable, trips open and executes the fallback immediately
 * instead of blocking Tomcat worker threads.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RedisResilienceGuard {

    private final CircuitBreakerRegistry circuitBreakerRegistry;

    public <T> T execute(String operation, Supplier<T> redisCall, Supplier<T> fallback) {
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("redis");
        if (!cb.tryAcquirePermission()) {
            log.debug("Redis circuit breaker OPEN; skipping {}", operation);
            return fallback.get();
        }

        long startNanos = System.nanoTime();
        try {
            T result = redisCall.get();
            cb.onSuccess(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS);
            return result;
        } catch (Exception e) {
            cb.onError(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS, e);
            log.warn("Redis call failed during {}; using fallback: {}", operation, e.getMessage());
            return fallback.get();
        }
    }
}

