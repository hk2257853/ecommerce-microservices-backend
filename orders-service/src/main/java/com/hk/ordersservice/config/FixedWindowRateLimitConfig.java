package com.hk.ordersservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.script.RedisScript;

/**
 * My understanding for the config file: if other algo configs look similar, we
 * can go with interfaces. Otherwise, it is better to have a factory.
 *
 * Configuration for rate limiting Redis script and related beans.
 */
@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class FixedWindowRateLimitConfig {

    // Redis doesn't guarantee atomicity when you make separate INCR and EXPIRE
    // calls.
    // If the app crashes between those two calls, the key never expires → user is
    // permanently rate-limited.
    // Lua scripts run as a single atomic operation in Redis, so we use one instead.
    //
    // KEYS[1] = the rate limit key (e.g. "rate_limit:user:123:/api/orders")
    // ARGV[1] = the time window in seconds (e.g. 60)
    private static final String FIXED_WINDOW_LUA_SCRIPT = """
            local current
            current = redis.call('incr', KEYS[1])
            if tonumber(current) == 1 then
                redis.call('expire', KEYS[1], ARGV[1])
            end
            return current
            """;
    // Step 1: Increment the counter for this key (creates the key if it doesn't
    // exist yet)
    // Step 2: If count just became 1, this is the first request in a new window →
    // start the expiry timer
    // We only set expiry on the first hit because the timer should already be
    // running after that
    // Step 3: Return the current count so the caller can decide whether to allow or
    // reject the request

    // Registers the Lua script as a Spring bean so it can be injected into a
    // filter/interceptor.
    // Long.class tells Spring what type Redis will return (the current request
    // count).
    @Bean
    public RedisScript<Long> fixedWindowRedisScript() {
        return RedisScript.of(FIXED_WINDOW_LUA_SCRIPT, Long.class);
    }
}