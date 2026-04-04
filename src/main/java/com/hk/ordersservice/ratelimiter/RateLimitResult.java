package com.hk.ordersservice.ratelimiter;

/**
 * Result of a rate limit check containing whether the request is allowed
 * and current rate limiting metrics.
 */
public record RateLimitResult(
    boolean allowed,      // Whether the request should be allowed
    long currentCount,    // Current request count for this window
    long remaining        // Remaining requests before limit is hit
) {}
