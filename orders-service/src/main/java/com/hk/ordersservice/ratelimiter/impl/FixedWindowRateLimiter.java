package com.hk.ordersservice.ratelimiter.impl;

import com.hk.ordersservice.config.RateLimitProperties;
import com.hk.ordersservice.config.RedisResilienceGuard;
import com.hk.ordersservice.ratelimiter.RateLimiterIF;
import com.hk.ordersservice.ratelimiter.RateLimitResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.util.Collections;

/**
 * Redis Lua script implementation of rate limiting.
 * Uses atomic increment-with-expiry operations to ensure thread safety.
 * Implements fail-open behavior to ensure service availability even when Redis
 * is unavailable.
 * This is the default implementation when strategy is not explicitly set.
 */
@Component
@ConditionalOnProperty(name = "rate-limit.strategy", havingValue = "fixed-window", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class FixedWindowRateLimiter implements RateLimiterIF {

    private final RateLimitProperties rateLimitProperties;
    private final RedisTemplate<String, String> redisTemplate;
    private final RedisScript<Long> fixedWindowRedisScript;
    private final RedisResilienceGuard redisGuard;

    private static final String RATE_LIMIT_KEY_PREFIX = "rate_limit:";

    @Override
    public RateLimitResult isWithinRateLimit(String clientIp) {
        String rateLimitKey = RATE_LIMIT_KEY_PREFIX + clientIp;
        RateLimitResult failOpen = new RateLimitResult(true, 0, rateLimitProperties.getMaxRequests());

        return redisGuard.execute("rate-limit:" + clientIp, () -> {
            Long currentCount = redisTemplate.execute(
                    fixedWindowRedisScript,
                    Collections.singletonList(rateLimitKey),
                    String.valueOf(rateLimitProperties.getWindowSeconds()));

            if (currentCount == null) {
                log.warn("Redis script returned null for key: {}", rateLimitKey);
                return failOpen;
            }

            boolean allowed = currentCount <= rateLimitProperties.getMaxRequests();
            long remaining = Math.max(0, rateLimitProperties.getMaxRequests() - currentCount);

            return new RateLimitResult(allowed, currentCount, remaining);
        }, () -> failOpen);
    }
}
