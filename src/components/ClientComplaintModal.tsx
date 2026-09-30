import React, { useState } from 'react';
import {
  MessageSquareWarning,
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle,
  Send,
  HelpCircle,
  FileText,
  Clock,
  ShieldAlert,
  Terminal,
  Activity,
  UserCheck
} from 'lucide-react';
import { ClientComplaintAnalysis, IncidentInput, PipelineLayer } from '../types';
import { SAMPLE_CLIENT_COMPLAINTS, analyzeClientComplaintDeterministic } from '../lib/clientComplaintEngine';

interface ClientComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyAnalysisToIncident: (extracted: Partial<IncidentInput>, shouldGenerateTriage?: boolean) => void;
  aiAvailable: boolean;
}

export const ClientComplaintModal: React.FC<ClientComplaintModalProps> = ({
  isOpen,
  onClose,
  onApplyAnalysisToIncident,
  aiAvailable
}) => {
  const [complaintText, setComplaintText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ClientComplaintAnalysis | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAnalyze = async () => {
    if (!complaintText.trim()) return;
    setIsAnalyzing(true);
    setErrorMessage(null);

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
    } catch (err: any) {
      console.warn('API error analyzing complaint, using deterministic engine:', err);
      const fallback = analyzeClientComplaintDeterministic(complaintText);
      setAnalysisResult(fallback);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyToForm = (autoGenerateTriage: boolean) => {
    if (!analysisResult) return;
    const { extractedIncidentFields } = analysisResult;
    onApplyAnalysisToIncident({
      summary: extractedIncidentFields.summary,
      errorCode: extractedIncidentFields.errorCode,
      pipelineLayer: extractedIncidentFields.pipelineLayer,
      reportId: extractedIncidentFields.reportId,
      timestamp: extractedIncidentFields.timestamp,
      assetReference: extractedIncidentFields.assetReference,
      clientIdentity: extractedIncidentFields.clientIdentity,
      endpointUrl: extractedIncidentFields.endpointUrl,
      httpMethod: extractedIncidentFields.httpMethod,
      ...(extractedIncidentFields.iocs?.length ? { iocs: extractedIncidentFields.iocs } : {}),
    }, autoGenerateTriage);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  Client-Specific Complaint & Ticket Diagnostic Intake
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Automated Issue Detector
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Paste any client ticket, email, Slack escalation, or complaint text to catch likely root causes, failure domains & pre-draft replies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Preset Sample Complaints Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 font-medium">
              <span>Or load a realistic client complaint scenario:</span>
              <span className="text-[11px] text-slate-500">Quick Test Cases</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_CLIENT_COMPLAINTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    setComplaintText(sample.text);
                    setAnalysisResult(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors text-left truncate max-w-xs"
                  title={sample.source}
                >
                  <span className="font-semibold text-amber-300">[{sample.id.split('-')[0].toUpperCase()}]</span> {sample.title.replace(/Customer Ticket: |Slack Emergency: |Urgent Email: |Portal Access: |Partner Webhook: /g, '')}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area for Pasting */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="client-complaint-textarea" className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Paste Client Complaint / Support Ticket Message:</span>
              </label>
              <span className="text-slate-400 font-mono">
                {complaintText.length} characters
              </span>
            </div>
            <textarea
              id="client-complaint-textarea"
              rows={6}
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="e.g., 'Hi Support, our automated ingest is getting 403 Access Denied on transaction REP-2026-9821 when downloading our S3 video asset https://... Our daily compliance deadline is in 2 hours...'"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {aiAvailable ? 'Gemini 3.8 Intelligence + Architectural Classifier' : 'Heuristic Pattern Elimination Classifier'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {complaintText && (
                <button
                  type="button"
                  onClick={() => {
                    setComplaintText('');
                    setAnalysisResult(null);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}

              <button
                id="analyze-complaint-btn"
                type="button"
                disabled={!complaintText.trim() || isAnalyzing}
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wide shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Complaint & Mapping Failure Domains...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Specific Complaint</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Analysis Results View */}
          {analysisResult && (
            <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Top Banner: Urgency & Suspected Demarcation Layer */}
              <div className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {analysisResult.sentimentOrUrgency}
                    </span>
                    <span className="text-slate-300 font-semibold text-xs">
                      Target Domain: {analysisResult.extractedIncidentFields.pipelineLayer.split(':')[0]}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">
                    {analysisResult.extractedIncidentFields.summary}
                  </h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1">
                    <span>Client: <strong className="text-slate-200">{analysisResult.clientIdentity || 'Client Partner'}</strong></span>
                    <span>Report ID: <strong className="text-amber-300 font-mono">{analysisResult.extractedIncidentFields.reportId}</strong></span>
                    <span>Status: <strong className="text-rose-300 font-mono">{analysisResult.extractedIncidentFields.errorCode}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApplyToForm(false)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition-colors"
                  >
                    Apply to Form Fields
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyToForm(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-sm"
                  >
                    <span>Run Full Operational Triage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Detected Symptoms */}
              {analysisResult.detectedSymptoms.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Detected Symptoms & Operational Signatures:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {analysisResult.detectedSymptoms.map((symp, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-200 text-xs">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{symp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ranked Likely Issues */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Likely Architectural Issues (Ranked by Probability)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {analysisResult.likelyIssues.length} probable failure patterns caught
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisResult.likelyIssues.map((issue, idx) => (
                    <div
                      key={issue.id || idx}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          Rank #{idx + 1} • {issue.confidence} Confidence
                        </span>
                        <span className="text-[10px] uppercase font-mono text-slate-400">
                          {issue.category}
                        </span>
                      </div>

                      <h5 className="font-bold text-slate-100 text-xs leading-snug">
                        {issue.title}
                      </h5>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-slate-400 font-semibold">Technical Cause: </strong>
                        {issue.explanation}
                      </p>

                      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 space-y-1 text-[11px]">
                        <div className="text-emerald-300 font-medium flex items-start gap-1">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong>Immediate Verification: </strong>{issue.immediateCheck}</span>
                        </div>
                        <div className="text-amber-200/90 flex items-start gap-1">
                          <ArrowRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                          <span><strong>Action: </strong>{issue.suggestedAction}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Client Reply & Internal Next Step */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Draft Client Response */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Pre-Drafted Client Reply (Zendesk / Ticket / Email)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(analysisResult.recommendedClientReply, 'clientReply')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[10px] transition-colors cursor-pointer"
                    >
                      {copiedKey === 'clientReply' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy Reply</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {analysisResult.recommendedClientReply}
                  </pre>
                </div>

                {/* Internal Engineering Next Step */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Internal Tier 3 Diagnostic Directive</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(analysisResult.recommendedInternalNextStep, 'internalStep')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[10px] transition-colors cursor-pointer"
                    >
                      {copiedKey === 'internalStep' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {analysisResult.recommendedInternalNextStep}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Watermark */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>SaaS Support Complaint Triage Engine</span>
            <span className="font-mono text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shadow-sm">
              SupportTriage • Engineered by R. Hanks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
