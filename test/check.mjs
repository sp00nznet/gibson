// npm test. No framework: asserts that fail loudly if the logic breaks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Activity, layers, SLOW_BPM, FAST_BPM } = require('../renderer/activity.js');
const { NYX_KIND, MOOD_WORLD, EVENT_WORLD } = require('../renderer/nyx.js');
const { Worlds } = require('../renderer/worlds.js');
import { readdirSync } from 'node:fs';
for (const f of readdirSync(new URL('../renderer/worlds/', import.meta.url))) require(`../renderer/worlds/${f}`);
const { llmLine, parse, MOODS } = require('../llm.js');
const sysinfo = require('../sysinfo.js');

// --- live data parsers, fed real-shaped output from each platform ---
const win = '  TCP    192.168.1.5:50123      140.82.112.3:443       ESTABLISHED     4242\n  TCP    127.0.0.1:5000         127.0.0.1:5001         ESTABLISHED     1\n  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       900\n  TCP    [::1]:7000             [::1]:7001             ESTABLISHED     2\n  TCP    [2001:db8::5]:50200    [2606:4700::6810]:443  ESTABLISHED     7\n';
assert.deepEqual(sysinfo.parseNet(win).map((c) => `${c.ip}:${c.port}:${c.service}`), ['140.82.112.3:443:https', '2606:4700::6810:443:https'], 'Windows netstat: established, not loopback');
const mac = 'tcp4       0      0  192.168.1.5.50124      203.0.113.9.22         ESTABLISHED 131072 131072  77  0 0x0102\n';
assert.equal(sysinfo.parseNet(mac)[0].service, 'ssh', 'macOS netstat uses dots before the port');
const lin = 'ESTAB 0 0 10.0.0.2:41234 198.51.100.7:6697\n';
assert.equal(sysinfo.parseNet(lin)[0].port, 6697, 'Linux ss');
const ps = sysinfo.parseProcs('/usr/bin/zsh  0.5  4096\n/Applications/Google Chrome.app/Contents/MacOS/Google Chrome  12.0  204800\nzsh  1.0 2048\n', false, 0);
assert.deepEqual(ps.map((p) => [p.name, p.cpu, p.n]), [['Google Chrome', 12, 1], ['zsh', 1.5, 2]], 'ps: names with spaces, grouped by name');
const rss = '<rss><channel><title>Wire</title><item><title><![CDATA[Worm &amp; virus]]></title><link>https://x/1</link></item><item><title>Second</title></item></channel></rss>';
assert.deepEqual(sysinfo.parseFeed(rss).map((i) => [i.title, i.source]), [['Worm & virus', 'Wire'], ['Second', 'Wire']], 'RSS');
const atom = '<feed><title>Reg</title><entry><title type="html">Patch &#8217;em</title><link href="https://y/2"/></entry></feed>';
assert.deepEqual(sysinfo.parseFeed(atom)[0], { title: 'Patch \u2019em', link: 'https://y/2', source: 'Reg' }, 'Atom');

// --- shell profiles ---
const wsl = sysinfo.wslDistros(Buffer.from('Debian\r\nUbuntu\r\ndocker-desktop\r\n', 'utf16le').toString('utf16le'));
assert.deepEqual(wsl.map((p) => [p.name, p.args.join(' ')]), [['Debian (WSL)', '-d Debian'], ['Ubuntu (WSL)', '-d Ubuntu']], 'one profile per distro, Docker skipped');
const etc = '# /etc/shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/zsh\n/usr/bin/git-shell\n/usr/sbin/nologin\n/usr/local/bin/fish\n';
const ux = sysinfo.unixShells(etc, '/bin/zsh', true, (f) => f !== '/usr/local/bin/fish');
assert.deepEqual(ux.map((p) => p.name), ['zsh', 'sh', 'bash'], '$SHELL first, deduped, no nologin/git-shell, only what exists');
assert.deepEqual(ux[0].args, ['-l'], 'login shells on macOS');
assert.deepEqual(sysinfo.unixShells(etc, '', false, () => true)[0], { name: 'bash', shell: '/bin/bash', args: [] }, 'no $SHELL: bash; Linux: no -l');

// --- tempo follows the hands ---
const a = new Activity();
assert.equal(a.targetBpm({ mode: 'reactive' }), SLOW_BPM, 'idle is slow');
for (let i = 0; i < 40; i++) { a.key(); a.tick(0.1); }          // ~10 keys/s for 4 s
assert.ok(a.level() > 0.8, `fast typing reads busy (${a.level()})`);
assert.ok(a.targetBpm({ mode: 'reactive' }) < 120, 'a short burst barely moves the tempo');
for (let i = 0; i < 400; i++) { a.key(); a.tick(0.1); }         // keep it up for 40 s
assert.ok(a.targetBpm({ mode: 'reactive' }) > 145, 'sustained work gets there');
assert.equal(a.targetBpm({ mode: 'fixed', bpm: 128 }), 128, 'fixed mode ignores you');
const before = a.bpm; a.glide(1, { mode: 'reactive' });
assert.ok(a.bpm - before <= 3.01, 'tempo glides, never jumps');
for (let i = 0; i < 100; i++) a.tick(0.2);
assert.ok(a.level() < 0.05, 'stopping lets it decay');
for (let i = 0; i < 300; i++) a.tick(0.2);
assert.ok(a.targetBpm({ mode: 'reactive' }) < 95, 'and the tempo follows, slowly');
assert.ok(a.idle > 19);

