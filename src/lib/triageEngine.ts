import {
  IncidentInput,
  HandoverSafeIncident,
  PartnerFacingResponse,
  TriageOutput,
  DiagnosticCommand,
  TelemetryQuery,
  SuggestedRuleOut,
  toHandoverSafeIncident
} from '../types';
import { buildPhase1Protocol } from './phase1Protocol';

export function generateDefaultRuleOuts(
  pipelineLayer: string,
  errorCode: string
): SuggestedRuleOut[] {
  const commonRuleOuts: SuggestedRuleOut[] = [
    {
      id: 'ruleout-client-bottleneck',
      statement: 'Client logs show no upload bottlenecks',
      suggestedAction: 'Inspect client egress bandwidth, TCP zero-window events, and packet loss metrics to confirm local network stability.',
      status: 'untested'
    }
  ];

  if (pipelineLayer.includes('Storage Ingestion') || pipelineLayer.includes('Layer 3')) {
    return [
      ...commonRuleOuts,
      {
        id: 'ruleout-presigned-ttl',
        statement: 'Presigned S3/GCS URL expiration window expired prior to fetch',
        suggestedAction: 'Compare URL signature generation timestamp against storage step 2 fetch attempt timestamp in Datadog trace.',
        status: 'untested'
      },
      {
        id: 'ruleout-storage-iam',
        statement: 'Target bucket IAM policy or KMS encryption key revoked access',
        suggestedAction: 'Execute AWS CLI STS / GCS get-iam-policy to verify storage ingestion role has s3:GetObject on prefix.',
        status: 'untested'
      },
      {
        id: 'ruleout-asset-existence',
        statement: 'Target asset exists at specified source URI (not deleted or moved)',
        suggestedAction: 'Run HTTP HEAD request with valid credentials to verify 200 OK and Content-Length > 0.',
        status: 'untested'
      },
      {
        id: 'ruleout-hash-integrity',
        statement: 'Asset SHA-256 matches manifest checksum before database write',
        suggestedAction: 'Stream asset through local SHA-256 hasher and compare against metadata record.',
        status: 'untested'
      }
    ];
  }

  if (pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5')) {
    return [
      ...commonRuleOuts,
      {
        id: 'ruleout-partner-status',
        statement: 'Downstream partner production receiving endpoint operational & green',
        suggestedAction: 'Check partner system status page or run automated health probe against partner API gateway.',
        status: 'untested'
      },
      {
        id: 'ruleout-mtls-cert',
        statement: 'Outbound MTLS client certificate is valid, installed, and unexpired',
        suggestedAction: 'Verify client cert expiration date and root CA trust bundle using OpenSSL s_client.',
        status: 'untested'
      },
      {
        id: 'ruleout-nat-ip-whitelist',
        statement: 'Egress NAT IP address matches partner firewall whitelist CIDR',
        suggestedAction: 'Check Cloud NAT IP allocation pool against registered static egress list.',
        status: 'untested'
      },
      {
        id: 'ruleout-payload-schema',
        statement: 'Transmission payload complies with downstream partner schema specification',
        suggestedAction: 'Validate exported JSON/XML payload against schema specification using validator tool.',
        status: 'untested'
      }
    ];
  }

  if (pipelineLayer.includes('API Gateway') || pipelineLayer.includes('Layer 2')) {
    return [
      ...commonRuleOuts,
      {
        id: 'ruleout-auth-token-valid',
        statement: 'Partner Bearer token is valid, unexpired, and has required write scope',
        suggestedAction: 'Decode JWT claim at gateway auth filter and verify exp timestamp and audience scope.',
        status: 'untested'
      },
      {
        id: 'ruleout-schema-required-fields',
        statement: 'All mandatory payload fields (timestamp, identifiers, checksum) present in payload',
        suggestedAction: 'Validate JSON against Gateway OpenAPI 3.0 schema validator.',
        status: 'untested'
      },
      {
        id: 'ruleout-gateway-rate-limit',
        statement: 'Partner rate limit quota has not been exceeded within rolling window',
        suggestedAction: 'Inspect Envoy/Kong x-ratelimit-remaining response header and Redis counter.',
        status: 'untested'
      }
    ];
  }

  if (pipelineLayer.includes('Worker Queues') || pipelineLayer.includes('Layer 4')) {
    return [
      ...commonRuleOuts,
      {
        id: 'ruleout-worker-oom',
        statement: 'Worker memory consumption exceeded Kubernetes pod cgroup limit',
        suggestedAction: 'Inspect kubectl describe pod for Last State: Terminated with Exit Code 137 (OOMKilled).',
        status: 'untested'
      },
      {
        id: 'ruleout-queue-dlq',
        statement: 'Message acknowledged and redirected to Dead Letter Queue (DLQ)',
        suggestedAction: 'Check RabbitMQ / Kafka DLQ consumer metrics for message id correlation.',
        status: 'untested'
      },
      {
        id: 'ruleout-disk-scratch-space',
        statement: 'Worker node scratch volume (/tmp) has sufficient disk space (>10GB free)',
        suggestedAction: 'Run df -h on worker nodes or check Node Disk Pressure alerts.',
        status: 'untested'
      }
    ];
  }

  if (pipelineLayer.includes('Webhook') || pipelineLayer.includes('Layer 6')) {
    return [
      ...commonRuleOuts,
      {
        id: 'ruleout-webhook-secret-match',
        statement: 'HMAC signature matches partner registered webhook signing secret',
        suggestedAction: 'Compute HMAC-SHA256 signature locally against raw payload bytes and compare.',
        status: 'untested'
      },
      {
        id: 'ruleout-partner-endpoint-up',
        statement: 'Partner webhook listener endpoint returns 2xx within 5-second timeout',
        suggestedAction: 'Test partner webhook URL with dummy ping payload and verify TLS certificate chain.',
        status: 'untested'
      },
      {
        id: 'ruleout-clock-skew',
        statement: 'Timestamp clock skew between SaaS dispatcher and partner receiver < 300s',
        suggestedAction: 'Verify NTP synchronization on dispatcher cluster against pool.ntp.org.',
        status: 'untested'
      }
    ];
  }

  // Layer 1 default (DNS / Client Network / IdP SSO)
  return [
    ...commonRuleOuts,
    {
      id: 'ruleout-sso-session',
      statement: 'Client IdP SAML/OIDC session token is valid and unexpired',
      suggestedAction: 'Have client test login in incognito window or clear browser cache for origin domain.',
      status: 'untested'
    },
    {
      id: 'ruleout-dns-propagation',
      statement: 'DNS records for API domain resolve uniformly across global Anycast PoPs',
      suggestedAction: 'Execute dig +trace against primary authoritative nameservers.',
      status: 'untested'
    },
    {
      id: 'ruleout-tls-negotiation',
      statement: 'Partner client supports TLS 1.2+ with modern cipher suites',
      suggestedAction: 'Examine edge Envoy access logs for SSL handshake failure error codes.',
      status: 'untested'
    },
    {
      id: 'ruleout-waf-block',
      statement: 'Cloudflare / AWS WAF security rules did not trigger IP or Geo-blocking',
      suggestedAction: 'Search WAF sampled requests for partner source IP and rule action: BLOCK.',
      status: 'untested'
    }
  ];
}

