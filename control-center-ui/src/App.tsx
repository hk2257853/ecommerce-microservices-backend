import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  Cpu,
  Database,
  Flame,
  Gauge,
  Layers,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { BackendInfraView, BackendOrdersView } from './features/backend';
import {
  AiAgentWorkflowView,
  AiGatewayView,
  AiGenerationView,
  AiRagView,
} from './features/ai';
import { apiBridge } from './services/bridge';
import type {
  AppMode,
  BridgeTelemetrySnapshot,
  KafkaEvent,
  LLMCallRecord,
  NavTab,
  RateLimitInfo,
  SystemHealthStatus,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mode, setMode] = useState<AppMode>(() => apiBridge.getMode());
  const [telemetry, setTelemetry] = useState<BridgeTelemetrySnapshot>(() =>
    apiBridge.getTelemetrySnapshot()
  );

  // Light theme by default, with dark theme persistence
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('nexusops_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('nexusops_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const [health, setHealth] = useState<SystemHealthStatus>({
    ordersHealthy: true,
    aiHealthy: true,
    ordersLatencyMs: 14,
    aiLatencyMs: 19,
    lastCheckedAt: new Date().toISOString(),
  });
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Overview live feeds
  const [recentKafka, setRecentKafka] = useState<KafkaEvent[]>([]);
  const [recentAiCalls, setRecentAiCalls] = useState<LLMCallRecord[]>([]);
  const [pulsingTest, setPulsingTest] = useState<'orders' | 'ai' | null>(null);

  useEffect(() => {
    return apiBridge.subscribe((snap) => {
      setTelemetry(snap);
    });
  }, []);

  const refreshHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const next = await apiBridge.checkHealth();
      setHealth(next);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  const refreshOverviewFeeds = useCallback(async () => {
    try {
      const [evts, calls] = await Promise.all([
        apiBridge.orders.getKafkaEvents(),
        apiBridge.ai.getRecentCalls(4),
      ]);
      setRecentKafka(evts.slice(0, 4));
      setRecentAiCalls(calls.slice(0, 4));
    } catch {
      // ignore preview errors
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    if (activeTab === 'overview') {
      refreshOverviewFeeds();
    }
  }, [mode, activeTab, refreshHealth, refreshOverviewFeeds]);

  const handleModeChange = (nextMode: AppMode) => {
    apiBridge.setMode(nextMode);
    setMode(nextMode);
  };

  const handleRateLimitUpdate = useCallback((_info: RateLimitInfo) => {
    setTelemetry(apiBridge.getTelemetrySnapshot());
  }, []);

  const handleActivityPulse = useCallback((_stack: 'orders' | 'ai') => {
    setTelemetry(apiBridge.getTelemetrySnapshot());
  }, []);

  const triggerOrdersPulse = async () => {
    setPulsingTest('orders');
    try {
      await apiBridge.orders.probeRateLimit(1);
      await refreshOverviewFeeds();
    } finally {
      setPulsingTest(null);
    }
  };

  const triggerAiPulse = async () => {
    setPulsingTest('ai');
    try {
      await apiBridge.ai.chat('Ping AI platform gateway to update telemetry.');
      await refreshOverviewFeeds();
    } finally {
      setPulsingTest(null);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'commerce':
        return (
          <BackendOrdersView
            mode={mode}
            onRateLimitUpdate={handleRateLimitUpdate}
            onActivityPulse={handleActivityPulse}
          />
        );
      case 'infra':
        return (
          <BackendInfraView
            mode={mode}
            onRateLimitUpdate={handleRateLimitUpdate}
            onActivityPulse={handleActivityPulse}
          />
        );
      case 'generation':
        return (
          <AiGenerationView
            mode={mode}
            onRateLimitUpdate={handleRateLimitUpdate}
            onActivityPulse={handleActivityPulse}
          />
        );
      case 'rag':
        return (
          <AiRagView
            mode={mode}
            onRateLimitUpdate={handleRateLimitUpdate}
            onActivityPulse={handleActivityPulse}
          />
        );
      case 'agent':
        return (
          <AiAgentWorkflowView
            mode={mode}
            onRateLimitUpdate={handleRateLimitUpdate}
            onActivityPulse={handleActivityPulse}
          />
        );
      case 'gateway':
        return (
          <AiGatewayView
            mode={mode}
            onRateLimitUpdate={handleRateLimitUpdate}
            onActivityPulse={handleActivityPulse}
          />
        );
      case 'overview':
      default:
        return (
          <TopologyOverview
            mode={mode}
            health={health}
            telemetry={telemetry}
            recentKafka={recentKafka}
            recentAiCalls={recentAiCalls}
            pulsingTest={pulsingTest}
            onTriggerOrdersPulse={triggerOrdersPulse}
            onTriggerAiPulse={triggerAiPulse}
            onNavigate={setActiveTab}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#090d16] dark:text-slate-100">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mode={mode}
        telemetry={telemetry}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          activeTab={activeTab}
          mode={mode}
          onModeChange={handleModeChange}
          health={health}
          onRefreshHealth={refreshHealth}
          checkingHealth={checkingHealth}
          telemetry={telemetry}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="mx-auto max-w-7xl">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Clean, Calm System Topology Overview Component
// ============================================================================

interface TopologyOverviewProps {
  mode: AppMode;
  health: SystemHealthStatus;
  telemetry: BridgeTelemetrySnapshot;
  recentKafka: KafkaEvent[];
  recentAiCalls: LLMCallRecord[];
  pulsingTest: 'orders' | 'ai' | null;
  onTriggerOrdersPulse: () => void;
  onTriggerAiPulse: () => void;
  onNavigate: (tab: NavTab) => void;
}

const TopologyOverview: React.FC<TopologyOverviewProps> = ({
  mode,
  health,
  telemetry,
  recentKafka,
  recentAiCalls,
  pulsingTest,
  onTriggerOrdersPulse,
  onTriggerAiPulse,
  onNavigate,
}) => {
  const rl = telemetry.lastRateLimit;
  const remaining = rl?.remaining ?? 10;
  const limit = rl?.limit ?? 10;
  const pct = Math.round((remaining / limit) * 100);

  return (
    <div className="space-y-8">
      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Execution Mode</span>
            <Radio className={`h-4 w-4 ${mode === 'live' ? 'text-emerald-500' : 'text-indigo-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {mode === 'live' ? 'Live Services' : 'In-Memory Simulator'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {mode === 'live' ? 'Connected via Vite proxy (:8080 & :8000)' : 'Stateful local simulation with instant feedback'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Orders API Rate Limit</span>
            <Gauge className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {remaining} / {limit}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">requests left</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                remaining <= 3 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Kafka Order Events</span>
            <Activity className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {telemetry.kafkaEventCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">dispatched</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Topic: <span className="font-mono">order-created-events</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>AI Platform Calls</span>
            <Cpu className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {telemetry.totalAiCalls}
            </span>
            <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
              ${telemetry.totalCostUsd.toFixed(4)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Semantic cache + 60s TPM limiter active
          </p>
        </div>
      </div>

      {/* Dual Architecture Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Commerce Microservices Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Commerce Microservices
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      health.ordersHealthy
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    }`}
                  >
                    {health.ordersHealthy ? 'Port 8080' : 'Offline'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Java 21 · Spring Boot · PostgreSQL · Redis · Apache Kafka
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onTriggerOrdersPulse}
              disabled={pulsingTest === 'orders'}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              {pulsingTest === 'orders' ? 'Testing...' : 'Send Test Ping'}
            </button>
          </div>

          {/* Simple Process Pipeline */}
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-950/50">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Request &amp; Event Lifecycle
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
              <div className="rounded-md border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-medium text-slate-900 dark:text-slate-100">1. Rate Limiting</div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Redis Lua 10 req/60s fixed window with X-RateLimit headers.
                </p>
              </div>
              <div className="rounded-md border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-medium text-slate-900 dark:text-slate-100">2. Order Placement</div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Redis SETNX locks (24h TTL) prevent duplicate submissions.
                </p>
              </div>
              <div className="rounded-md border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-medium text-slate-900 dark:text-slate-100">3. Kafka Event</div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Emits OrderCreatedEvent to trigger email confirmation.
                </p>
              </div>
            </div>
          </div>

          {/* Action Shortcuts */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('commerce')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 shadow-sm"
            >
              <Boxes className="h-4 w-4" />
              Open Catalog &amp; Cart
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('infra')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750"
            >
              <Flame className="h-4 w-4 text-amber-500" />
              Test Rate Limiter &amp; Kafka
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* AI Service Platform Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    AI Service Platform
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      health.aiHealthy
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    }`}
                  >
                    {health.aiHealthy ? 'Port 8000' : 'Offline'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  FastAPI · LiteLLM · ChromaDB · BM25 · LangGraph
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onTriggerAiPulse}
              disabled={pulsingTest === 'ai'}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Zap className="h-3.5 w-3.5 text-indigo-500" />
              {pulsingTest === 'ai' ? 'Pinging...' : 'Ping AI Gateway'}
            </button>
          </div>

          {/* Simple Process Pipeline */}
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-950/50">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Inference &amp; Reasoning Pipeline
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
              <div className="rounded-md border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-medium text-slate-900 dark:text-slate-100">1. LLM Gateway</div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Semantic cache, 60s TPM limiter, and provider circuit breakers.
                </p>
              </div>
              <div className="rounded-md border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-medium text-slate-900 dark:text-slate-100">2. 4-Stage RAG</div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Expansion, Dense + BM25 RRF fusion, and Cross-Encoder reranking.
                </p>
              </div>
              <div className="rounded-md border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-medium text-slate-900 dark:text-slate-100">3. LangGraph HITL</div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  ReAct agent + manager approval gate for sensitive operations.
                </p>
              </div>
            </div>
          </div>

          {/* Action Shortcuts */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('generation')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              Stream Chat &amp; Sentiment
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('agent')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750"
            >
              <Bot className="h-4 w-4 text-indigo-500" />
              Agent &amp; Human Approval
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* Quick Task Shortcuts */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Try Out Key System Features
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Instant shortcuts to verify the distributed architecture end-to-end
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => onNavigate('commerce')}
            className="flex flex-col items-start rounded-lg border border-slate-200 p-4 text-left transition hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-indigo-500 dark:hover:bg-slate-800/50"
          >
            <Boxes className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              Idempotency Lab
            </span>
            <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Test duplicate order submissions using the same key vs fresh orders.
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('infra')}
            className="flex flex-col items-start rounded-lg border border-slate-200 p-4 text-left transition hover:border-amber-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-amber-500 dark:hover:bg-slate-800/50"
          >
            <Flame className="h-5 w-5 text-amber-500" />
            <span className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              Rate Limit Blaster
            </span>
            <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Fire a burst of 12 requests to watch Redis return 429 Too Many Requests.
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('rag')}
            className="flex flex-col items-start rounded-lg border border-slate-200 p-4 text-left transition hover:border-emerald-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-emerald-500 dark:hover:bg-slate-800/50"
          >
            <Layers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              Hybrid RAG Pipeline
            </span>
            <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Inspect candidate chunks with Dense, BM25, and Cross-Encoder score bars.
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('agent')}
            className="flex flex-col items-start rounded-lg border border-slate-200 p-4 text-left transition hover:border-rose-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-rose-500 dark:hover:bg-slate-800/50"
          >
            <ShieldCheck className="h-5 w-5 text-rose-500" />
            <span className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              HITL Human Approval
            </span>
            <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Trigger high-risk refund to test RBAC approval from manager or admin.
            </span>
          </button>
        </div>
      </div>

      {/* Live Recent Event Feeds */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Kafka Events */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Kafka Order Events
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('infra')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View All →
            </button>
          </div>
          <div className="space-y-2">
            {recentKafka.length === 0 ? (
              <p className="text-xs text-slate-400">No Kafka events logged yet.</p>
            ) : (
              recentKafka.map((evt) => (
                <div
                  key={evt.eventId}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800/80 dark:bg-slate-950/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ORD-{evt.orderId}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        ${evt.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {evt.notificationSummary}
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {evt.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent AI Gateway Calls */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent AI Gateway Telemetry
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('gateway')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View Gateway →
            </button>
          </div>
          <div className="space-y-2">
            {recentAiCalls.length === 0 ? (
              <p className="text-xs text-slate-400">No AI calls recorded yet.</p>
            ) : (
              recentAiCalls.map((call) => (
                <div
                  key={call.call_id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800/80 dark:bg-slate-950/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">
                        {call.action_name}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="truncate text-slate-500 dark:text-slate-400">
                        {call.model}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {call.total_tokens} tokens · {call.latency_ms}ms
                      {call.ttft_ms ? ` · TTFT ${call.ttft_ms}ms` : ''}
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ${call.cost_usd.toFixed(5)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
