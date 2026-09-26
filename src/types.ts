export type PipelineLayer =
  | 'Layer 1: DNS / Client Network / IdP SSO'
  | 'Layer 2: API Gateway / Authentication Edge'
  | 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)'
  | 'Layer 4: Worker Queues / Async Processing Containers'
  | 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)'
  | 'Layer 6: Webhook / Callback Notification';

export type DiagnosticMode =
  | 'Mode A: Internal 5-Paragraph Technical Triage'
  | 'Mode B: Partner-Facing Plain Explanation';

export type FactStatus = 'untested' | 'confirmed_issue' | 'ruled_out';

export interface InvestigatedFact {
  id: string;
  label: string;
  status: FactStatus;
  category: 'network' | 'credentials' | 'payload' | 'upstream' | 'queue';
  details?: string;
}

// ---------------------------------------------------------------------------
// IOC telemetry layer
// ---------------------------------------------------------------------------

export type IocType = 'ip' | 'domain' | 'url' | 'hash' | 'command' | 'file_path' | 'registry' | 'account';

export type IocRole = 'attacker_source' | 'c2' | 'payload' | 'victim_asset' | 'benign';

export type IocFlag = 'empty_file_hash' | 'reserved_range' | 'truncated' | 'non_routable';

export interface IocRecord {
  type: IocType;
  indicator: string;
  context: string;
  role?: IocRole;
  firstSeen?: string; // ISO-8601 UTC timestamp
  sourceLine?: number; // Provenance back to raw log line
  hashAlgo?: 'md5' | 'sha1' | 'sha256';
  flags?: IocFlag[];
}

export interface EvidentiaryFields {
  clientIdentity?: string; // Org ID / Client Identity / User Email
  reportId: string; // Request ID / Transaction ID / Report ID
  timestamp: string; // Exact Timestamp (UTC) & Time Zone
  endpointUrl?: string; // Endpoint URL & HTTP Method (e.g., POST /v1/reports)
  httpMethod?: string; // GET, POST, PUT, DELETE
  assetReference: string; // Asset Hash / File Identifier (e.g., SHA-256 / URI / N/A)
  errorCode: string; // HTTP Status Code & Error Payload (e.g., 401, 403, 422, 504)
}

export interface Phase1TriageProtocol {
  // 1. Most Likely Failure Domain & Starting Point
  likelyFailureDomains: {
    rank: number;
    title: string;
    domain: string;
    likelihood: 'Primary (High)' | 'Secondary (Moderate)' | 'Tertiary (Low)';
    rationale: string;
    immediateAction: string;
  }[];
  // 2. Client-Facing Instructions & Evidence Collection Script
  clientEvidenceScript: {
    introGreeting: string;
    devToolsInstructions: string[];
    harExportSteps: string[];
    screenshotChecklist: string[];
    rawCopyScript: string;
  };
  // 3. Evidentiary Ingestion Fields to Extract
  evidentiaryFields: EvidentiaryFields;
  // 4. Pipeline Demarcation
  demarcation: {
    activeLayer: PipelineLayer;
    layerNumber: 1 | 2 | 3 | 4 | 5 | 6;
    demarcationBoundary: string;
    upstreamBoundary: string;
    downstreamBoundary: string;
    diagnosticFocus: string;
  };
}

export interface IncidentInput {
  summary: string;
  errorCode: string;
  pipelineLayer: PipelineLayer;
  reportId: string;
  timestamp: string;
  assetReference: string;
  diagnosticMode: DiagnosticMode;
  investigatedFacts: InvestigatedFact[];
  customNotes?: string;
  clientIdentity?: string;
  endpointUrl?: string;
  httpMethod?: string;
  traceparent?: string;
  cloudflareRayId?: string;
  clockFormat?: 'ISO_8601' | 'EPOCH_MS' | 'RFC_2822' | 'UTC_STRING';
  isTriageLocked?: boolean;
  iocs?: IocRecord[];
}

// Enforcement type to ensure zero-retention boundary on external handovers:
// strips client PII, internal notes, raw indicators, and internal rule-out state.
export type HandoverSafeIncident = Omit<IncidentInput, 'clientIdentity' | 'customNotes' | 'iocs' | 'investigatedFacts'>;

export interface DiagnosticCommand {
  title: string;
  command: string;
  description: string;
  layer: string;
}

export interface TelemetryQuery {
  platform: 'Datadog' | 'Elasticsearch / Kibana' | 'CloudWatch' | 'SQL Trace';
  query: string;
  description: string;
}

export interface SuggestedRuleOut {
  id: string;
  statement: string;
  suggestedAction: string;
  status: FactStatus;
}

export interface PartnerFacingResponse {
  situationSummary: string;
  whatHappened: string;
  partnerRuleOutSteps: string[];
  internalActionStatus: string;
  nextStepsForPartner: string[];
}

export interface TriageOutput {
  mode: DiagnosticMode;
  title: string;
  incidentRef: string;
  severity: 'SEV-1 Critical' | 'SEV-2 Major' | 'SEV-3 Minor' | 'P4 Informational';
  pipelineLayer: PipelineLayer;
  // Phase 1 Protocol: Initial Complaint Mapping & Evidence Intake
  phase1Protocol?: Phase1TriageProtocol;
  // Mode A: Standardized 5-Paragraph Technical Triage
  paragraphs?: {
    num: 1 | 2 | 3 | 4 | 5;
    heading: string;
    content: string;
  }[];
  // Mode B: Partner-Facing Plain Explanation
  partnerExplanation?: PartnerFacingResponse;
  // Active Rule-Out & Verification
  activeRuleOuts: SuggestedRuleOut[];
  // Diagnostic CLI & queries
  diagnosticCommands: DiagnosticCommand[];
  telemetryQueries: TelemetryQuery[];
  escalationPath: {
    tier: string;
    team: string;
    sla: string;
    contactChannel: string;
  };
  generatedAt: string;
  aiAssisted: boolean;
}

export interface ClientComplaintIssue {
  id: string;
  category: 'authentication' | 'rate_limit' | 'data_format' | 'network' | 'storage' | 'upstream_timeout' | 'downstream_clearinghouse' | 'webhook_replay';
  title: string;
  confidence: 'High' | 'Medium' | 'Low';
  suspectedLayer: PipelineLayer;
  explanation: string;
  immediateCheck: string;
  suggestedAction: string;
}

export interface ClientComplaintAnalysis {
  clientIdentity?: string;
  sentimentOrUrgency: 'CRITICAL / Blocker' | 'HIGH / Production Degraded' | 'MEDIUM / Intermittent' | 'LOW / Query';
  detectedSymptoms: string[];
  likelyIssues: ClientComplaintIssue[];
  extractedIncidentFields: {
    summary: string;
    errorCode: string;
    pipelineLayer: PipelineLayer;
    reportId: string;
    timestamp: string;
    assetReference: string;
    clientIdentity?: string;
    endpointUrl?: string;
    httpMethod?: string;
    traceparent?: string;
    cloudflareRayId?: string;
    isTriageLocked?: boolean;
    iocs?: IocRecord[];
  };
  recommendedClientReply: string;
  recommendedInternalNextStep: string;
}

export interface IncidentPreset {
  id: string;
  name: string;
  badge: string;
  summary: string;
  errorCode: string;
  pipelineLayer: PipelineLayer;
  reportId: string;
  assetReference: string;
  sampleFacts: InvestigatedFact[];
}
