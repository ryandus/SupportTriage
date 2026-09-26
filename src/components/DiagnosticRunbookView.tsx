import React, { useState } from 'react';
import {
  Terminal,
  Database,
  Copy,
  Check,
  Code,
  ExternalLink,
  BookOpen,
  Info,
  Layers,
  Fingerprint,
  Clock,
  AlertTriangle,
  ArrowRight,
  Download
} from 'lucide-react';
import { DiagnosticCommand, TelemetryQuery, PipelineLayer } from '../types';
import { PIPELINE_LAYERS_INFO, TELEMETRY_GUIDE } from '../data/incidentPresets';
import { VENDOR_ROUTES } from '../config/vendorRoutes';

interface DiagnosticRunbookViewProps {
  commands: DiagnosticCommand[];
  queries: TelemetryQuery[];
  currentLayer: PipelineLayer;
  reportId: string;
  onSelectLayer?: (layer: PipelineLayer) => void;
  onApplyTelemetryValue?: (field: 'reportId' | 'timestamp' | 'assetReference', val: string) => void;
}

export const DiagnosticRunbookView: React.FC<DiagnosticRunbookViewProps> = ({
  commands,
  queries,
  currentLayer,
  reportId,
  onSelectLayer,
  onApplyTelemetryValue
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cli' | 'telemetry' | 'spec' | 'telemetry_guide'>('cli');
  const [selectedLayerKey, setSelectedLayerKey] = useState<string>(currentLayer);

  // Sync with currentLayer if it changes externally
  React.useEffect(() => {
    setSelectedLayerKey(currentLayer);
  }, [currentLayer]);

  const layerInfo = PIPELINE_LAYERS_INFO[selectedLayerKey] || PIPELINE_LAYERS_INFO[currentLayer];
  const allLayerKeys = Object.keys(PIPELINE_LAYERS_INFO);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportRunbookMarkdown = () => {
    let md = `# OPERATIONAL DIAGNOSTIC RUNBOOK: ${reportId || 'INCIDENT'}\n`;
    md += `**Target Pipeline Layer:** ${currentLayer}\n`;
    md += `**Generated Date:** ${new Date().toUTCString()}\n\n`;

    md += `## 1. CLI Diagnostic Commands\n\n`;
    commands.forEach((cmd, i) => {
      md += `### 1.${i + 1} ${cmd.title}\n`;
      md += `${cmd.description}\n\n`;
      md += `\`\`\`bash\n${cmd.command}\n\`\`\`\n\n`;
    });

    md += `## 2. Telemetry Log & Database Queries\n\n`;
    queries.forEach((q, i) => {
      const title = (q as any).name || (q as any).title || q.description || 'Telemetry Query';
      const target = (q as any).system || q.platform || 'Log Search';
      md += `### 2.${i + 1} ${target} — ${title}\n`;
      if (q.description && title !== q.description) {
        md += `${q.description}\n\n`;
      }
      md += `\`\`\`sql\n${q.query}\n\`\`\`\n\n`;
    });

    md += `## 3. Pipeline Layer Demarcation\n`;
    md += `- **Layer**: ${layerInfo?.name || currentLayer}\n`;
    md += `- **Step Range**: ${layerInfo?.stepRange || 'Full Pipeline'}\n`;
    md += `- **Description**: ${layerInfo?.shortDesc || 'Service Boundary'}\n`;
    if (layerInfo?.criticalChecks) {
      md += `- **Critical Checks**: ${layerInfo.criticalChecks.join(', ')}\n`;
    }
    if (layerInfo?.commonErrors) {
      md += `- **Common Error Codes**: ${layerInfo.commonErrors.join(', ')}\n`;
    }
    md += '\n---\n*TriageFlow – DFIR • Engineered by R. C. Hanks*\n';

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `runbook-${(reportId || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/30 hover:bg-slate-900/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm transition-all duration-200 space-y-6">
      {/* Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
            <Terminal className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Investigation Tooling
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight mt-0.5">
              Operational Runbook & Investigation Tooling
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Targeted CLI diagnostics & log queries for {reportId || 'active investigation'}.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-2xl text-xs gap-1.5 shadow-inner self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('cli')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'cli'
                ? 'bg-blue-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            CLI <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900/60">{commands.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'telemetry'
                ? 'bg-blue-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Queries <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900/60">{queries.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('spec')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'spec'
                ? 'bg-blue-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Layer Specs & Examples
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telemetry_guide')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'telemetry_guide'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Telemetry Field Guide
          </button>
          <button
            type="button"
            onClick={handleExportRunbookMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer ml-1"
            title="Download Runbook markdown file (TriageFlow — A SaaS Playbook • Engineered by R. Hanks)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (.md)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: CLI Diagnostic Commands */}
      {activeTab === 'cli' && (
        <div className="space-y-3">
          {commands.length === 0 ? (
            <div className="text-center py-10 px-5 text-xs border border-dashed border-slate-800/80 rounded-2xl bg-slate-950/40 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400 shadow-inner">
                <Terminal className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm text-slate-200">No Incident CLI Commands Generated Yet</div>
                <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                  Targeted CLI scripts (cURL, AWS CLI, MTLS probes) generate automatically when an incident triage dossier is synthesized. Switch to &quot;Layer Specs & Examples&quot; tab for standard operational patterns.
                </p>
              </div>
            </div>
          ) : (
            commands.map((cmd, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{cmd.title}</div>
                    <div className="text-[11px] text-slate-400">{cmd.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(cmd.command, `cli-${idx}`)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                  >
                    {copiedId === `cli-${idx}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy CLI</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-amber-200/90 overflow-x-auto selection:bg-amber-500/30">
                    <code>{cmd.command}</code>
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Telemetry & Log Queries */}
      {activeTab === 'telemetry' && (
        <div className="space-y-3">
          {queries.length === 0 ? (
            <div className="text-center py-10 px-5 text-xs border border-dashed border-slate-800/80 rounded-2xl bg-slate-950/40 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                <Database className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm text-slate-200">No Incident Telemetry Queries Generated Yet</div>
                <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                  Targeted Datadog and PostgreSQL queries generate automatically when an incident triage dossier is synthesized. Switch to &quot;Telemetry Field Guide&quot; tab for logging standards.
                </p>
              </div>
            </div>
          ) : (
            queries.map((q, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {q.platform}
                    </span>
                    <span className="text-xs text-slate-300">{q.description}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Deep-link action using centralized VENDOR_ROUTES */}
                    {q.platform === 'Datadog' && (
                      <a
                        href={VENDOR_ROUTES.datadog.logSearch(q.query)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition-colors"
                        title="Launch search in Datadog APM / Logs"
                      >
                        <ExternalLink className="w-3 h-3 text-indigo-400" />
                        <span>Datadog</span>
                      </a>
                    )}
                    {q.platform.includes('CloudWatch') && (
                      <a
                        href={VENDOR_ROUTES.cloudwatch.insights('/aws/ecs/api-gateway', q.query)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-medium transition-colors"
                        title="Launch Insights in CloudWatch"
                      >
                        <ExternalLink className="w-3 h-3 text-amber-400" />
                        <span>CloudWatch</span>
                      </a>
                    )}
                    {q.platform.includes('Elasticsearch') && (
                      <a
                        href={VENDOR_ROUTES.kibana.discover(q.query)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition-colors"
                        title="Launch query in Kibana"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                        <span>Kibana</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(q.query, `telemetry-${idx}`)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                    >
                      {copiedId === `telemetry-${idx}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Query</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-200/90 overflow-x-auto">
                    <code>{q.query}</code>
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Layer Specifications & Concrete Failure Examples */}
      {activeTab === 'spec' && layerInfo && (
        <div className="space-y-4">
          {/* Layer Selector Sub-pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {allLayerKeys.map((key) => {
              const isSelected = selectedLayerKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedLayerKey(key);
                    if (onSelectLayer) onSelectLayer(key as PipelineLayer);
                  }}
                  className={`px-2.5 py-1 rounded-lg shrink-0 border transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {key.split(':')[0]}
                </button>
              );
            })}
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">{layerInfo.name}</div>
                <p className="text-xs text-slate-400">{layerInfo.shortDesc}</p>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {layerInfo.stepRange}
              </span>
            </div>

            {/* Verification and Common Signatures Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-emerald-400">Critical Verification Checks:</div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  {layerInfo.criticalChecks.map((chk, i) => (
                    <li key={i}>{chk}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-rose-400">Common Failure Signatures:</div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  {layerInfo.commonErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Concrete Examples for this Layer */}
            {layerInfo.concreteExamples && layerInfo.concreteExamples.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Concrete Failure Examples for {layerInfo.name}</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {layerInfo.concreteExamples.map((ex, exIdx) => (
                    <div
                      key={exIdx}
                      className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-[11px] font-bold">
                          {exIdx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-slate-200">{ex.title}</h4>
                      </div>

                      <div className="text-xs text-slate-300 leading-relaxed pl-7">
                        <span className="text-slate-400 font-medium">Scenario: </span>
                        {ex.scenario}
                      </div>

                      <div className="text-xs text-amber-200/90 leading-relaxed pl-7 bg-slate-950/60 p-2 rounded border border-slate-800/80 font-mono">
                        <span className="text-slate-400 font-sans font-medium">Failure Symptom: </span>
                        {ex.failureSymptom}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Telemetry Fields Reference Guide */}
      {activeTab === 'telemetry_guide' && (
        <div className="space-y-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-100">Telemetry Field Guidelines: </span>
              Accurate telemetry correlation keys are essential for isolating incidents across distributed SaaS microservices.
              Review the guidelines and format rules below, or click any example value to load it directly into your active intake form.
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Field 1: Report / Transaction ID */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-100">
                    {TELEMETRY_GUIDE.reportId.field}
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Primary Trace Key
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {TELEMETRY_GUIDE.reportId.description}
              </p>

              <div className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-200 font-semibold">What to enter: </span>
                {TELEMETRY_GUIDE.reportId.whatToEnter}
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-300">Suggested Examples:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TELEMETRY_GUIDE.reportId.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-800 rounded p-2 flex items-center justify-between gap-2"
                    >
                      <div className="overflow-hidden">
                        <code className="text-xs font-mono text-amber-300 block truncate">{ex.id}</code>
                        <span className="text-[10px] text-slate-400 truncate block">{ex.context}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(ex.id, `reportId-copy-${i}`)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Copy ID"
                        >
                          {copiedId === `reportId-copy-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {onApplyTelemetryValue && (
                          <button
                            type="button"
                            onClick={() => onApplyTelemetryValue('reportId', ex.id)}
                            className="text-[10px] px-1.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium transition-colors"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Field 2: Timestamp (UTC) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-100">
                    {TELEMETRY_GUIDE.timestamp.field}
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  ISO 8601 UTC
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {TELEMETRY_GUIDE.timestamp.description}
              </p>

              <div className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-200 font-semibold">What to enter: </span>
                {TELEMETRY_GUIDE.timestamp.whatToEnter}
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-300">Suggested Examples:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TELEMETRY_GUIDE.timestamp.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-800 rounded p-2 flex items-center justify-between gap-2"
                    >
                      <div className="overflow-hidden">
                        <code className="text-xs font-mono text-emerald-300 block truncate">{ex.id}</code>
                        <span className="text-[10px] text-slate-400 truncate block">{ex.context}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(ex.id, `time-copy-${i}`)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Copy Timestamp"
                        >
                          {copiedId === `time-copy-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {onApplyTelemetryValue && (
                          <button
                            type="button"
                            onClick={() => onApplyTelemetryValue('timestamp', ex.id)}
                            className="text-[10px] px-1.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-medium transition-colors"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Field 3: Hash / Asset Reference */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-slate-100">
                    {TELEMETRY_GUIDE.assetReference.field}
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Media Hash / URI / N/A
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {TELEMETRY_GUIDE.assetReference.description}
              </p>

              <div className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-200 font-semibold">What to enter: </span>
                {TELEMETRY_GUIDE.assetReference.whatToEnter}
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-300">Suggested Examples:</span>
                <div className="grid grid-cols-1 gap-2">
                  {TELEMETRY_GUIDE.assetReference.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-800 rounded p-2 flex items-center justify-between gap-2"
                    >
                      <div className="overflow-hidden">
                        <code className="text-xs font-mono text-amber-200 block truncate">{ex.id}</code>
                        <span className="text-[10px] text-slate-400 truncate block">{ex.context}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(ex.id, `asset-copy-${i}`)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Copy Asset Ref"
                        >
                          {copiedId === `asset-copy-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {onApplyTelemetryValue && (
                          <button
                            type="button"
                            onClick={() => onApplyTelemetryValue('assetReference', ex.id)}
                            className="text-[10px] px-1.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium transition-colors"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Runbook Footer */}
      <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-slate-300 font-medium">Diagnostic Instrumentation Calibrated</span>
          <span className="text-slate-600">•</span>
          <span>{commands.length} Commands & {queries.length} Queries</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">Operational Tooling</span>
          <span className="font-mono text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 text-[11px] shadow-sm">
            TriageFlow — A SaaS Playbook • Engineered by R. Hanks
          </span>
        </div>
      </div>
    </div>
  );
};
