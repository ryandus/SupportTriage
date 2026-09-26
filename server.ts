import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { buildDeterministicTriage } from './src/lib/triageEngine';
import { IncidentInput, TriageOutput, toHandoverSafeIncident } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'saas-triage-assistant',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Incident Triage Generation API
app.post('/api/triage', async (req, res) => {
  const incidentInput: IncidentInput = req.body;

  if (!incidentInput.summary || !incidentInput.pipelineLayer) {
    res.status(400).json({ error: 'Missing required incident fields' });
    return;
  }

  // Always compute deterministic baseline as reliable fallback
  const fallbackOutput: TriageOutput = buildDeterministicTriage(incidentInput);

  const ai = getAI();
  if (!ai) {
    res.json(fallbackOutput);
    return;
  }

  try {
    const isModeA = incidentInput.diagnosticMode.startsWith('Mode A');
    const investigatedContext = incidentInput.investigatedFacts && incidentInput.investigatedFacts.length > 0
      ? incidentInput.investigatedFacts.map(f => `- [${f.status.toUpperCase()}] ${f.label}${f.details ? ` (${f.details})` : ''}`).join('\n')
      : 'No verified facts yet.';

    const systemPrompt = `You are TriageFlow — A SaaS Playbook, a Senior SaaS Staff Support Engineer and Incident Commander specialized in enterprise API triage, cloud storage ingestion pipelines, worker queues, and downstream partner clearinghouse delivery workflows.
Generate an operational triage guide.

CRITICAL INSTRUCTIONS ON INVESTIGATED FACTS:
You must explicitly incorporate the investigated facts. If any fact is marked RULED_OUT (such as "client logs show no upload bottlenecks"), state clearly that this factor is eliminated and explain how the diagnostic focus shifts downstream. If any fact is marked CONFIRMED_ISSUE, incorporate it as a primary root cause contributor.

For Mode A (Internal 5-Paragraph Technical Triage):
Return 5 distinct, rigorous paragraphs:
Paragraph 1: Incident Diagnosis & Blast Radius (Impact scope, severity, affected customers/flows, urgency rating).
Paragraph 2: Pipeline Layer Breakdown & Architectural Root Cause Hypothesis (Trace through the specified pipeline layer, e.g. Steps 2-3 Storage Asset Fetch vs Steps 4-6 Downstream Partner Handshake, SSL/MTLS cert handshake, worker pool saturation).
Paragraph 3: Telemetry & Correlation Analysis (Log queries for Datadog/Elastic/CloudWatch, transaction trace ID correlation, asset hash validation, timestamp window skew analysis).
Paragraph 4: Active Rule-Out Checklist & Diagnostic Testing (Step-by-step verification: "client logs show no upload bottlenecks", "storage bucket IAM credentials valid", "downstream partner status page green", "MTLS client certificate unexpired", "payload conforms to API schema specification").
Paragraph 5: Mitigation, Recovery Runbook & Escalation Path (Immediate remediation commands, queue re-drive/DLQ purge procedures, rollback flags, escalation SLA).

For Mode B (Partner-Facing Plain Explanation):
Return clear, professional, transparent sections:
1. situationSummary
2. whatHappened
3. partnerRuleOutSteps (array of actionable bullet points for partner engineers)
4. internalActionStatus
5. nextStepsForPartner (array of actionable bullet points)`;

    // Mode B output is handed to external partners, so its prompt is built ONLY from the
    // runtime allow-listed HandoverSafeIncident: no client identity, engineer notes, raw IOCs,
    // or internal rule-out state reach the model, and therefore cannot be echoed into partner text.
    const promptSource = isModeA ? incidentInput : toHandoverSafeIncident(incidentInput);
    const internalContext = isModeA
      ? `INVESTIGATED FACTS / RULE-OUTS RECORDED SO FAR:
${investigatedContext}
${incidentInput.customNotes ? `Additional notes from engineer: ${incidentInput.customNotes}` : ''}`
      : `INVESTIGATED FACTS / RULE-OUTS: Withheld (zero-retention partner handover boundary). Do not speculate about internal investigation state.`;

    const userPrompt = `INCIDENT DETAILS:
1. Incident / Error Summary: ${promptSource.summary}
2. Error Code / HTTP Status: ${promptSource.errorCode}
3. Pipeline Layer: ${promptSource.pipelineLayer}
4. Telemetry:
   - Report / Transaction ID: ${promptSource.reportId}
   - Timestamp (UTC): ${promptSource.timestamp}
   - Hash / Asset Reference: ${promptSource.assetReference}
5. Diagnostic Mode: ${promptSource.diagnosticMode}

${internalContext}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            severity: {
              type: Type.STRING,
              description: 'SEV-1 Critical, SEV-2 Major, SEV-3 Minor, or P4 Informational',
            },
            paragraphs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  num: { type: Type.INTEGER },
                  heading: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['num', 'heading', 'content'],
              },
            },
            partnerExplanation: {
              type: Type.OBJECT,
              properties: {
                situationSummary: { type: Type.STRING },
                whatHappened: { type: Type.STRING },
                partnerRuleOutSteps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                internalActionStatus: { type: Type.STRING },
                nextStepsForPartner: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
            escalationTeam: { type: Type.STRING },
            escalationSla: { type: Type.STRING },
          },
          required: ['severity'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');

    // Merge AI generated guidance with deterministic diagnostic commands and queries
    const mergedOutput: TriageOutput = {
      ...fallbackOutput,
      severity: (parsed.severity as any) || fallbackOutput.severity,
      paragraphs: isModeA && parsed.paragraphs && parsed.paragraphs.length >= 4 ? parsed.paragraphs : fallbackOutput.paragraphs,
      partnerExplanation: !isModeA && parsed.partnerExplanation ? parsed.partnerExplanation : fallbackOutput.partnerExplanation,
      escalationPath: {
        ...fallbackOutput.escalationPath,
        team: parsed.escalationTeam || fallbackOutput.escalationPath.team,
        sla: parsed.escalationSla || fallbackOutput.escalationPath.sla,
      },
      aiAssisted: true,
    };

    res.json(mergedOutput);
  } catch (err: any) {
    console.error('Gemini triage generation failed, falling back to deterministic engine:', err);
    res.json(fallbackOutput);
  }
});

// Endpoint to parse raw logs/tickets into structured 5 fields
app.post('/api/parse-log', async (req, res) => {
  const { rawText } = req.body;
  if (!rawText || typeof rawText !== 'string') {
    res.status(400).json({ error: 'Missing rawText input' });
    return;
  }

  const ai = getAI();
  if (ai) {
    try {
      const parsePrompt = `Extract the 5 required incident fields from this technical log / error / ticket snippet:
"${rawText}"

Pipeline Layer MUST be one of:
- "Layer 1: DNS / Client Network / IdP SSO"
- "Layer 2: API Gateway / Authentication Edge"
- "Layer 3: Storage Ingestion Service (DB write, asset retrieval)"
- "Layer 4: Worker Queues / Async Processing Containers"
- "Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)"
- "Layer 6: Webhook / Callback Notification"

Diagnostic Mode MUST be:
- "Mode A: Internal 5-Paragraph Technical Triage" OR
- "Mode B: Partner-Facing Plain Explanation"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: parsePrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              errorCode: { type: Type.STRING },
              pipelineLayer: { type: Type.STRING },
              reportId: { type: Type.STRING },
              timestamp: { type: Type.STRING },
              assetReference: { type: Type.STRING },
              diagnosticMode: { type: Type.STRING },
              extractedRuleOuts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    status: { type: Type.STRING, description: 'confirmed_issue, ruled_out, or untested' },
                  },
                },
              },
            },
            required: ['summary', 'errorCode', 'pipelineLayer'],
          },
        },
      });

      const data = JSON.parse(response.text?.trim() || '{}');
      res.json(data);
      return;
    } catch (err) {
      console.warn('AI log parsing error, using regex parser:', err);
    }
  }

  // Regex fallback parser
  let summary = 'API Pipeline Error';
  let errorCode = '500 Internal Server Error';
  let pipelineLayer = 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)';
  let reportId = `TXN-${Date.now().toString().slice(-6)}`;
  let timestamp = new Date().toISOString();
  let assetReference = 'N/A';
  let diagnosticMode = 'Mode A: Internal 5-Paragraph Technical Triage';

  // Extract HTTP status code or socket exception
  const socketMatch = rawText.match(/\b(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|EPIPE|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|ERR_TLS_CERT_ALTNAME_INVALID|SSL_ERROR_SYSCALL)\b/i);
  const codeMatch = rawText.match(/\b(400|401|402|403|404|405|406|407|408|409|410|412|413|414|415|416|422|423|424|426|429|431|499|500|501|502|503|504|505|507|508|511|520|521|522|523|524|525|526)\b/);
  
  if (socketMatch) {
    errorCode = socketMatch[1].toUpperCase();
  } else if (codeMatch) {
    const code = codeMatch[1];
    const codeMap: Record<string, string> = {
      '400': '400 Bad Request',
      '401': '401 Unauthorized',
      '402': '402 Payment Required',
      '403': '403 Forbidden',
      '404': '404 Not Found',
      '405': '405 Method Not Allowed',
      '406': '406 Not Acceptable',
      '407': '407 Proxy Authentication Required',
      '408': '408 Request Timeout',
      '409': '409 Conflict',
      '410': '410 Gone',
      '412': '412 Precondition Failed',
      '413': '413 Payload Too Large',
      '414': '414 URI Too Long',
      '415': '415 Unsupported Media Type',
      '416': '416 Range Not Satisfiable',
      '422': '422 Unprocessable Entity',
      '423': '423 Locked',
      '424': '424 Failed Dependency',
      '426': '426 Upgrade Required',
      '429': '429 Too Many Requests',
      '431': '431 Request Header Fields Too Large',
      '499': '499 Client Closed Request',
      '500': '500 Internal Server Error',
      '501': '501 Not Implemented',
      '502': '502 Bad Gateway',
      '503': '503 Service Unavailable',
      '504': '504 Gateway Timeout',
      '505': '505 HTTP Version Not Supported',
      '507': '507 Insufficient Storage',
      '508': '508 Loop Detected',
      '511': '511 Network Authentication Required',
      '520': '520 Web Server Returned an Unknown Error',
      '521': '521 Web Server Is Down',
      '522': '522 Connection Timed Out',
      '523': '523 Origin Is Unreachable',
      '524': '524 A Timeout Occurred',
      '525': '525 SSL Handshake Failed',
      '526': '526 Invalid SSL Certificate',
    };
    errorCode = codeMap[code] || `${code} Error`;
  }

  // Extract Report / Transaction ID across full industry format spectrum
  const w3cMatch = rawText.match(/\b(00-[a-f0-9]{32}-[a-f0-9]{16}-01)\b/i);
  const xrayMatch = rawText.match(/\b(1-[a-f0-9]{8}-[a-f0-9]{24})\b/i);
  const cfRayMatch = rawText.match(/\b([a-f0-9]{16}-[A-Z]{3})\b/);
  const ddTraceMatch = rawText.match(/\b(dd-trace-[0-9]+)\b/i);
  const uuidMatch = rawText.match(/\b(req_[0-9a-fA-F-]{36}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/);
  const prefixMatch = rawText.match(/\b(REP-[A-Za-z0-9_-]+|TXN-[A-Za-z0-9_-]+|EXT-[A-Za-z0-9_-]+|PARTNER-SYNC-[A-Za-z0-9_-]+|BATCH-[A-Za-z0-9_-]+|sqs-msg-[A-Za-z0-9_-]+|evt_[A-Za-z0-9]+|kafka-[A-Za-z0-9_-]+|ISA-[A-Za-z0-9_-]+)\b/i);
  const labeledIdMatch = rawText.match(/(?:report[_-]?id|transaction[_-]?id|trace[_-]?id|request[_-]?id|cf[_-]?ray|x-amzn-trace-id|id)[:=\s]+["']?([A-Za-z0-9_.:-]{6,64})["']?/i);

  if (w3cMatch) {
    reportId = w3cMatch[1];
  } else if (xrayMatch) {
    reportId = xrayMatch[1];
  } else if (cfRayMatch) {
    reportId = cfRayMatch[1];
  } else if (ddTraceMatch) {
    reportId = ddTraceMatch[1];
  } else if (prefixMatch) {
    reportId = prefixMatch[1];
  } else if (uuidMatch) {
    reportId = uuidMatch[1];
  } else if (labeledIdMatch) {
    reportId = labeledIdMatch[1];
  }

  // Extract SHA-256 or Asset URL
  const shaMatch = rawText.match(/\b([a-fA-F0-9]{64})\b/);
  if (shaMatch) {
    assetReference = `sha256:${shaMatch[1].toLowerCase()}`;
  } else {
    const urlMatch = rawText.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|mp4|zip|bin)[^\s"'<>]*/i);
    if (urlMatch) {
      assetReference = urlMatch[0];
    }
  }

  // Extract Pipeline Layer hints
  const lower = rawText.toLowerCase();
  if (lower.includes('partner') || lower.includes('clearinghouse') || lower.includes('handshake') || lower.includes('mtls')) {
    pipelineLayer = 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)';
    summary = lower.includes('timeout') ? 'Outbound timeout during downstream partner handshake' : 'Downstream partner dispatch failure';
  } else if (lower.includes('download') || lower.includes('s3') || lower.includes('presign') || lower.includes('step 2') || lower.includes('asset') || lower.includes('storage')) {
    pipelineLayer = 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)';
    summary = lower.includes('expired') || lower.includes('403') ? 'Failed to download file from URL (signature expired)' : 'Asset download failed';
  } else if (lower.includes('webhook') || lower.includes('hmac') || lower.includes('callback')) {
    pipelineLayer = 'Layer 6: Webhook / Callback Notification';
    summary = 'Webhook delivery rejected by partner endpoint';
  } else if (lower.includes('worker') || lower.includes('queue') || lower.includes('oom') || lower.includes('celery') || lower.includes('container')) {
    pipelineLayer = 'Layer 4: Worker Queues / Async Processing Containers';
    summary = 'Worker task failure during asset processing';
  } else if (lower.includes('gateway') || lower.includes('schema') || lower.includes('422') || lower.includes('unprocessable') || lower.includes('bearer')) {
    pipelineLayer = 'Layer 2: API Gateway / Authentication Edge';
    summary = 'Payload rejected at Edge API Gateway';
  } else if (lower.includes('dns') || lower.includes('ingress') || lower.includes('sso') || lower.includes('saml') || lower.includes('502') || lower.includes('reset')) {
    pipelineLayer = 'Layer 1: DNS / Client Network / IdP SSO';
    summary = 'Client network, DNS resolution or IdP SSO session failure';
  }

  res.json({
    summary,
    errorCode,
    pipelineLayer,
    reportId,
    timestamp,
    assetReference,
    diagnosticMode,
  });
});

