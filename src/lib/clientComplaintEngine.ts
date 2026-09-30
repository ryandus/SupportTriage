import { ClientComplaintAnalysis, ClientComplaintIssue, PipelineLayer } from '../types';

export interface ComplaintSample {
  id: string;
  title: string;
  source: string;
  text: string;
}

export const SAMPLE_CLIENT_COMPLAINTS: ComplaintSample[] = [
  {
    id: 's3-download-expiry',
    title: 'Customer Ticket: "Our bulk file ingestion jobs are failing with 403 Access Denied"',
    source: 'ZenDesk Ticket #ZD-48912 • Acme Data Systems Engineering',
    text: `Hi Team,
Our ingestion pipeline has been attempting to upload batch records since 13:30 UTC today, but over 40% of our ingest jobs are failing.
In our dashboard, we see error messages like:
"Failed to download file from URL: 403 Forbidden: Request has expired" for transaction TXN-2026-88192-ACME.
The asset URL was https://partner-vault.s3.amazonaws.com/evidence/98b2c418a99214dfa02b.bin with sha256:d8a29b4e72cf1902c3851b4d32a9e35471a2e9b048cf7a1b029341bc8e390c12.
Our S3 bucket permissions have not changed. Can you please investigate urgently? This is blocking our daily production data sync.`
  },
  {
    id: 'gateway-schema-rejection',
    title: 'Slack Escalation: "Our API client is getting 422 Unprocessable Entity on POST /v1/ingest"',
    source: 'Shared Slack Channel #partner-api-ops • Contoso Cloud Platform',
    text: `Hey guys, seeing a sudden spike in 422 errors when sending batch payloads from our EU worker cluster.
Request ID: TXN-EU-781903.
Response body: {"status": 422, "title": "Unprocessable Entity", "detail": "Field 'incidentDateTime' string '+00:00' failed format regex for ISO 8601 UTC timestamp or missing required field 'checksum'"}.
We haven't changed our payload format since last sprint. Did you guys push a gateway schema validation update today? We have 1,200 records backed up in our queue.`
  },
  {
    id: 'downstream-handshake-hang',
    title: 'Urgent Ticket: "Submissions to downstream partner clearinghouse are hanging and timing out with 504"',
    source: 'Email escalation to support@platform.io • Globex Technical Operations Lead',
    text: `Hello Incident Response Team,
We submitted critical transaction EXT-API-992104 about 45 minutes ago.
The transaction status is still stuck on "Processing Steps 4–6: Downstream Partner Handshake". When we query your status API, we get:
"504 Gateway Timeout: SSL ETIMEDOUT during downstream clearinghouse MTLS handshake".
Is the downstream partner gateway experiencing an outage, or did our static outbound IP address get dropped from the firewall whitelist? We need verification immediately.`
  },
  {
    id: 'sso-session-loop',
    title: 'Portal Access: "Our team cannot log into the web console - 502 / redirect loop"',
    source: 'IT Helpdesk Ticket • Initech Technical Operations',
    text: `Multiple users from our operations team are unable to access the web console this morning.
After signing in through our Okta SSO, the page spins for 30 seconds and shows "502 Bad Gateway" or redirects back to the login screen with "invalid_grant: session token expired or clock skew detected".
Clearing cookies didn't help one user. Endpoint affected: GET /oauth/callback. User account: ops-analyst-4@initech.com.`
  },
  {
    id: 'webhook-signature-failed',
    title: 'Partner Webhook: "We stopped receiving status confirmation webhooks / 401 Invalid Signature"',
    source: 'Developer Forum / PagerDuty • Nexus API Team',
    text: `Hello, we noticed our webhook receiver at https://api.nexus.com/webhooks/incoming has not acknowledged any notifications since yesterday 18:00 UTC.
Your system's delivery audit log shows our server is responding with 401 Unauthorized: "Signature verification failed: computed HMAC does not match X-Signature header".
We rotated our webhook secret yesterday in the portal. Can you verify if your webhook dispatcher cluster is picking up the newly rotated signing secret or still using the cached old one?`
  }
];

