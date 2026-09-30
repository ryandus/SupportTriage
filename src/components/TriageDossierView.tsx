import React, { useState } from 'react';
import {
  Copy,
  Check,
  Share2,
  FileCheck,
  Send,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Clock,
  Layers,
  FileText,
  Download,
  Terminal,
  Activity
} from 'lucide-react';
import { TriageOutput, DiagnosticMode } from '../types';
import { Phase1ProtocolBanner } from './Phase1ProtocolBanner';

interface TriageDossierViewProps {
  triage: TriageOutput | null;
  onToggleMode: (newMode: DiagnosticMode) => void;
  isLoading: boolean;
  onSelectSamplePreset?: () => void;
  onOpenLogParser?: () => void;
  onOpenClientComplaint?: () => void;
}

export const TriageDossierView: React.FC<TriageDossierViewProps> = ({
  triage,
  onToggleMode,
  isLoading,
  onSelectSamplePreset,
  onOpenLogParser,
  onOpenClientComplaint,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 sm:p-12 shadow-sm text-center space-y-4">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-100">Synthesizing Operational Triage Guide...</h3>
          <p className="text-xs text-slate-400">Demarcating pipeline boundaries and cross-referencing investigated facts.</p>
        </div>
      </div>
    );
  }

  if (!triage) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/30 hover:bg-slate-900/80 rounded-2xl p-6 sm:p-8 shadow-xl shadow-inner shadow-slate-900/50 backdrop-blur-sm transition-all duration-200 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 tracking-tight">Operational Triage Dossier</h3>
              <p className="text-xs text-slate-400">Autonomous 5-Paragraph Technical Triage & Partner Advisory</p>
            </div>
          </div>
          <span className="text-[11px] px-3 py-1 rounded-full font-mono bg-slate-800/80 text-amber-300 border border-slate-700/80 shadow-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>Awaiting Intake Telemetry</span>
          </span>
        </div>

        <div className="text-center py-10 px-4 max-w-lg mx-auto space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/15 via-indigo-600/15 to-purple-600/15 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400 shadow-xl">
            <Layers className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h4 className="text-base font-bold text-slate-100 tracking-tight">Ready for Incident Synthesis</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              No incident is currently prompted. Specify an error summary and pipeline layer on the left, analyze a partner complaint, or parse raw log events to synthesize an operational runbook.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 text-xs">
            {onOpenClientComplaint && (
              <button
                type="button"
                onClick={onOpenClientComplaint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold transition-all hover:scale-[1.02] cursor-pointer shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Client Complaint Analyzer</span>
              </button>
            )}

            {onOpenLogParser && (
              <button
                type="button"
                onClick={onOpenLogParser}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 font-semibold transition-all hover:scale-[1.02] cursor-pointer shadow-sm"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Parse Raw Logs / Alerts</span>
              </button>
            )}

            {onSelectSamplePreset && (
              <button
                type="button"
                onClick={onSelectSamplePreset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-300 font-medium transition-all hover:scale-[1.02] cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Sample Scenario</span>
              </button>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-medium text-slate-400">Multi-Tier Isolation Active</span>
          </div>
          <span className="font-mono text-amber-300 font-semibold bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 shadow-sm text-[11px]">
            SupportTriage • Engineered by R. C. Hanks
          </span>
        </div>
      </div>
    );
  }

  const isModeA = triage.mode.startsWith('Mode A');

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleDownloadMarkdown = () => {
    const markdownContent = getFullMarkdownText();
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `triage-dossier-${triage.incidentRef.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFullMarkdownText = () => {
    let phase1Section = '';
    if (triage.phase1Protocol) {
      const p1 = triage.phase1Protocol;
      phase1Section = `\n## PHASE 1: INITIAL COMPLAINT MAPPING & EVIDENCE INTAKE\n` +
        `### Ranked Failure Domains\n` +
        p1.likelyFailureDomains.map(d => `${d.rank}. **${d.title}** (${d.likelihood}) - Domain: ${d.domain}\n   - Rationale: ${d.rationale}\n   - Immediate Action: ${d.immediateAction}`).join('\n\n') +
        `\n\n### Pipeline Demarcation Boundary\n` +
        `- Active Layer: ${p1.demarcation.activeLayer}\n` +
        `- Boundary: ${p1.demarcation.demarcationBoundary}\n` +
        `- Upstream: ${p1.demarcation.upstreamBoundary}\n` +
        `- Downstream: ${p1.demarcation.downstreamBoundary}\n` +
        `- Diagnostic Focus: ${p1.demarcation.diagnosticFocus}\n\n` +
        `### Client Evidence Collection Instructions\n` +
        p1.clientEvidenceScript.rawCopyScript + `\n\n`;
    }

    if (isModeA && triage.paragraphs) {
      return `# OPERATIONAL TRIAGE DOSSIER: ${triage.incidentRef}\n` +
        `**Severity**: ${triage.severity} | **Pipeline Layer**: ${triage.pipelineLayer}\n` +
        `**Timestamp**: ${triage.generatedAt}\n` +
        phase1Section +
        `## DETAILED 5-PARAGRAPH TECHNICAL TRIAGE\n` +
        triage.paragraphs.map(p => `### ${p.heading}\n\n${p.content}\n`).join('\n') +
        `\n### Escalation Path\n- **Tier**: ${triage.escalationPath.tier}\n- **Team**: ${triage.escalationPath.team}\n- **SLA**: ${triage.escalationPath.sla}\n- **Channel**: ${triage.escalationPath.contactChannel}\n\n---\n*SupportTriage • Engineered by R. C. Hanks*`;
    } else if (triage.partnerExplanation) {
      const pe = triage.partnerExplanation;
      // Phase 1 is intentionally excluded from the partner advisory: its evidence script embeds
      // the client identity and its failure-domain rationale is internal (zero-retention boundary).
      return `# PARTNER INCIDENT ADVISORY: ${triage.incidentRef}\n\n` +
        `### Situation Summary\n${pe.situationSummary}\n\n` +
        `### What Happened\n${pe.whatHappened}\n\n` +
        `### Verification & Rule-Out Steps for Your Team\n` +
        pe.partnerRuleOutSteps.map(s => `- ${s}`).join('\n') + '\n\n' +
        `### Current Remediation Status\n${pe.internalActionStatus}\n\n` +
        `### Action Required / Next Steps\n` +
        pe.nextStepsForPartner.map(s => `- ${s}`).join('\n') +
        `\n\n---\n*SupportTriage • Engineered by R. C. Hanks*`;
    }
    return '';
  };

  const getSlackFormattedText = () => {
    if (isModeA && triage.paragraphs) {
      return `🚨 *[${triage.severity}] Triage Report: ${triage.incidentRef}*\n` +
        `*Layer:* ${triage.pipelineLayer}\n\n` +
        `*Diagnosis:* ${triage.paragraphs[0]?.content.slice(0, 240)}...\n\n` +
        `*Immediate Action:* ${triage.paragraphs[4]?.content.slice(0, 200)}...\n` +
        `*Escalation:* ${triage.escalationPath.team} (${triage.escalationPath.sla})\n\n` +
        `_SupportTriage • Engineered by R. C. Hanks_`;
    } else if (triage.partnerExplanation) {
      return `📢 *Partner Notice for ${triage.incidentRef}:*\n${triage.partnerExplanation.situationSummary}\n\n` +
        `*Next Steps:* ${triage.partnerExplanation.nextStepsForPartner[0] || 'Under review'}\n\n` +
        `_SupportTriage • Engineered by R. C. Hanks_`;
    }
    return '';
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/30 hover:bg-slate-900/80 rounded-2xl p-6 sm:p-8 shadow-xl shadow-inner shadow-slate-900/50 backdrop-blur-sm transition-all duration-200 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide shadow-sm ${
                triage.severity === 'SEV-1 Critical'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 ring-1 ring-rose-500/20'
                  : triage.severity === 'SEV-2 Major'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 ring-1 ring-indigo-500/20'
              }`}
            >
              {triage.severity}
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-850 text-slate-300 border border-slate-700/80 font-semibold">
              Ref: {triage.incidentRef}
            </span>

            <span className="px-3 py-1 rounded-full text-xs bg-slate-850/80 text-slate-300 border border-slate-700/60 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>{triage.pipelineLayer.split(':')[0]}</span>
            </span>

            {triage.aiAssisted && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Grounded</span>
              </span>
            )}
          </div>

          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase block mb-1">
            Executive Diagnostic Synthesis
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight leading-snug">
            {triage.title}
          </h3>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center flex-wrap gap-2 text-xs self-start lg:self-center">
          {/* Mode Switcher pill */}
          <div className="bg-slate-950 border border-slate-700 p-0.5 rounded-lg flex items-center">
            <button
              id="switch-to-mode-a-btn"
              type="button"
              onClick={() => onToggleMode('Mode A: Internal 5-Paragraph Technical Triage')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                isModeA
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mode A (Internal 5-Para)
            </button>
            <button
              id="switch-to-mode-b-btn"
              type="button"
              onClick={() => onToggleMode('Mode B: Partner-Facing Plain Explanation')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                !isModeA
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mode B (Partner Facing)
            </button>
          </div>

          {/* Copy Slack */}
          <button
            id="copy-slack-btn"
            type="button"
            onClick={() => handleCopy(getSlackFormattedText(), 'slack')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Copy Slack formatted update"
          >
            {copiedType === 'slack' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <MessageSquare className="w-3.5 h-3.5" />}
            <span>Slack</span>
          </button>

          {/* Copy Full Dossier */}
          <button
            id="copy-full-dossier-btn"
            type="button"
            onClick={() => handleCopy(getFullMarkdownText(), 'markdown')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold transition-colors"
          >
            {copiedType === 'markdown' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Dossier</span>
          </button>

          {/* Export Dossier Markdown File */}
          <button
            id="export-md-dossier-btn"
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-medium transition-colors"
            title="Download full operational dossier markdown file (SupportTriage • Engineered by R. C. Hanks)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Dossier (.md)</span>
          </button>
        </div>
      </div>

      {/* Phase 1 Protocol: Initial Complaint Mapping & Evidence Intake */}
      {triage.phase1Protocol && (
        <Phase1ProtocolBanner protocol={triage.phase1Protocol} />
      )}

      {/* Mode A Content: 5 Structured Paragraphs */}
      {isModeA && triage.paragraphs && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-300">
              Standardized 5-Paragraph Technical Triage
            </span>
            <span>Audience: L2/L3 SaaS Support & Incident Engineering</span>
          </div>

          <div className="space-y-3.5">
            {triage.paragraphs.map((para) => (
              <div
                key={para.num}
                className="bg-slate-950/50 shadow-inner shadow-slate-950 border border-slate-800/80 rounded-xl p-4 sm:p-5 transition-all hover:bg-slate-900/40 hover:border-slate-600 cursor-default"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs font-bold font-mono">
                    {para.num}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-100 tracking-tight">
                    {para.heading}
                  </h4>
                </div>

                <div className="text-xs sm:text-[13px] text-slate-200 leading-relaxed whitespace-pre-line pl-8 font-mono tracking-tight">
                  {para.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode B Content: Partner-Facing Plain Explanation */}
      {!isModeA && triage.partnerExplanation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-300">
              Partner-Facing Operational Communication
            </span>
            <span>Audience: Customer Engineering & External Developers</span>
          </div>

          <div className="space-y-3.5">
            {/* Section 1: Situation Summary */}
            <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-inner shadow-slate-950/50 hover:bg-slate-900/30 transition-colors">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                1. Situation Summary
              </h4>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {triage.partnerExplanation.situationSummary}
              </p>
            </div>

            {/* Section 2: What Happened */}
            <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-inner shadow-slate-950/50 hover:bg-slate-900/30 transition-colors">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                2. What Happened (Technical Explanation)
              </h4>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {triage.partnerExplanation.whatHappened}
              </p>
            </div>

            {/* Section 3: Partner-Side Rule-Out & Verification Steps */}
            <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-inner shadow-slate-950/50 hover:bg-slate-900/30 transition-colors">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2.5">
                3. Verification & Rule-Out Steps for Your Team
              </h4>
              <ul className="space-y-2">
                {triage.partnerExplanation.partnerRuleOutSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 4: Current Remediation Status */}
            <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-inner shadow-slate-950/50 hover:bg-slate-900/30 transition-colors">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                4. What Our Team Is Doing / Current Remediation Status
              </h4>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {triage.partnerExplanation.internalActionStatus}
              </p>
            </div>

            {/* Section 5: Action Required / Next Steps for Partner */}
            <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-inner shadow-slate-950/50 hover:bg-slate-900/30 transition-colors">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2.5">
                5. Action Required / Next Steps
              </h4>
              <ul className="space-y-2">
                {triage.partnerExplanation.nextStepsForPartner.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Escalation Footer Bar */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-400 font-medium">Escalation Routing & SLA</div>
            <div className="text-slate-200 font-semibold">
              {triage.escalationPath.team} • <span className="text-amber-400">{triage.escalationPath.sla}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Generated: {new Date(triage.generatedAt).toUTCString()}</span>
          </div>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="font-mono text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 shadow-sm">
            SupportTriage • Engineered by R. C. Hanks
          </span>
        </div>
      </div>
    </div>
  );
};
