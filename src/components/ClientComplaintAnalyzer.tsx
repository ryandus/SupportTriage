import React, { useState } from 'react';
import {
  MessageSquareWarning,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Send,
  HelpCircle,
  Copy,
  Check,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Download
} from 'lucide-react';
import { ClientComplaintAnalysis, IncidentInput, PipelineLayer } from '../types';
import { SAMPLE_CLIENT_COMPLAINTS, analyzeClientComplaintDeterministic } from '../lib/clientComplaintEngine';

interface ClientComplaintAnalyzerProps {
  onApplyAnalysis: (extracted: Partial<IncidentInput>, shouldGenerateTriage?: boolean) => void;
  aiAvailable: boolean;
}

export const ClientComplaintAnalyzer: React.FC<ClientComplaintAnalyzerProps> = ({
  onApplyAnalysis,
  aiAvailable,
}) => {
  const [complaintText, setComplaintText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ClientComplaintAnalysis | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadReply = (replyText: string) => {
    const blob = new Blob([replyText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const reportRef = analysisResult?.extractedIncidentFields?.reportId || 'ticket';
    link.setAttribute('download', `client-reply-${reportRef.toLowerCase().replace(/[^a-z0-9]/g, '-')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAnalyze = async () => {
    if (!complaintText.trim()) return;
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze-complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintText }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: ClientComplaintAnalysis = await res.json();
      setAnalysisResult(data);
      // Auto lock-in extracted incident fields to eliminate redundant manual data entry
      if (data.extractedIncidentFields) {
        onApplyAnalysis({
          summary: data.extractedIncidentFields.summary,
          errorCode: data.extractedIncidentFields.errorCode,
          pipelineLayer: data.extractedIncidentFields.pipelineLayer,
          reportId: data.extractedIncidentFields.reportId,
          timestamp: data.extractedIncidentFields.timestamp,
          assetReference: data.extractedIncidentFields.assetReference,
          clientIdentity: data.extractedIncidentFields.clientIdentity,
          endpointUrl: data.extractedIncidentFields.endpointUrl,
          httpMethod: data.extractedIncidentFields.httpMethod,
          traceparent: data.extractedIncidentFields.traceparent,
          cloudflareRayId: data.extractedIncidentFields.cloudflareRayId,
          isTriageLocked: true,
        }, true);
      }
    } catch (err) {
      console.warn('Backend complaint analyze error, using deterministic engine:', err);
      const fallback = analyzeClientComplaintDeterministic(complaintText);
      setAnalysisResult(fallback);
      if (fallback.extractedIncidentFields) {
        onApplyAnalysis({
          summary: fallback.extractedIncidentFields.summary,
          errorCode: fallback.extractedIncidentFields.errorCode,
          pipelineLayer: fallback.extractedIncidentFields.pipelineLayer,
          reportId: fallback.extractedIncidentFields.reportId,
          timestamp: fallback.extractedIncidentFields.timestamp,
          assetReference: fallback.extractedIncidentFields.assetReference,
          clientIdentity: fallback.extractedIncidentFields.clientIdentity,
          endpointUrl: fallback.extractedIncidentFields.endpointUrl,
          httpMethod: fallback.extractedIncidentFields.httpMethod,
          traceparent: fallback.extractedIncidentFields.traceparent,
          cloudflareRayId: fallback.extractedIncidentFields.cloudflareRayId,
          isTriageLocked: true,
        }, true);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadSample = (sampleText: string) => {
    setComplaintText(sampleText);
  };

  const handleReset = () => {
    setComplaintText('');
    setAnalysisResult(null);
  };

  return (
    <section
      id="client-specific-complaint-analyzer"
      className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm transition-all"
    >
      {/* Component Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 px-6 sm:px-8 py-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-inner">
            <MessageSquareWarning className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Intelligent Ingestion
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Automated Root-Cause Extractor
              </span>
              {aiAvailable && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  <Sparkles className="w-2.5 h-2.5" /> AI Assisted
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight mt-0.5">
              Client-Specific Complaint Analyzer
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Paste raw customer tickets, Slack escalations, or error reports to immediately extract fields, isolate pipeline layers, and highlight likely issues.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {analysisResult && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={isExpanded ? 'Collapse analyzer' : 'Expand analyzer'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 sm:p-8 space-y-6">
          {/* Quick sample complaint presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Quick Test Complaints:</span>
              <span className="text-xs text-slate-400">Click any scenario to populate text area</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {SAMPLE_CLIENT_COMPLAINTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleLoadSample(sample.text)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all text-left shadow-sm cursor-pointer"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          {/* Large Text Area for Raw Complaint */}
          <div className="relative">
            <textarea
              id="raw-client-complaint-input"
              rows={4}
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="Paste raw customer or partner complaint message here (e.g. ZenDesk ticket, email escalation, Slack thread, 403 Forbidden S3 error, 504 handshake timeout, 422 schema mismatch)..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/70 resize-y leading-relaxed shadow-inner"
            />

            <div className="flex items-center justify-between mt-2.5">
              <span className="text-xs text-slate-400 font-mono">
                {complaintText.length > 0 ? `${complaintText.length} characters` : 'Ready for input'}
              </span>

              <button
                id="analyze-complaint-btn"
                type="button"
                onClick={handleAnalyze}
                disabled={!complaintText.trim() || isAnalyzing}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all ${
                  !complaintText.trim() || isAnalyzing
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-900/30 cursor-pointer'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Complaint & Isolating Layer...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Complaint & Pre-Fill Incident</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Analysis Results Display */}
          {analysisResult && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-in fade-in duration-200">
              {/* Top Banner: Extracted Summary & Urgency */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    analysisResult.sentimentOrUrgency.includes('CRITICAL')
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {analysisResult.sentimentOrUrgency}
                  </span>
                  <div className="text-xs sm:text-sm font-semibold text-slate-100">
                    {analysisResult.extractedIncidentFields.summary}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Incident Form Pre-Filled
                  </span>
                </div>
              </div>

              {/* Grid: Extracted Operational Fields & Probable Layer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Transaction ID</div>
                  <div className="font-mono text-amber-300 font-medium truncate mt-0.5">
                    {analysisResult.extractedIncidentFields.reportId}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">HTTP Status / Code</div>
                  <div className="font-mono text-rose-300 font-medium truncate mt-0.5">
                    {analysisResult.extractedIncidentFields.errorCode}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Suspected Layer</div>
                  <div className="font-medium text-cyan-300 truncate mt-0.5">
                    {analysisResult.extractedIncidentFields.pipelineLayer.split(':')[0]}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Asset / Checksum</div>
                  <div className="font-mono text-slate-300 truncate mt-0.5" title={analysisResult.extractedIncidentFields.assetReference}>
                    {analysisResult.extractedIncidentFields.assetReference}
                  </div>
                </div>
              </div>

              {/* Likely Issues & Root Causes */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Detected Probable Root Causes & Immediate Verification</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisResult.likelyIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-200 leading-snug">
                          {issue.title}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          issue.confidence === 'High'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {issue.confidence} Confidence
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {issue.explanation}
                      </p>

                      <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <div className="font-semibold text-amber-300 flex items-center gap-1">
                          <Terminal className="w-3 h-3" /> Immediate Check:
                        </div>
                        <div className="font-mono text-slate-300">{issue.immediateCheck}</div>
                      </div>

                      <div className="text-[11px] text-emerald-400 flex items-start gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Action: {issue.suggestedAction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ready-to-Send Client Response Draft */}
              {analysisResult.recommendedClientReply && (
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Drafted Professional Client Reply
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(analysisResult.recommendedClientReply, 'client-reply')}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        {copiedField === 'client-reply' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'client-reply' ? 'Copied' : 'Copy Reply'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadReply(analysisResult.recommendedClientReply)}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors"
                        title="Download drafted client response (.txt)"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export Reply (.txt)</span>
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/80 p-3 rounded-lg border border-slate-800/80">
                    {analysisResult.recommendedClientReply}
                  </pre>
                </div>
              )}

              {/* Analyzer Footer */}
              <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                <span>Client Communication & Automated Diagnostic Intake</span>
                <span className="font-mono text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shadow-sm">
                  TriageFlow — A SaaS Playbook • Engineered by R. Hanks
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
