// node test/theatre-check.mjs: the pure bits of renderer/theatre.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../renderer/theatre.js');

// --- CP437 ---
assert.equal(T.cp437([0xc9, 0xcd, 0xbb, 0xb0, 0xb1, 0xb2, 0xdb, 0x01]), '╔═╗░▒▓█☺', 'box, shade, block, smiley');
assert.equal(T.cp437([0x41, 0x7f, 0x80, 0xe1, 0xfe, 0xff]), 'A⌂Çß■ ', 'ASCII, house, high half ends');
assert.equal(T.cp437([0x0d, 0x0a, 0x09, 0x02, 0x1f]), '\r\n\t☻▼', 'tab/CR/LF stay text, other controls are glyphs');
const all = T.cp437(Uint8Array.from({ length: 256 }, (_, i) => i));
assert.equal(all.length, 256, 'one char per byte, no gaps in the table');
assert.equal(new Set(all).size, 255, 'every byte decodes to a different char (NUL and space are both blank)');

// --- port scan: plausible, deterministic per host shape, never real ---
let s = 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const r = T.scanReport('ellingson.example', rnd);
assert.match(r.ip, /^\d+\.\d+\.\d+\.\d+$/);
assert.ok(r.ports.some((p) => p.port === 22 && p.state === 'open') && r.ports.some((p) => p.port === 80), 'ssh and http always there');
assert.ok(r.ports.every((p) => ['open', 'filtered'].includes(p.state) && p.service));
assert.equal(T.scanReport('10.0.0.7', rnd).ip, '10.0.0.7', 'an IP is shown as given');
assert.equal(T.scanReport('gibson').ip, T.scanReport('gibson').ip, 'same host, same fake IP');

// --- war dialer ---
const page = T.wardialPage('555', 9990, 40, () => 0.01); // the rnd never rolls a carrier on its own
assert.equal(page.length, 40);
assert.equal(page[0].number, '555-9990'); assert.equal(page[10].number, '555-0000', 'wraps at 9999');
assert.equal(page.filter((p) => p.result === 'CARRIER').length, 1, 'a page always finds a carrier');

// --- cookie ---
for (const ok of ['cookie', 'COOKIE', ' Cookie! ', 'cookies']) assert.ok(T.isCookie(ok), ok);
for (const no of ['', 'cookei', 'no cookie', 'cookie monster']) assert.ok(!T.isCookie(no), no);

console.log('theatre ok');
