package com.hk.ordersservice.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

// Main configuration class for Redis caching setup
@Configuration
@EnableCaching
public class RedisConfig {

        // Creates and configures the cache manager bean for Redis
        @Bean
        public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
                // Default cache configuration with custom settings
                RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                                // Set cache entries to expire after 10 minutes
                                .entryTtl(Duration.ofMinutes(10)) // 10 minutes TTL
                                // Use string serializer for cache keys (human-readable). by default redis
                                // stores keys as binary
                                .serializeKeysWith(RedisSerializationContext.SerializationPair
                                                .fromSerializer(new StringRedisSerializer()))
                                // Use JSON serializer for cache values (supports complex objects)
                                .serializeValuesWith(RedisSerializationContext.SerializationPair
                                                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
                                // Don't cache null values to save memory
                                .disableCachingNullValues();

                // Build the Redis cache manager with our configuration
                return RedisCacheManager.builder(connectionFactory)
                                // Apply the default config to all caches
                                .cacheDefaults(config)
                                // Enable @transactional support for cache operations ie if transaction fails,
                                // cache operations are rolled back
                                .transactionAware()
                                .build();
        }
}