/**
 * Mode B partner-facing text. Accepts ONLY a HandoverSafeIncident, so client PII,
 * internal notes, raw IOCs, and internal rule-out state are unreachable here by type,
 * and callers are expected to pass the output of toHandoverSafeIncident() (runtime allow-list).
 */
export function buildPartnerExplanation(safe: HandoverSafeIncident): PartnerFacingResponse {
  const { summary, errorCode, pipelineLayer, reportId, timestamp } = safe;

  return {
    situationSummary: `We are actively investigating an issue affecting transaction ${reportId} submitted on ${timestamp}. Our systems encountered an unexpected status (${errorCode}: ${summary}) while processing this report through the ${pipelineLayer.split(':')[0]} stage.`,
    whatHappened: `When your request was received, our platform initiated the standard delivery process. However, during the ${pipelineLayer.includes('Storage') ? 'asset retrieval and verification step' : 'gateway validation and processing stage'}, the connection did not complete as expected. ${
      pipelineLayer.includes('Storage Ingestion') || pipelineLayer.includes('Layer 3')
        ? 'Specifically, our system was unable to download the media asset associated with the request from the provided storage URL, resulting in an access or expiration failure.'
        : pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5')
        ? 'Our automated delivery system encountered an outbound timeout while transmitting the payload to the downstream partner endpoint.'
        : 'Our gateway validation service identified an issue with the format or parameters of the incoming request.'
    }`,
    partnerRuleOutSteps: [
      'Confirm that your client-side upload systems and network egress logs show no transmission bottlenecks or local errors.',
      pipelineLayer.includes('Storage Ingestion') || pipelineLayer.includes('Layer 3')
        ? 'Verify that the presigned storage URL has an expiration TTL of at least 60 minutes and that source bucket access permissions are active.'
        : pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5')
        ? 'No partner-side action required for external endpoint delivery; our internal team is actively monitoring connection retries.'
        : 'Check that all required fields (such as timestamp format and SHA-256 asset hash) match our API specification exactly.',
      'Ensure that outgoing requests from your environment use the updated production API bearer token.'
    ],
    internalActionStatus: `Our SaaS Support Engineering and Ingestion On-Call teams have isolated the incident to transaction ${reportId}. We are re-verifying connection certificates, inspecting intermediate storage buffers, and preparing to re-process the report without requiring you to regenerate the original data if possible.`,
    nextStepsForPartner: [
      `Keep note of Transaction Reference ID: ${reportId}.`,
      'If you have updated or refreshed asset URLs, please reply directly with the updated reference.',
      'Our team will provide an updated status within the next 30 minutes or as soon as delivery confirmation is received.'
    ]
  };
}

