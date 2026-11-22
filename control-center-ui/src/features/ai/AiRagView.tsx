import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Database,
  FilePlus2,
  Filter,
  GitBranch,
  Layers,
  Loader2,
  Search,
  Sparkles,
  Tag,
  Terminal,
} from 'lucide-react';
import { apiBridge } from '../../services/bridge';
import type {
  AskResponse,
  FeatureViewProps,
  IngestResponse,
  LlamaIndexAskResponse,
  SearchChunkResult,
  SearchResponse,
  SourceMetadata,
} from '../../types';

const SAMPLE_DOCS = [
  {
    label: 'Orders Rate Limiting & Kafka',
    document_name: 'orders-resilience.md',
    content:
      'The Orders microservice uses a Redis Lua script to enforce a fixed-window rate limit of 10 requests per 60 seconds per client IP. Order creation requires an Idempotency-Key locked with Redis SETNX for 24 hours. Upon commit, the service emits an OrderCreatedEvent to the Kafka topic order-created-events for asynchronous email dispatch.',
    metadata: '{"category": "messaging", "service": "orders-service"}',
  },
  {
    label: 'Return & VIP50 Promo Policy',
    document_name: 'customer-support-policy.md',
    content:
      'Customers receive a 30-day return window for unopened electronics. Promo code VIP50 provides a 50% discount up to $100 on eligible accessories. Refunds up to $50 are auto-approved, while refunds above $50, order cancellations, and shipping address changes require manager or admin approval.',
    metadata: '{"category": "policy", "service": "support"}',
  },
  {
    label: 'PgVector & ChromaDB Tuning',
    document_name: 'vector-storage-tuning.md',
    content:
      'ChromaDB HNSW cosine similarity indexes are tuned with ef_construction=200 and M=16 for sub-25ms dense vector lookup. PostgreSQL 16 HikariCP pools run with maximum-pool-size=20 to prevent connection exhaustion under high concurrency bursts.',
    metadata: '{"category": "database", "service": "storage"}',
  },
];

const SAMPLE_QUESTIONS = [
  'How does rate limiting and Kafka idempotency work in Orders Service?',
  'Explain the 4-stage RAG pipeline with BM25, RRF, and Cross-Encoder reranking.',
  'What is the VIP50 promo policy and refund approval threshold?',
];

const LLAMA_FILTER_PRESETS = [
  '{"category": "database"}',
  '{"category": "security"}',
  '{"category": "messaging"}',
  '{}',
];

interface NormalizedChunkCard {
  document_name: string;
  text: string;
  distance?: number | null;
  bm25_score?: number | null;
  rrf_score?: number | null;
  rerank_score?: number | null;
}

const ScoreBar: React.FC<{
  label: string;
  pct: number;
  colorClass: string;
  formatted: string;
}> = ({ label, pct, colorClass, formatted }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs font-mono">
      <span className="text-slate-500 dark:text-slate-400 uppercase">{label}</span>
      <span className="text-slate-800 dark:text-slate-200 font-semibold">{formatted}</span>
    </div>
    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
      />
    </div>
  </div>
);

