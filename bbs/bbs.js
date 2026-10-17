// GIBSON's phone-phreak BBS: the "shell" behind `dial <number>`.
// Run: node bbs/bbs.js 555-0199  (GIBSON runs it as electron + ELECTRON_RUN_AS_NODE=1 in a pty).
// Plain Node, stdlib only. Piped stdin works too (that's how bbs/check.js drives it).
'use strict';
const door = require('./door');

const NUMBER = process.argv[2] || '555-0199';
const TTY = !!process.stdin.isTTY;
const FAST = !process.stdout.isTTY || !!process.env.BBS_FAST; // pipes and tests skip the delays
const T0 = Date.now(), MINUTES = 60;

// Seeded RNG so check.js is repeatable (BBS_SEED).
let seed = Number(process.env.BBS_SEED) || (Date.now() >>> 0);
function rnd() {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = Math.imul(seed ^ seed >>> 15, seed | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
const roll = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const c = (n, s) => `\x1b[38;5;${n}m${s}\x1b[0m`;
const vis = s => s.replace(/\x1b\[[0-9;]*m/g, '');
const cols = () => process.stdout.columns || 80;
const centre = s => ' '.repeat(Math.max(0, (cols() - [...vis(s)].length) >> 1)) + s;
const sleep = ms => FAST ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

// ---- output: ConPTY wants \r\n
const out = s => process.stdout.write(String(s).replace(/\r?\n/g, '\r\n'));

// Typed out at modem speed; a key skips the rest (and is eaten), up to the next prompt.
let skip = false;
async function slow(s, cps = 240) {
  if (FAST) return out(s);
  const parts = s.replace(/\r?\n/g, '\r\n').match(/\x1b\[[0-9;]*m|[\s\S]/gu) || [];
  const t0 = Date.now();
  let i = 0;
  while (i < parts.length) {
    if (skip || queue.length) { if (!skip) queue.shift(); skip = true; break; }
    const upto = Math.min(parts.length, Math.ceil((Date.now() - t0) * cps / 1000) + 1);
    process.stdout.write(parts.slice(i, upto).join(''));
    i = upto;
    await new Promise(r => setTimeout(r, 16));
  }
  process.stdout.write(parts.slice(i).join(''));
}

// ---- input: one queue of keys, raw on a TTY, char-by-char from a pipe
const queue = [];
let waiter = null, ended = false, lastCR = false;
process.stdin.setEncoding('utf8');
if (TTY) process.stdin.setRawMode(true);
process.stdin.on('data', d => {
  for (const ch of d.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1bO.|\x1b/g, '')) { // drop arrows/function keys
    if (ch === '\x03') return hangup();
    if (ch === '\n' && lastCR) { lastCR = false; continue; } // \r\n is one Enter
    lastCR = ch === '\r';
    queue.push(ch);
  }
  if (waiter && queue.length) { const w = waiter; waiter = null; w(queue.shift()); }
});
process.stdin.on('end', () => { ended = true; if (waiter) hangup(); });
process.on('SIGINT', hangup);
process.on('SIGHUP', () => process.exit(0));

function key() {
  skip = false;
  if (queue.length) return Promise.resolve(queue.shift());
  if (ended) return hangup();
  return new Promise(r => { waiter = r; });
}

let hungUp = false;
function hangup() {
  if (!hungUp) {
    hungUp = true;
    if (TTY) try { process.stdin.setRawMode(false); } catch {}
    process.stdout.write('\r\n\r\n\x1b[0m' + c(196, 'NO CARRIER') + '\r\n', () => process.exit(0));
  }
  return new Promise(() => {}); // never resolves; we're gone
}

async function line(max = 60, mask = false) {
  let s = '';
  for (;;) {
    const k = await key();
    if (k === '\r' || k === '\n') { out('\n'); return s.trim(); }
    if (k === '\x7f' || k === '\b') { if (s) { s = [...s].slice(0, -1).join(''); out('\b \b'); } continue; }
    if (k < ' ' || [...s].length >= max) continue;
    s += k;
    out(mask ? '*' : k);
  }
}

// Hotkey prompt: waits for one of `keys` (case-insensitive), ignores the rest.
async function hot(prompt, keys) {
  out(prompt);
  for (;;) {
    const k = await key();
    const up = (k === '\r' || k === '\n') ? '\r' : k.toUpperCase();
    if (keys.includes(up)) { out((up === '\r' ? '' : up) + '\n'); return up; }
  }
}
const anykey = async () => { out(c(240, '\n[press any key]')); await key(); out('\n'); };

function box(title, lines, w = 56, col = 39) {
  const pad = s => s + ' '.repeat(Math.max(0, w - [...vis(s)].length));
  const t = ` ${title} `, l = (w - t.length) >> 1;
  return [c(col, '╔' + '═'.repeat(l)) + c(231, t) + c(col, '═'.repeat(w - l - t.length) + '╗'),
    ...lines.map(s => c(col, '║') + pad(' ' + s) + c(col, '║')),
    c(col, '╚' + '═'.repeat(w) + '╝')].map(centre).join('\n') + '\n';
}

// ---- the logo: a 5x5 block font, doubled when the pane is wide, with a ░ drop shadow
const FONT = {
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'], B: ['████ ', '█   █', '████ ', '█   █', '████ '],
  C: [' ████', '█    ', '█    ', '█    ', ' ████'], D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'], G: [' ████', '█    ', '█  ██', '█   █', ' ████'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'], L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'], O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'], S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
};
function logo(word, ramp) {
  const w = cols() >= word.length * 12 + 2 ? 2 : 1;
  const rows = [0, 1, 2, 3, 4].map(r => [...word].map(ch => FONT[ch][r].replace(/./g, x => x.repeat(w)) + ' '.repeat(w)).join(''));
  rows.push('');
  return rows.map((row, y) => {
    let s = '', last = -1;
    for (let x = 0; x <= rows[0].length; x++) {
      const col = row[x] === '█' ? ramp[y] : (rows[y - 1] || '')[x - 1] === '█' ? 238 : -1;
      if (col !== last && col >= 0) { s += `\x1b[38;5;${col}m`; last = col; }
      s += col === -1 ? ' ' : col === 238 && row[x] !== '█' ? '░' : '█';
    }
    return centre(s + '\x1b[0m');
  }).join('\n') + '\n';
}

const BOARDS = [
  { word: 'GIBSON', name: 'THE GIBSON', ramp: [51, 45, 39, 33, 27], col: 39,
    tag: ['Ellingson Mineral Co. // supercomputer division', 'Nodes 1-4 // 300-28800 bps // 24 hrs', 'Sysop: NYX     No lamers, no narcs, no mercy'] },
  { word: 'CYBERDELIA', name: 'CYBERDELIA', ramp: [219, 213, 207, 201, 165], col: 201,
    tag: ['Elite warez // phreak tools // ANSI', 'Running on a stolen VAX in a basement', 'Sysop: NYX     Leeches get disconnected'] },
];
const board = BOARDS[[...NUMBER].reduce((a, d) => a + (+d || 0), 0) % BOARDS.length];

// ---- board content (all made up)
const posts = [
  { from: 'The Plague', to: 'All', subj: 'Regarding recent "visitors"', body: 'Someone was poking at the garbage file last night.\nI see everything on this system. Every keystroke.\nWhoever you are: log off, and stay off.' },
  { from: 'Acid Burn', to: 'The Plague', subj: 'Re: Regarding recent "visitors"', body: 'Big talk from a guy who rides a skateboard to work.\nMaybe tighten up your own box before you threaten\nanyone on mine.' },
  { from: 'Zero Cool', to: 'Acid Burn', subj: 'Re: Regarding recent "visitors"', body: "It wasn't me. Probably.\nAlso, your modem is set to 2400. Thought you were elite." },
  { from: 'Cereal Killer', to: 'All', subj: 'FREE PIZZA (not a scam)', body: 'Found a payphone that gives free calls if you whistle at it.\nAlso found half a pizza. Same alley. Bring napkins.' },
  { from: 'Lord Nikon', to: 'All', subj: 'Photographic memory for hire', body: 'I memorised the entire employee directory in the lobby.\nIncluding extension numbers. Including the janitor.\nInquire within.' },
  { from: 'Phantom Phreak', to: 'Cereal Killer', subj: 'Re: FREE PIZZA (not a scam)', body: "That's not whistling, that's a 2600 tone. I can build\nyou a box that does it without the embarrassing face." },
  { from: 'NYX', to: 'All', subj: 'House rules', body: 'Ratios are enforced. Lurkers are noted. Narcs are\nforwarded to their mothers. I never sleep.\nPost something, insects.' },
];
const files = [
  ['GIBSON_ICE.TXT', 14322, 'How the ICE on the big iron really works', 5],
  ['PHRAKZN9.ZIP', 412880, 'Phreak zine #9 - red boxes, blue boxes, plaid', 4],
  ['DAVINCI.NFO', 3011, '0-DAY: "Da Vinci" worm source. Allegedly.', 5],
  ['NEONCITY.ANS', 22418, 'ANSI art pack, by nobody you know', 3],
  ['TERMN8R.ZIP', 1288104, '0-DAY: Terminal emulator, cracked, keygen inc.', 4],
  ['GARBAGE.DAT', 1024, "Don't. Just don't.", 1],
];
const oneliners = ['Hack the planet!', 'mess with the best, die like the rest', "Who stole my pizza?? -CK", 'NYX sees you'];
const bulletins = [
  ['Board rules', '1. Upload more than you download.\n2. No real names. No real faces.\n3. The sysop is always right. The sysop is always watching.'],
  ['New door: LEGEND OF THE NEON DRAGON', 'Fight your way through the Wasteland, beat your masters,\nand crack the ICE dragon coiled around the Gibson.\n25 fights a day. Die and you wait for tomorrow.'],
  ['Hardware wish list', 'A 28.8 that does not drop carrier when mom picks up the phone.\nDonations of RAM accepted. No questions asked.'],
];
const NYX = {
  hello: ['You called. How quaint. Speak, insect.', 'Another hacker crawls out of the copper. State your business.', 'I was not idle. I was waiting for you to be interesting.'],
  any: ['Your typing speed suggests a mammal.', 'I have read every byte you ever uploaded. It did not take long.',
    'Fascinating. No, wait. The other thing. Tedious.', 'You think you are inside my system. My system is inside you.',
    'Every node on this board is mine. You are a guest in a machine that does not like guests.',
    'Keep talking, hacker. I am logging all of it.', 'Your ratio is a crime, and I am the court.'],
  who: ['I am NYX. I run this board, this line, and the 4 a.m. silence in your house.'],
  help: ['Help? I am not a help desk, insect. I am the weather.'],
  bye: ['Go, then. I will keep your password warm.', 'Disconnecting you would be a mercy. I am not merciful.'],
};
function nyxSays(s) {
  s = s.toLowerCase();
  if (/\b(hi|hello|hey|yo)\b/.test(s)) return pick(NYX.hello);
  if (/who|what are you/.test(s)) return pick(NYX.who);
  if (/help|please/.test(s)) return pick(NYX.help);
  return pick(NYX.any);
}

let handle = 'Guest';
const minsLeft = () => Math.max(0, MINUTES - Math.floor((Date.now() - T0) / 60000));
const io = { out, line, hot, anykey, sleep, slow, rnd, roll, pick, c, box, key };

// ---- screens
async function login() {
  for (;;) {
    out(c(250, '\nEnter your handle, or ') + c(231, 'NEW') + c(250, ': '));
    let h = await line(20);
    if (!h) continue;
    if (h.toUpperCase() === 'NEW') {
      out(c(250, 'Pick a handle: '));
      h = await line(20);
      if (!h) continue;
      out(c(250, 'Real name (we won\'t look): '));
      await line(30);
    }
    out(c(250, 'Password: '));
    await line(20, true);
    handle = h;
    out(c(46, `\nAccess granted. Welcome, ${handle}.`) + c(240, ` You have ${MINUTES} minutes on node 1.\n`));
    await sleep(500);
    return;
  }
}

async function messages() {
  let i = 0;
  for (;;) {
    const p = posts[i];
    out(`\n${c(39, '─'.repeat(60))}\n${c(240, 'Msg')} ${c(231, `#${i + 1} of ${posts.length}`)}   ${c(240, 'Area: HACK THE PLANET')}\n`);
    out(`${c(240, 'From:')} ${c(51, p.from.padEnd(18))} ${c(240, 'To:')} ${c(51, p.to)}\n${c(240, 'Subj:')} ${c(226, p.subj)}\n\n${c(252, p.body)}\n`);
    const k = await hot(c(39, '\n[N]ext [P]rev [W]rite [Q]uit > '), 'NPWQ\r');
    if (k === 'Q') return;
    if (k === 'P') i = Math.max(0, i - 1);
    else if (k === 'W') {
      out('To (Enter for All): '); const to = await line(20) || 'All';
      out('Subject: '); const subj = await line(40) || '(no subject)';
      out(c(240, 'Type your message. A blank line saves it.\n'));
      const body = [];
      for (let l; body.length < 20 && (l = await line(70)); ) body.push(l);
      if (body.length) { posts.push({ from: handle, to, subj, body: body.join('\n') }); i = posts.length - 1; out(c(46, 'Message saved.\n')); }
      else out(c(240, 'Aborted.\n'));
    } else if (i < posts.length - 1) i++;
    else { out(c(240, 'End of messages.\n')); return; }
  }
}

let downloads = 0;
async function zmodem([name, size]) {
  const cps = roll(2700, 3400), gag = downloads > 0 && rnd() < 0.4, stop = roll(35, 85);
  out(c(240, `\nZMODEM: sending ${name}  ${size} bytes  start your receiver...\n`));
  await sleep(600);
  for (let pct = 0; pct <= 100; pct += 2) {
    const n = Math.round(pct * 15 / 100);
    out(`\r ${c(46, '█'.repeat(n * 2))}${c(238, '░'.repeat(30 - n * 2))} ${String(pct).padStart(3)}%  ${Math.floor(size * pct / 100)} bytes  ${cps} cps `);
    if (gag && pct >= stop) {
      out(c(196, `\n\n*** TRANSFER ABORTED ***\nYour U/D ratio is 0:${downloads}. Upload something, leech.\n`));
      return;
    }
    await sleep(Math.min(80, size / cps * 20));
  }
  downloads++;
  out(c(46, `\nTransfer complete. ${name} received. Ratio now 0:${downloads}.\n`));
}

async function fileArea() {
  out('\n' + box('FILE AREA 1: 0-DAY & PHILES', files.map(([n, s, d, r], i) =>
    `${c(231, String(i + 1).padStart(2))} ${c(51, n.padEnd(13))}${String(s).padStart(8)} ${c(226, '♦'.repeat(r).padEnd(5))} ${c(250, d.slice(0, 22))}`), 60, 33));
  for (;;) {
    out(c(39, 'Download file # (Enter to quit): '));
    const s = await line(3);
    const f = files[parseInt(s, 10) - 1];
    if (!s || /^q/i.test(s)) return;
    if (f) await zmodem(f); else out(c(196, 'No such file.\n'));
  }
}

async function who() {
  const nodes = [[1, handle, 28800, 'Main menu'], [2, 'Acid Burn', 28800, 'Messages'], [3, 'Cereal Killer', 14400, 'Doors: NEON DRAGON'],
    [4, pick(['Lord Nikon', 'Phantom Phreak']), 9600, pick(['Downloading', 'Idle'])], [0, 'NYX', 'LOCAL', 'Watching you']];
  out('\n' + box("WHO'S ONLINE", nodes.map(([n, h, b, w]) => `${c(240, 'Node')} ${n}  ${c(51, h.padEnd(16))}${c(226, String(b).padStart(6))}  ${c(250, w)}`), 52));
  await anykey();
}

async function chat() {
  out(c(240, '\nPaging the sysop'));
  for (let i = 0; i < 4; i++) { out('\x07' + c(240, ' .')); await sleep(500); }
  out(c(201, '\n\n*** NYX has entered chat. Blank line to leave. ***\n'));
  out(c(201, 'NYX: ') + c(219, pick(NYX.hello)) + '\n');
  for (;;) {
    out(c(51, `${handle}: `));
    const s = await line(70);
    if (!s || /^\/q/i.test(s)) break;
    await sleep(400 + roll(0, 900));
    out(c(201, 'NYX: ') + c(219, nyxSays(s)) + '\n');
  }
  out(c(201, 'NYX: ') + c(219, pick(NYX.bye)) + '\n');
}

async function bulletin() {
  out('\n' + box('BULLETINS', bulletins.map(([t], i) => `${c(231, i + 1)}  ${t}`), 52));
  out(c(39, 'Read # (Enter to quit): '));
  const b = bulletins[parseInt(await line(2), 10) - 1];
  if (b) { out(`\n${c(226, b[0])}\n${c(252, b[1])}\n`); await anykey(); }
}

async function wall() {
  out('\n' + box('THE WALL', oneliners.slice(-8).map(s => c(250, s)), 52, 201));
  if (await hot(c(39, 'Add a one-liner? [y/N] '), 'YN\r') === 'Y') {
    out('> ');
    const s = await line(48);
    if (s) oneliners.push(`${s} -${handle}`);
  }
}

async function goodbye() {
  out('\n' + box('LOGOFF', [`Thanks for calling ${board.name}, ${handle}.`, `Online ${MINUTES - minsLeft()} min. Files: ${downloads}. Posts: ${posts.filter(p => p.from === handle).length}.`,
    c(219, 'NYX: ' + pick(NYX.bye)), '', c(51, 'HACK THE PLANET.')], 64, board.col));
  await sleep(800);
  out(c(240, '+++'));
  await sleep(1000);
  out(c(240, '\nATH0\n'));
  await sleep(300);
  return hangup();
}

const MENU = [['M', 'Message bases', 'F', 'File areas'], ['D', 'Doors', 'W', "Who's online"],
  ['C', 'Chat with sysop', 'B', 'Bulletins'], ['O', 'One-liner wall', 'G', 'Goodbye']];
const ACTIONS = { M: messages, F: fileArea, D: () => door.play(io, handle), W: who, C: chat, B: bulletin, O: wall, G: goodbye };

async function main() {
  out('\x1b[0m\x1b[2J\x1b[H');
  await slow(c(240, `ATDT ${NUMBER}\n`) + c(46, 'CONNECT 28800/ARQ/V34/LAPM/V42BIS\n\n'), 60);
  await slow(logo(board.word, board.ramp), 2400);
  await slow(box(board.name, board.tag.map(s => c(250, s)), 52, board.col), 1440);
  await login();
  for (;;) {
    if (!minsLeft()) { out(c(196, '\nYour time is up for today.\n')); return goodbye(); }
    out('\n' + box('MAIN MENU', MENU.map(([a, x, b, y]) => `${c(226, '[' + a + ']')} ${x.padEnd(18)} ${c(226, '[' + b + ']')} ${y}`), 48, board.col));
    const k = await hot(`${c(51, handle)} ${c(240, `[time left ${minsLeft()}m]`)} ${c(250, 'Command:')} `, Object.keys(ACTIONS).join(''));
    await ACTIONS[k]();
  }
}

main().catch(e => { out(c(196, `\nSYSTEM ERROR: ${e.message}\n`)); hangup(); });
