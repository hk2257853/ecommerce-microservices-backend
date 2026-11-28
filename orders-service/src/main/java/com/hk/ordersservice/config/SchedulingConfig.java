package com.hk.ordersservice.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables scheduled background polling for the outbox relay outside isolated unit/test runs.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "outbox.relay.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}

