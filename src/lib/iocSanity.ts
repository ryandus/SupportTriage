import { IocFlag, IocRecord, IocType } from '../types';

// ---------------------------------------------------------------------------
// IOC sanity engine
//
// Normalizes ingested indicators and attaches data-quality flags from the
// existing IocFlag union. Flags describe the INDICATOR, not the incident:
// a private or loopback address is flagged non_routable, never auto-labelled
// benign, because internal hosts are routinely victim assets or lateral-
// movement hops. Role assignment stays an analyst decision.
// ---------------------------------------------------------------------------

/** Digests of zero-length input. They identify "no content", never a payload. */
export const EMPTY_INPUT_HASHES: Readonly<Record<string, NonNullable<IocRecord['hashAlgo']>>> = {
  d41d8cd98f00b204e9800998ecf8427e: 'md5',
  da39a3ee5e6b4b0d3255bfef95601890afd80709: 'sha1',
  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855: 'sha256',
};

const HEX_LENGTH_TO_ALGO: Readonly<Record<number, NonNullable<IocRecord['hashAlgo']>>> = {
  32: 'md5',
  40: 'sha1',
  64: 'sha256',
};

// Runtime mirror of the IocType union. Typed as Record<IocType, true> so adding
// or removing a type in types.ts is a compile error here until this is updated.
const IOC_TYPE_SET: Readonly<Record<IocType, true>> = {
  ip: true,
  domain: true,
  url: true,
  hash: true,
  command: true,
  file_path: true,
  registry: true,
  account: true,
};

export const IOC_TYPES = Object.keys(IOC_TYPE_SET) as IocType[];

function isIocType(value: unknown): value is IocType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(IOC_TYPE_SET, value);
}

type Ipv4Range = { base: number; prefix: number; flag: IocFlag; label: string };

/**
 * reserved_range: documentation / reserved blocks that are never valid on the public internet.
 * non_routable:   private, loopback, link-local, shared space; real hosts, but not internet-routable.
 */
const IPV4_RANGES: readonly Ipv4Range[] = [
  { base: ipv4ToInt('192.0.2.0')!, prefix: 24, flag: 'reserved_range', label: 'RFC 5737 TEST-NET-1' },
  { base: ipv4ToInt('198.51.100.0')!, prefix: 24, flag: 'reserved_range', label: 'RFC 5737 TEST-NET-2' },
  { base: ipv4ToInt('203.0.113.0')!, prefix: 24, flag: 'reserved_range', label: 'RFC 5737 TEST-NET-3' },
  { base: ipv4ToInt('0.0.0.0')!, prefix: 8, flag: 'reserved_range', label: 'RFC 1122 "this network"' },
  { base: ipv4ToInt('10.0.0.0')!, prefix: 8, flag: 'non_routable', label: 'RFC 1918 private' },
  { base: ipv4ToInt('172.16.0.0')!, prefix: 12, flag: 'non_routable', label: 'RFC 1918 private' },
  { base: ipv4ToInt('192.168.0.0')!, prefix: 16, flag: 'non_routable', label: 'RFC 1918 private' },
  { base: ipv4ToInt('127.0.0.0')!, prefix: 8, flag: 'non_routable', label: 'RFC 1122 loopback' },
  { base: ipv4ToInt('169.254.0.0')!, prefix: 16, flag: 'non_routable', label: 'RFC 3927 link-local' },
  { base: ipv4ToInt('100.64.0.0')!, prefix: 10, flag: 'non_routable', label: 'RFC 6598 shared/CGNAT' },
];

/**
 * Strict dotted-quad parse. Rejects leading zeros ("010.0.0.1"), which some
 * stacks read as octal, so an ambiguous indicator is never silently classified.
 */
export function ipv4ToInt(value: string): number | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out;
}

function inIpv4Range(ip: number, range: Ipv4Range): boolean {
  const size = 2 ** (32 - range.prefix);
  return ip >= range.base && ip < range.base + size;
}

/** Returns the flag and label for a special-purpose address, or null for public/unparseable input. */
export function classifyIp(value: string): { flag: IocFlag; label: string } | null {
  const v4 = ipv4ToInt(value);
  if (v4 !== null) {
    const hit = IPV4_RANGES.find((r) => inIpv4Range(v4, r));
    return hit ? { flag: hit.flag, label: hit.label } : null;
  }

  // IPv6: prefix checks on the canonical-ish lowercase form. Only the
  // unambiguous special-purpose blocks are handled.
  if (!value.includes(':')) return null;
  const v6 = value.toLowerCase();
  if (v6 === '::1') return { flag: 'non_routable', label: 'IPv6 loopback' };
  if (v6 === '::') return { flag: 'reserved_range', label: 'IPv6 unspecified' };
  if (/^2001:0?db8:/.test(v6)) return { flag: 'reserved_range', label: 'RFC 3849 documentation' };
  if (/^f[cd][0-9a-f]{0,2}:/.test(v6)) return { flag: 'non_routable', label: 'RFC 4193 unique-local' };
  if (/^fe[89ab][0-9a-f]?:/.test(v6)) return { flag: 'non_routable', label: 'IPv6 link-local' };
  return null;
}

