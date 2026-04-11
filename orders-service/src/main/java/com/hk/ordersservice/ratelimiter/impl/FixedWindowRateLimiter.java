package com.hk.ordersservice.ratelimiter.impl;

import com.hk.ordersservice.config.RateLimitProperties;
import com.hk.ordersservice.ratelimiter.RateLimiterIF;
import com.hk.ordersservice.ratelimiter.RateLimitResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.RedisConnectionFailureException;
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

    private static final String RATE_LIMIT_KEY_PREFIX = "rate_limit:";

    @Override
    public RateLimitResult isWithinRateLimit(String clientIp) {
        String rateLimitKey = RATE_LIMIT_KEY_PREFIX + clientIp;

        try {
            Long currentCount = redisTemplate.execute(
                    fixedWindowRedisScript,
                    Collections.singletonList(rateLimitKey),
                    String.valueOf(rateLimitProperties.getWindowSeconds()));

            if (currentCount == null) {
                log.warn("Redis script returned null for key: {}", rateLimitKey);
                // Fail-open: allow request if Redis returns null
                return new RateLimitResult(true, 0, rateLimitProperties.getMaxRequests());
            }

            boolean allowed = currentCount <= rateLimitProperties.getMaxRequests();
            long remaining = Math.max(0, rateLimitProperties.getMaxRequests() - currentCount);

            return new RateLimitResult(allowed, currentCount, remaining);

        } catch (RedisConnectionFailureException e) {
            // Fail-open: allow request if Redis is unavailable
            // NOTE: anything abuse-sensitive should not use this fail-open mechanism
            // instead give a 503 service unavailable or similar
            log.warn("Redis connection failed, allowing request through fail-open mechanism. IP: {}", clientIp, e);
            return new RateLimitResult(true, 0, rateLimitProperties.getMaxRequests());
        } catch (Exception e) {
            log.error("Unexpected error in rate limiting for IP: {}. Allowing request.", clientIp, e);
            return new RateLimitResult(true, 0, rateLimitProperties.getMaxRequests());
        }
    }
}
