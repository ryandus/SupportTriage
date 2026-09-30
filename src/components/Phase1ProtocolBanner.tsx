import React, { useState } from 'react';
import {
  Compass,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
  Camera,
  Layers,
  FileCode,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Database,
  KeyRound,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { Phase1TriageProtocol } from '../types';

interface Phase1ProtocolBannerProps {
  protocol?: Phase1TriageProtocol;
}

export const Phase1ProtocolBanner: React.FC<Phase1ProtocolBannerProps> = ({ protocol }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'domains' | 'clientScript' | 'telemetry' | 'demarcation'>('domains');

  if (!protocol) return null;

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadScript = () => {
    const text = protocol.clientEvidenceScript.rawCopyScript;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `evidence-intake-script-${protocol.evidentiaryFields.reportId || 'ticket'}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const { likelyFailureDomains, clientEvidenceScript, evidentiaryFields, demarcation } = protocol;

  return (
    <div className="bg-slate-900/95 border border-indigo-500/30 rounded-xl overflow-hidden shadow-lg shadow-indigo-950/20">
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 px-4 py-3 border-b border-indigo-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Phase 1 Protocol
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Intake & Evidence Mapping
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Layer {demarcation.layerNumber}: {demarcation.activeLayer.split(':')[0]}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Ranked root-cause failure domains, non-technical client evidence collection script & demarcation boundaries
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopy(clientEvidenceScript.rawCopyScript, 'fullScript')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 transition-colors"
            title="Copy client-facing script to clipboard"
          >
            {copiedSection === 'fullScript' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Copy Script</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadScript}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors"
            title="Download client evidence collection instructions (.txt)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Guide (.txt)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label={isExpanded ? 'Collapse Phase 1 Protocol' : 'Expand Phase 1 Protocol'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Subtabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('domains')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'domains'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              1. Failure Domains ({likelyFailureDomains.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clientScript')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'clientScript'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              2. Client Evidence Script (HAR & DevTools)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'telemetry'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              3. Extracted Evidentiary Fields
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('demarcation')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'demarcation'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              4. Pipeline Demarcation (Upstream vs Downstream)
            </button>
          </div>

          {/* Tab 1: Ranked Failure Domains */}
          {activeTab === 'domains' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  Most Likely Failure Domains & Initial Starting Points
                </span>
                <span>Ranked by probability based on layer & error status</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {likelyFailureDomains.map((fd) => (
                  <div
                    key={fd.rank}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Rank #{fd.rank} • {fd.likelihood}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                        {fd.domain.split(':')[0]}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100 leading-snug">
                      {fd.title}
                    </h4>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong className="text-slate-400 font-semibold">Architectural Rationale: </strong>
                      {fd.rationale}
                    </p>

                    <div className="pt-2 border-t border-slate-850 text-[11px] bg-slate-900/60 rounded-lg p-2 text-amber-200/90 flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Immediate Triage Step: </strong>
                        {fd.immediateAction}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Client Evidence Script */}
          {activeTab === 'clientScript' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-200">
                    Non-Technical Client Intake Script
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Polite, step-by-step instructions for non-technical users to capture browser network traces (HAR) and error banners
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(clientEvidenceScript.rawCopyScript, 'clientScriptRaw')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs self-start shrink-0 transition-colors shadow-sm cursor-pointer"
                >
                  {copiedSection === 'clientScriptRaw' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Intake Email Script</span>
                </button>
              </div>

              {/* Three-Step Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Step 1: DevTools */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span>1. Open Browser DevTools</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-300">
                    {clientEvidenceScript.devToolsInstructions.map((inst, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-indigo-400 font-mono text-[10px] mt-0.5">•</span>
                        <span>{inst}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Step 2: HAR Export */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Export Network HAR</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-300">
                    {clientEvidenceScript.harExportSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-mono text-[10px] mt-0.5">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Step 3: Screenshots */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>3. Screenshot Checklist</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-300">
                    {clientEvidenceScript.screenshotChecklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-mono text-[10px] mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Raw Preview Box */}
              <div className="space-y-1 pt-2">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Raw Client-Facing Script Preview:</span>
                  <span className="text-[10px] text-slate-500">Ready for Zendesk / Jira / Email reply</span>
                </div>
                <div className="relative">
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {clientEvidenceScript.rawCopyScript}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Extracted Evidentiary Fields */}
          {activeTab === 'telemetry' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  Evidentiary Ingestion Fields
                </span>
                <span>Standardized metadata captured for Tier 3 escalation</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Client / User Identity</div>
                  <div className="text-xs font-mono font-medium text-slate-200 mt-1 truncate">
                    {evidentiaryFields.clientIdentity || 'Client Org / Session'}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Report / Transaction ID</div>
                  <div className="text-xs font-mono font-bold text-amber-300 mt-1 truncate">
                    {evidentiaryFields.reportId}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Timestamp (UTC)</div>
                  <div className="text-xs font-mono text-emerald-400 mt-1 truncate">
                    {evidentiaryFields.timestamp}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Endpoint & HTTP Method</div>
                  <div className="text-xs font-mono text-indigo-300 mt-1 truncate">
                    {evidentiaryFields.httpMethod || 'POST'} {evidentiaryFields.endpointUrl || '/v1/reports'}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 sm:col-span-2 md:col-span-2">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Asset Reference / Hash</div>
                  <div className="text-xs font-mono text-slate-200 mt-1 truncate">
                    {evidentiaryFields.assetReference}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Pipeline Demarcation */}
          {activeTab === 'demarcation' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  Architectural Demarcation ({demarcation.activeLayer})
                </span>
                <span>Layer {demarcation.layerNumber} of 6</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Demarcation Boundary: {demarcation.demarcationBoundary}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                      <span>← Upstream Boundary</span>
                    </span>
                    <p className="text-xs text-slate-200">
                      {demarcation.upstreamBoundary}
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                      <span>Downstream Boundary →</span>
                    </span>
                    <p className="text-xs text-slate-200">
                      {demarcation.downstreamBoundary}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-xs">
                  <strong>Diagnostic Focus for this Demarcation: </strong>
                  {demarcation.diagnosticFocus}
                </div>
              </div>
            </div>
          )}

          {/* Phase 1 Protocol Footer */}
          <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>Intake Protocol & Diagnostic Demarcation</span>
            <span className="font-mono text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shadow-sm">
              SupportTriage • Engineered by R. Hanks
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
