package com.hk.ordersservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

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
        try {
            String redisKey = buildKey(service, operation, key);
            String value = redisTemplate.opsForValue().get(redisKey);

            if (value == null || STATUS_PROCESSING.equals(value)) {
                return null;
            }

            return objectMapper.readValue(value, clazz);

        } catch (Exception e) {
            // log.error("Error getting idempotency key: {}", key, e);
            return null;
        }
    }

    // claims the key. Uses setIfAbsent (Redis SETNX) so only one caller wins. Sets
    // value to "PROCESSING" with 5 min TTL as a safety net if the app crashes
    // mid-operation.
    public boolean tryStart(String service, String operation, String key) {
        try {
            String redisKey = buildKey(service, operation, key);

            Boolean success = redisTemplate.opsForValue()
                    .setIfAbsent(redisKey, STATUS_PROCESSING, Duration.ofMinutes(5));

            return Boolean.TRUE.equals(success);

        } catch (Exception e) {
            // log.error("Error starting idempotency for key: {}", key, e);
            return false;
        }
    }

    // overwrites "PROCESSING" with the real JSON response. TTL bumps to 24h. Future
    // duplicates hit this and get the cached result.
    public <T> void save(String service, String operation, String key, T response) {
        try {
            String redisKey = buildKey(service, operation, key);
            String json = objectMapper.writeValueAsString(response); // convert response to JSON string

            redisTemplate.opsForValue().set(redisKey, json, DEFAULT_TTL);

        } catch (Exception e) {
            // log.error("Error saving idempotency response for key: {}", key, e);
        }
    }

    // deletes the key on failure so the client can retry. Without this, the
    // PROCESSING lock just sits there for 5 min.
    public void clear(String service, String operation, String key) {
        try {
            String redisKey = buildKey(service, operation, key);
            redisTemplate.delete(redisKey);
        } catch (Exception e) {
            // log.error("Error clearing idempotency lock for key: {}", key, e);
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