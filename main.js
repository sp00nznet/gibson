// GIBSON main process: owns the shell (node-pty), the config file, and every
// LLM call, so API keys never reach the renderer. Design: docs/architecture.md.
const { app, BrowserWindow, ipcMain, shell, Menu, dialog, protocol, net, globalShortcut, screen, safeStorage, clipboard } = require('electron');
const sync = require('./sync');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pty = require('node-pty');
const { execFile, execFileSync } = require('child_process');
const { llmLine, DEFAULT_MODEL, DEFAULT_BASE } = require('./llm');
const agent = require('./agent');
const local = require('./local');
const sys = require('./sysinfo');
const Keys = require('./renderer/keys');
const ssh = require('./ssh');
const { createIrc, defaultNick } = require('./irc');

// One config folder for source runs and packaged builds (whose app name is GIBSON).
app.setPath('userData', path.join(app.getPath('appData'), 'gibson'));
if (process.platform === 'win32') app.setAppUserModelId('net.sp00nz.gibson'); // toast notifications need it

const argv = process.argv.slice(1);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SHOT = arg('--shot');            // headless: render offscreen, save a PNG, quit
const SHOT_AT = Number(arg('--at') || 9);
const WORLD = arg('--world');          // force a starting world (screenshots)
const MUTE = argv.includes('--mute');
const PANES = Number(arg('--panes') || 1); // start with 1-16 panes (an even grid)
const UNFRAMED = argv.includes('--unframed');
const TABS = Number(arg('--tabs') || 1); // start with this many tabs (screenshots)
const CHAT = arg('--chat');
const IRC = argv.includes('--irc');       // shots: open the IRC lobby
const CMD = arg('--cmd');
const DETACH = argv.includes('--detach'); // shots: tear the second tab off into its own window
const REJOIN = argv.includes('--rejoin'); // shots: ...then drop it back into the main window                 // shots: type this GIBSON command (e.g. "dial 555-0199")
const MUSIC = arg('--music');              // play this folder (the jukebox) instead of the synth                // shots: say this to NYX

const DEFAULTS = {
  shell: process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash'),
  shellArgs: process.platform === 'win32' ? ['-NoLogo'] : [],
  defaultShell: '',           // a profile name ('PowerShell', 'WSL', ...); blank = shell above
  profiles: [],               // extra shells: { name, shell, args, cwd }. Installed ones are found on their own
  startupTabs: [],            // { profile, cwd, panes }: the tabs to open on start (right-click > Tabs > Save)
  world: '',                  // the world to start in; blank = NYX decides
  nyxWorlds: true,            // false: NYX never changes the world, only you do
  cigarette: true,            // the cigarette that burns while you compile
  splitHere: true,            // new panes and tabs open in the focused pane's folder (false: home)
  pasteGuard: true,           // ask before pasting more than one line into a shell
  notifyAfterSec: 10,         // a command that ran this long tells you when it finishes (0: never)
  editor: '',                 // opens clicked file:line links, e.g. "code -g {file}:{line}:{col}". Blank: VS Code if found, else the system
  quake: { key: 'Alt+`', dock: false }, // a global key that summons/hides GIBSON; dock: drop down from the top. key '' turns it off
  fontFamily: "'Cascadia Mono', Consolas, 'Courier New', monospace",
  fontSize: 15,
  framed: true,               // false: the terminal fills the window, the scene shows through
  scroller: true,             // the sine scroller along the bottom
  logo: true,                 // the GIBSON logo bar along the top
  packets: true,              // the data packets streaming in from the sides
  news: {                     // NEWSWIRE: headlines NYX can comment on. feeds: [] turns it off
    feeds: ['https://hnrss.org/frontpage', 'https://www.theregister.com/security/headlines.atom'],
    minutes: 15,
  },
  irc: {                      // the lobby beside the terminal: fake (a simulated #hackers) | real | off
    mode: 'fake', server: 'irc.libera.chat', port: 6697, tls: true,
    nick: '',                 // real mode: blank = a made-up gibsonNNN, saved here on first connect
    channels: ['#gibson'], password: '',
  },
  ircOpen: false,             // the lobby open on start (ctrl+shift+I)
  hackerCommands: true,       // dial, wardial, nfo, scan, cookie are GIBSON's (false: they go to the shell)
  eggs: true,                 // now and then a surprise (the cookie monster). false: never
  opacity: 0.86,              // terminal background: 1 solid, 0 see the world straight through
  boot: true,                 // the modem dial-in on startup
  music: { on: true, mode: 'reactive', bpm: 128, volume: 0.55, source: 'synth', folder: '', shuffle: true }, // source: synth | folder
  nyx: { on: true, voice: false, chatter: 0.35, leet: false },
  llm: {
    provider: 'local',        // local (built-in, right-click > NYX > Built-in model) | anthropic (Claude) | ollama | openai (any OpenAI-compatible server) | none
    models: {},               // per brain, e.g. { "local": "qwen3-1.7b", "ollama": "qwen2.5-coder:7b" }; blank = its default
    urls: {},                 // per brain, e.g. { "ollama": "http://192.168.1.20:11434", "openai": "http://127.0.0.1:8080" }
    apiKey: '',               // better: right-click > NYX > API key (kept encrypted), or ANTHROPIC_API_KEY / OPENAI_API_KEY
    shareOutput: false,       // send the last bit of terminal output with each event
    minGapSec: 20,
  },
};

function loadConfig() {
  const file = path.join(app.getPath('userData'), 'config.json');
  let user = {};
  try { user = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2)); }
  const cfg = { ...DEFAULTS, ...user };
  for (const k of ['music', 'nyx', 'llm', 'news', 'irc', 'quake']) cfg[k] = { ...DEFAULTS[k], ...(user[k] || {}) };
  cfg.file = file;
  return cfg;
}

let win, cfg, home = os.homedir(), irc = null; // irc: the real-mode client, once the lobby dials
// Remember one setting in config.json (and for this session). Shots never touch the user's config.
function writeCfg(key, v) {
  cfg[key] = key === 'music' ? { ...cfg.music, ...v } : v;
  if (SHOT) return;
  try { const u = JSON.parse(fs.readFileSync(cfg.file, 'utf8')); u[key] = v; fs.writeFileSync(cfg.file, JSON.stringify(u, null, 2)); } catch { /* config unreadable: keep it for this session */ }
}
// Last session's tabs (right-click > Tabs > Restore last session): each a pane tree whose leaves
// are { profile, cwd, text }, text being the tail of that pane's scrollback.
const sessionFile = () => path.join(app.getPath('userData'), 'session.json');
function readSession() { try { const s = JSON.parse(fs.readFileSync(sessionFile(), 'utf8')); return Array.isArray(s) ? s : null; } catch { return null; } }
const panes = new Map(); // pane id -> { term, cwd }

// Screenshots must not show the real machine: no home folder, no username, no hostname.
// Shot mode runs every shell in a made-up folder behind a fixed prompt.
const DEMO = {
  dirs: ['garbage', 'kernel', 'payroll', 'da-vinci', 'ellingson', 'phreak', 'warez', 'plague', 'cookie-monster', 'zero-day'],
  files: [['GARBAGE.DAT', 48000], ['worm.c', 9100], ['readme.nfo', 2600], ['gibson.cfg', 700], ['crash.override', 1200],
    ['acid.burn', 3300], ['cereal.killer', 900], ['hack-the-planet.txt', 400], ['rabbit.exe', 22000], ['phonebook.db', 15000]],
};
function demoHome() {
  const dir = path.join(os.tmpdir(), 'gibson-demo');
  for (const d of DEMO.dirs) fs.mkdirSync(path.join(dir, d), { recursive: true });
  for (const [f, n] of DEMO.files) fs.writeFileSync(path.join(dir, f), Buffer.alloc(n, 0x2e));
  return dir;
}
// Made-up live data for shot mode.
const DEMO_NET = () => [['198.51.100.7', 443], ['203.0.113.42', 22], ['192.0.2.80', 443], ['198.51.100.23', 6697], ['203.0.113.9', 993],
  ['192.0.2.14', 80], ['198.51.100.99', 443], ['203.0.113.77', 5228], ['192.0.2.200', 9418]].map(([ip, port]) => ({ ip, port, service: sys.SERVICES[port] || `port ${port}` }));
const DEMO_PROCS = () => ['gibson', 'zerocool', 'acidburn', 'plague-daemon', 'da-vinci', 'kernel-sentry', 'ellingson-sync', 'phreak', 'cereal', 'nikon', 'garbage-collector', 'modem', 'bbs-door']
  .map((name, i) => ({ name, cpu: i === 4 ? 92 : Math.random() * 12, mem: (14 - i) * 40e6 + Math.random() * 20e6, n: 1 + (i % 3) }));
