import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { IncidentForm } from './components/IncidentForm';
import { RuleOutClarificationMatrix } from './components/RuleOutClarificationMatrix';
import { TriageDossierView } from './components/TriageDossierView';
import { DiagnosticRunbookView } from './components/DiagnosticRunbookView';
import { RawLogParserModal } from './components/RawLogParserModal';
import { ClientComplaintModal } from './components/ClientComplaintModal';
import { ClientComplaintAnalyzer } from './components/ClientComplaintAnalyzer';
import { IncidentHistoryDrawer } from './components/IncidentHistoryDrawer';
import { INCIDENT_PRESETS } from './data/incidentPresets';
import { buildDeterministicTriage, generateDefaultRuleOuts } from './lib/triageEngine';
import {
  IncidentInput,
  TriageOutput,
  IncidentPreset,
  DiagnosticMode,
  PipelineLayer,
  FactStatus,
  InvestigatedFact
} from './types';

const EMPTY_INCIDENT: IncidentInput = {
  summary: '',
  errorCode: '',
  pipelineLayer: 'Layer 1: DNS / Client Network / IdP SSO',
  reportId: '',
  timestamp: '',
  assetReference: '',
  diagnosticMode: 'Mode A: Internal 5-Paragraph Technical Triage',
  investigatedFacts: [],
};

