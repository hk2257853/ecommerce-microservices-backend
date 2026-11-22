import type {
  AgentRunRequest,
  AgentRunResponse,
  AppMode,
  AskRequest,
  AskResponse,
  BridgeTelemetrySnapshot,
  CacheStatsResponse,
  CircuitDeploymentStatus,
  CostSummaryResponse,
  IngestRequest,
  IngestResponse,
  KafkaEvent,
  LLMCallRecord,
  LLMResponse,
  LlamaIndexAskRequest,
  LlamaIndexAskResponse,
  LlamaIndexIngestRequest,
  ModelCostBreakdown,
  OrderCreateRequest,
  OrderItemResponse,
  OrderResponse,
  OrdersCacheStats,
  PageResponse,
  ProductCreateRequest,
  ProductQueryParams,
  ProductResponse,
  ProductSentimentAnalysis,
  ProductUpdateRequest,
  RateLimitInfo,
  RateLimitProbeResult,
  SearchChunkResult,
  SearchResponse,
  SentimentAnalysisResponse,
  SourceMetadata,
  StepExecutionRecord,
  StreamMetrics,
  SystemHealthStatus,
  ThreadClearResponse,
  ThreadHistoryResponse,
  ThreadMessageRecord,
  ToolCallRecord,
  TPMStatusResponse,
  TracingStatusResponse,
  UserCreateRequest,
  UserResponse,
  WorkflowResumeRequest,
  WorkflowRunResponse,
  WorkflowStartRequest,
  WorkflowStateResponse,
  WorkflowTopologyResponse,
} from '../types';

