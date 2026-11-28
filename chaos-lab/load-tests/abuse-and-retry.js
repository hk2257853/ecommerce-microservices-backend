import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Custom counters to make Scenario 4 results crystal clear
const spammer201 = new Counter('spammer_201');
const spammer429 = new Counter('spammer_429');
const normal201 = new Counter('normal_201');
const normal429 = new Counter('normal_429');
const normal5xx = new Counter('normal_5xx');
const retry201SameId = new Counter('retry_201_same_id');
const retry409Conflict = new Counter('retry_409_conflict');
const retryDuplicateBug = new Counter('retry_duplicate_bug');

const BASE_URL = 'http://localhost:8080';

export const options = {
  scenarios: {
    // 1. One abusive IP hammering /api/orders -> should get 429 after 10 req/min
    spammer_ip: {
      executor: 'constant-vus',
      vus: 5,
      duration: '60s',
      exec: 'spammer',
    },
    // 2. Normal buyers with unique IPs -> should keep getting 201 unaffected
    normal_buyers: {
      executor: 'constant-vus',
      vus: 10,
      duration: '60s',
      exec: 'normalBuyer',
    },
    // 3. Double-click / retry bursts with the same idempotencyKey -> only 1 order created per key
    double_click_retries: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60s',
      exec: 'doubleClickRetry',
    },
  },
  thresholds: {
    normal_5xx: ['count==0'],
    normal_429: ['count==0'],
    retry_duplicate_bug: ['count==0'],
    spammer_429: ['count>50'],
  },
};

export function setup() {
  const runId = Date.now();
  const userRes = http.post(
    `${BASE_URL}/api/users`,
    JSON.stringify({
      name: `Chaos S4 Tester ${runId}`,
      email: `chaos_s4_${runId}@example.com`,
      address: '123 Chaos Lane',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.0.0.${(runId % 200) + 1}`,
      },
    }
  );
  const userId = userRes.json('userId');

  const productIds = [];
  for (let i = 0; i < 30; i++) {
    const prodRes = http.post(
      `${BASE_URL}/api/products`,
      JSON.stringify({
        name: `S4 Item ${runId}-${i}`,
        unitPrice: 19.99,
        quantity: 1000000,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.0.${Math.floor(i / 20) + 1}.${(i % 200) + 1}`,
        },
      }
    );
    if (prodRes.status === 201 || prodRes.status === 200) {
      productIds.push(prodRes.json('productId'));
    }
  }

  return { userId, productIds, runId };
}

function uniqueIp(prefix, vu, iter) {
  const b = (vu % 200) + 1;
  const c = Math.floor(iter / 200) % 250;
  const d = (iter % 200) + 1;
  return `${prefix}.${b}.${c}.${d}`;
}

export function spammer(data) {
  const productId = data.productIds[__ITER % data.productIds.length];
  const payload = JSON.stringify({
    userId: data.userId,
    idempotencyKey: `spam-${data.runId}-${__VU}-${__ITER}`,
    items: [{ productId, quantity: 1 }],
  });

  const res = http.post(`${BASE_URL}/api/orders`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '10.99.99.99',
    },
    timeout: '5s',
  });

  if (res.status === 201) spammer201.add(1);
  else if (res.status === 429) spammer429.add(1);

  check(res, {
    'spammer blocked (429) or allowed (201)': (r) => r.status === 429 || r.status === 201,
  });
  sleep(0.05);
}

export function normalBuyer(data) {
  const productId = data.productIds[(__VU + __ITER) % data.productIds.length];
  const payload = JSON.stringify({
    userId: data.userId,
    idempotencyKey: `norm-${data.runId}-${__VU}-${__ITER}`,
    items: [{ productId, quantity: 1 }],
  });

  const res = http.post(`${BASE_URL}/api/orders`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': uniqueIp('10', __VU, __ITER),
    },
    timeout: '5s',
  });

  if (res.status === 201) normal201.add(1);
  else if (res.status === 429) normal429.add(1);
  else if (res.status >= 500 || res.status === 0) normal5xx.add(1);

  check(res, {
    'normal buyer succeeds (201)': (r) => r.status === 201,
  });
  sleep(0.1);
}

export function doubleClickRetry(data) {
  const key = `retry-${data.runId}-${__ITER}`;
  const productId = data.productIds[__ITER % data.productIds.length];
  const payload = JSON.stringify({
    userId: data.userId,
    idempotencyKey: key,
    items: [{ productId, quantity: 1 }],
  });

  // Burst 5 concurrent identical requests (different IPs so rate limiter doesn't mask idempotency)
  const batchReqs = [];
  for (let i = 0; i < 5; i++) {
    batchReqs.push([
      'POST',
      `${BASE_URL}/api/orders`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': uniqueIp('11', i + 1, __ITER),
        },
        timeout: '5s',
      },
    ]);
  }

  const responses = http.batch(batchReqs);
  sleep(0.5);

  // Sequential retry after completion
  const seqRes = http.post(`${BASE_URL}/api/orders`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': uniqueIp('12', 1, __ITER),
    },
    timeout: '5s',
  });

  const allResponses = [...responses, seqRes];
  const seenOrderIds = new Set();

  for (const r of allResponses) {
    if (r.status === 201) {
      const id = r.json('orderId');
      if (id !== undefined && id !== null) {
        seenOrderIds.add(id);
      }
      retry201SameId.add(1);
    } else if (r.status === 409) {
      retry409Conflict.add(1);
    }
  }

  if (seenOrderIds.size > 1) {
    retryDuplicateBug.add(1);
  }

  check(seqRes, {
    'sequential retry returns 201': (r) => r.status === 201,
    'exactly 1 unique orderId per idempotencyKey': () => seenOrderIds.size === 1,
  });

  sleep(1.5);
}