const DEMO_STATS = () => ({ cpu: 30 + Math.random() * 40, cores: 16, mem: { total: 32e9, free: 11e9 }, disks: [{ name: 'C:', total: 1e12, free: 3.1e11 }, { name: 'D:', total: 4e12, free: 2.6e12 }], net: { rx: Math.random() * 3e6, tx: Math.random() * 4e5 }, up: 412345 });
const DEMO_NEWS = () => ['Gibson mainframe breached by unknown worm', 'Da Vinci virus threatens oil tankers, experts say', 'Ellingson Mineral denies garbage file exists',
  'Hackers urged to stop hacking the planet', 'Phone phreaks return as modems make a comeback', 'Zero Cool banned from computers until 18th birthday']
  .map((title) => ({ title, link: '', source: 'GIBSON WIRE' }));

// The jukebox's tracks: audio files under the chosen folder, three levels deep at most.
const AUDIO = /\.(mp3|ogg|oga|opus|wav|flac|m4a|aac|webm|mod|xm|s3m|it|mptm|stm|669|med|mtm|okt|far|ult|dbm|dmf|psm|ptm|amf|mo3|umx)$/i; // tracker modules play through libopenmpt
function listMusic(dir) {
  const out = [];
  const walk = (d, rel, depth) => {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length >= 5000) return;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory() && depth < 3) walk(path.join(d, e.name), r, depth + 1);
      else if (e.isFile() && AUDIO.test(e.name)) out.push(r);
    }
  };
  if (dir) walk(dir, '', 0);
  return { folder: dir, tracks: out.sort() };
}

function demoShell(c) {
  if (process.platform === 'win32') return { ...c, shellArgs: ['-NoLogo', '-NoProfile', '-NoExit', '-Command', "function prompt { 'PS C:\\GIBSON> ' }"] };
  return { ...c, shell: 'bash', shellArgs: ['--norc', '--noprofile'] };
}

// Shell profiles: the ones installed here, plus any in config.json (same name replaces).
function onPath(exe) {
  return (process.env.PATH || '').split(path.delimiter).some((d) => { try { return d && fs.statSync(path.join(d, exe)).isFile(); } catch { return false; } });
}
const exists = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
function detectShells() {
  const out = [];
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    out.push({ name: 'PowerShell', shell: 'powershell.exe', args: ['-NoLogo'] });
    const pwsh = onPath('pwsh.exe') ? 'pwsh.exe' : path.join(pf, 'PowerShell', '7', 'pwsh.exe');
    if (pwsh === 'pwsh.exe' || exists(pwsh)) out.push({ name: 'PowerShell 7', shell: pwsh, args: ['-NoLogo'] });
    out.push({ name: 'Command Prompt', shell: 'cmd.exe', args: [] });
    if (onPath('wsl.exe')) {
      try { out.push(...sys.wslDistros(execFileSync('wsl.exe', ['-l', '-q'], { timeout: 4000, windowsHide: true }).toString('utf16le'))); }
      catch { out.push({ name: 'WSL', shell: 'wsl.exe', args: [] }); } // no list: the default distro
    }
    const gitBash = path.join(pf, 'Git', 'bin', 'bash.exe');
    if (exists(gitBash)) out.push({ name: 'Git Bash', shell: gitBash, args: ['--login', '-i'] });
  } else {
    let list = ''; try { list = fs.readFileSync('/etc/shells', 'utf8'); } catch { /* no list */ }
    out.push(...sys.unixShells(list, process.env.SHELL, process.platform === 'darwin', exists));
  }
  return out;
}
let profiles = [];
const findProfile = (name) => profiles.find((p) => p.name === name) || sshFind(name);
const sshFind = (name) => { const h = /^ssh:(.+)$/.exec(name || '') && ssh.sshHosts(cfg.sshHosts).find((x) => x.name === name.slice(4)); return h ? ssh.sshProfile(h) : null; };
// The default: defaultShell by name, else the profile running the legacy `shell` setting.
function defaultProfile() {
  return findProfile(cfg.defaultShell) || profiles.find((p) => path.basename(p.shell).toLowerCase() === path.basename(cfg.shell).toLowerCase())
    || { name: path.basename(cfg.shell), shell: cfg.shell, args: cfg.shellArgs };
}
const isDir = (d) => { try { return !!d && fs.statSync(d).isDirectory(); } catch { return false; } };

