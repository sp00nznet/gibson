// node test/irc-check.mjs: the IRC client against a tiny local server, plus the panel's pure logic.
import assert from 'node:assert/strict';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createIrc, parseLine, splitText, stripColors, defaultNick } = require('../irc.js');
const { IrcPanel } = require('../renderer/irc.js');

// --- pure bits ---
assert.deepEqual(parseLine(':bob!b@h PRIVMSG #gibson :hi there :)'), { prefix: 'bob!b@h', nick: 'bob', command: 'PRIVMSG', params: ['#gibson', 'hi there :)'] });
assert.deepEqual(parseLine('@time=x :srv 353 me = #c :@op bob').params, ['me', '=', '#c', '@op bob'], 'tags skipped, trailing kept');
assert.equal(parseLine('PING :abc').command, 'PING');
assert.equal(stripColors('\x0304,01red\x03 \x02bold\x02 \x1funder\x0f \x0399x'), 'red bold under x');
const euro = '€'.repeat(300); // 900 bytes
const pieces = splitText(euro);
assert.ok(pieces.every((p) => Buffer.byteLength(p) <= 400) && pieces.join('') === euro, 'split by bytes, never inside a character');
const words = splitText('word '.repeat(200));
assert.ok(words.length === 3 && words.every((p) => Buffer.byteLength(p) <= 400 && !p.startsWith(' ')), 'split at spaces');
assert.match(defaultNick(), /^gibson\d{3}$/, 'default nick says nothing about the user');

// --- a fake server ---
let conns = 0, sock = null, lines = [], waiters = [];
const server = net.createServer((s) => {
  conns++; sock = s; let buf = '';
  s.setEncoding('utf8');
  s.on('data', (d) => {
    buf += d; const ls = buf.split('\r\n'); buf = ls.pop();
    for (const l of ls) { lines.push(l); for (const w of waiters.slice()) w(); }
  });
  s.on('error', () => {});
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
// Wait for (and consume) the next line the client sends that matches re.
function expectLine(re, ms = 5000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const i = lines.findIndex((l) => re.test(l));
      if (i < 0) return false;
      const l = lines.splice(0, i + 1).pop(); waiters = waiters.filter((w) => w !== check); clearTimeout(t); resolve(l); return true;
    };
    const t = setTimeout(() => reject(new Error(`timed out waiting for ${re}; saw ${JSON.stringify(lines)}`)), ms);
    if (!check()) waiters.push(check);
  });
}
const events = [];
const until = (fn, ms = 5000) => new Promise((resolve, reject) => {
  const t0 = Date.now(), iv = setInterval(() => { const e = events.find(fn); if (e) { clearInterval(iv); resolve(e); } else if (Date.now() - t0 > ms) { clearInterval(iv); reject(new Error('no such event: ' + JSON.stringify(events.slice(-5)))); } }, 20);
});
const say = (l) => sock.write(l + '\r\n');

