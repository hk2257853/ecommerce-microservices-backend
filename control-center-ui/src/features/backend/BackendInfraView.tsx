import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Flame,
  Gauge,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { apiBridge } from '../../services/bridge';
import type {
  FeatureViewProps,
  KafkaEvent,
  OrdersCacheStats,
  RateLimitInfo,
  RateLimitProbeResult,
} from '../../types';
import {
  extractErrorMessage,
  formatTimestamp,
  formatUsd,
  syncOrdersTelemetry,
} from './backendHelpers';

interface ProbeLogItem extends RateLimitProbeResult {
  uid: string;
  firedAt: string;
}

export const BackendInfraView: React.FC<FeatureViewProps> = ({
  mode,
  onRateLimitUpdate,
  onActivityPulse,
}) => {
  // Rate Limit Blaster state
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>(() => {
    return (
      apiBridge.orders.getLastRateLimit() ?? {
        limit: 10,
        remaining: 10,
        resetSeconds: 60,
        allowed: true,
        statusCode: 200,
        timestamp: new Date().toISOString(),
      }
    );
  });
  const [countdownSec, setCountdownSec] = useState<number>(rateLimit.resetSeconds);
  const [probing, setProbing] = useState(false);
  const [probeFeed, setProbeFeed] = useState<ProbeLogItem[]>([]);
  const [blastSummary, setBlastSummary] = useState<{
    total: number;
    okCount: number;
    blockedCount: number;
  }>({ total: 0, okCount: 0, blockedCount: 0 });
  const animationTimersRef = useRef<number[]>([]);

  // Redis Cache Inspector state
  const [cacheStats, setCacheStats] = useState<OrdersCacheStats | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [flushingCache, setFlushingCache] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);

  // Kafka Stream state
  const [kafkaEvents, setKafkaEvents] = useState<KafkaEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const clearTimers = () => {
    animationTimersRef.current.forEach((id) => window.clearTimeout(id));
    animationTimersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  // Sync countdown timer cleanly
  useEffect(() => {
    setCountdownSec(rateLimit.resetSeconds);
  }, [rateLimit.resetSeconds, rateLimit.timestamp]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownSec((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadCacheStats = useCallback(async () => {
    setLoadingCache(true);
    setCacheError(null);
    try {
      const stats = await apiBridge.orders.getCacheStats();
      setCacheStats(stats);
    } catch (err) {
      setCacheError(extractErrorMessage(err, 'Failed to read Redis cache stats'));
    } finally {
      setLoadingCache(false);
    }
  }, []);

  const loadKafkaEvents = useCallback(async () => {
    try {
      const events = await apiBridge.orders.getKafkaEvents();
      setKafkaEvents(events);
      setSelectedEventId((prev) => {
        if (prev && events.some((e) => e.eventId === prev)) return prev;
        return events[0]?.eventId ?? null;
      });
    } catch {
      // non-fatal
    }
  }, []);

  // Subscribe to bridge updates so Kafka events & rate limits update in real time
  useEffect(() => {
    const unsub = apiBridge.subscribe((snapshot) => {
      if (snapshot.lastRateLimit) {
        setRateLimit(snapshot.lastRateLimit);
      }
      void loadKafkaEvents();
    });
    return unsub;
  }, [loadKafkaEvents]);

  useEffect(() => {
    void loadCacheStats();
    void loadKafkaEvents();
    const latest = apiBridge.orders.getLastRateLimit();
    if (latest) {
      setRateLimit(latest);
    }
  }, [mode, loadCacheStats, loadKafkaEvents]);

  const handleBlast = async (count: number) => {
    if (probing) return;
    clearTimers();
    setProbing(true);

    try {
      const results = await apiBridge.orders.probeRateLimit(count);
      const stamp = new Date().toLocaleTimeString();

      if (results.length === 1) {
        const single = results[0];
        setRateLimit(single.rateLimit);
        syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse, single.rateLimit);
        setProbeFeed((prev) => [
          {
            ...single,
            uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            firedAt: stamp,
          },
          ...prev.slice(0, 24),
        ]);
        setBlastSummary((prev) => ({
          total: prev.total + 1,
          okCount: prev.okCount + (single.ok ? 1 : 0),
          blockedCount: prev.blockedCount + (single.status === 429 ? 1 : 0),
        }));
        setProbing(false);
        return;
      }

      // Stagger visual insertion for burst/overload feedback
      results.forEach((item, idx) => {
        const tid = window.setTimeout(() => {
          setRateLimit(item.rateLimit);
          syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse, item.rateLimit);
          setProbeFeed((prev) => [
            {
              ...item,
              uid: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              firedAt: stamp,
            },
            ...prev.slice(0, 24),
          ]);
          setBlastSummary((prev) => ({
            total: prev.total + 1,
            okCount: prev.okCount + (item.ok ? 1 : 0),
            blockedCount: prev.blockedCount + (item.status === 429 ? 1 : 0),
          }));

          if (idx === results.length - 1) {
            setProbing(false);
          }
        }, idx * 60);
        animationTimersRef.current.push(tid);
      });
    } catch {
      setProbing(false);
    }
  };

  const handleResetWindow = () => {
    if (mode !== 'sim') return;
    apiBridge.orders.resetSimRateLimit();
    const resetRl = apiBridge.orders.getLastRateLimit();
    if (resetRl) {
      setRateLimit(resetRl);
      onRateLimitUpdate?.(resetRl);
    }
    setProbeFeed([]);
    setBlastSummary({ total: 0, okCount: 0, blockedCount: 0 });
  };

  const handleFlushProductsCache = async () => {
    setFlushingCache(true);
    setCacheNotice(null);
    setCacheError(null);
    try {
      const res = await apiBridge.orders.clearProductsCache();
      setCacheNotice(res.message);
      onActivityPulse?.('orders');
      await loadCacheStats();
    } catch (err) {
      setCacheError(extractErrorMessage(err, 'Failed to flush products cache'));
    } finally {
      setFlushingCache(false);
    }
  };

  const selectedEvent = useMemo(
    () => kafkaEvents.find((e) => e.eventId === selectedEventId) ?? kafkaEvents[0] ?? null,
    [kafkaEvents, selectedEventId]
  );

  const handleCopyPayload = async () => {
    if (!selectedEvent) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2));
      setCopiedPayload(true);
      window.setTimeout(() => setCopiedPayload(false), 1500);
    } catch {
      // clipboard fallback
    }
  };

  // Quota calculation
  const limit = Math.max(1, rateLimit.limit || 10);
  const remaining = Math.max(0, Math.min(limit, rateLimit.remaining));
  const remainingPct = Math.round((remaining / limit) * 100);

  const quotaTone =
    remaining === 0
      ? {
          bar: 'bg-rose-500',
          badge: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300',
          label: '429 Throttled (0 Left)',
        }
      : remaining <= 3
        ? {
            bar: 'bg-amber-500',
            badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
            label: `Low Quota (${remaining} Left)`,
          }
        : {
            bar: 'bg-emerald-500',
            badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
            label: `Quota Healthy (${remaining} Left)`,
          };

  const cacheHitRate = useMemo(() => {
    if (!cacheStats) return 0;
    const total = cacheStats.hits + cacheStats.misses;
    return total === 0 ? 0 : Math.round((cacheStats.hits / total) * 100);
  }, [cacheStats]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Backend Infrastructure
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Monitor the Redis Lua rate limiter (10 req / 60s), Redis cache hits, and the Kafka{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-indigo-600 dark:bg-slate-900 dark:text-indigo-400">
              order-created-events
            </code>{' '}
            stream.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Mode: <strong className="uppercase">{mode}</strong>
          </span>
          <span className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${quotaTone.badge}`}>
            {quotaTone.label}
          </span>
        </div>
      </div>

      {/* Row 1: Rate Limiter Tester & Redis Cache Inspector (Clean 2-card layout) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* CARD 1: Rate Limiter Tester (7 cols) */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:col-span-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <Gauge className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Rate Limiter Tester
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Testing endpoint: <code className="font-mono text-indigo-600 dark:text-indigo-400">/api/products</code> (Fixed-window: 10 req / 60s)
                </p>
              </div>
            </div>

            {mode === 'sim' && (
              <button
                type="button"
                onClick={handleResetWindow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Window
              </button>
            )}
          </div>

          {/* Simple, Calm Quota Progress Bar */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Remaining Quota: <strong className="text-slate-900 dark:text-slate-100">{remaining} of {limit}</strong> requests
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Window resets in {countdownSec}s
              </span>
            </div>

            <div className="h-3.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-300 ${quotaTone.bar}`}
                style={{ width: `${remainingPct}%` }}
              />
            </div>

            {/* HTTP Headers Readout */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400">X-RateLimit-Limit</span>
                <div className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">{limit}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400">X-RateLimit-Remaining</span>
                <div className="mt-0.5 font-mono font-bold text-slate-900 dark:text-slate-100">{remaining}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400">X-RateLimit-Reset</span>
                <div className="mt-0.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{countdownSec}s</div>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled={probing}
              onClick={() => void handleBlast(1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send 1
            </button>
            <button
              type="button"
              disabled={probing}
              onClick={() => void handleBlast(5)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Zap className="h-4 w-4 text-amber-500" />
              Send 5
            </button>
            <button
              type="button"
              disabled={probing}
              onClick={() => void handleBlast(12)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40"
              title="Sends 12 requests in parallel to exceed the 10-request window and trigger 429 Too Many Requests"
            >
              <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              Burst 12 (Trigger 429)
            </button>
          </div>

          {/* Counters Row */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
            <span>
              Total probes fired: <strong className="text-slate-900 dark:text-slate-100">{blastSummary.total}</strong>
            </span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                200 OK: {blastSummary.okCount}
              </span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                429 Blocked: {blastSummary.blockedCount}
              </span>
            </div>
          </div>

          {/* Recent Response Log */}
          <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
            {probeFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                <Activity className="mb-1.5 h-5 w-5 text-slate-400" />
                Click <strong>Send 1</strong>, <strong>Send 5</strong>, or <strong>Burst 12</strong> to test rate limiting.
              </div>
            ) : (
              <div className="space-y-2">
                {probeFeed.map((item) => (
                  <div
                    key={item.uid}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                      item.ok
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-200'
                        : 'border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                          item.ok
                            ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                            : 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="truncate">{item.message}</span>
                    </div>
                    <span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">
                      {item.latencyMs}ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CARD 2: Redis Cache Inspector (5 cols) */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:col-span-5">
          <div>
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Redis Cache Inspector
                </h3>
              </div>
              <button
                type="button"
                disabled={loadingCache}
                onClick={() => void loadCacheStats()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingCache ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {cacheError && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {cacheError}
              </div>
            )}

            {cacheNotice && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{cacheNotice}</span>
              </div>
            )}

            {cacheStats ? (
              <div className="space-y-4">
                {/* 3 KPI Boxes */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Cache Hits
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {cacheStats.hits}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Misses
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                      {cacheStats.misses}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Cached Keys
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400">
                      {cacheStats.cachedKeys}
                    </div>
                  </div>
                </div>

                {/* Hit Ratio Bar */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Read-Through Hit Ratio
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {cacheHitRate}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${cacheHitRate}%` }}
                    />
                  </div>
                </div>

                {/* Namespaces */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Redis Cache Namespaces
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(cacheStats.caches).map(([name, status]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {name}::*
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading Redis cache telemetry...
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Last Products Cache Flush:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatTimestamp(cacheStats?.lastClearedAt)}
              </span>
            </div>
            <button
              type="button"
              disabled={flushingCache}
              onClick={() => void handleFlushProductsCache()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
            >
              <Trash2 className="h-4 w-4" />
              {flushingCache ? 'Flushing products::*...' : 'Flush Products Cache'}
            </button>
          </div>
        </section>
      </div>

      {/* Row 2: CARD 3: Kafka Notification Live Event Stream */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Kafka Notification Live Event Stream
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Topic: <code className="font-mono text-indigo-600 dark:text-indigo-400">order-created-events</code> &rarr; Notification Service Consumer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {kafkaEvents.length} events captured
            </span>
            <button
              type="button"
              onClick={() => void loadKafkaEvents()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Stream
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Event Stream List (7 cols) */}
          <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1 lg:col-span-7">
            {kafkaEvents.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <ShieldAlert className="mb-2 h-5 w-5 text-slate-400" />
                Place an order in Commerce Core to emit a live OrderCreatedEvent.
              </div>
            ) : (
              kafkaEvents.map((evt) => {
                const isSelected = selectedEvent?.eventId === evt.eventId;
                const isPublished = evt.status === 'PUBLISHED';

                return (
                  <button
                    key={evt.eventId}
                    type="button"
                    onClick={() => setSelectedEventId(evt.eventId)}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/30'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            isPublished
                              ? 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {evt.status}
                        </span>
                        <strong className="text-slate-900 dark:text-slate-100">
                          ORD-{evt.orderId}
                        </strong>
                        <span className="text-slate-500 dark:text-slate-400">
                          p{evt.partition}:offset {evt.offset}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatUsd(evt.totalAmount)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {evt.notificationSummary}
                    </p>

                    <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{evt.eventId} · User #{evt.userId}</span>
                      <span>{formatTimestamp(evt.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Payload Inspector (5 cols) */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-700/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Payload Inspector
              </span>
              {selectedEvent && (
                <button
                  type="button"
                  onClick={() => void handleCopyPayload()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {copiedPayload ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy JSON
                    </>
                  )}
                </button>
              )}
            </div>

            {selectedEvent ? (
              <pre className="max-h-64 flex-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            ) : (
              <div className="flex flex-1 items-center justify-center py-10 text-xs text-slate-500 dark:text-slate-400">
                Select an event from the stream to view its payload.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