// A program on plain pipes, shaped like a node-pty terminal. For the BBS: on Windows electron.exe is
// a GUI program, so under ConPTY its output goes nowhere; over pipes it works on every system.
function piped(prof, cwd) {
  const child = require('child_process').spawn(prof.shell, prof.args, { cwd, env: { ...process.env, ...prof.env }, stdio: 'pipe', windowsHide: true });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  return {
    write: (d) => { try { child.stdin.write(d); } catch { /* gone */ } },
    resize() {}, kill: () => child.kill(),
    onData: (fn) => { child.stdout.on('data', fn); child.stderr.on('data', fn); },
    onExit: (fn) => child.on('exit', fn),
  };
}
const BBS = path.join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'), 'bbs', 'bbs.js');
// Shell integration: each shell starts with a small script (shell/) that marks every prompt,
// command and exit code (OSC 133) and says its folder (OSC 7, or 9;9). The user's own profile
// still runs first. PowerShell gets it as -EncodedCommand, which no execution policy blocks.
// WSL and custom bash/PowerShell command lines are left as they are.
const SHELL_DIR = path.join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'), 'shell');
function integrate(prof) {
  if (cfg.shellint === false || prof.pipes) return prof;
  const exe = path.basename(prof.shell || '').toLowerCase().replace(/\.exe$/, ''), args = (prof.args || []).slice(), env = { ...(prof.env || {}) };
  try {
    if (exe === 'powershell' || exe === 'pwsh') {
      if (args.some((a) => /^-(f|file|e|ec|encodedcommand)$/i.test(a))) return prof;
      let script = fs.readFileSync(path.join(SHELL_DIR, 'gibson.ps1'), 'utf8');
      const i = args.findIndex((a) => /^-c(ommand)?$/i.test(a));
      if (i >= 0) { script = `${args[i + 1]}\n${script}`; args.splice(i, 2); } // the screenshots' made-up prompt, then ours
      if (!args.some((a) => /^-noexit$/i.test(a))) args.push('-NoExit');
      args.push('-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'));
    } else if (exe === 'cmd') {
      if (args.length) return prof;
      env.PROMPT = `$e]133;D$e\\$e]9;9;$P$e\\$e]133;A$e\\${env.PROMPT || process.env.PROMPT || '$P$G'}$e]133;B$e\\`; // cmd can't say an exit code
    } else if (exe === 'bash') {
      if (args.some((a) => !['-l', '--login', '-i'].includes(a))) return prof;
      if (args.some((a) => a === '-l' || a === '--login')) env.GIBSON_LOGIN = '1'; // a login shell ignores --rcfile, so ours runs the login files
      args.splice(0, args.length, '--rcfile', path.join(SHELL_DIR, 'gibson.bash').replace(/\\/g, '/'), '-i');
    } else if (exe === 'zsh') {
      env.GIBSON_ZDOTDIR = process.env.ZDOTDIR || os.homedir(); env.ZDOTDIR = path.join(SHELL_DIR, 'zsh');
    } else return prof;
  } catch { return prof; }
  return { ...prof, args, env };
}
// A pane's output goes to whichever window holds it now (pane.wc), and the last stretch of it is
// kept (pane.buf) so a tab torn off into a new window comes up showing what it showed before.
function spawnShell(id, opts, wc) {
  let pane = panes.get(id);
  if (!pane && opts && opts.bbs) { // `dial <number>`: the BBS, once; hanging up ends it
    const number = String(opts.bbs).replace(/[^\d\-+*#() ]/g, '').slice(0, 20) || '555-0199';
    pane = { wc, wcId: wc && wc.id, buf: '', cwd: home, prof: { name: 'BBS', shell: process.execPath, args: [BBS, number], env: { ELECTRON_RUN_AS_NODE: '1', BBS_TTY: '1', BBS_COLS: '80' }, once: true, pipes: true } };
    panes.set(id, pane);
  }
  if (!pane) {
    const prof = (!SHOT && findProfile(opts && opts.profile)) || defaultProfile();
    const from = opts && opts.from && cfg.splitHere !== false && panes.get(opts.from); // split from here
    const cwd = [opts && opts.cwd, from && from.cwd, prof.cwd].find(isDir) || home;
    pane = { wc, wcId: wc && wc.id, buf: '', cwd, prof: SHOT ? { shell: cfg.shell, args: cfg.shellArgs } : prof };
    panes.set(id, pane);
  }
  const send = (d) => {
    pane.buf += d; if (pane.buf.length > 400000) pane.buf = pane.buf.slice(-200000);
    if (pane.wc && !pane.wc.isDestroyed()) pane.wc.send('pty:data', id, d);
  };
  let term;
  try {
    const run = integrate(pane.prof);
    if (pane.prof.pipes) term = pane.term = piped(pane.prof, pane.cwd); else term = pane.term = pty.spawn(run.shell, run.args || [], {
      name: 'xterm-256color', cols: 100, rows: 30, cwd: pane.cwd,
      env: { ...process.env, TERM_PROGRAM: 'GIBSON', ...(SHOT ? { PS1: 'hacker@gibson:~$ ' } : {}), ...(run.env || {}) },
    });
  } catch (e) { // a profile pointing at a shell that is not there
    send(`\x1b[31m-- cannot start ${pane.prof.shell}: ${e.message} --\x1b[0m\r\n`);
    const d = defaultProfile(); if (pane.prof.shell === d.shell) return;
    pane.prof = d; return spawnShell(id);
  }
  const born = Date.now();
  term.onData(send);
  term.onExit(() => {
    if (pane.closed || pane.term !== term) return; // closed on purpose
    if (pane.prof.once) return send('\r\n\x1b[35m-- line dropped. Close this tab (ctrl+shift+X) or dial again. --\x1b[0m\r\n'); // the BBS says its own NO CARRIER
    send('\r\n\x1b[35m-- NO CARRIER --\x1b[0m\r\n');
    if (Date.now() - born < 2000) return send('\x1b[35m-- the shell quit right away, so no redial. Close this tab or pick another shell. --\x1b[0m\r\n');
    spawnShell(id);
  });
}
function killShell(id) {
  const pane = panes.get(id); if (!pane) return;
  pane.closed = true; panes.delete(id);
  try { pane.term.kill(); } catch { /* already gone */ }
}

// ponytail: cwd is tracked by parsing `cd` lines, not asked of the shell.
// Misses pushd/aliases/scripts; upgrade path is an OSC 7 prompt hook per shell.
function trackCd(pane, line) {
  const m = /^\s*(?:cd|chdir|set-location|sl)\s+(.+?)\s*$/i.exec(line);
  if (!m) return;
  const target = m[1].replace(/^\/d\s+/i, '').replace(/^["']|["']$/g, '').replace(/^~/, os.homedir());
  const next = path.resolve(pane.cwd, target);
  try { if (fs.statSync(next).isDirectory()) pane.cwd = next; } catch { /* bad cd, shell will say so */ }
}

// The GIT GALAXY world: the last 150 commits on every branch, newest first. null when the
// folder is not a repository or git is not installed; the world then shows a made-up history.
function gitLog(dir) {
  return new Promise((resolve) => {
    execFile('git', ['log', '--all', '--topo-order', '-n', '150', '--format=%h%x1f%p%x1f%s%x1f%D'], { cwd: dir, timeout: 4000, windowsHide: true }, (err, out) => {
      if (err || !out) return resolve(null);
      const commits = out.trim().split('\n').map((l) => { const [h, p, s, refs] = l.split('\x1f'); return { h, p: p ? p.split(' ') : [], s: s || '', refs: refs || '' }; });
      resolve({ cwd: SHOT ? 'C:\\GIBSON' : dir, commits });
    });
  });
}

// Open a clicked file:line. cfg.editor is a command with {file} {line} {col}; blank means VS Code
// when it is installed, else the system's own handler. Programs and scripts are never run from a
// click: without an editor they are shown in their folder instead.
const RUNNABLE = /\.(exe|com|bat|cmd|ps1|psm1|vbs|vbe|js|jse|wsf|msi|msc|lnk|scr|reg|sh|command|app|jar|py)$/i;
function openInEditor(file, line, col) {
  const tmpl = cfg.editor || (onPath(process.platform === 'win32' ? 'code.cmd' : 'code') ? 'code -g {file}:{line}:{col}' : '');
  if (!tmpl) return RUNNABLE.test(file) ? shell.showItemInFolder(file) : shell.openPath(file);
  const win32 = process.platform === 'win32';
  const args = tmpl.split(/\s+/).filter(Boolean).map((a) => a.replace('{file}', file).replace('{line}', line).replace('{col}', col));
  const quote = (a) => (win32 && /[\s&()^]/.test(a) ? `"${a}"` : a); // cmd.exe runs .cmd shims like code.cmd
  try { require('child_process').spawn(quote(args[0]), args.slice(1).map(quote), { shell: win32, detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch { shell.openPath(file); }
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).slice(0, 160).map((e) => {
      let size = 0;
      try { size = e.isDirectory() ? 0 : fs.statSync(path.join(dir, e.name)).size; } catch { /* locked file */ }
      return { name: e.name, dir: e.isDirectory(), size };
    });
  } catch { return []; }
}

// The keymap (renderer/keys.js): defaults merged with config.json's "keys". Built at startup.
let keymap = {};
const accel = (a) => Keys.keyOf(keymap, a) || undefined; // for menus: the action's first key
const TAB_COLOURS = [['None', ''], ['Pink', '#ff2e88'], ['Green', '#39ff9c'], ['Ice', '#36d6ff'], ['Gold', '#ffc448'], ['Violet', '#a860ff'], ['Red', '#ff3864']];

// New tab with a given shell: one item per profile.
const shellItems = (act) => {
  const hosts = SHOT ? [] : ssh.sshHosts(cfg.sshHosts);
  return [...profiles.map((p) => ({ label: p.name + (p.name === defaultProfile().name ? '  (default)' : ''), click: act('newtab:' + p.name) })),
    ...(hosts.length ? [{ type: 'separator' }, ...hosts.map((h) => ({ label: 'SSH: ' + h.name, click: act('newtab:ssh:' + h.name) }))] : [])];
};

// Right-click menu. The page sends its current state; clicks come back as hotkey actions.
// GitHub settings sync (sync.js). The token is kept encrypted by the OS (safeStorage), never in
// config.json, so it is never uploaded with the settings.
const syncFile = () => path.join(app.getPath('userData'), 'github-sync.bin');
function syncState() { try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(syncFile()))); } catch { return null; } }
function syncSave(s) { if (s) fs.writeFileSync(syncFile(), safeStorage.encryptString(JSON.stringify(s))); else fs.rmSync(syncFile(), { force: true }); }
const tell = (message, type) => dialog.showMessageBox(win, { type: type || 'info', title: 'GIBSON // GitHub sync', message });
async function syncDo(what) {
  try {
    if (what === 'token') {
      const token = clipboard.readText().trim();
      if (!sync.looksLikeToken(token)) return tell('Copy the token GitHub showed you (it starts with ghp_ or github_pat_), then pick this again.', 'warning');
      if (!safeStorage.isEncryptionAvailable()) return tell('This system has no secure storage to keep the token in, so GIBSON will not save it.', 'warning');
      const login = await sync.whoami(token);
      syncSave({ token, login, gist: null });
      if (clipboard.readText().trim() === token) clipboard.clear(); // don't leave it lying around
      return tell(`Signed in to GitHub as ${login}. Upload your settings from this machine, or download them on another.`);
    }
    const s = syncState(); if (!s) return;
    if (what === 'forget') { syncSave(null); return tell('Token forgotten. Revoke it on GitHub too if you are done with it: Settings > Developer settings > Tokens.'); }
    const local = JSON.parse(fs.readFileSync(cfg.file, 'utf8'));
    if (what === 'up') { s.gist = await sync.push(s.token, s.gist, local); syncSave(s); return tell(`Settings uploaded to a secret gist on ${s.login}'s GitHub. Your API key and IRC password stayed here.`); }
    const got = await sync.pull(s.token, s.gist);
    if (!got) return tell('Nothing uploaded yet. Upload from the machine whose settings you want first.', 'warning');
    s.gist = got.id; syncSave(s);
    fs.writeFileSync(cfg.file, JSON.stringify(sync.merge(got.cfg, local), null, 2));
    const r = await dialog.showMessageBox(win, { type: 'question', title: 'GIBSON // GitHub sync', message: 'Settings downloaded. Restart GIBSON to use them?', buttons: ['Restart now', 'Later'] });
    if (r.response === 0) { app.relaunch(); app.exit(0); }
  } catch (e) { tell(String(e.message || e), 'error'); }
}
function syncMenu() {
  const s = syncState();
  return { label: 'Sync settings to GitHub', submenu: [
    { label: s ? `Signed in as ${s.login}` : 'Not signed in', enabled: false },
    { label: '1. Make a token on GitHub (gist only)...', click: () => shell.openExternal(sync.TOKEN_URL) },
    { label: '2. Copy it, then click here to use it', click: () => syncDo('token') },
    { type: 'separator' },
    { label: 'Upload settings', enabled: !!s, click: () => syncDo('up') },
    { label: 'Download settings', enabled: !!s, click: () => syncDo('down') },
    { label: 'Forget the token', enabled: !!s, click: () => syncDo('forget') },
  ] };
}

// NYX's brain. API keys live encrypted by the OS (safeStorage) in llm-key.bin, never in config.json.
const keyFile = () => path.join(app.getPath('userData'), 'llm-key.bin');
function keys() { try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(keyFile()))); } catch { return {}; } }
// Each brain keeps its own server and model (llm.urls / llm.models); the older single
// llm.model / llm.baseUrl still apply to whichever brain is picked when those are blank.
function brain() {
  const c = cfg.llm, p = c.provider, u = (c.urls || {})[p], m = (c.models || {})[p];
  const base = (u || c.baseUrl || DEFAULT_BASE[p] || '').replace(/\/$/, '');
  let model = p === 'local' ? m || local.DEFAULT : m || c.model || (p === 'openai' && base !== DEFAULT_BASE.openai && serverModels.openai[0]) || DEFAULT_MODEL[p];
  return { ...c, model, base, apiKey: c.apiKey || keys()[p] };
}
// Change llm settings: this session, config.json, and every window's copy (which has no key).
function llmSet(patch) {
  cfg.llm = { ...cfg.llm, ...patch };
  if (!SHOT) { try { const u = JSON.parse(fs.readFileSync(cfg.file, 'utf8')); u.llm = { ...(u.llm || {}), ...patch }; fs.writeFileSync(cfg.file, JSON.stringify(u, null, 2)); } catch { /* keep it for this session */ } }
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('llm', { ...cfg.llm, apiKey: undefined });
  refreshModels();
}
// Point a brain at a server and/or model, and switch to it. Clears the old shared fields.
const useBrain = (p, { url, model } = {}) => llmSet({
  provider: p, model: '', baseUrl: '',
  ...(url !== undefined ? { urls: { ...(cfg.llm.urls || {}), [p]: url } } : {}),
  ...(model !== undefined ? { models: { ...(cfg.llm.models || {}), [p]: model } } : {}),
});
// What the Ollama and OpenAI-compatible servers have, for the menu (which can't wait on the network).
const serverModels = { ollama: [], openai: [] };
function refreshModels() {
  for (const p of ['ollama', 'openai']) {
    const base = ((cfg.llm.urls || {})[p] || (cfg.llm.provider === p && cfg.llm.baseUrl) || DEFAULT_BASE[p]).replace(/\/$/, '');
    if (p === 'openai' && base === DEFAULT_BASE.openai) { serverModels.openai = []; continue; } // OpenAI's own list is hundreds long
    fetch(base + (p === 'ollama' ? '/api/tags' : '/v1/models'), { signal: AbortSignal.timeout(3000) }).then((r) => r.json())
      .then((j) => { serverModels[p] = (p === 'ollama' ? (j.models || []).map((x) => x.name) : (j.data || []).map((x) => x.id)).sort(); })
      .catch(() => { serverModels[p] = []; });
  }
}

