// Run with: npm test   (tsx --test; Node's built-in runner, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeIocRecord as s,
  sanitizeIocBatch,
  classifyIp,
  ipv4ToInt,
  refang,
  IocRejection,
} from '../iocSanity';

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// --- hashes ---------------------------------------------------------------

test('empty SHA-256 is lowercased, typed, and flagged', () => {
  assert.deepEqual(s({ type: 'hash', indicator: EMPTY_SHA256.toUpperCase() }), {
    type: 'hash',
    indicator: EMPTY_SHA256,
    context: '',
    hashAlgo: 'sha256',
    flags: ['empty_file_hash'],
  });
});

test('empty MD5 is flagged after trimming', () => {
  assert.deepEqual(s({ type: 'hash', indicator: ' d41d8cd98f00b204e9800998ecf8427e ' }).flags, ['empty_file_hash']);
});

test('empty SHA-1 infers sha1', () => {
  assert.equal(s({ type: 'hash', indicator: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' }).hashAlgo, 'sha1');
});

test('a real SHA-256 is not flagged', () => {
  assert.equal(s({ type: 'hash', indicator: 'a'.repeat(64) }).flags, undefined);
});

test('a supplied hashAlgo is never overwritten', () => {
  assert.equal(s({ type: 'hash', indicator: 'a'.repeat(64), hashAlgo: 'sha1' }).hashAlgo, 'sha1');
});

// --- IPv4 ranges ----------------------------------------------------------

test('TEST-NET-3 IOC is reserved_range', () => {
  assert.deepEqual(s({ type: 'ip', indicator: '203.0.113.45' }).flags, ['reserved_range']);
});

test('TEST-NET-1 is reserved_range', () => {
  assert.equal(classifyIp('192.0.2.1')?.flag, 'reserved_range');
});

test('TEST-NET-2 upper edge is reserved_range', () => {
  assert.equal(classifyIp('198.51.100.255')?.flag, 'reserved_range');
});

test('first address past TEST-NET-2 is public', () => {
  assert.equal(classifyIp('198.51.101.0'), null);
});

test('RFC 1918 192.168/16 IOC is non_routable', () => {
  assert.deepEqual(s({ type: 'ip', indicator: '192.168.1.15' }).flags, ['non_routable']);
});

test('RFC 1918 172.16/12 upper edge is non_routable', () => {
  assert.equal(classifyIp('172.31.255.255')?.flag, 'non_routable');
});

test('172.32.0.1 is public', () => {
  assert.equal(classifyIp('172.32.0.1'), null);
});

test('RFC 1918 10/8 is non_routable', () => {
  assert.equal(classifyIp('10.200.3.4')?.flag, 'non_routable');
});

test('loopback is non_routable', () => {
  assert.equal(classifyIp('127.0.0.1')?.flag, 'non_routable');
});

test('public 8.8.8.8 IOC is not flagged', () => {
  assert.equal(s({ type: 'ip', indicator: '8.8.8.8' }).flags, undefined);
});

test('leading-zero octets are rejected (octal ambiguity)', () => {
  assert.equal(ipv4ToInt('010.0.0.1'), null);
});

// --- IPv6 -----------------------------------------------------------------

test('bracketed IPv6 loopback is unwrapped and non_routable', () => {
  assert.deepEqual(s({ type: 'ip', indicator: '[::1]' }), {
    type: 'ip',
    indicator: '::1',
    context: '',
    flags: ['non_routable'],
  });
});

test('IPv6 documentation prefix is reserved_range', () => {
  assert.equal(classifyIp('2001:db8::1')?.flag, 'reserved_range');
});

// --- URLs, domains, defanging ---------------------------------------------

test('defanged URL is refanged and its private host flagged', () => {
  assert.deepEqual(s({ type: 'url', indicator: 'hxxp://192.168.1[.]15/login.php' }), {
    type: 'url',
    indicator: 'http://192.168.1.15/login.php',
    context: '',
    flags: ['non_routable'],
  });
});

test('relative URL path is left unflagged', () => {
  assert.equal(s({ type: 'url', indicator: '/login.php' }).flags, undefined);
});

test('domain is refanged, lowercased, and trailing dot removed', () => {
  assert.equal(s({ type: 'domain', indicator: 'Malicious-C2-Node[.]darknet.' }).indicator, 'malicious-c2-node.darknet');
});

test('refang handles (.), [:] and [at]', () => {
  assert.equal(refang('user[at]evil(.)com[:]8443'), 'user@evil.com:8443');
});

// --- field preservation ---------------------------------------------------

test('existing flags are merged and de-duplicated', () => {
  assert.deepEqual(s({ type: 'ip', indicator: '203.0.113.45', flags: ['reserved_range', 'truncated'] }).flags, [
    'reserved_range',
    'truncated',
  ]);
});

test('provenance fields are preserved', () => {
  const out = s({
    type: 'ip',
    indicator: '203.0.113.45',
    role: 'attacker_source',
    sourceLine: 2,
    firstSeen: '2026-09-25T14:05:33Z',
    context: 'POST /login.php 401',
  });
  assert.equal(out.sourceLine, 2);
  assert.equal(out.firstSeen, '2026-09-25T14:05:33Z');
  assert.equal(out.role, 'attacker_source');
  assert.equal(out.context, 'POST /login.php 401');
});

test('role is never assigned automatically', () => {
  assert.equal(s({ type: 'ip', indicator: '10.0.0.1' }).role, undefined);
});

// --- required fields / validation -----------------------------------------

test('missing indicator throws', () => {
  assert.throws(() => s({ type: 'ip' }), /indicator/);
});

test('missing type throws', () => {
  assert.throws(() => s({ indicator: '1.2.3.4' }), /type/);
});

test('unknown type from untyped JSON throws', () => {
  assert.throws(() => s({ type: 'process_name' as any, indicator: 'cmd.exe' }), /unknown IOC type/);
});

// --- batch (endpoint path) ------------------------------------------------

test('batch keeps valid records and reports each invalid one without failing', () => {
  const rejected: IocRejection[] = [];
  const out = sanitizeIocBatch(
    [
      { type: 'ip', indicator: '203.0.113.45', context: 'a' },
      { type: 'ip', context: 'missing indicator' },
      'not-an-object',
      { type: 'file_hash', indicator: EMPTY_SHA256, context: 'bad type' },
      { type: 'hash', indicator: EMPTY_SHA256, context: 'b' },
    ],
    (r) => rejected.push(r)
  );
  assert.deepEqual(
    out.map((r) => r.indicator),
    ['203.0.113.45', EMPTY_SHA256]
  );
  assert.deepEqual(
    rejected.map((r) => r.index),
    [1, 2, 3]
  );
});

test('batch treats missing iocs as empty and non-arrays as a single rejection', () => {
  assert.deepEqual(sanitizeIocBatch(undefined), []);
  assert.deepEqual(sanitizeIocBatch(null), []);
  const rejected: IocRejection[] = [];
  assert.deepEqual(sanitizeIocBatch({ type: 'ip' }, (r) => rejected.push(r)), []);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].index, -1);
});
