import React from 'react';
import {
  Bot,
  Boxes,
  Flame,
  Layers,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { AppMode, BridgeTelemetrySnapshot, NavTab } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mode: AppMode;
  telemetry: BridgeTelemetrySnapshot;
}

interface NavGroup {
  label: string;
  items: {
    id: NavTab;
    label: string;
    caption: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        id: 'overview',
        label: 'System Overview',
        caption: 'Status & quick actions',
        icon: LayoutGrid,
      },
    ],
  },
  {
    label: 'Commerce Stack',
    items: [
      {
        id: 'commerce',
        label: 'Orders & Catalog',
        caption: 'Products, users & cart',
        icon: Boxes,
      },
      {
        id: 'infra',
        label: 'Rate Limiter & Kafka',
        caption: 'Traffic blast & event feed',
        icon: Flame,
      },
    ],
  },
  {
    label: 'AI Platform',
    items: [
      {
        id: 'generation',
        label: 'Generation & Sentiment',
        caption: 'Token streamer & reviews',
        icon: Sparkles,
      },
      {
        id: 'rag',
        label: 'Knowledge Base (RAG)',
        caption: 'Hybrid retrieval pipeline',
        icon: Layers,
      },
      {
        id: 'agent',
        label: 'Agent & HITL Workflow',
        caption: 'Tool reasoning & approvals',
        icon: Bot,
      },
      {
        id: 'gateway',
        label: 'Gateway & Cost Tracking',
        caption: 'Semantic cache & TPM',
        icon: ShieldCheck,
      },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  mode,
  telemetry,
}) => {
  const now = Date.now();
  const ordersActive = telemetry.ordersPulseAt !== null && now - telemetry.ordersPulseAt < 3000;
  const aiActive = telemetry.aiPulseAt !== null && now - telemetry.aiPulseAt < 3000;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              NexusOps
            </span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              Studio
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control Center
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{item.label}</div>
                      <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                        {item.caption}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Endpoints & Status Card */}
      <div className="border-t border-slate-200 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950/60">
        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Backend Endpoints</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {mode === 'live' ? 'Live Proxy' : 'In-Memory Sim'}
          </span>
        </div>
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex items-center justify-between rounded-md border border-slate-200/70 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  ordersActive ? 'bg-emerald-500 ring-2 ring-emerald-300/40' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
              /orders-api
            </span>
            <span className="text-slate-400">:8080</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200/70 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  aiActive ? 'bg-indigo-500 ring-2 ring-indigo-300/40' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
              /ai-api
            </span>
            <span className="text-slate-400">:8000</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