const irc = createIrc({ server: '127.0.0.1', port, tls: false, nick: 'tester', channels: ['#gibson'], password: 'sekrit' }, (e) => events.push(e));
await expectLine(/^PASS sekrit$/);
await expectLine(/^NICK tester$/);
assert.match(await expectLine(/^USER /), /^USER tester 0 \* :GIBSON$/, 'realname is GIBSON, not the OS user');
say(':srv 433 * tester :Nickname is already in use');
await expectLine(/^NICK tester_$/);
say(':srv 001 tester_ :Welcome to the test net');
await expectLine(/^JOIN #gibson$/);
assert.equal((await until((e) => e.type === 'registered')).nick, 'tester_');
assert.equal(irc.nick(), 'tester_');

say('PING :abc123');
await expectLine(/^PONG :abc123$/);

say(':bob!b@h PRIVMSG #gibson :\x0304hello\x03 \x02world\x02');
const m = await until((e) => e.type === 'msg' && e.from === 'bob');
assert.equal(m.text, 'hello world'); assert.equal(m.target, '#gibson');
say(':bob!b@h PRIVMSG #gibson :\x01ACTION waves\x01');
assert.ok((await until((e) => e.action && e.from === 'bob')).text === 'waves', 'incoming /me');
say(':bob!b@h PRIVMSG tester_ :\x01VERSION\x01');
await expectLine(/^NOTICE bob :\x01VERSION GIBSON\x01$/);
say(':srv 353 tester_ = #gibson :@op +bob tester_');
say(':srv 366 tester_ #gibson :End of /NAMES list.');
assert.deepEqual((await until((e) => e.type === 'names')).names, ['@op', '+bob', 'tester_']);
say(':srv 332 tester_ #gibson :the \x02topic\x02');
assert.equal((await until((e) => e.type === 'topic')).text, 'the topic');

irc.command('/me hacks the planet', '#gibson');
await expectLine(/^PRIVMSG #gibson :\x01ACTION hacks the planet\x01$/);
irc.send('#gibson', 'x'.repeat(900));
for (const n of [400, 400, 100]) assert.equal((await expectLine(/^PRIVMSG #gibson :x/)).length, 'PRIVMSG #gibson :'.length + n, 'long lines split at 400 bytes');
irc.send('#gibson', 'hi\r\nQUIT :pwned');
assert.equal(await expectLine(/^PRIVMSG #gibson :hi/), 'PRIVMSG #gibson :hi  QUIT :pwned', 'CR/LF cannot smuggle a second command');
irc.command('/msg bob psst', '#gibson');
await expectLine(/^PRIVMSG bob :psst$/);
irc.command('/join #other', '#gibson');
await expectLine(/^JOIN #other$/);
irc.command('/part bye now', '#gibson');
await expectLine(/^PART #gibson :bye now$/);
irc.command('/topic #other new topic', '#gibson');
await expectLine(/^TOPIC #other :new topic$/);
say(':tester_!t@h NICK :zero');
await until((e) => e.type === 'nick' && e.self);
assert.equal(irc.nick(), 'zero', 'own nick change followed');

// the line drops: it redials and registers again
sock.destroy();
await expectLine(/^NICK zero$/, 6000);
assert.equal(conns, 2, 'reconnected');
say(':srv 001 zero :Welcome back');
await expectLine(/^JOIN #gibson$/);

irc.quit('hack the planet');
await expectLine(/^QUIT :hack the planet$/);
server.close();

// --- the panel's pure logic ---
const { nickColor, parseInput, Fake, CHAN } = IrcPanel;
assert.equal(nickColor('ZeroCool'), nickColor('zerocool'), 'nick colours ignore case');
assert.match(nickColor('AcidBurn'), /^#[0-9a-f]{6}$/);
assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(nickColor)).size > 3, 'colours vary');
assert.deepEqual(parseInput('/msg  AcidBurn hi there'), { cmd: 'msg', args: ['AcidBurn', 'hi', 'there'], rest: 'AcidBurn hi there' });
assert.equal(parseInput('hello'), null); assert.equal(parseInput('//not a command'), null);

const out = [];
const f = new Fake((e) => out.push(e), { nick: 'neo', ask: async (text, history) => (/nyx/i.test(text) && Array.isArray(history) ? 'Hello, insect.' : null) });
f.start();
assert.ok(out.some((e) => e.type === 'topic') && out.some((e) => e.type === 'names'), 'topic and names on join');
for (let i = 0; i < 900; i++) f.tick(1);
const kinds = new Set(out.map((e) => e.type));
assert.ok(out.filter((e) => e.type === 'msg').length > 30, 'the channel chats on its own');
assert.ok(kinds.has('join') && (kinds.has('part') || kinds.has('quit') || kinds.has('kick')), 'people come and go');
assert.ok(out.some((e) => e.action), 'and /me now and then');
assert.ok(out.every((e) => e.type !== 'msg' || !/\{\w+\}/.test(e.text)), 'every placeholder filled');

f.lastReact = -1e9;
assert.equal(f.event('error', 'boom'), true, 'an error gets a reaction');
assert.equal(f.event('error', 'boom'), false, 'but not two in a row');
f.t += 11; assert.equal(f.event('nonsense'), false, 'unknown kinds are ignored');

out.length = 0;
f.input('hey nyx, you there?');
assert.equal(out[0].from, 'neo'); assert.equal(out[0].self, true);
await new Promise((r) => setTimeout(r, 10)); // the ask() promise
for (let i = 0; i < 8; i++) f.tick(1);
assert.ok(out.some((e) => e.from === 'NYX' && e.text === 'Hello, insect.'), 'NYX answers through ask()');

out.length = 0; f.input('/topic mine now');
assert.ok(out.some((e) => e.type === 'error' && /not channel operator/.test(e.text)), '/topic needs ops');
out.length = 0; f.input('/nick trinity');
assert.deepEqual([out[0].type, out[0].from, out[0].text], ['nick', 'neo', 'trinity']); assert.equal(f.me, 'trinity');
out.length = 0; f.input('/me sips coffee');
assert.ok(out[0].action && out[0].from === 'trinity' && out[0].target === CHAN);
out.length = 0; f.input('/part'); for (let i = 0; i < 5; i++) f.tick(1);
assert.ok(out.some((e) => e.type === 'join' && e.self), 'NYX drags you back');

console.log('irc check: ok');
