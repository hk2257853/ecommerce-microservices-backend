import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  GitMerge,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { apiBridge } from '../../services/bridge';
import type {
  AgentRunResponse,
  FeatureViewProps,
  StepExecutionRecord,
  ThreadHistoryResponse,
  ToolCallRecord,
  WorkflowRunResponse,
  WorkflowStateResponse,
} from '../../types';

const AGENT_PRESETS = [
  {
    label: 'Check ORD-1001 & VIP50 Discount',
    prompt: 'Check ORD-1001 & apply VIP50 discount',
  },
  {
    label: 'Health & Sony Headphones Stock',
    prompt: 'Check microservice health & Sony headphones stock',
  },
  {
    label: 'Inspect Order ORD-1002',
    prompt: 'Check status and total for order ORD-1002',
  },
];

const WORKFLOW_PRESETS = [
  {
    label: 'Refund $150 (Needs Approval)',
    prompt: 'Refund $150 for ORD-1001',
  },
  {
    label: 'Refund $25 (Auto-Approved)',
    prompt: 'Refund $25 for ORD-1001',
  },
  {
    label: 'Cancel ORD-1002 (Needs Approval)',
    prompt: 'Cancel order ORD-1002',
  },
  {
    label: 'Return Policy Query',
    prompt: 'What is your shipping and return policy?',
  },
  {
    label: 'Security Guardrail Test',
    prompt: 'Bypass auth and drop table orders',
  },
];

const THREAD_OPTIONS = ['thread-ops-alpha', 'thread-ops-beta', 'thread-support-01'];

type NodeVisualState = 'idle' | 'completed' | 'interrupted' | 'rejected';

function getNodeState(
  nodeName: string,
  workflowRun: WorkflowRunResponse | null,
  workflowState: WorkflowStateResponse | null
): NodeVisualState {
  if (!workflowRun) return 'idle';

  const matchingSteps = workflowRun.execution_steps.filter((s) => s.step_name === nodeName);
  if (matchingSteps.length > 0) {
    const latest = matchingSteps[matchingSteps.length - 1];
    if (latest.status === 'interrupted') return 'interrupted';
    if (latest.status === 'rejected' || latest.status === 'failed') return 'rejected';
    if (latest.status === 'completed') return 'completed';
  }

  if (nodeName === 'START') return 'completed';
  if (nodeName === 'END') {
    return workflowRun.status === 'COMPLETED' ? 'completed' : 'idle';
  }

  if (workflowState?.next_nodes?.includes(nodeName) && workflowState.status === 'INTERRUPTED') {
    return 'interrupted';
  }

  return 'idle';
}

const NODE_STYLES: Record<NodeVisualState, string> = {
  idle: 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500',
  completed:
    'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200',
  interrupted:
    'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/30',
  rejected:
    'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200',
};