// --- a compile: lots of output, no typing ---
const c = new Activity();
for (let i = 0; i < 60; i++) { c.output(4096); c.tick(0.1); }
assert.ok(c.busyOut > 4, `compile detected (${c.busyOut})`);
assert.ok(c.level() > 0.62, `a scrolling screen drives the beat (${c.level()})`);
const bs = new Activity();
for (let i = 0; i < 60; i++) { bs.key(0.1); bs.tick(1 / 30); }      // held backspace, 2 s
assert.ok(bs.level() < 0.3, `held backspace stays calm (${bs.level()})`);
assert.deepEqual(layers(0).kick, false); assert.equal(layers(1).guitar, true);

// --- NYX reads commands ---
assert.equal(NYX_KIND('rm -rf /tmp/x'), 'danger');
assert.equal(NYX_KIND('Remove-Item foo -Recurse'), 'danger');
assert.equal(NYX_KIND('cd ..'), 'cd');
assert.equal(NYX_KIND('git push'), 'git');
assert.equal(NYX_KIND('cls'), 'clear');
assert.equal(NYX_KIND('npm run build'), 'cmd');
for (const m of MOODS) assert.ok(MOOD_WORLD[m], `mood ${m} has a world`);
for (const w of [...Object.values(MOOD_WORLD), ...Object.values(EVENT_WORLD)].flat()) assert.ok(Worlds.names.includes(w), `world ${w} exists`);

// --- the globes: where a headline happened, which registry an address belongs to ---
const { placeOf, registryOf } = Worlds.geo;
const [mlat, mlon] = placeOf('Kremlin denies everything');
assert.ok(Math.abs(mlat - 55.8) < 3 && Math.abs(mlon - 37.6) < 3, 'Moscow');
assert.ok(Math.abs(placeOf('North Korean hackers hit exchange')[1] - 125.8) < 3, 'north korea before korea');
assert.deepEqual(['81.2.3.4', '1.1.1.1', '8.8.8.8', '200.1.1.1', '41.1.1.1', '2a00::1', '115.1.1.1'].map(registryOf), ['ripe', 'apnic', 'arin', 'lacnic', 'afrinic', 'ripe', 'apnic']);

// --- git galaxy lanes: main line in lane 0, a branch gets its own lane until it merges ---
const lanes = Worlds.gitLanes([
  { h: 'm', p: ['c', 'b2'] }, { h: 'b2', p: ['b1'] }, { h: 'c', p: ['a'] }, { h: 'b1', p: ['a'] }, { h: 'a', p: [] },
]).map((c) => c.lane);
assert.deepEqual(lanes, [0, 1, 0, 1, 0], `lanes ${lanes}`);

// --- LLM replies ---
assert.deepEqual(parse('[taunting] Nice typo, insect.'), { text: 'Nice typo, insect.', mood: 'taunting' });
assert.deepEqual(parse('<think>hmm</think>\n[Curious] "What is in there?"\nextra'), { text: 'What is in there?', mood: 'curious' });
assert.deepEqual(parse('no tag at all'), { text: 'no tag at all', mood: null });
assert.equal(parse(''), null);

// --- each provider's request shape, against a stub ---
let seen;
globalThis.fetch = async (url, init) => { seen = { url, init, body: JSON.parse(init.body) }; return { ok: true, json: async () => reply(url) }; };
const reply = (url) => url.includes('/api/chat') ? { message: { content: '[playful] hi' } }
  : url.includes('/v1/messages') ? { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '[impressed] ok' }] }
  : { choices: [{ message: { content: '[bored] yawn' } }] };
const ev = { kind: 'cmd', cmd: 'ls', hour: 3, activity: '0.5', output: 'SECRET' };

assert.deepEqual(await llmLine({ provider: 'ollama' }, ev), { text: 'hi', mood: 'playful' });
assert.match(seen.url, /11434\/api\/chat$/);
assert.ok(!seen.init.body.includes('SECRET'), 'output stays local unless shareOutput');

process.env.ANTHROPIC_API_KEY = 'test-key';
assert.deepEqual(await llmLine({ provider: 'anthropic' }, ev), { text: 'ok', mood: 'impressed' });
assert.equal(seen.body.model, 'claude-opus-5-5');
assert.equal(seen.init.headers['x-api-key'], 'test-key');
assert.equal(seen.body.temperature, undefined, 'no sampling params on Opus 5.5');

assert.deepEqual(await llmLine({ provider: 'openai', shareOutput: true }, ev), { text: 'yawn', mood: 'bored' });
assert.ok(seen.init.body.includes('SECRET'), 'shareOutput sends it');
assert.equal(await llmLine({ provider: 'none' }, ev), null);

// --- `nyx <message>`: the conversation goes along, opening with a user turn ---
const chatEv = { kind: 'chat', message: 'are you real?', user: 'h', hour: 2, activity: '0.1',
  history: [{ who: 'nyx', text: 'orphan reply' }, { who: 'user', text: 'hi' }, { who: 'nyx', text: 'hello, insect' }] };
await llmLine({ provider: 'anthropic' }, chatEv);
assert.deepEqual(seen.body.messages.map((m) => m.role), ['user', 'assistant', 'user'], 'history alternates and opens with the user');
assert.ok(seen.body.messages.at(-1).content.includes('are you real?'), 'the message is sent');
assert.equal(parse('[tender] ' + 'x'.repeat(400), 280).text.length, 280, 'chat replies may run longer');

globalThis.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'refusal', content: [] }) });
assert.equal(await llmLine({ provider: 'anthropic' }, ev), null, 'refusal falls back to canned lines');

console.log('check: all passed');
