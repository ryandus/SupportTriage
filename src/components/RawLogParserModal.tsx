import React, { useState } from 'react';
import {
  X,
  FileCode2,
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  AlertCircle
} from 'lucide-react';
import { IncidentInput } from '../types';

interface RawLogParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyParsedData: (parsed: Partial<IncidentInput>) => void;
}

const SAMPLE_LOGS = [
  {
    title: 'Storage Ingestion S3 Presigned Expiry Log (403)',
    text: `2026-09-12T14:22:08Z [ERROR] storage-asset-fetcher: Failed to download file from URL for transaction TXN-2026-9821-X9.
HTTP 403 Forbidden: Request has expired.
URI: https://partner-vault.s3.amazonaws.com/evidence/d8a29b4e72cf1902c3851b4d32a9e35471a2e9b048cf7a1b029341bc8e390c12.bin?X-Amz-Date=20260912T130000Z&X-Amz-Expires=900
Step 2 DB Query completed in 12ms. Step 3 Asset Download aborted.`
  },
  {
    title: 'Downstream Clearinghouse Outbound Handshake Timeout (504)',
    text: `2026-09-12T15:10:45Z [CRITICAL] downstream-partner-gateway: Outbound timeout during downstream partner MTLS handshake.
Transaction EXT-PARTNER-8849102 status: 504 Gateway Timeout.
Connection reset or SSL ETIMEDOUT while packaging transmission payload at Step 4. Egress NAT IP: 35.192.44.12.
Payload hash: N/A (envelope phase).`
  },
  {
    title: 'Edge Gateway Schema Validation Rejection (422)',
    text: `2026-09-12T16:04:12Z [WARN] edge-api-gateway: Request payload rejected due to JSON schema validation failure.
POST /v1/reports returned 422 Unprocessable Entity for txn_id TXN-8392019-PROD.
Validation error: incidentDateTime format "+0000" does not conform to ISO8601 with colon offset.
Hash: sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a`
  }
];

export const RawLogParserModal: React.FC<RawLogParserModalProps> = ({
  isOpen,
  onClose,
  onApplyParsedData
}) => {
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setParseError(null);

    try {
      const res = await fetch('/api/parse-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      onApplyParsedData(data);
      onClose();
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse raw logs');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Parse Raw Log, Datadog Alert or Ticket</h3>
              <p className="text-xs text-slate-400">Extracts the 5 required operational incident fields automatically</p>
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

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Quick sample chips */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-300">Quick Samples:</div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_LOGS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRawText(sample.text)}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors text-left"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="space-y-1.5">
            <label htmlFor="raw-log-textarea" className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Paste Raw Technical Log / Stack / Ticket</span>
              <span className="text-[11px] text-slate-400 font-normal">JSON, curl output, or error text</span>
            </label>
            <textarea
              id="raw-log-textarea"
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste log snippet here..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {parseError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-slate-950/60 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <span className="font-mono text-amber-400/90 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px]">
              SupportTriage • Engineered by R. Hanks
            </span>
          </div>

          <button
            id="apply-parsed-log-btn"
            type="button"
            disabled={isParsing || !rawText.trim()}
            onClick={handleParse}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
          >
            {isParsing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Parsing Telemetry...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Parse & Populate Triage Fields</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
