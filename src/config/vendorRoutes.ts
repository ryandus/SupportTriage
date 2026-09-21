/**
 * Centralized vendor-specific deep-link schemas for enterprise observability & APM tools.
 * UI components reference this object rather than hardcoding vendor URLs inline.
 */
export const VENDOR_ROUTES = {
  datadog: {
    name: 'Datadog APM & Logs',
    icon: 'Activity',
    logSearch: (query: string, timeRange = 'now-1h') =>
      `https://app.datadoghq.com/logs?query=${encodeURIComponent(query)}&from_ts=${timeRange}`,
    traceSearch: (traceId: string) =>
      `https://app.datadoghq.com/apm/traces?query=${encodeURIComponent(`@trace_id:${traceId}`)}`,
    serviceMap: (service = 'api-gateway') =>
      `https://app.datadoghq.com/apm/service-map?service=${encodeURIComponent(service)}`,
  },
  splunk: {
    name: 'Splunk Enterprise',
    icon: 'Search',
    search: (query: string, earliest = '-1h', latest = 'now') =>
      `https://splunk.corp.internal/en-US/app/search/search?q=${encodeURIComponent(query)}&earliest=${earliest}&latest=${latest}`,
    traceCorrelation: (traceId: string) =>
      `https://splunk.corp.internal/en-US/app/search/search?q=${encodeURIComponent(`index=* trace_id="${traceId}" OR request_id="${traceId}"`)}`,
  },
  cloudwatch: {
    name: 'AWS CloudWatch',
    icon: 'Cloud',
    logGroup: (groupName: string, filterPattern = '') =>
      `https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/${encodeURIComponent(groupName)}?logStreamNameFilter=${encodeURIComponent(filterPattern)}`,
    insights: (logGroup: string, query: string) =>
      `https://console.aws.amazon.com/cloudwatch/home#logsV2:logs-insights$3FqueryDetail$3D~(editorString~'${encodeURIComponent(query)}~source~(~'${encodeURIComponent(logGroup)}))`,
  },
  cloudflare: {
    name: 'Cloudflare Ray ID Lookup',
    icon: 'Globe',
    rayIdLookup: (rayId: string) =>
      `https://dash.cloudflare.com/?to=/:account/analytics/traffic?ray_id=${encodeURIComponent(rayId)}`,
  },
  kibana: {
    name: 'Elasticsearch / Kibana',
    icon: 'Database',
    discover: (query: string) =>
      `https://kibana.corp.internal/app/discover#/?_a=(query:(language:kuery,query:'${encodeURIComponent(query)}'))`,
  },
} as const;

export type VendorRouteKey = keyof typeof VENDOR_ROUTES;
