// npm test. No framework: asserts that fail loudly if the logic breaks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Activity, layers, SLOW_BPM, FAST_BPM } = require('../renderer/activity.js');
const { NYX_KIND, MOOD_WORLD, EVENT_WORLD } = require('../renderer/nyx.js');
const { Worlds } = require('../renderer/worlds.js');
const { llmLine, parse, MOODS } = require('../llm.js');

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
for (const w of [...Object.values(MOOD_WORLD), ...Object.values(EVENT_WORLD)]) assert.ok(Worlds.names.includes(w), `world ${w} exists`);

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
