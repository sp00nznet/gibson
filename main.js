// GIBSON main process: owns the shell (node-pty), the config file, and every
// LLM call, so API keys never reach the renderer. Design: docs/architecture.md.
const { app, BrowserWindow, ipcMain, shell, Menu, dialog, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pty = require('node-pty');
const { execFile } = require('child_process');
const { llmLine } = require('./llm');
const sys = require('./sysinfo');

// One config folder for source runs and packaged builds (whose app name is GIBSON).
app.setPath('userData', path.join(app.getPath('appData'), 'gibson'));

const argv = process.argv.slice(1);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SHOT = arg('--shot');            // headless: render offscreen, save a PNG, quit
const SHOT_AT = Number(arg('--at') || 9);
const WORLD = arg('--world');          // force a starting world (screenshots)
const MUTE = argv.includes('--mute');
const PANES = Number(arg('--panes') || 1); // start with 1-4 panes
const UNFRAMED = argv.includes('--unframed');
const TABS = Number(arg('--tabs') || 1); // start with this many tabs (screenshots)
const CHAT = arg('--chat');
const MUSIC = arg('--music');              // play this folder (the jukebox) instead of the synth                // shots: say this to NYX

const DEFAULTS = {
  shell: process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash'),
  shellArgs: process.platform === 'win32' ? ['-NoLogo'] : [],
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
  opacity: 0.86,              // terminal background: 1 solid, 0 see the world straight through
  boot: true,                 // the modem dial-in on startup
  music: { on: true, mode: 'reactive', bpm: 128, volume: 0.55, source: 'synth', folder: '', shuffle: true }, // source: synth | folder
  nyx: { on: true, voice: false, chatter: 0.35 },
  llm: {
    provider: 'ollama',       // ollama | anthropic | openai | none
    model: '',                // blank = provider default (llm.js)
    baseUrl: '',              // blank = provider default
    apiKey: '',               // prefer ANTHROPIC_API_KEY / OPENAI_API_KEY env vars
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
  for (const k of ['music', 'nyx', 'llm', 'news']) cfg[k] = { ...DEFAULTS[k], ...(user[k] || {}) };
  cfg.file = file;
  return cfg;
}

let win, cfg, home = os.homedir();
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
const DEMO_PROCS = () => ['gibson', 'zerocool', 'acidburn', 'plague-daemon', 'da-vinci', 'worm', 'kernel-sentry', 'ellingson-sync', 'phreak', 'cereal', 'nikon', 'garbage-collector', 'modem', 'bbs-door']
  .map((name, i) => ({ name, cpu: i === 4 ? 92 : Math.random() * 12, mem: (14 - i) * 40e6 + Math.random() * 20e6, n: 1 + (i % 3) }));
const DEMO_NEWS = () => ['Gibson mainframe breached by unknown worm', 'Da Vinci virus threatens oil tankers, experts say', 'Ellingson Mineral denies garbage file exists',
  'Hackers urged to stop hacking the planet', 'Phone phreaks return as modems make a comeback', 'Zero Cool banned from computers until 18th birthday']
  .map((title) => ({ title, link: '', source: 'GIBSON WIRE' }));

// The jukebox's tracks: audio files under the chosen folder, three levels deep at most.
const AUDIO = /\.(mp3|ogg|oga|opus|wav|flac|m4a|aac|webm)$/i;
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

function spawnShell(id) {
  const pane = panes.get(id) || { cwd: home };
  panes.set(id, pane);
  const term = pane.term = pty.spawn(cfg.shell, cfg.shellArgs, {
    name: 'xterm-256color', cols: 100, rows: 30, cwd: pane.cwd,
    env: { ...process.env, TERM_PROGRAM: 'GIBSON', ...(SHOT ? { PS1: 'hacker@gibson:~$ ' } : {}) },
  });
  const send = (d) => win && !win.isDestroyed() && win.webContents.send('pty:data', id, d);
  term.onData(send);
  term.onExit(() => {
    if (pane.closed || pane.term !== term) return; // closed on purpose
    send('\r\n\x1b[35m-- NO CARRIER --\x1b[0m\r\n'); spawnShell(id);
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

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).slice(0, 160).map((e) => {
      let size = 0;
      try { size = e.isDirectory() ? 0 : fs.statSync(path.join(dir, e.name)).size; } catch { /* locked file */ }
      return { name: e.name, dir: e.isDirectory(), size };
    });
  } catch { return []; }
}

// Ctrl+Shift + these keys, by key code (the shifted characters differ by keyboard layout)
const CODEKEYS = { BracketRight: 'music:next', BracketLeft: 'music:prev', Equal: 'music:volup', Minus: 'music:voldown' };
const HOTKEYS = { C: 'copy', V: 'paste', M: 'music', B: 'tempo', N: 'nyx', W: 'world', R: 'rain', T: 'newtab', X: 'closetab', O: 'opacity', F: 'frame', S: 'scroller', L: 'logo', D: 'packets', P: 'music:toggle', J: 'music:source' };

// Right-click menu. The page sends its current state; clicks come back as hotkey actions.
function contextMenu(st) {
  const act = (a) => () => win.webContents.send('hotkey', a);
  const item = (label, a, key, extra) => ({ label, click: act(a), accelerator: key && 'Ctrl+Shift+' + key, registerAccelerator: false, ...extra });
  return Menu.buildFromTemplate([
    item('Copy', 'copy', 'C', { enabled: st.selection }), item('Paste', 'paste', 'V'),
    { type: 'separator' },
    item('New tab', 'newtab', 'T'),
    item('Close tab', 'closetab', 'X'),
    { label: 'Panes', submenu: [1, 2, 3, 4].map((n) => ({ label: `${n}`, type: 'radio', checked: n === st.panes, accelerator: `Ctrl+Shift+${n}`, registerAccelerator: false, click: act('panes:' + n) })) },
    { label: 'World', submenu: st.worlds.map(([key, label]) => ({ label, type: 'radio', checked: key === st.world, click: act('world:' + key) })) },
    { type: 'separator' },
    { label: 'Music', submenu: [
      item('On', 'music', 'M', { type: 'checkbox', checked: st.music }),
      { type: 'separator' },
      { label: 'Synth (follows your activity)', type: 'radio', checked: st.source === 'synth', click: act('music:synth') },
      { label: st.folder ? `Folder: ${path.basename(st.folder)}` : 'Folder (none chosen)', type: 'radio', checked: st.source === 'folder', click: act('music:folder') },
      { label: 'Choose music folder...', click: act('music:pick') },
      { type: 'separator' },
      item('Play / pause', 'music:toggle', 'P'),
      { label: 'Next track', accelerator: 'Ctrl+Shift+]', registerAccelerator: false, click: act('music:next') },
      { label: 'Previous track', accelerator: 'Ctrl+Shift+[', registerAccelerator: false, click: act('music:prev') },
      { label: 'Shuffle', type: 'checkbox', checked: st.shuffle, click: act('music:shuffle') },
      { label: 'Volume up', accelerator: 'Ctrl+Shift+=', registerAccelerator: false, click: act('music:volup') },
      { label: 'Volume down', accelerator: 'Ctrl+Shift+-', registerAccelerator: false, click: act('music:voldown') },
    ] },
    item('Tempo follows activity', 'tempo', 'B', { type: 'checkbox', checked: st.reactive }),
    item('Framed', 'frame', 'F', { type: 'checkbox', checked: st.framed }),
    item('Scroller', 'scroller', 'S', { type: 'checkbox', checked: st.scroller }),
    item('Logo', 'logo', 'L', { type: 'checkbox', checked: st.logo }),
    item('Data packets', 'packets', 'D', { type: 'checkbox', checked: st.packets }),
    item('NYX', 'nyx', 'N', { type: 'checkbox', checked: st.nyx }),
    item('Matrix rain', 'rain', 'R'),
    { type: 'separator' },
    { label: 'Pane opacity', submenu: [1, 0.86, 0.7, 0.5, 0.3, 0.15, 0].map((o) => ({ label: `${Math.round(o * 100)}%`, type: 'radio', checked: Math.abs(o - st.opacity) < 0.01, click: act('opacity:' + o) })) },
    item('Cycle opacity', 'opacity', 'O'),
    { type: 'separator' },
    { label: 'Fullscreen', accelerator: 'F11', registerAccelerator: false, click: act('fullscreen') },
    { label: 'Open config.json', click: () => shell.openPath(cfg.file) },
  ]);
}

function createWindow() {
  win = new BrowserWindow({
    width: SHOT ? 1920 : 1600, height: SHOT ? 1080 : 960, minWidth: 900, minHeight: 600,
    useContentSize: true, enableLargerThanScreen: !!SHOT,
    backgroundColor: '#000000', autoHideMenuBar: true, title: 'GIBSON', icon: path.join(__dirname, 'build', 'icon.png'),
    show: !SHOT,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, offscreen: !!SHOT,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Hotkeys are caught here, before xterm or the page can swallow them.
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const k = i.key.length === 1 ? i.key.toUpperCase() : i.key;
    const digit = /^Digit([1-4])$/.exec(i.code); // Ctrl+Shift+1..4: i.key is '!' etc, so read the code
    if (digit && i.control && i.shift) { e.preventDefault(); return win.webContents.send('hotkey', 'panes:' + digit[1]); }
    if (i.control && i.shift && CODEKEYS[i.code]) { e.preventDefault(); return win.webContents.send('hotkey', CODEKEYS[i.code]); }
    const tabKey = i.control && ((i.key === 'Tab' && (i.shift ? 'prevtab' : 'nexttab')) || (i.key === 'PageDown' && 'nexttab') || (i.key === 'PageUp' && 'prevtab'));
    if (tabKey) { e.preventDefault(); return win.webContents.send('hotkey', tabKey); }
    if (k === 'F11' || (i.control && i.shift && HOTKEYS[k])) { e.preventDefault(); win.webContents.send('hotkey', k === 'F11' ? 'fullscreen' : HOTKEYS[k]); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (SHOT) {
    win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') console.log('page:', e.message); });
    win.webContents.setFrameRate(30);
    win.setContentSize(1920, 1080); // offscreen windows still get clamped to the screen otherwise
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.mkdirSync(path.dirname(path.resolve(SHOT)), { recursive: true });
      fs.writeFileSync(path.resolve(SHOT), img.toPNG());
      console.log('shot:', path.resolve(SHOT));
      for (const id of [...panes.keys()]) killShell(id);
      setTimeout(() => app.exit(0), 1000); // let node-pty finish closing ConPTY, or Electron crashes on exit
    }, SHOT_AT * 1000);
  }
}

// Registered before ready: streaming lets <audio> seek in big files.
protocol.registerSchemesAsPrivileged([{ scheme: 'gibson-music', privileges: { standard: true, secure: true, stream: true, corsEnabled: true } }]);

app.whenReady().then(() => {
  cfg = loadConfig();
  if (MUSIC) cfg.music = { ...cfg.music, source: 'folder', folder: path.resolve(MUSIC) };
  if (SHOT) { cfg = { ...demoShell(cfg), framed: true, opacity: 0.86, scroller: true, logo: true, music: MUSIC ? cfg.music : { ...cfg.music, source: 'synth' } }; home = demoHome(); } // shots ignore saved view choices
  ipcMain.handle('boot', () => ({
    cfg: { ...cfg, llm: { ...cfg.llm, apiKey: undefined } },
    user: SHOT ? 'hacker' : os.userInfo().username, host: SHOT ? 'gibson' : os.hostname(), cwd: home, panes: PANES, tabs: TABS, chat: CHAT, unframed: UNFRAMED,
    shot: !!SHOT, world: WORLD, mute: MUTE, bootShot: argv.includes('--boot'),
  }));
  ipcMain.on('pty:open', (_e, id) => { if (!panes.has(id)) spawnShell(id); });
  ipcMain.on('pty:close', (_e, id) => killShell(id));
  ipcMain.on('pty:write', (_e, id, d) => { const p = panes.get(id); if (p) p.term.write(d); });
  ipcMain.on('pty:resize', (_e, id, c, r) => { try { panes.get(id).term.resize(c, r); } catch { /* shell restarting */ } });
  ipcMain.on('pty:line', (_e, id, line) => { const p = panes.get(id); if (p) trackCd(p, line); });
  ipcMain.handle('fs:list', (_e, id) => { const d = (panes.get(id) || { cwd: home }).cwd; return { cwd: SHOT ? 'C:\\GIBSON' : d, entries: listDir(d) }; });
  ipcMain.on('cfg:save', (_e, key, v) => { // view choices remembered across restarts
    if (SHOT) return; // screenshots never touch the user's config
    if (!['opacity', 'framed', 'scroller', 'logo', 'packets', 'music'].includes(key)) return;
    cfg[key] = key === 'music' ? { ...cfg.music, ...v } : v;
    try { const u = JSON.parse(fs.readFileSync(cfg.file, 'utf8')); u[key] = v; fs.writeFileSync(cfg.file, JSON.stringify(u, null, 2)); } catch { /* config unreadable: keep it for this session */ }
  });
  ipcMain.handle('git:log', (_e, id) => gitLog((panes.get(id) || { cwd: home }).cwd));
  ipcMain.handle('sys:net', () => (SHOT ? DEMO_NET() : sys.netConns()));
  ipcMain.handle('sys:procs', () => (SHOT ? DEMO_PROCS() : sys.procs()));
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
  ipcMain.on('menu', (_e, st) => contextMenu(st).popup({ window: win }));
  ipcMain.handle('nyx:llm', (_e, event) => llmLine(cfg.llm, event).catch(() => null));
  ipcMain.on('win:fullscreen', () => win.setFullScreen(!win.isFullScreen()));
  // NEWSWIRE: fetch the feeds now and every news.minutes, push headlines to the page.
  const pushNews = async () => {
    const items = SHOT ? DEMO_NEWS() : await sys.fetchFeeds(cfg.news.feeds);
    if (items.length && win && !win.isDestroyed()) win.webContents.send('news', items);
  };
  if (SHOT || (cfg.news.feeds || []).length) {
    setTimeout(pushNews, SHOT ? 1500 : 8000);
    if (!SHOT) setInterval(pushNews, Math.max(5, cfg.news.minutes || 15) * 60000);
  }
  Menu.setApplicationMenu(null); // the default menu's accelerators (Ctrl+Shift+R = reload) fight ours
  createWindow();
});

app.on('window-all-closed', () => { for (const id of [...panes.keys()]) killShell(id); setTimeout(() => app.quit(), 500); }); // see the shot exit