// The built-in brain's models: downloaded on request, with the size and RAM spelled out first.
let dlPct = -1;
async function getModel(m) {
  if (local.have(m)) return useBrain('local', { model: m.id });
  if (local.downloading()) return tell(`Already downloading ${local.downloading().name}. One at a time.`, 'warning');
  const r = await dialog.showMessageBox(win, {
    type: 'question', title: 'GIBSON // download a brain for NYX', noLink: true, buttons: [`Download ${m.gb} GB`, 'Cancel'], defaultId: 0, cancelId: 1,
    message: `Download ${m.name} (${m.gb} GB)?`,
    detail: `It comes from Hugging Face (${m.repo}) and is saved in\n${local.dirOf()}\n\nIt runs on this machine: nothing you ask her leaves it. It wants about ${m.ram} GB of free memory, and a GPU makes it much faster. ${m.note[0].toUpperCase() + m.note.slice(1)}.\n\nRight-click > NYX > Built-in model can delete it again.`,
  });
  if (r.response !== 0) return;
  const all = () => BrowserWindow.getAllWindows();
  const say = (text, mood) => { for (const w of all()) w.webContents.send('nyx:say', text, mood); };
  say(`Downloading ${m.name}. ${m.gb} GB of brain, coming right up.`, 'curious');
  dlPct = 0;
  try {
    await local.download(m, (f) => {
      const pct = Math.floor(f * 100); if (pct === dlPct) return; dlPct = pct;
      for (const w of all()) w.setProgressBar(f);
      if (pct % 25 === 0 && pct > 0 && pct < 100) say(`${m.name}: ${pct}%`, 'intense');
    });
    useBrain('local', { model: m.id });
    say(`${m.name} is in. Ask me something: nyx <message>.`, 'impressed');
  } catch (e) {
    if (!/abort|cancel/i.test(String(e.message))) tell(`The download failed: ${e.message}`, 'error'); else say('Download cancelled.', 'bored');
  } finally { dlPct = -1; for (const w of all()) w.setProgressBar(-1); }
}
async function deleteModels() {
  const r = await dialog.showMessageBox(win, { type: 'warning', title: 'GIBSON // NYX', noLink: true, buttons: ['Delete', 'Cancel'], defaultId: 1, cancelId: 1,
    message: `Delete the downloaded models (${local.diskGb().toFixed(1)} GB)?`, detail: local.dirOf() });
  if (r.response !== 0) return;
  fs.rmSync(local.dirOf(), { recursive: true, force: true });
  tell('Models deleted. Restart GIBSON if NYX had one loaded, to free its memory too.');
}
async function keyFromClipboard() {
  const k = clipboard.readText().trim(), p = /^sk-ant-/.test(k) ? 'anthropic' : /^sk-/.test(k) ? 'openai' : null;
  const say = (message, type) => dialog.showMessageBox(win, { type: type || 'info', title: 'GIBSON // NYX', message });
  if (!p) return say('Copy your API key first (a Claude key starts with sk-ant-, an OpenAI one with sk-), then pick this again.', 'warning');
  if (!safeStorage.isEncryptionAvailable()) return say('This system has no secure storage to keep the key in, so GIBSON will not save it.', 'warning');
  fs.writeFileSync(keyFile(), safeStorage.encryptString(JSON.stringify({ ...keys(), [p]: k })));
  if (clipboard.readText().trim() === k) clipboard.clear();
  useBrain(p);
  say(`${p === 'anthropic' ? 'Claude' : 'OpenAI'} key saved (encrypted) and NYX switched over to it.`);
}

// World menu sections. A world not listed here lands under Other.
const WORLD_GROUPS = [
  ['Cyberspace', ['grid', 'tunnel', 'core', 'ice', 'git', 'files', 'garbage', 'bbs', 'hack', 'datacenter', 'usenet']],
  ['Cities', ['city', 'skyline', 'cyberpunk', 'ruins', 'street', 'towers', 'highway']],
  ['Out there', ['sky', 'planet', 'battle', 'sea']],
  ['Sci-fi', ['outatime', 'starfighter', 'wopr', 'spinner', 'navigator', 'explorers', 'headroom', 'arrakis', 'tracker', 'real']],
  ['Scene', ['defrag', 'seti', 'sneakers', 'demoparty', 'ansi', 'wardialer', 'y2k', 'messenger', 'geocities', 'defcon']],
  ['Old tech', ['radio', 'switchboard', 'telegraph', 'mission', 'pneumatic', 'mainframe', 'videostore', 'arcade', 'pirateradio', 'numbers']],
  ['Anime', ['akira', 'thermoptic', 'cyberbrain', 'spidertank', 'macross', 'bebop', 'eva', 'hardsuit', 'labor', 'gundam', 'wired', 'yamato', 'valkyrie']],
  ['Arcade', ['battlezone', 'cycles', 'deathmatch', 'endless', 'antigrav', 'tube', 'trench', 'trader', 'rocks', 'lander', 'stunt']],
  ['Visualizers', ['rave', 'milkdrop', 'kaleido', 'starburst', 'attractor', 'helix', 'life']],
  ['Screensavers', ['toasters', 'mystify', 'pipes', 'maze', 'flowerbox', 'fringe', 'nocturne', 'keygen']],
  ['Your machine', ['net', 'hive', 'news', 'newsglobe', 'traffic']],
];
function worldMenu(st, act) {
  const radio = ([key, label]) => ({ label: key === cfg.world ? label + '  (start)' : label, type: 'radio', checked: key === st.world, click: act('world:' + key) });
  const known = new Set(WORLD_GROUPS.flatMap((g) => g[1])), have = new Map(st.worlds);
  const groups = [...WORLD_GROUPS, ['Other', st.worlds.map((w) => w[0]).filter((k) => !known.has(k))]]
    .map(([name, ks]) => [name, ks.filter((k) => have.has(k)).map((k) => [k, have.get(k)])]).filter((g) => g[1].length);
  return [
    ...groups.map(([name, ws]) => ({ label: ws.some((w) => w[0] === st.world) ? `${name}  •` : name, submenu: ws.map(radio) })),
    { type: 'separator' },
    { label: 'Start in this world', type: 'checkbox', checked: cfg.world === st.world, click: () => { writeCfg('world', cfg.world === st.world ? '' : st.world); } },
    { label: 'NYX picks the world', type: 'checkbox', checked: cfg.nyxWorlds !== false, click: act('nyxworlds') },
  ];
}

