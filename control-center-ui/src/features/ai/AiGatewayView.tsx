import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Coins,
  Cpu,
  DatabaseZap,
  Gauge,
  Loader2,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import { apiBridge } from '../../services/bridge';
import type {
  CacheStatsResponse,
  CircuitDeploymentStatus,
  CostSummaryResponse,
  FeatureViewProps,
  LLMCallRecord,
  TPMStatusResponse,
  TracingStatusResponse,
} from '../../types';

export const AiGatewayView: React.FC<FeatureViewProps> = ({ mode, onActivityPulse }) => {
  const [cacheStats, setCacheStats] = useState<CacheStatsResponse | null>(null);
  const [tpmStatus, setTpmStatus] = useState<TPMStatusResponse | null>(null);
  const [circuits, setCircuits] = useState<CircuitDeploymentStatus[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummaryResponse | null>(null);
  const [recentCalls, setRecentCalls] = useState<LLMCallRecord[]>([]);
  const [tracingStatus, setTracingStatus] = useState<TracingStatusResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const loadAllTelemetry = useCallback(async () => {
    setError(null);
    try {
      const [cache, tpm, circuitList, costs, calls, tracing] = await Promise.all([
        apiBridge.ai.getCacheStats(),
        apiBridge.ai.getTpmStatus(),
        apiBridge.ai.getCircuits(),
        apiBridge.ai.getCostSummary(),
        apiBridge.ai.getRecentCalls(25),
        apiBridge.ai.getTracingStatus(),
      ]);
      setCacheStats(cache);
      setTpmStatus(tpm);
      setCircuits(circuitList);
      setCostSummary(costs);
      setRecentCalls(calls);
      setTracingStatus(tracing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gateway telemetry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllTelemetry();
  }, [loadAllTelemetry, mode]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      loadAllTelemetry();
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, loadAllTelemetry]);

  const runAction = async (key: string, fn: () => Promise<string>) => {
    setBusyAction(key);
    setError(null);
    try {
      const msg = await fn();
      setBannerMsg(msg);
      await loadAllTelemetry();
      onActivityPulse?.('ai');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const hitPct = cacheStats ? Math.round(cacheStats.hit_ratio * 100) : 0;
  const donutCircumference = 2 * Math.PI * 36;
  const donutDashOffset = donutCircumference * (1 - (cacheStats?.hit_ratio ?? 0));

  const tpmPct = tpmStatus ? Math.min(100, tpmStatus.utilization_pct) : 0;
  const modelBreakdowns = costSummary ? Object.values(costSummary.per_model) : [];
  const maxModelTokens = Math.max(1, ...modelBreakdowns.map((m) => m.total_tokens));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Calm Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Gauge className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              LLM Gateway & Cost Observability
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor semantic cache hit rates, 60-second sliding-window token limits, provider circuit breakers, and per-model USD spend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {tracingStatus && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                tracingStatus.tracing_enabled
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300'
                  : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              LangSmith: {tracingStatus.tracing_enabled ? tracingStatus.langchain_project : 'Disabled'}
            </span>
          )}

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300'
                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            Auto-refresh (5s): {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={loadAllTelemetry}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-4 py-3 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
          <span>{bannerMsg}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Row 1: Semantic Cache + 60s TPM Budget Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Semantic Cache Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <DatabaseZap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Semantic Cache
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  In-memory cosine similarity cache (threshold ≥ 0.92)
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={busyAction === 'clear-cache'}
              onClick={() =>
                runAction('clear-cache', async () => {
                  const res = await apiBridge.ai.clearCache();
                  return res.message;
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 transition-colors"
            >
              {busyAction === 'clear-cache' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Clear Cache
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut Chart */}
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 88 88">
                <circle
                  cx="44"
                  cy="44"
                  r="36"
                  fill="none"
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="8"
                />
                <circle
                  cx="44"
                  cy="44"
                  r="36"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={donutCircumference}
                  strokeDashoffset={donutDashOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {hitPct}%
                </span>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Hit Ratio</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex-1 w-full grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Hits / Total Lookups</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {cacheStats ? `${cacheStats.hits} / ${cacheStats.total_lookups}` : '—'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  {cacheStats ? `${cacheStats.misses} misses` : ''}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Cached Items</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {cacheStats ? `${cacheStats.total_cached_entries} / ${cacheStats.max_entries}` : '—'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  TTL: {cacheStats?.ttl_seconds ?? 3600}s
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Tokens Saved</div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {cacheStats ? cacheStats.saved_tokens.toLocaleString() : '—'}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Est. USD Saved</div>
                <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {cacheStats ? `$${cacheStats.saved_cost_usd.toFixed(6)}` : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 60s Sliding-Window TPM Gauge */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Tokens-Per-Minute (TPM) Window
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  60-second sliding-window capacity limiter
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={busyAction === 'reset-tpm'}
              onClick={() =>
                runAction('reset-tpm', async () => {
                  const res = await apiBridge.ai.resetTpm();
                  return res.message;
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-50 transition-colors"
            >
              {busyAction === 'reset-tpm' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Reset Window
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-4 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {tpmStatus ? tpmStatus.current_window_tokens.toLocaleString() : '—'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-mono">
                    / {tpmStatus ? tpmStatus.max_tpm.toLocaleString() : '250,000'} TPM
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold font-mono ${
                    tpmPct > 80
                      ? 'text-rose-600 dark:text-rose-400'
                      : tpmPct > 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {tpmStatus ? `${tpmStatus.utilization_pct.toFixed(2)}%` : '0.00%'}
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tpmPct > 80 ? 'bg-rose-500' : tpmPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(2, tpmPct)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Headroom Remaining</div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {tpmStatus ? tpmStatus.remaining_tokens.toLocaleString() : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Window Period</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 font-mono">
                  {tpmStatus ? `${tpmStatus.active_window_seconds}s` : '60s'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Ledger Count</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 font-mono">
                  {tpmStatus ? tpmStatus.window_entries_count : '—'} entries
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: FallbackRouter Circuit Breaker Matrix */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Power className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                FallbackRouter Circuit Breakers
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Per-model resilience routing. If a primary provider fails, traffic automatically spills over to fallbacks.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busyAction === 'reset-circuits'}
            onClick={() =>
              runAction('reset-circuits', async () => {
                const res = await apiBridge.ai.resetCircuits();
                return res.message;
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition-colors"
          >
            {busyAction === 'reset-circuits' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            Reset All Circuits
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {circuits.map((c) => {
            const isOpen = c.circuit_state === 'OPEN' || c.cooldown_active;
            return (
              <div
                key={c.model}
                className={`rounded-xl border p-5 space-y-3 transition-colors ${
                  isOpen
                    ? 'border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                      {c.role}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono mt-2 break-all">
                      {c.model}
                    </h4>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${
                      isOpen
                        ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-800'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {isOpen ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                    {c.circuit_state}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <span>Failures: {c.fail_count}</span>
                  <span>{c.cooldown_active ? '30s Cooldown Active' : 'Provider Healthy'}</span>
                </div>

                <button
                  type="button"
                  disabled={busyAction === `trip-${c.model}`}
                  onClick={() =>
                    runAction(`trip-${c.model}`, async () => {
                      const res = await apiBridge.ai.tripCircuit(c.model, 30);
                      return res.message;
                    })
                  }
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50 transition-colors"
                >
                  {busyAction === `trip-${c.model}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  Trip Circuit (Simulate 30s Outage)
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 3: Cost Observability & Recent Calls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Cost & Telemetry Observability Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aggregated token volume, latency benchmarks, and individual invocation audits
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busyAction === 'reset-costs'}
            onClick={() =>
              runAction('reset-costs', async () => {
                const res = await apiBridge.ai.resetCosts();
                return res.message;
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Spend Ledger
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="w-3.5 h-3.5 text-indigo-500" /> Total Calls
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {costSummary?.total_calls ?? 0}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" /> Total Tokens
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {(costSummary?.total_tokens ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Coins className="w-3.5 h-3.5 text-amber-500" /> Total Spend
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              ${(costSummary?.total_cost_usd ?? 0).toFixed(6)}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Avg Latency</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {costSummary?.avg_latency_ms ?? 0} ms
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Avg TTFT</div>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
              {costSummary?.avg_ttft_ms !== null && costSummary?.avg_ttft_ms !== undefined
                ? `${costSummary.avg_ttft_ms} ms`
                : '—'}
            </div>
          </div>
        </div>

        {/* Per-Model Distribution */}
        {modelBreakdowns.length > 0 && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Token & Spend Distribution By Model
            </div>
            <div className="space-y-3">
              {modelBreakdowns.map((m) => {
                const widthPct = Math.max(6, Math.round((m.total_tokens / maxModelTokens) * 100));
                return (
                  <div key={m.model} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {m.model}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">
                        {m.total_calls} calls · {m.total_tokens.toLocaleString()} tokens ·{' '}
                        <strong className="text-amber-600 dark:text-amber-400">${m.total_cost_usd.toFixed(6)}</strong> ·{' '}
                        {m.avg_latency_ms}ms avg
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Calls Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                <th className="py-2.5 px-3">Call ID</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3 text-right">Tokens (P/C)</th>
                <th className="py-2.5 px-3 text-right">Latency / TTFT</th>
                <th className="py-2.5 px-3 text-right">Cost</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {recentCalls.length > 0 ? (
                recentCalls.map((call) => (
                  <tr key={call.call_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{call.call_id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {call.action_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{call.model}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                        {call.stream ? 'SSE' : 'SYNC'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {call.total_tokens}{' '}
                      <span className="text-slate-400">
                        ({call.prompt_tokens}/{call.completion_tokens})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {call.latency_ms}ms
                      {call.ttft_ms !== null && call.ttft_ms !== undefined ? (
                        <span className="text-indigo-600 dark:text-indigo-400 ml-1">
                          / {call.ttft_ms}ms
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                      ${call.cost_usd.toFixed(6)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-medium border ${
                          call.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    No LLM calls recorded in the current session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
