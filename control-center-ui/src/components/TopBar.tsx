import React from 'react';
import {
  Activity,
  Cpu,
  Database,
  DollarSign,
  Gauge,
  Moon,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
} from 'lucide-react';
import type {
  AppMode,
  BridgeTelemetrySnapshot,
  NavTab,
  SystemHealthStatus,
} from '../types';

interface TopBarProps {
  activeTab: NavTab;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  health: SystemHealthStatus;
  onRefreshHealth: () => void;
  checkingHealth: boolean;
  telemetry: BridgeTelemetrySnapshot;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'System Overview & Quick Actions',
    subtitle: 'Unified control plane for Commerce (Java/Kafka/Redis) & AI Platform (FastAPI/LangGraph)',
  },
  commerce: {
    title: 'Commerce & Orders',
    subtitle: 'Product catalog, user management, cart checkout, and Redis SETNX idempotency protection',
  },
  infra: {
    title: 'Infrastructure & Kafka',
    subtitle: '10 req/60s rate limit testing, Redis cache controls, and live OrderCreatedEvent feed',
  },
  generation: {
    title: 'AI Generation & Sentiment',
    subtitle: 'Token streaming with live TTFT metrics and structured customer sentiment analysis',
  },
  rag: {
    title: 'Knowledge Base (RAG)',
    subtitle: 'Document ingestion, hybrid search (Dense + BM25 RRF), and Cross-Encoder reranking',
  },
  agent: {
    title: 'AI Agent & Governance',
    subtitle: 'Autonomous multi-turn tool calling and Human-in-the-Loop approval workflows',
  },
  gateway: {
    title: 'AI Gateway & Analytics',
    subtitle: 'Semantic caching, 60s TPM budget limits, model circuit breakers, and cost tracking',
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  mode,
  onModeChange,
  health,
  onRefreshHealth,
  checkingHealth,
  telemetry,
  theme,
  onToggleTheme,
}) => {
  const meta = TAB_TITLES[activeTab];
  const rl = telemetry.lastRateLimit;
  const rlRemaining = rl?.remaining ?? 10;
  const rlLimit = rl?.limit ?? 10;
  const rlDanger = rl && (!rl.allowed || rlRemaining === 0);
  const rlWarn = rl && rl.allowed && rlRemaining <= 3;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 px-6 py-3.5 backdrop-blur-md transition-colors dark:border-slate-800/90 dark:bg-slate-900/90">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {meta.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {meta.subtitle}
          </p>
        </div>

        {/* Telemetry & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Health Badges */}
          <div className="hidden items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950/70 xl:flex">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Database className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span
                className={`h-2 w-2 rounded-full ${
                  health.ordersHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className="font-mono text-xs">
                Orders {health.ordersLatencyMs !== null ? `${health.ordersLatencyMs}ms` : 'Off'}
              </span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Cpu className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span
                className={`h-2 w-2 rounded-full ${
                  health.aiHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className="font-mono text-xs">
                AI {health.aiLatencyMs !== null ? `${health.aiLatencyMs}ms` : 'Off'}
              </span>
            </span>
            <button
              type="button"
              onClick={onRefreshHealth}
              title="Re-check health"
              className="ml-1 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RefreshCw className={`h-3 w-3 ${checkingHealth ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
          </div>

          {/* Rate Limit Pill */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-medium ${
              rlDanger
                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
                : rlWarn
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300'
            }`}
            title="Orders API Rate Limit: Remaining / Limit"
          >
            {rlDanger ? (
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            ) : (
              <Gauge className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            )}
            <span>
              RL {rlRemaining}/{rlLimit}
            </span>
          </div>

          {/* AI Spend Pill */}
          <div
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 sm:flex"
            title="Cumulative AI Token Spend"
          >
            <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>${telemetry.totalCostUsd.toFixed(4)}</span>
          </div>

          {/* Kafka Events Pill */}
          <div
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 md:flex"
            title="Total Kafka Events Emitted"
          >
            <Activity className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>{telemetry.kafkaEventCount} events</span>
          </div>

          {/* Mode Switch (Sim / Live) */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => onModeChange('sim')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                mode === 'sim'
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              Simulator
            </button>
            <button
              type="button"
              onClick={() => onModeChange('live')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                mode === 'live'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Radio className="h-3 w-3" />
              Live Backend
            </button>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
