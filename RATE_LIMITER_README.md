# Rate Limiter Implementation

This document describes the production-ready IP-based rate limiter implemented using Redis Lua scripts for atomic operations.

## Overview

The rate limiter provides:
- **IP-based rate limiting** for all endpoints
- **Atomic Redis operations** using Lua scripts to eliminate race conditions
- **Fail-open behavior** to ensure service availability
- **Proxy-aware IP extraction** for deployed environments
- **Consistent error responses** matching existing API contracts
- **Comprehensive rate limit headers** for client visibility
- **Externalized configuration** for easy tuning

## Architecture

### Components

1. **RateLimitProperties** - Configuration class bound to `rate-limit` prefix
2. **RateLimitConfig** - Redis Lua script configuration
3. **RateLimitFilter** - Main filter implementing rate limiting logic
4. **Comprehensive tests** - Unit and integration test coverage

### Request Flow

```
Request → RequestIdFilter → RateLimitFilter → Application
```

The rate limiter runs after `RequestIdFilter` to ensure all requests (including rate-limited ones) have request IDs for proper tracing.

## Configuration

### application.yml

```yaml
rate-limit:
  max-requests: 10      # Maximum requests per window
  window-seconds: 60    # Time window in seconds
  enabled: true         # Enable/disable rate limiting
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `max-requests` | int | 10 | Maximum requests allowed in the time window |
| `window-seconds` | int | 60 | Time window duration in seconds |
| `enabled` | boolean | true | Global enable/disable flag |

## Implementation Details

### Redis Lua Script

The Lua script ensures atomic operations:

```lua
local current
current = redis.call('incr', KEYS[1])
if tonumber(current) == 1 then
    redis.call('expire', KEYS[1], ARGV[1])
end
return current
```

This eliminates race conditions between INCR and EXPIRE operations.

### IP Extraction Strategy

Priority order for client IP detection:
1. **X-Forwarded-For** header (first IP in comma-separated list)
2. **X-Real-IP** header
3. **request.getRemoteAddr()** (fallback)

### Fail-Open Behavior

When Redis is unavailable:
- Log warning with IP address
- Allow request to proceed
- Maintain service availability

### Rate Limit Headers

All responses include rate limit information:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time until window resets (seconds)

### Error Response Format

Rate limit exceeded responses use the existing `ErrorResponse` format:

```json
{
  "status": 429,
  "message": "Rate limit exceeded. Try again later.",
  "errors": null,
  "timestamp": "2024-01-01T12:00:00"
}
```

## Testing

### Unit Tests

Comprehensive test coverage for:
- Normal flow (below/at/above limits)
- Fail-open behavior (Redis failures)
- IP extraction logic
- Header setting
- Configuration changes

### Integration Tests

Configuration loading and property validation.

### Running Tests

```bash
./gradlew test --tests RateLimitFilterTest
./gradlew test --tests RateLimitIntegrationTest
```

## Redis Key Format

Rate limit keys follow the pattern:
```
rate_limit:{clientIP}
```

Example: `rate_limit:192.168.1.100`

## Production Considerations

### Monitoring

Monitor these metrics:
- Rate limit rejections (429 responses)
- Redis connection failures
- Request patterns by IP

### Scaling

- Redis should be configured for high availability
- Consider Redis cluster for horizontal scaling
- Monitor Redis memory usage

### Security

- Rate limiting is per IP, not per user
- Consider additional authentication-based rate limiting for authenticated endpoints
- Monitor for IP spoofing attempts

## Configuration Examples

### Development Environment

```yaml
rate-limit:
  max-requests: 100
  window-seconds: 60
  enabled: true
```

### Production Environment

```yaml
rate-limit:
  max-requests: 10
  window-seconds: 60
  enabled: true
```

### Disabled Rate Limiting

```yaml
rate-limit:
  enabled: false
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failures**
   - Check Redis connectivity
   - Verify Redis configuration
   - Monitor fail-open logs

2. **Incorrect Rate Limiting**
   - Verify IP extraction headers
   - Check proxy configuration
   - Review rate limit configuration

3. **Missing Headers**
   - Ensure filter is properly registered
   - Check filter ordering
   - Verify configuration loading

### Logging

Rate limiter logs include:
- Rate limit exceeded warnings
- Redis connection failure warnings
- Unexpected error logs

All logs include client IP for debugging.

## Future Enhancements

Potential improvements for production use:
- User-based rate limiting
- Per-endpoint rate limits
- Sliding window implementation
- Distributed rate limiting
- Rate limit burst handling
- Advanced IP whitelist/blacklist
