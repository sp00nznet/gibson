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

// --- system monitor: network byte counters on each platform ---
assert.deepEqual(sysinfo.parseNetIO('Interface Statistics\n\n                           Received            Sent\n\nBytes                    1772932204      3221589704\nUnicast packets           640974360       649963421\n', 'win32'), [1772932204, 3221589704], 'netstat -e');
assert.deepEqual(sysinfo.parseNetIO('Inter-|   Receive  |  Transmit\n face |bytes packets errs drop fifo frame compressed multicast|bytes packets\n    lo: 500 5 0 0 0 0 0 0 500 5 0 0 0 0 0 0\n  eth0: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0\n wlan0: 30 1 0 0 0 0 0 0 40 1 0 0 0 0 0 0\n', 'linux'), [1030, 2040], '/proc/net/dev, lo skipped');
assert.deepEqual(sysinfo.parseNetIO('Name  Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll\nlo0   16384 <Link#1>                        100     0      9000      100     0      9000     0\nen0   1500  <Link#4>    a4:83:e7:00:00:01  5000     0    700000     4000     0    300000     0\nen0   1500  192.168.1     192.168.1.5        4000     -    600000     3000     -    200000     -\nutun0 1380  <Link#9>                         10     0       100       12     0       200     0\n', 'darwin'), [700100, 300200], 'netstat -ib: Link rows only, blank Address');
assert.equal(sysinfo.parseNetIO('', 'win32'), null, 'no counters');

// --- SNEAKERS: every puzzle really is an anagram, and every letter finds a partner ---
{
  const A = Worlds.anagrams;
  for (const [a, b] of A.PAIRS) { assert.ok(A.isAnagram(a, b), `${a} / ${b}`); assert.ok(!A.pairUp(a, b).some((i, j) => i < 0 && /[A-Z0-9]/.test(b[j])), `${a} -> ${b} maps every letter`); }
  assert.ok(A.isAnagram('HACK THE PLANET', A.scramble('HACK THE PLANET')), 'a scrambled command is still its anagram');
}

// --- panes: the split tree behind free-form panes ---
{
  const P = require('../renderer/panes.js');
  let r = P.split(P.split(P.leaf(1), 1, 2, 'row'), 2, 3, 'col'); // 1 | 2 over 3
  assert.deepEqual(P.leaves(r), [1, 2, 3], 'split right, then down');
  assert.equal(P.neighbour(r, 1, 'right'), 2); assert.equal(P.neighbour(r, 3, 'up'), 2); assert.equal(P.neighbour(r, 3, 'left'), 1); assert.equal(P.neighbour(r, 1, 'left'), null, 'nothing past the edge');
  assert.deepEqual(P.leaves(P.split(r, 3, 4, 'row', true)), [1, 2, 4, 3], 'dock before');
  assert.deepEqual(P.leaves(P.swap(r, 1, 3)), [3, 2, 1], 'swap');
  const gone = P.remove(r, 2); assert.deepEqual(P.leaves(gone), [1, 3], 'close: the sibling takes the space'); assert.equal(gone.dir, 'row');
  assert.equal(P.remove(P.leaf(1), 1), null, 'the last pane');
  for (const n of [1, 2, 3, 5, 7, 16]) { const g = P.rects(P.grid([...Array(n).keys()])).panes; assert.equal(g.length, n, `grid of ${n}`); assert.ok(Math.abs(g.reduce((a, x) => a + x.w * x.h, 0) - 1) < 1e-9, `grid of ${n} fills the tab`); }
  assert.ok(P.rects(P.grid([...Array(16).keys()])).panes.every((x) => Math.abs(x.w - 0.25) < 1e-9 && Math.abs(x.h - 0.25) < 1e-9), '16 is 4x4');
  const three = P.even(P.split(P.split(P.leaf(1), 1, 2, 'row'), 2, 3, 'row'));
  assert.ok(P.rects(three).panes.every((x) => Math.abs(x.w - 1 / 3) < 1e-9), 'even out: three across');
  assert.ok(P.nudge(three, 3, 'left', 0.05) && !P.nudge(three, 3, 'up', 0.05), 'nudge finds a gap of the right kind');
  assert.deepEqual(P.leaves(P.load(P.save(P.grid([1, 2, 3, 4]), (p) => ({ id: p })), (o) => (o.id % 2 ? o.id : null))), [1, 3], 'save and load; a pane that is gone drops out');
}

