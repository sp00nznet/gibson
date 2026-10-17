// Live data for three worlds, gathered in the main process: NETWATCH (TCP connections),
// PROCESS HIVE (running programs) and NEWSWIRE (RSS/Atom headlines). The parsers are
// separate from the commands so test/check.mjs can feed them sample output.
// Shot mode never calls these: main.js swaps in made-up data so captures show nothing real.
const { execFile } = require('child_process');

const run = (cmd, args) => new Promise((resolve) => {
  execFile(cmd, args, { timeout: 8000, windowsHide: true, maxBuffer: 8 << 20 }, (err, out) => resolve(err ? '' : out));
});

// --- NETWATCH ---------------------------------------------------------------------------
const SERVICES = { 22: 'ssh', 53: 'dns', 80: 'http', 443: 'https', 993: 'imaps', 995: 'pop3s', 587: 'smtp', 3389: 'rdp',
  5228: 'gcm', 5222: 'xmpp', 6667: 'irc', 6697: 'irc', 8080: 'http-alt', 8443: 'https-alt', 9418: 'git', 1194: 'vpn', 51820: 'wireguard' };

// "1.2.3.4:443", "[2606:4700::1]:443", mac's "1.2.3.4.443"
function splitAddr(s) {
  let m = /^\[(.+)\]:(\d+)$/.exec(s) || /^([\d.]+):(\d+)$/.exec(s) || /^([\da-f:]+):(\d+)$/i.exec(s) || /^([\d.]+)\.(\d+)$/.exec(s);
  return m ? { ip: m[1], port: Number(m[2]) } : null;
}
const local = (ip) => /^(127\.|0\.0\.0\.0|::1?$|::ffff:127\.|fe80:)/i.test(ip);

// netstat -no (Windows), netstat -anv -p tcp (macOS), ss -tnH (Linux): established outbound peers.
function parseNet(out) {
  const seen = new Map();
  for (const line of out.split('\n')) {
    if (!/ESTAB/i.test(line)) continue;
    const addrs = line.trim().split(/\s+/).map(splitAddr).filter(Boolean);
    if (addrs.length < 2) continue;
    const r = addrs[1];
    if (local(r.ip)) continue;
    const key = `${r.ip}:${r.port}`;
    if (!seen.has(key)) seen.set(key, { ...r, service: SERVICES[r.port] || `port ${r.port}` });
  }
  return [...seen.values()];
}
function netConns() {
  if (process.platform === 'win32') return run('netstat', ['-no']).then(parseNet);
  if (process.platform === 'darwin') return run('netstat', ['-anv', '-p', 'tcp']).then(parseNet);
  return run('ss', ['-tnH']).then(parseNet);
}

// --- PROCESS HIVE -----------------------------------------------------------------------
// Windows reports CPU as seconds used, so the percentage comes from the change since the
// last poll. ps (macOS/Linux) reports a percentage directly.
let lastCpu = new Map(), lastAt = 0;
function parseProcs(out, win, now) {
  const byName = new Map();
  for (const line of out.split('\n')) {
    let name, cpu, mem;
    if (win) { const p = line.trim().split('|'); if (p.length < 3) continue; [name, cpu, mem] = [p[0], Number(p[1]) || 0, Number(p[2]) || 0]; }
    else { const m = /^\s*(.+?)\s+([\d.]+)\s+(\d+)\s*$/.exec(line); if (!m) continue; name = m[1].split('/').pop(); cpu = Number(m[2]); mem = Number(m[3]) * 1024; }
    if (!name) continue;
    const e = byName.get(name) || { name, cpu: 0, mem: 0, n: 0 };
    e.cpu += cpu; e.mem += mem; e.n++; byName.set(name, e);
  }
  let list = [...byName.values()];
  if (win) {
    const dt = lastAt ? (now - lastAt) / 1000 : 0;
    const next = new Map(list.map((e) => [e.name, e.cpu]));
    list = list.map((e) => ({ ...e, cpu: dt && lastCpu.has(e.name) ? Math.max(0, (e.cpu - lastCpu.get(e.name)) / dt * 100) : 0 }));
    lastCpu = next; lastAt = now;
  }
  return list.sort((a, b) => b.mem - a.mem).slice(0, 48);
}
function procs() {
  if (process.platform === 'win32') {
    return run('powershell', ['-NoProfile', '-NonInteractive', '-Command', "Get-Process | ForEach-Object { '{0}|{1}|{2}' -f $_.ProcessName, $_.CPU, $_.WorkingSet64 }"])
      .then((out) => parseProcs(out, true, Date.now()));
  }
  return run('ps', ['-axo', 'comm=,%cpu=,rss=']).then((out) => parseProcs(out, false, Date.now()));
}

// --- NEWSWIRE ---------------------------------------------------------------------------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&(\w+);/g, (m, n) => ENT[n] || m).replace(/\s+/g, ' ').trim();
const tag = (block, name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block); return m ? decode(m[1]) : ''; };

// RSS 2.0 <item> or Atom <entry>; no XML library for a list of titles.
function parseFeed(xml) {
  const head = xml.split(/<(item|entry)[\s>]/i)[0];
  const source = tag(head, 'title');
  const items = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
    const b = m[0], title = tag(b, 'title');
    const link = tag(b, 'link') || ((/<link[^>]*href="([^"]+)"/i.exec(b) || [])[1] || '');
    if (title) items.push({ title, link, source });
  }
  return items;
}
async function fetchFeeds(urls) {
  const all = await Promise.all((urls || []).map(async (u) => {
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'GIBSON (cracktro terminal)' }, signal: AbortSignal.timeout(15000) });
      return r.ok ? parseFeed(await r.text()).slice(0, 25) : [];
    } catch { return []; }
  }));
  return all.flat();
}

// Shell profiles, from what is installed. Pure, so the self-check runs them on every platform.
// WSL: one profile per distro (`wsl -l -q`, UTF-16), like Windows Terminal. Plain `wsl.exe` opens
// the default distro, which may be a broken or Docker one; Docker Desktop's own are skipped.
function wslDistros(out) {
  return String(out).replace(/\0/g, '').split(/\r?\n/).map((l) => l.trim())
    .filter((d) => d && !/^docker-desktop/i.test(d) && !/^Windows Subsystem|^There are no/i.test(d))
    .map((d) => ({ name: `${d} (WSL)`, shell: 'wsl.exe', args: ['-d', d] }));
}
// macOS/Linux: $SHELL first, then /etc/shells, one per name, skipping the ones that are not for
// people (nologin, git-shell). macOS terminals start login shells (-l), or PATH comes up short.
function unixShells(etcShells, current, mac, exists) {
  const out = [], seen = new Set();
  const list = String(etcShells).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('/'));
  for (const s of [current || '/bin/bash', ...list]) {
    const name = s.split('/').pop();
    if (seen.has(name) || /nologin|false|git-shell|rbash/.test(name) || !exists(s)) continue;
    seen.add(name); out.push({ name, shell: s, args: mac ? ['-l'] : [] });
  }
  return out;
}

module.exports = { parseNet, netConns, parseProcs, procs, parseFeed, fetchFeeds, wslDistros, unixShells, SERVICES };