export class BridgeApiError extends Error {
  status: number;
  rateLimit: RateLimitInfo | null;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    rateLimit: RateLimitInfo | null = null,
    details?: unknown
  ) {
    super(message);
    this.name = 'BridgeApiError';
    this.status = status;
    this.rateLimit = rateLimit;
    this.details = details;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// ============================================================================
// Pre-seeded Simulator State
// ============================================================================

interface SimRagChunk {
  id: string;
  document_name: string;
  text_content: string;
  metadata?: Record<string, unknown>;
}

interface SimWorkflowEntry {
  thread_id: string;
  prompt: string;
  customer_id: string;
  status: 'ACTIVE' | 'INTERRUPTED' | 'COMPLETED';
  action_type: string;
  order_id: string | null;
  amount: number | null;
  execution_steps: StepExecutionRecord[];
  pending_approval: WorkflowRunResponse['pending_approval'];
  action_result: Record<string, unknown> | null;
  final_answer: string | null;
  accumulated_tokens: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  accumulated_cost: number;
}

class ControlCenterBridge {
  private mode: AppMode = 'sim';
  private listeners = new Set<(snapshot: BridgeTelemetrySnapshot) => void>();

  // Shared Telemetry
  private lastRateLimit: RateLimitInfo | null = {
    limit: 10,
    remaining: 10,
    resetSeconds: 60,
    allowed: true,
    statusCode: 200,
    timestamp: nowIso(),
  };
  private ordersPulseAt: number | null = null;
  private aiPulseAt: number | null = null;

  // Orders Simulator State
  private simUsers: UserResponse[] = [
    {
      userId: 1,
      name: 'Aarav Sharma',
      email: 'aarav.sharma@nexusops.dev',
      address: '42 Koramangala 4th Block, Bengaluru',
      createdAt: '2026-10-14T09:15:00Z',
    },
    {
      userId: 2,
      name: 'Maya Chen',
      email: 'maya.chen@nexusops.dev',
      address: '718 Market St, San Francisco, CA',
      createdAt: '2026-10-19T14:42:00Z',
    },
    {
      userId: 3,
      name: 'Elena Rostova',
      email: 'elena.rostova@nexusops.dev',
      address: '19 Friedrichstrasse, Berlin',
      createdAt: '2026-11-01T11:20:00Z',
    },
  ];
  private simNextUserId = 4;

  private simProducts: ProductResponse[] = [
    { productId: 1, name: 'Sony WH-1000XM5 Wireless Headphones', unitPrice: 349.99, quantity: 18, inStock: true },
    { productId: 2, name: 'Apple MacBook Pro 14" M4', unitPrice: 1999.0, quantity: 7, inStock: true },
    { productId: 3, name: 'Keychron Q1 Pro Mechanical Keyboard', unitPrice: 199.0, quantity: 24, inStock: true },
    { productId: 4, name: 'Logitech MX Master 3S Mouse', unitPrice: 99.99, quantity: 35, inStock: true },
    { productId: 5, name: 'Dell UltraSharp 27" 4K USB-C Hub', unitPrice: 579.0, quantity: 12, inStock: true },
    { productId: 6, name: 'Samsung 990 PRO 2TB NVMe SSD', unitPrice: 169.99, quantity: 42, inStock: true },
    { productId: 7, name: 'NVIDIA RTX 5080 Founders Edition', unitPrice: 1199.0, quantity: 3, inStock: true },
    { productId: 8, name: 'Bose QuietComfort Ultra Earbuds', unitPrice: 279.0, quantity: 0, inStock: false },
    { productId: 9, name: 'Herman Miller Aeron Ergonomic Chair', unitPrice: 1445.0, quantity: 5, inStock: true },
    { productId: 10, name: 'Anker Prime 250W GaN Charger', unitPrice: 149.99, quantity: 29, inStock: true },
    { productId: 11, name: 'CalDigit TS4 Thunderbolt 4 Dock', unitPrice: 379.99, quantity: 14, inStock: true },
    { productId: 12, name: 'Audio-Technica AT2020USB-X Mic', unitPrice: 149.0, quantity: 16, inStock: true },
  ];
  private simNextProductId = 13;

  private simOrders: OrderResponse[] = [
    { orderId: 1001, userId: 1, totalAmount: 548.99, status: 'CONFIRMED', createdAt: '2026-11-11T16:10:00Z' },
    { orderId: 1002, userId: 2, totalAmount: 1999.0, status: 'SHIPPED', createdAt: '2026-11-11T19:30:00Z' },
    { orderId: 1003, userId: 1, totalAmount: 269.98, status: 'DELIVERED', createdAt: '2026-11-12T08:05:00Z' },
  ];
  private simNextOrderId = 1004;

  private simOrderItems = new Map<number, OrderItemResponse[]>([
    [
      1001,
      [
        { productId: 1, quantity: 1, unitPrice: 349.99, productName: 'Sony WH-1000XM5 Wireless Headphones' },
        { productId: 3, quantity: 1, unitPrice: 199.0, productName: 'Keychron Q1 Pro Mechanical Keyboard' },
      ],
    ],
    [
      1002,
      [{ productId: 2, quantity: 1, unitPrice: 1999.0, productName: 'Apple MacBook Pro 14" M4' }],
    ],
    [
      1003,
      [
        { productId: 4, quantity: 1, unitPrice: 99.99, productName: 'Logitech MX Master 3S Mouse' },
        { productId: 6, quantity: 1, unitPrice: 169.99, productName: 'Samsung 990 PRO 2TB NVMe SSD' },
      ],
    ],
  ]);

  private simIdempotencyCache = new Map<string, OrderResponse>([
    ['ord-seed-1001', this.simOrders[0]],
  ]);

  private simKafkaEvents: KafkaEvent[] = [
    {
      eventId: 'evt-9003',
      topic: 'order-created-events',
      partition: 0,
      offset: 42,
      orderId: 1003,
      userId: 1,
      totalAmount: 269.98,
      createdAt: '2026-11-12T08:05:01Z',
      status: 'CONSUMED',
      notificationSummary: 'Notification Service dispatched confirmation email to aarav.sharma@nexusops.dev',
    },
    {
      eventId: 'evt-9002',
      topic: 'order-created-events',
      partition: 1,
      offset: 41,
      orderId: 1002,
      userId: 2,
      totalAmount: 1999.0,
      createdAt: '2026-11-11T19:30:02Z',
      status: 'CONSUMED',
      notificationSummary: 'Notification Service dispatched confirmation email to maya.chen@nexusops.dev',
    },
    {
      eventId: 'evt-9001',
      topic: 'order-created-events',
      partition: 0,
      offset: 40,
      orderId: 1001,
      userId: 1,
      totalAmount: 548.99,
      createdAt: '2026-11-11T16:10:01Z',
      status: 'CONSUMED',
      notificationSummary: 'Notification Service dispatched confirmation email to aarav.sharma@nexusops.dev',
    },
  ];
  private simKafkaOffset = 43;

  // Fixed-window rate limiter state (10 req / 60s)
  private simRateLimitMax = 10;
  private simRateLimitWindowMs = 60_000;
  private simRateWindowStart = Date.now();
  private simRateWindowCount = 0;

  // Orders Redis cache stats
  private simOrdersCacheStats: OrdersCacheStats = {
    caches: { products: 'Active', orders: 'Active', users: 'Active' },
    hits: 28,
    misses: 4,
    cachedKeys: 6,
    lastClearedAt: null,
  };

  // AI Platform Simulator State
  private simRagChunks: SimRagChunk[] = [
    {
      id: 'rag-1',
      document_name: 'orders-architecture.md',
      text_content:
        'Orders Service enforces a Redis Lua fixed-window rate limiter of 10 requests per 60 seconds per client IP with X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers. Order creation uses Redis SETNX idempotency keys (24h TTL) and publishes OrderCreatedEvent messages to Kafka topic order-created-events.',
    },
    {
      id: 'rag-2',
      document_name: 'ai-gateway-design.md',
      text_content:
        'The LLM Gateway protects upstream models with three resilience layers: an in-memory Semantic Cache (cosine similarity threshold 0.92), a 60-second sliding-window TPM budget limiter, and a FallbackRouter with per-model Circuit Breakers that trip into a 30-second OPEN cooldown upon failures.',
    },
    {
      id: 'rag-3',
      document_name: 'rag-pipeline-spec.md',
      text_content:
        'Our 4-stage Production RAG pipeline executes: (1) LLM Query Expansion into multi-angle paraphrases, (2) Hybrid Retrieval combining ChromaDB dense vector search and sparse BM25 lexical search, (3) Reciprocal Rank Fusion (RRF, k=60), and (4) Cross-Encoder neural reranking.',
    },
    {
      id: 'rag-4',
      document_name: 'return-and-vip-policy.md',
      text_content:
        'Store policy grants a 30-day return window for unopened hardware. Promo code VIP50 unlocks 50% off eligible accessories up to $100. Refunds of $50 or less are auto-approved; refunds above $50, cancellations, and address mutations require manager or admin HITL approval.',
    },
  ];

  private simLlamaChunks: SimRagChunk[] = [
    {
      id: 'llama-1',
      document_name: 'postgres-pgvector-tuning.md',
      text_content:
        'PostgreSQL 16 connection pools use HikariCP with maximum-pool-size=20 for Orders Service, while ChromaDB HNSW cosine indexes use ef_construction=200 and M=16 for sub-25ms dense vector similarity retrieval.',
      metadata: { category: 'database', service: 'storage' },
    },
    {
      id: 'llama-2',
      document_name: 'langgraph-hitl-rbac.md',
      text_content:
        'LangGraph Human-in-the-Loop governance interrupts high-risk mutations before action_executor. RBAC strictly rejects approval attempts from support_agent and requires reviewer_role to be manager or admin.',
      metadata: { category: 'security', service: 'ai-platform' },
    },
    {
      id: 'llama-3',
      document_name: 'kafka-dlq-strategy.md',
      text_content:
        'Kafka Notification Consumer processes OrderCreatedEvent with manual offset commits and exponential backoff retries before routing poison-pill payloads to order-created-events.DLT.',
      metadata: { category: 'messaging', service: 'notification-service' },
    },
  ];

  private simAgentThreads = new Map<string, ThreadHistoryResponse>([
    [
      'thread-ops-alpha',
      {
        thread_id: 'thread-ops-alpha',
        messages: [
          { role: 'human', content: 'Check stock for Sony WH-1000XM5 Wireless Headphones.' },
          {
            role: 'ai',
            content: 'Checking product inventory via MCP tool.',
            tool_calls: [{ name: 'search_product_inventory', args: { query: 'Sony WH-1000XM5' } }],
          },
          {
            role: 'tool',
            name: 'search_product_inventory',
            tool_call_id: 'call_seed_1',
            content: '{"productId":1,"name":"Sony WH-1000XM5 Wireless Headphones","unitPrice":349.99,"quantity":18,"inStock":true}',
          },
          {
            role: 'ai',
            content: 'Sony WH-1000XM5 Wireless Headphones are currently **in stock** with **18 units** available at **$349.99**.',
          },
        ],
        total_messages: 4,
        accumulated_tokens: { prompt_tokens: 412, completion_tokens: 138, total_tokens: 550 },
        accumulated_cost: 0.00044,
      },
    ],
  ]);

  private simWorkflows = new Map<string, SimWorkflowEntry>();

  // AI Gateway & Telemetry Sim State
  private simSemanticCache = new Map<string, { answer: string; tokens: number; cost: number }>();
  private simCacheHits = 4;
  private simCacheMisses = 9;
  private simCacheSavedTokens = 2140;
  private simCacheSavedCost = 0.00171;

  private simTpmMax = 250_000;
  private simTpmEntries: { ts: number; tokens: number }[] = [
    { ts: Date.now() - 18_000, tokens: 1240 },
    { ts: Date.now() - 9_000, tokens: 890 },
  ];

  private simCircuits: { model: string; role: string; cooldownUntil: number; failCount: number }[] = [
    { model: 'gemini/gemini-2.5-flash', role: 'primary', cooldownUntil: 0, failCount: 0 },
    { model: 'groq/llama-3.3-70b-versatile', role: 'fallback-1', cooldownUntil: 0, failCount: 0 },
    { model: 'openai/gpt-4o-mini', role: 'fallback-2', cooldownUntil: 0, failCount: 0 },
  ];

  private simCallHistory: LLMCallRecord[] = [
    {
      call_id: 'call-901a',
      timestamp: new Date(Date.now() - 180_000).toISOString(),
      action_name: 'rag_ask',
      model: 'gemini/gemini-2.5-flash',
      stream: false,
      prompt_tokens: 680,
      completion_tokens: 215,
      total_tokens: 895,
      cost_usd: 0.00072,
      latency_ms: 482,
      ttft_ms: null,
      status: 'success',
      error_message: null,
    },
    {
      call_id: 'call-902b',
      timestamp: new Date(Date.now() - 120_000).toISOString(),
      action_name: 'stream_chat',
      model: 'gemini/gemini-2.5-flash',
      stream: true,
      prompt_tokens: 210,
      completion_tokens: 340,
      total_tokens: 550,
      cost_usd: 0.00044,
      latency_ms: 910,
      ttft_ms: 142,
      status: 'success',
      error_message: null,
    },
    {
      call_id: 'call-903c',
      timestamp: new Date(Date.now() - 75_000).toISOString(),
      action_name: 'agent_reasoning',
      model: 'gemini/gemini-2.5-flash',
      stream: false,
      prompt_tokens: 510,
      completion_tokens: 185,
      total_tokens: 695,
      cost_usd: 0.00056,
      latency_ms: 615,
      ttft_ms: null,
      status: 'success',
      error_message: null,
    },
    {
      call_id: 'call-904d',
      timestamp: new Date(Date.now() - 40_000).toISOString(),
      action_name: 'sentiment_analysis',
      model: 'groq/llama-3.3-70b-versatile',
      stream: false,
      prompt_tokens: 195,
      completion_tokens: 92,
      total_tokens: 287,
      cost_usd: 0.00023,
      latency_ms: 294,
      ttft_ms: null,
      status: 'success',
      error_message: null,
    },
  ];
  private simTrackingSince = new Date(Date.now() - 3600_000).toISOString();

  // ============================================================================
  // Mode & Telemetry Subscription
  // ============================================================================

  getMode(): AppMode {
    return this.mode;
  }

  setMode(nextMode: AppMode): void {
    this.mode = nextMode;
    this.notify();
  }

  subscribe(listener: (snapshot: BridgeTelemetrySnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getTelemetrySnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getTelemetrySnapshot(): BridgeTelemetrySnapshot {
    const totalCostUsd = this.simCallHistory.reduce((sum, r) => sum + r.cost_usd, 0);
    return {
      mode: this.mode,
      lastRateLimit: this.lastRateLimit,
      ordersPulseAt: this.ordersPulseAt,
      aiPulseAt: this.aiPulseAt,
      kafkaEventCount: this.simKafkaEvents.length,
      totalAiCalls: this.simCallHistory.length,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
    };
  }

  private notify(): void {
    const snapshot = this.getTelemetrySnapshot();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  private pulse(stack: 'orders' | 'ai'): void {
    if (stack === 'orders') {
      this.ordersPulseAt = Date.now();
    } else {
      this.aiPulseAt = Date.now();
    }
    this.notify();
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async checkHealth(): Promise<SystemHealthStatus> {
    if (this.mode === 'sim') {
      await delay(90);
      return {
        ordersHealthy: true,
        aiHealthy: true,
        ordersLatencyMs: 14,
        aiLatencyMs: 19,
        lastCheckedAt: nowIso(),
      };
    }

    const t0 = performance.now();
    let ordersHealthy = false;
    let ordersLatencyMs: number | null = null;
    try {
      const res = await fetch('/orders-api/api/cache/stats');
      ordersLatencyMs = Math.round(performance.now() - t0);
      ordersHealthy = res.ok;
    } catch {
      ordersHealthy = false;
    }

    const t1 = performance.now();
    let aiHealthy = false;
    let aiLatencyMs: number | null = null;
    try {
      const res = await fetch('/ai-api/api/v1/health');
      aiLatencyMs = Math.round(performance.now() - t1);
      aiHealthy = res.ok;
    } catch {
      aiHealthy = false;
    }

    return {
      ordersHealthy,
      aiHealthy,
      ordersLatencyMs,
      aiLatencyMs,
      lastCheckedAt: nowIso(),
    };
  }

  // ============================================================================
  // Live HTTP Helpers
  // ============================================================================

  private extractRateLimitHeaders(headers: Headers, statusCode: number): RateLimitInfo | null {
    const limitHeader = headers.get('X-RateLimit-Limit');
    const remainingHeader = headers.get('X-RateLimit-Remaining');
    const resetHeader = headers.get('X-RateLimit-Reset');

    if (limitHeader === null && remainingHeader === null && resetHeader === null) {
      return null;
    }

    return {
      limit: Number(limitHeader ?? 10),
      remaining: Number(remainingHeader ?? 0),
      resetSeconds: Number(resetHeader ?? 60),
      allowed: statusCode !== 429,
      statusCode,
      timestamp: nowIso(),
    };
  }

  private async ordersFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/orders-api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const rl = this.extractRateLimitHeaders(res.headers, res.status);
    if (rl) {
      this.lastRateLimit = rl;
    }
    this.pulse('orders');

    if (!res.ok) {
      let errMsg = `Orders API error (${res.status})`;
      let payload: unknown;
      try {
        payload = await res.json();
        if (payload && typeof payload === 'object' && 'message' in payload) {
          errMsg = String((payload as { message: unknown }).message);
        }
      } catch {
        errMsg = (await res.text().catch(() => '')) || errMsg;
      }
      throw new BridgeApiError(errMsg, res.status, rl, payload);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  private async aiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/ai-api/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    this.pulse('ai');

    if (!res.ok) {
      let errMsg = `AI API error (${res.status})`;
      let payload: unknown;
      try {
        payload = await res.json();
        if (payload && typeof payload === 'object' && 'detail' in payload) {
          errMsg = String((payload as { detail: unknown }).detail);
        }
      } catch {
        errMsg = (await res.text().catch(() => '')) || errMsg;
      }
      throw new BridgeApiError(errMsg, res.status, null, payload);
    }

    return (await res.json()) as T;
  }

  // ============================================================================
  // Simulator Rate Limit & Gateway Internals
  // ============================================================================

  private consumeSimOrderRateLimit(): RateLimitInfo {
    const now = Date.now();
    if (now - this.simRateWindowStart >= this.simRateLimitWindowMs) {
      this.simRateWindowStart = now;
      this.simRateWindowCount = 0;
    }
    this.simRateWindowCount += 1;
    const allowed = this.simRateWindowCount <= this.simRateLimitMax;
    const remaining = Math.max(0, this.simRateLimitMax - this.simRateWindowCount);
    const resetSeconds = Math.max(
      1,
      Math.ceil((this.simRateWindowStart + this.simRateLimitWindowMs - now) / 1000)
    );
    const info: RateLimitInfo = {
      limit: this.simRateLimitMax,
      remaining,
      resetSeconds,
      allowed,
      statusCode: allowed ? 200 : 429,
      timestamp: nowIso(),
    };
    this.lastRateLimit = info;
    this.pulse('orders');
    return info;
  }

  private assertSimOrderRateLimit(): RateLimitInfo {
    const info = this.consumeSimOrderRateLimit();
    if (!info.allowed) {
      throw new BridgeApiError('Rate limit exceeded. Try again later.', 429, info);
    }
    return info;
  }

  private pickActiveSimModel(): string {
    const now = Date.now();
    const available = this.simCircuits.find((c) => c.cooldownUntil <= now);
    if (!available) {
      throw new BridgeApiError(
        'All configured LLM providers in fallback router are unavailable or in cooldown.',
        503
      );
    }
    return available.model;
  }

  private recordSimTpmAndCost(
    actionName: string,
    promptTokens: number,
    completionTokens: number,
    latencyMs: number,
    options?: { stream?: boolean; ttftMs?: number | null; modelOverride?: string }
  ): { model: string; totalTokens: number; cost: number } {
    const now = Date.now();
    this.simTpmEntries = this.simTpmEntries.filter((e) => now - e.ts < 60_000);
    const currentTokens = this.simTpmEntries.reduce((s, e) => s + e.tokens, 0);
    const totalTokens = promptTokens + completionTokens;

    if (currentTokens + totalTokens > this.simTpmMax) {
      throw new BridgeApiError('Token-Per-Minute limit exceeded. Please retry later.', 429);
    }

    const model = options?.modelOverride ?? this.pickActiveSimModel();
    this.simTpmEntries.push({ ts: now, tokens: totalTokens });

    const cost = Number(((promptTokens * 0.0000004) + (completionTokens * 0.0000012)).toFixed(6));
    this.simCallHistory.unshift({
      call_id: `call-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: nowIso(),
      action_name: actionName,
      model,
      stream: Boolean(options?.stream),
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
      latency_ms: Math.round(latencyMs),
      ttft_ms: options?.ttftMs ?? null,
      status: 'success',
      error_message: null,
    });
    if (this.simCallHistory.length > 100) {
      this.simCallHistory.pop();
    }
    this.pulse('ai');
    return { model, totalTokens, cost };
  }

  // ============================================================================
  // Orders Service API
  // ============================================================================

  readonly orders = {
    getLastRateLimit: (): RateLimitInfo | null => this.lastRateLimit,

    resetSimRateLimit: (): void => {
      this.simRateWindowStart = Date.now();
      this.simRateWindowCount = 0;
      this.lastRateLimit = {
        limit: this.simRateLimitMax,
        remaining: this.simRateLimitMax,
        resetSeconds: 60,
        allowed: true,
        statusCode: 200,
        timestamp: nowIso(),
      };
      this.notify();
    },

    getUsers: async (): Promise<UserResponse[]> => {
      if (this.mode === 'live') {
        return this.ordersFetch<UserResponse[]>('/api/users');
      }
      await delay(140);
      this.assertSimOrderRateLimit();
      return [...this.simUsers];
    },

    createUser: async (req: UserCreateRequest): Promise<UserResponse> => {
      if (this.mode === 'live') {
        return this.ordersFetch<UserResponse>('/api/users', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      await delay(180);
      this.assertSimOrderRateLimit();
      if (this.simUsers.some((u) => u.email.toLowerCase() === req.email.toLowerCase())) {
        throw new BridgeApiError(`User with email '${req.email}' already exists`, 409);
      }
      const created: UserResponse = {
        userId: this.simNextUserId++,
        name: req.name.trim(),
        email: req.email.trim(),
        address: req.address.trim(),
        createdAt: nowIso(),
      };
      this.simUsers.push(created);
      return created;
    },

    getProducts: async (params: ProductQueryParams = {}): Promise<PageResponse<ProductResponse>> => {
      if (this.mode === 'live') {
        const qs = new URLSearchParams();
        if (params.page !== undefined) qs.set('page', String(params.page));
        if (params.size !== undefined) qs.set('size', String(params.size));
        if (params.sortBy) qs.set('sortBy', params.sortBy);
        if (params.sortDir) qs.set('sortDir', params.sortDir);
        if (params.name) qs.set('name', params.name);
        if (params.minPrice !== undefined) qs.set('minPrice', String(params.minPrice));
        if (params.maxPrice !== undefined) qs.set('maxPrice', String(params.maxPrice));
        return this.ordersFetch<PageResponse<ProductResponse>>(`/api/products?${qs.toString()}`);
      }
      await delay(120);
      this.assertSimOrderRateLimit();
      const page = params.page ?? 0;
      const size = params.size ?? 8;
      const sortBy = params.sortBy ?? 'id';
      const sortDir = params.sortDir ?? 'asc';

      let list = [...this.simProducts];
      if (params.name && params.name.trim()) {
        const q = params.name.trim().toLowerCase();
        list = list.filter((p) => p.name.toLowerCase().includes(q));
      }
      if (params.minPrice !== undefined && !Number.isNaN(params.minPrice)) {
        list = list.filter((p) => p.unitPrice >= params.minPrice!);
      }
      if (params.maxPrice !== undefined && !Number.isNaN(params.maxPrice)) {
        list = list.filter((p) => p.unitPrice <= params.maxPrice!);
      }

      list.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortBy === 'unitPrice') cmp = a.unitPrice - b.unitPrice;
        else if (sortBy === 'quantity') cmp = a.quantity - b.quantity;
        else cmp = a.productId - b.productId;
        return sortDir === 'desc' ? -cmp : cmp;
      });

      this.simOrdersCacheStats.hits += 1;
      const totalElements = list.length;
      const totalPages = Math.max(1, Math.ceil(totalElements / size));
      const start = page * size;
      const content = list.slice(start, start + size);

      return {
        content,
        currentPage: page,
        pageSize: size,
        totalElements,
        totalPages,
        first: page === 0,
        last: page >= totalPages - 1,
        empty: content.length === 0,
      };
    },

    getAllProducts: async (): Promise<ProductResponse[]> => {
      if (this.mode === 'live') {
        return this.ordersFetch<ProductResponse[]>('/api/products/all');
      }
      await delay(100);
      this.assertSimOrderRateLimit();
      return [...this.simProducts];
    },

    createProduct: async (req: ProductCreateRequest): Promise<ProductResponse> => {
      if (this.mode === 'live') {
        return this.ordersFetch<ProductResponse>('/api/products', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      await delay(160);
      this.assertSimOrderRateLimit();
      if (this.simProducts.some((p) => p.name.toLowerCase() === req.name.trim().toLowerCase())) {
        throw new BridgeApiError(`Product '${req.name}' already exists`, 409);
      }
      const created: ProductResponse = {
        productId: this.simNextProductId++,
        name: req.name.trim(),
        unitPrice: Number(req.unitPrice),
        quantity: Number(req.quantity),
        inStock: Number(req.quantity) > 0,
      };
      this.simProducts.unshift(created);
      this.simOrdersCacheStats.cachedKeys += 1;
      return created;
    },

    updateProduct: async (id: number, req: ProductUpdateRequest): Promise<ProductResponse> => {
      if (this.mode === 'live') {
        return this.ordersFetch<ProductResponse>(`/api/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify(req),
        });
      }
      await delay(150);
      this.assertSimOrderRateLimit();
      const idx = this.simProducts.findIndex((p) => p.productId === id);
      if (idx === -1) {
        throw new BridgeApiError(`Product ${id} not found`, 404);
      }
      const updated: ProductResponse = {
        productId: id,
        name: req.name.trim(),
        unitPrice: Number(req.unitPrice),
        quantity: Number(req.quantity),
        inStock: Number(req.quantity) > 0,
      };
      this.simProducts[idx] = updated;
      return updated;
    },

    deleteProduct: async (id: number): Promise<void> => {
      if (this.mode === 'live') {
        await this.ordersFetch<void>(`/api/products/${id}`, { method: 'DELETE' });
        return;
      }
      await delay(140);
      this.assertSimOrderRateLimit();
      const idx = this.simProducts.findIndex((p) => p.productId === id);
      if (idx === -1) {
        throw new BridgeApiError(`Product ${id} not found`, 404);
      }
      this.simProducts.splice(idx, 1);
    },

    createOrder: async (req: OrderCreateRequest): Promise<OrderResponse> => {
      if (this.mode === 'live') {
        const order = await this.ordersFetch<OrderResponse>('/api/orders', {
          method: 'POST',
          body: JSON.stringify(req),
        });
        // Mirror into Kafka feed display if not already captured
        if (!this.simKafkaEvents.some((e) => e.orderId === order.orderId)) {
          this.simKafkaEvents.unshift({
            eventId: uid('evt'),
            topic: 'order-created-events',
            partition: order.orderId % 2,
            offset: this.simKafkaOffset++,
            orderId: order.orderId,
            userId: order.userId,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            status: 'PUBLISHED',
            notificationSummary: `Live OrderCreatedEvent emitted for Order #${order.orderId}`,
          });
          this.notify();
        }
        return order;
      }

      await delay(220);
      this.assertSimOrderRateLimit();

      // Idempotency replay check (matches Redis SETNX + cached response in OrderService.java)
      const cached = this.simIdempotencyCache.get(req.idempotencyKey);
      if (cached) {
        return { ...cached, idempotentReplay: true };
      }

      const user = this.simUsers.find((u) => u.userId === req.userId);
      if (!user) {
        throw new BridgeApiError(`User ${req.userId} not found`, 404);
      }

      let totalAmount = 0;
      const itemsToSave: OrderItemResponse[] = [];
      for (const item of req.items) {
        const prod = this.simProducts.find((p) => p.productId === item.productId);
        if (!prod) {
          throw new BridgeApiError(`Product ${item.productId} not found`, 404);
        }
        if (prod.quantity < item.quantity) {
          throw new BridgeApiError(
            `Insufficient stock for ${prod.name}: requested ${item.quantity}, available ${prod.quantity}`,
            400
          );
        }
        totalAmount += prod.unitPrice * item.quantity;
        itemsToSave.push({
          productId: prod.productId,
          quantity: item.quantity,
          unitPrice: prod.unitPrice,
          productName: prod.name,
        });
      }

      // Deduct stock
      for (const item of req.items) {
        const prod = this.simProducts.find((p) => p.productId === item.productId)!;
        prod.quantity -= item.quantity;
        prod.inStock = prod.quantity > 0;
      }

      const order: OrderResponse = {
        orderId: this.simNextOrderId++,
        userId: req.userId,
        totalAmount: Number(totalAmount.toFixed(2)),
        status: 'CONFIRMED',
        createdAt: nowIso(),
        idempotentReplay: false,
      };
      this.simOrders.unshift(order);
      this.simOrderItems.set(order.orderId, itemsToSave);
      this.simIdempotencyCache.set(req.idempotencyKey, order);

      // Publish Kafka OrderCreatedEvent
      const kafkaEvt: KafkaEvent = {
        eventId: uid('evt'),
        topic: 'order-created-events',
        partition: order.orderId % 2,
        offset: this.simKafkaOffset++,
        orderId: order.orderId,
        userId: user.userId,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        status: 'PUBLISHED',
        notificationSummary: `Kafka OrderCreatedEvent queued for ${user.email}`,
      };
      this.simKafkaEvents.unshift(kafkaEvt);
      setTimeout(() => {
        kafkaEvt.status = 'CONSUMED';
        kafkaEvt.notificationSummary = `Notification Service sent receipt email to ${user.email} ($${order.totalAmount.toFixed(2)})`;
        this.notify();
      }, 900);

      this.notify();
      return order;
    },

    getOrdersByUser: async (userId: number): Promise<OrderResponse[]> => {
      if (this.mode === 'live') {
        return this.ordersFetch<OrderResponse[]>(`/api/orders?userId=${userId}`);
      }
      await delay(110);
      this.assertSimOrderRateLimit();
      return this.simOrders.filter((o) => o.userId === userId);
    },

    getOrderItems: async (orderId: number): Promise<OrderItemResponse[]> => {
      if (this.mode === 'live') {
        return this.ordersFetch<OrderItemResponse[]>(`/api/orders/${orderId}/items`);
      }
      await delay(90);
      this.assertSimOrderRateLimit();
      return this.simOrderItems.get(orderId) ?? [];
    },

    getCacheStats: async (): Promise<OrdersCacheStats> => {
      if (this.mode === 'live') {
        const raw = await this.ordersFetch<Record<string, string>>('/api/cache/stats');
        return {
          caches: raw,
          hits: this.simOrdersCacheStats.hits,
          misses: this.simOrdersCacheStats.misses,
          cachedKeys: Object.keys(raw).length,
          lastClearedAt: this.simOrdersCacheStats.lastClearedAt,
        };
      }
      await delay(80);
      return { ...this.simOrdersCacheStats };
    },

    clearProductsCache: async (): Promise<{ message: string }> => {
      if (this.mode === 'live') {
        const msg = await this.ordersFetch<string>('/api/cache/clear/products', { method: 'DELETE' });
        return { message: typeof msg === 'string' ? msg : 'Products cache cleared' };
      }
      await delay(140);
      this.simOrdersCacheStats = {
        ...this.simOrdersCacheStats,
        cachedKeys: 0,
        lastClearedAt: nowIso(),
      };
      return { message: 'Products cache cleared in Redis (products::*)' };
    },

    probeRateLimit: async (count = 1): Promise<RateLimitProbeResult[]> => {
      const results: RateLimitProbeResult[] = [];
      for (let i = 0; i < count; i++) {
        const t0 = performance.now();
        if (this.mode === 'live') {
          try {
            const res = await fetch('/orders-api/api/products?page=0&size=1');
            const latencyMs = Math.round(performance.now() - t0);
            const rl = this.extractRateLimitHeaders(res.headers, res.status) ?? {
              limit: 10,
              remaining: res.ok ? 9 : 0,
              resetSeconds: 60,
              allowed: res.ok,
              statusCode: res.status,
              timestamp: nowIso(),
            };
            this.lastRateLimit = rl;
            this.pulse('orders');
            results.push({
              requestNumber: i + 1,
              status: res.status,
              ok: res.ok,
              latencyMs,
              message: res.ok ? '200 OK — Request allowed' : `${res.status} Too Many Requests — Fixed window exhausted`,
              rateLimit: rl,
            });
          } catch (err) {
            const latencyMs = Math.round(performance.now() - t0);
            const rl: RateLimitInfo = {
              limit: 10,
              remaining: 0,
              resetSeconds: 60,
              allowed: false,
              statusCode: 503,
              timestamp: nowIso(),
            };
            results.push({
              requestNumber: i + 1,
              status: 503,
              ok: false,
              latencyMs,
              message: err instanceof Error ? err.message : 'Service unreachable',
              rateLimit: rl,
            });
          }
        } else {
          await delay(45);
          const rl = this.consumeSimOrderRateLimit();
          const latencyMs = Math.round(performance.now() - t0);
          results.push({
            requestNumber: i + 1,
            status: rl.statusCode,
            ok: rl.allowed,
            latencyMs,
            message: rl.allowed
              ? `200 OK — Redis INCR allowed (${rl.remaining}/${rl.limit} left)`
              : `429 Too Many Requests — Window reset in ${rl.resetSeconds}s`,
            rateLimit: rl,
          });
        }
      }
      return results;
    },

    getKafkaEvents: async (): Promise<KafkaEvent[]> => {
      await delay(50);
      return [...this.simKafkaEvents];
    },
  };

  // ============================================================================
  // AI Service Platform API
  // ============================================================================

  readonly ai = {
    health: async (): Promise<{ status: string }> => {
      if (this.mode === 'live') {
        return this.aiFetch<{ status: string }>('/health');
      }
      await delay(60);
      return { status: 'healthy' };
    },

    chat: async (prompt: string): Promise<LLMResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<LLMResponse>('/chat', {
          method: 'POST',
          body: JSON.stringify({ prompt }),
        });
      }
      const t0 = performance.now();
      await delay(320);

      const normalized = prompt.trim().toLowerCase();
      const cached = this.simSemanticCache.get(normalized);
      if (cached) {
        this.simCacheHits += 1;
        this.simCacheSavedTokens += cached.tokens;
        this.simCacheSavedCost = Number((this.simCacheSavedCost + cached.cost).toFixed(6));
        this.pulse('ai');
        return {
          content: `[Semantic Cache HIT · 0ms upstream LLM]\n\n${cached.answer}`,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost: 0,
        };
      }

      this.simCacheMisses += 1;
      const answer = this.generateSimChatReply(prompt);
      const promptTokens = Math.max(24, Math.round(prompt.length / 3.5));
      const completionTokens = Math.max(48, Math.round(answer.length / 3.8));
      const { cost, totalTokens } = this.recordSimTpmAndCost(
        'generate_text',
        promptTokens,
        completionTokens,
        performance.now() - t0
      );
      this.simSemanticCache.set(normalized, { answer, tokens: totalTokens, cost });

      return {
        content: answer,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost,
      };
    },

    streamChat: async (
      prompt: string,
      handlers: {
        onToken: (chunk: string) => void;
        onMetrics?: (metrics: StreamMetrics) => void;
        onError?: (err: string) => void;
        signal?: AbortSignal;
      }
    ): Promise<void> => {
      if (this.mode === 'live') {
        try {
          const res = await fetch('/ai-api/api/v1/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
            signal: handlers.signal,
          });
          this.pulse('ai');
          if (!res.ok || !res.body) {
            throw new Error(`Stream request failed (${res.status})`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = 'message';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line === '') {
                currentEvent = 'message';
                continue;
              }
              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const payload = line.slice(5).replace(/^ /, '');
                if (currentEvent === 'metrics') {
                  try {
                    const parsed = JSON.parse(payload) as StreamMetrics;
                    handlers.onMetrics?.(parsed);
                  } catch {
                    // ignore malformed metrics frame
                  }
                } else if (currentEvent === 'error') {
                  handlers.onError?.(payload);
                } else {
                  handlers.onToken(payload);
                }
              }
            }
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
          handlers.onError?.(err instanceof Error ? err.message : 'Streaming failed');
        }
        return;
      }

      // Simulator SSE stream
      const t0 = performance.now();
      let ttftMs: number | null = null;
      const fullText = this.generateSimChatReply(prompt);
      const tokens = fullText.split(/(\s+)/);
      let chunkCount = 0;

      await delay(145);
      for (const tok of tokens) {
        if (handlers.signal?.aborted) return;
        if (ttftMs === null) {
          ttftMs = Math.round(performance.now() - t0);
        }
        handlers.onToken(tok);
        chunkCount += 1;
        await delay(24);
      }

      const totalDurationMs = Math.round(performance.now() - t0);
      const promptTokens = Math.max(24, Math.round(prompt.length / 3.5));
      const completionTokens = Math.max(48, Math.round(fullText.length / 3.8));
      const { totalTokens, cost } = this.recordSimTpmAndCost(
        'stream_text',
        promptTokens,
        completionTokens,
        totalDurationMs,
        { stream: true, ttftMs }
      );

      handlers.onMetrics?.({
        ttft_ms: ttftMs,
        total_duration_ms: totalDurationMs,
        total_chunks: chunkCount,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost_usd: cost,
      });
    },

    analyzeSentiment: async (feedback: string): Promise<SentimentAnalysisResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<SentimentAnalysisResponse>('/sentiment', {
          method: 'POST',
          body: JSON.stringify({ feedback }),
        });
      }
      const t0 = performance.now();
      await delay(260);
      const lower = feedback.toLowerCase();

      const negativeWords = ['refund', 'broken', 'defective', 'terrible', 'stopped', 'cracked', 'worst', 'return', 'disappointed', 'dead'];
      const positiveWords = ['love', 'amazing', 'excellent', 'great', 'fast', 'superb', 'best', 'crisp', 'comfortable', 'solid'];

      const negHits = negativeWords.filter((w) => lower.includes(w)).length;
      const posHits = positiveWords.filter((w) => lower.includes(w)).length;

      let product_name = 'Hardware Accessory';
      if (lower.includes('sony') || lower.includes('headphone') || lower.includes('xm5')) product_name = 'Sony WH-1000XM5 Wireless Headphones';
      else if (lower.includes('macbook') || lower.includes('laptop')) product_name = 'Apple MacBook Pro 14" M4';
      else if (lower.includes('keychron') || lower.includes('keyboard')) product_name = 'Keychron Q1 Pro Mechanical Keyboard';
      else if (lower.includes('mouse') || lower.includes('logitech')) product_name = 'Logitech MX Master 3S Mouse';
      else if (lower.includes('monitor') || lower.includes('dell')) product_name = 'Dell UltraSharp 27" 4K USB-C Hub';

      const requires_refund = lower.includes('refund') || lower.includes('money back') || (negHits >= 2);
      let analysis: ProductSentimentAnalysis;

      if (negHits > posHits) {
        analysis = {
          product_name,
          sentiment: 'Negative',
          rating: requires_refund ? 1 : 2,
          pros: posHits > 0 ? ['Initial packaging looked clean'] : ['Fast initial shipping'],
          cons: [
            lower.includes('anc') || lower.includes('battery') ? 'Hardware failure / degraded battery performance' : 'Quality control defect reported',
            requires_refund ? 'Customer explicitly requesting immediate refund' : 'Product failed expectations',
          ],
          requires_refund,
        };
      } else if (posHits > negHits) {
        analysis = {
          product_name,
          sentiment: 'Positive',
          rating: 5,
          pros: ['Responsive build quality', 'Meets latency & battery benchmarks', 'Seamless USB-C / wireless pairing'],
          cons: negHits > 0 ? ['Minor premium pricing'] : [],
          requires_refund: false,
        };
      } else {
        analysis = {
          product_name,
          sentiment: 'Neutral',
          rating: 3,
          pros: ['Acceptable everyday performance'],
          cons: ['Mixed ergonomics or value-for-money concerns'],
          requires_refund: false,
        };
      }

      const promptTokens = 96;
      const completionTokens = 84;
      const { totalTokens, cost } = this.recordSimTpmAndCost(
        'sentiment_analysis',
        promptTokens,
        completionTokens,
        performance.now() - t0
      );

      return {
        analysis,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost,
      };
    },

    ingestRag: async (req: IngestRequest): Promise<IngestResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<IngestResponse>('/ingest', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      await delay(240);
      const sentences = req.content
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const chunkSize = req.method === 'semantic' ? 2 : 1;
      let count = 0;
      for (let i = 0; i < sentences.length; i += chunkSize) {
        const text = sentences.slice(i, i + chunkSize).join(' ');
        if (text.length < 4) continue;
        this.simRagChunks.unshift({
          id: uid('rag'),
          document_name: req.document_name,
          text_content: text,
        });
        count += 1;
      }
      if (count === 0) {
        this.simRagChunks.unshift({
          id: uid('rag'),
          document_name: req.document_name,
          text_content: req.content,
        });
        count = 1;
      }
      this.pulse('ai');
      return {
        document_name: req.document_name,
        chunk_count: count,
        method_used: req.method,
      };
    },

    searchRag: async (req: AskRequest): Promise<SearchResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<SearchResponse>('/search', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      await delay(220);
      return this.runSimRagSearch(req);
    },

    askRag: async (req: AskRequest): Promise<AskResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<AskResponse>('/ask', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      const t0 = performance.now();
      await delay(320);
      const search = this.runSimRagSearch(req);
      const top = search.chunks[0];
      const answer = top
        ? `Based on **${search.chunks.map((c) => c.document_name).join(', ')}**: ${top.text_content}${
            search.chunks[1] ? `\n\nAdditionally (${search.chunks[1].document_name}): ${search.chunks[1].text_content}` : ''
          }`
        : 'No matching context chunks were found in the vector store.';

      const sources: SourceMetadata[] = search.chunks.map((c) => ({
        document_name: c.document_name,
        snippet: c.snippet,
        distance: c.distance ?? 0.25,
        rrf_score: c.rrf_score,
        rerank_score: c.rerank_score,
      }));

      const promptTokens = 420;
      const completionTokens = 145;
      const { totalTokens, cost } = this.recordSimTpmAndCost(
        'rag_ask',
        promptTokens,
        completionTokens,
        performance.now() - t0
      );

      return {
        answer,
        sources,
        expanded_queries: req.use_query_expansion ? search.expanded_queries : null,
        retrieval_method: `${req.use_hybrid !== false ? 'Hybrid (Dense + BM25 RRF)' : 'Dense Vector'}${
          req.use_reranker !== false ? ' + Cross-Encoder Rerank' : ''
        }`,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost,
      };
    },

    ingestLlamaIndex: async (req: LlamaIndexIngestRequest): Promise<IngestResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<IngestResponse>('/llamaindex/ingest', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      await delay(220);
      this.simLlamaChunks.unshift({
        id: uid('llama'),
        document_name: req.document_name,
        text_content: req.content,
        metadata: req.metadata ?? {},
      });
      this.pulse('ai');
      return {
        document_name: req.document_name,
        chunk_count: 1,
        method_used: 'llamaindex_sentence_splitter',
      };
    },

    askLlamaIndex: async (req: LlamaIndexAskRequest): Promise<LlamaIndexAskResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<LlamaIndexAskResponse>('/llamaindex/ask', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      const t0 = performance.now();
      await delay(260);
      const filters = req.filters ?? {};
      const filterEntries = Object.entries(filters);
      const matched = this.simLlamaChunks.filter((c) =>
        filterEntries.every(([k, v]) => c.metadata && String(c.metadata[k]) === String(v))
      );
      const limited = matched.slice(0, req.limit ?? 3);
      const sources: SourceMetadata[] = limited.map((c, idx) => ({
        document_name: c.document_name,
        snippet: c.text_content.slice(0, 150) + (c.text_content.length > 150 ? '...' : ''),
        distance: Number((0.14 + idx * 0.08).toFixed(3)),
        rrf_score: null,
        rerank_score: null,
      }));
      const answer =
        limited.length > 0
          ? `[LlamaIndex Metadata Filter: ${JSON.stringify(filters)}]\n\n${limited.map((c) => `• **${c.document_name}**: ${c.text_content}`).join('\n')}`
          : `No LlamaIndex nodes matched metadata filter ${JSON.stringify(filters)}.`;

      const promptTokens = 310;
      const completionTokens = 110;
      const { totalTokens, cost } = this.recordSimTpmAndCost(
        'llamaindex_ask',
        promptTokens,
        completionTokens,
        performance.now() - t0
      );

      return {
        answer,
        sources,
        filters_applied: filterEntries.length ? filters : null,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost,
      };
    },

    runAgent: async (req: AgentRunRequest): Promise<AgentRunResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<AgentRunResponse>('/agent/run', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      const t0 = performance.now();
      await delay(380);
      const threadId = req.thread_id?.trim() || `thread-${Math.random().toString(36).slice(2, 7)}`;
      const lower = req.prompt.toLowerCase();
      const toolCalls: ToolCallRecord[] = [];
      const answerParts: string[] = [];

      if (lower.includes('ord-') || lower.includes('order') || lower.includes('vip50')) {
        const orderMatch = req.prompt.match(/ORD-(\d+)/i);
        const orderNum = orderMatch ? Number(orderMatch[1]) : 1001;
        const foundOrder = this.simOrders.find((o) => o.orderId === orderNum) ?? this.simOrders[0];
        toolCalls.push({
          tool_name: 'lookup_order',
          tool_args: { order_id: `ORD-${foundOrder.orderId}` },
          tool_output: foundOrder,
          status: 'success',
        });
        answerParts.push(
          `Order **ORD-${foundOrder.orderId}** (User #${foundOrder.userId}) is **${foundOrder.status}** with original total **$${foundOrder.totalAmount.toFixed(2)}**.`
        );

        if (lower.includes('vip50') || lower.includes('discount')) {
          const discount = Math.min(100, Number((foundOrder.totalAmount * 0.5).toFixed(2)));
          const newTotal = Number((foundOrder.totalAmount - discount).toFixed(2));
          toolCalls.push({
            tool_name: 'apply_promo_code',
            tool_args: { order_id: `ORD-${foundOrder.orderId}`, promo_code: 'VIP50' },
            tool_output: { applied: true, discount_usd: discount, adjusted_total_usd: newTotal },
            status: 'success',
          });
          answerParts.push(
            `Applied **VIP50** (50% capped at $100): saved **$${discount.toFixed(2)}**, bringing the adjusted total to **$${newTotal.toFixed(2)}**.`
          );
        }
      }

      if (lower.includes('health') || lower.includes('microservice') || lower.includes('service')) {
        toolCalls.push({
          tool_name: 'check_service_health',
          tool_args: { targets: ['orders-service:8080', 'ai-platform:8000', 'kafka-broker:9092', 'redis:6379'] },
          tool_output: { orders_service: 'UP', ai_platform: 'UP', kafka: 'UP', redis: 'UP' },
          status: 'success',
        });
        answerParts.push('All core microservices (`orders-service`, `ai-platform`, `kafka`, `redis`) reported **UP / Healthy**.');
      }

      if (lower.includes('sony') || lower.includes('headphone') || lower.includes('stock') || lower.includes('inventory')) {
        const sony = this.simProducts[0];
        toolCalls.push({
          tool_name: 'search_product_inventory',
          tool_args: { query: 'Sony WH-1000XM5' },
          tool_output: sony,
          status: 'success',
        });
        answerParts.push(
          `Inventory check: **${sony.name}** has **${sony.quantity} units** in stock at **$${sony.unitPrice.toFixed(2)}**.`
        );
      }

      if (toolCalls.length === 0) {
        toolCalls.push({
          tool_name: 'search_knowledge_base',
          tool_args: { query: req.prompt },
          tool_output: { hits: 2, summary: 'Retrieved store policy & microservice telemetry context.' },
          status: 'success',
        });
        answerParts.push(
          `Completed ReAct reasoning for "${req.prompt}". All systems nominal; use specific Order IDs (e.g. ORD-1001) or product names for live tool inspection.`
        );
      }

      const finalAnswer = answerParts.join(' ');
      const promptTokens = 380 + toolCalls.length * 140;
      const completionTokens = 120 + toolCalls.length * 45;
      const { totalTokens, cost } = this.recordSimTpmAndCost(
        'langgraph_react_agent',
        promptTokens,
        completionTokens,
        performance.now() - t0
      );

      const existing: ThreadHistoryResponse = this.simAgentThreads.get(threadId) ?? {
        thread_id: threadId,
        messages: [],
        total_messages: 0,
        accumulated_tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        accumulated_cost: 0,
      };

      const newMessages: ThreadMessageRecord[] = [
        { role: 'human', content: req.prompt },
        ...toolCalls.flatMap((tc, i): ThreadMessageRecord[] => [
          {
            role: 'ai',
            content: `Invoking ${tc.tool_name}`,
            tool_calls: [{ name: tc.tool_name, args: tc.tool_args }],
          },
          {
            role: 'tool',
            name: tc.tool_name,
            tool_call_id: `call_${Date.now()}_${i}`,
            content: JSON.stringify(tc.tool_output),
          },
        ]),
        { role: 'ai', content: finalAnswer },
      ];

      existing.messages.push(...newMessages);
      existing.total_messages = existing.messages.length;
      existing.accumulated_tokens = {
        prompt_tokens: (existing.accumulated_tokens.prompt_tokens ?? 0) + promptTokens,
        completion_tokens: (existing.accumulated_tokens.completion_tokens ?? 0) + completionTokens,
        total_tokens: (existing.accumulated_tokens.total_tokens ?? 0) + totalTokens,
      };
      existing.accumulated_cost = Number((existing.accumulated_cost + cost).toFixed(6));
      this.simAgentThreads.set(threadId, existing);

      return {
        thread_id: threadId,
        final_answer: finalAnswer,
        tool_calls: toolCalls,
        iterations: toolCalls.length + 1,
        messages_count: existing.total_messages,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost,
      };
    },

    getAgentThread: async (threadId: string): Promise<ThreadHistoryResponse | null> => {
      if (this.mode === 'live') {
        try {
          return await this.aiFetch<ThreadHistoryResponse>(`/agent/threads/${encodeURIComponent(threadId)}`);
        } catch (err) {
          if (err instanceof BridgeApiError && err.status === 404) return null;
          throw err;
        }
      }
      await delay(80);
      return this.simAgentThreads.get(threadId) ?? null;
    },

    clearAgentThread: async (threadId: string): Promise<ThreadClearResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<ThreadClearResponse>(`/agent/threads/${encodeURIComponent(threadId)}`, {
          method: 'DELETE',
        });
      }
      await delay(100);
      this.simAgentThreads.delete(threadId);
      return {
        thread_id: threadId,
        cleared: true,
        message: `Checkpoint memory cleared for thread '${threadId}'.`,
      };
    },

    startWorkflow: async (req: WorkflowStartRequest): Promise<WorkflowRunResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<WorkflowRunResponse>('/workflow/start', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      const t0 = performance.now();
      await delay(300);

      const threadId = req.thread_id?.trim() || `wf-${Math.random().toString(36).slice(2, 8)}`;
      const lower = req.prompt.toLowerCase();
      const orderMatch = req.prompt.match(/ORD-\d+/i);
      const orderId = orderMatch ? orderMatch[0].toUpperCase() : 'ORD-1001';
      const amountMatch = req.prompt.match(/\$?\s*(\d+(?:\.\d+)?)/);
      const amount = lower.includes('refund') && amountMatch ? Number(amountMatch[1]) : lower.includes('refund') ? 150 : null;

      const isUnsupported = lower.includes('hack') || lower.includes('drop table') || lower.includes('bypass') || lower.includes('delete database');
      const isRefund = lower.includes('refund');
      const isCancel = lower.includes('cancel');
      const isAddress = lower.includes('address');

      const steps: StepExecutionRecord[] = [];
      const actionType = isUnsupported
        ? 'disallowed'
        : isRefund
          ? 'refund'
          : isCancel
            ? 'cancel_order'
            : isAddress
              ? 'change_address'
              : 'general_inquiry';
      const intent = isUnsupported ? 'unsupported' : isRefund || isCancel || isAddress ? 'action' : 'query';

      steps.push({
        step_name: 'classify_intent',
        status: 'completed',
        details: { intent, action_type: actionType, entities: { order_id: orderId, amount } },
        timestamp: nowIso(),
      });

      if (isUnsupported) {
        steps.push({
          step_name: 'evaluate_policy',
          status: 'completed',
          details: { policy_verdict: 'rejected', risk_level: 'high', policy_reason: 'Prohibited operation detected by security guardrail.' },
          timestamp: nowIso(),
        });
        steps.push({
          step_name: 'rejection_handler',
          status: 'rejected',
          details: { reason: 'Security policy violation' },
          timestamp: nowIso(),
        });
        const finalAnswer = 'Your request cannot be processed because it violates platform security and governance policies.';
        steps.push({ step_name: 'synthesizer', status: 'completed', details: {}, timestamp: nowIso() });

        const { totalTokens, cost } = this.recordSimTpmAndCost('workflow_start', 290, 85, performance.now() - t0);
        const entry: SimWorkflowEntry = {
          thread_id: threadId,
          prompt: req.prompt,
          customer_id: req.customer_id ?? 'CUST-DEFAULT',
          status: 'COMPLETED',
          action_type: actionType,
          order_id: orderId,
          amount,
          execution_steps: steps,
          pending_approval: null,
          action_result: null,
          final_answer: finalAnswer,
          accumulated_tokens: { prompt_tokens: 290, completion_tokens: 85, total_tokens: totalTokens },
          accumulated_cost: cost,
        };
        this.simWorkflows.set(threadId, entry);
        return {
          thread_id: threadId,
          status: 'COMPLETED',
          final_answer: finalAnswer,
          pending_approval: null,
          execution_steps: steps,
          action_result: null,
          prompt_tokens: 290,
          completion_tokens: 85,
          total_tokens: totalTokens,
          cost,
        };
      }

      if (intent === 'query') {
        steps.push({
          step_name: 'evaluate_policy',
          status: 'completed',
          details: { policy_verdict: 'approved', risk_level: 'low', requires_human_approval: false },
          timestamp: nowIso(),
        });
        const finalAnswer = 'Standard shipping takes 3–5 business days (Express: 1–2 days). Unopened items may be returned within 30 days of delivery.';
        steps.push({ step_name: 'query_resolver', status: 'completed', details: { answer_preview: finalAnswer.slice(0, 70) }, timestamp: nowIso() });
        steps.push({ step_name: 'synthesizer', status: 'completed', details: {}, timestamp: nowIso() });

        const { totalTokens, cost } = this.recordSimTpmAndCost('workflow_start', 310, 95, performance.now() - t0);
        this.simWorkflows.set(threadId, {
          thread_id: threadId,
          prompt: req.prompt,
          customer_id: req.customer_id ?? 'CUST-DEFAULT',
          status: 'COMPLETED',
          action_type: actionType,
          order_id: orderId,
          amount: null,
          execution_steps: steps,
          pending_approval: null,
          action_result: null,
          final_answer: finalAnswer,
          accumulated_tokens: { prompt_tokens: 310, completion_tokens: 95, total_tokens: totalTokens },
          accumulated_cost: cost,
        });
        return {
          thread_id: threadId,
          status: 'COMPLETED',
          final_answer: finalAnswer,
          pending_approval: null,
          execution_steps: steps,
          action_result: null,
          prompt_tokens: 310,
          completion_tokens: 95,
          total_tokens: totalTokens,
          cost,
        };
      }

      // Action branch
      const needsHumanApproval =
        actionType === 'cancel_order' || actionType === 'change_address' || (actionType === 'refund' && (amount ?? 0) > 50);

      if (!needsHumanApproval) {
        steps.push({
          step_name: 'evaluate_policy',
          status: 'completed',
          details: {
            policy_verdict: 'approved',
            risk_level: 'low',
            requires_human_approval: false,
            policy_reason: `Refund amount ($${(amount ?? 0).toFixed(2)}) is within the <= $50 auto-approval threshold.`,
          },
          timestamp: nowIso(),
        });
        const actionResult = {
          transaction_id: uid('TXN-REFUND'),
          action_type: actionType,
          order_id: orderId,
          amount: amount ?? 25,
          status: 'SUCCESS',
          approval_mode: 'auto_approved',
          executed_at: nowIso(),
        };
        steps.push({ step_name: 'action_executor', status: 'completed', details: actionResult, timestamp: nowIso() });
        const finalAnswer = `Auto-approved and executed **${actionType}** of **$${(amount ?? 25).toFixed(2)}** for **${orderId}** (Txn: \`${actionResult.transaction_id}\`).`;
        steps.push({ step_name: 'synthesizer', status: 'completed', details: {}, timestamp: nowIso() });

        const { totalTokens, cost } = this.recordSimTpmAndCost('workflow_start', 340, 110, performance.now() - t0);
        this.simWorkflows.set(threadId, {
          thread_id: threadId,
          prompt: req.prompt,
          customer_id: req.customer_id ?? 'CUST-DEFAULT',
          status: 'COMPLETED',
          action_type: actionType,
          order_id: orderId,
          amount,
          execution_steps: steps,
          pending_approval: null,
          action_result: actionResult,
          final_answer: finalAnswer,
          accumulated_tokens: { prompt_tokens: 340, completion_tokens: 110, total_tokens: totalTokens },
          accumulated_cost: cost,
        });
        return {
          thread_id: threadId,
          status: 'COMPLETED',
          final_answer: finalAnswer,
          pending_approval: null,
          execution_steps: steps,
          action_result: actionResult,
          prompt_tokens: 340,
          completion_tokens: 110,
          total_tokens: totalTokens,
          cost,
        };
      }

      // High-risk interrupt -> PENDING_APPROVAL
      const pendingApproval = {
        action_type: actionType,
        order_id: orderId,
        amount,
        risk_level: 'high' as const,
        justification:
          actionType === 'refund'
            ? `Refund amount ($${(amount ?? 150).toFixed(2)}) exceeds the $50 auto-approval threshold. Manager review required.`
            : `Action '${actionType}' modifies core order state. Requires manager review.`,
        required_role: 'manager',
      };
      steps.push({
        step_name: 'evaluate_policy',
        status: 'completed',
        details: { policy_verdict: 'needs_approval', risk_level: 'high', requires_human_approval: true },
        timestamp: nowIso(),
      });
      steps.push({
        step_name: 'human_review',
        status: 'interrupted',
        details: pendingApproval,
        timestamp: nowIso(),
      });

      const { totalTokens, cost } = this.recordSimTpmAndCost('workflow_start_interrupt', 280, 64, performance.now() - t0);
      this.simWorkflows.set(threadId, {
        thread_id: threadId,
        prompt: req.prompt,
        customer_id: req.customer_id ?? 'CUST-DEFAULT',
        status: 'INTERRUPTED',
        action_type: actionType,
        order_id: orderId,
        amount,
        execution_steps: steps,
        pending_approval: pendingApproval,
        action_result: null,
        final_answer: null,
        accumulated_tokens: { prompt_tokens: 280, completion_tokens: 64, total_tokens: totalTokens },
        accumulated_cost: cost,
      });

      return {
        thread_id: threadId,
        status: 'PENDING_APPROVAL',
        final_answer: null,
        pending_approval: pendingApproval,
        execution_steps: steps,
        action_result: null,
        prompt_tokens: 280,
        completion_tokens: 64,
        total_tokens: totalTokens,
        cost,
      };
    },

    resumeWorkflow: async (req: WorkflowResumeRequest): Promise<WorkflowRunResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<WorkflowRunResponse>('/workflow/resume', {
          method: 'POST',
          body: JSON.stringify(req),
        });
      }
      const t0 = performance.now();
      await delay(280);
      const entry = this.simWorkflows.get(req.thread_id);
      if (!entry) {
        throw new BridgeApiError(`Workflow thread '${req.thread_id}' not found`, 404);
      }

      const role = req.reviewer_role.toLowerCase();
      let isApproved = req.approved;
      let notes = req.feedback ?? '';

      // Enforce RBAC exactly like workflow_graph.py
      if (isApproved && role !== 'manager' && role !== 'admin') {
        isApproved = false;
        notes = `Approval rejected: Reviewer role '${role}' does not have required 'manager' authorization.`;
      }

      const steps = [...entry.execution_steps];
      steps.push({
        step_name: 'human_review',
        status: 'completed',
        details: { approved: isApproved, reviewer: req.reviewer, reviewer_role: role, notes },
        timestamp: nowIso(),
      });

      let actionResult: Record<string, unknown> | null = null;
      let finalAnswer: string;

      if (isApproved) {
        actionResult = {
          transaction_id: uid(`TXN-${entry.action_type.toUpperCase()}`),
          action_type: entry.action_type,
          order_id: entry.order_id ?? 'ORD-1001',
          amount: entry.amount ?? 0,
          status: 'SUCCESS',
          approval_mode: 'approved',
          approved_by: `${req.reviewer} (${role})`,
          executed_at: nowIso(),
        };
        steps.push({ step_name: 'action_executor', status: 'completed', details: actionResult, timestamp: nowIso() });
        finalAnswer = `Approved by **${req.reviewer}** (${role}). Executed **${entry.action_type}** for **${entry.order_id}**${
          entry.amount ? ` ($${entry.amount.toFixed(2)})` : ''
        }. Transaction: \`${actionResult.transaction_id}\`.`;
      } else {
        steps.push({
          step_name: 'rejection_handler',
          status: 'rejected',
          details: { reviewer: req.reviewer, reviewer_role: role, notes: notes || 'Rejected by reviewer' },
          timestamp: nowIso(),
        });
        finalAnswer = notes || `Request was rejected by ${req.reviewer} (${role}). No mutation was executed.`;
      }

      steps.push({ step_name: 'synthesizer', status: 'completed', details: {}, timestamp: nowIso() });
      const { totalTokens, cost } = this.recordSimTpmAndCost('workflow_resume', 180, 95, performance.now() - t0);

      entry.status = 'COMPLETED';
      entry.execution_steps = steps;
      entry.pending_approval = null;
      entry.action_result = actionResult;
      entry.final_answer = finalAnswer;
      entry.accumulated_tokens.prompt_tokens += 180;
      entry.accumulated_tokens.completion_tokens += 95;
      entry.accumulated_tokens.total_tokens += totalTokens;
      entry.accumulated_cost = Number((entry.accumulated_cost + cost).toFixed(6));

      return {
        thread_id: entry.thread_id,
        status: 'COMPLETED',
        final_answer: finalAnswer,
        pending_approval: null,
        execution_steps: steps,
        action_result: actionResult,
        prompt_tokens: entry.accumulated_tokens.prompt_tokens,
        completion_tokens: entry.accumulated_tokens.completion_tokens,
        total_tokens: entry.accumulated_tokens.total_tokens,
        cost: entry.accumulated_cost,
      };
    },

    getWorkflowState: async (threadId: string): Promise<WorkflowStateResponse | null> => {
      if (this.mode === 'live') {
        try {
          return await this.aiFetch<WorkflowStateResponse>(`/workflow/state/${encodeURIComponent(threadId)}`);
        } catch (err) {
          if (err instanceof BridgeApiError && err.status === 404) return null;
          throw err;
        }
      }
      await delay(70);
      const entry = this.simWorkflows.get(threadId);
      if (!entry) return null;
      return {
        thread_id: entry.thread_id,
        status: entry.status,
        next_nodes: entry.status === 'INTERRUPTED' ? ['human_review'] : [],
        pending_interrupt: entry.pending_approval as unknown as Record<string, unknown> | null,
        values: {
          prompt: entry.prompt,
          action_type: entry.action_type,
          order_id: entry.order_id,
          amount: entry.amount,
        },
      };
    },

    getWorkflowTopology: async (): Promise<WorkflowTopologyResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<WorkflowTopologyResponse>('/workflow/topology');
      }
      return {
        mermaid: `graph TD\n  START --> classify_intent --> evaluate_policy\n  evaluate_policy --> query_resolver\n  evaluate_policy --> human_review\n  evaluate_policy --> action_executor\n  evaluate_policy --> rejection_handler`,
      };
    },

    getCacheStats: async (): Promise<CacheStatsResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<CacheStatsResponse>('/gateway/cache/stats');
      }
      await delay(70);
      const total = this.simCacheHits + this.simCacheMisses;
      return {
        hits: this.simCacheHits,
        misses: this.simCacheMisses,
        total_lookups: total,
        hit_ratio: total > 0 ? Number((this.simCacheHits / total).toFixed(3)) : 0,
        saved_tokens: this.simCacheSavedTokens,
        saved_cost_usd: this.simCacheSavedCost,
        total_cached_entries: this.simSemanticCache.size + 4,
        threshold: 0.92,
        ttl_seconds: 3600,
        max_entries: 500,
        enabled: true,
      };
    },

    clearCache: async (): Promise<{ status: string; message: string }> => {
      if (this.mode === 'live') {
        return this.aiFetch<{ status: string; message: string }>('/gateway/cache/clear', { method: 'POST' });
      }
      await delay(100);
      this.simSemanticCache.clear();
      this.simCacheHits = 0;
      this.simCacheMisses = 0;
      this.simCacheSavedTokens = 0;
      this.simCacheSavedCost = 0;
      return { status: 'success', message: 'Semantic cache flushed successfully' };
    },

    getTpmStatus: async (): Promise<TPMStatusResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<TPMStatusResponse>('/gateway/tpm/status');
      }
      await delay(60);
      const now = Date.now();
      this.simTpmEntries = this.simTpmEntries.filter((e) => now - e.ts < 60_000);
      const current = this.simTpmEntries.reduce((s, e) => s + e.tokens, 0);
      const remaining = Math.max(0, this.simTpmMax - current);
      return {
        current_window_tokens: current,
        max_tpm: this.simTpmMax,
        remaining_tokens: remaining,
        utilization_pct: Number(((current / this.simTpmMax) * 100).toFixed(3)),
        active_window_seconds: 60,
        window_entries_count: this.simTpmEntries.length,
      };
    },

    resetTpm: async (): Promise<{ status: string; message: string }> => {
      if (this.mode === 'live') {
        return this.aiFetch<{ status: string; message: string }>('/gateway/tpm/reset', { method: 'POST' });
      }
      await delay(80);
      this.simTpmEntries = [];
      return { status: 'success', message: 'TPM ledger reset successfully' };
    },

    getCircuits: async (): Promise<CircuitDeploymentStatus[]> => {
      if (this.mode === 'live') {
        return this.aiFetch<CircuitDeploymentStatus[]>('/gateway/circuits');
      }
      await delay(60);
      const now = Date.now();
      return this.simCircuits.map((c) => {
        const cooldownActive = c.cooldownUntil > now;
        return {
          model: c.model,
          role: c.role,
          circuit_state: cooldownActive ? 'OPEN' : 'CLOSED',
          cooldown_active: cooldownActive,
          fail_count: c.failCount,
        };
      });
    },

    tripCircuit: async (
      model: string,
      cooldownSeconds = 30
    ): Promise<{ status: string; message: string; model: string; cooldown_seconds: number }> => {
      if (this.mode === 'live') {
        const qs = new URLSearchParams({ model, cooldown_seconds: String(cooldownSeconds) });
        return this.aiFetch(`/gateway/circuits/trip?${qs.toString()}`, { method: 'POST' });
      }
      await delay(100);
      const target = this.simCircuits.find((c) => c.model === model);
      if (target) {
        target.cooldownUntil = Date.now() + cooldownSeconds * 1000;
        target.failCount += 1;
      }
      this.pulse('ai');
      return {
        status: 'success',
        message: `Model '${model}' tripped into cooldown for ${cooldownSeconds}s`,
        model,
        cooldown_seconds: cooldownSeconds,
      };
    },

    resetCircuits: async (): Promise<{ status: string; message: string }> => {
      if (this.mode === 'live') {
        return this.aiFetch('/gateway/circuits/reset', { method: 'POST' });
      }
      await delay(90);
      this.simCircuits.forEach((c) => {
        c.cooldownUntil = 0;
        c.failCount = 0;
      });
      this.pulse('ai');
      return { status: 'success', message: 'All circuit breakers reset to CLOSED' };
    },

    getCostSummary: async (): Promise<CostSummaryResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<CostSummaryResponse>('/observability/costs');
      }
      await delay(70);
      const perModel: Record<string, ModelCostBreakdown> = {};
      let totalPrompt = 0;
      let totalCompletion = 0;
      let totalTokens = 0;
      let totalCost = 0;
      let latencySum = 0;
      let ttftSum = 0;
      let ttftCount = 0;

      for (const r of this.simCallHistory) {
        totalPrompt += r.prompt_tokens;
        totalCompletion += r.completion_tokens;
        totalTokens += r.total_tokens;
        totalCost += r.cost_usd;
        latencySum += r.latency_ms;
        if (r.ttft_ms !== null && r.ttft_ms !== undefined) {
          ttftSum += r.ttft_ms;
          ttftCount += 1;
        }
        const entry = perModel[r.model] ?? {
          model: r.model,
          total_calls: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          total_cost_usd: 0,
          avg_latency_ms: 0,
        };
        entry.total_calls += 1;
        entry.prompt_tokens += r.prompt_tokens;
        entry.completion_tokens += r.completion_tokens;
        entry.total_tokens += r.total_tokens;
        entry.total_cost_usd = Number((entry.total_cost_usd + r.cost_usd).toFixed(6));
        entry.avg_latency_ms = Math.round(
          ((entry.avg_latency_ms * (entry.total_calls - 1)) + r.latency_ms) / entry.total_calls
        );
        perModel[r.model] = entry;
      }

      const n = this.simCallHistory.length;
      return {
        total_calls: n,
        total_prompt_tokens: totalPrompt,
        total_completion_tokens: totalCompletion,
        total_tokens: totalTokens,
        total_cost_usd: Number(totalCost.toFixed(6)),
        avg_latency_ms: n > 0 ? Math.round(latencySum / n) : 0,
        avg_ttft_ms: ttftCount > 0 ? Math.round(ttftSum / ttftCount) : null,
        per_model: perModel,
        tracking_since: this.simTrackingSince,
        latest_call_at: this.simCallHistory[0]?.timestamp ?? null,
      };
    },

    getRecentCalls: async (limit = 25): Promise<LLMCallRecord[]> => {
      if (this.mode === 'live') {
        return this.aiFetch<LLMCallRecord[]>(`/observability/costs/recent?limit=${limit}`);
      }
      await delay(60);
      return this.simCallHistory.slice(0, limit);
    },

    resetCosts: async (): Promise<{ message: string }> => {
      if (this.mode === 'live') {
        return this.aiFetch<{ message: string }>('/observability/costs/reset', { method: 'POST' });
      }
      await delay(80);
      this.simCallHistory = [];
      this.simTrackingSince = nowIso();
      this.notify();
      return { message: 'Operational cost and token counters successfully reset.' };
    },

    getTracingStatus: async (): Promise<TracingStatusResponse> => {
      if (this.mode === 'live') {
        return this.aiFetch<TracingStatusResponse>('/observability/tracing/status');
      }
      await delay(50);
      return {
        tracing_enabled: true,
        langchain_project: 'nexus-control-center',
        langchain_endpoint: 'https://api.smith.langchain.com',
        has_api_key: true,
      };
    },
  };

  // ============================================================================
  // Internal Sim Helpers
  // ============================================================================

  private generateSimChatReply(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('kafka') || lower.includes('idempotency') || lower.includes('rate limit')) {
      return (
        'In the Orders microservice, **Redis** enforces a 10 req/60s Lua fixed-window rate limiter at the servlet filter boundary, ' +
        'while `IdempotencyService` uses atomic `SETNX` locks (24h TTL) to guarantee exactly-once order processing before publishing `OrderCreatedEvent` to Kafka.'
      );
    }
    if (lower.includes('rag') || lower.includes('rerank') || lower.includes('bm25')) {
      return (
        'Our 4-stage RAG pipeline combines LLM query expansion, parallel dense vector + sparse BM25 retrieval, ' +
        'Reciprocal Rank Fusion (`k=60`), and a Cross-Encoder neural reranker to maximize grounding precision before synthesis.'
      );
    }
    if (lower.includes('langgraph') || lower.includes('hitl') || lower.includes('workflow')) {
      return (
        'The LangGraph HITL workflow routes high-risk mutations (refunds > $50, order cancellations, address changes) into `human_review` via `interrupt()`, ' +
        'persisting checkpoints until a `manager` or `admin` resumes execution.'
      );
    }
    return (
      `Processed via **${this.pickActiveSimModel()}** through the Nexus AI Gateway:\n\n` +
      `Your prompt ("${prompt.slice(0, 72)}${prompt.length > 72 ? '...' : ''}") passed the 60s sliding-window TPM limiter, checked the semantic cache (threshold 0.92), and completed with full LangSmith telemetry.`
    );
  }

  private runSimRagSearch(req: AskRequest): SearchResponse {
    const terms = req.question
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);

    const expanded_queries = req.use_query_expansion
      ? [
          req.question,
          `${req.question} architecture specification`,
          `${req.question} implementation details`,
        ]
      : [req.question];

    const scored: SearchChunkResult[] = this.simRagChunks.map((chunk, i) => {
      const textLower = `${chunk.document_name} ${chunk.text_content}`.toLowerCase();
      const hits = terms.filter((t) => textLower.includes(t)).length;
      const baseOverlap = terms.length > 0 ? hits / terms.length : 0.3;

      const distance = Number(Math.max(0.08, 0.72 - baseOverlap * 0.55 + i * 0.03).toFixed(3));
      const bm25_score = req.use_hybrid !== false ? Number((1.2 + hits * 1.85).toFixed(3)) : null;
      const rrf_score =
        req.use_hybrid !== false
          ? Number(((1 / (60 + i + 1)) + baseOverlap * 0.025).toFixed(4))
          : null;
      const rerank_score =
        req.use_reranker !== false
          ? Number(Math.min(0.99, Math.max(0.18, 0.35 + baseOverlap * 0.62 - i * 0.04)).toFixed(3))
          : null;

      return {
        document_name: chunk.document_name,
        text_content: chunk.text_content,
        snippet: chunk.text_content.slice(0, 150) + (chunk.text_content.length > 150 ? '...' : ''),
        distance,
        bm25_score,
        rrf_score,
        rerank_score,
      };
    });

    scored.sort((a, b) => {
      if (req.use_reranker !== false) {
        return (b.rerank_score ?? 0) - (a.rerank_score ?? 0);
      }
      if (req.use_hybrid !== false) {
        return (b.rrf_score ?? 0) - (a.rrf_score ?? 0);
      }
      return (a.distance ?? 1) - (b.distance ?? 1);
    });

    const limited = scored.slice(0, req.limit ?? 3);
    return {
      query: req.question,
      expanded_queries,
      retrieved_count: limited.length,
      chunks: limited,
    };
  }
}

export const apiBridge = new ControlCenterBridge();
