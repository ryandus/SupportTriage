import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  Fingerprint,
  Layers,
  FileText,
  Search,
  Zap,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Info,
  X,
  Copy,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PipelineLayer, DiagnosticMode, IncidentInput } from '../types';
import {
  FULL_ERROR_CODE_CATALOG,
  POPULAR_ERROR_CODES,
  TRANSACTION_ID_TYPES,
  POPULAR_TRANSACTION_FORMATS,
  ErrorCodeDefinition
} from '../data/telemetryCatalog';

interface IncidentFormProps {
  input: IncidentInput;
  onChange: (updated: Partial<IncidentInput>) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const COMMON_SUMMARIES = [
  'Failed to download file from URL',
  'Metadata dropped',
  'Outbound timeout',
  'S3/GCS presigned signature expired',
  'API payload schema validation failure',
  'Outbound MTLS handshake timeout with partner endpoint',
  'Worker task OOM during payload processing',
  'Webhook HMAC signature verification failed'
];

const PIPELINE_LAYERS: PipelineLayer[] = [
  'Layer 1: DNS / Client Network / IdP SSO',
  'Layer 2: API Gateway / Authentication Edge',
  'Layer 3: Storage Ingestion Service (DB write, asset retrieval)',
  'Layer 4: Worker Queues / Async Processing Containers',
  'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)',
  'Layer 6: Webhook / Callback Notification'
];

function detectTransactionFormat(id: string): string | null {
  if (!id || !id.trim()) return null;
  const t = id.trim();
  if (/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/i.test(t)) return 'W3C Traceparent (OpenTelemetry)';
  if (/^1-[a-f0-9]{8}-[a-f0-9]{24}$/i.test(t)) return 'AWS X-Ray Trace';
  if (/^[a-f0-9]{16}-[A-Z]{3}$/.test(t)) return 'Cloudflare Ray (CF-Ray)';
  if (/^dd-trace-\d+$/i.test(t)) return 'Datadog APM Trace';
  if (/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return 'UUIDv4 / X-Request-ID';
  if (/^PARTNER-SYNC-[\w-]+$/i.test(t)) return 'Downstream Clearinghouse Ref';
  if (/^sqs-msg-[\w-]+$/i.test(t)) return 'AWS SQS / Worker Message ID';
  if (/^BATCH-[\w-]+$/i.test(t)) return 'Ingestion Batch Chunk ID';
  if (/^evt_[\w]+$/i.test(t)) return 'Webhook Event ID';
  if (/^sha256:[a-f0-9]{64}$/i.test(t)) return 'SHA-256 Checksum';
  if (/^kafka-[\w-]+$/i.test(t)) return 'Kafka Partition/Offset';
  if (/^ISA-[\w-]+$/i.test(t)) return 'B2B EDI Control (X12)';
  if (/^REP-[\w-]+$/i.test(t)) return 'Incident Report ID';
  if (/^TXN-[\w-]+$/i.test(t)) return 'Transaction ID';
  return 'Custom Identifier';
}

export const IncidentForm: React.FC<IncidentFormProps> = ({
  input,
  onChange,
  onSubmit,
  isLoading
}) => {
  const [customErrorMode, setCustomErrorMode] = useState(false);
  const [selectedTxnFormatId, setSelectedTxnFormatId] = useState<string>('rep_internal');
  const [showTxnCatalogModal, setShowTxnCatalogModal] = useState(false);
  const [showAdvancedTelemetry, setShowAdvancedTelemetry] = useState(false);

  // Progressive Disclosure: Automatically reveal advanced telemetry if active fields exist or relevant layers are selected
  const hasActiveAdvancedFields = Boolean(
    input.traceparent ||
    input.cloudflareRayId ||
    input.clockFormat ||
    input.pipelineLayer.includes('Layer 1') ||
    input.pipelineLayer.includes('Layer 2') ||
    input.errorCode.includes('52') ||
    input.errorCode.toLowerCase().includes('cloudflare') ||
    input.errorCode.toLowerCase().includes('trace')
  );

  // Group error codes by category
  const groupedErrorCodes = useMemo(() => {
    const groups: Record<string, ErrorCodeDefinition[]> = {
      '4xx Client / Auth / Validation': [],
      '5xx Server / Gateway / Infra': [],
      '52x Edge & CDN Origin': [],
      'Network / Socket / TLS Exceptions': []
    };
    FULL_ERROR_CODE_CATALOG.forEach((item) => {
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    });
    return groups;
  }, []);

  // Find active error code definition
  const activeErrorCodeDef = useMemo(() => {
    if (!input.errorCode.trim()) return null;
    const match = FULL_ERROR_CODE_CATALOG.find(
      (e) =>
        e.code.toLowerCase() === input.errorCode.toLowerCase() ||
        e.code.toLowerCase().startsWith(input.errorCode.toLowerCase()) ||
        input.errorCode.toLowerCase().startsWith(e.code.toLowerCase()) ||
        e.statusNumber === input.errorCode.split(' ')[0]
    );
    return match || null;
  }, [input.errorCode]);

  // Detected format of current reportId
  const detectedFormat = useMemo(() => detectTransactionFormat(input.reportId), [input.reportId]);

  const handleSetNowUtc = () => {
    onChange({ timestamp: new Date().toISOString() });
  };

  const handleGenerateReportId = (formatId?: string) => {
    const targetId = formatId || selectedTxnFormatId;
    const typeObj = TRANSACTION_ID_TYPES.find((t) => t.id === targetId) || TRANSACTION_ID_TYPES[0];
    onChange({ reportId: typeObj.generate() });
    if (formatId) {
      setSelectedTxnFormatId(formatId);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/30 hover:bg-slate-900/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm transition-all duration-200 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Incident Data Intake
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight mt-0.5">
              Incident Triage Intake
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Specify operational telemetry & diagnostic boundaries for immediate systematic investigation.
            </p>
          </div>
        </div>

        <button
          id="reset-form-btn"
          type="button"
          onClick={() => {
            onChange({
              summary: '',
              errorCode: '',
              pipelineLayer: 'Layer 1: DNS / Client Network / IdP SSO',
              reportId: '',
              timestamp: '',
              assetReference: '',
              diagnosticMode: 'Mode A: Internal 5-Paragraph Technical Triage',
              clientIdentity: '',
              endpointUrl: '',
              httpMethod: 'POST',
              investigatedFacts: [],
              traceparent: undefined,
              cloudflareRayId: undefined,
              clockFormat: undefined,
              isTriageLocked: false
            });
            setShowAdvancedTelemetry(false);
          }}
          className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer self-start sm:self-center"
          title="Clear all form fields"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Clear Form</span>
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.reportId.trim()) {
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            onChange({ reportId: `REP-${randomSuffix}` });
          }
          if (!input.timestamp.trim()) {
            onChange({ timestamp: new Date().toISOString() });
          }
          onSubmit();
        }}
        className="space-y-6"
      >
        {/* Section 1: Incident Description & Pattern */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
            <label htmlFor="incident-summary" className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 inline-flex items-center justify-center text-[10px] font-mono font-bold">1</span>
              <span>Incident / Error Summary</span>
              <span className="text-rose-400 font-bold">*</span>
            </label>
            <span className="text-xs text-slate-400">Primary failure description</span>
          </div>

          <input
            id="incident-summary"
            type="text"
            required
            value={input.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
            placeholder='e.g., "Failed to download file from URL", "Outbound MTLS handshake timeout"'
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
          />

          {/* Preset Error Summary Chips */}
          <div className="space-y-2 pt-2 border-t border-slate-850">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Quick Presets:</span>
            <div className="flex flex-wrap gap-2">
              {COMMON_SUMMARIES.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ summary: s })}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    input.summary === s
                      ? 'bg-blue-600/20 text-blue-200 border-blue-500/50 font-semibold shadow-sm ring-1 ring-blue-500/30'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-slate-800'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${input.summary === s ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Error Code and Pipeline Layer */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-5 shadow-inner">
          {/* MTTR Optimization: Locked-In Triage Banner when Client Complaint Analyzer parsed successfully */}
          {input.isTriageLocked ? (
            <div className="bg-gradient-to-r from-blue-950/70 via-slate-900/90 to-indigo-950/60 border border-blue-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 mt-0.5">
                  <Lock className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-200 uppercase tracking-wide">
                      Automated Pipeline Triage Locked
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Bypassed Manual Select
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Active Domain: <strong className="text-white font-mono">{input.pipelineLayer.split(':')[0]}</strong>
                    </span>
                    <span className="text-slate-500">•</span>
                    <span>
                      Active Error: <strong className="text-amber-300 font-mono">{input.errorCode}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Manual 48-item dropdown & layer radios programmatically collapsed to eliminate redundant data entry and accelerate MTTR.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ isTriageLocked: false })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer transition-colors self-start sm:self-center shrink-0"
                title="Unlock to manually alter the Error Code or Pipeline Layer"
              >
                <Unlock className="w-3.5 h-3.5 text-slate-400" />
                <span>Unlock Fields</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Field 2: Error Code / HTTP Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="error-code" className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 inline-flex items-center justify-center text-[10px] font-mono">2</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Error Code / Status</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {activeErrorCodeDef && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-850 text-amber-300 border border-slate-700">
                        {activeErrorCodeDef.category.split(' ')[0]}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCustomErrorMode(!customErrorMode)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer font-medium"
                    >
                      {customErrorMode ? 'Select from catalog' : 'Custom'}
                    </button>
                  </div>
                </div>

                {customErrorMode ? (
                  <input
                    id="error-code-custom"
                    type="text"
                    value={input.errorCode}
                    onChange={(e) => onChange({ errorCode: e.target.value })}
                    placeholder="e.g., 504 Gateway Timeout, ECONNRESET, SSL Handshake Failed"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                ) : (
                  <select
                    id="error-code"
                    value={input.errorCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange({ errorCode: val });
                      const matched = FULL_ERROR_CODE_CATALOG.find((c) => c.code === val);
                      if (matched && !input.summary) {
                        onChange({ errorCode: val, summary: matched.name });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono cursor-pointer"
                  >
                    <option value="">-- Select Error Code or Protocol Failure (48 Standard Codes) --</option>
                    {(Object.entries(groupedErrorCodes) as [string, ErrorCodeDefinition[]][]).map(([category, codes]) => (
                      <optgroup key={category} label={category} className="bg-slate-900 font-semibold text-slate-300">
                        {codes.map((c) => (
                          <option key={c.code} value={c.code} className="text-slate-100 font-normal">
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}

                {/* Quick-Pick Popular Error Code Pills */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Popular:</span>
                  {POPULAR_ERROR_CODES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onChange({ errorCode: code })}
                      className={`text-[11px] px-2 py-0.5 rounded-lg font-mono border transition-all cursor-pointer ${
                        input.errorCode === code
                          ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-sm font-semibold'
                          : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                      }`}
                    >
                      {code.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {/* Diagnostic Context for Selected Code */}
                {activeErrorCodeDef && (
                  <div className="mt-2 p-2.5 bg-slate-900/90 border border-slate-800/80 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-semibold text-amber-400">{activeErrorCodeDef.code}: {activeErrorCodeDef.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{activeErrorCodeDef.category}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {activeErrorCodeDef.description}
                    </p>
                    {activeErrorCodeDef.suggestedLayer && input.pipelineLayer !== activeErrorCodeDef.suggestedLayer && (
                      <div className="pt-1.5 flex items-center justify-between border-t border-slate-800/60">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-blue-400" />
                          Suggested Domain: <span className="text-blue-300 font-medium">{activeErrorCodeDef.suggestedLayer.split(':')[0]}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onChange({ pipelineLayer: activeErrorCodeDef.suggestedLayer })}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline decoration-dotted cursor-pointer"
                        >
                          Align Layer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Field 3: Pipeline Layer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="pipeline-layer" className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 inline-flex items-center justify-center text-[10px] font-mono">3</span>
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Pipeline Layer</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Demarcation domain</span>
                </div>

                <select
                  id="pipeline-layer"
                  value={input.pipelineLayer}
                  onChange={(e) => onChange({ pipelineLayer: e.target.value as PipelineLayer })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  {PIPELINE_LAYERS.map((layer) => (
                    <option key={layer} value={layer}>
                      {layer}
                    </option>
                  ))}
                </select>

                <div className="p-2.5 bg-slate-900/90 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                  {input.pipelineLayer.includes('Layer 1') && 'Domain boundary: Edge DNS, IdP SAML/OIDC SSO, and Client Network reachability.'}
                  {input.pipelineLayer.includes('Layer 2') && 'Domain boundary: Kong/Envoy API Gateway, Bearer token claims, and OpenAPI JSON schema.'}
                  {input.pipelineLayer.includes('Layer 3') && 'Domain boundary: S3/GCS asset retrieval, presigned URL signatures, and DB ingestion writes.'}
                  {input.pipelineLayer.includes('Layer 4') && 'Domain boundary: RabbitMQ/Kafka queue workers, Kubernetes pod memory (OOM), and scratch disks.'}
                  {input.pipelineLayer.includes('Layer 5') && 'Domain boundary: Outbound MTLS client certificates, downstream partner API endpoints, and NAT IP egress.'}
                  {input.pipelineLayer.includes('Layer 6') && 'Domain boundary: Webhook dispatcher delivery, HMAC-SHA256 signatures, and partner listener timeouts.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field 4: Telemetry Group */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 inline-flex items-center justify-center text-[10px] font-mono font-bold">4</span>
              <Fingerprint className="w-4 h-4 text-emerald-400" />
              <span>Telemetry Identifiers & Clocks</span>
              <span className="text-rose-400 font-bold">*</span>
            </span>
            <span className="text-xs text-slate-400">Distributed tracing & correlation metadata</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Report / Transaction ID */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="report-id" className="text-[11px] font-medium text-slate-300">
                  Report / Transaction ID
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowTxnCatalogModal(true)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="View catalog of all 14 transaction & trace ID formats"
                  >
                    Formats (14)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateReportId()}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                  >
                    Generate
                  </button>
                </div>
              </div>

              {/* Format selection dropdown & input */}
              <div className="space-y-1">
                <input
                  id="report-id"
                  type="text"
                  value={input.reportId}
                  onChange={(e) => onChange({ reportId: e.target.value })}
                  placeholder="e.g., REP-2026-9821-X9, W3C Trace, CF-Ray"
                  className="w-full font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />

                {/* Detected format badge & selector */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <div className="truncate flex items-center gap-1">
                    {detectedFormat ? (
                      <span className="text-emerald-400 font-mono truncate">
                        Format: <span className="text-slate-300">{detectedFormat}</span>
                      </span>
                    ) : (
                      <span>Format presets:</span>
                    )}
                  </div>
                  <select
                    value={selectedTxnFormatId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedTxnFormatId(id);
                      handleGenerateReportId(id);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {TRANSACTION_ID_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Generation Pills */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {POPULAR_TRANSACTION_FORMATS.slice(0, 5).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => handleGenerateReportId(fmt.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 cursor-pointer transition-colors"
                      title={`Generate ${fmt.label} format`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowTxnCatalogModal(true)}
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-850 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-slate-800 cursor-pointer transition-colors"
                  >
                    +More
                  </button>
                </div>
              </div>
            </div>

            {/* Timestamp (UTC) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="timestamp-utc" className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Timestamp (UTC)</span>
                </label>
                <button
                  type="button"
                  onClick={handleSetNowUtc}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Now (UTC)
                </button>
              </div>
              <input
                id="timestamp-utc"
                type="text"
                value={input.timestamp}
                onChange={(e) => onChange({ timestamp: e.target.value })}
                placeholder="YYYY-MM-DDTHH:mm:ssZ (defaults to Now if blank)"
                className="w-full font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <div className="text-[10px] text-slate-400 truncate">
                Format: <span className="font-mono text-slate-300">ISO 8601 UTC</span> (e.g., <code className="text-slate-400">...Z</code>)
              </div>
            </div>

            {/* Hash / Asset Reference */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="asset-reference" className="text-[11px] font-medium text-slate-300">
                  Hash / Asset Ref
                </label>
                <button
                  type="button"
                  onClick={() => onChange({ assetReference: input.assetReference === 'N/A' ? 'sha256:d8a29b4e72cf1902c3851b4d32a9e35471a2e9b048cf7a1b029341bc8e390c12' : 'N/A' })}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Toggle N/A
                </button>
              </div>
              <input
                id="asset-reference"
                type="text"
                required
                value={input.assetReference}
                onChange={(e) => onChange({ assetReference: e.target.value })}
                placeholder='sha256:... or URL or "N/A"'
                className="w-full font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span>Ref:</span>
                <button
                  type="button"
                  onClick={() => onChange({ assetReference: 'sha256:d8a29b4e72cf1902c3851b4d32a9e35471a2e9b048cf7a1b029341bc8e390c12' })}
                  className="hover:text-amber-300 underline decoration-dotted"
                  title="Click to set SHA-256 hash"
                >
                  SHA-256
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => onChange({ assetReference: 'N/A' })}
                  className="hover:text-amber-300 underline decoration-dotted"
                  title="Click to set N/A for metadata errors"
                >
                  N/A (No Asset)
                </button>
              </div>
            </div>
          </div>

          {/* Phase 1 Intake Metadata: Client Identity & Endpoint Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label htmlFor="client-identity" className="text-[11px] font-medium text-slate-300">
                Client Org / User Identity
              </label>
              <input
                id="client-identity"
                type="text"
                value={input.clientIdentity || ''}
                onChange={(e) => onChange({ clientIdentity: e.target.value })}
                placeholder="e.g., acme-corp-prod / user@partner.org"
                className="w-full font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="endpoint-url" className="text-[11px] font-medium text-slate-300">
                Target Endpoint & HTTP Method
              </label>
              <div className="flex gap-1.5">
                <select
                  id="http-method-select"
                  value={input.httpMethod || 'POST'}
                  onChange={(e) => onChange({ httpMethod: e.target.value })}
                  aria-label="HTTP Method"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input
                  id="endpoint-url"
                  type="text"
                  value={input.endpointUrl || ''}
                  onChange={(e) => onChange({ endpointUrl: e.target.value })}
                  placeholder="/v1/reports or /v2/cybertip/xml"
                  className="flex-1 font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Progressive Disclosure: Advanced Telemetry & Distributed Tracing Fields */}
          <div className="pt-2 border-t border-slate-850">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAdvancedTelemetry(!showAdvancedTelemetry)}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer py-1"
              >
                {showAdvancedTelemetry || hasActiveAdvancedFields ? (
                  <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>Advanced Telemetry & Clocks</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                  {hasActiveAdvancedFields ? 'Active Context' : 'Optional / Context-Driven'}
                </span>
              </button>

              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                Traceparent • CF-Ray • Clock Format
              </span>
            </div>

            {(showAdvancedTelemetry || hasActiveAdvancedFields) && (
              <div className="mt-3 p-3.5 bg-slate-900/80 border border-indigo-950/80 rounded-xl space-y-3">
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Revealed dynamically for deep root-cause elimination across distributed edge boundaries.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Traceparent (OpenTelemetry W3C) */}
                  <div className="space-y-1">
                    <label htmlFor="telemetry-traceparent" className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                      <span>W3C Traceparent</span>
                      <button
                        type="button"
                        onClick={() => {
                          const hex = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                          onChange({ traceparent: `00-${hex(32)}-${hex(16)}-01` });
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        Gen
                      </button>
                    </label>
                    <input
                      id="telemetry-traceparent"
                      type="text"
                      value={input.traceparent || ''}
                      onChange={(e) => onChange({ traceparent: e.target.value })}
                      placeholder="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
                      className="w-full font-mono text-[11px] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Cloudflare Ray ID */}
                  <div className="space-y-1">
                    <label htmlFor="telemetry-cf-ray" className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                      <span>Cloudflare Ray ID</span>
                      <button
                        type="button"
                        onClick={() => {
                          const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                          const pops = ['SJC', 'IAD', 'LHR', 'FRA', 'ORD', 'AMS'];
                          onChange({ cloudflareRayId: `${hex}-${pops[Math.floor(Math.random() * pops.length)]}` });
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        Gen
                      </button>
                    </label>
                    <input
                      id="telemetry-cf-ray"
                      type="text"
                      value={input.cloudflareRayId || ''}
                      onChange={(e) => onChange({ cloudflareRayId: e.target.value })}
                      placeholder="8a2f10bc94e0192a-SJC"
                      className="w-full font-mono text-[11px] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Clock Format / Skew */}
                  <div className="space-y-1">
                    <label htmlFor="telemetry-clock-format" className="text-[11px] font-medium text-slate-300">
                      Clock / Offset Specification
                    </label>
                    <select
                      id="telemetry-clock-format"
                      value={input.clockFormat || 'ISO_UTC_Z'}
                      onChange={(e) => onChange({ clockFormat: e.target.value })}
                      className="w-full font-mono text-[11px] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ISO_UTC_Z">ISO 8601 UTC (Trailing &apos;Z&apos;)</option>
                      <option value="ISO_COLON_OFFSET">ISO 8601 Strict Offset (+00:00)</option>
                      <option value="ISO_NO_COLON">Non-standard Offset (+0000 - Invalid)</option>
                      <option value="EPOCH_MILLIS">UNIX Epoch Milliseconds (13 digits)</option>
                      <option value="EPOCH_SECONDS">UNIX Epoch Seconds (10 digits)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Field 5: Diagnostic Mode */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 inline-flex items-center justify-center text-[10px] font-mono font-bold">5</span>
              <span>Diagnostic Communication Mode</span>
            </span>
            <span className="text-xs text-slate-400">Target audience & operational delivery format</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              htmlFor="mode-a-radio"
              className={`cursor-pointer flex items-start gap-3.5 p-4 rounded-xl border transition-all duration-200 ${
                input.diagnosticMode === 'Mode A: Internal 5-Paragraph Technical Triage'
                  ? 'bg-amber-500/10 border-amber-500/60 text-slate-100 ring-2 ring-amber-500/30 shadow-lg'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-slate-900/90'
              }`}
            >
              <input
                id="mode-a-radio"
                type="radio"
                name="diagnosticMode"
                checked={input.diagnosticMode === 'Mode A: Internal 5-Paragraph Technical Triage'}
                onChange={() => onChange({ diagnosticMode: 'Mode A: Internal 5-Paragraph Technical Triage' })}
                className="mt-1 text-amber-500 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1.5">
                <div className="font-bold text-xs text-amber-300 flex items-center gap-2">
                  <span>Mode A: Internal Technical Triage</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">5-Paragraph</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  Standardized operational dossier: Blast Radius, Architectural Root Cause, Telemetry Correlation, Rule-Out Elimination, and Recovery Runbook.
                </div>
              </div>
            </label>

            <label
              htmlFor="mode-b-radio"
              className={`cursor-pointer flex items-start gap-3.5 p-4 rounded-xl border transition-all duration-200 ${
                input.diagnosticMode === 'Mode B: Partner-Facing Plain Explanation'
                  ? 'bg-indigo-500/10 border-indigo-500/60 text-slate-100 ring-2 ring-indigo-500/30 shadow-lg'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-slate-900/90'
              }`}
            >
              <input
                id="mode-b-radio"
                type="radio"
                name="diagnosticMode"
                checked={input.diagnosticMode === 'Mode B: Partner-Facing Plain Explanation'}
                onChange={() => onChange({ diagnosticMode: 'Mode B: Partner-Facing Plain Explanation' })}
                className="mt-1 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="space-y-1.5">
                <div className="font-bold text-xs text-indigo-300 flex items-center gap-2">
                  <span>Mode B: Partner-Facing Advisory</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">Customer</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  Clear, empathetic, non-jargon explanation with partner-side verification checklist and action items for customer engineering teams.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span>Tip: Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">Ctrl+Enter</kbd>
            <span>to synthesize runbook</span>
          </div>

          <button
            id="generate-triage-btn"
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 cursor-pointer border border-blue-400/30"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Synthesizing Operational Runbook...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-blue-200" />
                <span>Generate Operational Triage Guide</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Transaction & Telemetry ID Catalog Modal */}
      {showTxnCatalogModal && (
        <div
          id="txn-catalog-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Transaction & Distributed Trace ID Standards Catalog
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select from 14 standard industry correlation formats to inject into incident telemetry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTxnCatalogModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-slate-800/60">
              {TRANSACTION_ID_TYPES.map((item) => (
                <div key={item.id} className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.formatPattern}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400/90 truncate">
                      <span className="text-slate-500">Sample:</span>
                      <code className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 truncate">
                        {item.example}
                      </code>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleGenerateReportId(item.id);
                      setShowTxnCatalogModal(false);
                    }}
                    className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Use Format
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
              <span>All 14 formats parse automatically via API Gateway & server triage parsers.</span>
              <button
                type="button"
                onClick={() => setShowTxnCatalogModal(false)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