/** Reverse common defanging so indicators match across feeds: hxxp, [.], (.), {.}, [:], [at]. */
export function refang(value: string): string {
  return value
    .replace(/^hxxp(s?):\/\//i, 'http$1://')
    .replace(/\[\s*\.\s*\]|\(\s*\.\s*\)|\{\s*\.\s*\}/g, '.')
    .replace(/\[\s*:\s*\]/g, ':')
    .replace(/\[\s*(?:at|@)\s*\]/gi, '@');
}

/** Host part of a URL, without brackets or port, or null if it doesn't parse. */
function urlHost(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return null;
  }
}

function normalizeIndicator(type: IocRecord['type'], raw: string): string {
  const v = refang(raw.trim());
  switch (type) {
    case 'hash':
      return v.toLowerCase();
    case 'domain':
      return v.toLowerCase().replace(/\.$/, '');
    case 'ip':
      // Strip IPv6 brackets; leave everything else untouched so malformed
      // input stays visible to the analyst rather than being "fixed".
      return v.replace(/^\[|\]$/g, '');
    default:
      return v;
  }
}

/**
 * Normalize a partially-populated IOC and attach sanity flags.
 *
 * - `type` and `indicator` are required: an IOC without them can't be
 *   classified, and inventing either would corrupt evidence. Throws instead.
 * - Existing flags, role, and provenance fields are preserved; flags are
 *   merged and de-duplicated, never removed.
 * - `hashAlgo` is inferred only from hex length when not already supplied.
 */
export function sanitizeIocRecord(ioc: Partial<IocRecord>): IocRecord {
  if (!ioc.type) throw new Error('sanitizeIocRecord: missing required field "type"');
  // Input usually arrives as untyped JSON (e.g. model output), so enforce the union at runtime.
  if (!isIocType(ioc.type)) throw new Error(`sanitizeIocRecord: unknown IOC type "${String(ioc.type)}"`);
  if (typeof ioc.indicator !== 'string' || ioc.indicator.trim() === '') {
    throw new Error('sanitizeIocRecord: missing required field "indicator"');
  }

  const indicator = normalizeIndicator(ioc.type, ioc.indicator);
  const flags = new Set<IocFlag>(ioc.flags ?? []);
  let hashAlgo = ioc.hashAlgo;

  if (ioc.type === 'hash' && /^[0-9a-f]+$/.test(indicator)) {
    hashAlgo ??= HEX_LENGTH_TO_ALGO[indicator.length];
    if (indicator in EMPTY_INPUT_HASHES) flags.add('empty_file_hash');
  }

  const host = ioc.type === 'ip' ? indicator : ioc.type === 'url' ? urlHost(indicator) : null;
  if (host) {
    const special = classifyIp(host);
    if (special) flags.add(special.flag);
  }

  const out: IocRecord = {
    type: ioc.type,
    indicator,
    context: ioc.context ?? '',
  };
  if (ioc.role !== undefined) out.role = ioc.role;
  if (ioc.firstSeen !== undefined) out.firstSeen = ioc.firstSeen;
  if (ioc.sourceLine !== undefined) out.sourceLine = ioc.sourceLine;
  if (hashAlgo !== undefined) out.hashAlgo = hashAlgo;
  if (flags.size > 0) out.flags = [...flags];
  return out;
}

export interface IocRejection {
  index: number;
  reason: string;
  record: unknown;
}

/**
 * Sanitize an untrusted list of IOCs (e.g. a model's JSON output) record by record.
 * A record that throws is reported through `onReject` and skipped; it never fails
 * the batch. A non-array input yields an empty list (reported once as index -1).
 */
export function sanitizeIocBatch(
  raw: unknown,
  onReject: (rejection: IocRejection) => void = () => {}
): IocRecord[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    onReject({ index: -1, reason: 'iocs payload is not an array', record: raw });
    return [];
  }
  const out: IocRecord[] = [];
  raw.forEach((item, index) => {
    try {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new Error('record is not an object');
      }
      out.push(sanitizeIocRecord(item as Partial<IocRecord>));
    } catch (err) {
      onReject({ index, reason: err instanceof Error ? err.message : String(err), record: item });
    }
  });
  return out;
}
