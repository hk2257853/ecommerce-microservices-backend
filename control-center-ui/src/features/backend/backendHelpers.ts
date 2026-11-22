import { BridgeApiError, apiBridge } from '../../services/bridge';
import type { RateLimitInfo } from '../../types';

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function generateIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `idem-${ts}-${rand}`;
}

export function syncOrdersTelemetry(
  onRateLimitUpdate?: (info: RateLimitInfo) => void,
  onActivityPulse?: (stack: 'orders' | 'ai') => void,
  explicitRateLimit?: RateLimitInfo | null
): void {
  const rl = explicitRateLimit ?? apiBridge.orders.getLastRateLimit();
  if (rl) {
    onRateLimitUpdate?.(rl);
  }
  onActivityPulse?.('orders');
}

export function extractErrorMessage(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof BridgeApiError) {
    if (err.status === 429) {
      return `429 Too Many Requests: ${err.message}`;
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