// --- NIGHT SKY: the sums against known positions ---
{
  const S = Worlds.sky, t = (s) => Date.parse(s), near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a.toFixed(2)} vs ${b}`);
  near(S.gmst(t('2000-01-01T12:00:00Z')), 280.461, 0.01, 'sidereal time at J2000');
  const sun = S.sunRaDec(t('2000-01-01T12:00:00Z')); near(sun[0], 281.29, 0.3, 'Sun RA at J2000'); near(sun[1], -23.03, 0.3, 'Sun Dec at J2000');
  near(S.sunRaDec(t('2024-06-20T20:51:00Z'))[1], 23.44, 0.2, 'Sun at the 2024 June solstice');
  near(S.planetRaDec('mars', t('2025-01-16T00:00:00Z'))[1], 25, 2, 'Mars at its 2025 opposition');
  near(S.sep(S.sunRaDec(t('2024-04-08T18:18:00Z')), S.moonRaDec(t('2024-04-08T18:18:00Z'))), 0, 2, 'Moon on the Sun at the 2024 eclipse');
  near(S.altAz(37.95, 89.264, 34, -118, Date.now())[0], 34, 1.2, 'Polaris stands at your latitude');
}

// --- dropped files, quoted for each shell; search across scrollback ---
{
  const K = require('../renderer/termkit.js');
  assert.equal(K.shellKind('PowerShell 7'), 'pwsh'); assert.equal(K.shellKind('cmd'), 'cmd'); assert.equal(K.shellKind('Ubuntu (WSL)'), 'wsl');
  assert.equal(K.shellKind('Git Bash'), 'posix'); assert.equal(K.shellKind('', 'win32'), 'pwsh'); assert.equal(K.shellKind('', 'linux'), 'posix');
  assert.equal(K.quotePaths(["C:\\it's mine\\a b.txt", 'C:\\x'], 'pwsh'), "'C:\\it''s mine\\a b.txt' 'C:\\x'", 'PowerShell doubles single quotes');
  assert.equal(K.quotePaths(['C:\\a b\\c.txt'], 'cmd'), '"C:\\a b\\c.txt"');
  assert.equal(K.quotePaths(["/home/me/it's"], 'posix'), "'/home/me/it'\\''s'", "POSIX: close, escaped quote, reopen");
  assert.equal(K.quotePaths(['D:\\Proj\\x y.js'], 'wsl'), "'/mnt/d/Proj/x y.js'", 'WSL sees the drive under /mnt');
  const L = ['error: one ERROR', 'fine', 'x.y and xay'];
  assert.deepEqual(K.findAll(L, 'error').map((m) => [m.row, m.start]), [[0, 0], [0, 11]], 'case-insensitive by default');
  assert.equal(K.findAll(L, 'error', { caseSensitive: true }).length, 1, 'case-sensitive');
  assert.equal(K.findAll(L, 'x.y').length, 1, 'plain text: the dot is a dot');
  assert.equal(K.findAll(L, 'x.y', { regex: true }).length, 2, 'regex: the dot is anything');
  assert.deepEqual(K.findAll(L, '(', { regex: true }), [], 'a broken regex finds nothing, no throw');
  assert.equal(K.findAll(Array(100).fill('aaaa'), 'a', { max: 7 }).length, 7, 'capped');
  assert.equal(K.findAll(['abc'], '^', { regex: true }).length, 0, 'empty matches skipped, no endless loop');
}

// --- keys: accelerators, key presses and the user's overrides ---
{
  const K = require('../renderer/keys.js');
  assert.equal(K.norm('shift+ctrl+t'), 'Ctrl+Shift+T', 'modifiers in order, key uppercased');
  assert.equal(K.norm('CmdOrCtrl+Shift+space'), 'Ctrl+Shift+Space');
  assert.equal(K.norm('Ctrl++'), 'Ctrl+=', 'the + key is the = key');
  assert.equal(K.fromInput({ key: '+', code: 'Equal', alt: true, shift: true }), 'Alt+Shift+=', 'Alt+Shift+= reads the key position, not the shifted +');
  assert.equal(K.fromInput({ key: '!', code: 'Digit1', control: true, shift: true }), 'Ctrl+Shift+1');
  assert.equal(K.fromInput({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true }), 'Ctrl+Up', 'a DOM key event works too');
  const m = K.keymap({ newtab: 'Ctrl+Alt+T', world: null, irc: ['F2', 'F3'] });
  assert.equal(m['Ctrl+Alt+T'], 'newtab'); assert.equal(m['Ctrl+Shift+T'], undefined, 'an override replaces the default key');
  assert.equal(m['Ctrl+Shift+W'], undefined, 'null unbinds'); assert.equal(m.F3, 'irc', 'a list binds several keys');
  assert.equal(m['Alt+Shift+='], 'split:right'); assert.equal(K.keyOf(m, 'palette'), 'Ctrl+Shift+Space');
  assert.equal(Object.keys(K.keymap()).length, Object.values(K.DEFAULT_KEYS).flat().filter(Boolean).length, 'no two default actions share a key');
}
// --- ssh hosts from ~/.ssh/config ---
{
  const { parseSshConfig, sshProfile } = require('../ssh.js');
  const h = parseSshConfig('Host *\n  User all\nHost box gw\n  HostName 10.0.0.2\n  User me\n  Port 2222\n# Host old\nHost pi?\nMatch host x\n  User nope\nHost web\n  HostName=web.example\n');
  assert.deepEqual(h.map((x) => [x.name, x.host, x.user, x.port]), [['box', '10.0.0.2', 'me', 2222], ['gw', '10.0.0.2', 'me', 2222], ['web', 'web.example', undefined, undefined]], 'concrete hosts only, settings to every alias, Match ends a block');
  assert.deepEqual(sshProfile(h[0]).args, ['box'], 'a config host opens by its alias');
  assert.deepEqual(sshProfile({ name: 'x', host: 'h.example', user: 'u', port: 22 }).args, ['-p', '22', 'u@h.example']);
}
// --- the palette's fuzzy match ---
{
  const { fuzzy } = require('../renderer/palette.js');
  assert.equal(fuzzy('xyz', 'World › Arcade › TRENCH RUN'), null);
  assert.deepEqual(fuzzy('tr run', 'TRENCH RUN').hits, [0, 1, 7, 8, 9], 'spaces are free; letters found in order');
  assert.ok(fuzzy('trench', 'World › Arcade › TRENCH RUN').score > fuzzy('trench', 'Look › Matrix rain on the bench').score, 'a word start beats scattered letters');
}

// --- shell integration: OSC 133 marks into commands, exit codes and output ---
{
  const SI = require('../renderer/shellint.js');
  assert.deepEqual(SI.mark('D;2'), { kind: 'D', code: 2 }); assert.deepEqual(SI.mark('D'), { kind: 'D', code: null }); assert.equal(SI.mark('P;Cwd=x'), null);
  assert.equal(SI.cwdOf(7, 'file://box/home/me/my%20dir'), '/home/me/my dir'); assert.equal(SI.cwdOf(7, 'file:///C:/Users/me'), 'C:/Users/me');
  assert.equal(SI.cwdOf(9, '9;"C:\\Users\\me"'), 'C:\\Users\\me'); assert.equal(SI.cwdOf(9, '4;1;50'), null, 'OSC 9;4 is progress, not a folder');
  // A terminal just big enough: rows of text, a cursor, markers on the cursor's row, OSC handlers.
  const pane = () => {
    const rows = [''], h = {}, b = { cursorX: 0, cursorY: 0, baseY: 0, viewportY: 0, get length() { return rows.length; },
      getLine: (r) => (r < rows.length ? { isWrapped: false, translateToString: (trim, s = 0, e) => { const x = rows[r].slice(s, e); return trim ? x.trimEnd() : x; } } : undefined) };
    const term = { buffer: { active: b }, parser: { registerOscHandler: (n, f) => { h[n] = f; } }, hasSelection: () => false,
      registerMarker: () => ({ line: b.cursorY, isDisposed: false, dispose() { this.isDisposed = true; } }),
      write(s) {
        for (const m of s.matchAll(/\x1b\](\d+);([^\x07]*)\x07|\n|[^\x1b\n]+/g)) {
          if (m[1]) h[m[1]](m[2]);
          else if (m[0] === '\n') { rows.push(''); b.cursorY++; b.cursorX = 0; }
          else { rows[b.cursorY] += m[0]; b.cursorX += m[0].length; }
        }
      } };
    const p = { term, done: [], dirs: [] }; SI.attach(p, { cwd: (_p, d) => p.dirs.push(d), done: (_p, r) => p.done.push([r.cmd, r.code]) });
    return p;
  };
  const prompt = (code) => `\x1b]133;D${code === undefined ? '' : ';' + code}\x07\x1b]9;9;"C:\\x"\x07\x1b]133;A\x07PS C:\\x> \x1b]133;B\x07`;
  const ps = pane(); ps.term.write(prompt(0));
  assert.equal(SI.live(ps), true); assert.deepEqual(ps.dirs, ['C:\\x']); assert.deepEqual(ps.done, [], 'the first prompt ends nothing');
  ps.term.write('git status'); assert.equal(SI.typed(ps), 'git status', 'typed: from the end of the prompt');
  ps.term.write('\n\x1b]133;C\x07out1\nout2\n'); assert.equal(SI.busy(ps), true);
  ps.term.write(prompt(1)); assert.deepEqual(ps.done, [['git status', 1]]); assert.equal(SI.busy(ps), false);
  assert.equal(SI.output(ps).text, 'out1\nout2', 'output: between C and the next prompt');
  ps.term.write('\n\x1b]133;C\x07' + prompt(0)); ps.term.write('half typed' + prompt(130));
  assert.equal(ps.done.length, 1, 'an empty Enter, or Ctrl+C on a half-typed line, is no command');
  const cmd = pane(); cmd.term.write(prompt()); cmd.term.write('dir\nfile.txt\n' + prompt()); // cmd.exe: no C, no exit code
  assert.deepEqual(cmd.done, [['dir', null]]); assert.equal(SI.output(cmd).text, 'file.txt');
}

// --- the jukebox knows a tracker module from a recording ---
const { Jukebox } = require('../renderer/jukebox.js');
for (const f of ['a.mod', 'b/C.XM', 'x.s3m', 'y.it', 'z.mptm']) assert.ok(Jukebox.isTracker(f), f);
for (const f of ['a.mp3', 'mod.wav', 'it']) assert.ok(!Jukebox.isTracker(f), f);

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