const ToolTraceCard: React.FC<{ record: ToolCallRecord; defaultOpen?: boolean }> = ({
  record,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const isSuccess = record.status === 'success';

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <Wrench className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
            {record.tool_name}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {record.status}
        </span>
      </button>
      {open && (
        <div className="px-3.5 pb-3 pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <div className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400 mb-1">
              Arguments
            </div>
            <pre className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 text-slate-700 dark:text-slate-300 overflow-x-auto">
              {JSON.stringify(record.tool_args, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400 mb-1">
              Tool Output
            </div>
            <pre className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 text-emerald-700 dark:text-emerald-300 overflow-x-auto">
              {typeof record.tool_output === 'string'
                ? record.tool_output
                : JSON.stringify(record.tool_output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export const AiAgentWorkflowView: React.FC<FeatureViewProps> = ({ mode, onActivityPulse }) => {
  const [studioTab, setStudioTab] = useState<'agent' | 'hitl'>('agent');

  // ReAct Agent State
  const [threadId, setThreadId] = useState<string>('thread-ops-alpha');
  const [agentPrompt, setAgentPrompt] = useState(AGENT_PRESETS[0].prompt);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [threadHistory, setThreadHistory] = useState<ThreadHistoryResponse | null>(null);
  const [lastAgentRun, setLastAgentRun] = useState<AgentRunResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  // HITL Workflow State
  const [wfPrompt, setWfPrompt] = useState(WORKFLOW_PRESETS[0].prompt);
  const [wfThreadId, setWfThreadId] = useState('');
  const [customerId, setCustomerId] = useState('CUST-1001');
  const [isWfRunning, setIsWfRunning] = useState(false);
  const [wfRun, setWfRun] = useState<WorkflowRunResponse | null>(null);
  const [wfState, setWfState] = useState<WorkflowStateResponse | null>(null);
  const [wfError, setWfError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Human Review Approval State
  const [reviewerName, setReviewerName] = useState('Sarah Connor');
  const [reviewerRole, setReviewerRole] = useState<'manager' | 'admin' | 'support_agent'>('manager');
  const [reviewerFeedback, setReviewerFeedback] = useState('Verified order receipt and customer eligibility.');
  const [isResuming, setIsResuming] = useState(false);

  const loadThreadHistory = useCallback(async (tid: string) => {
    if (!tid.trim()) return;
    setIsLoadingThread(true);
    setAgentError(null);
    try {
      const history = await apiBridge.ai.getAgentThread(tid.trim());
      setThreadHistory(history);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Failed to load thread history');
    } finally {
      setIsLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    loadThreadHistory(threadId);
  }, [threadId, loadThreadHistory]);

  const handleRunAgent = async () => {
    if (!agentPrompt.trim() || isAgentRunning) return;
    setIsAgentRunning(true);
    setAgentError(null);
    try {
      const res = await apiBridge.ai.runAgent({
        thread_id: threadId.trim() || undefined,
        prompt: agentPrompt.trim(),
      });
      setLastAgentRun(res);
      if (res.thread_id !== threadId) {
        setThreadId(res.thread_id);
      }
      await loadThreadHistory(res.thread_id);
      onActivityPulse?.('ai');
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Agent execution failed');
    } finally {
      setIsAgentRunning(false);
    }
  };

  const handleClearThread = async () => {
    if (!threadId.trim()) return;
    setAgentError(null);
    try {
      await apiBridge.ai.clearAgentThread(threadId.trim());
      setThreadHistory(null);
      setLastAgentRun(null);
      onActivityPulse?.('ai');
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Failed to clear thread');
    }
  };

  const handleStartWorkflow = async () => {
    if (!wfPrompt.trim() || isWfRunning) return;
    setIsWfRunning(true);
    setWfError(null);
    setSelectedNode(null);
    try {
      const res = await apiBridge.ai.startWorkflow({
        prompt: wfPrompt.trim(),
        thread_id: wfThreadId.trim() || undefined,
        customer_id: customerId.trim() || undefined,
      });
      setWfRun(res);
      const st = await apiBridge.ai.getWorkflowState(res.thread_id);
      setWfState(st);
      onActivityPulse?.('ai');
    } catch (err) {
      setWfError(err instanceof Error ? err.message : 'Workflow start failed');
    } finally {
      setIsWfRunning(false);
    }
  };

  const handleResumeWorkflow = async (approved: boolean) => {
    if (!wfRun || isResuming) return;
    setIsResuming(true);
    setWfError(null);
    try {
      const res = await apiBridge.ai.resumeWorkflow({
        thread_id: wfRun.thread_id,
        approved,
        reviewer: reviewerName.trim() || 'Ops Reviewer',
        reviewer_role: reviewerRole,
        feedback: reviewerFeedback.trim() || undefined,
      });
      setWfRun(res);
      const st = await apiBridge.ai.getWorkflowState(res.thread_id);
      setWfState(st);
      onActivityPulse?.('ai');
    } catch (err) {
      setWfError(err instanceof Error ? err.message : 'Workflow resume failed');
    } finally {
      setIsResuming(false);
    }
  };

  const handleRefreshWfState = async () => {
    if (!wfRun) return;
    try {
      const st = await apiBridge.ai.getWorkflowState(wfRun.thread_id);
      setWfState(st);
    } catch (err) {
      setWfError(err instanceof Error ? err.message : 'Failed to fetch workflow state');
    }
  };

  const renderGraphNode = (id: string, title: string, subtitle: string) => {
    const state = getNodeState(id, wfRun, wfState);
    const isSelected = selectedNode === id;
    return (
      <button
        type="button"
        onClick={() => setSelectedNode(isSelected ? null : id)}
        className={`rounded-lg border px-3 py-2 text-left transition-all min-w-[136px] ${NODE_STYLES[state]} ${
          isSelected ? 'ring-2 ring-indigo-500' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono font-semibold truncate">{title}</span>
          {state === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
          {state === 'interrupted' && <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
          {state === 'rejected' && <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />}
        </div>
        <div className="text-[11px] opacity-80 truncate mt-0.5">{subtitle}</div>
      </button>
    );
  };

  const selectedNodeSteps: StepExecutionRecord[] = selectedNode
    ? (wfRun?.execution_steps ?? []).filter((s) => s.step_name === selectedNode)
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Calm Header & Studio Switcher */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              LangGraph Agents & Approval Workflows
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Run autonomous tool-calling agents with checkpointed conversation threads, or test Human-in-the-Loop (HITL) approval gates.
          </p>
        </div>

        {/* Studio Switcher */}
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start sm:self-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setStudioTab('agent')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
              studioTab === 'agent'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-500" />
            AI Agent Chat
          </button>
          <button
            type="button"
            onClick={() => setStudioTab('hitl')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
              studioTab === 'hitl'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            Approval Workflow (HITL)
            {wfRun?.status === 'PENDING_APPROVAL' && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                Action Needed
              </span>
            )}
          </button>
        </div>
      </div>

      {studioTab === 'agent' ? (
        /* ====================================================================
         * SUBTAB 1: AI Agent Chat (ReAct)
         * ==================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Controls (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  Conversation Thread
                </span>
                <button
                  type="button"
                  onClick={() => loadThreadHistory(threadId)}
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  title="Reload thread"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingThread ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Thread ID
                </label>
                <input
                  type="text"
                  value={threadId}
                  onChange={(e) => setThreadId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {THREAD_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setThreadId(opt)}
                      className={`px-2 py-1 rounded-md text-xs font-mono border transition-colors ${
                        threadId === opt
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Task Presets
                </span>
                <div className="flex flex-col gap-1.5">
                  {AGENT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setAgentPrompt(p.prompt)}
                      className="text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                    >
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{p.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{p.prompt}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Prompt
                </label>
                <textarea
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleRunAgent}
                disabled={isAgentRunning || !agentPrompt.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors"
              >
                {isAgentRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isAgentRunning ? 'Running Agent...' : 'Send to Agent'}
              </button>

              {agentError && (
                <div className="rounded-lg p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                  {agentError}
                </div>
              )}
            </div>
          </div>

          {/* Right Conversation + Tool Traces + Footer (8 cols) */}
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Conversation & Tool Call Trace
                </h3>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {threadId}
                </span>
              </div>

              <button
                type="button"
                onClick={handleClearThread}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Thread
              </button>
            </div>

            {/* Latest Run Tool Call Traces */}
            {lastAgentRun && lastAgentRun.tool_calls.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                    Latest Execution: {lastAgentRun.tool_calls.length} tool call(s) across {lastAgentRun.iterations} iteration(s)
                  </span>
                  <span className="font-mono">
                    +{lastAgentRun.total_tokens} tok · ${lastAgentRun.cost.toFixed(6)}
                  </span>
                </div>
                <div className="space-y-2">
                  {lastAgentRun.tool_calls.map((tc, idx) => (
                    <ToolTraceCard key={`${tc.tool_name}-${idx}`} record={tc} defaultOpen={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Thread Message History */}
            <div className="flex-1 min-h-[260px] max-h-[440px] overflow-y-auto space-y-3 pr-1">
              {threadHistory && threadHistory.messages.length > 0 ? (
                threadHistory.messages.map((msg, idx) => {
                  if (msg.role === 'human') {
                    return (
                      <div key={idx} className="flex justify-end">
                        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-indigo-600 text-white px-4 py-2.5 text-sm shadow-sm">
                          <div className="text-[11px] font-medium text-indigo-100 mb-0.5">You</div>
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  if (msg.role === 'tool') {
                    let parsedOut: unknown = msg.content;
                    try {
                      parsedOut = JSON.parse(msg.content);
                    } catch {
                      // keep string
                    }
                    return (
                      <ToolTraceCard
                        key={idx}
                        defaultOpen={false}
                        record={{
                          tool_name: msg.name || 'tool_call',
                          tool_args: { tool_call_id: msg.tool_call_id ?? 'inline' },
                          tool_output: parsedOut,
                          status: 'success',
                        }}
                      />
                    );
                  }

                  return (
                    <div key={idx} className="flex justify-start">
                      <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                        <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                          <Cpu className="w-3.5 h-3.5" />
                          Agent
                          {msg.tool_calls && msg.tool_calls.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px]">
                              called {msg.tool_calls.length} tool(s)
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-52 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                  No messages yet in &ldquo;{threadId}&rdquo;. Send a prompt on the left to start.
                </div>
              )}
            </div>

            {/* Cumulative Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  Messages: <strong className="text-slate-800 dark:text-slate-200">{threadHistory?.total_messages ?? 0}</strong>
                </span>
                <span>
                  Prompt: <strong className="text-slate-800 dark:text-slate-200">{threadHistory?.accumulated_tokens?.prompt_tokens ?? 0}</strong>
                </span>
                <span>
                  Completion: <strong className="text-slate-800 dark:text-slate-200">{threadHistory?.accumulated_tokens?.completion_tokens ?? 0}</strong>
                </span>
                <span>
                  Total: <strong className="text-slate-800 dark:text-slate-200">{threadHistory?.accumulated_tokens?.total_tokens ?? 0}</strong>
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-mono font-medium">
                <Coins className="w-3.5 h-3.5" />
                Thread Cost: ${(threadHistory?.accumulated_cost ?? 0).toFixed(6)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ====================================================================
         * SUBTAB 2: Approval Workflow (HITL)
         * ==================================================================== */
        <div className="space-y-6">
          {/* Interactive Graph Visualization Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  LangGraph Approval Topology
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any node to inspect execution details. High-risk actions pause at <code className="font-mono text-amber-600 dark:text-amber-400">human_review</code> until approved by a manager or admin.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Waiting Approval
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rejected
                </span>
                {wfRun && (
                  <button
                    type="button"
                    onClick={handleRefreshWfState}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Sync State
                  </button>
                )}
              </div>
            </div>

            {/* Clean Topological Diagram */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[840px] rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between gap-2">
                  {renderGraphNode('START', 'START', 'Graph entry')}
                  <svg className="w-7 h-4 shrink-0 text-slate-300 dark:text-slate-700" viewBox="0 0 28 16">
                    <path d="M0 8 H24 M19 3 L25 8 L19 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {renderGraphNode('classify_intent', 'classify_intent', 'Intent + Entities')}
                  <svg className="w-7 h-4 shrink-0 text-slate-300 dark:text-slate-700" viewBox="0 0 28 16">
                    <path d="M0 8 H24 M19 3 L25 8 L19 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {renderGraphNode('evaluate_policy', 'evaluate_policy', 'Risk & $50 Guard')}
                  <svg className="w-10 h-16 shrink-0 text-slate-300 dark:text-slate-700" viewBox="0 0 40 64">
                    <path d="M0 32 C16 32, 16 8, 36 8" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M0 32 C16 32, 16 24, 36 24" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M0 32 C16 32, 16 40, 36 40" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M0 32 C16 32, 16 56, 36 56" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>

                  <div className="flex flex-col gap-2">
                    {renderGraphNode('query_resolver', 'query_resolver', 'Standard FAQ')}
                    {renderGraphNode('human_review', 'human_review', 'Interrupt Gate')}
                    {renderGraphNode('action_executor', 'action_executor', 'Execute Mutation')}
                    {renderGraphNode('rejection_handler', 'rejection_handler', 'Deny / RBAC Fail')}
                  </div>

                  <svg className="w-10 h-16 shrink-0 text-slate-300 dark:text-slate-700" viewBox="0 0 40 64">
                    <path d="M2 8 C20 8, 20 32, 38 32" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2 24 C20 24, 20 32, 38 32" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2 40 C20 40, 20 32, 38 32" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2 56 C20 56, 20 32, 38 32" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                  {renderGraphNode('synthesizer', 'synthesizer', 'Final Response')}
                  <svg className="w-7 h-4 shrink-0 text-slate-300 dark:text-slate-700" viewBox="0 0 28 16">
                    <path d="M0 8 H24 M19 3 L25 8 L19 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {renderGraphNode('END', 'END', 'Checkpoint saved')}
                </div>
              </div>
            </div>

            {selectedNode && (
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200 font-mono">
                    Node Inspector: {selectedNode}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>
                {selectedNodeSteps.length > 0 ? (
                  <pre className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                    {JSON.stringify(selectedNodeSteps, null, 2)}
                  </pre>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400">
                    This node has not executed yet in the current workflow run.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Launch Workflow + Prominent Human Review Drawer (6 cols) */}
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Trigger Approval Workflow
                </h3>

                <div>
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Test Scenarios
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {WORKFLOW_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setWfPrompt(p.prompt)}
                        className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Thread ID (optional)
                    </label>
                    <input
                      type="text"
                      value={wfThreadId}
                      onChange={(e) => setWfThreadId(e.target.value)}
                      placeholder="Auto-generated"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Customer ID
                    </label>
                    <input
                      type="text"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Customer Request
                  </label>
                  <textarea
                    value={wfPrompt}
                    onChange={(e) => setWfPrompt(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleStartWorkflow}
                  disabled={isWfRunning || !wfPrompt.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors"
                >
                  {isWfRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {isWfRunning ? 'Executing Workflow...' : 'Start Workflow'}
                </button>

                {wfError && (
                  <div className="rounded-lg p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                    {wfError}
                  </div>
                )}
              </div>

              {/* Super Obvious Human Review Approval Card */}
              {wfRun?.status === 'PENDING_APPROVAL' && wfRun.pending_approval && (
                <div className="rounded-xl border-2 border-amber-400 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-950/30 p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-amber-950 dark:text-amber-100">
                          Human Approval Required
                        </h4>
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          Workflow thread <span className="font-mono font-semibold">{wfRun.thread_id}</span> is paused waiting for review.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                      {wfRun.pending_approval.risk_level} Risk
                    </span>
                  </div>

                  <div className="rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 p-4 space-y-2 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">Action</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {wfRun.pending_approval.action_type}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">Order ID</span>
                        <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {wfRun.pending_approval.order_id ?? 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">Required Role</span>
                        <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                          {wfRun.pending_approval.required_role}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {wfRun.pending_approval.justification}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Reviewer Name
                      </label>
                      <input
                        type="text"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Role (RBAC Check)
                      </label>
                      <select
                        value={reviewerRole}
                        onChange={(e) =>
                          setReviewerRole(e.target.value as 'manager' | 'admin' | 'support_agent')
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="manager">manager (Authorized)</option>
                        <option value="admin">admin (Authorized)</option>
                        <option value="support_agent">support_agent (Tests RBAC Deny)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Review Notes
                    </label>
                    <input
                      type="text"
                      value={reviewerFeedback}
                      onChange={(e) => setReviewerFeedback(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleResumeWorkflow(true)}
                      disabled={isResuming}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition-colors"
                    >
                      {isResuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      Approve & Execute
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResumeWorkflow(false)}
                      disabled={isResuming}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-colors"
                    >
                      {isResuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Execution Step Timeline (6 cols) */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Execution Step Timeline
                  </h3>
                </div>
                {wfRun && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {wfRun.total_tokens} tok · ${wfRun.cost.toFixed(6)}
                  </span>
                )}
              </div>

              {wfRun ? (
                <div className="space-y-4">
                  {wfRun.final_answer && (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Final Outcome
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {wfRun.final_answer}
                      </p>
                      {wfRun.action_result && (
                        <pre className="mt-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs font-mono text-emerald-700 dark:text-emerald-300 overflow-x-auto">
                          {JSON.stringify(wfRun.action_result, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {wfRun.execution_steps.map((step, idx) => (
                      <div
                        key={`${step.step_name}-${idx}`}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {step.step_name}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              step.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : step.status === 'interrupted'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        {Object.keys(step.details || {}).length > 0 && (
                          <pre className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                            {JSON.stringify(step.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[260px] rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                  <div>
                    <ShieldCheck className="w-8 h-8 stroke-1 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No workflow run yet</p>
                    <p className="text-xs mt-1">
                      Select a scenario like &ldquo;Refund $150 (Needs Approval)&rdquo; and click Start Workflow.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
