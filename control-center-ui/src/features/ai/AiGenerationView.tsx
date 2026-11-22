import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Star,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { apiBridge } from '../../services/bridge';
import type {
  FeatureViewProps,
  LLMResponse,
  SentimentAnalysisResponse,
  StreamMetrics,
} from '../../types';

const PROMPT_PRESETS = [
  {
    label: 'Rate Limiting & Idempotency',
    prompt: 'Explain how the Orders Service uses Redis fixed-window rate limiting, SETNX idempotency keys, and Kafka events.',
  },
  {
    label: '4-Stage RAG Overview',
    prompt: 'How does the 4-stage RAG pipeline combine dense search, BM25, RRF fusion, and Cross-Encoder reranking?',
  },
  {
    label: 'LangGraph HITL Governance',
    prompt: 'Describe how the LangGraph HITL workflow interrupts high-risk refunds and enforces manager RBAC.',
  },
  {
    label: 'Gateway Resilience',
    prompt: 'Summarize the semantic cache, TPM sliding window, and circuit breaker fallback strategy.',
  },
];

const REVIEW_PRESETS = [
  {
    label: 'Defective Headset (Refund Needed)',
    text: 'I bought the Sony WH-1000XM5 Wireless Headphones last week. The left ear ANC stopped working completely after 2 days and the hinge feels loose. Extremely disappointed — I want a full refund immediately.',
  },
  {
    label: 'MacBook Pro (5-Star Praise)',
    text: 'The Apple MacBook Pro 14" M4 is amazing! Battery life easily lasts full workdays, the display is razor-sharp, and compile times are blazingly fast. Best workstation upgrade I have made.',
  },
  {
    label: 'Mechanical Keyboard (Mixed Review)',
    text: 'The Keychron Q1 Pro Mechanical Keyboard has solid aluminum build quality and smooth switches, but keycaps feel slightly slippery and price is a bit high for everyday office typing.',
  },
];

