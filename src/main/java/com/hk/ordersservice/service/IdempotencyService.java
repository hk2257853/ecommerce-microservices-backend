package com.hk.ordersservice.service;

import java.time.Duration;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

// Main idea: Use Redis to ensure that the same request is not processed multiple times, eg: payment request proceesed twice thus causing double charge
/*
# Caller 1
get() → null → tryStart() → true → do work → save()

# Caller 2 (after Caller 1 done and same key shows up)
get() → JSON → return early ✅

# Caller 2 (while Caller 1 mid-work and same key shows up)
get() → null → tryStart() → false → reject ❌
*/

// Redis handles concurrency via atomic SETNX (Set If Not Exists) — only one thread can set a key that doesn't exist. Loser gets false and never reaches the DB. No optimistic/pessimistic locking needed.
@Service
@RequiredArgsConstructor
@Slf4j
public class IdempotencyService {

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    private static final Duration DEFAULT_TTL = Duration.ofHours(24);
    private static final String IDEMPOTENCY_PREFIX = "idempotency";

    private static final String STATUS_PROCESSING = "PROCESSING";

    // reads the key. Returns null for both "key doesn't exist" and "key is
    // PROCESSING". get is only for fetching a completed result JSON. The
    // concurrent duplicate case is handled by tryStart, not get
    public <T> T get(String service, String operation, String key, Class<T> clazz) {
        String redisKey = buildKey(service, operation, key);
        log.debug("Checking idempotency cache for key: {}", redisKey);

        try {
            String value = redisTemplate.opsForValue().get(redisKey);

            if (value == null) {
                log.debug("No cached result found for key: {}", redisKey);
                return null;
            }

            if (STATUS_PROCESSING.equals(value)) {
                log.warn("Request still processing for key: {}", redisKey);
                return null;
            }

            T result = objectMapper.readValue(value, clazz);
            log.info("Cache hit for idempotency key: {}, service: {}, operation: {}", key, service, operation);
            return result;

        } catch (Exception e) {
            log.error("Error getting idempotency key: {}, service: {}, operation: {}", key, service, operation, e);
            return null;
        }
    }

    // claims the key. Uses setIfAbsent (Redis SETNX) so only one caller wins. Sets
    // value to "PROCESSING" with 5 min TTL as a safety net if the app crashes
    // mid-operation.
    public boolean tryStart(String service, String operation, String key) {
        String redisKey = buildKey(service, operation, key);
        log.debug("Attempting to acquire idempotency lock for key: {}", redisKey);

        try {
            Boolean success = redisTemplate.opsForValue()
                    .setIfAbsent(redisKey, STATUS_PROCESSING, Duration.ofMinutes(5));

            boolean acquired = Boolean.TRUE.equals(success);
            if (acquired) {
                log.info("Idempotency lock acquired for key: {}, service: {}, operation: {}", key, service, operation);
            } else {
                log.warn("Idempotency lock already exists for key: {}, service: {}, operation: {}", key, service,
                        operation);
            }

            return acquired;

        } catch (Exception e) {
            log.error("Error starting idempotency for key: {}, service: {}, operation: {}", key, service, operation, e);
            return false;
        }
    }

    // overwrites "PROCESSING" with the real JSON response. TTL bumps to 24h. Future
    // duplicates hit this and get the cached result.
    public <T> void save(String service, String operation, String key, T response) {
        String redisKey = buildKey(service, operation, key);
        log.debug("Saving idempotency response for key: {}", redisKey);

        try {
            String json = objectMapper.writeValueAsString(response); // convert response to JSON string
            redisTemplate.opsForValue().set(redisKey, json, DEFAULT_TTL);

            log.info("Idempotency response saved for key: {}, service: {}, operation: {}, TTL: {} hours",
                    key, service, operation, DEFAULT_TTL.toHours());

        } catch (Exception e) {
            log.error("Error saving idempotency response for key: {}, service: {}, operation: {}", key, service,
                    operation, e);
        }
    }

    // deletes the key on failure so the client can retry. Without this, the
    // PROCESSING lock just sits there for 5 min.
    public void clear(String service, String operation, String key) {
        String redisKey = buildKey(service, operation, key);
        log.debug("Clearing idempotency lock for key: {}", redisKey);

        try {
            Boolean deleted = redisTemplate.delete(redisKey);
            if (Boolean.TRUE.equals(deleted)) {
                log.info("Idempotency lock cleared for key: {}, service: {}, operation: {}", key, service, operation);
            } else {
                log.warn("Idempotency lock not found for clearing, key: {}, service: {}, operation: {}", key, service,
                        operation);
            }

        } catch (Exception e) {
            log.error("Error clearing idempotency lock for key: {}, service: {}, operation: {}", key, service,
                    operation, e);
            // not thrown as original exception is already being. if i throw here original
            // exception will be lost
        }
    }

    private String buildKey(String service, String operation, String key) {
        return String.format("%s:%s:%s:%s",
                IDEMPOTENCY_PREFIX,
                service,
                operation,
                key);
    }
}