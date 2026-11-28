package com.hk.ordersservice.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hk.ordersservice.config.RateLimitProperties;
import com.hk.ordersservice.ratelimiter.RateLimiterIF;
import com.hk.ordersservice.ratelimiter.RateLimitResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDateTime;

/**
 * Big picture: This is a servlet filter - it intercepts every HTTP request
 * before it hits your controller. Its job: count requests per IP, block if
 * they're over the limit.
 * Rate limiting filter that uses Redis Lua scripts for atomic
 * increment-with-expiry operations.
 * Implements fail-open behavior to ensure service availability even when Redis
 * is unavailable.
 */
@Component
@Order(2) // Run after RequestIdFilter (which is @Order(1) by default)
@Slf4j
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitProperties rateLimitProperties;
    private final RateLimiterIF rateLimiter;
    private final ObjectMapper objectMapper;

    private static final String X_FORWARDED_FOR_HEADER = "X-Forwarded-For";
    private static final String X_REAL_IP_HEADER = "X-Real-IP";
    private static final String X_RATE_LIMIT_LIMIT_HEADER = "X-RateLimit-Limit";
    private static final String X_RATE_LIMIT_REMAINING_HEADER = "X-RateLimit-Remaining";
    private static final String X_RATE_LIMIT_RESET_HEADER = "X-RateLimit-Reset";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path != null && path.startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        // Skip rate limiting if disabled
        if (!rateLimitProperties.isRateLimitEnabled()) {
            filterChain.doFilter(request, response); // next filter in the chain to be invoked
            return;
        }

        String clientIp = extractClientIp(request);

        try {
            // Check rate limit using the configured strategy
            RateLimitResult result = rateLimiter.isWithinRateLimit(clientIp);

            // Add rate limit headers to response
            addRateLimitHeaders(response, result);

            // Check if rate limit exceeded
            if (!result.allowed()) {
                log.warn("Rate limit exceeded for IP: {}. Count: {}, Limit: {}",
                        clientIp, result.currentCount(), rateLimitProperties.getMaxRequests());
                sendRateLimitExceededResponse(response);
                return;
            }

            // Allow request to proceed
            filterChain.doFilter(request, response);

        } catch (Exception e) {
            log.error("Unexpected error in rate limiting for IP: {}. Allowing request.", clientIp, e);
            filterChain.doFilter(request, response);
        }
    }

    /**
     * Extracts client IP in a proxy-aware manner.
     * Priority: X-Forwarded-For → X-Real-IP → request.getRemoteAddr()
     * X-Forwarded-For — when your request passes through a proxy/load balancer, it
     * adds this header containing the chain of IPs like "clientIP, proxy1IP,
     * proxy2IP", so [0] gives the original client.
     * 
     * X-Real-IP — simpler alternative set by Nginx with just the single real client
     * IP, no chain.
     * 
     * request.getRemoteAddr() — fallback when no headers exist; returns whoever is
     * directly connected to your server (useless if there's a proxy in front, since
     * you'd get the proxy's IP instead of the client's).
     */
    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader(X_FORWARDED_FOR_HEADER);
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // X-Forwarded-For can contain multiple IPs, take the first one (original
            // client)
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader(X_REAL_IP_HEADER);
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp.trim();
        }

        return request.getRemoteAddr();
    }

    /**
     * Adds rate limit headers to the response.
     * X-RateLimit-Limit: 100
     * X-RateLimit-Remaining: 73
     * X-RateLimit-Reset: 60
     */
    private void addRateLimitHeaders(HttpServletResponse response, RateLimitResult result) {
        response.setHeader(X_RATE_LIMIT_LIMIT_HEADER, String.valueOf(rateLimitProperties.getMaxRequests()));
        response.setHeader(X_RATE_LIMIT_REMAINING_HEADER, String.valueOf(result.remaining()));
        response.setHeader(X_RATE_LIMIT_RESET_HEADER, String.valueOf(rateLimitProperties.getWindowSeconds()));
    }

    // The GlobalExceptionHandler only handles exceptions that reach the controller
    // layer.
    /**
     * Sends a 429 Too Many Requests response using the existing ErrorResponse
     * format.
     */
    private void sendRateLimitExceededResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ErrorResponse errorResponse = new ErrorResponse(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "Rate limit exceeded. Try again later.",
                null,
                LocalDateTime.now());

        String jsonResponse = objectMapper.writeValueAsString(errorResponse);
        response.getWriter().write(jsonResponse);
        // no return responseEntity as this is a filter not a controller
        // HttpServletResponse is passed by reference — you write the status, headers,
        // and body directly into it, and the servlet container flushes it to the
        // client. Filters run before Spring's controller layer, so there's no
        // ResponseEntity magic — you serialize manually using objectMapper and write
        // raw JSON yourself.
    }

    /**
     * Error response record matching the format used in GlobalExceptionHandler.
     */
    private record ErrorResponse(
            int status,
            String message,
            Object errors,
            LocalDateTime timestamp) {
    }
}
