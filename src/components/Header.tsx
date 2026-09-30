import React from 'react';
import {
  ShieldAlert,
  Sparkles,
  FileCode2,
  History,
  Activity,
  MessageSquareWarning,
  RotateCcw
} from 'lucide-react';
import { INCIDENT_PRESETS } from '../data/incidentPresets';
import { IncidentPreset } from '../types';

interface HeaderProps {
  onSelectPreset: (preset: IncidentPreset) => void;
  onOpenLogParser: () => void;
  onOpenClientComplaint: () => void;
  onOpenHistory: () => void;
  onClearIncident?: () => void;
  isIncidentActive?: boolean;
  historyCount: number;
  aiAvailable: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectPreset,
  onOpenLogParser,
  onOpenClientComplaint,
  onOpenHistory,
  onClearIncident,
  isIncidentActive,
  historyCount,
  aiAvailable
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Brand & Specialty Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 via-rose-500/20 to-indigo-500/20 border border-amber-500/30 text-amber-400 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                  SupportTriage
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  <Activity className="w-3 h-3" /> Enterprise API Triage
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  SupportTriage • Engineered by R. C. Hanks
                </span>
              </div>
              <p className="text-xs text-slate-400">
                API Gateway • Storage Ingestion (Steps 2–3) • Webhook Delivery (Steps 4–6) • Root-Cause Elimination
              </p>
            </div>
          </div>

          {/* Quick Presets & Actions */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Presets dropdown */}
            <div className="relative inline-block">
              <select
                id="incident-presets-select"
                onChange={(e) => {
                  const preset = INCIDENT_PRESETS.find(p => p.id === e.target.value);
                  if (preset) onSelectPreset(preset);
                  e.target.value = '';
                }}
                defaultValue=""
                className="bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
              >
                <option value="" disabled>Load Incident Preset Scenario...</option>
                {INCIDENT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.badge}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear / New Incident Button when an incident is active */}
            {isIncidentActive && onClearIncident && (
              <button
                id="header-clear-btn"
                type="button"
                onClick={onClearIncident}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-slate-100 transition-colors text-xs font-medium cursor-pointer"
                title="Clear current incident and return to clean blank slate"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>New / Clear</span>
              </button>
            )}

            {/* Client Specific Complaint Button */}
            <button
              id="open-client-complaint-btn"
              type="button"
              onClick={onOpenClientComplaint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-semibold transition-colors shadow-sm cursor-pointer"
              title="Paste client-specific complaint to detect likely issues & draft responses"
            >
              <MessageSquareWarning className="w-3.5 h-3.5" />
              <span>Client Complaint Analyzer</span>
            </button>

            {/* Parse Raw Log Button */}
            <button
              id="open-raw-log-parser-btn"
              type="button"
              onClick={onOpenLogParser}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-medium transition-colors cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Parse Log / Alert</span>
            </button>

            {/* Incident History Drawer Button */}
            <button
              id="open-history-btn"
              type="button"
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {historyCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-200 text-[10px] font-semibold">
                  {historyCount}
                </span>
              )}
            </button>

            {/* AI Capability Badge */}
            <div
              className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                aiAvailable
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{aiAvailable ? 'Gemini 3.8 Intelligence Active' : 'Offline Runbook Engine'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
