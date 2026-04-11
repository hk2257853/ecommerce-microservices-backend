package com.hk.ordersservice.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for rate limiter using Testcontainers Redis.
 * Tests real Redis behavior with fail-open scenarios and concurrent access.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class RateLimiterIntegrationTest {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    private String baseUrl;

    private static final AtomicInteger ipCounter = new AtomicInteger(1);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("rate-limit.rate-limit-enabled", () -> "true");
        registry.add("rate-limit.max-requests", () -> "3");
        registry.add("rate-limit.window-seconds", () -> "5");

        registry.add("spring.data.redis.host", () -> redis.getHost());
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379).toString());
        registry.add("spring.data.redis.timeout", () -> "2000ms");

        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:testdb");
        registry.add("spring.datasource.driver-class-name", () -> "org.h2.Driver");
        registry.add("spring.datasource.username", () -> "sa");
        registry.add("spring.datasource.password", () -> "");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.H2Dialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("spring.flyway.enabled", () -> "false");
    }

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port;
    }

    private String getUniqueIp() {
        return "10.0.0." + ipCounter.getAndIncrement();
    }

    @Nested
    @DisplayName("Basic Rate Limiting")
    class BasicRateLimiting {

        @Test
        @DisplayName("Should allow requests under limit")
        void shouldAllowRequestsUnderLimit() {
            String ip = getUniqueIp();
            ResponseEntity<String> response1 = makeRequestWithIp(ip);
            ResponseEntity<String> response2 = makeRequestWithIp(ip);

            assertThat(response1.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response2.getStatusCode()).isEqualTo(HttpStatus.OK);

            assertThat(response1.getHeaders().getFirst("X-RateLimit-Limit")).isEqualTo("3");
            assertThat(response1.getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("2");
            assertThat(response1.getHeaders().getFirst("X-RateLimit-Reset")).isNotNull();
        }

        @Test
        @DisplayName("Should block requests over limit")
        void shouldBlockRequestsOverLimit() {
            String ip = getUniqueIp();
            ResponseEntity<String> response1 = makeRequestWithIp(ip);
            ResponseEntity<String> response2 = makeRequestWithIp(ip);
            ResponseEntity<String> response3 = makeRequestWithIp(ip);
            ResponseEntity<String> response4 = makeRequestWithIp(ip);

            assertThat(response1.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response2.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response3.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response4.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

            assertThat(response1.getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("2");
            assertThat(response2.getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("1");
            assertThat(response3.getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("0");
        }
    }

    @Nested
    @DisplayName("Window Reset")
    class WindowReset {

        @Test
        @DisplayName("Should reset after window expires")
        void shouldResetAfterWindowExpires() throws InterruptedException {
            String ip = getUniqueIp();
            makeRequestWithIp(ip);
            makeRequestWithIp(ip);
            makeRequestWithIp(ip);

            ResponseEntity<String> blocked = makeRequestWithIp(ip);
            assertThat(blocked.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

            // Wait for 5s window + 1s buffer
            Thread.sleep(6000);

            ResponseEntity<String> afterReset = makeRequestWithIp(ip);
            assertThat(afterReset.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(afterReset.getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("2");
        }
    }

    @Nested
    @DisplayName("Concurrent Requests")
    class ConcurrentRequests {

        @Test
        @DisplayName("Should handle concurrent requests from same IP")
        void shouldHandleConcurrentRequestsFromSameIp() throws Exception {
            // Fixed IP so all threads share the same counter
            String sharedIp = getUniqueIp();
            int threadCount = 10;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);
            AtomicInteger successCount = new AtomicInteger(0);
            AtomicInteger rateLimitCount = new AtomicInteger(0);

            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        ResponseEntity<String> response = makeRequestWithIp(sharedIp);
                        if (response.getStatusCode() == HttpStatus.OK) {
                            successCount.incrementAndGet();
                        } else if (response.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                            rateLimitCount.incrementAndGet();
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            latch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            // <= 3 because thread scheduling isn't deterministic
            assertThat(successCount.get()).isLessThanOrEqualTo(3);
            assertThat(rateLimitCount.get()).isGreaterThanOrEqualTo(7);
        }

        @Test
        @DisplayName("Should track different IPs separately")
        void shouldTrackDifferentIpsSeparately() throws Exception {
            // Two unique IPs, 3 requests each = 6 total successes
            String ip1 = getUniqueIp();
            String ip2 = getUniqueIp();
            String[] ips = { ip1, ip2 };

            int threadCount = 6;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);
            AtomicInteger successCount = new AtomicInteger(0);

            for (int i = 0; i < threadCount; i++) {
                final String ip = ips[i % 2];
                executor.submit(() -> {
                    try {
                        ResponseEntity<String> response = makeRequestWithIp(ip);
                        if (response.getStatusCode() == HttpStatus.OK) {
                            successCount.incrementAndGet();
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            latch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            assertThat(successCount.get()).isEqualTo(6);
        }
    }

    @Nested
    @DisplayName("Fail Open Behavior")
    class FailOpenBehavior {

        @Test
        @DisplayName("Should allow requests when Redis is down")
        void shouldAllowRequestsWhenRedisDown() throws InterruptedException {
            String ip = getUniqueIp();

            // Verify rate limiting works
            makeRequestWithIp(ip);
            makeRequestWithIp(ip);
            makeRequestWithIp(ip);
            assertThat(makeRequestWithIp(ip).getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

            // Stop Redis
            redis.stop();
            Thread.sleep(2000);

            // Fail-open: new IP should pass through even with Redis down
            String newIp = getUniqueIp();
            assertThat(makeRequestWithIp(newIp).getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(makeRequestWithIp(newIp).getStatusCode()).isEqualTo(HttpStatus.OK);

            // Restart Redis so remaining tests in suite aren't affected
            redis.start();
            Thread.sleep(1000);
        }
    }

    private ResponseEntity<String> makeRequestWithIp(String clientIp) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Forwarded-For", clientIp);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        return restTemplate.exchange(
                baseUrl + "/api/products",
                HttpMethod.GET,
                entity,
                String.class);
    }
}