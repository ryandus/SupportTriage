import { IncidentInput, Phase1TriageProtocol, PipelineLayer } from '../types';

export function getLayerDemarcationDetails(layer: PipelineLayer): Phase1TriageProtocol['demarcation'] {
  switch (layer) {
    case 'Layer 1: DNS / Client Network / IdP SSO':
      return {
        activeLayer: layer,
        layerNumber: 1,
        demarcationBoundary: 'Client Local Network & Identity Provider (IdP) Edge',
        upstreamBoundary: 'Client browser / OS resolver / Corporate SSO IdP (Okta/Azure AD SAML/OIDC)',
        downstreamBoundary: 'Public Cloud CDN / Anycast Ingress / Layer 2 API Gateway',
        diagnosticFocus: 'Rule out local browser state, SSO session TTL expiration, IdP assertion clock skew, client DNS cache, local VPN/firewall SSL intercept before investigating server.'
      };
    case 'Layer 2: API Gateway / Authentication Edge':
      return {
        activeLayer: layer,
        layerNumber: 2,
        demarcationBoundary: 'Reverse Proxy & Ingress Security Filter (Kong / Envoy / Cloud Armor)',
        upstreamBoundary: 'Layer 1 Client Ingress & TLS Termination',
        downstreamBoundary: 'Internal Service Mesh & Storage Ingestion Service (Layer 3)',
        diagnosticFocus: 'Verify OAuth2 Bearer token scopes, rate limiting (429), WAF IP blocking (403), and JSON/XML schema validation (422) on incoming request payloads.'
      };
    case 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)':
      return {
        activeLayer: layer,
        layerNumber: 3,
        demarcationBoundary: 'Transactional Database Persistence & Cloud Storage Retrieval',
        upstreamBoundary: 'Layer 2 API Gateway Ingress Filter',
        downstreamBoundary: 'Layer 4 Async Task Queues / Worker Containers',
        diagnosticFocus: 'Check PostgreSQL transactional DB insert, presigned S3/GCS URL validity and signature TTL, KMS bucket encryption keys, and HTTP GET range download timeouts.'
      };
    case 'Layer 4: Worker Queues / Async Processing Containers':
      return {
        activeLayer: layer,
        layerNumber: 4,
        demarcationBoundary: 'Async Message Broker (Kafka / Celery) & Processing Microservices',
        upstreamBoundary: 'Layer 3 Ingestion Task Dispatcher',
        downstreamBoundary: 'Layer 5 External Partner API Dispatcher',
        diagnosticFocus: 'Inspect queue lag, worker pod OOM kills (cgroups 137), payload corruption during asset processing, and dead-letter queue (DLQ) rerouting.'
      };
    case 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)':
      return {
        activeLayer: layer,
        layerNumber: 5,
        demarcationBoundary: 'Outbound Egress NAT & Downstream Partner Clearinghouse API',
        upstreamBoundary: 'Layer 4 Worker Packaging Service',
        downstreamBoundary: 'Downstream Partner API / External Clearinghouse Endpoints',
        diagnosticFocus: 'Verify outbound MTLS client certificates (OpenSSL s_client), NAT gateway static IP whitelisting in downstream firewalls, and partner API REST/SOAP schema validation.'
      };
    case 'Layer 6: Webhook / Callback Notification':
      return {
        activeLayer: layer,
        layerNumber: 6,
        demarcationBoundary: 'Outbound Callback Dispatcher & Partner Receiver Endpoint',
        upstreamBoundary: 'Layer 5 Clearinghouse ACK Receipt / Internal Processing Completion',
        downstreamBoundary: 'Client / Partner Webhook Ingestion Listener URL',
        diagnosticFocus: 'Validate HMAC SHA-256 signing secret synchronization, timestamp clock-skew replay checks (<300s), partner HTTPS TLS handshakes, and exponential retry backoff state.'
      };
  }
}

