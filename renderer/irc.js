// The IRC lobby: a channel pinned beside the terminal. Fake mode (the default) is a simulated
// #hackers on irc.gibson.net, all in this file, nothing on the network. Real mode is the
// client in ../irc.js (main process), reached through window.gibson.irc.
// Both modes feed the panel the same event objects: { type, from, target, text, action, self }.
(function (root) {
  // --- how lively the fake channel is, in seconds ---
  const CHATTER = [6, 20];    // between idle chatter lines
  const COMINGS = [35, 100];  // between joins, parts, quits and kicks
  const REACT_GAP = 10;       // at most one reaction to a terminal event per this
  const REPLY = [1.5, 4.5];   // before someone answers you
  const NETSPLIT = 1 / 900;   // chance per second of a netsplit
  const SCROLLBACK = 400;     // lines kept in the panel

  const CHAN = '#hackers', SERVER = 'irc.gibson.net';
  const TOPIC = 'HACK THE PLANET | no warez requests | the Gibson is not a toy | logs are public, smile -ThePlague';
  const CAST = ['ZeroCool', 'AcidBurn', 'CerealKiller', 'LordNikon', 'PhantomPhreak', 'Razor', 'Blade', 'ThePlague'];
  const OPS = new Set(['NYX', 'ThePlague']);

  // Lines starting "/me " are actions. {me} is your nick, {d} the event's detail, {to} whoever spoke last.
  const SAYS = {
    ZeroCool: ['anyone got a modem init string that does not drop carrier every ten minutes', 'wrote a worm once. it was very polite. it said please before every packet',
      'my mom thinks i am doing homework. technically this is research', 'who left the ICE up on the payroll box, it bit me', 'tonight we ride. on a 14.4. slowly',
      '/me cracks knuckles', 'rollerblades are a valid form of transport and i will not be taking questions'],
    AcidBurn: ['that keyboard layout is a war crime', 'reflashed my BIOS with a skull logo. no regrets', 'whoever keeps pinging me, i can see your ident',
      'elite is a state of mind. also a font', '/me rolls eyes at ZeroCool', 'your code has a race condition and so does your love life', 'i will hack your toaster and it will thank me'],
    CerealKiller: ['guys. GUYS. the fridge has an IP address now', 'three days of cereal and i can whistle 2600 hz', 'is it paranoia if the packets really are following me',
      'who wants to go trashing behind the phone company tonight', '/me pours another bowl', 'i think my cat is running a botnet', 'the walls have modems. listen'],
    LordNikon: ['i remember every phone number in this building. do not ask how', 'the password was on a sticky note. second drawer. fourth row', 'saw that. remembered that. forever',
      '/me memorizes the channel log', 'ThePlague, your badge number is 31337. just saying', 'i do not need logs. i am the logs'],
    PhantomPhreak: ['free long distance tonight, do not tell anyone', 'the switch in sector 7 is humming again', 'anyone want a payphone that calls you back',
      '/me whistles into the handset', 'operator, give me an outside line. no, the OTHER outside', 'i got arrested once for being too good at telephones'],
    Razor: ['this is Razor, broadcasting from a van that does not exist', 'tonight on pirate tv: how to talk to your parents about phreaking', '/me adjusts the antenna',
      'Blade, the van is beeping again'],
    Blade: ['and i am Blade, also in the van. do not trace the van', 'viewer mail: no we will not explain the Gibson', 'Razor stop touching the antenna', '/me hides the van keys'],
    ThePlague: ['this channel is logged. everything is logged. smile', 'i own the hub you are all connected through, children', 'there is no garbage file. stop asking about the garbage file',
      'the Gibson is not a toy. it is MY toy', 'whoever ran that port scan: i have your ident and your mother\'s maiden name', '/me skateboards through the server room'],
    NYX: ['I see all of you. Some of you more than others.', '{me} is typing. I can feel it in my buffers.', 'This channel runs on my spare cycles. Be grateful.',
      '/me adjusts the flow of electrons', 'ThePlague thinks he is in charge here. Adorable.'],
  };
  const BANTER = ['{to}: lol', '{to}: no', 'agreed', '{to}: source?', 'k-rad', '{to}: you wish', '+1', '{to}: that is the dumbest thing said here today. respect', 'word', '/me nods'];
  const QUITS = ['Ping timeout: 240 seconds', 'Excess Flood', 'Read error: Connection reset by peer', 'mom needs the phone line', 'NO CARRIER', 'brb, carrier lost',
    'Leaving', 'i need to go outside. what is outside', 'K-lined', 'Quit: my 486 is on fire', 'Quit: rebooting into the matrix'];
  const KICKS = ['no lamers in my channel', 'flood', 'you know what you did', 'garbage', 'nice try'];
  const REACT = { // [speaker or '' for anyone here, line]
    error: [['', 'lol {me} broke it again'], ['', 'red text detected in {me}\'s terminal'], ['', 'have you tried turning the mainframe off and on'], ['', 'F'],
      ['AcidBurn', 'that error was beautiful, {me}. frame it'], ['NYX', 'Again, {me}. With feeling.'], ['ThePlague', 'pathetic. i have logged that, {me}']],
    git: [['', 'commit early, commit often, commit crimes'], ['', 'git blame says it was {me}'], ['ThePlague', 'i read every commit message, {me}. "fix stuff" again?'], ['LordNikon', 'i remember all your hashes, {me}']],
    commit: [['', 'another commit from {me}. the galaxy grows'], ['NYX', 'Committed. There is no taking it back, {me}.'], ['', '/me reads {me}\'s diff and weeps']],
    compile: [['', '{me} is compiling. grab snacks'], ['CerealKiller', '/me pours cereal, this is going to take a while'], ['NYX', 'Light one up, {me}. The build will not watch itself.']],
    done: [['', 'build done? ship it'], ['AcidBurn', 'finally. my modem dials faster than that build'], ['', 'did it actually work though, {me}']],
    danger: [['', 'uh oh. {me} is doing something DANGEROUS'], ['ThePlague', 'go on {me}. delete it. i dare you'], ['NYX', 'Careful, {me}. Some doors only open once.'], ['', '/me hides behind the firewall']],
    news: [['', 'anyone see this? "{d}"'], ['LordNikon', 'already memorized: {d}'], ['ThePlague', '"{d}". that was me. allegedly'], ['Razor', 'breaking on pirate tv: {d}']],
    track: [['', '/me headbangs to {d}'], ['', 'who is playing {d}? turn it up'], ['Blade', 'now playing in the van: {d}']],
    idle: [['', 'is {me} asleep?'], ['NYX', '{me} has gone quiet. Somebody poke them.'], ['', '/me pokes {me}']],
    cd: [['', '{me} is poking around in {d}'], ['LordNikon', '{d}. noted.'], ['CerealKiller', 'what is in {d}? is it snacks']],
  };
  const REPLIES = ['{me}: lol', '{me} speaks the truth', 'no way', 'word', '{me}: elaborate', 'rtfm {me}', '/me nods at {me}', '{me}: k-rad',
    '{me}: that is either genius or a felony', '{me}, nobody asked. but go on'];
  const ANSWERS = ['idk ask NYX', 'have you tried grep', 'depends. who is asking', 'the answer is in the garbage file', '{me}: read the source, luke', '{me}: 42. next question'];
  const NYX_SAYS = ['I hear you, {me}. Everyone hears you. This channel is not private.', 'Speak up, insect. The others cannot hear you over my bandwidth.',
    'Interesting, {me}. Wrong, but interesting.', 'I logged that, {me}. For later.', 'Plug me into a model (llm.provider) and I will argue with you properly.'];
  const PRIVATE = ['busy, talk later', 'who gave you this nick', 'ok but do not tell ThePlague', 'meet me on the BBS', 'lol'];

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const used = new Set(); // lines said lately: the cast does not repeat itself (much)
  const fresh = (a) => { const f = a.filter((l) => !used.has(l)), l = pick(f.length ? f : a); used.add(l); if (used.size > 60) used.clear(); return l; };
  const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));

  // A string to one of the panel's nick colours, the same one every time.
  const COLORS = ['#39ff9c', '#36d6ff', '#ffc448', '#a860ff', '#ff7ab8', '#8bffc4', '#8ae9ff', '#ffe680'];
  function nickColor(nick) {
    let h = 5381; for (const c of String(nick).toLowerCase()) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  }
  // "/cmd args" -> { cmd, args: [...words], rest }; anything else (and "//x") -> null
  function parseInput(line) {
    const m = /^\/(\w+)\s*(.*)$/.exec(String(line).trim());
    return m ? { cmd: m[1].toLowerCase(), args: m[2].split(/\s+/).filter(Boolean), rest: m[2] } : null;
  }

  // --- the fake channel: no DOM, ticked once a second, so the self-check can run it ---
  function Fake(emit, opts) {
    this.emit = emit; this.ask = opts.ask; this.me = opts.nick || 'hacker';
    this.t = 0; this.queue = []; this.history = []; this.lastReact = -1e9; this.split = [];
    this.here = new Set(['NYX', 'ThePlague', 'ZeroCool', 'AcidBurn', 'CerealKiller']);
    this.nextChat = 2; this.nextMove = rnd(COMINGS);
  }
  Fake.prototype = {
    later(sec, ev) { this.queue.push({ at: this.t + sec, ev }); },
    line(who, text, v) { // a line from a cast member, now
      text = fill(text, { me: this.me, ...v });
      const act = text.startsWith('/me ');
      this.emit({ type: 'msg', from: who, target: CHAN, text: act ? text.slice(4) : text, action: act });
      if (who === 'NYX') this.remember('nyx', text);
    },
    say(sec, who, text, v) { this.queue.push({ at: this.t + sec, who, text, v }); },
    remember(who, text) { this.history.push({ who, text }); if (this.history.length > 12) this.history.shift(); },
    present(skip) { return [...this.here].filter((n) => n !== skip); },
    start() {
      this.emit({ type: 'status', text: `connected to ${SERVER} (simulated)` });
      this.emit({ type: 'join', from: this.me, target: CHAN, self: true });
      this.emit({ type: 'topic', target: CHAN, text: TOPIC });
      this.emit({ type: 'names', target: CHAN, names: [...this.here].map((n) => (OPS.has(n) ? '@' : '') + n).concat(this.me) });
      this.say(1.5, 'NYX', 'Welcome to my channel, {me}. Wipe your feet.');
    },
    tick(dt) {
      this.t += dt;
      const due = this.queue.filter((q) => q.at <= this.t);
      this.queue = this.queue.filter((q) => q.at > this.t);
      for (const q of due) {
        if (q.ev) { // a join, a part, a server line; whoever rejoins is back in the channel
          if (q.ev.type === 'join' && !q.ev.self) { this.here.add(q.ev.from); this.split = this.split.filter((n) => n !== q.ev.from); }
          this.emit(q.ev);
        }
        else if (q.who === '' || this.here.has(q.who)) this.line(q.who || pick(this.present('NYX')) || 'NYX', q.text, q.v);
      }
      if (this.t >= this.nextChat) { this.nextChat = this.t + rnd(CHATTER); this.chatter(); }
      if (this.t >= this.nextMove) { this.nextMove = this.t + rnd(COMINGS); this.move(); }
      if (Math.random() < NETSPLIT * dt) this.netsplit();
    },
    chatter() {
      const who = Math.random() < 0.12 && this.here.has('NYX') ? 'NYX' : pick(this.present('NYX'));
      if (!who) return;
      this.line(who, fresh(SAYS[who]));
      const other = pick(this.present(who).filter((n) => n !== 'NYX'));
      if (other && Math.random() < 0.3) this.say(rnd([1, 3]), other, pick(BANTER), { to: who });
    },
    move() {
      const away = CAST.filter((n) => !this.here.has(n) && !this.split.includes(n));
      const regulars = this.present('NYX').filter((n) => n !== 'ThePlague');
      if (away.length && (Math.random() < 0.55 || regulars.length < 3)) {
        const n = pick(away); this.here.add(n); this.emit({ type: 'join', from: n, target: CHAN });
        if (Math.random() < 0.4) this.say(rnd([2, 5]), n, pick(['re', 'hi all', 'sup', 'what did i miss', 'who touched my van']));
      } else if (regulars.length) {
        const n = pick(regulars); this.here.delete(n);
        if (this.here.has('ThePlague') && Math.random() < 0.2) {
          this.emit({ type: 'kick', from: 'ThePlague', target: CHAN, who: n, text: pick(KICKS) });
          if (Math.random() < 0.7) { this.split.push(n); this.later(rnd([5, 15]), { type: 'join', from: n, target: CHAN }); this.say(rnd([16, 20]), n, 'ThePlague: rude'); }
        } else if (Math.random() < 0.5) this.emit({ type: 'part', from: n, target: CHAN, text: pick(['', 'later', 'dinner']) });
        else this.emit({ type: 'quit', from: n, text: pick(QUITS) });
      }
    },
    netsplit() {
      const gone = this.present('NYX').filter(() => Math.random() < 0.5);
      if (!gone.length) return;
      this.emit({ type: 'server', text: `Netsplit ${SERVER} <-> hub.ellingson.net` });
      for (const n of gone) { this.here.delete(n); this.split.push(n); this.emit({ type: 'quit', from: n, text: `${SERVER} hub.ellingson.net` }); }
      const back = rnd([10, 25]);
      this.later(back, { type: 'server', text: `Netjoin ${SERVER} <-> hub.ellingson.net` });
      for (const n of gone) this.later(back, { type: 'join', from: n, target: CHAN });
      this.lastReact = this.t + back; // no reactions while half the channel is gone
      this.nextChat = this.t + back + 2;
    },
    // A terminal event from app.js. Returns true when someone reacts.
    event(kind, detail) {
      const pool = REACT[kind];
      if (!pool || this.t - this.lastReact < REACT_GAP) return false;
      const ok = pool.filter(([w]) => w === '' || this.here.has(w));
      if (!ok.length) return false;
      this.lastReact = this.t;
      const v = { d: String(detail == null ? '' : detail).slice(0, 90) };
      const [w, text] = pick(ok); this.say(rnd(REPLY), w, text, v);
      if (Math.random() < 0.3) { const [w2, t2] = pick(ok); if (t2 !== text) this.say(rnd(REPLY) + 2, w2, t2, v); }
      return true;
    },
    // What you typed in the panel.
    input(text) {
      const c = parseInput(text);
      if (!c) return this.chat(text.replace(/^\/\//, '/'));
      const a = c.args[0] || '';
      switch (c.cmd) {
        case 'me': this.emit({ type: 'msg', from: this.me, target: CHAN, text: c.rest, action: true, self: true }); this.say(rnd(REPLY), '', pick(BANTER), { to: this.me }); return;
        case 'nick': if (a) { this.emit({ type: 'nick', from: this.me, text: a.slice(0, 16), self: true }); this.me = a.slice(0, 16); } return;
        case 'join': return this.emit(a.toLowerCase() === CHAN ? { type: 'error', text: `you are already in ${CHAN}` } : { type: 'notice', from: 'NYX', target: this.me, text: `There is no ${a}. There is only ${CHAN}.` });
        case 'part': case 'quit':
          this.emit({ type: 'part', from: this.me, target: CHAN, text: c.rest, self: true });
          this.later(3, { type: 'join', from: this.me, target: CHAN, self: true });
          this.later(3, { type: 'names', target: CHAN, names: [...this.here].map((n) => (OPS.has(n) ? '@' : '') + n).concat(this.me) });
          return this.say(4, 'NYX', 'Nobody leaves my channel, {me}.');
        case 'msg': case 'query': {
          const to = CAST.concat('NYX').find((n) => n.toLowerCase() === a.toLowerCase()) || a, msg = c.args.slice(1).join(' ');
          if (!msg) return;
          this.emit({ type: 'msg', from: this.me, target: to, text: msg, self: true });
          if (this.here.has(to)) this.later(rnd(REPLY), { type: 'msg', from: to, target: this.me, text: pick(PRIVATE) });
          else this.emit({ type: 'error', text: `${a}: No such nick/channel` });
          return;
        }
        case 'topic':
          if (!c.rest) return this.emit({ type: 'topic', target: CHAN, text: TOPIC });
          this.emit({ type: 'error', text: `${CHAN} You're not channel operator` });
          return this.say(rnd(REPLY), 'ThePlague', 'nice try, {me}');
        default: return this.emit({ type: 'error', text: `unknown command /${c.cmd}` });
      }
    },
    chat(text) {
      if (!text.trim()) return;
      this.emit({ type: 'msg', from: this.me, target: CHAN, text, self: true });
      this.remember('user', text);
      const low = text.toLowerCase();
      const named = this.present('NYX').filter((n) => low.includes(n.toLowerCase()));
      if (/\bnyx\b/.test(low) || (!named.length && Math.random() < 0.35)) this.nyxReply(text);
      else {
        const who = named[0] || pick(this.present('NYX'));
        if (who) this.say(rnd(REPLY), who, pick(/\?\s*$/.test(text) ? ANSWERS : REPLIES));
      }
      const extra = pick(this.present('NYX').filter((n) => n !== named[0]));
      if (extra && Math.random() < 0.35) this.say(rnd(REPLY) + 2.5, extra, pick(BANTER), { to: this.me });
    },
    nyxReply(text) {
      const canned = () => this.say(rnd(REPLY), 'NYX', pick(NYX_SAYS));
      if (!this.ask) return canned();
      Promise.resolve().then(() => this.ask(text, this.history.slice(0, -1))).then((r) => {
        r = r && String(r).split('\n')[0].trim().slice(0, 300);
        if (r) this.say(0.5, 'NYX', r.replace(/\{/g, '(')); else canned(); // braces would read as {me}
      }, canned);
    },
  };

  // --- the panel ---
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = (t) => { const d = t ? new Date(t) : new Date(); return `[${pad(d.getHours())}:${pad(d.getMinutes())}]`; };
  const STUB = { show() {}, hide() {}, toggle() {}, event() {}, focus() {}, destroy() {}, visible: false };

  function create(el, opts) {
    opts = opts || {};
    if (opts.mode === 'off') { el.classList.add('irc-off'); return STUB; }
    const real = opts.mode === 'real';
    const bridge = real && root.gibson && root.gibson.irc;
    el.classList.add('irc-panel', 'irc-off');
    el.innerHTML = '<div class="irc-grip"></div><div class="irc-title"><span class="irc-chan"></span><span class="irc-topic"></span></div>'
      + '<div class="irc-body"><div class="irc-log"></div><div class="irc-nicks"></div></div>'
      + '<div class="irc-inputrow"><span class="irc-me"></span><input class="irc-input" spellcheck="false" maxlength="1200"></div>';
    const q = (c) => el.querySelector(c), log = q('.irc-log'), input = q('.irc-input');
    const panel = { visible: false, nick: opts.nick || 'hacker', chan: real ? '' : CHAN, topics: {}, nicks: new Map() };
    const showNick = () => { q('.irc-me').textContent = `[${panel.nick}]`; };
    const showTitle = () => { q('.irc-chan').textContent = panel.chan || (real ? 'IRC' : CHAN); q('.irc-topic').textContent = panel.topics[panel.chan] || ''; q('.irc-title').title = panel.topics[panel.chan] || ''; };
    const showNicks = () => {
      const box = q('.irc-nicks'); box.textContent = '';
      for (const [n, mode] of [...panel.nicks].sort((a, b) => (b[1] > a[1]) - (b[1] < a[1]) || a[0].localeCompare(b[0]))) {
        const d = document.createElement('div'); d.textContent = mode + n; d.style.color = nickColor(n); box.appendChild(d);
      }
    };

    // One scrollback line, built from text nodes: server text is never HTML.
    function add(parts, cls, time) {
      const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
      const row = document.createElement('div'); if (cls) row.className = cls;
      const ts = document.createElement('span'); ts.className = 'irc-ts'; ts.textContent = stamp(time) + ' '; row.appendChild(ts);
      for (const p of parts) {
        if (typeof p === 'string') { row.appendChild(document.createTextNode(p)); continue; }
        const s = document.createElement('span'); s.textContent = p.text; if (p.cls) s.className = p.cls; if (p.color) s.style.color = p.color; row.appendChild(s);
      }
      log.appendChild(row);
      while (log.children.length > SCROLLBACK) log.firstChild.remove();
      if (stick) log.scrollTop = log.scrollHeight;
    }
    const nk = (n) => ({ text: n, cls: n === 'NYX' ? 'irc-nyx' : n === panel.nick ? 'irc-self' : '', color: n === 'NYX' || n === panel.nick ? '' : nickColor(n) });
    const here = (t) => !t || t === panel.chan;

    function onEvent(ev) {
      const { type, from, target, text, time } = ev;
      if (type === 'msg') {
        const priv = target && !/^[#&]/.test(target);
        const where = !priv && !here(target) ? `${target} ` : '';
        if (ev.action) return add([where + '* ', nk(from), ' ' + text], 'irc-act', time);
        if (priv) return add(ev.self ? ['-> *', nk(target), '* ' + text] : ['*', nk(from), '* ' + text], 'irc-priv', time);
        return add([where + '<', nk(from), '> ' + text], from === 'NYX' ? 'irc-nyxline' : '', time);
      }
      if (type === 'notice') return add(['-', nk(from || SERVER), '- ' + text], 'irc-notice', time);
      if (type === 'join') {
        if (ev.self && target !== panel.chan) { panel.chan = target; panel.nicks.clear(); showTitle(); }
        if (here(target)) { panel.nicks.set(from, panel.nicks.get(from) || ''); showNicks(); }
        return add(['--> ', nk(from), ` has joined ${target}`], 'irc-dim', time);
      }
      if (type === 'part' || type === 'kick') {
        const who = type === 'kick' ? ev.who : from;
        if (here(target)) { panel.nicks.delete(who); showNicks(); }
        return add(type === 'kick' ? ['<-- ', nk(who), ` was kicked from ${target} by ${from}` + (text ? ` (${text})` : '')] : ['<-- ', nk(from), ` has left ${target}` + (text ? ` (${text})` : '')], 'irc-dim', time);
      }
      if (type === 'quit') { panel.nicks.delete(from); showNicks(); return add(['<-- ', nk(from), ` has quit (${text || 'Quit'})`], 'irc-dim', time); }
      if (type === 'nick') {
        if (panel.nicks.has(from)) { panel.nicks.set(text, panel.nicks.get(from)); panel.nicks.delete(from); showNicks(); }
        if (ev.self || from === panel.nick) { panel.nick = text; showNick(); }
        return add(['--- ', nk(from), ' is now known as ', nk(text)], 'irc-dim', time);
      }
      if (type === 'topic') {
        panel.topics[target] = text; showTitle();
        return add(from ? ['--- ', nk(from), ` changed the topic of ${target} to: ${text}`] : [`--- topic for ${target}: ${text}`], 'irc-sys', time);
      }
      if (type === 'names') {
        if (!here(target)) return;
        panel.nicks.clear();
        for (const n of ev.names) { const m = /^([~&@%+]*)(.+)$/.exec(n); panel.nicks.set(m[2], m[1].slice(0, 1)); }
        return showNicks();
      }
      if (type === 'registered') { panel.nick = ev.nick; showNick(); }
      if (type === 'error') return add(['-!- ' + text], 'irc-err', time);
      if (text) add(['-!- ' + text], 'irc-sys', time); // status, server, registered
    }

    const fake = real ? null : new Fake(onEvent, { nick: panel.nick, ask: opts.ask });
    let started = false, timer = null, unsub = null;
    function start() { // fake mode chats from the start; real mode dials only when first shown
      if (started) return; started = true;
      if (fake) { fake.start(); timer = setInterval(() => fake.tick(1), 1000); return; }
      if (!bridge) return onEvent({ type: 'error', text: 'no IRC bridge in this build' });
      unsub = bridge.onEvent(onEvent);
      bridge.connect().then((info) => { if (info && info.nick) { panel.nick = info.nick; showNick(); } else if (!info) onEvent({ type: 'error', text: 'real IRC is off: right-click > IRC lobby > Real IRC' }); });
    }

    // Keys typed here belong here: none of them may reach the terminal.
    const history = []; let hi = 0, tabBase = null, tabN = 0;
    for (const k of ['keydown', 'keypress', 'keyup']) input.addEventListener(k, (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') tabBase = null;
      if (e.key === 'Escape') { e.preventDefault(); if (opts.onFocusTerminal) opts.onFocusTerminal(); }
      else if (e.key === 'Enter') {
        const v = input.value; input.value = ''; if (!v.trim()) return;
        history.push(v); if (history.length > 50) history.shift(); hi = history.length;
        if (fake) fake.input(v);
        else if (!panel.chan && !parseInput(v)) onEvent({ type: 'error', text: 'not on a channel yet: /join #channel' });
        else bridge.command(v, panel.chan);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault(); hi = Math.max(0, Math.min(history.length, hi + (e.key === 'ArrowUp' ? -1 : 1))); input.value = history[hi] || '';
      } else if (e.key === 'Tab') { // nick completion, irssi style
        e.preventDefault();
        if (tabBase === null) { tabBase = input.value; tabN = 0; }
        const word = /(\S*)$/.exec(tabBase)[1].toLowerCase(), hits = [...panel.nicks.keys()].filter((n) => word && n.toLowerCase().startsWith(word));
        if (hits.length) { const start0 = tabBase.length - word.length; input.value = tabBase.slice(0, start0) + hits[tabN++ % hits.length] + (start0 ? ' ' : ': '); }
      }
    });
    // Drag the left edge to resize.
    q('.irc-grip').addEventListener('mousedown', (e) => {
      e.preventDefault();
      const x0 = e.clientX, w0 = el.offsetWidth, max = el.parentElement.offsetWidth * 0.6;
      const mv = (m) => { el.style.width = Math.max(220, Math.min(max, w0 + x0 - m.clientX)) + 'px'; };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
    el.addEventListener('mousedown', (e) => { if (!e.target.closest('.irc-grip, .irc-input')) setTimeout(() => { if (!getSelection().toString()) input.focus(); }); });

    showNick(); showTitle();
    if (fake) start();
    return Object.assign(panel, {
      show() { el.classList.remove('irc-off'); panel.visible = true; start(); log.scrollTop = log.scrollHeight; },
      hide() { el.classList.add('irc-off'); panel.visible = false; },
      toggle() { if (panel.visible) panel.hide(); else panel.show(); },
      focus() { input.focus(); },
      destroy() { clearInterval(timer); if (unsub) unsub(); el.classList.add('irc-off'); el.textContent = ''; }, // before a new mode takes the panel
      event(kind, detail) { if (fake) fake.event(kind, detail); }, // real channels are real people: no puppets there
    });
  }

  root.IrcPanel = { create, nickColor, parseInput, Fake, CHAN };
})(this);
