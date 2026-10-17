// The IRC lobby's real mode: a minimal client on plain net/tls, no library. Register, join,
// ping/pong, the messages a chat panel shows, CTCP ACTION and VERSION, and a flood-safe send
// queue. It only connects when config.json says irc.mode = 'real', and the only thing it says
// about you is the nick you chose (the realname is "GIBSON", the username is the nick).
const net = require('net');
const tls = require('tls');

const MAX_BYTES = 400;               // text per PRIVMSG: servers cut at 512 including our prefix
const BURST = 5, REFILL_MS = 1000;   // send queue: 5 lines at once, then 1 a second
const QUEUE_MAX = 100;               // a CTCP flood must not grow the queue forever

const stripColors = (s) => String(s).replace(/\x03(\d{1,2}(,\d{1,2})?)?|\x04([0-9a-f]{6}(,[0-9a-f]{6})?)?|[\x02\x0f\x11\x16\x1d\x1e\x1f]/gi, '');
const clean = (s) => String(s == null ? '' : s).replace(/[\r\n\0]/g, ' '); // no smuggled second command
const cleanNick = (s) => String(s || '').replace(/[^\w\-\[\]\\`^{}|]/g, '').slice(0, 16);
const defaultNick = () => 'gibson' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');

// ":nick!user@host CMD a b :trailing" -> { prefix, nick, command, params }
function parseLine(line) {
  let prefix = '', rest = line;
  if (rest[0] === '@') rest = rest.slice(rest.indexOf(' ') + 1); // IRCv3 tags: never asked for, ignored
  if (rest[0] === ':') { const i = rest.indexOf(' '); prefix = rest.slice(1, i); rest = rest.slice(i + 1); }
  const t = rest.indexOf(' :');
  const params = (t >= 0 ? rest.slice(0, t) : rest).split(' ').filter(Boolean);
  const command = (params.shift() || '').toUpperCase();
  if (t >= 0) params.push(rest.slice(t + 2));
  return { prefix, nick: prefix.split('!')[0], command, params };
}

// Split text into pieces of at most max UTF-8 bytes, at a space when one is near the end.
function splitText(text, max = MAX_BYTES) {
  const out = []; let cur = '';
  for (const ch of String(text)) {
    if (Buffer.byteLength(cur + ch) > max) {
      const sp = cur.lastIndexOf(' ');
      if (sp > cur.length / 2) { out.push(cur.slice(0, sp)); cur = cur.slice(sp + 1); } else { out.push(cur); cur = ''; }
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// cfg: { server, port, tls, nick, channels, password }. onEvent gets plain objects:
// { type: status|registered|msg|notice|join|part|quit|kick|nick|topic|names|server|error, from, target, text, ... }
function createIrc(cfg, onEvent) {
  let sock = null, buf = '', nick = cleanNick(cfg.nick) || defaultNick(), registered = false, quitting = false, backoff = 2000, retry = null;
  const queue = [], names = {};
  let tokens = BURST;
  const useTls = cfg.tls !== false, host = cfg.server, port = Number(cfg.port) || (useTls ? 6697 : 6667);
  const emit = (ev) => { try { onEvent({ time: Date.now(), ...ev }); } catch { /* the page went away */ } };
  const me = (n) => String(n).toLowerCase() === nick.toLowerCase();
  const raw = (line) => { if (sock && !sock.destroyed) sock.write(clean(line) + '\r\n'); };
  const flush = () => { while (registered && tokens > 0 && queue.length) { tokens--; raw(queue.shift()); } };
  const queued = (line) => { if (queue.length < QUEUE_MAX) queue.push(line); flush(); };
  const pump = setInterval(() => { tokens = Math.min(BURST, tokens + 1); flush(); }, REFILL_MS);
  pump.unref();

  function connect() {
    registered = false; buf = '';
    emit({ type: 'status', text: `connecting to ${host}:${port}${useTls ? ' (tls)' : ''}` });
    sock = useTls ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host }) : net.connect({ host, port });
    sock.setEncoding('utf8');
    sock.setTimeout(300000, () => sock.destroy()); // servers ping every few minutes; silence means a dead line
    sock.on(useTls ? 'secureConnect' : 'connect', () => {
      if (cfg.password) raw(`PASS ${cfg.password}`);
      raw(`NICK ${nick}`); raw(`USER ${nick} 0 * :GIBSON`);
    });
    sock.on('data', (d) => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); for (const l of lines) if (l) handle(l); });
    sock.on('error', (e) => emit({ type: 'error', text: e.message }));
    sock.on('close', () => {
      emit({ type: 'status', text: 'NO CARRIER' });
      if (quitting) return;
      emit({ type: 'status', text: `redialing in ${backoff / 1000}s` });
      retry = setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 60000);
    });
  }

  function handle(line) {
    const m = parseLine(line), p = m.params, from = m.nick || m.prefix;
    const text = (i) => stripColors(p[i] || '');
    switch (m.command) {
      case 'PING': return raw(`PONG :${p[0] || ''}`);
      case '001':
        registered = true; backoff = 2000; nick = p[0] || nick;
        emit({ type: 'registered', nick, text: text(1) });
        for (const c of cfg.channels || []) raw(`JOIN ${clean(c)}`);
        return flush();
      case '433': // nick in use: before we are in, take another one ourselves
        if (registered) return emit({ type: 'error', text: `${p[1]} is already in use` });
        nick = nick.length < 15 ? nick + '_' : nick.slice(0, 11) + Math.floor(Math.random() * 1000);
        return raw(`NICK ${nick}`);
      case 'PRIVMSG': case 'NOTICE': {
        const ctcp = /^\x01(\w+)(?: ([^\x01]*))?\x01?$/.exec(p[1] || '');
        if (ctcp) {
          const verb = ctcp[1].toUpperCase();
          if (verb === 'ACTION') return emit({ type: 'msg', from, target: p[0], text: stripColors(ctcp[2] || ''), action: true });
          if (m.command === 'PRIVMSG' && verb === 'VERSION') queued(`NOTICE ${from} :\x01VERSION GIBSON\x01`);
          if (m.command === 'PRIVMSG' && verb === 'PING') queued(`NOTICE ${from} :\x01PING ${ctcp[2] || ''}\x01`);
          return; // ponytail: other CTCPs (TIME, CLIENTINFO, DCC) go unanswered
        }
        return emit({ type: m.command === 'NOTICE' ? 'notice' : 'msg', from, target: p[0], text: text(1) });
      }
      case 'JOIN': return emit({ type: 'join', from, target: p[0], self: me(from) });
      case 'PART': return emit({ type: 'part', from, target: p[0], text: text(1), self: me(from) });
      case 'QUIT': return emit({ type: 'quit', from, text: text(0) });
      case 'KICK': return emit({ type: 'kick', from, target: p[0], who: p[1], text: text(2), self: me(p[1]) });
      case 'NICK': { const self = me(from); if (self) nick = p[0]; return emit({ type: 'nick', from, text: p[0], self }); }
      case 'TOPIC': return emit({ type: 'topic', from, target: p[0], text: text(1) });
      case '332': return emit({ type: 'topic', target: p[1], text: text(2) });
      case '353': (names[p[2]] = names[p[2]] || []).push(...(p[3] || '').split(' ').filter(Boolean)); return;
      case '366': emit({ type: 'names', target: p[1], names: names[p[1]] || [] }); delete names[p[1]]; return;
      case '002': case '003': case '372': case '375': case '376': return emit({ type: 'server', text: text(p.length - 1) });
      case 'ERROR': return emit({ type: 'error', text: text(0) });
      default: if (/^[45]\d\d$/.test(m.command)) emit({ type: 'error', text: stripColors(p.slice(1).join(' ')) });
    }
  }

  function send(target, msg, action) {
    target = clean(target).split(' ')[0];
    if (!target || !msg) return;
    for (const part of splitText(clean(msg), action ? MAX_BYTES - 9 : MAX_BYTES)) {
      queued(action ? `PRIVMSG ${target} :\x01ACTION ${part}\x01` : `PRIVMSG ${target} :${part}`);
      emit({ type: 'msg', from: nick, target, text: part, action: !!action, self: true });
    }
  }
  // A line from the input box: plain text goes to target, /commands do what irssi would.
  function command(line, target) {
    const m = /^\/(\S+)\s*(.*)$/.exec(String(line).trim());
    if (!m || m[1] === '/') return send(target, m ? String(line).trim().slice(1) : line); // "//text" says "/text"
    const cmd = m[1].toLowerCase(), rest = m[2], words = rest.split(' '), first = words[0], tail = words.slice(1).join(' ');
    const chan = /^[#&]/.test(first) ? [first, tail] : [target, rest]; // optional channel argument
    switch (cmd) {
      case 'me': return send(target, rest, true);
      case 'join': case 'j': return first ? queued(`JOIN ${first}`) : undefined;
      case 'part': case 'leave': return queued(`PART ${chan[0]} :${chan[1] || 'NO CARRIER'}`);
      case 'nick': { const n = cleanNick(first); if (!n) return; if (!registered) nick = n; return raw(`NICK ${n}`); }
      case 'msg': case 'query': return send(first, tail);
      case 'notice': return tail && queued(`NOTICE ${first} :${tail}`);
      case 'topic': return queued(chan[1] ? `TOPIC ${chan[0]} :${chan[1]}` : `TOPIC ${chan[0]}`);
      case 'names': return queued(`NAMES ${chan[0]}`);
      case 'quit': return quit(rest);
      case 'quote': case 'raw': return rest && queued(rest);
      default: return emit({ type: 'error', text: `unknown command /${cmd}` });
    }
  }
  function quit(msg) {
    quitting = true; clearTimeout(retry); clearInterval(pump);
    raw(`QUIT :${clean(msg || 'NO CARRIER')}`);
    if (sock) { sock.end(); setTimeout(() => sock.destroy(), 1000).unref(); }
  }

  connect();
  return { send: (target, text) => send(target, text), command, quit, nick: () => nick, server: host };
}

module.exports = { createIrc, parseLine, splitText, stripColors, defaultNick, cleanNick };
