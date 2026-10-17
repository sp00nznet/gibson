// Theatre: Hackers-movie set pieces, each a DOM overlay over a pane (or the whole
// window). Never writes into xterm (ConPTY paints over that). Each one cleans up
// after itself and calls done() so the caller can refocus the terminal; each
// returns { close() } too. Sounds are tiny WebAudio synths, silent at volume 0.
(function (root) {
  // --- CP437 ------------------------------------------------------------------
  // 0x00-0x1F as their glyphs, except tab, LF and CR, which real .nfo files need as text.
  const LOW = ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼';
  const HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
  const TABLE = [];
  for (let i = 0; i < 256; i++) TABLE[i] = i === 9 || i === 10 || i === 13 ? String.fromCharCode(i) : i < 32 ? LOW[i] : i === 127 ? '⌂' : i < 128 ? String.fromCharCode(i) : HIGH[i - 128];
  function cp437(bytes) { let s = ''; for (const b of bytes) s += TABLE[b]; return s; }

  // --- audio: one shared context, made on first sound -------------------------
  let AC = null;
  function out(v) { // a gain node to play into, or null when silent / no audio device
    if (!(v > 0)) return null;
    try { AC = AC || new (root.AudioContext || root.webkitAudioContext)(); } catch { return null; }
    if (AC.state === 'suspended') AC.resume();
    const g = AC.createGain(); g.gain.value = v; g.connect(AC.destination); return g;
  }
  const vol = (o) => (o && o.mute ? 0 : o && o.volume != null ? o.volume : api.volume);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function blip(dest, f, t, len, type, peak) {
    const c = dest.context, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(peak || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(dest); o.start(t); o.stop(t + len + 0.02); return o;
  }
  const now = (d) => d.context.currentTime + 0.01;

  // A little tracker tune: A minor, Am F C G, a 1/32 square arp, a triangle bass, a square lead.
  const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
  const LEAD = [76, 0, 72, 0, 74, 76, 0, 79, 77, 0, 76, 74, 72, 0, 69, 0, 72, 0, 74, 0, 76, 79, 0, 84, 83, 0, 81, 79, 74, 0, 79, 0]; // 8ths, 0 = rest
  function chiptune(v) {
    const d = out(v * 0.25); if (!d) return () => {};
    const c = d.context, st = 60 / 140 / 4; let step = 0, next = c.currentTime + 0.1;
    const iv = setInterval(() => {
      while (next < c.currentTime + 0.15) {
        const bar = Math.floor(step / 16) % 4, i = step % 16, ch = CHORDS[bar];
        blip(d, mtof(ch[(step * 2) % 3] + 12), next, st / 2 * 0.9, 'square', 0.05);
        blip(d, mtof(ch[(step * 2 + 1) % 3] + 12), next + st / 2, st / 2 * 0.9, 'square', 0.05);
        if (i % 2 === 0) blip(d, mtof(ch[0] - 24 + (i % 4 ? 12 : 0)), next, st * 1.8, 'triangle', 0.35);
        const n = LEAD[(step >> 1) % 32]; if (i % 2 === 0 && n) blip(d, mtof(n), next, st * 1.9, 'square', 0.09);
        next += st; step++;
      }
    }, 25);
    return () => { clearInterval(iv); d.gain.setTargetAtTime(0, c.currentTime, 0.03); setTimeout(() => d.disconnect(), 400); };
  }
  function carrierTone(v) { // answer tone, then the handshake chirps
    const d = out(v * 0.12); if (!d) return; let t = now(d);
    blip(d, 2100, t, 0.7, 'sine', 0.6); t += 0.7;
    for (let k = 0; k < 8; k++) { blip(d, [1200, 2400, 1800, 980][k % 4], t, 0.07, 'square', 0.25); t += 0.08; }
  }
  function klaxon(v) {
    const d = out(v * 0.18); if (!d) return; const t = now(d);
    for (let i = 0; i < 4; i++) {
      const o = blip(d, 420, t + i * 0.75, 0.7, 'sawtooth', 0.5);
      o.frequency.linearRampToValueAtTime(840, t + i * 0.75 + 0.6);
    }
  }
  function sting(v, good) { // ACCESS GRANTED rises, FIREWALL buzzes
    const d = out(v * 0.15); if (!d) return; const t = now(d);
    if (good) [69, 73, 76, 81].forEach((m, i) => blip(d, mtof(m + 12), t + i * 0.09, 0.3, 'triangle', 0.5));
    else for (let i = 0; i < 3; i++) blip(d, 98, t + i * 0.22, 0.18, 'sawtooth', 0.5);
  }
  const tick = (v) => { const d = out(v * 0.05); if (d) blip(d, 1800 + Math.random() * 600, now(d), 0.02, 'square', 0.4); };
  const buzz = (v) => { const d = out(v * 0.12); if (d) blip(d, 92, now(d), 0.3, 'sawtooth', 0.5); };
  const munch = (v) => { const d = out(v * 0.12); if (d) [180, 140, 170, 120].forEach((f, i) => blip(d, f, now(d) + i * 0.16, 0.09, 'square', 0.4)); };

  // --- the overlay every set piece lives in -----------------------------------
  // onKey(e) runs in the capture phase, before xterm sees the key.
  function overlay(container, cls, done, onKey) {
    const el = document.createElement('div');
    el.className = 'th-ov ' + cls + (container === document.body ? ' th-fixed' : '');
    container.appendChild(el);
    let closed = false; const timers = new Set();
    const key = (e) => onKey(e, h);
    const h = {
      el, onclose: null,
      get closed() { return closed; },
      close() {
        if (closed) return; closed = true;
        if (onKey) root.removeEventListener('keydown', key, true);
        for (const t of timers) clearTimeout(t);
        el.remove(); if (h.onclose) h.onclose(); if (done) done();
      },
      after(ms, f) { const t = setTimeout(() => { timers.delete(t); if (!closed) f(); }, ms); timers.add(t); },
      wait: (ms) => new Promise((r) => h.after(ms, r)), // never resolves once closed: the sequence just stops
    };
    if (onKey) root.addEventListener('keydown', key, true);
    return h;
  }
  const eat = (e) => { e.preventDefault(); e.stopPropagation(); };
  const escCloses = (e, h) => { if (e.key === 'Escape') { eat(e); h.close(); } };
  const div = (parent, cls, text) => { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; parent.appendChild(d); return d; };
  async function type(h, el, s, ms) { for (let i = 1; i <= s.length; i++) { el.textContent = s.slice(0, i); await h.wait(ms || 14); } }

  // --- 1. the .nfo viewer -----------------------------------------------------
  function nfo(container, bytes, name, done, opts) {
    const end = bytes.indexOf(0x1a); // SAUCE and other trailers live past ^Z
    const text = cp437(end >= 0 ? bytes.subarray(0, end) : bytes).replace(/\r\n?/g, '\n').replace(/\t/g, '        ');
    const NAV = { ArrowUp: -1, ArrowDown: 1, PageUp: -20, PageDown: 20, Home: -1e6, End: 1e6 };
    let auto = true;
    const h = overlay(container, 'th-nfo', done, (e, h) => {
      if (e.key === 'Escape') { eat(e); h.close(); }
      else if (e.key in NAV) { eat(e); auto = false; scroll.scrollTop += NAV[e.key] * lineH(); }
    });
    const bar = div(h.el, 'th-bar');
    div(bar, 'th-name', `▓▒░ ${name || 'untitled.nfo'} ░▒▓  ${bytes.length} bytes`);
    div(bar, 'th-hint', '↑↓ PgUp PgDn wheel · ESC close');
    const scroll = div(h.el, 'th-scroll'), pre = document.createElement('pre');
    pre.className = 'th-text'; pre.textContent = text; scroll.appendChild(pre);
    const lineH = () => parseFloat(getComputedStyle(pre).lineHeight) || 14;
    scroll.addEventListener('wheel', () => { auto = false; }, { passive: true });
    scroll.addEventListener('mousedown', () => { auto = false; }); // grabbing the scrollbar
    // Slow auto-scroll; at the bottom it rests, then starts over from the top.
    let pos = 0, last = 0, rest = 1500, back = false;
    const step = (t) => {
      if (h.closed) return;
      const dt = last ? Math.min(t - last, 100) : 0; last = t;
      if (auto) {
        if (rest > 0) { if ((rest -= dt) <= 0 && back) { back = false; pos = scroll.scrollTop = 0; rest = 1500; } }
        else if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1) { rest = 4000; back = true; }
        else { pos += dt * 0.02; scroll.scrollTop = pos; } // 20 px/s
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    h.onclose = chiptune(vol(opts));
    return { close: h.close };
  }

  // --- 2. port-scan theatre ---------------------------------------------------
  const SERVICES = [[21, 'ftp'], [22, 'ssh'], [23, 'telnet'], [25, 'smtp'], [53, 'domain'], [79, 'finger'], [80, 'http'], [110, 'pop3'], [113, 'ident'], [139, 'netbios-ssn'], [143, 'imap'], [443, 'https'], [512, 'exec'], [513, 'login'], [514, 'shell'], [1080, 'socks'], [6667, 'irc'], [8080, 'http-proxy'], [12345, 'netbus'], [31337, 'elite']];
  const OSES = ['GIBSON MAINFRAME / ELLINGSON OS 4.2', 'GIBSON MAINFRAME / ELLINGSON OS 4.2', 'GIBSON MAINFRAME / ELLINGSON OS 4.2', 'VAX/VMS 5.5-2', 'SunOS 4.1.3_U1', 'IRIX 6.2'];
  const hash = (s) => { let x = 2166136261; for (const ch of s) x = Math.imul(x ^ ch.charCodeAt(0), 16777619); return x >>> 0; };
  // Pure: everything the scan will "find". No packet ever leaves the machine.
  function scanReport(host, rnd) {
    rnd = rnd || Math.random; host = String(host || 'gibson');
    const x = hash(host);
    const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : `${10 + (x % 200)}.${(x >>> 8) & 255}.${(x >>> 16) & 255}.${((x >>> 24) % 254) + 1}`;
    const ports = SERVICES.filter(([p]) => p === 22 || p === 80 || rnd() < 0.35)
      .map(([port, service]) => ({ port, service, state: port === 22 || port === 80 || rnd() < 0.7 ? 'open' : 'filtered' }));
    return { host, ip, ports, os: OSES[Math.floor(rnd() * OSES.length)], accuracy: 88 + Math.floor(rnd() * 12), granted: rnd() < 0.6 };
  }
  function scan(container, host, done, opts) {
    const v = vol(opts), r = scanReport(host);
    const h = overlay(container, 'th-scan', done, escCloses);
    h.el.onclick = h.close;
    const pre = div(h.el, 'th-out');
    const line = (s, cls) => { const d = div(pre, 'th-l ' + (cls || ''), s); pre.scrollTop = 1e9; return d; };
    const pad = (s, n) => String(s).padEnd(n);
    (async () => {
      line('GSCAN 2.11 :: GIBSON SECURITY SCANNER', 'th-gold');
      line(`Starting scan at ${new Date().toTimeString().slice(0, 8)}`, 'th-dim');
      await h.wait(300);
      await type(h, line('', 'th-ice'), `Initiating SYN stealth scan against ${r.host} (${r.ip})`);
      const prog = line(''), open = r.ports.filter((p) => p.state === 'open');
      for (let pct = 0, k = 0; pct <= 100; pct += 4) {
        prog.textContent = `[${'█'.repeat(pct / 4).padEnd(25, '░')}] ${pct}% done`;
        if (k < open.length && Math.random() < 0.35) { line(`Discovered open port ${open[k].port}/tcp on ${r.ip}`, 'th-dim'); k++; tick(v); }
        await h.wait(70);
      }
      line(`Completed SYN stealth scan: ${SERVICES.length * 50} ports in ${(1.5 + Math.random() * 2).toFixed(2)}s`);
      line('');
      line(`${pad('PORT', 10)}${pad('STATE', 10)}SERVICE`, 'th-ice');
      for (const p of r.ports) { line(`${pad(p.port + '/tcp', 10)}${pad(p.state, 10)}${p.service}`, p.state === 'open' ? (p.port === 31337 ? 'th-hot' : '') : 'th-dim'); tick(v); await h.wait(110); }
      line('');
      await h.wait(300);
      await type(h, line('', 'th-gold'), `OS guess: ${r.os} (${r.accuracy}%)`, 22);
      await h.wait(600);
      div(h.el, 'th-sting ' + (r.granted ? 'th-ok' : 'th-no'), r.granted ? 'ACCESS GRANTED' : 'FIREWALL DETECTED');
      sting(v, r.granted);
      h.after(4000, h.close);
    })();
    return { close: h.close };
  }

  // --- 3. the war dialer ------------------------------------------------------
  const RESULTS = [['NO ANSWER', 40], ['BUSY', 25], ['VOICE', 20], ['FAX', 10], ['CARRIER', 3]];
  function pick(rnd) { let n = rnd() * 98; for (const [r, w] of RESULTS) if ((n -= w) < 0) return r; return 'NO ANSWER'; }
  // Pure: one page of numbers and what answers each. Every page has at least one carrier.
  function wardialPage(prefix, start, n, rnd) {
    rnd = rnd || Math.random;
    const page = Array.from({ length: n }, (_, i) => ({ number: `${prefix}-${String((start + i) % 10000).padStart(4, '0')}`, result: pick(rnd) }));
    if (!page.some((p) => p.result === 'CARRIER')) page[Math.floor(rnd() * n)].result = 'CARRIER';
    return page;
  }
  function wardial(container, prefix, done, opts) {
    opts = opts || {}; prefix = String(prefix || '555').replace(/\D/g, '').slice(0, 7) || '555';
    const v = vol(opts), N = 40;
    const h = overlay(container, 'th-dial', done, escCloses);
    const head = div(h.el, 'th-bar'), grid = div(h.el, 'th-grid');
    div(h.el, 'th-hint th-foot', 'ESC abort');
    let start = Math.floor(Math.random() * 90) * 100, dialed = 0, found = 0;
    const status = () => { head.textContent = `▓▒░ WARDIAL :: PREFIX ${prefix} :: DIALED ${dialed} :: CARRIERS ${found} ░▒▓`; };
    (async () => {
      for (;;) {
        grid.textContent = '';
        const page = wardialPage(prefix, start, N), cells = page.map((p) => div(grid, 'th-cell', `${p.number}  ......`));
        start += N;
        for (let i = 0; i < N; i++) {
          const p = page[i], c = cells[i];
          c.textContent = `${p.number}  DIALING`; c.className = 'th-cell th-ringing';
          h.after(500 + Math.random() * 900, () => {
            c.textContent = `${p.number}  ${p.result}`; c.className = 'th-cell th-r-' + p.result.replace(' ', '').toLowerCase();
            dialed++;
            if (p.result === 'CARRIER') { found++; carrierTone(v); if (opts.onCarrier) opts.onCarrier(p.number); }
            status();
          });
          await h.wait(170);
        }
        await h.wait(2500);
      }
    })();
    status();
    return { close: h.close };
  }

  // --- 4. the Cookie Monster ----------------------------------------------------
  const isCookie = (s) => /^\s*cookies?[\s.!]*$/i.test(s);
  const ANGRY = ['GIVE ME A COOKIE!!', 'COOKIE. NOW.', 'THAT IS NOT A COOKIE.', 'C-O-O-K-I-E. SIX LETTERS.', 'I WILL EAT YOUR FILES INSTEAD', 'COOOOOOKIEEEEEE!!!!'];
  function cookie(container, done, opts) {
    const v = vol(opts); let wrong = 0, busy = false;
    const h = overlay(container, 'th-cookie', done);
    const box = div(h.el, 'th-box'), say = div(box, 'th-say'), hint = div(box, 'th-hint', '');
    const row = div(box, 'th-row', '> '), inp = document.createElement('input');
    inp.className = 'th-input'; inp.spellcheck = false; inp.maxLength = 40; row.appendChild(inp);
    h.el.onmousedown = (e) => { if (e.target !== inp) { e.preventDefault(); inp.focus(); } }; // the pane is its now
    const leave = async (text, ms) => { busy = true; inp.disabled = true; await type(h, say, text, 40); await h.wait(ms); h.close(); };
    inp.onkeydown = async (e) => {
      e.stopPropagation(); // keep every key away from the terminal
      if (busy) return;
      if (e.key === 'Escape') return leave('FINE. KEEP YOUR COOKIES. I WILL REMEMBER THIS.', 1400);
      if (e.key !== 'Enter') return;
      if (isCookie(inp.value)) { munch(v); return leave('THANK YOU. *munch* *munch*', 1200); }
      inp.value = ''; buzz(v);
      say.textContent = ANGRY[Math.min(wrong, ANGRY.length - 1)]; wrong++;
      box.style.setProperty('--anger', Math.min(wrong, 6));
      box.classList.remove('th-shake'); void box.offsetWidth; box.classList.add('th-shake');
      if (wrong >= 2) hint.textContent = '(psst: type COOKIE. or ESC, coward)';
    };
    inp.focus();
    type(h, say, 'I WANT A COOKIE', 60);
    return { close: h.close };
  }

  // --- 5. the red alert ---------------------------------------------------------
  const ALERT = ['WORM DETECTED', 'DA VINCI VIRUS LOOSE IN THE MAINFRAME', 'BALLAST PROGRAMS COMPROMISED', 'FLEET CAPSIZES IN 6 DAYS', 'THIS CANNOT BE UNDONE'];
  function alert(done, opts) {
    opts = opts || {};
    const h = overlay(document.body, 'th-alert', done); // pointer-events none, no focus, no keys
    const big = div(h.el, 'th-big', ALERT[0]);
    if (opts.cmd) div(h.el, 'th-cmd', '> ' + opts.cmd);
    let i = 0; const iv = setInterval(() => { big.textContent = ALERT[++i % ALERT.length]; }, 600);
    h.onclose = () => clearInterval(iv);
    klaxon(vol(opts));
    h.after(opts.ms || 3000, h.close);
    return { close: h.close };
  }

  // volume: the default for every effect (0..1); opts.volume / opts.mute override it per call.
  const api = { volume: 0.6, cp437, nfo, scan, wardial, cookie, alert, scanReport, wardialPage, isCookie };
  root.Theatre = api;
  if (typeof module !== 'undefined') module.exports = api;
})(this);