// Endpoint to analyze client-specific complaints and detect likely issues
app.post('/api/analyze-complaint', async (req, res) => {
  const { complaintText } = req.body;
  if (!complaintText || typeof complaintText !== 'string') {
    res.status(400).json({ error: 'Missing complaintText' });
    return;
  }

  const ai = getAI();
  if (ai) {
    try {
      const complaintPrompt = `You are TriageFlow — A SaaS Playbook, a Senior SaaS Support Engineering Lead specializing in high-reliability API architectures, storage presigned assets (S3/GCS), and downstream partner clearance/gateways.
A client / partner submitted this specific complaint:
"${complaintText}"

Perform a deep technical triage to:
1. Detect specific symptoms and identify the urgency/sentiment (CRITICAL / Blocker, HIGH / Production Degraded, MEDIUM / Intermittent, LOW / Query).
2. Rank 2-3 likely issues catching the probable root cause, categorized into authentication, rate_limit, data_format, network, storage, upstream_timeout, downstream_clearinghouse, or webhook_replay.
3. Suggest the precise suspected pipeline layer out of:
   - "Layer 1: DNS / Client Network / IdP SSO"
   - "Layer 2: API Gateway / Authentication Edge"
   - "Layer 3: Storage Ingestion Service (DB write, asset retrieval)"
   - "Layer 4: Worker Queues / Async Processing Containers"
   - "Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)"
   - "Layer 6: Webhook / Callback Notification"
4. Extract the 5+ operational fields (summary, errorCode, pipelineLayer, reportId, timestamp, assetReference, clientIdentity, endpointUrl, httpMethod).
5. Draft an empathetic, highly professional, non-jargon client reply with immediate verification steps they can test.
6. Provide clear internal next steps for Tier 3 engineers.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: complaintPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clientIdentity: { type: Type.STRING },
              sentimentOrUrgency: {
                type: Type.STRING,
                description: 'One of: CRITICAL / Blocker, HIGH / Production Degraded, MEDIUM / Intermittent, LOW / Query',
              },
              detectedSymptoms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              likelyIssues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    confidence: { type: Type.STRING, description: 'High, Medium, or Low' },
                    suspectedLayer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    immediateCheck: { type: Type.STRING },
                    suggestedAction: { type: Type.STRING },
                  },
                  required: ['id', 'title', 'confidence', 'suspectedLayer', 'explanation', 'immediateCheck', 'suggestedAction'],
                },
              },
              extractedIncidentFields: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  errorCode: { type: Type.STRING },
                  pipelineLayer: { type: Type.STRING },
                  reportId: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                  assetReference: { type: Type.STRING },
                  clientIdentity: { type: Type.STRING },
                  endpointUrl: { type: Type.STRING },
                  httpMethod: { type: Type.STRING },
                },
                required: ['summary', 'errorCode', 'pipelineLayer', 'reportId', 'timestamp', 'assetReference'],
              },
              recommendedClientReply: { type: Type.STRING },
              recommendedInternalNextStep: { type: Type.STRING },
            },
            required: ['sentimentOrUrgency', 'detectedSymptoms', 'likelyIssues', 'extractedIncidentFields', 'recommendedClientReply', 'recommendedInternalNextStep'],
          },
        },
      });

      const parsedAnalysis = JSON.parse(response.text?.trim() || '{}');
      res.json(parsedAnalysis);
      return;
    } catch (err) {
      console.warn('AI complaint analysis failed, falling back to deterministic parser:', err);
    }
  }

  // Fallback deterministic analysis logic
  const lower = complaintText.toLowerCase();
  let pipelineLayer = 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)';
  let errorCode = '403 Forbidden';
  let summary = 'Failed to download file from URL (presigned storage signature expired)';
  let urgency = 'HIGH / Production Degraded';

  if (lower.includes('urgent') || lower.includes('blocking') || lower.includes('critical') || lower.includes('emergency')) {
    urgency = 'CRITICAL / Blocker';
  }

  const symptoms: string[] = [];
  const likelyIssues: any[] = [];

  if (lower.includes('s3') || lower.includes('presign') || lower.includes('expired') || (lower.includes('403') && lower.includes('download'))) {
    symptoms.push('Presigned storage URL X-Amz-Expires exceeded before download fetch');
    symptoms.push('Ingest workers aborted asset retrieval with 403 Forbidden');
    likelyIssues.push({
      id: 'issue-s3-ttl',
      category: 'storage',
      title: 'Presigned S3/GCS Storage URL Expiration Window Exceeded',
      confidence: 'High',
      suspectedLayer: 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)',
      explanation: 'The client-provided asset URL expired prior to the internal asynchronous download worker retrieving the byte stream.',
      immediateCheck: 'Inspect URL X-Amz-Date + X-Amz-Expires against storage worker HTTP fetch timestamp.',
      suggestedAction: 'Advise client to increase presigned expiration TTL to 60-120 minutes or provide IAM bucket delegation.'
    });
  } else if (lower.includes('clearinghouse') || lower.includes('partner') || lower.includes('504') || lower.includes('handshake')) {
    pipelineLayer = 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)';
    errorCode = '504 Gateway Timeout';
    summary = 'Outbound timeout during downstream partner MTLS handshake and dispatch';
    symptoms.push('Downstream clearinghouse MTLS handshake timed out');
    symptoms.push('Report stuck in dispatch queue exceeding 60-second read deadline');
    likelyIssues.push({
      id: 'issue-downstream-handshake',
      category: 'downstream_clearinghouse',
      title: 'Downstream Partner API Gateway Latency or MTLS Stall',
      confidence: 'High',
      suspectedLayer: 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)',
      explanation: 'Outbound worker reached deadline during MTLS SSL handshake or waiting for partner response envelope.',
      immediateCheck: 'Run openssl s_client to test clearinghouse MTLS endpoint and verify Cloud NAT static IP.',
      suggestedAction: 'Confirm NAT IP whitelist with partner security and verify client certificate in Vault.'
    });
  } else if (lower.includes('422') || lower.includes('unprocessable') || lower.includes('schema')) {
    pipelineLayer = 'Layer 2: API Gateway / Authentication Edge';
    errorCode = '422 Unprocessable Entity';
    summary = 'Payload rejected at Edge API Gateway due to schema validation failure';
    symptoms.push('Gateway returned 422 Unprocessable Entity');
    symptoms.push('Timestamp or mandatory field format rejected by OpenAPI schema validator');
    likelyIssues.push({
      id: 'issue-schema-validation',
      category: 'data_format',
      title: 'Payload Schema Validation Mismatch (ISO 8601 Timestamp or Missing Hash)',
      confidence: 'High',
      suspectedLayer: 'Layer 2: API Gateway / Authentication Edge',
      explanation: 'The incoming report body failed strict OpenAPI validation due to non-standard timestamp format or missing mandatory properties.',
      immediateCheck: 'Inspect gateway error response body and validate JSON payload against OpenAPI schema.',
      suggestedAction: 'Guide partner on formatting timestamps to strict ISO 8601 UTC (e.g. YYYY-MM-DDTHH:mm:ssZ).'
    });
  } else {
    symptoms.push('Generic operational complaint regarding transaction processing');
    likelyIssues.push({
      id: 'issue-generic-pipeline',
      category: 'upstream_timeout',
      title: 'Asynchronous Ingestion Bottleneck or Unhandled Pipeline Exception',
      confidence: 'Medium',
      suspectedLayer: pipelineLayer,
      explanation: 'Client input indicates an unexpected processing stall or error response across the ingestion boundary.',
      immediateCheck: 'Query Datadog APM for trace ID associated with transaction.',
      suggestedAction: 'Review worker logs and trigger manual diagnostic check.'
    });
  }

  const idMatch = complaintText.match(/\b(REP-[A-Za-z0-9_-]+|TXN-[A-Za-z0-9_-]+|EXT-[A-Za-z0-9_-]+|ZD-[0-9]+)\b/i);
  const repId = idMatch ? idMatch[1] : `TXN-${Date.now().toString().slice(-6)}`;
  const shaMatch = complaintText.match(/\b([a-fA-F0-9]{64})\b/);
  const assetRef = shaMatch ? `sha256:${shaMatch[1].toLowerCase()}` : 'N/A';

  res.json({
    clientIdentity: 'Client Partner / Operator',
    sentimentOrUrgency: urgency,
    detectedSymptoms: symptoms,
    likelyIssues,
    extractedIncidentFields: {
      summary,
      errorCode,
      pipelineLayer,
      reportId: repId,
      timestamp: new Date().toISOString(),
      assetReference: assetRef,
      clientIdentity: 'Client Partner / Operator',
      endpointUrl: '/v1/reports',
      httpMethod: 'POST'
    },
    recommendedClientReply: `Hello,\n\nThank you for providing the details for report ${repId}.\nOur Tier 3 Engineering team is investigating this under ${pipelineLayer.split(':')[0]}.\nPreliminary root cause: ${likelyIssues[0]?.title}.\nImmediate check: ${likelyIssues[0]?.immediateCheck}\n\nWe will update you within 30 minutes.\n\nBest regards,\nTriageFlow — A SaaS Playbook\n\nTriageFlow — A SaaS Playbook • Engineered by R. Hanks`,
    recommendedInternalNextStep: `Correlate report ID ${repId} across Datadog APM and investigate ${pipelineLayer}.\n\n---\nTriageFlow — A SaaS Playbook • Engineered by R. Hanks`
  });
});

// Vite middleware for development or static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TriageFlow — A SaaS Playbook server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
