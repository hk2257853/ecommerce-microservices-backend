package com.hk.ordersservice.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hk.ordersservice.config.RateLimitProperties;
import com.hk.ordersservice.ratelimiter.RateLimiterIF;
import com.hk.ordersservice.ratelimiter.RateLimitResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.PrintWriter;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

        @Mock
        private RateLimitProperties rateLimitProperties;

        @Mock
        private RateLimiterIF rateLimiter;

        @Mock
        private HttpServletRequest request;

        @Mock
        private ObjectMapper objectMapper;

        @Mock
        private HttpServletResponse response;

        @Mock
        private FilterChain filterChain;

        @Mock
        private PrintWriter printWriter;

        @InjectMocks
        private RateLimitFilter rateLimitFilter;

        private void stubRateLimitEnabled() {
                when(rateLimitProperties.isRateLimitEnabled()).thenReturn(true);
        }

        private void stubRateLimitProperties() {
                when(rateLimitProperties.getMaxRequests()).thenReturn(10);
                when(rateLimitProperties.getWindowSeconds()).thenReturn(60);
        }

        private void stubDefaultIpExtraction() {
                when(request.getRemoteAddr()).thenReturn("192.168.1.1");
                when(request.getHeader("X-Forwarded-For")).thenReturn(null);
                when(request.getHeader("X-Real-IP")).thenReturn(null);
        }

        private void stubRateLimiterReturns(boolean allowed, long currentCount, long remaining) {
                when(rateLimiter.isWithinRateLimit(anyString()))
                                .thenReturn(new RateLimitResult(allowed, currentCount, remaining));
        }

        private void stubResponseWriter() throws IOException {
                when(response.getWriter()).thenReturn(printWriter);
        }

        @Nested
        @DisplayName("Rate limiting toggle")
        class RateLimitToggle {

                @Test
                @DisplayName("Should pass through when rate limiting is disabled")
                void whenDisabled_shouldPassThrough() throws ServletException, IOException {
                        when(rateLimitProperties.isRateLimitEnabled()).thenReturn(false);

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(filterChain).doFilter(request, response);
                        verify(rateLimiter, never()).isWithinRateLimit(anyString());
                }
        }

        @Nested
        @DisplayName("Request counting")
        class RequestCounting {

                @BeforeEach
                void setUp() {
                        stubRateLimitEnabled();
                        stubRateLimitProperties();
                        stubDefaultIpExtraction();
                }

                @Test
                @DisplayName("Should pass through and set headers when below limit")
                void whenBelowLimit_shouldPassThrough() throws ServletException, IOException {
                        stubRateLimiterReturns(true, 5L, 5L);

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(filterChain).doFilter(request, response);
                        verify(response).setHeader("X-RateLimit-Limit", "10");
                        verify(response).setHeader("X-RateLimit-Remaining", "5");
                        verify(response).setHeader("X-RateLimit-Reset", "60");
                }

                @Test
                @DisplayName("Should pass through when exactly at limit")
                void whenAtLimit_shouldPassThrough() throws ServletException, IOException {
                        stubRateLimiterReturns(true, 10L, 0L);

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(filterChain).doFilter(request, response);
                        verify(response).setHeader("X-RateLimit-Remaining", "0");
                }

                @Test
                @DisplayName("Should return 429 with JSON body when limit exceeded")
                void whenExceedsLimit_shouldReturn429() throws ServletException, IOException {
                        stubRateLimiterReturns(false, 11L, 0L);
                        stubResponseWriter();

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(filterChain, never()).doFilter(request, response);
                        verify(response).setStatus(429);
                        verify(response).setContentType(MediaType.APPLICATION_JSON_VALUE);
                        verify(response).setHeader("X-RateLimit-Limit", "10");
                        verify(response).setHeader("X-RateLimit-Remaining", "0");
                        verify(response).setHeader("X-RateLimit-Reset", "60");
                }
        }

        @Nested
        @DisplayName("Fail-open behavior")
        class FailOpen {

                @BeforeEach
                void setUp() {
                        stubRateLimitEnabled();
                        stubDefaultIpExtraction();
                }

                @Test
                @DisplayName("Should fail open when rate limiter throws exception")
                void whenRateLimiterThrows_shouldPassThrough() throws ServletException, IOException {
                        when(rateLimiter.isWithinRateLimit(anyString()))
                                        .thenThrow(new RuntimeException("Rate limiter error"));

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(filterChain).doFilter(request, response);
                }

        }

        @Nested
        @DisplayName("IP extraction")
        class IpExtraction {

                @BeforeEach
                void setUp() {
                        stubRateLimitEnabled();
                        stubRateLimitProperties();
                        stubRateLimiterReturns(true, 1L, 9L);
                }

                @Test
                @DisplayName("Should use first IP from X-Forwarded-For header")
                void whenXForwardedForPresent_shouldUseFirstIp() throws ServletException, IOException {
                        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.1, 192.168.1.1, 10.0.0.1");

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(rateLimiter).isWithinRateLimit("203.0.113.1");
                }

                @Test
                @DisplayName("Should fall back to X-Real-IP when X-Forwarded-For is absent")
                void whenXForwardedForAbsent_shouldUseXRealIp() throws ServletException, IOException {
                        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
                        when(request.getHeader("X-Real-IP")).thenReturn("203.0.113.2");

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(rateLimiter).isWithinRateLimit("203.0.113.2");
                }

                @Test
                @DisplayName("Should fall back to remoteAddr when no proxy headers present")
                void whenNoProxyHeaders_shouldUseRemoteAddr() throws ServletException, IOException {
                        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
                        when(request.getHeader("X-Real-IP")).thenReturn(null);
                        when(request.getRemoteAddr()).thenReturn("192.168.1.100");

                        rateLimitFilter.doFilterInternal(request, response, filterChain);

                        verify(rateLimiter).isWithinRateLimit("192.168.1.100");
                }
        }
}