function nyxMenu(st, act, item) {
  const c = cfg.llm, k = keys(), on = c.provider;
  const radio = (p, label) => ({ label, type: 'radio', checked: on === p, click: () => (p === 'local' && !local.have(local.byId(localPick)) ? getModel(local.byId(localPick)) : useBrain(p)) });
  const keyNote = (p, env) => (k[p] ? 'key saved' : process.env[env] ? `key from ${env}` : 'no key yet');
  const urlOf = (p) => ((c.urls || {})[p] || (on === p && c.baseUrl) || DEFAULT_BASE[p]).replace(/^https?:\/\//, '');
  const modelOf = (p) => (c.models || {})[p] || (on === p && c.model) || '';
  const localPick = (c.models || {}).local || local.DEFAULT, dl = local.downloading();
  const serverList = (p, def) => [
    { label: `Default (${def})`, type: 'radio', checked: !modelOf(p), click: () => useBrain(p, { model: '' }) },
    ...(serverModels[p].length ? serverModels[p].map((m) => ({ label: m, type: 'radio', checked: modelOf(p) === m, click: () => useBrain(p, { model: m }) }))
      : [{ label: 'No models found at that server (yet)', enabled: false }]),
  ];
  refreshModels(); // for next time
  return [
    item('On', 'nyx', 'N', { type: 'checkbox', checked: st.nyx }),
    { label: 'Speaks 1337', type: 'checkbox', checked: st.leet, click: act('leet') },
    { label: 'Message chimes', type: 'checkbox', checked: st.chimes, click: act('chimes') },
    { type: 'separator' },
    { label: 'Brain', enabled: false },
    radio('local', `Built-in: ${local.byId(localPick).name}${local.have(local.byId(localPick)) ? '' : '  (not downloaded)'}`),
    radio('anthropic', `Claude  (${keyNote('anthropic', 'ANTHROPIC_API_KEY')})`),
    radio('ollama', `Ollama at ${urlOf('ollama')}`),
    radio('openai', `OpenAI-compatible at ${urlOf('openai')}`),
    radio('none', 'None: canned lines only'),
    { type: 'separator' },
    { label: 'Built-in model', submenu: [
      ...local.MODELS.map((m) => ({
        label: `${m.name}   ${m.gb} GB, ${m.note}${local.have(m) ? '' : '   (download)'}`, type: 'radio',
        checked: on === 'local' && localPick === m.id, enabled: !dl, click: () => getModel(m),
      })),
      { type: 'separator' },
      ...(dl ? [{ label: `Cancel the ${dl.name} download (${Math.max(0, dlPct)}%)`, click: () => local.cancel() }] : []),
      { label: `Delete downloaded models (${local.diskGb().toFixed(1)} GB)`, enabled: !dl && local.diskGb() > 0, click: deleteModels },
    ] },
    { label: 'Ollama', submenu: [{ label: 'Server address...', click: act('ask:ollama') }, { type: 'separator' }, ...serverList('ollama', DEFAULT_MODEL.ollama)] },
    { label: 'llama.cpp / LM Studio / OpenAI', submenu: [
      { label: 'Server address...', click: act('ask:openai') },
      { label: 'Back to OpenAI itself', click: () => useBrain('openai', { url: '', model: '' }) },
      { type: 'separator' }, ...serverList('openai', urlOf('openai') === 'api.openai.com' ? DEFAULT_MODEL.openai : 'the first it has'),
    ] },
    { label: 'API key: copy it, then click here', click: keyFromClipboard },
    { label: 'Get a Claude key...', click: () => shell.openExternal('https://console.anthropic.com/settings/keys') },
    { type: 'separator' },
    { label: 'Share terminal output with her', type: 'checkbox', checked: !!c.shareOutput, click: () => llmSet({ shareOutput: !c.shareOutput }) },
  ];
}

function contextMenu(st) { return Menu.buildFromTemplate(menuTemplate(st)); }
function menuTemplate(st) {
  const act = (a) => Object.assign(() => toMenuWindow('hotkey', a), { action: a }); // .action: for the palette
  const item = (label, a, _key, extra) => ({ label, click: act(a), accelerator: accel(a), registerAccelerator: false, ...extra });
  return [
    item('Command palette...', 'palette'),
    item('Copy', 'copy', 'C', { enabled: st.selection }), item('Paste', 'paste', 'V'),
    item('Find...', 'find', 'F'),
    item('Search all panes...', 'search:all', 'H'),
    { label: 'Commands', submenu: [ // shell integration's marks
      item('Previous prompt', 'prompt:prev', null, { enabled: st.shellint !== false }), item('Next prompt', 'prompt:next', null, { enabled: st.shellint !== false }),
      item('Copy command output', 'output:copy', null, { enabled: st.shellint !== false }),
      item('Save scrollback...', 'output:save'), item('Clear scrollback', 'scrollback:clear'),
      { type: 'separator' },
      item('Shell integration (new shells)', 'shellint', null, { type: 'checkbox', checked: st.shellint !== false }),
    ] },
    { type: 'separator' },
    item('New tab', 'newtab', 'T'),
    { label: 'New tab with', submenu: shellItems(act) },
    item('Close tab', 'closetab', 'X'),
    { label: 'Tab', submenu: [
      { label: 'Rename...', click: act('renametab') },
      { label: 'Colour', submenu: TAB_COLOURS.map(([label, c]) => ({ label, type: 'radio', checked: c === (st.tabColor || ''), click: act('tabcolor:' + c) })) },
      { type: 'separator' },
      { label: 'Open these tabs on start', click: act('tabs:save') },
      { label: 'Restore last session (tabs, panes, folders, scrollback)', type: 'checkbox', checked: cfg.restoreSession !== false, click: () => writeCfg('restoreSession', cfg.restoreSession === false) },
      { label: `Forget the start tabs${cfg.startupTabs.length ? ` (${cfg.startupTabs.length})` : ''}`, enabled: cfg.startupTabs.length > 0, click: () => writeCfg('startupTabs', []) },
      { label: 'Default shell', submenu: profiles.map((p) => ({ label: p.name, type: 'radio', checked: p.name === defaultProfile().name, click: () => writeCfg('defaultShell', p.name) })) },
    ] },
    { label: 'Panes', submenu: [
      { label: 'Split right', accelerator: accel('split:right'), registerAccelerator: false, click: act('split:right'), enabled: st.panes < 16 },
      { label: 'Split down', accelerator: accel('split:down'), registerAccelerator: false, click: act('split:down'), enabled: st.panes < 16 },
      { label: 'Close this pane', accelerator: accel('closepane'), registerAccelerator: false, click: act('closepane') },
      { label: 'Even grid', submenu: [1, 2, 3, 4, 6, 8, 9, 12, 16].map((n) => ({ label: `${n} pane${n > 1 ? 's' : ''}`, type: 'radio', checked: n === st.panes, accelerator: accel('panes:' + n), registerAccelerator: false, click: act('panes:' + n) })) },
      { type: 'separator' },
      item('Zoom this pane', 'zoompane', 'Z', { type: 'checkbox', checked: st.zoomed, enabled: st.panes > 1 }),
      item('Type into every pane', 'broadcast', 'A', { type: 'checkbox', checked: st.broadcast, enabled: st.panes > 1 }),
      { label: 'Even out the panes', click: act('evenpanes'), enabled: st.panes > 1 },
    ] },
    { type: 'separator' },
    { label: 'World', submenu: worldMenu(st, act) },
    { label: 'NYX', submenu: nyxMenu(st, act, item) },
    { label: 'Music', submenu: [
      item('On', 'music', 'M', { type: 'checkbox', checked: st.music }),
      item('Tempo follows activity', 'tempo', 'B', { type: 'checkbox', checked: st.reactive }),
      item('Synth panel', 'synth', 'K'),
      { label: 'Worlds dance to the music', type: 'checkbox', checked: st.dance, click: act('dance') },
      { label: 'Keyboard sounds', type: 'checkbox', checked: st.keyclick, click: act('keyclick') },
      { type: 'separator' },
      { label: 'Synth (follows your activity)', type: 'radio', checked: st.source === 'synth', click: act('music:synth') },
      { label: st.folder ? `Folder: ${path.basename(st.folder)}` : 'Folder (none chosen)', type: 'radio', checked: st.source === 'folder', click: act('music:folder') },
      { label: 'Choose music folder...', click: act('music:pick') },
      { type: 'separator' },
      item('Play / pause', 'music:toggle', 'P'),
      { label: 'Next track', accelerator: accel('music:next'), registerAccelerator: false, click: act('music:next') },
      { label: 'Previous track', accelerator: accel('music:prev'), registerAccelerator: false, click: act('music:prev') },
      { label: 'Shuffle', type: 'checkbox', checked: st.shuffle, click: act('music:shuffle') },
      { label: 'Volume up', accelerator: accel('music:volup'), registerAccelerator: false, click: act('music:volup') },
      { label: 'Volume down', accelerator: accel('music:voldown'), registerAccelerator: false, click: act('music:voldown') },
    ] },
    { label: 'IRC lobby', submenu: [
      item('Show', 'irc', 'I', { type: 'checkbox', checked: st.irc }),
      { type: 'separator' },
      ...[['fake', 'Simulated #hackers'], ['real', `Real IRC: ${cfg.irc.server} ${(cfg.irc.channels || []).join(' ')}`], ['off', 'Off']].map(([m, label]) =>
        ({ label, type: 'radio', checked: cfg.irc.mode === m, click: () => setIrcMode(m) })),
      { label: 'Server, nick, channels... (config.json, then pick Real again)', click: () => shell.openPath(cfg.file) },
    ] },
    { label: 'Look', submenu: [
      item('Framed', 'frame', 'U', { type: 'checkbox', checked: st.framed }),
      item('Scroller', 'scroller', 'S', { type: 'checkbox', checked: st.scroller }),
      item('Logo', 'logo', 'L', { type: 'checkbox', checked: st.logo }),
      item('Data packets', 'packets', 'D', { type: 'checkbox', checked: st.packets }),
      { label: 'Ships flying by', type: 'checkbox', checked: st.ships, click: act('ships') },
      { label: 'Calm worlds while typing', type: 'checkbox', checked: st.calm, click: act('calm') },
      item('System monitor', 'sysmon', 'G', { type: 'checkbox', checked: st.sysmon }),
      { label: 'Cigarette while compiling', type: 'checkbox', checked: cfg.cigarette !== false, click: act('cigarette') },
      item('Matrix rain', 'rain', 'R'),
      { type: 'separator' },
      { label: 'Hollywood hacking', type: 'checkbox', checked: st.hollywood, click: act('hollywood') },
      { label: 'CRT mode', type: 'checkbox', checked: st.crt, click: act('crt') },
      { label: 'Blue screen on errors', type: 'checkbox', checked: st.bsod, click: act('bsod') },
      { label: 'Window style: classic', type: 'checkbox', checked: st.classic, click: act('classic') },
      { label: 'BIOS boot screen', type: 'checkbox', checked: st.bios, click: act('bios') },
      { type: 'separator' },
      { label: 'Pane opacity', submenu: [
        ...[1, 0.86, 0.7, 0.5, 0.3, 0.15, 0].map((o) => ({ label: `${Math.round(o * 100)}%`, type: 'radio', checked: Math.abs(o - st.opacity) < 0.01, click: act('opacity:' + o) })),
        { type: 'separator' }, item('Cycle', 'opacity', 'O'),
      ] },
      { label: 'Text size', submenu: [
        { label: 'Bigger', accelerator: accel('font:up'), registerAccelerator: false, click: act('font:up') },
        { label: 'Smaller', accelerator: accel('font:down'), registerAccelerator: false, click: act('font:down') },
        { label: `Reset (${DEFAULTS.fontSize})`, accelerator: accel('font:reset'), registerAccelerator: false, click: act('font:reset') },
      ] },
      { label: 'Fullscreen', accelerator: accel('fullscreen'), registerAccelerator: false, click: act('fullscreen') },
    ] },
    { type: 'separator' },
    { label: 'Settings', submenu: [
      { label: 'Ask before pasting several lines', type: 'checkbox', checked: cfg.pasteGuard !== false, click: act('pasteguard') },
      { label: 'Copy on select', type: 'checkbox', checked: st.copyselect, click: act('copyselect') },
      { label: 'Right-click pastes (Shift+right-click for this menu)', type: 'checkbox', checked: st.rclickpaste, click: act('rclickpaste') },
      { label: 'Readable text (lift dim colours)', type: 'checkbox', checked: st.readable, click: act('readable') },
      { label: 'Open config.json', click: () => shell.openPath(cfg.file) },
      { label: 'Keys... ("keys" in config.json, then restart)', click: () => shell.openPath(cfg.file) },
      syncMenu(),
    ] },
  ];
}
// The menu, flat, for the command palette: every clickable item as 'Music › Shuffle', plus the
// keymap's actions that have no menu item. Kept until the next request so palette:run can call them.
let paletteItems = [];
function paletteList(st) {
  const out = [], seen = new Set();
  const walk = (items, trail) => { for (const it of items) {
    if (!it || it.type === 'separator' || it.enabled === false || !it.label) continue;
    const label = [...trail, it.label.trim()].join(' › ');
    if (it.submenu) walk(it.submenu, [...trail, it.label.trim()]);
    else if (it.click) { if (it.click.action) seen.add(it.click.action); out.push({ label, key: it.accelerator || (it.click.action && accel(it.click.action)) || '', checked: !!it.checked, run: it.click }); }
  } };
  walk(menuTemplate(st), []);
  for (const [a, label] of Object.entries(Keys.LABELS)) if (!seen.has(a)) out.push({ label, key: accel(a) || '', checked: false, run: () => toMenuWindow('hotkey', a) });
  paletteItems = out;
  return out.map(({ label, key, checked }, id) => ({ id, label, key, checked }));
}

// Switching the lobby's mode re-reads config.json's irc section, so edits there take effect.
function setIrcMode(mode) {
  if (irc) { irc.quit('changing servers'); irc = null; }
  writeCfg('irc', { ...(SHOT ? cfg.irc : loadConfig().irc), mode });
  win.webContents.send('hotkey', 'irc:mode:' + mode);
}

// The window that opened the last menu: its picks go back to it.
let menuWc = null;
const toMenuWindow = (ch, a) => (menuWc && !menuWc.isDestroyed() ? menuWc : win.webContents).send(ch, a);
const winOf = (e) => BrowserWindow.fromWebContents(e.sender) || win;

// The first window is the main one (music, IRC, news, quake). More come from tabs dragged out of
// it (extra.adopt: the tab and its running shells); each numbers its panes from its own idBase.
const extras = new Map(); let nextBase = 0;
function createWindow(extra) {
  const w = new BrowserWindow({
    width: SHOT ? 1920 : extra ? 1100 : 1600, height: SHOT ? 1080 : extra ? 700 : 960, minWidth: 900, minHeight: 600,
    ...(extra && !SHOT && extra.x != null ? { x: Math.round(extra.x), y: Math.round(extra.y) } : {}),
    useContentSize: true, enableLargerThanScreen: !!SHOT,
    backgroundColor: '#000000', autoHideMenuBar: true, title: 'GIBSON', icon: path.join(__dirname, 'build', 'icon.png'),
    show: !SHOT,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, offscreen: !!SHOT,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  if (!extra) win = w;
  const wcId = w.webContents.id;
  extras.set(wcId, { idBase: extra ? (nextBase += 100000) : 0, adopt: extra ? extra.adopt : null });
  w.on('closed', () => { // its shells go with it; the main window takes the rest along
    extras.delete(wcId);
    for (const [id, p] of panes) if (p.wcId === wcId) killShell(id);
    if (w === win) for (const o of BrowserWindow.getAllWindows()) o.close();
  });
  w.setMenuBarVisibility(false);
  w.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  hotkeys(w);
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (extra) { if (SHOT) { w.webContents.setFrameRate(30); w.setContentSize(1920, 1080); } return w; }
  if (SHOT) {
    win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') console.log('page:', e.message); });
    win.webContents.setFrameRate(30);
    win.setContentSize(1920, 1080); // offscreen windows still get clamped to the screen otherwise
    setTimeout(async () => {
      const others = BrowserWindow.getAllWindows().filter((o) => o !== win);
      for (const o of [win, ...others]) { // the main window, then any torn-off ones as name-2.png, name-3.png...
        const file = path.resolve(SHOT).replace(/\.png$/i, '') + (o === win ? '' : `-${others.indexOf(o) + 2}`) + '.png';
        const img = await o.webContents.capturePage();
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, img.toPNG());
        console.log('shot:', file);
      }
      for (const id of [...panes.keys()]) killShell(id);
      setTimeout(() => app.exit(0), 1000); // let node-pty finish closing ConPTY, or Electron crashes on exit
    }, SHOT_AT * 1000);
  }
  return w;
}

// Hotkeys are caught here, before xterm or the page can swallow them. Each window gets its own.
function hotkeys(win) {
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const a = keymap[Keys.fromInput(i)];
    if (!a || Keys.SOFT.has(a)) return; // soft keys: the page decides (renderer/keys.js)
    e.preventDefault(); win.webContents.send('hotkey', a);
  });
}

