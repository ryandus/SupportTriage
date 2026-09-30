import React from 'react';
import {
  X,
  History,
  Trash2,
  ArrowRight,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { TriageOutput } from '../types';

interface IncidentHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: TriageOutput[];
  onSelectHistoryItem: (item: TriageOutput) => void;
  onClearHistory: () => void;
}

export const IncidentHistoryDrawer: React.FC<IncidentHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onClearHistory
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Session Incident Triage History</h3>
              <p className="text-xs text-slate-400">{history.length} active investigations stored</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No saved incident runs yet in this session. Generate an operational triage to record it here.
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelectHistoryItem(item);
                  onClose();
                }}
                className="bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 cursor-pointer transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.2 rounded font-semibold ${
                        item.severity === 'SEV-1 Critical'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {item.severity.split(' ')[0]}
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-200">
                      {item.incidentRef}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(item.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-xs font-medium text-slate-300 group-hover:text-amber-300 line-clamp-1 transition-colors">
                  {item.title}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{item.pipelineLayer.split(':')[0]}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          {history.length > 0 ? (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">No triage sessions logged</span>
          )}
          <span className="font-mono text-amber-400/90 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px]">
            SupportTriage • Engineered by R. Hanks
          </span>
        </div>
      </div>
    </div>
  );
};