export function buildPhase1Protocol(input: IncidentInput): Phase1TriageProtocol {
  const {
    summary,
    errorCode,
    pipelineLayer,
    reportId,
    timestamp,
    assetReference,
    clientIdentity = 'Client Org / User Session',
    endpointUrl = '/v1/reports',
    httpMethod = 'POST'
  } = input;

  const errorLower = errorCode.toLowerCase();
  const summaryLower = summary.toLowerCase();

  // 1. Most Likely Failure Domain & Starting Point (Rank top 1-2 probable root causes)
  const likelyFailureDomains: Phase1TriageProtocol['likelyFailureDomains'] = [];

  if (pipelineLayer.includes('Layer 1') || errorLower.includes('502') || errorLower.includes('ssl') || errorLower.includes('econnreset') || summaryLower.includes('sso') || summaryLower.includes('session')) {
    likelyFailureDomains.push({
      rank: 1,
      title: 'Client-Side Browser Cache & IdP SAML/SSO Session Token Expiration',
      domain: 'Layer 1: DNS / Client Network / IdP SSO',
      likelihood: 'Primary (High)',
      rationale: 'Stale OAuth/SAML session tokens cached in browser local storage or corporate IdP session expiration causes immediate authentication handshakes to fail or enter redirect loops before requests reach core services.',
      immediateAction: 'Have client clear browser cache for the origin domain or test in an Incognito/Private window with DevTools open.'
    });
    likelyFailureDomains.push({
      rank: 2,
      title: 'IdP SAML/OIDC Configuration or Edge DNS Resolution Latency',
      domain: 'Layer 1 / Layer 2 Edge Boundary',
      likelihood: 'Secondary (Moderate)',
      rationale: 'Clock skew on IdP SAML response assertions exceeding standard ±300s window, or Anycast DNS route flapping dropping TCP SYN packets.',
      immediateAction: 'Verify client IdP signing certificate expiration and test DNS resolution via dig @8.8.8.8 against the API hostname.'
    });
  } else if (pipelineLayer.includes('Layer 2') || errorLower.includes('401') || errorLower.includes('403') || errorLower.includes('422')) {
    if (errorLower.includes('401') || errorLower.includes('403')) {
      likelyFailureDomains.push({
        rank: 1,
        title: 'Gateway Authentication Token Expiration vs. Permission Scope Mismatch',
        domain: 'Layer 2: API Gateway / Authentication Edge',
        likelihood: 'Primary (High)',
        rationale: 'The incoming HTTP request carries an expired Bearer token, wrong environment audience (e.g. sandbox token sent to prod), or lacks required role scope.',
        immediateAction: 'Inspect WWW-Authenticate response headers and inspect JWT exp claim timestamp against server UTC time.'
      });
      likelyFailureDomains.push({
        rank: 2,
        title: 'Client-Side Header Strip or CORS Pre-Flight Filter Rejection',
        domain: 'Layer 1 / Layer 2 Interface',
        likelihood: 'Secondary (Moderate)',
        rationale: 'Corporate proxy or browser CORS OPTIONS preflight stripped the Authorization header or failed custom headers.',
        immediateAction: 'Inspect HAR file "Headers" tab to verify exact Authorization header casing and presence.'
      });
    } else {
      likelyFailureDomains.push({
        rank: 1,
        title: 'Payload Schema Specification Mismatch (Unprocessable Entity)',
        domain: 'Layer 2: API Gateway / Authentication Edge',
        likelihood: 'Primary (High)',
        rationale: 'Mandatory fields missing, timestamp format deviating from strict ISO 8601 UTC (e.g., missing timezone offset or colon), or invalid hash length.',
        immediateAction: 'Validate raw JSON/XML against OpenAPI 3.0 specification; check gateway response payload body for schema error path.'
      });
      likelyFailureDomains.push({
        rank: 2,
        title: 'Encoding or Serialization Corruption (e.g., Non-UTF8 Characters)',
        domain: 'Client Serializer / Layer 2 Gateway',
        likelihood: 'Secondary (Moderate)',
        rationale: 'Client payload serialization corrupted multipart boundaries or introduced unescaped control characters into metadata string.',
        immediateAction: 'Inspect raw request body in HAR export or cURL verbose trace.'
      });
    }
  } else if (pipelineLayer.includes('Layer 3') || summaryLower.includes('download') || summaryLower.includes('s3') || errorLower.includes('403')) {
    likelyFailureDomains.push({
      rank: 1,
      title: 'Presigned S3/GCS Storage URL Expiration (Signature Expired)',
      domain: 'Layer 3: Storage Ingestion Service (DB write, asset retrieval)',
      likelihood: 'Primary (High)',
      rationale: 'Presigned URL generated with a short expiration TTL (e.g. 15 minutes) expired while sitting in processing queue before storage worker fetched the byte stream.',
      immediateAction: 'Compare S3/storage X-Amz-Date + X-Amz-Expires with storage download attempt timestamp in Datadog trace.'
    });
    likelyFailureDomains.push({
      rank: 2,
      title: 'Target Storage Bucket IAM Policy / Customer KMS Key Revocation',
      domain: 'Partner Cloud Storage / KMS Infrastructure',
      likelihood: 'Secondary (Moderate)',
      rationale: 'Customer storage bucket policy, VPC endpoint route, or KMS key policy was modified, denying s3:GetObject to SaaS service role.',
      immediateAction: 'Execute AWS CLI head-object or test direct HTTP GET with authenticated credentials.'
    });
  } else if (pipelineLayer.includes('Layer 5') || summaryLower.includes('partner') || summaryLower.includes('clearinghouse') || errorLower.includes('504')) {
    likelyFailureDomains.push({
      rank: 1,
      title: 'Outbound MTLS Handshake Stalling or Downstream Receiver Latency',
      domain: 'Layer 5: External Handshake (Downstream Partner API / Clearinghouse Gateway)',
      likelihood: 'Primary (High)',
      rationale: 'Downstream partner gateway experiencing elevated queue latency or client MTLS certificate validation stalling past 60s read timeout.',
      immediateAction: 'Run openssl s_client against api.downstream-partner.com:443 to test MTLS cert chain and cipher negotiation.'
    });
    likelyFailureDomains.push({
      rank: 2,
      title: 'Egress Cloud NAT IP Whitelist Configuration Drop',
      domain: 'Network Egress & Downstream Firewall',
      likelihood: 'Secondary (Moderate)',
      rationale: 'New worker nodes or NAT egress IP pool changed and is not registered on downstream partner firewall whitelist.',
      immediateAction: 'Verify outbound public IP against partner registered static egress list.'
    });
  } else if (pipelineLayer.includes('Layer 6') || summaryLower.includes('webhook')) {
    likelyFailureDomains.push({
      rank: 1,
      title: 'HMAC Webhook Secret Mismatch After Partner Key Rotation',
      domain: 'Layer 6: Webhook / Callback Notification',
      likelihood: 'Primary (High)',
      rationale: 'Partner rotated their webhook signing secret in developer settings, but their receiver service is computing HMAC with the deprecated key.',
      immediateAction: 'Have partner test HMAC computation using raw unparsed request body string and compare X-Signature header.'
    });
    likelyFailureDomains.push({
      rank: 2,
      title: 'Partner Endpoint Receiver Timeout / Clock Skew Replay Protection',
      domain: 'Partner Webhook Receiver',
      likelihood: 'Secondary (Moderate)',
      rationale: 'Partner endpoint took >5000ms to acknowledge with 200 OK or rejected payload due to timestamp drift >300s.',
      immediateAction: 'Inspect webhook delivery audit log for exact HTTP status code and response body returned by partner listener.'
    });
  } else {
    // Default / Layer 4 Worker Queues
    likelyFailureDomains.push({
      rank: 1,
      title: 'Worker Memory Breach (OOM) or Large File Buffer Eviction',
      domain: 'Layer 4: Worker Queues / Async Processing Containers',
      likelihood: 'Primary (High)',
      rationale: 'Large media file ingestion saturated container cgroup memory limits during in-memory hashing, causing Linux kernel OOM killer (code 137).',
      immediateAction: 'Check kubectl describe pod for Last State: Terminated (OOMKilled) and examine file size metrics.'
    });
    likelyFailureDomains.push({
      rank: 2,
      title: 'Message Dead-Letter Queue (DLQ) Routing on Corrupted Header',
      domain: 'Layer 4 Queue Infrastructure',
      likelihood: 'Secondary (Moderate)',
      rationale: 'Worker unhandled exception on unexpected file format incremented retry count to threshold and routed to DLQ.',
      immediateAction: 'Inspect DLQ consumer count and query task error payload in PostgreSQL.'
    });
  }

  // 2. Client-Facing Instructions & Evidence Collection Script
  const devToolsInstructions = [
    'Open your web browser (Chrome, Edge, Firefox, or Safari) to the page where the error occurred.',
    'Press F12 on your keyboard (or right-click anywhere on the page and select "Inspect").',
    'In the Developer Tools window that opens at the bottom or side, click the "Network" tab at the top.',
    'Important: Ensure the "Preserve log" checkbox is CHECKED (this prevents logs from disappearing if the page refreshes).'
  ];

  const harExportSteps = [
    'With the Network tab still open, perform the exact action that triggers the error.',
    'Locate the failing line in the Network list — it will typically appear in RED or with a status of 4xx or 5xx.',
    'Right-click anywhere in the list of network requests and choose "Save all as HAR with content" (or click the download arrow icon "Export HAR").',
    'Save the .har file to your computer (you can attach this file securely to our support ticket).'
  ];

  const screenshotChecklist = [
    'Full browser window capture showing the entire Address / URL bar (including any transaction query parameters).',
    'The exact error banner, modal, or toast message displayed on the page.',
    'The system clock or timestamp visible in your taskbar/menu bar to help correlate server logs.'
  ];

  const rawCopyScript = `--- CLIENT EVIDENCE COLLECTION GUIDE (COPY & PASTE TO USER) ---
Hello,

Thank you for reporting this issue. To help our Tier 3 / Solutions Engineering team diagnose the exact cause and resolve it swiftly, please gather the following technical diagnostic artifacts:

1. HOW TO OPEN BROWSER DEVELOPER TOOLS:
   • On Windows/Linux: Press F12 (or right-click anywhere and click "Inspect").
   • On Mac: Press Option + Cmd + I (or right-click and click "Inspect").
   • Click the "Network" tab in the panel that appears.
   • Check the box that says "Preserve log" (very important so logs are not lost).

2. REPRODUCE & EXPORT A NETWORK ARCHIVE (HAR FILE):
   • Repeat the action that triggers the failure.
   • Look for any red request lines (e.g. status ${errorCode || '4xx/5xx'}).
   • Right-click anywhere in the Network list and select "Save all as HAR with content".
   • If you cannot save a HAR file, click on the red request line, click the "Response" tab on the right, and copy all the JSON text shown.

3. SCREENSHOTS TO ATTACH:
   • A full screenshot of your screen showing the URL bar in your browser.
   • The exact error message banner or popup.
   • The current time / date when the failure happened.

4. DETAILS FOR OUR INVESTIGATION PACKET:
   • Client / User Email: ${clientIdentity}
   • Reference / Report ID: ${reportId}
   • Time of Failure (UTC): ${timestamp}
   • Endpoint / Action: ${httpMethod} ${endpointUrl}

Please reply attaching the HAR file and screenshots. Thank you for your partnership!
-----------------------------------------------------------------
SupportTriage • Engineered by R. Hanks`;

  // 3. Evidentiary Ingestion Fields to Extract
  const evidentiaryFields = {
    clientIdentity,
    reportId,
    timestamp,
    endpointUrl,
    httpMethod,
    assetReference,
    errorCode
  };

  // 4. Pipeline Demarcation
  const demarcation = getLayerDemarcationDetails(pipelineLayer);

  return {
    likelyFailureDomains,
    clientEvidenceScript: {
      introGreeting: `Dear Partner Support Team,\nTo quickly isolate this ${errorCode} incident affecting transaction ${reportId}, our engineering team requires raw network telemetry.`,
      devToolsInstructions,
      harExportSteps,
      screenshotChecklist,
      rawCopyScript
    },
    evidentiaryFields,
    demarcation
  };
}