export const AiRagView: React.FC<FeatureViewProps> = ({ mode, onActivityPulse }) => {
  // Step/Subtab navigation for effortless task-focused UX
  const [activeStep, setActiveStep] = useState<'retrieval' | 'ingest'>('retrieval');

  // Ingest state
  const [ingestEngine, setIngestEngine] = useState<'standard' | 'llamaindex'>('standard');
  const [docName, setDocName] = useState(SAMPLE_DOCS[0].document_name);
  const [docContent, setDocContent] = useState(SAMPLE_DOCS[0].content);
  const [chunkMethod, setChunkMethod] = useState<'semantic' | 'fixed'>('semantic');
  const [llamaMetaJson, setLlamaMetaJson] = useState(SAMPLE_DOCS[0].metadata);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Retrieval state
  const [queryEngine, setQueryEngine] = useState<'hybrid4' | 'llamaindex'>('hybrid4');
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [limit, setLimit] = useState(3);
  const [useQueryExpansion, setUseQueryExpansion] = useState(true);
  const [useHybrid, setUseHybrid] = useState(true);
  const [useReranker, setUseReranker] = useState(true);
  const [llamaFilterJson, setLlamaFilterJson] = useState('{"category": "database"}');

  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [llamaResponse, setLlamaResponse] = useState<LlamaIndexAskResponse | null>(null);

  const loadSampleDoc = (doc: (typeof SAMPLE_DOCS)[number]) => {
    setDocName(doc.document_name);
    setDocContent(doc.content);
    setLlamaMetaJson(doc.metadata);
  };

  const handleIngest = async () => {
    if (!docName.trim() || !docContent.trim() || isIngesting) return;
    setIsIngesting(true);
    setIngestError(null);
    setIngestResult(null);

    try {
      if (ingestEngine === 'standard') {
        const res = await apiBridge.ai.ingestRag({
          document_name: docName.trim(),
          content: docContent.trim(),
          method: chunkMethod,
        });
        setIngestResult(res);
      } else {
        let parsedMeta: Record<string, unknown> = {};
        if (llamaMetaJson.trim()) {
          try {
            parsedMeta = JSON.parse(llamaMetaJson);
          } catch {
            throw new Error('Metadata JSON is invalid. Example: {"category": "database"}');
          }
        }
        const res = await apiBridge.ai.ingestLlamaIndex({
          document_name: docName.trim(),
          content: docContent.trim(),
          metadata: parsedMeta,
        });
        setIngestResult(res);
      }
      onActivityPulse?.('ai');
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleAskRag = async () => {
    if (!question.trim() || isQuerying) return;
    setIsQuerying(true);
    setQueryError(null);
    setSearchResponse(null);
    setLlamaResponse(null);

    try {
      const res = await apiBridge.ai.askRag({
        question: question.trim(),
        limit,
        use_query_expansion: useQueryExpansion,
        use_hybrid: useHybrid,
        use_reranker: useReranker,
      });
      setAskResponse(res);
      onActivityPulse?.('ai');
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'RAG query failed');
    } finally {
      setIsQuerying(false);
    }
  };

  const handleInspectChunks = async () => {
    if (!question.trim() || isQuerying) return;
    setIsQuerying(true);
    setQueryError(null);
    setAskResponse(null);
    setLlamaResponse(null);

    try {
      const res = await apiBridge.ai.searchRag({
        question: question.trim(),
        limit,
        use_query_expansion: useQueryExpansion,
        use_hybrid: useHybrid,
        use_reranker: useReranker,
      });
      setSearchResponse(res);
      onActivityPulse?.('ai');
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Chunk inspection failed');
    } finally {
      setIsQuerying(false);
    }
  };

  const handleAskLlamaIndex = async () => {
    if (!question.trim() || isQuerying) return;
    setIsQuerying(true);
    setQueryError(null);
    setAskResponse(null);
    setSearchResponse(null);

    try {
      let parsedFilters: Record<string, unknown> = {};
      if (llamaFilterJson.trim()) {
        try {
          parsedFilters = JSON.parse(llamaFilterJson);
        } catch {
          throw new Error('Metadata Filter JSON is invalid. Example: {"category": "database"}');
        }
      }
      const res = await apiBridge.ai.askLlamaIndex({
        question: question.trim(),
        limit,
        filters: parsedFilters,
      });
      setLlamaResponse(res);
      onActivityPulse?.('ai');
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'LlamaIndex query failed');
    } finally {
      setIsQuerying(false);
    }
  };

  const expandedQueries: string[] =
    askResponse?.expanded_queries ?? searchResponse?.expanded_queries ?? [];

  const normalizedChunks: NormalizedChunkCard[] = searchResponse
    ? searchResponse.chunks.map((c: SearchChunkResult) => ({
        document_name: c.document_name,
        text: c.text_content || c.snippet,
        distance: c.distance,
        bm25_score: c.bm25_score,
        rrf_score: c.rrf_score,
        rerank_score: c.rerank_score,
      }))
    : askResponse
      ? askResponse.sources.map((s: SourceMetadata) => ({
          document_name: s.document_name,
          text: s.snippet,
          distance: s.distance,
          bm25_score: null,
          rrf_score: s.rrf_score,
          rerank_score: s.rerank_score,
        }))
      : llamaResponse
        ? llamaResponse.sources.map((s: SourceMetadata) => ({
            document_name: s.document_name,
            text: s.snippet,
            distance: s.distance,
            bm25_score: null,
            rrf_score: s.rrf_score,
            rerank_score: s.rerank_score,
          }))
        : [];

  const activeAnswer = askResponse?.answer ?? llamaResponse?.answer ?? null;
  const activeUsage = askResponse ?? llamaResponse ?? null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Calm Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              4-Stage Hybrid RAG & LlamaIndex Studio
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Explore Query Expansion, Dense Vector + BM25 Reciprocal Rank Fusion (RRF), and Cross-Encoder neural reranking with complete score observability.
          </p>
        </div>

        {/* 2-Step Workflow Tabs */}
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start sm:self-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveStep('retrieval')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
              activeStep === 'retrieval'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-indigo-500" />
            1. Ask & Inspect Pipeline
          </button>
          <button
            type="button"
            onClick={() => setActiveStep('ingest')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
              activeStep === 'ingest'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FilePlus2 className="w-3.5 h-3.5 text-emerald-500" />
            2. Ingest Workbench
          </button>
        </div>
      </div>

      {activeStep === 'retrieval' ? (
        /* ====================================================================
         * STEP 1: Ask & Pipeline Inspector
         * ==================================================================== */
        <div className="space-y-6">
          {/* Query & Pipeline Settings Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Retrieval Pipeline Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure retrieval mode, pipeline stages, and similarity thresholds.
                </p>
              </div>

              {/* Engine Switcher */}
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setQueryEngine('hybrid4')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    queryEngine === 'hybrid4'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  4-Stage Hybrid RAG
                </button>
                <button
                  type="button"
                  onClick={() => setQueryEngine('llamaindex')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    queryEngine === 'llamaindex'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  LlamaIndex Metadata Filters
                </button>
              </div>
            </div>

            {/* Query Presets */}
            <div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                Preset Questions
              </span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuestion(q)}
                    className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                  >
                    Question #{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Input + Limit */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question grounded in the knowledge base..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Top-K:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  {[2, 3, 5, 8].map((k) => (
                    <option key={k} value={k} className="bg-white dark:bg-slate-900">
                      {k} chunks
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4-Stage Toggles OR LlamaIndex Metadata Input */}
            {queryEngine === 'hybrid4' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setUseQueryExpansion(!useQueryExpansion)}
                  className={`p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 ${
                    useQueryExpansion
                      ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-70'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Stage 1: Query Expansion
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Paraphrases query into 3 complementary search angles
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      useQueryExpansion
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-400 bg-transparent'
                    }`}
                  >
                    {useQueryExpansion && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUseHybrid(!useHybrid)}
                  className={`p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 ${
                    useHybrid
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-70'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Stages 2 & 3: Hybrid + RRF
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Fuses ChromaDB Dense Vector + BM25 Lexical (k=60)
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      useHybrid
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-400 bg-transparent'
                    }`}
                  >
                    {useHybrid && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUseReranker(!useReranker)}
                  className={`p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 ${
                    useReranker
                      ? 'border-violet-300 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-70'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Stage 4: Cross-Encoder
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Neural cross-attention model rescores top chunks
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      useReranker
                        ? 'border-violet-600 bg-violet-600 text-white'
                        : 'border-slate-400 bg-transparent'
                    }`}
                  >
                    {useReranker && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    LlamaIndex Exact Metadata Filter (JSON)
                  </span>
                  <div className="flex gap-1">
                    {LLAMA_FILTER_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLlamaFilterJson(p)}
                        className="px-2 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={llamaFilterJson}
                  onChange={(e) => setLlamaFilterJson(e.target.value)}
                  placeholder='{"category": "database"}'
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Run Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {queryEngine === 'hybrid4' ? (
                <>
                  <button
                    type="button"
                    onClick={handleAskRag}
                    disabled={isQuerying || !question.trim()}
                    className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors"
                  >
                    {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Ask + Synthesize Answer
                  </button>
                  <button
                    type="button"
                    onClick={handleInspectChunks}
                    disabled={isQuerying || !question.trim()}
                    className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Inspect Chunks & Scores Only
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleAskLlamaIndex}
                  disabled={isQuerying || !question.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors"
                >
                  {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                  Execute LlamaIndex Filter Query
                </button>
              )}
            </div>

            {queryError && (
              <div className="rounded-lg p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                {queryError}
              </div>
            )}
          </div>

          {/* Expanded Queries Card (Stage 1) */}
          {expandedQueries.length > 0 && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-2">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                Stage 1 Expanded Query Paraphrases ({expandedQueries.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {expandedQueries.map((eq, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-md text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-medium"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Synthesized Answer Card */}
          {activeAnswer && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Terminal className="w-3.5 h-3.5" />
                  Synthesized Grounded Answer
                </span>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  {askResponse && (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-medium">
                      {askResponse.retrieval_method}
                    </span>
                  )}
                  {activeUsage && (
                    <span className="font-mono">
                      {activeUsage.total_tokens} tokens · ${activeUsage.cost.toFixed(6)}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {activeAnswer}
              </p>
            </div>
          )}

          {/* Retrieved Chunks with Visual Score Bars */}
          {normalizedChunks.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Retrieved Chunks & Stage Scores ({normalizedChunks.length})
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Lower distance = closer semantic cosine proximity
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {normalizedChunks.map((chunk, idx) => {
                  const similarityPct =
                    chunk.distance !== null && chunk.distance !== undefined
                      ? Math.max(5, Math.min(100, (1 - chunk.distance) * 100))
                      : 0;
                  const bm25Pct =
                    chunk.bm25_score !== null && chunk.bm25_score !== undefined
                      ? Math.min(100, (chunk.bm25_score / 10) * 100)
                      : 0;
                  const rrfPct =
                    chunk.rrf_score !== null && chunk.rrf_score !== undefined
                      ? Math.min(100, (chunk.rrf_score / 0.05) * 100)
                      : 0;
                  const rerankPct =
                    chunk.rerank_score !== null && chunk.rerank_score !== undefined
                      ? Math.max(0, Math.min(100, chunk.rerank_score * 100))
                      : 0;

                  return (
                    <div
                      key={`${chunk.document_name}-${idx}`}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {chunk.document_name}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        {chunk.text}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                        {chunk.distance !== null && chunk.distance !== undefined && (
                          <ScoreBar
                            label="Cosine Distance"
                            pct={similarityPct}
                            colorClass="bg-indigo-500 dark:bg-indigo-400"
                            formatted={chunk.distance.toFixed(3)}
                          />
                        )}
                        {chunk.bm25_score !== null && chunk.bm25_score !== undefined && (
                          <ScoreBar
                            label="BM25 Lexical"
                            pct={bm25Pct}
                            colorClass="bg-amber-500 dark:bg-amber-400"
                            formatted={chunk.bm25_score.toFixed(3)}
                          />
                        )}
                        {chunk.rrf_score !== null && chunk.rrf_score !== undefined && (
                          <ScoreBar
                            label="RRF Score (k=60)"
                            pct={rrfPct}
                            colorClass="bg-emerald-500 dark:bg-emerald-400"
                            formatted={chunk.rrf_score.toFixed(4)}
                          />
                        )}
                        {chunk.rerank_score !== null && chunk.rerank_score !== undefined && (
                          <ScoreBar
                            label="Cross-Encoder"
                            pct={rerankPct}
                            colorClass="bg-violet-500 dark:bg-violet-400"
                            formatted={chunk.rerank_score.toFixed(3)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-12 text-center text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 stroke-1 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Ready to search
              </p>
              <p className="text-xs mt-1">
                Click &ldquo;Ask + Synthesize Answer&rdquo; or &ldquo;Inspect Chunks & Scores Only&rdquo; above to run the hybrid retrieval pipeline.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ====================================================================
         * STEP 2: Ingest Workbench
         * ==================================================================== */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Ingest Documents into Vector Store
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Embed architecture documents, API guides, or knowledge articles with semantic or fixed chunking.
              </p>
            </div>

            {/* Ingest Engine Switcher */}
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setIngestEngine('standard')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  ingestEngine === 'standard'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Standard RAG Store
              </button>
              <button
                type="button"
                onClick={() => setIngestEngine('llamaindex')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  ingestEngine === 'llamaindex'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                LlamaIndex Node Store
              </button>
            </div>
          </div>

          {/* Sample Loaders */}
          <div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
              Load Sample Architecture Documents
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_DOCS.map((doc) => (
                <button
                  key={doc.document_name}
                  type="button"
                  onClick={() => loadSampleDoc(doc)}
                  className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
                >
                  {doc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Document Identifier
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="orders-resilience.md"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Document Body
              </label>
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                rows={6}
                placeholder="Paste Markdown, text specification, or policy..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {ingestEngine === 'standard' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Chunking Method
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {(['semantic', 'fixed'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setChunkMethod(m)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        chunkMethod === m
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-semibold capitalize">{m} Chunking</div>
                      <div className="text-xs opacity-75 mt-0.5">
                        {m === 'semantic' ? 'Sentence group boundaries' : 'Fixed token window slices'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  LlamaIndex JSON Metadata Tags
                </label>
                <input
                  type="text"
                  value={llamaMetaJson}
                  onChange={(e) => setLlamaMetaJson(e.target.value)}
                  placeholder='{"category": "database", "service": "orders-service"}'
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleIngest}
            disabled={isIngesting || !docName.trim() || !docContent.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition-colors"
          >
            {isIngesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
            {isIngesting
              ? 'Embedding Chunks...'
              : ingestEngine === 'standard'
                ? `Ingest Document (${chunkMethod})`
                : 'Ingest into LlamaIndex'}
          </button>

          {ingestError && (
            <div className="rounded-lg p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
              {ingestError}
            </div>
          )}

          {ingestResult && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-start gap-3 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">
                  Successfully Ingested &ldquo;{ingestResult.document_name}&rdquo;
                </div>
                <div className="text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                  Chunks created: {ingestResult.chunk_count} · Method: {ingestResult.method_used}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep('retrieval')}
                  className="mt-2 text-xs font-semibold underline text-emerald-800 dark:text-emerald-200 hover:text-emerald-900"
                >
                  Switch to Step 1 to query this document →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