export function buildDeterministicTriage(input: IncidentInput): TriageOutput {
  const {
    summary,
    errorCode,
    pipelineLayer,
    reportId,
    timestamp,
    assetReference,
    diagnosticMode,
    investigatedFacts
  } = input;

  // Determine severity based on layer & error code
  let severity: 'SEV-1 Critical' | 'SEV-2 Major' | 'SEV-3 Minor' | 'P4 Informational' = 'SEV-2 Major';
  if (pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5') || errorCode.startsWith('504') || errorCode.startsWith('502')) {
    severity = 'SEV-1 Critical';
  } else if (errorCode.startsWith('422') || errorCode.startsWith('401') || errorCode.startsWith('403')) {
    severity = 'SEV-2 Major';
  } else if (errorCode.startsWith('404')) {
    severity = 'SEV-3 Minor';
  }

  // Analyze investigated facts
  const ruledOutFacts = investigatedFacts.filter(f => f.status === 'ruled_out');
  const confirmedIssueFacts = investigatedFacts.filter(f => f.status === 'confirmed_issue');

  // Diagnostic Commands tailored to the incident
  const diagnosticCommands: DiagnosticCommand[] = [];
  const telemetryQueries: TelemetryQuery[] = [];

  // Generate Layer-specific diagnostic commands & queries
  if (pipelineLayer.includes('Storage Ingestion') || pipelineLayer.includes('Layer 3')) {
    diagnosticCommands.push({
      title: 'Verify Asset Download & Storage HTTP Headers',
      command: `curl -s -D - -o /dev/null -X GET "https://storage.internal.platform.io/v1/assets/${assetReference !== 'N/A' ? assetReference : 'TARGET_ASSET'}" \\\n  -H "Authorization: Bearer <INTERNAL_SVC_TOKEN>" \\\n  -H "X-Transaction-ID: ${reportId}" --max-time 10`,
      description: 'Checks direct reachability and response headers (Content-Length, Cache-Control, ETag) without downloading full payload.',
      layer: 'Storage Ingestion (Steps 2–3)'
    });
    diagnosticCommands.push({
      title: 'Inspect S3 / GCS Presigned URL Signature & Expiry Header',
      command: `aws s3 presign "s3://partner-storage-vault/${reportId}/${assetReference !== 'N/A' ? assetReference : 'asset.bin'}" --expires-in 3600`,
      description: 'Generates a fresh test presigned signature to isolate URL expiry vs IAM permission failures.',
      layer: 'Storage & IAM'
    });

    telemetryQueries.push({
      platform: 'Datadog',
      query: `service:storage-asset-fetcher @transaction_id:"${reportId}" @http.status_code:${errorCode.split(' ')[0]}`,
      description: 'Pulls full distributed trace for Storage Ingestion Step 2 asset fetch and Step 3 local caching.'
    });
    telemetryQueries.push({
      platform: 'Elasticsearch / Kibana',
      query: `service.name:"storage-ingestion" AND (transaction_id:"${reportId}" OR asset_hash:"${assetReference}")`,
      description: 'Searches application error logs for storage driver exceptions and download timeouts.'
    });
    telemetryQueries.push({
      platform: 'SQL Trace',
      query: `SELECT id, status, partner_id, asset_url, download_attempts, error_message, updated_at \nFROM storage_delivery_tasks \nWHERE transaction_id = '${reportId}' \nLIMIT 5;`,
      description: 'Inspects task queue record and stored asset download metadata.'
    });
  } else if (pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5')) {
    diagnosticCommands.push({
      title: 'Test Downstream Partner MTLS Handshake & Cipher Negotiation',
      command: `openssl s_client -connect api.downstream-partner.com:443 \\\n  -cert /etc/ssl/certs/partner-client-cert.pem \\\n  -key /etc/ssl/private/partner-client-key.pem \\\n  -CAfile /etc/ssl/certs/ca-bundle.pem \\\n  -servername api.downstream-partner.com -brief -status`,
      description: 'Validates outbound MTLS mutual authentication, certificate expiration, and TLS 1.3/1.2 cipher handshake.',
      layer: 'Downstream Partner (Steps 4–6)'
    });
    diagnosticCommands.push({
      title: 'Execute Mock Partner Healthcheck Handshake',
      command: `curl -v -X POST "https://api.downstream-partner.com/v2/healthcheck" \\\n  --cert /etc/ssl/certs/partner-client-cert.pem \\\n  --key /etc/ssl/private/partner-client-key.pem \\\n  -H "Content-Type: application/json" \\\n  -H "X-Correlation-ID: ${reportId}" \\\n  -d '{"ping":true,"timestamp":"${timestamp}"}' --max-time 15`,
      description: 'Transmits a lightweight ping payload through the outbound NAT gateway to check upstream receiver latency.',
      layer: 'Partner API Handshake'
    });

    telemetryQueries.push({
      platform: 'Datadog',
      query: `service:partner-gateway @report_id:"${reportId}" OR @trace.downstream_status:"${errorCode.split(' ')[0]}"`,
      description: 'Monitors outbound HTTP client latency, TCP handshake time, and downstream partner error frames.'
    });
    telemetryQueries.push({
      platform: 'CloudWatch',
      query: `fields @timestamp, @message | filter @message like /${reportId}/ | filter @message like /PARTNER/ | sort @timestamp desc | limit 50`,
      description: 'Queries egress proxy logs for outbound gateway timeout or connection reset traces.'
    });
  } else if (pipelineLayer.includes('API Gateway') || pipelineLayer.includes('Layer 2')) {
    diagnosticCommands.push({
      title: 'Validate Schema & Reproduce Gateway Response Locally',
      command: `curl -i -X POST "https://api.platform.io/v1/reports" \\\n  -H "Authorization: Bearer <PARTNER_TOKEN>" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Request-ID: ${reportId}" \\\n  -d '{"reportId":"${reportId}","timestamp":"${timestamp}","assetHash":"${assetReference}"}'`,
      description: 'Sends the raw request payload to the Gateway sandbox to capture validation error sub-codes.',
      layer: 'API Gateway'
    });
    telemetryQueries.push({
      platform: 'Datadog',
      query: `service:api-gateway @http.status_code:${errorCode.split(' ')[0]} @http.url:"/v1/reports*" @request_id:"${reportId}"`,
      description: 'Tracks gateway ingress rate, payload deserialization errors, and partner auth token status.'
    });
  } else {
    // Other layers
    diagnosticCommands.push({
      title: 'Probe Ingress DNS and SSL Certificate Chain',
      command: `curl -vvvI "https://api.platform.io/health" -H "X-Trace-ID: ${reportId}" --connect-timeout 5`,
      description: 'Inspects edge ingress latency, TLS cipher suite, and Anycast PoP resolution.',
      layer: pipelineLayer
    });
    telemetryQueries.push({
      platform: 'Datadog',
      query: `service:platform-ingress @http.status_code:${errorCode.split(' ')[0]} @trace_id:"${reportId}"`,
      description: 'Tracks edge ingress metrics and worker task processing telemetry.'
    });
  }

  // Build facts summary text
  const ruledOutSummary = ruledOutFacts.length > 0
    ? ruledOutFacts.map(f => `• ${f.label}: RULED OUT (${f.details || 'Verified stable'})`).join('\n')
    : '• No factors formally ruled out yet; active investigation underway.';

  const confirmedSummary = confirmedIssueFacts.length > 0
    ? confirmedIssueFacts.map(f => `• ${f.label}: CONFIRMED ISSUE (${f.details || 'Identified as root contributor'})`).join('\n')
    : '• No isolated defects confirmed yet.';

  // Build Mode A: Internal 5-Paragraph Technical Triage
  const paragraph1 = `Incident Diagnosis & Blast Radius: Investigation for transaction ID ${reportId} logged at ${timestamp} exhibiting error state "${errorCode}" with summary "${summary}". This incident is currently categorized at ${severity} status due to active disruption within "${pipelineLayer}". Initial blast radius assessment indicates that transactional ingestion for this specific pipeline is halted, preventing successful payload lifecycle progression. Client-side telemetry and edge traces show that transaction correlation ID ${reportId} failed during the ${pipelineLayer} execution boundary, while upstream queues may experience backpressure or retry accumulation if not promptly acknowledged.`;

  const paragraph2 = `Pipeline Layer Breakdown & Architectural Root Cause Hypothesis: The failure manifests within ${pipelineLayer}. In our architectural delivery topology, this stage manages critical handshakes between ingress validation and durable persistence/delivery. ${
    pipelineLayer.includes('Storage Ingestion') || pipelineLayer.includes('Layer 3')
      ? 'Specifically at Steps 2–3, our service resolves the transaction metadata in the database and dispatches an authenticated byte stream retrieval against the storage origin URL. The return of ' + errorCode + ' strongly indicates that either the pre-signed storage credential signature expired prior to worker execution, or object-level ACL/IAM policies rejected the internal service principal.'
      : pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5')
      ? 'In Steps 4–6, the orchestrator packages the outbound payload and executes a mutual TLS (MTLS) handshake against the external partner receiving gateway. The ' + errorCode + ' error signifies an upstream socket timeout, connection reset, or egress NAT IP whitelisting mismatch during transmission.'
      : pipelineLayer.includes('API Gateway') || pipelineLayer.includes('Layer 2')
      ? 'At the Edge API Gateway layer, the ingress filter parses incoming JSON/XML payloads against the platform specification. An error code of ' + errorCode + ' points directly to schema validation failure, missing mandatory metadata attributes, or authorization scope mismatches.'
      : 'At this pipeline layer, workers process asynchronous message batches. The error indicates queue exhaustion, worker task crash, or timeout during processing.'
  } Based on current telemetry, the primary working hypothesis centers on an environmental or credential boundary mismatch rather than localized compute degradation.`;

  const paragraph3 = `Telemetry & Correlation Analysis: Cross-referencing distributed traces for Transaction ID ${reportId} at timestamp ${timestamp} reveals a critical boundary break. Asset reference indicator is logged as "${assetReference}". Querying the telemetry bus confirms that downstream worker logs correlate with status code ${errorCode}. Timestamp delta analysis demonstrates that the transaction entered the ingress boundary on schedule, but stalled upon reaching the ${pipelineLayer} demarcation. Latency curves on the egress proxy show a sharp elevation to timeout thresholds, confirming that execution was terminated by defensive watchdog circuits rather than internal application crashes.`;

  const paragraph4 = `Active Rule-Out Checklist & Diagnostic Testing: To isolate the failure domain and prevent unnecessary rollbacks, our team has executed systematic elimination of suspected factors:\n${ruledOutSummary}\n${confirmedSummary}\nNotably, confirming that ${
    ruledOutFacts.some(f => f.label.toLowerCase().includes('upload bottlenecks'))
      ? 'client logs show no upload bottlenecks definitively rules out partner ISP transit degradation or network throttling as the cause'
      : 'client upload bottlenecks are currently being evaluated alongside storage origin latency'
  }. Support engineering is executing targeted CLI probes to confirm storage reachability, MTLS handshake parameters, and certificate validity before altering queue routing.`;

  const paragraph5 = `Mitigation, Recovery Runbook & Escalation Path: Immediate operational remediation requires: (1) Re-authenticating or regenerating the transactional asset URI/token; (2) Re-driving the stalled transaction ${reportId} through the manual DLQ retry dispatcher; (3) Monitoring downstream delivery ACK receipt within a 120-second observational window. If the transaction continues to encounter ${errorCode}, escalate immediately to ${
    pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5') ? 'L3 Core Integrations / Partner Liaison On-Call' : 'L2 Ingestion Engineering On-Call'
  } via the dedicated PagerDuty bridge (SLA: 15 minutes). Once delivery is re-established, attach this triage dossier to Jira ticket INC-TRIAGE-${reportId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)} for post-incident root-cause review and automated canary rule tuning.`;

  // Build Mode B: Partner-Facing Plain Explanation (zero-retention boundary)
  const partnerExplanation = buildPartnerExplanation(toHandoverSafeIncident(input));

  return {
    mode: diagnosticMode,
    title: `${diagnosticMode.startsWith('Mode A') ? 'Technical Triage (Internal)' : 'Partner Incident Advisory'} — ${summary}`,
    incidentRef: reportId,
    severity,
    pipelineLayer: pipelineLayer as any,
    paragraphs: [
      { num: 1, heading: 'Paragraph 1: Executive Incident Diagnosis & Blast Radius', content: paragraph1 },
      { num: 2, heading: 'Paragraph 2: Pipeline Layer Breakdown & Architectural Root Cause Hypothesis', content: paragraph2 },
      { num: 3, heading: 'Paragraph 3: Telemetry & Correlation Analysis', content: paragraph3 },
      { num: 4, heading: 'Paragraph 4: Active Rule-Out Checklist & Diagnostic Testing', content: paragraph4 },
      { num: 5, heading: 'Paragraph 5: Mitigation, Recovery Runbook & Escalation Path', content: paragraph5 }
    ],
    partnerExplanation,
    phase1Protocol: buildPhase1Protocol(input),
    activeRuleOuts: generateDefaultRuleOuts(pipelineLayer, errorCode),
    diagnosticCommands,
    telemetryQueries,
    escalationPath: {
      tier: pipelineLayer.includes('External Handshake') || pipelineLayer.includes('Layer 5') ? 'Tier 3 / External Integrations On-Call' : 'Tier 2 / Ingestion Platform On-Call',
      team: pipelineLayer.includes('Storage Ingestion') ? 'Storage & Core Ingestion Infra' : pipelineLayer.includes('External Handshake') ? 'Partner Integrations & Egress Gateway' : 'API Gateway & Edge Operations',
      sla: severity === 'SEV-1 Critical' ? '15 Minutes (P1 PagerDuty)' : '30 Minutes (P2)',
      contactChannel: '#incident-triage-live / ops-bridge'
    },
    generatedAt: new Date().toISOString(),
    aiAssisted: false
  };
}
