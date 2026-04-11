package com.hk.ordersservice.ratelimiter;

/**
 * Strategy interface for rate limiting algorithms.
 * Different implementations can use different algorithms like Redis Lua
 * scripts,
 * token bucket, sliding window, etc.
 */
public interface RateLimiterIF {

    /**
     * Checks if a request from the given client IP should be allowed.
     * 
     * @param clientIp the client IP address to rate limit
     * @return RateLimitResult containing whether the request is allowed and current
     *         metrics
     */
    RateLimitResult isWithinRateLimit(String clientIp);
}
