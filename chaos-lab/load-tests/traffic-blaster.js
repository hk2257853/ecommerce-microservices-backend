import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ============================================================================
// Production Traffic Blaster (k6 Load Generator)
// Simulates concurrent shoppers placing ecommerce orders with idempotency keys
// ============================================================================

export const options = {
  scenarios: {
    // Ramp up traffic in realistic stages
    shopper_traffic: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '20s', target: 15 },  // Normal daytime baseline
        { duration: '40s', target: 60 },  // Flash Sale Surge
        { duration: '40s', target: 100 }, // Peak Surge
        { duration: '20s', target: 10 },  // Cooldown
      ],
    },
  },
  thresholds: {
    // SLO: 95% of requests should be under 500ms when healthy
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  const headers = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': '10.99.99.99',
  };

  const userRes = http.post(
    'http://localhost:8080/api/users',
    JSON.stringify({
      name: 'Chaos Load User',
      email: `chaos-${Date.now()}@test.local`,
      address: '123 Chaos Ave',
    }),
    { headers }
  );

  const productIds = [];
  for (let i = 0; i < 200; i++) {
    const productRes = http.post(
      'http://localhost:8080/api/products',
      JSON.stringify({
        name: `Chaos Load Item ${Date.now()}-${i}`,
        unitPrice: 19.99,
        quantity: 1000000,
      }),
      { headers }
    );
    if (productRes.status === 201) {
      productIds.push(productRes.json('productId'));
    }
  }
  if (productIds.length === 0) productIds.push(1);

  const userId = userRes.status === 201 ? userRes.json('userId') : 1;

  return { userId, productIds };
}

export default function (data) {
  const url = 'http://localhost:8080/api/orders';
  const idempotencyKey = uuidv4();
  const productId = data.productIds[(__VU * 13 + __ITER) % data.productIds.length];

  const payload = JSON.stringify({
    userId: data.userId,
    items: [
      {
        productId: productId,
        quantity: 1,
      },
    ],
    idempotencyKey: idempotencyKey,
  });

  // 90% unique IPs (so orders reach PostgreSQL & Kafka), 10% shared IP (so 429 rate-limiter still shows on graph)
  const ip =
    __ITER % 10 === 0
      ? '10.0.0.99'
      : `10.${(__VU % 200) + 1}.${(__ITER % 250) + 1}.${(Math.floor(__ITER / 250) % 250) + 1}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-Forwarded-For': ip,
    },
    timeout: '5s',
  };

  const res = http.post(url, payload, params);

  // Validate response status codes
  check(res, {
    'status is 201 Created': (r) => r.status === 201,
    'status is 429 Rate Limited': (r) => r.status === 429,
    'not 504 Timeout': (r) => r.status !== 504,
    'not 500 Server Error': (r) => r.status !== 500,
  });

  // Small pacing sleep between iterations (50ms - 150ms)
  sleep(0.05 + Math.random() * 0.1);
}