export function analyzeClientComplaintDeterministic(complaintText: string): ClientComplaintAnalysis {
  const lower = complaintText.toLowerCase();

  const detectedSymptoms: string[] = [];
  const likelyIssues: ClientComplaintIssue[] = [];

  // Extract key entities
  // Report / Transaction ID
  const reportIdMatch = complaintText.match(/\b(REP-[A-Za-z0-9_-]+|TXN-[A-Za-z0-9_-]+|EXT-[A-Za-z0-9_-]+|ZD-[0-9]+|req_[a-zA-Z0-9]+)\b/i) ||
                        complaintText.match(/(?:transaction|report|job|txn|id)[:=\s]+["']?([A-Za-z0-9_-]{6,36})["']?/i);
  const reportId = reportIdMatch ? reportIdMatch[1] : `TXN-CLIENT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // SHA256 / Asset
  const shaMatch = complaintText.match(/\b([a-fA-F0-9]{64})\b/);
  const urlMatch = complaintText.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|mp4|zip|bin|xml|json)[^\s"'<>]*/i);
  let assetReference = 'N/A';
  if (shaMatch) {
    assetReference = `sha256:${shaMatch[1].toLowerCase()}`;
  } else if (urlMatch) {
    assetReference = urlMatch[0];
  }

  // Client Identity / Email
  const emailMatch = complaintText.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  const orgMatch = complaintText.match(/(?:from|org|company|client|partner)[:=\s]+([A-Za-z0-9\s&]{3,25})/i);
  const clientIdentity = emailMatch ? emailMatch[1] : (orgMatch ? orgMatch[1].trim() : 'Client Partner / Operator');

  // HTTP status
  const codeMatch = complaintText.match(/\b(400|401|403|404|408|409|422|429|500|502|503|504)\b/);
  let rawCode = codeMatch ? codeMatch[1] : '';

  // Pipeline layer detection & diagnosis
  let pipelineLayer: PipelineLayer = 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)';
  let errorCode = rawCode ? `${rawCode} Error` : '403 Forbidden';
  let summary = 'Client-reported operational issue';
  let sentimentOrUrgency: ClientComplaintAnalysis['sentimentOrUrgency'] = 'HIGH / Production Degraded';

  if (lower.includes('urgent') || lower.includes('blocking') || lower.includes('emergency') || lower.includes('legal') || lower.includes('statutory') || lower.includes('critical')) {
    sentimentOrUrgency = 'CRITICAL / Blocker';
  } else if (lower.includes('intermittent') || lower.includes('sometimes') || lower.includes('few')) {
    sentimentOrUrgency = 'MEDIUM / Intermittent';
  }

  // Diagnosis 1: S3 / GCS Storage presigned expiry (Layer 3)
  if (lower.includes('s3') || lower.includes('presign') || lower.includes('download') || lower.includes('request has expired') || (lower.includes('403') && lower.includes('file'))) {
    pipelineLayer = 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)';
    errorCode = '403 Forbidden';
    summary = 'Failed to download file from URL (presigned storage signature expired)';
    detectedSymptoms.push('Storage URL signature expired (X-Amz-Expires exceeded before ingestion fetch)');
    detectedSymptoms.push('Download step aborted at Storage Ingestion Step 3 while Step 2 DB query succeeded');
    detectedSymptoms.push('Partner bucket permissions and ACLs confirmed intact');

    likelyIssues.push({
      id: 'issue-s3-presign-ttl',
      category: 'storage',
      title: 'Presigned S3/GCS URL TTL Window Expired Prior to Fetch',
      confidence: 'High',
      suspectedLayer: 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)',
      explanation: 'The presigned storage URL generated by the partner had a short expiration window (e.g. 15 minutes / 900s). Ingestion queue delays or worker backoff caused the storage asset downloader to attempt HTTP GET after the signature timestamp expired.',
      immediateCheck: 'Compare URL X-Amz-Date + X-Amz-Expires against storage worker HTTP fetch timestamp in Datadog trace.',
      suggestedAction: 'Advise partner to increase presigned URL expiration TTL to at least 60–120 minutes or provide authenticated service-to-service IAM role credentials.'
    });

    likelyIssues.push({
      id: 'issue-kms-bucket-key',
      category: 'storage',
      title: 'KMS Key Policy or S3 VPC Endpoint Policy Restriction',
      confidence: 'Medium',
      suspectedLayer: 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)',
      explanation: 'If the presigned URL is still temporally valid, AWS KMS key policy kms:Decrypt permission may be missing for the presigned IAM principal, returning an ambiguous 403 Forbidden.',
      immediateCheck: 'Run AWS CLI "head-object" on the S3 URI with partner credentials to check ServerSideEncryption and KMS Key Id.',
      suggestedAction: 'Verify KMS key policy grants kms:Decrypt to the signing principal.'
    });
  }
  // Diagnosis 2: Downstream Partner / Clearinghouse (Layer 5)
  else if (lower.includes('clearinghouse') || lower.includes('downstream') || lower.includes('handshake') || lower.includes('504') || lower.includes('etimedout')) {
    pipelineLayer = 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)';
    errorCode = rawCode === '504' ? '504 Gateway Timeout' : '504 Gateway Timeout';
    summary = 'Outbound timeout during downstream partner MTLS handshake and dispatch';
    detectedSymptoms.push('Transaction stuck on downstream dispatch (Steps 4–6)');
    detectedSymptoms.push('SSL ETIMEDOUT or TLS handshake stall exceeding 60-second read deadline');
    detectedSymptoms.push('External partner delivery SLA at risk');

    likelyIssues.push({
      id: 'issue-mtls-handshake-hang',
      category: 'downstream_clearinghouse',
      title: 'Downstream Partner Ingestion Gateway Elevated Latency / MTLS Stall',
      confidence: 'High',
      suspectedLayer: 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)',
      explanation: 'Outbound dispatch worker reached the 60,000ms read deadline while attempting MTLS handshake or waiting for partner API HTTP ACK.',
      immediateCheck: 'Test openssl s_client -connect api.downstream-partner.com:443 -tls1_2 and check partner status page.',
      suggestedAction: 'Verify MTLS client certificate validity in secrets manager and verify Cloud NAT static IP against partner firewall whitelist.'
    });

    likelyIssues.push({
      id: 'issue-egress-nat-drop',
      category: 'network',
      title: 'Worker Egress Cloud NAT IP Not Whitelisted by Partner',
      confidence: 'Medium',
      suspectedLayer: 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)',
      explanation: 'If worker cluster autoscaled to new nodes or NAT gateway pool expanded, outbound traffic may originate from an unwhitelisted public IP, resulting in TCP SYN drops and 504 ETIMEDOUT.',
      immediateCheck: 'Inspect Cloud NAT egress logs to confirm source IP used for the outbound connection.',
      suggestedAction: 'Compare active outbound NAT IPs with registered static IP addresses on file with partner security team.'
    });
  }
  // Diagnosis 3: Gateway Schema / Formatting (Layer 2)
  else if (lower.includes('422') || lower.includes('unprocessable') || lower.includes('schema') || lower.includes('isodatetime') || lower.includes('validation') || lower.includes('format')) {
    pipelineLayer = 'Layer 2: API Gateway / Authentication Edge';
    errorCode = '422 Unprocessable Entity';
    summary = 'Payload rejected at Edge API Gateway due to schema validation failure';
    detectedSymptoms.push('Edge API gateway returned 422 Unprocessable Entity');
    detectedSymptoms.push('Strict schema validation failure on date/time format or missing required fields');
    detectedSymptoms.push('Batch queue backed up on client side');

    likelyIssues.push({
      id: 'issue-timestamp-format-skew',
      category: 'data_format',
      title: 'ISO 8601 Timestamp Format Incompatibility (+0000 vs +00:00 or Z)',
      confidence: 'High',
      suspectedLayer: 'Layer 2: API Gateway / Authentication Edge',
      explanation: 'The gateway requires strict ISO 8601 UTC timestamps (e.g. "YYYY-MM-DDTHH:mm:ssZ" or "+00:00"). Client payload generated non-standard timezone offsets without colons (e.g. "+0000") or omitted mandatory hash properties.',
      immediateCheck: 'Inspect gateway OpenAPI schema validation error message and raw JSON payload incidentDateTime field.',
      suggestedAction: 'Instruct client engineering to format timestamps using ISO 8601 UTC with trailing "Z" or strict colon format.'
    });

    likelyIssues.push({
      id: 'issue-missing-required-hash',
      category: 'data_format',
      title: 'Missing Mandatory Schema Properties (checksum / identifiers)',
      confidence: 'Medium',
      suspectedLayer: 'Layer 2: API Gateway / Authentication Edge',
      explanation: 'OpenAPI specification requires sha256 checksum for all uploaded assets. If client omitted checksum or required identifier, the schema validator halts ingestion immediately.',
      immediateCheck: 'Review request payload against platform OpenAPI 3.0 specification.',
      suggestedAction: 'Ensure all mandatory metadata attributes are populated prior to calling POST /v1/reports.'
    });
  }
  // Diagnosis 4: Webhook Replay / Signature Failure (Layer 6)
  else if (lower.includes('webhook') || lower.includes('signature') || lower.includes('hmac') || (lower.includes('401') && lower.includes('webhook')) || lower.includes('callback')) {
    pipelineLayer = 'Layer 6: Webhook / Callback Notification';
    errorCode = '401 Unauthorized';
    summary = 'Webhook delivery rejected by partner endpoint (HMAC signature mismatch)';
    detectedSymptoms.push('Partner webhook listener returning 401 Unauthorized');
    detectedSymptoms.push('HMAC signature verification failed on X-Signature header');
    detectedSymptoms.push('Recent secret rotation in partner developer portal');

    likelyIssues.push({
      id: 'issue-webhook-secret-cached',
      category: 'webhook_replay',
      title: 'Webhook Dispatcher Secret Cache Invalidation Lag After Key Rotation',
      confidence: 'High',
      suspectedLayer: 'Layer 6: Webhook / Callback Notification',
      explanation: 'When the partner rotated their webhook signing key in the dashboard, the outbound webhook dispatcher pods retained the deprecated secret in Redis cache (TTL 15 min), causing computed HMAC signatures to mismatch the partner receiver expectation.',
      immediateCheck: 'Inspect webhook delivery log to verify which key version ID was used to compute HMAC-SHA256.',
      suggestedAction: 'Trigger cache invalidation for partner webhook signing key in Redis and replay pending failed webhook deliveries.'
    });

    likelyIssues.push({
      id: 'issue-raw-body-parsing',
      category: 'data_format',
      title: 'Partner Listener Pre-Parsing JSON Body Before HMAC Verification',
      confidence: 'Medium',
      suspectedLayer: 'Layer 6: Webhook / Callback Notification',
      explanation: 'If partner endpoint middleware (e.g. Express bodyParser) parses and re-stringifies JSON before HMAC check, key ordering or whitespace discrepancies will cause signature mismatch.',
      immediateCheck: 'Ask partner if their HMAC check runs against raw Buffer bytes before JSON parsing.',
      suggestedAction: 'Advise partner to verify signatures using raw unparsed request buffer (e.g., express.raw({type: "*/*"})).'
    });
  }
  // Diagnosis 5: SSO / DNS / Network (Layer 1)
  else if (lower.includes('sso') || lower.includes('okta') || lower.includes('saml') || lower.includes('redirect') || lower.includes('login') || lower.includes('502')) {
    pipelineLayer = 'Layer 1: DNS / Client Network / IdP SSO';
    errorCode = '502 Bad Gateway';
    summary = 'Client network, DNS resolution or IdP SSO session failure';
    detectedSymptoms.push('User redirected in loop or receiving 502 Bad Gateway upon OAuth callback');
    detectedSymptoms.push('IdP assertion clock skew or session token expiration');
    detectedSymptoms.push('Affects browser-based analysts accessing web console');

    likelyIssues.push({
      id: 'issue-sso-clock-skew',
      category: 'authentication',
      title: 'IdP SAML/OIDC Assertion Clock Skew or Session Token Expiration',
      confidence: 'High',
      suspectedLayer: 'Layer 1: DNS / Client Network / IdP SSO',
      explanation: 'Corporate IdP server time drift exceeding ±300s window causes our identity provider to reject the SAML Response. Alternatively, cached local session cookies contain an expired refresh token.',
      immediateCheck: 'Inspect IdP response assertion NotOnOrAfter timestamp and verify client corporate clock against NTP.',
      suggestedAction: 'Have affected users launch an Incognito window to bypass stale cookie cache, and inspect IdP SAML assertion logs.'
    });

    likelyIssues.push({
      id: 'issue-edge-proxy-502',
      category: 'network',
      title: 'Edge Anycast CDN Ingress 502 Bad Gateway on Callback Route',
      confidence: 'Medium',
      suspectedLayer: 'Layer 1: DNS / Client Network / IdP SSO',
      explanation: 'Corporate firewall SSL inspection proxy or Anycast edge dropped the TCP connection during the OAuth code exchange.',
      immediateCheck: 'Capture HAR trace of the redirect loop to identify the exact hop returning 502.',
      suggestedAction: 'Have client IT whitelist authentication callback domain in corporate proxy.'
    });
  }
  // Fallback generic
  else {
    detectedSymptoms.push('Generic operational complaint regarding transaction processing');
    detectedSymptoms.push(`Extracted error code: ${errorCode}`);
    likelyIssues.push({
      id: 'issue-generic-pipeline',
      category: 'upstream_timeout',
      title: 'Asynchronous Ingestion Bottleneck or Unhandled Pipeline Exception',
      confidence: 'Medium',
      suspectedLayer: pipelineLayer,
      explanation: 'Client input indicates an unexpected processing stall or error response across the ingestion boundary.',
      immediateCheck: `Query Datadog APM for trace ID associated with transaction ${reportId}.`,
      suggestedAction: 'Review worker logs and trigger manual diagnostic check.'
    });
  }

  // W3C Traceparent & Cloudflare Ray ID extraction
  const traceparentMatch = complaintText.match(/\b(00-[a-f0-9]{32}-[a-f0-9]{16}-01)\b/i);
  const traceparent = traceparentMatch ? traceparentMatch[1] : undefined;
  const cfRayMatch = complaintText.match(/\b([a-f0-9]{16}-[A-Z]{3})\b/i) || complaintText.match(/cf-ray[:=\s]+([a-f0-9]{16}(?:-[A-Za-z0-9]+)?)/i);
  const cloudflareRayId = cfRayMatch ? cfRayMatch[1] : undefined;

  // Recommended Client-Facing Reply
  const recommendedClientReply = `Hello ${clientIdentity},

Thank you for reaching out and providing the details for incident/transaction ${reportId}.

Our Enterprise Triage Engineering team has conducted an initial automated pipeline triage:
• Identified Demarcation Domain: ${pipelineLayer.split(':')[0]}
• Observed Symptom: ${detectedSymptoms[0] || summary}
• Most Probable Root Cause: ${likelyIssues[0]?.title || 'Processing pipeline error'}

Immediate Verification Steps for Your Team:
1. ${likelyIssues[0]?.immediateCheck || 'Verify source credentials and payload format.'}
2. If this is a client-side configuration or asset availability issue, please test in an incognito window or verify file accessibility.
3. If you have captured a browser network HAR file or raw API error response, please reply with that attachment so we can cross-reference our server traces.

Our internal team is actively investigating this on our end and will follow up with an update within 30 minutes.

Best regards,
SupportTriage Team

SupportTriage • Engineered by R. C. Hanks`;

  // Recommended Internal Next Step
  const recommendedInternalNextStep = `1. Cross-reference transaction ${reportId} in Datadog APM and PostgreSQL tasks table.
2. Investigate suspected domain: ${pipelineLayer}.
3. Rule-out action: ${likelyIssues[0]?.suggestedAction || 'Verify service logs.'}

---
SupportTriage • Engineered by R. C. Hanks`;

  return {
    clientIdentity,
    sentimentOrUrgency,
    detectedSymptoms,
    likelyIssues,
    extractedIncidentFields: {
      summary,
      errorCode,
      pipelineLayer,
      reportId,
      timestamp: new Date().toISOString(),
      assetReference,
      clientIdentity,
      endpointUrl: lower.includes('post') ? 'POST /v1/reports' : '/v1/reports',
      httpMethod: lower.includes('get') ? 'GET' : 'POST',
      traceparent,
      cloudflareRayId,
      isTriageLocked: true
    },
    recommendedClientReply,
    recommendedInternalNextStep
  };
}
