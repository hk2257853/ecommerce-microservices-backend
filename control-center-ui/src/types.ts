export type AppMode = 'sim' | 'live';

export type NavTab =
  | 'overview'
  | 'commerce'
  | 'infra'
  | 'generation'
  | 'rag'
  | 'agent'
  | 'gateway';

export interface FeatureViewProps {
  mode: AppMode;
  onRateLimitUpdate?: (info: RateLimitInfo) => void;
  onActivityPulse?: (stack: 'orders' | 'ai') => void;
}

// ============================================================================
// Orders Service (Spring Boot + PostgreSQL + Redis + Kafka)
// ============================================================================

export interface UserResponse {
  userId: number;
  name: string;
  email: string;
  address: string;
  createdAt: string;
}

export interface UserCreateRequest {
  name: string;
  email: string;
  address: string;
}

export interface ProductResponse {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  inStock: boolean;
}

export interface ProductCreateRequest {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface ProductUpdateRequest {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface ProductQueryParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  name?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface PageResponse<T> {
  content: T[];
  currentPage: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface OrderItemRequest {
  productId: number;
  quantity: number;
}

export interface OrderCreateRequest {
  userId: number;
  items: OrderItemRequest[];
  idempotencyKey: string;
}

export interface OrderResponse {
  orderId: number;
  userId: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  idempotentReplay?: boolean;
}

export interface OrderItemResponse {
  productId: number;
  quantity: number;
  unitPrice: number;
  productName?: string;
}

export interface KafkaEvent {
  eventId: string;
  topic: string;
  partition: number;
  offset: number;
  orderId: number;
  userId: number;
  totalAmount: number;
  createdAt: string;
  status: 'PUBLISHED' | 'CONSUMED';
  notificationSummary: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetSeconds: number;
  allowed: boolean;
  statusCode: number;
  timestamp: string;
}

export interface RateLimitProbeResult {
  requestNumber: number;
  status: number;
  ok: boolean;
  latencyMs: number;
  message: string;
  rateLimit: RateLimitInfo;
}

export interface OrdersCacheStats {
  caches: Record<string, string>;
  hits: number;
  misses: number;
  cachedKeys: number;
  lastClearedAt: string | null;
}

// ============================================================================
// AI Service Platform (FastAPI + LiteLLM + Chroma + BM25 + LangGraph)
// ============================================================================

export interface BaseLLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface LLMResponse extends BaseLLMUsage {
  content: string;
}

export interface ProductSentimentAnalysis {
  product_name: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral' | string;
  rating: number;
  pros: string[];
  cons: string[];
  requires_refund: boolean;
}

export interface SentimentAnalysisResponse extends BaseLLMUsage {
  analysis: ProductSentimentAnalysis;
}

export interface StreamMetrics {
  ttft_ms: number | null;
  total_duration_ms: number;
  total_chunks: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface IngestRequest {
  content: string;
  document_name: string;
  method: 'semantic' | 'fixed';
}

export interface IngestResponse {
  document_name: string;
  chunk_count: number;
  method_used: string;
}

export interface SourceMetadata {
  document_name: string;
  snippet: string;
  distance: number;
  rrf_score?: number | null;
  rerank_score?: number | null;
}

export interface AskRequest {
  question: string;
  limit?: number;
  use_query_expansion?: boolean;
  use_hybrid?: boolean;
  use_reranker?: boolean;
}

export interface AskResponse extends BaseLLMUsage {
  answer: string;
  sources: SourceMetadata[];
  expanded_queries?: string[] | null;
  retrieval_method: string;
}

export interface SearchChunkResult {
  document_name: string;
  text_content: string;
  snippet: string;
  distance?: number | null;
  bm25_score?: number | null;
  rrf_score?: number | null;
  rerank_score?: number | null;
}

export interface SearchResponse {
  query: string;
  expanded_queries: string[];
  retrieved_count: number;
  chunks: SearchChunkResult[];
}

export interface LlamaIndexIngestRequest {
  content: string;
  document_name: string;
  metadata?: Record<string, unknown>;
}

export interface LlamaIndexAskRequest {
  question: string;
  limit?: number;
  filters?: Record<string, unknown>;
}

export interface LlamaIndexAskResponse extends BaseLLMUsage {
  answer: string;
  sources: SourceMetadata[];
  filters_applied?: Record<string, unknown> | null;
}

export interface ToolCallRecord {
  tool_name: string;
  tool_args: Record<string, unknown>;
  tool_output: unknown;
  status: 'success' | 'error' | string;
}

export interface AgentRunRequest {
  thread_id?: string;
  prompt: string;
  system_prompt?: string;
  max_iterations?: number;
}

export interface AgentRunResponse extends BaseLLMUsage {
  thread_id: string;
  final_answer: string;
  tool_calls: ToolCallRecord[];
  iterations: number;
  messages_count: number;
}

export interface ThreadMessageRecord {
  role: 'system' | 'human' | 'ai' | 'tool' | string;
  content: string;
  tool_calls?: Record<string, unknown>[] | null;
  tool_call_id?: string | null;
  name?: string | null;
}

export interface ThreadHistoryResponse {
  thread_id: string;
  messages: ThreadMessageRecord[];
  total_messages: number;
  accumulated_tokens: Record<string, number>;
  accumulated_cost: number;
}

export interface ThreadClearResponse {
  thread_id: string;
  cleared: boolean;
  message: string;
}

export interface WorkflowStartRequest {
  prompt: string;
  thread_id?: string;
  customer_id?: string;
}

export interface WorkflowResumeRequest {
  thread_id: string;
  approved: boolean;
  reviewer: string;
  reviewer_role: string;
  feedback?: string;
}

export interface ApprovalInterruptPayload {
  action_type: string;
  order_id?: string | null;
  amount?: number | null;
  risk_level: 'low' | 'high';
  justification: string;
  required_role: string;
}

export interface StepExecutionRecord {
  step_name: string;
  status: 'completed' | 'interrupted' | 'skipped' | 'rejected' | 'failed' | string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface WorkflowRunResponse extends BaseLLMUsage {
  thread_id: string;
  status: 'COMPLETED' | 'PENDING_APPROVAL';
  final_answer?: string | null;
  pending_approval?: ApprovalInterruptPayload | null;
  execution_steps: StepExecutionRecord[];
  action_result?: Record<string, unknown> | null;
}

export interface WorkflowStateResponse {
  thread_id: string;
  status: 'ACTIVE' | 'INTERRUPTED' | 'COMPLETED';
  next_nodes: string[];
  pending_interrupt?: Record<string, unknown> | null;
  values: Record<string, unknown>;
}

export interface WorkflowTopologyResponse {
  mermaid: string;
}

export interface ModelCostBreakdown {
  model: string;
  total_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}

export interface CostSummaryResponse {
  total_calls: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  avg_ttft_ms?: number | null;
  per_model: Record<string, ModelCostBreakdown>;
  tracking_since: string;
  latest_call_at?: string | null;
}

export interface LLMCallRecord {
  call_id: string;
  timestamp: string;
  action_name: string;
  model: string;
  stream: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  ttft_ms?: number | null;
  status: string;
  error_message?: string | null;
}

export interface CacheStatsResponse {
  hits: number;
  misses: number;
  total_lookups: number;
  hit_ratio: number;
  saved_tokens: number;
  saved_cost_usd: number;
  total_cached_entries: number;
  threshold: number;
  ttl_seconds: number;
  max_entries: number;
  enabled: boolean;
}

export interface TPMStatusResponse {
  current_window_tokens: number;
  max_tpm: number;
  remaining_tokens: number;
  utilization_pct: number;
  active_window_seconds: number;
  window_entries_count: number;
}

export interface CircuitDeploymentStatus {
  model: string;
  role: string;
  circuit_state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' | string;
  cooldown_active: boolean;
  fail_count: number;
}

export interface TracingStatusResponse {
  tracing_enabled: boolean;
  langchain_project: string;
  langchain_endpoint: string;
  has_api_key: boolean;
}

export interface SystemHealthStatus {
  ordersHealthy: boolean;
  aiHealthy: boolean;
  ordersLatencyMs: number | null;
  aiLatencyMs: number | null;
  lastCheckedAt: string;
}

export interface BridgeTelemetrySnapshot {
  mode: AppMode;
  lastRateLimit: RateLimitInfo | null;
  ordersPulseAt: number | null;
  aiPulseAt: number | null;
  kafkaEventCount: number;
  totalAiCalls: number;
  totalCostUsd: number;
}
