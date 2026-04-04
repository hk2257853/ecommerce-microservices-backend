import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// NOTE: better to turn off rate limiter when testing the load on the create order end point
// in src/main/resources/application.yml, set rate.limit.rate-limit-enabled=false

export const options = {
  stages: [
    { duration: '30s', target: 10 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    // http_req_failed: ['rate<0.5'],    // Error rate should be below 50%
  },
};

export default function () {
  // Generate unique idempotency key for each request
  const idempotencyKey = uuidv4();

  // Generate random user ID (1-10)
  const userId = Math.floor(Math.random() * 10) + 1;

  // Generate random order items (1-5 items)
  const itemCount = Math.floor(Math.random() * 5) + 1;
  const items = [];

  for (let i = 0; i < itemCount; i++) {
    items.push({
      productId: Math.floor(Math.random() * 100) + 1, // Product IDs 1-100
      quantity: Math.floor(Math.random() * 3) + 1     // Quantity 1-3
    });
  }

  // Create order payload
  const payload = JSON.stringify({
    userId: userId,
    items: items,
    idempotencyKey: idempotencyKey
  });

  // Set headers
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Send POST request
  const response = http.post('http://localhost:8080/api/orders', payload, params);

  // Log response details
  console.log(`Status: ${response.status}, Duration: ${response.timings.duration}ms, IdempotencyKey: ${idempotencyKey}`);

  // Validate response
  check(response, {
    'status is 201 or 429': (r) => r.status === 201 || r.status === 429,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'response body is not empty': (r) => r.body.length > 0,
    'rate limit headers present when 429': (r) => {
      if (r.status === 429) {
        const headers = Object.fromEntries(
          Object.entries(r.headers).map(([k, v]) => [k.toLowerCase(), v])
        );
        return headers['x-ratelimit-limit'] &&
          headers['x-ratelimit-remaining'] &&
          headers['x-ratelimit-reset'];
      }
      return true;
    },
  });

  sleep(0.1); // Brief pause between requests
}