export const AiGenerationView: React.FC<FeatureViewProps> = ({ mode, onActivityPulse }) => {
  // Top-level subtab to keep screen calm and uncluttered
  const [activeTab, setActiveTab] = useState<'generation' | 'sentiment'>('generation');

  // Generation Playground State
  const [execMode, setExecMode] = useState<'stream' | 'chat'>('stream');
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0].prompt);
  const [isRunning, setIsRunning] = useState(false);
  const [outputText, setOutputText] = useState('');
  const [chatResult, setChatResult] = useState<LLMResponse | null>(null);
  const [streamMetrics, setStreamMetrics] = useState<StreamMetrics | null>(null);
  const [liveTtftMs, setLiveTtftMs] = useState<number | null>(null);
  const [liveChunks, setLiveChunks] = useState<number>(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sentiment State
  const [feedback, setFeedback] = useState(REVIEW_PRESETS[0].text);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sentimentResult, setSentimentResult] = useState<SentimentAnalysisResponse | null>(null);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleRunPlayground = async () => {
    if (!prompt.trim() || isRunning) return;

    setStreamError(null);
    setOutputText('');
    setChatResult(null);
    setStreamMetrics(null);
    setLiveTtftMs(null);
    setLiveChunks(0);
    setIsRunning(true);

    if (execMode === 'stream') {
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();
      let firstTokenRecorded = false;

      try {
        await apiBridge.ai.streamChat(prompt, {
          signal: controller.signal,
          onToken: (chunk) => {
            if (!firstTokenRecorded) {
              firstTokenRecorded = true;
              setLiveTtftMs(Math.round(performance.now() - startedAt));
            }
            setLiveChunks((prev) => prev + 1);
            setOutputText((prev) => prev + chunk);
          },
          onMetrics: (metrics) => {
            setStreamMetrics(metrics);
            if (metrics.ttft_ms !== null) {
              setLiveTtftMs(metrics.ttft_ms);
            }
            setLiveChunks(metrics.total_chunks);
          },
          onError: (errMsg) => {
            setStreamError(errMsg);
          },
        });
        onActivityPulse?.('ai');
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : 'Streaming request failed');
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    } else {
      const startedAt = performance.now();
      try {
        const res = await apiBridge.ai.chat(prompt);
        setLiveTtftMs(Math.round(performance.now() - startedAt));
        setChatResult(res);
        setOutputText(res.content);
        onActivityPulse?.('ai');
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : 'Chat request failed');
      } finally {
        setIsRunning(false);
      }
    }
  };

  const handleStopStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
  };

  const handleClearPlayground = () => {
    setOutputText('');
    setChatResult(null);
    setStreamMetrics(null);
    setLiveTtftMs(null);
    setLiveChunks(0);
    setStreamError(null);
  };

  const handleAnalyzeSentiment = async () => {
    if (!feedback.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setSentimentError(null);
    try {
      const res = await apiBridge.ai.analyzeSentiment(feedback);
      setSentimentResult(res);
      onActivityPulse?.('ai');
    } catch (err) {
      setSentimentError(err instanceof Error ? err.message : 'Sentiment analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const displayedPromptTokens =
    execMode === 'stream' ? streamMetrics?.prompt_tokens ?? null : chatResult?.prompt_tokens ?? null;
  const displayedCompletionTokens =
    execMode === 'stream' ? streamMetrics?.completion_tokens ?? null : chatResult?.completion_tokens ?? null;
  const displayedCost =
    execMode === 'stream' ? streamMetrics?.cost_usd ?? null : chatResult?.cost ?? null;
  const isCacheHit =
    execMode === 'chat' &&
    chatResult !== null &&
    chatResult.cost === 0 &&
    chatResult.total_tokens === 0 &&
    chatResult.content.includes('Semantic Cache HIT');

  const analysis = sentimentResult?.analysis;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Calm Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              AI Generation & Sentiment Studio
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Test Server-Sent Events (SSE) streaming with live Time-To-First-Token metrics, or analyze customer feedback with structured Pydantic schemas.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start sm:self-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('generation')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'generation'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            Chat & SSE Streaming
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sentiment')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'sentiment'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-500" />
            Sentiment Analyzer
          </button>
        </div>
      </div>

      {/* Mode Status Pill */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
          Operating in <strong className="text-slate-700 dark:text-slate-300 font-medium">{mode === 'live' ? 'Live Gateway Proxy Mode' : 'In-Memory Simulator Mode'}</strong>
        </span>
        <span>LiteLLM + FastAPI Engine</span>
      </div>

      {activeTab === 'generation' ? (
        /* ====================================================================
         * SUBTAB 1: Chat & SSE Streaming Playground
         * ==================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Prompt Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Execution Mode
                </span>
                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setExecMode('stream')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      execMode === 'stream'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    Stream SSE
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecMode('chat')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      execMode === 'chat'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Bot className="w-3 h-3" />
                    Standard Chat
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Prompt Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPrompt(p.prompt)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Enter a prompt to send to the LLM Gateway..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {execMode === 'stream'
                    ? 'Receives chunk events via SSE with live Time-To-First-Token tracking.'
                    : 'Tip: Repeat the exact prompt in Standard Chat to see Semantic Cache return in 0ms!'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                {isRunning && execMode === 'stream' ? (
                  <button
                    type="button"
                    onClick={handleStopStream}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop Generation
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRunPlayground}
                    disabled={isRunning || !prompt.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors"
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    {isRunning ? 'Processing...' : execMode === 'stream' ? 'Stream Response' : 'Send Chat'}
                  </button>
                )}

                {outputText && (
                  <button
                    type="button"
                    onClick={handleClearPlayground}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    title="Clear response"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {streamError && (
                <div className="rounded-lg p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                  {streamError}
                </div>
              )}
            </div>
          </div>

          {/* Right: Telemetry & Live Output Buffer (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Metric Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{execMode === 'stream' ? 'TTFT (ms)' : 'Latency'}</span>
                </div>
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {liveTtftMs !== null ? `${liveTtftMs} ms` : '—'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Chunks</span>
                </div>
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {execMode === 'stream' ? liveChunks : chatResult ? 1 : '—'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Tokens (P / C)</span>
                </div>
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {displayedPromptTokens !== null && displayedCompletionTokens !== null
                    ? `${displayedPromptTokens} / ${displayedCompletionTokens}`
                    : '—'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>Est. Cost</span>
                </div>
                <div className="text-base font-semibold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {displayedCost !== null ? `$${displayedCost.toFixed(6)}` : '—'}
                </div>
              </div>
            </div>

            {/* Output Stream Canvas */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col min-h-[340px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Model Response Buffer
                </span>
                {isCacheHit && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Semantic Cache Hit ($0.00)
                  </span>
                )}
                {streamMetrics && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Total {streamMetrics.total_duration_ms}ms · {streamMetrics.total_tokens} tokens
                  </span>
                )}
              </div>

              <div className="flex-1">
                {outputText ? (
                  <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {outputText}
                    {isRunning && execMode === 'stream' && (
                      <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 dark:bg-indigo-400 align-middle animate-pulse" />
                    )}
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
                    <Bot className="w-8 h-8 stroke-1 mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm">Ready to generate. Select a preset and run to observe token streaming.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ====================================================================
         * SUBTAB 2: Product Sentiment Analyzer
         * ==================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Input & Presets (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Sample Customer Reviews
                </span>
                <div className="flex flex-col gap-1.5">
                  {REVIEW_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setFeedback(p.text)}
                      className="text-left px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{p.label}</div>
                      <div className="text-slate-500 dark:text-slate-400 truncate mt-0.5">{p.text}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Review Text to Analyze
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  placeholder="Paste a customer product review to extract structured sentiment..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={handleAnalyzeSentiment}
                disabled={isAnalyzing || !feedback.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-sm transition-colors"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isAnalyzing ? 'Extracting Sentiment Schema...' : 'Analyze Feedback'}
              </button>

              {sentimentError && (
                <div className="rounded-lg p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                  {sentimentError}
                </div>
              )}
            </div>
          </div>

          {/* Right: Structured Output Card (7 cols) */}
          <div className="lg:col-span-7">
            {analysis ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
                {/* Flashing Refund Alert if true, else calm clear badge */}
                {analysis.requires_refund ? (
                  <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-rose-800 dark:text-rose-200">
                          REFUND REQUIRED
                        </div>
                        <div className="text-xs text-rose-600 dark:text-rose-400">
                          Customer expresses critical dissatisfaction or explicit refund demand. Flagged for HITL escalation.
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase bg-rose-600 text-white shrink-0">
                      High Priority
                    </span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>No refund required. Standard product review workflow applies.</span>
                  </div>
                )}

                {/* Product Name & Sentiment Pill */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Identified Product</span>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {analysis.product_name}
                    </h3>
                  </div>
                  <span
                    className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold border ${
                      analysis.sentiment.toLowerCase() === 'positive'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : analysis.sentiment.toLowerCase() === 'negative'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {analysis.sentiment} Sentiment
                  </span>
                </div>

                {/* 1-5 Star Rating */}
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Customer Rating</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= analysis.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                      {analysis.rating} / 5
                    </span>
                  </div>
                </div>

                {/* Pros & Cons Tag Lists */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Pros ({analysis.pros.length})
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {analysis.pros.length > 0 ? (
                        analysis.pros.map((p, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            + {p}
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">None mentioned</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <ThumbsDown className="w-3.5 h-3.5" />
                      Cons ({analysis.cons.length})
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {analysis.cons.length > 0 ? (
                        analysis.cons.map((c, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1.5 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          >
                            - {c}
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No negative points</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tokens Footer */}
                {sentimentResult && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span>Extraction Tokens: {sentimentResult.total_tokens}</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      Cost: ${sentimentResult.cost.toFixed(6)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-12 text-center text-slate-400 dark:text-slate-500">
                <Star className="w-8 h-8 stroke-1 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No analysis performed yet
                </p>
                <p className="text-xs mt-1">
                  Pick a sample customer review on the left and click &ldquo;Analyze Feedback&rdquo;.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
