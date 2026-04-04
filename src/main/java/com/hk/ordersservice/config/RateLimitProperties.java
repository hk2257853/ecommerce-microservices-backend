package com.hk.ordersservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for rate limiting functionality.
 * Picks up values from application.yml under the 'rate-limit' prefix.
 */
@ConfigurationProperties(prefix = "rate-limit")
public class RateLimitProperties {

    // if yml file doesn't have these values, these defaults will be used
    private int maxRequests = 10;

    private int windowSeconds = 60;

    private boolean rateLimitEnabled = true;

    private String strategy = "fixed-window";

    public int getMaxRequests() {
        return maxRequests;
    }

    public void setMaxRequests(int maxRequests) {
        this.maxRequests = maxRequests;
    }

    public int getWindowSeconds() {
        return windowSeconds;
    }

    public void setWindowSeconds(int windowSeconds) {
        this.windowSeconds = windowSeconds;
    }

    public boolean isRateLimitEnabled() {
        return rateLimitEnabled;
    }

    public void setRateLimitEnabled(boolean rateLimitEnabled) {
        this.rateLimitEnabled = rateLimitEnabled;
    }

    public String getStrategy() {
        return strategy;
    }

    public void setStrategy(String strategy) {
        this.strategy = strategy;
    }
}