// Registered before ready: streaming lets <audio> seek in big files.
protocol.registerSchemesAsPrivileged([{ scheme: 'gibson-music', privileges: { standard: true, secure: true, stream: true, corsEnabled: true, supportFetchAPI: true } }]); // fetch: tracker modules are read whole

app.whenReady().then(() => {
  local.init(path.join(app.getPath('userData'), 'models'));
  cfg = loadConfig();
  keymap = Keys.keymap(cfg.keys);
  if (MUSIC) cfg.music = { ...cfg.music, source: 'folder', folder: path.resolve(MUSIC) };
  profiles = detectShells();
  for (const p of cfg.profiles || []) if (p && p.name && p.shell) { const i = profiles.findIndex((x) => x.name === p.name); if (i >= 0) profiles[i] = p; else profiles.push(p); }
  if (SHOT) { cfg = { ...demoShell(cfg), irc: { ...cfg.irc, mode: 'fake' }, ircOpen: false, eggs: false, startupTabs: [], world: '', nyxWorlds: true, cigarette: true, framed: true, opacity: 0.86, scroller: true, logo: true, music: MUSIC ? cfg.music : { ...cfg.music, source: 'synth' } }; home = demoHome(); } // shots ignore saved view choices
  ipcMain.handle('boot', (e) => {
    const x = extras.get(e.sender.id) || { idBase: 0 }, torn = !!x.adopt;
    return {
    // a torn-off window: no dial-in, no music (the main window plays it), no IRC, no start tabs
    cfg: { ...cfg, llm: { ...cfg.llm, apiKey: undefined }, irc: { ...cfg.irc, password: undefined }, ...(torn ? { boot: false, ircOpen: false } : {}) },
    idBase: x.idBase, adopt: x.adopt || null, detach: DETACH && !torn, rejoin: REJOIN && torn,
    user: SHOT ? 'hacker' : os.userInfo().username, host: SHOT ? 'gibson' : os.hostname(), cwd: home, panes: PANES, tabs: TABS, chat: CHAT, unframed: UNFRAMED,
    startTabs: cfg.startupTabs, session: !SHOT && !torn && cfg.restoreSession !== false ? readSession() : null, defaults: { fontSize: DEFAULTS.fontSize }, defaultShell: SHOT ? '' : defaultProfile().name,
    shot: !!SHOT, world: WORLD, irc: IRC && !torn, cmd: torn ? null : CMD, mute: MUTE || torn, bootShot: argv.includes('--boot'),
    ...(torn ? { startTabs: [], panes: 1, tabs: 1, chat: null } : {}),
    };
  });
  ipcMain.on('pty:open', (e, id, opts) => { if (!panes.has(id)) spawnShell(id, opts, e.sender); });
  // A tab dragged out of its window: dropped on another GIBSON window it moves there, on the desktop
  // it gets a new window. Its shells keep running; output piles up in their buffers until the other
  // window adopts them (pty:adopt hands over the buffer and the live feed at once). A window's last
  // tab can only move into another window, and that window closes behind it (never the main one).
  ipcMain.handle('tab:detach', (e, tab, x, y) => {
    const ids = (tab && Array.isArray(tab.ids) ? tab.ids : []).filter((id) => panes.has(id)).slice(0, 16);
    if (!ids.length) return false;
    const src = winOf(e), pt = SHOT ? { x, y } : screen.getCursorScreenPoint();
    const inside = (b) => pt.x >= b.x && pt.x < b.x + b.width && pt.y >= b.y && pt.y < b.y + b.height;
    const to = BrowserWindow.getAllWindows().find((o) => o !== src && !o.isDestroyed() && o.isVisible() && inside(o.getBounds()))
      || (SHOT && tab.into ? BrowserWindow.getAllWindows().find((o) => o !== src) : null);
    if (tab.last && (!to || src === win)) return false;
    for (const id of ids) Object.assign(panes.get(id), { wc: null, wcId: null });
    const adopt = { ids, tree: tab.tree || null, opts: tab.opts || {} }; // tree: the pane layout, leaves are pane ids
    if (to) { to.webContents.send('tab:adopt', adopt); to.focus(); } else createWindow({ adopt, x: pt.x - 120, y: pt.y - 20 });
    if (tab.last) setTimeout(() => src.close(), 50);
    return true;
  });
  ipcMain.handle('pty:adopt', (e, id) => {
    const p = panes.get(id); if (!p || p.wcId) return null; // only an orphaned pane can be taken
    Object.assign(p, { wc: e.sender, wcId: e.sender.id }); return p.buf;
  });
  ipcMain.on('pty:close', (_e, id) => killShell(id));
  ipcMain.on('pty:write', (_e, id, d) => { const p = panes.get(id); if (p && p.term) p.term.write(d); });
  ipcMain.on('pty:resize', (_e, id, c, r) => { try { panes.get(id).term.resize(c, r); } catch { /* shell restarting */ } });
  ipcMain.on('pty:line', (_e, id, line) => { const p = panes.get(id); if (p) trackCd(p, line); });
  ipcMain.on('pty:cwd', (_e, id, dir) => { // the shell's own word for its folder (shell integration)
    const p = panes.get(id); if (!p || typeof dir !== 'string') return;
    if (process.platform === 'win32') dir = dir.replace(/^\/([a-z])(?=\/|$)/i, '$1:').replace(/\//g, '\\'); // Git Bash: /c/x is C:\x
    if (isDir(dir)) p.cwd = dir;
  });
  ipcMain.handle('output:save', async (e, text) => { // a pane's scrollback, to a file the user picks
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Save scrollback', defaultPath: path.join(app.getPath('documents'), `gibson-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.txt`), filters: [{ name: 'Text', extensions: ['txt', 'log'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, String(text)); return r.filePath;
  });
  // `nfo <file>`: the raw bytes (the page decodes CP437). Under 1 MB, relative to the pane's folder.
  ipcMain.handle('fs:read', (_e, id, file) => {
    try { const f = linkPath(id, String(file)); return fs.statSync(f).size < 1048576 ? fs.readFileSync(f) : null; } catch { return null; }
  });
  // The IRC lobby's real mode dials only when config.json says so, and only once the panel opens.
  ipcMain.handle('irc:connect', () => {
    if (SHOT || cfg.irc.mode !== 'real') return null;
    if (!irc) {
      if (!cfg.irc.nick) writeCfg('irc', { ...cfg.irc, nick: defaultNick() }); // made up, kept for next time
      irc = createIrc(cfg.irc, (ev) => win && !win.isDestroyed() && win.webContents.send('irc:event', ev));
    }
    return { nick: irc.nick(), server: irc.server };
  });
  ipcMain.on('irc:command', (_e, line, target) => { if (irc) irc.command(String(line), String(target || '')); });
  ipcMain.handle('fs:list', (_e, id) => { const d = (panes.get(id) || { cwd: home }).cwd; return { cwd: SHOT ? 'C:\\GIBSON' : d, entries: listDir(d) }; });
  ipcMain.on('cfg:save', (_e, key, v) => { // view choices remembered across restarts
    if (['opacity', 'framed', 'scroller', 'logo', 'packets', 'music', 'nyxWorlds', 'dance', 'calm', 'sysmon', 'ships', 'hollywood', 'crt', 'keyclick', 'chimes', 'bios', 'bsod', 'classic', 'readable', 'copyselect', 'rclickpaste', 'shellint', 'cigarette', 'fontSize', 'pasteGuard', 'ircOpen'].includes(key)) writeCfg(key, v);
    if (key === 'nyxLeet') writeCfg('nyx', { ...cfg.nyx, leet: !!v });
  });
  // The tabs as they are now become the start tabs. The page sends each tab's first pane id
  // and pane count; the shell and folder are known here.
  // The page sends its tabs every 30 s and on the way out; leaves arrive as { id, text } and the
  // shell and folder are filled in here. The BBS isn't kept. Scrollback is trimmed to fit 4 MB.
  ipcMain.on('session:save', (_e, list) => {
    if (SHOT || !Array.isArray(list)) return;
    const build = (keep) => list.slice(0, 32).map((t) => {
      const cell = (c) => { const p = c && panes.get(c.id); return p && !p.prof.once ? { profile: p.prof.name, cwd: p.cwd, text: String(c.text || '').slice(-keep) } : null; };
      const node = (n, depth) => (!n || depth > 20 ? null : n.p !== undefined ? { p: cell(n.p) } : { dir: n.dir, ratio: n.ratio, a: node(n.a, depth + 1), b: node(n.b, depth + 1) });
      return { ...(t.name ? { name: String(t.name).slice(0, 40) } : {}), ...(t.color ? { color: String(t.color).slice(0, 9) } : {}), tree: node(t.tree, 0) };
    });
    let keep = 200000, s = JSON.stringify(build(keep));
    while (s.length > 4e6 && keep > 1000) s = JSON.stringify(build((keep >>= 1)));
    try { fs.writeFileSync(sessionFile(), s); } catch { /* not this time */ }
  });
  ipcMain.on('tabs:save', (_e, list) => {
    const tabs = list.map((t) => { const p = panes.get(t.id); return p && !p.prof.once && { profile: p.prof.name, cwd: p.cwd, panes: t.panes, ...(t.name ? { name: String(t.name).slice(0, 40) } : {}), ...(t.color ? { color: String(t.color).slice(0, 9) } : {}) }; }).filter(Boolean);
    writeCfg('startupTabs', tabs);
  });
  // file:line links in the terminal. Paths are relative to the pane's folder; only real files count.
  const linkPath = (id, file) => path.resolve((panes.get(id) || { cwd: home }).cwd, file.replace(/^~(?=[\\/])/, os.homedir()));
  ipcMain.handle('link:check', (_e, id, files) => files.map((f) => !SHOT && exists(linkPath(id, f))));
  ipcMain.on('link:open', (_e, id, file, line, col) => openInEditor(linkPath(id, file), line || 1, col || 1));
  ipcMain.on('menu:shells', (e) => { const wc = e.sender; Menu.buildFromTemplate(shellItems((a) => () => wc.send('hotkey', a))).popup({ window: winOf(e) }); });
  ipcMain.handle('git:log', (_e, id) => gitLog((panes.get(id) || { cwd: home }).cwd));
  ipcMain.handle('sys:net', () => (SHOT ? DEMO_NET() : sys.netConns()));
  ipcMain.handle('sys:procs', () => (SHOT ? DEMO_PROCS() : sys.procs()));
  ipcMain.handle('sys:stats', () => (SHOT ? DEMO_STATS() : sys.stats()));
  ipcMain.handle('sys:hw', async () => (SHOT ? { cpu: 'GIBSON 80686 MMX', mhz: 666, cores: 8, mem: 64 * 2 ** 30, disks: DEMO_STATS().disks } // the BIOS screen
    : { cpu: os.cpus()[0].model, mhz: os.cpus()[0].speed, cores: os.cpus().length, mem: os.totalmem(), disks: (await sys.stats()).disks }));
  ipcMain.handle('music:list', () => listMusic(cfg.music.folder));
  ipcMain.handle('music:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose a music folder', properties: ['openDirectory'], defaultPath: cfg.music.folder || app.getPath('music') });
    if (r.canceled || !r.filePaths[0]) return null;
    cfg.music.folder = r.filePaths[0];
    return listMusic(cfg.music.folder);
  });
  // Tracks are served only from inside the chosen folder: the page never gets file:// access.
  protocol.handle('gibson-music', (req) => {
    const base = path.resolve(cfg.music.folder || '.'), full = path.resolve(base, decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, ''));
    if (!cfg.music.folder || !full.startsWith(base + path.sep) || !AUDIO.test(full)) return new Response('no', { status: 403 });
    // CORS header: without it the page counts the audio as cross-origin and WebAudio hears silence.
    return net.fetch(pathToFileURL(full).toString(), { headers: req.headers }).then((r) => {
      const h = new Headers(r.headers); h.set('access-control-allow-origin', '*');
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
    });
  });
  ipcMain.on('menu', (e, st) => { menuWc = e.sender; contextMenu(st).popup({ window: winOf(e) }); });
  ipcMain.handle('palette:list', (e, st) => { menuWc = e.sender; return paletteList(st); });
  ipcMain.on('palette:run', (e, id) => { menuWc = e.sender; const it = paletteItems[id]; if (it) it.run(); });
  ipcMain.handle('nyx:llm', (_e, event) => llmLine(brain(), event).catch(() => null));
  // `nyx <message>`: the tool loop (agent.js), or the plain one-liner if the brain can't do tools.
  ipcMain.handle('nyx:agent', async (e, ev) => {
    const c = brain(), w = winOf(e), cwd = (panes.get(ev.pane) || { cwd: home }).cwd;
    if (c.provider === 'none' || SHOT) return llmLine(c, { ...ev, kind: 'chat' }).catch(() => null);
    if (c.provider === 'local' && !local.have(local.byId(c.model))) return { text: `No brain in my skull yet. Right-click > NYX > Built-in model downloads one (${local.byId(c.model).name}, ${local.byId(c.model).gb} GB).`, mood: 'playful' };
    let trust = false;
    const confirm = async (kind, message, detail) => {
      if (trust) return true;
      const r = await dialog.showMessageBox(w, { type: 'question', title: 'GIBSON // NYX wants to ' + kind, message, detail, buttons: ['Allow', 'Allow everything this time', 'No'], defaultId: 0, cancelId: 2, noLink: true });
      if (r.response === 1) trust = true;
      return r.response < 2;
    };
    const step = (text) => { if (!e.sender.isDestroyed()) e.sender.send('nyx:step', ev.pane, text); };
    try { return await agent.ask(c, { ...ev, cwd }, { step, confirm }); }
    catch (err) { console.error('nyx agent:', err.message); return llmLine(c, { ...ev, kind: 'chat' }).catch(() => null); }
  });
  ipcMain.on('llm:server', (_e, p, url) => { // from the page's address box: a server for Ollama or an OpenAI-compatible brain
    if (!['ollama', 'openai'].includes(p) || !/^https?:\/\/[^\s/]+(\/\S*)?$/.test(String(url))) return;
    useBrain(p, { url: String(url).replace(/\/$/, ''), model: '' });
  });
  ipcMain.on('win:focus', (e) => { const w = winOf(e); if (w.isMinimized()) w.restore(); w.show(); w.focus(); });
  ipcMain.on('win:fullscreen', (e) => { const w = winOf(e); w.setFullScreen(!w.isFullScreen()); });
  // NEWSWIRE: fetch the feeds now and every news.minutes, push headlines to the page.
  const pushNews = async () => {
    const items = SHOT ? DEMO_NEWS() : await sys.fetchFeeds(cfg.news.feeds);
    if (items.length && win && !win.isDestroyed()) win.webContents.send('news', items);
  };
  if (SHOT || (cfg.news.feeds || []).length) {
    setTimeout(pushNews, SHOT ? 1500 : 8000);
    if (!SHOT) setInterval(pushNews, Math.max(5, cfg.news.minutes || 15) * 60000);
  }
  // Quake mode: a global key summons GIBSON from anywhere and sends it away again.
  if (!SHOT && cfg.quake && cfg.quake.key) {
    try {
      globalShortcut.register(cfg.quake.key, () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible() && win.isFocused() && !win.isMinimized()) { if (cfg.quake.dock) win.hide(); else win.minimize(); return; }
        if (cfg.quake.dock) { // drop down from the top of the screen the mouse is on
          const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
          win.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: Math.round(wa.height * 0.55) });
        }
        win.show(); win.restore(); win.focus();
      });
    } catch { /* key taken or invalid: no quake mode */ }
  }
  app.on('will-quit', () => globalShortcut.unregisterAll());
  Menu.setApplicationMenu(null); // the default menu's accelerators (Ctrl+Shift+R = reload) fight ours
  createWindow();
});

app.on('before-quit', () => { if (irc) irc.quit('NO CARRIER'); });
app.on('window-all-closed', () => { for (const id of [...panes.keys()]) killShell(id); setTimeout(() => app.quit(), 500); }); // see the shot exit