export default function App() {
  const [incidentInput, setIncidentInput] = useState<IncidentInput>(EMPTY_INCIDENT);
  const [triageOutput, setTriageOutput] = useState<TriageOutput | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLogParserOpen, setIsLogParserOpen] = useState(false);
  const [isClientComplaintOpen, setIsClientComplaintOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TriageOutput[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [intakeTab, setIntakeTab] = useState<'parse' | 'manual' | 'presets'>('parse');
  // Clear current incident state back to clean blank slate
  const handleClearIncident = () => {
    setIncidentInput(EMPTY_INCIDENT);
    setTriageOutput(null);
  };

  const isIncidentActive = Boolean(
    triageOutput !== null ||
    incidentInput.summary.trim() !== '' ||
    incidentInput.errorCode.trim() !== '' ||
    incidentInput.investigatedFacts.length > 0
  );

  // Check health on startup
 useEffect(() => {
    if (window.location.hostname.includes('github.io')) {
      setAiAvailable(false);
      return;
    }

    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (data.geminiConfigured) {
          setAiAvailable(true);
        }
      })
      .catch(() => {
        setAiAvailable(false);
      });
  }, []);

  // Generate Triage Guide
  const handleGenerateTriage = useCallback(
    async (overrideInput?: IncidentInput) => {
      const current = overrideInput || incidentInput;
      const summaryToUse = current.summary.trim() || 'Unspecified Incident Investigation';
      const reportIdToUse = current.reportId.trim() || `REP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const timestampToUse = current.timestamp.trim() || new Date().toISOString();

      const sanitized: IncidentInput = {
        ...current,
        summary: summaryToUse,
        reportId: reportIdToUse,
        timestamp: timestampToUse,
      };

      setIncidentInput(sanitized);
      setIsLoading(true);

      try {
        const res = await fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitized),
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data: TriageOutput = await res.json();
        setTriageOutput(data);
        setHistory((prev) => [data, ...prev.slice(0, 19)]);
      } catch (err) {
        console.warn('Backend triage fetch error, using client-side deterministic engine:', err);
        const fallback = buildDeterministicTriage(sanitized);
        setTriageOutput(fallback);
        setHistory((prev) => [fallback, ...prev.slice(0, 19)]);
      } finally {
        setIsLoading(false);
      }
    },
    [incidentInput]
  );

  // Keyboard shortcut Ctrl+Enter or Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerateTriage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGenerateTriage]);

  // Handle Preset selection
  const handleSelectPreset = (preset: IncidentPreset) => {
    const updated: IncidentInput = {
      ...incidentInput,
      summary: preset.summary,
      errorCode: preset.errorCode,
      pipelineLayer: preset.pipelineLayer,
      reportId: preset.reportId,
      timestamp: new Date().toISOString(),
      assetReference: preset.assetReference,
      investigatedFacts: preset.sampleFacts,
    };
    setIncidentInput(updated);
    handleGenerateTriage(updated);
  };

  // Handle Layer selection from visualizer or form
  const handleSelectLayer = (layer: PipelineLayer) => {
    const defaultRuleOuts = generateDefaultRuleOuts(layer, incidentInput.errorCode);
    const convertedFacts: InvestigatedFact[] = defaultRuleOuts.map((r) => ({
      id: r.id,
      label: r.statement,
      status: r.status,
      category: 'network',
      details: r.suggestedAction,
    }));

    const updated: IncidentInput = {
      ...incidentInput,
      pipelineLayer: layer,
      investigatedFacts: convertedFacts,
    };
    setIncidentInput(updated);
    if (triageOutput !== null || incidentInput.summary.trim() !== '') {
      handleGenerateTriage(updated);
    }
  };

  // Handle Fact Status updates
  const handleUpdateFactStatus = (id: string, newStatus: FactStatus) => {
    const updatedFacts = incidentInput.investigatedFacts.map((f) =>
      f.id === id ? { ...f, status: newStatus } : f
    );
    const updatedInput = { ...incidentInput, investigatedFacts: updatedFacts };
    setIncidentInput(updatedInput);
    if (triageOutput !== null || incidentInput.summary.trim() !== '') {
      handleGenerateTriage(updatedInput);
    }
  };

  const handleUpdateFactDetails = (id: string, details: string) => {
    const updatedFacts = incidentInput.investigatedFacts.map((f) =>
      f.id === id ? { ...f, details } : f
    );
    setIncidentInput({ ...incidentInput, investigatedFacts: updatedFacts });
  };

const handleAddCustomFact = (fact: InvestigatedFact) => {
  const updatedFacts = [...incidentInput.investigatedFacts, fact];
  const updatedInput = { ...incidentInput, investigatedFacts: updatedFacts };
  setIncidentInput(updatedInput);
  if (triageOutput !== null || incidentInput.summary.trim() !== '') {
    handleGenerateTriage(updatedInput);
  }
};

const handleRemoveFact = (id: string) => {
  const updatedFacts = incidentInput.investigatedFacts.filter((f) => f.id !== id);
  const updatedInput = { ...incidentInput, investigatedFacts: updatedFacts };
  setIncidentInput(updatedInput);
  if (triageOutput !== null || incidentInput.summary.trim() !== '') {
    handleGenerateTriage(updatedInput);
  }
};

  // Toggle Mode A / Mode B
  const handleToggleMode = (newMode: DiagnosticMode) => {
    const updated: IncidentInput = {
      ...incidentInput,
      diagnosticMode: newMode,
    };
    setIncidentInput(updated);
    if (triageOutput !== null || incidentInput.summary.trim() !== '') {
      handleGenerateTriage(updated);
    }
  };

  // Handle data applied from Raw Log parser
  const handleApplyParsedLogData = (parsed: Partial<IncidentInput>) => {
    const updated: IncidentInput = {
      ...incidentInput,
      ...parsed,
      timestamp: parsed.timestamp || new Date().toISOString(),
      pipelineLayer: (parsed.pipelineLayer as PipelineLayer) || incidentInput.pipelineLayer,
      diagnosticMode: (parsed.diagnosticMode as DiagnosticMode) || incidentInput.diagnosticMode,
    };
    setIncidentInput(updated);
    handleGenerateTriage(updated);
  };

  const handleApplyClientComplaintData = (
    extracted: Partial<IncidentInput>,
    shouldGenerateTriage: boolean = true
  ) => {
    const updated: IncidentInput = {
      ...incidentInput,
      ...extracted,
      timestamp: extracted.timestamp || new Date().toISOString(),
      pipelineLayer: (extracted.pipelineLayer as PipelineLayer) || incidentInput.pipelineLayer,
      diagnosticMode: (extracted.diagnosticMode as DiagnosticMode) || incidentInput.diagnosticMode,
    };
    setIncidentInput(updated);
    if (shouldGenerateTriage) {
      handleGenerateTriage(updated);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <Header
        onSelectPreset={handleSelectPreset}
        onOpenLogParser={() => setIsLogParserOpen(true)}
        onOpenClientComplaint={() => setIsClientComplaintOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onClearIncident={handleClearIncident}
        isIncidentActive={isIncidentActive}
        historyCount={history.length}
        aiAvailable={aiAvailable}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
{/* Unified Tabbed Ingestion Container */}

  
{intakeTab === 'parse' && (
  <ClientComplaintAnalyzer
    aiAvailable={aiAvailable}
    onApplyAnalysis={handleApplyClientComplaintData}
  />
)}

<PipelineVisualizer
  selectedLayer={incidentInput.pipelineLayer}
  onSelectLayer={handleSelectLayer}
  errorCode={incidentInput.errorCode}
/>
        {/* Two-Column Grid: Form & Rule-Out Matrix on left, Triage Dossier on right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Input Fields & Rule-Out Clarification Matrix (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-8">
            <IncidentForm
              input={incidentInput}
              onChange={(updated) => setIncidentInput((prev) => ({ ...prev, ...updated }))}
              onSubmit={() => handleGenerateTriage()}
              isLoading={isLoading}
            />

            <RuleOutClarificationMatrix
              facts={incidentInput.investigatedFacts}
              onUpdateFactStatus={handleUpdateFactStatus}
              onUpdateFactDetails={handleUpdateFactDetails}
              onAddCustomFact={handleAddCustomFact}
              onRemoveFact={handleRemoveFact}
              onRefreshTriage={() => handleGenerateTriage()}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column: Triage Dossier & Diagnostic Runbooks (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-8">
            <TriageDossierView
              triage={triageOutput}
              onToggleMode={handleToggleMode}
              isLoading={isLoading}
              onSelectSamplePreset={() => handleSelectPreset(INCIDENT_PRESETS[0])}
              onOpenLogParser={() => setIsLogParserOpen(true)}
              onOpenClientComplaint={() => setIsClientComplaintOpen(true)}
            />

            <DiagnosticRunbookView
              commands={triageOutput ? triageOutput.diagnosticCommands : []}
              queries={triageOutput ? triageOutput.telemetryQueries : []}
              currentLayer={incidentInput.pipelineLayer}
              reportId={incidentInput.reportId}
              onSelectLayer={handleSelectLayer}
              onApplyTelemetryValue={(field, val) =>
                setIncidentInput((prev) => ({ ...prev, [field]: val }))
              }
            />
          </div>
        </div>
      </main>

      {/* Application Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 mt-12 py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-300">TriageFlow — DFIR</span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span className="text-slate-400">Enterprise API Triage & Demarcation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Universal Telemetry</span>
            <span className="font-mono text-amber-400 font-semibold bg-amber-500/10 px-3 py-1 rounded border border-amber-500/20 text-xs shadow-sm">
              TriageFlow – DFIR • Engineered by R. C. Hanks
            </span>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ClientComplaintModal
        isOpen={isClientComplaintOpen}
        onClose={() => setIsClientComplaintOpen(false)}
        onApplyAnalysisToIncident={handleApplyClientComplaintData}
        aiAvailable={aiAvailable}
      />

      <RawLogParserModal
        isOpen={isLogParserOpen}
        onClose={() => setIsLogParserOpen(false)}
        onApplyParsedData={handleApplyParsedLogData}
      />

      <IncidentHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistoryItem={(item) => setTriageOutput(item)}
        onClearHistory={() => setHistory([])}
      />
    </div>
  );
}
