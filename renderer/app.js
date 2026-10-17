// Wires the terminal to everything else. The flow: keystrokes and shell output
// feed the Activity meter; the meter drives tempo, layers, warp and the
// cigarette; commands and errors go to NYX; NYX's mood picks the world.
(async function () {
  const B = await window.gibson.boot();
  const cfg = B.cfg;
  const $ = (id) => document.getElementById(id);
  const act = new Activity();
  const worldEnv = { fs: null };
  const go = (w) => { if (!B.world) Worlds.go(w); };
  let music = null, pulse = 0, warp = 0;

  // --- terminals: 1 to 4 tiled panes. Each pane has its own shell. ---------
  const TERM_OPTS = {
    fontFamily: cfg.fontFamily, fontSize: cfg.fontSize, cursorBlink: true, cursorStyle: 'block',
    allowProposedApi: true, allowTransparency: true, scrollback: 5000,
    theme: {
      background: '#00000000', foreground: '#b8ffd9', cursor: '#ff2e88', cursorAccent: '#000', selectionBackground: '#ff2e8866',
      scrollbarSliderBackground: '#39ff9c22', scrollbarSliderHoverBackground: '#39ff9c44', scrollbarSliderActiveBackground: '#ff2e8866',
      black: '#0a0f0c', red: '#ff3864', green: '#39ff9c', yellow: '#ffd23f', blue: '#36a3ff', magenta: '#ff2e88', cyan: '#36d6ff', white: '#cfe9dc',
      brightBlack: '#4d6b5c', brightRed: '#ff6b8b', brightGreen: '#8bffc4', brightYellow: '#ffe680', brightBlue: '#7cc4ff', brightMagenta: '#ff7ab8', brightCyan: '#8ae9ff', brightWhite: '#ffffff',
    },
  };
  const panes = []; let focused = null, nextId = 1;

  function makePane() {
    const id = nextId++, el = document.createElement('div');
    el.className = 'pane'; $('termwrap').appendChild(el);
    const term = new Terminal(TERM_OPTS), fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, uri) => window.open(uri)));
    term.loadAddon(new Unicode11Addon.Unicode11Addon()); term.unicode.activeVersion = '11';
    term.open(el);
    try { const gl = new WebglAddon.WebglAddon(); gl.onContextLoss(() => gl.dispose()); term.loadAddon(gl); } catch { /* DOM renderer is fine */ }
    const p = { id, el, term, line: '', lastCmd: '', outTail: '', errorSeen: false };
    window.gibson.open(id);
    const doFit = () => { try { fit.fit(); window.gibson.resize(id, term.cols, term.rows); } catch { /* hidden */ } };
    p.ro = new ResizeObserver(doFit); p.ro.observe(el); doFit();
    term.textarea.addEventListener('focus', () => setFocus(p));
    // ponytail: the typed line is rebuilt from keystrokes. History recall and
    // tab completion are invisible to it; NYX just sees what you typed by hand.
    term.onData((d) => {
      window.gibson.write(id, d);
      act.key(d[0] === '\x7f' || d[0] === '\x1b' ? 0.1 : 1); // backspace and arrows aren't a frenzy
      if (d === '\r') { onCommand(p, p.line); p.line = ''; }
      else if (d === '\x7f') p.line = p.line.slice(0, -1);
      else if (d === '\x03') p.line = '';
      else if (d[0] !== '\x1b') p.line += d.replace(/[\x00-\x1f]/g, '');
    });
    p.el.style.setProperty('--term-alpha', p.opacity = cfg.opacity ?? 0.86);
    panes.push(p);
    return p;
  }
  function closePane(p) {
    p.ro.disconnect(); p.term.dispose(); p.el.remove(); window.gibson.close(p.id);
    panes.splice(panes.indexOf(p), 1);
  }
  function setFocus(p) {
    if (focused === p) return;
    focused = p;
    for (const x of panes) x.el.classList.toggle('focus', x === p);
    window.gibson.listDir(p.id).then((fs) => { worldEnv.fs = fs; Worlds.refreshFiles(); });
  }
  // Growing adds panes; shrinking closes the newest ones, never the focused one.
  function setPanes(n) {
    n = Math.max(1, Math.min(4, n));
    while (panes.length < n) makePane();
    while (panes.length > n) closePane(panes.slice().reverse().find((p) => p !== focused));
    $('termwrap').className = 'n' + n;
    focused.term.focus();
  }

  window.gibson.onData((id, d) => {
    const p = panes.find((x) => x.id === id); if (!p) return;
    p.term.write(d); act.output(d.length);
    const plain = d.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g, '');
    p.outTail = (p.outTail + plain).slice(-2000);
    if (!p.errorSeen && p.lastCmd && /(error|not recognized|command not found|fatal:|exception|failed|denied)/i.test(plain)) {
      p.errorSeen = true; nyx.event('error', { cmd: p.lastCmd, output: p.outTail }, true);
    }
  });

  function onCommand(p, cmd) {
    p.lastCmd = cmd; p.errorSeen = false;
    window.gibson.line(p.id, cmd);
    if (NYX_KIND(cmd) === 'cd') setTimeout(async () => { worldEnv.fs = await window.gibson.listDir(p.id); go('files'); Worlds.refreshFiles(); }, 250);
    $('frame').style.setProperty('--warp', 1); warp = 1; // the Enter lunge
    nyx.command(cmd);
  }
  setFocus(makePane());
  if (B.panes > 1) setPanes(B.panes);

  // --- NYX --------------------------------------------------------------------
  const scrollBase = '      GIBSON v0.1  ::  NYX IS WATCHING  ::  greetz to f0rkz, sp00nz and the S1LV3RWAREZ crew  ::  hack the planet  ::  ctrl+shift+M music  ctrl+shift+W world  ctrl+shift+N nyx  ctrl+shift+B tempo mode  ctrl+shift+1-4 panes  ctrl+shift+O see-through  ctrl+shift+F frame  right-click for the menu  F11 fullscreen  ::  ';
  let scroll = scrollBase;
  const nyx = new Nyx(cfg, {
    info: () => ({ user: B.user, host: B.host, hour: new Date().getHours(), activity: act.level().toFixed(2), cwd: (worldEnv.fs && worldEnv.fs.cwd) || B.cwd }),
    llm: (ev) => window.gibson.llm(ev),
    say(text, mood, world) {
      const el = $('nyxtext'); el.textContent = ''; let i = 0;
      $('nyx').classList.remove('glitch'); void $('nyx').offsetWidth; $('nyx').classList.add('glitch');
      const iv = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(iv); }, 28);
      scroll = scrollBase + `NYX SAYS: ${text.toUpperCase()}  ::  `;
      if (world && !B.world) Worlds.go(world); // --world pins it (screenshots)
      if (cfg.nyx.voice && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text); u.pitch = 0.55; u.rate = 1.02;
        const v = speechSynthesis.getVoices().find((x) => /zira|female|aria|jenny/i.test(x.name)); if (v) u.voice = v;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      }
    },
  });

  // --- worlds + fx ------------------------------------------------------------
  worldEnv.fs = await window.gibson.listDir(focused.id);
  Worlds.start($('world'), () => ({ level: act.level(), pulse, warp, fs: worldEnv.fs }));
  if (B.world) Worlds.go(B.world);
  Fx.start({ logo: $('logo'), scroller: $('scroller'), rain: $('rain'), smoke: $('smoke') },
    () => ({ pulse, level: act.level(), smoking: act.busyOut > 4, scroll }));

  // --- hotkeys + right-click menu: main.js catches the keys, both land here ----
  const OPACITY = [1, 0.86, 0.7, 0.5, 0.3, 0.15, 0];
  // Per pane. The last choice is saved and becomes the default for new panes.
  const setOpacity = (p, o) => { p.opacity = o; p.el.style.setProperty('--term-alpha', o); };
  const setFramed = (on) => { cfg.framed = on; document.body.classList.toggle('unframed', !on); };
  setFramed(cfg.framed !== false && !B.unframed);
  function action(a) {
    const t = focused.term;
    if (a === 'copy') navigator.clipboard.writeText(t.getSelection());
    else if (a === 'paste') navigator.clipboard.readText().then((s) => t.paste(s));
    else if (a === 'music') { cfg.music.on = !cfg.music.on; if (cfg.music.on) startMusic(); else if (music) music.stop(); }
    else if (a === 'tempo') { cfg.music.mode = cfg.music.mode === 'reactive' ? 'fixed' : 'reactive'; nyx.ctx.say(`Tempo ${cfg.music.mode === 'fixed' ? 'locked at ' + cfg.music.bpm : 'follows your hands'}.`, 'playful'); }
    else if (a === 'nyx') { cfg.nyx.on = !cfg.nyx.on; $('nyx').style.opacity = cfg.nyx.on ? 1 : 0.3; }
    else if (a === 'world') { const n = Worlds.names; Worlds.go(n[(n.indexOf(Worlds.current()) + 1) % n.length]); }
    else if (a.startsWith('world:')) Worlds.go(a.slice(6));
    else if (a === 'rain') Fx.rain(4);
    else if (a === 'frame') { setFramed(!cfg.framed); window.gibson.save('framed', cfg.framed); }
    else if (a === 'opacity' || a.startsWith('opacity:')) {
      const o = a === 'opacity' ? OPACITY[(OPACITY.findIndex((x) => x <= focused.opacity + 0.001) + 1) % OPACITY.length] : Number(a.slice(8));
      setOpacity(focused, o); cfg.opacity = o; window.gibson.save('opacity', o);
    }
    else if (a === 'tile') return setPanes(panes.length % 4 + 1);
    else if (a.startsWith('panes:')) return setPanes(Number(a.slice(6)));
    else if (a === 'fullscreen') window.gibson.fullscreen();
    t.focus();
  }
  window.gibson.onHotkey(action);
  addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const p = panes.find((x) => x.el.contains(e.target)); if (p) p.term.focus();
    window.gibson.menu({
      selection: !!focused.term.getSelection(), panes: panes.length, opacity: focused.opacity, framed: cfg.framed,
      worlds: Worlds.names.map((n) => [n, Worlds.label(n)]), world: Worlds.current(),
      music: !!cfg.music.on, reactive: cfg.music.mode === 'reactive', nyx: !!cfg.nyx.on,
    });
  });

  // --- the loop ---------------------------------------------------------------
  let lastT = performance.now(), idleSaid = false, compileSaid = false, streakAt = 0, lateSaid = false;
  setInterval(() => {
    const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
    act.tick(dt);
    const lvl = act.level();
    if (music) { music.level = lvl; music.bpm = act.glide(dt, cfg.music); pulse = music.on ? music.pulse() : 0; }
    else pulse = Math.max(0, pulse - dt * 3);
    warp = Math.max(lvl, warp - dt * 2.5);
    const fr = $('frame').style; fr.setProperty('--glow', pulse.toFixed(3)); fr.setProperty('--warp', warp.toFixed(3));
    $('status').textContent = `${Math.round(act.bpm)} BPM  ${'▮'.repeat(Math.round(lvl * 10)).padEnd(10, '▯')}\n${Worlds.label()}  //  ${B.user}@${B.host}`;

    if (act.idle > 75 && !idleSaid) { idleSaid = true; nyx.event('idle', {}, true); go('grid'); }
    if (act.idle < 1) idleSaid = false;
    if (act.busyOut > 4 && !compileSaid) { compileSaid = true; nyx.event('compile', { cmd: focused.lastCmd }, true); go('tunnel'); }
    if (compileSaid && act.busyOut === 0) { compileSaid = false; nyx.event('done', { cmd: focused.lastCmd, output: focused.outTail }, true); }
    if (lvl > 0.85 && now - streakAt > 60000) { streakAt = now; nyx.event('streak', {}, false); }
    const h = new Date().getHours();
    if (!lateSaid && h >= 1 && h < 5 && act.idle < 2) { lateSaid = true; nyx.event('late', {}, true); }
    if (Math.random() < dt * (1 / 100 + lvl / 35)) Fx.rain(1.5 + Math.random() * 2.5);
  }, 50);

  // --- boot: dial in, then hand over -------------------------------------------
  function startMusic() {
    if (B.mute || !cfg.music.on) return;
    if (!music) { music = new Techno(); music.volume(B.shot ? 0 : cfg.music.volume); } // shots exercise the synth silently
    music.start();
  }
  async function bootSequence() {
    const log = $('bootlog'), out = (s) => { log.textContent += s; };
    let skip = false; const skipper = () => { skip = true; }; addEventListener('keydown', skipper);
    let dial = null; try { dial = new Techno(); dial.volume(0); } catch { /* no audio device */ }
    const steps = [['ATZ\n', 300], ['OK\n', 400], ['ATDT 555-0199\n', 200]];
    for (const [s, ms] of steps) { if (skip) break; out(s); await sleep(ms); }
    const len = dial && !skip ? dial.dialup('5550199', B.shot ? 0 : 1) : 0;
    const lines = ['RINGING...\n', 'CARRIER 2100Hz\n', 'NEGOTIATING V.90 ...\n', 'PROTOCOL: LAPM / V.42BIS\n', 'CONNECT 57600\n\n', `ACCESSING GIBSON MAINFRAME AS ${B.user.toUpperCase()}...\n`, 'NYX ONLINE.\n'];
    for (const s of lines) { if (skip) break; out(s); await sleep((len * 1000) / lines.length); }
    if (dial) dial.ctx.close();
    removeEventListener('keydown', skipper);
    $('boot').classList.add('gone'); focused.term.focus();
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  if (cfg.boot && (!B.shot || B.bootShot)) await bootSequence(); else $('boot').classList.add('gone');
  focused.term.focus(); startMusic();
  nyx.event('boot', {}, true);

  if (B.shot) { // headless screenshot: give it something to look at
    if (panes.length > 1) panes.forEach((p, i) => setOpacity(p, [0.86, 0.55, 0.3, 0.7][i]));
    setTimeout(() => panes.forEach((p, i) => window.gibson.write(p.id, demoCmd(i))), 1500);
    act.keys = 30;
    setInterval(() => { act.key(); act.key(); }, 100);
  }
  function demoCmd(i) { // runs in main.js's demo folder; nothing here shows the real machine
    const cmds = navigator.platform.startsWith('Win')
      ? ['Get-ChildItem | Format-Table Mode, LastWriteTime, Length, Name', 'Get-ChildItem -File | Sort-Object Length -Descending | Format-Table Name, Length',
        "1..14 | ForEach-Object { '{0:X8}  ACCESS GRANTED  node-{1:D2}' -f (Get-Random), $_ }", 'Get-ChildItem -Directory | Format-Wide Name -Column 2']
      : ['ls -la', 'ls -lS', 'for i in $(seq 14); do printf "%08X  ACCESS GRANTED  node-%02d\\n" $RANDOM$RANDOM $i; done', 'ls -d */'];
    return cmds[i % cmds.length] + '\r';
  }
})();
