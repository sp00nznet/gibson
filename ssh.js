// Saved SSH hosts for the new-tab menu and the palette: the Host entries in ~/.ssh/config
// (wildcard patterns skipped) plus config.json's "sshHosts" (strings, or { name, host, user, port }).
const fs = require('fs'), os = require('os'), path = require('path');

// ~/.ssh/config text → [{ name, host, user, port }]. One entry per concrete alias on a Host line.
function parseSshConfig(text) {
  const out = []; let cur = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const m = /^\s*(\w+)\s*(?:=\s*|\s+)(.+?)\s*$/.exec(raw.replace(/#.*/, ''));
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].replace(/^"|"$/g, '');
    if (key === 'host') { cur = val.split(/\s+/).filter((h) => !/[*?!]/.test(h)).map((name) => ({ name, host: name, alias: true })); out.push(...cur); }
    else if (key === 'match') cur = [];
    else for (const h of cur) { if (key === 'hostname') h.host = val; else if (key === 'user') h.user = val; else if (key === 'port') h.port = Number(val) || undefined; }
  }
  return out;
}

// Every saved host, config.json's first (same name replaces).
function sshHosts(extra) {
  let text = ''; try { text = fs.readFileSync(path.join(os.homedir(), '.ssh', 'config'), 'utf8'); } catch { /* no config */ }
  const list = (extra || []).map((h) => (typeof h === 'string' ? { name: h, host: h } : h && { ...h, name: h.name || h.host })).filter((h) => h && h.name);
  for (const h of parseSshConfig(text)) if (!list.some((x) => x.name === h.name)) list.push(h);
  return list;
}

// The shell profile that opens one: `ssh <alias>` for config hosts (ssh reads its own settings).
function sshProfile(h) {
  if (h.alias) return { name: h.name, shell: process.platform === 'win32' ? 'ssh.exe' : 'ssh', args: [h.name] }; // ssh applies the rest of the entry itself
  const args = [];
  if (h.port) args.push('-p', String(h.port));
  args.push(h.user ? `${h.user}@${h.host || h.name}` : (h.host || h.name));
  return { name: h.name, shell: process.platform === 'win32' ? 'ssh.exe' : 'ssh', args };
}

module.exports = { parseSshConfig, sshHosts, sshProfile };
