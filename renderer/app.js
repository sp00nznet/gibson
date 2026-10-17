// Wires the terminal to everything else. The flow: keystrokes and shell output
// feed the Activity meter; the meter drives tempo, layers, warp and the
// cigarette; commands and errors go to NYX; NYX's mood picks the world.
(async function () {
  const B = await window.gibson.boot();
  const cfg = B.cfg;
  const $ = (id) => document.getElementById(id);
  const act = new Activity();
  const worldEnv = { fs: null, git: null, net: null, procs: null, news: null };
  const refreshGit = (p) => window.gibson.gitLog(p.id).then((g) => { worldEnv.git = g; });
  // NYX changes the world unless --world pins it (screenshots) or the user turned that off.
  const go = (w) => { if (!B.world && cfg.nyxWorlds !== false && w) Worlds.go(Array.isArray(w) ? w[Math.floor(Math.random() * w.length)] : w); };
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
  // Tabs each hold 1 to 4 panes. Pane ids are global: main.js keys its shells by them.
  const tabs = []; let tab = null, focused = null, nextId = 1, dragged = null;
  const allPanes = () => tabs.flatMap((t) => t.panes);

  // opts: { profile, cwd } for the tab's shells; blank means the default shell in the home folder.
  function makeTab(opts) {
    const t = { panes: [], focused: null, cwdName: '', opts: opts || {}, c: 0.5, r: 0.5, el: document.createElement('div'), btn: document.createElement('button') };
    t.el.className = 'tab n1'; $('termwrap').appendChild(t.el);
    splitters(t);
    t.btn.className = 'tabbtn'; t.btn.title = 'double-click renames, drag to reorder, middle-click closes';
    t.btn.draggable = true; // drag a tab onto another to move it there
    t.btn.ondragstart = (e) => { dragged = t; e.dataTransfer.effectAllowed = 'move'; };
    t.btn.ondragover = (e) => { if (dragged && dragged !== t) e.preventDefault(); };
    t.btn.ondrop = (e) => {
      e.preventDefault(); if (!dragged || dragged === t) return;
      const to = tabs.indexOf(t); tabs.splice(tabs.indexOf(dragged), 1); tabs.splice(to, 0, dragged);
      for (const x of tabs) $('tabs').insertBefore(x.btn, $('newtab'));
      dragged = null; tabs.forEach(label);
    };
    t.btn.innerHTML = '<span class="lbl"></span><span class="x" title="close tab">×</span>';
    t.btn.onclick = (e) => { if (e.target.classList.contains('x')) closeTab(t); else switchTab(t); };
    t.btn.onauxclick = (e) => { if (e.button === 1) closeTab(t); };
    t.btn.ondblclick = (e) => { if (!e.target.classList.contains('x')) renameTab(t); };
    $('tabs').insertBefore(t.btn, $('newtab'));
    tabs.push(t); makePane(t, t.opts.from); label(t);
    window.gibson.listDir(t.panes[0].id).then((fs) => { t.cwdName = baseName(fs.cwd); label(t); });
    return t;
  }
  function label(t) {
    const shell = t.opts.profile && t.opts.profile !== B.defaultShell ? ` (${t.opts.profile})` : '';
    const name = t.opts.name || `${t.cwdName || 'shell'}${shell}`; // a name you gave it wins over the folder
    const badge = (t.broadcast ? '\u21f6 ' : '') + (t.done ? '\u25cf ' : ''); // typing into all panes; a command finished in the background
    t.btn.firstChild.textContent = `${badge}${tabs.indexOf(t) + 1}:${name}${t.panes.length > 1 ? ' [' + t.panes.length + ']' : ''}`;
    t.btn.style.setProperty('--tabc', t.opts.color || '');
    t.btn.classList.toggle('coloured', !!t.opts.color);
  }
  // Pane sizes: the column and row split as fractions, dragged by two handles.
  function splitters(t) {
    for (const [cls, key] of [['vsplit', 'c'], ['hsplit', 'r']]) {
      const h = document.createElement('div'); h.className = 'splitter ' + cls; t.el.appendChild(h);
      h.onpointerdown = (e) => {
        e.preventDefault(); h.setPointerCapture(e.pointerId);
        h.onpointermove = (m) => {
          const r = t.el.getBoundingClientRect();
          t[key] = Math.max(0.15, Math.min(0.85, key === 'c' ? (m.clientX - r.left) / r.width : (m.clientY - r.top) / r.height));
          layout(t);
        };
        h.onpointerup = () => { h.onpointermove = null; };
      };
    }
    layout(t);
  }
  function layout(t) {
    const n = t.panes.length, cols = n > 1 && !t.zoom, rows = n > 2 && !t.zoom;
    t.el.style.gridTemplateColumns = cols ? `${t.c}fr ${1 - t.c}fr` : '';
    t.el.style.gridTemplateRows = rows ? `${t.r}fr ${1 - t.r}fr` : '';
    t.el.style.setProperty('--c', t.c); t.el.style.setProperty('--r', t.r);
    t.el.classList.toggle('zoomed', !!t.zoom);
  }
  // Rename in place: Enter keeps it, Escape backs out, an empty name goes back to the folder.
  function renameTab(t) {
    const lbl = t.btn.firstChild, inp = document.createElement('input');
    inp.className = 'rename'; inp.value = t.opts.name || ''; inp.placeholder = t.cwdName || 'name';
    lbl.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (keep) => {
      if (done) return; done = true;
      if (keep) t.opts = { ...t.opts, name: inp.value.trim() || undefined };
      inp.replaceWith(lbl); label(t); if (focused) focused.term.focus();
    };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); };
    inp.onblur = () => finish(true);
    inp.onclick = (e) => e.stopPropagation();
  }
  function switchTab(t) {
    tab = t;
    for (const x of tabs) { x.el.classList.toggle('hidden', x !== t); x.btn.classList.toggle('on', x === t); }
    if (t.done) { t.done = false; label(t); }
    $('tabs').classList.toggle('solo', tabs.length < 2);
    focused = null; setFocus(t.focused || t.panes[0]); focused.term.focus();
  }
  function closeTab(t) {
    const i = tabs.indexOf(t);
    for (const p of t.panes.slice()) closePane(p);
    t.el.remove(); t.btn.remove(); tabs.splice(i, 1);
    if (!tabs.length) makeTab();
    tabs.forEach(label);
    switchTab(tab === t || !tabs.includes(tab) ? tabs[Math.min(i, tabs.length - 1)] : tab);
  }
  const stepTab = (d) => switchTab(tabs[(tabs.indexOf(tab) + d + tabs.length) % tabs.length]);
  const baseName = (dir) => dir.split(/[\\/]/).filter(Boolean).pop() || dir;

  // from: the pane whose folder the new shell starts in (split from here)
  function makePane(t, from) {
    const id = nextId++, el = document.createElement('div');
    el.className = 'pane'; t.el.appendChild(el);
    const term = new Terminal(TERM_OPTS), fit = new FitAddon.FitAddon(), search = new SearchAddon.SearchAddon();
    term.loadAddon(fit); term.loadAddon(search);
    fileLinks(term, id);
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, uri) => window.open(uri)));
    term.loadAddon(new Unicode11Addon.Unicode11Addon()); term.unicode.activeVersion = '11';
    term.open(el);
    try { const gl = new WebglAddon.WebglAddon(); gl.onContextLoss(() => gl.dispose()); term.loadAddon(gl); } catch { /* DOM renderer is fine */ }
    const chat = document.createElement('div'); chat.className = 'nyxchat'; el.appendChild(chat);
    const p = { id, el, term, search, tab: t, chat, line: '', lastCmd: '', outTail: '', errorSeen: false, lastOut: 0, cmdAt: 0 };
    window.gibson.open(id, { ...t.opts, from });
    // Pastes go through the guard, whichever way they arrive (keys, menu, middle click).
    el.addEventListener('paste', (e) => { e.preventDefault(); e.stopImmediatePropagation(); pasteInto(p, e.clipboardData.getData('text/plain')); }, true);
    const doFit = () => { try { fit.fit(); window.gibson.resize(id, term.cols, term.rows); } catch { /* hidden */ } };
    p.fit = doFit; p.ro = new ResizeObserver(doFit); p.ro.observe(el); doFit();
    term.textarea.addEventListener('focus', () => setFocus(p));
    // At Enter the command is read off the screen (typedLine), so history recall and tab
    // completion count. p.line, rebuilt from keystrokes, covers the moment before the
    // shell has echoed what was typed.
    term.onData((d) => {
      act.key(d[0] === '\x7f' || d[0] === '\x1b' ? 0.1 : 1); // backspace and arrows aren't a frenzy
      const enter = d === '\r' || d === '\n';
      const shown = enter ? typedLine(p) : null;
      const raw = shown && shown.trim() ? shown : enter ? p.line : '';
      const cmd = raw.trim();
      // GIBSON's own commands (`nyx <message>`, `dial 555-0199`, `nfo file`...) never reach the shell.
      const own = enter && /^(nyx|dial|wardial|nfo|scan|cookie)(\s|$)/i.exec(cmd);
      if (own && (own[1].toLowerCase() === 'nyx' || cfg.hackerCommands !== false)) {
        // Erase the line with backspaces rather than Ctrl+C, which leaves a ^C behind.
        // Backspace means the same in PowerShell, cmd, bash and zsh.
        window.gibson.write(id, '\x7f'.repeat(raw.length)); p.line = '';
        builtin(p, own[1].toLowerCase(), cmd.slice(own[1].length).trim());
        return;
      }
      if (p.tab.broadcast) for (const x of p.tab.panes) window.gibson.write(x.id, d); // type into every pane
      else window.gibson.write(id, d);
      if (d === '\r') { onCommand(p, cmd); p.line = ''; }
      else if (d === '\x7f') p.line = p.line.slice(0, -1);
      else if (d === '\x03') p.line = '';
      else if (d[0] !== '\x1b') p.line += d.replace(/[\x00-\x1f]/g, '');
    });
    p.el.style.setProperty('--term-alpha', p.opacity = cfg.opacity ?? 0.86);
    t.panes.push(p);
    return p;
  }
  // The command line as the screen shows it: the cursor's row plus any rows it wrapped from,
  // up to the cursor (PSReadLine draws its grey predictions to the right of it). The prompt
  // ends at its first > $ # or % plus a space. Untrimmed, so its length is what the shell
  // holds. null when no prompt is recognised.
  // ponytail: prompt-shape heuristic; a prompt hook (OSC 133) would be exact.
  function typedLine(p) {
    const b = p.term.buffer.active;
    let y = b.baseY + b.cursorY, text = b.getLine(y).translateToString(false, 0, b.cursorX);
    while (y > 0 && b.getLine(y).isWrapped) { y--; text = b.getLine(y).translateToString(false) + text; }
    const m = /^[^>$#%]*[>$#%] (.*)$/.exec(text);
    return m ? m[1] : null;
  }
  // Clickable paths: name.ext, dir/name.ext, C:\x\y.ext, with :line or :line:col or (line,col).
  // Only real files under the pane's folder become links (main.js checks); a click opens the
  // editor at that line.
  const PATHS = /(?:[A-Za-z]:)?(?:[\w.~@+-]*[\\/])*[\w.@+-]*\.[A-Za-z][\w]{0,7}(?:[:(]\d+(?:[:,]\d+)?\)?)?/g;
  function fileLinks(term, id) {
    term.registerLinkProvider({
      provideLinks(y, cb) {
        const text = term.buffer.active.getLine(y - 1)?.translateToString(true) || '', found = [];
        for (const m of text.matchAll(PATHS)) {
          if (/[/:]/.test(text[m.index - 1] || '') || /^[.\d]+$/.test(m[0]) || found.length > 20) continue; // URLs belong to the web-links addon
          const [, file, line, col] = /^(.*?)(?:[:(](\d+)(?:[:,](\d+))?\)?)?$/.exec(m[0]);
          found.push({ file, line: Number(line) || 0, col: Number(col) || 0, x: m.index, len: m[0].length });
        }
        if (!found.length) return cb(undefined);
        window.gibson.linkCheck(id, found.map((f) => f.file)).then((ok) => cb(found.filter((_, i) => ok[i]).map((f) => ({
          range: { start: { x: f.x + 1, y }, end: { x: f.x + f.len, y } }, text: f.file,
          activate: () => window.gibson.linkOpen(id, f.file, f.line, f.col),
        }))));
      },
    });
  }
  // More than one line asks first: a stray newline in a paste runs whatever came before it.
  function pasteInto(p, text) {
    if (!text) return;
    const lines = text.replace(/\r?\n$/, '').split(/\r?\n/).length;
    if (cfg.pasteGuard !== false && lines > 1 && !confirm(`Paste ${lines} lines into the shell? Each line runs as it lands.`)) return;
    p.term.paste(text);
  }
  // Find in scrollback: a bar over the top of the focused pane. Enter next, Shift+Enter back, Esc shuts.
  const FIND_DECOR = { matchBackground: '#ff2e8855', activeMatchBackground: '#ffc448aa', matchOverviewRuler: '#ff2e88', activeMatchColorOverviewRuler: '#ffc448' };
  function openFind(p) {
    let bar = p.el.querySelector('.findbar');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'findbar';
      bar.innerHTML = '<input placeholder="find"><span class="count"></span><button data-d="-1" title="previous (Shift+Enter)">&#9650;</button><button data-d="1" title="next (Enter)">&#9660;</button><button data-d="0" title="close (Esc)">&times;</button>';
      p.el.appendChild(bar);
      const inp = bar.firstChild, count = bar.children[1];
      const go = (dir) => { const o = { decorations: FIND_DECOR }; if (dir < 0) p.search.findPrevious(inp.value, o); else p.search.findNext(inp.value, o); };
      const shut = () => { p.search.clearDecorations(); bar.remove(); p.term.focus(); };
      p.search.onDidChangeResults(({ resultIndex, resultCount }) => { count.textContent = resultCount ? `${resultIndex + 1}/${resultCount}` : inp.value ? 'none' : ''; });
      inp.oninput = () => go(1);
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go(e.shiftKey ? -1 : 1); else if (e.key === 'Escape') shut(); };
      for (const b of bar.querySelectorAll('button')) b.onclick = () => { const d = Number(b.dataset.d); if (d) go(d); else shut(); };
    }
    const inp = bar.firstChild, sel = p.term.getSelection();
    if (sel && !sel.includes('\n')) inp.value = sel;
    inp.focus(); inp.select();
  }
  // Text size for every pane, remembered.
  function setFont(size) {
    cfg.fontSize = TERM_OPTS.fontSize = Math.max(8, Math.min(36, size));
    for (const x of allPanes()) { x.term.options.fontSize = cfg.fontSize; x.fit(); }
    window.gibson.save('fontSize', cfg.fontSize);
  }
  addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); setFont(cfg.fontSize + (e.deltaY < 0 ? 1 : -1)); } }, { passive: false });

  function closePane(p) {
    p.ro.disconnect(); p.term.dispose(); p.el.remove(); window.gibson.close(p.id);
    p.tab.panes.splice(p.tab.panes.indexOf(p), 1);
    if (p.tab.focused === p) p.tab.focused = null;
  }
  function setFocus(p) {
    if (focused === p) return;
    focused = p; p.tab.focused = p;
    for (const x of p.tab.panes) x.el.classList.toggle('focus', x === p);
    window.gibson.listDir(p.id).then((fs) => { worldEnv.fs = fs; Worlds.refreshFiles(); p.tab.cwdName = baseName(fs.cwd); label(p.tab); });
    refreshGit(p);
  }
  // Growing adds panes; shrinking closes the newest ones, never the focused one.
  function setPanes(n) {
    n = Math.max(1, Math.min(4, n));
    while (tab.panes.length < n) makePane(tab, focused && focused.id);
    while (tab.panes.length > n) closePane(tab.panes.slice().reverse().find((p) => p !== focused));
    tab.el.className = 'tab n' + n; tab.zoom = false; for (const x of tab.panes) x.el.classList.remove('zoom');
    if (n < 2) tab.broadcast = false;
    layout(tab); label(tab);
    focused.term.focus();
  }

  window.gibson.onData((id, d) => {
    const p = allPanes().find((x) => x.id === id); if (!p) return;
    p.term.write(d); act.output(d.length); p.lastOut = Date.now();
    const plain = d.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g, '');
    p.outTail = (p.outTail + plain).slice(-2000);
    if (!p.errorSeen && p.lastCmd && /(error|not recognized|command not found|fatal:|exception|failed|denied)/i.test(plain)) {
      p.errorSeen = true; Worlds.signal('error'); nyx.event('error', { cmd: p.lastCmd, output: p.outTail }, true); ircPanel.event('error', p.lastCmd);
    }
  });

  function onCommand(p, cmd) {
    p.lastCmd = cmd; p.errorSeen = false; p.cmdAt = cmd ? Date.now() : 0;
    window.gibson.line(p.id, cmd);
    if (NYX_KIND(cmd) === 'cd') setTimeout(async () => {
      worldEnv.fs = await window.gibson.listDir(p.id); go('files'); Worlds.refreshFiles();
      p.tab.cwdName = baseName(worldEnv.fs.cwd); label(p.tab); refreshGit(p); ircPanel.event('cd', p.tab.cwdName);
    }, 250);
    if (/^git\b/i.test(cmd)) setTimeout(() => refreshGit(p), 1200); // new commits ignite in the galaxy
    if (cmd) setTimeout(() => { if (!p.errorSeen && p.lastCmd === cmd) Worlds.signal('ok'); }, 1500);
    if (/hack\s+the\s+planet/i.test(cmd) && !B.world) Worlds.go('hack');
    $('frame').style.setProperty('--warp', 1); warp = 1; // the Enter lunge
    nyx.command(cmd);
    if (cmd) ircPanel.event(/^git\s+commit\b/i.test(cmd) ? 'commit' : NYX_KIND(cmd), cmd);
    if (NYX_KIND(cmd) === 'danger') Theatre.alert(null, { cmd }); // the Da Vinci treatment
  }

  // The set pieces (renderer/theatre.js) and the BBS (bbs/bbs.js), each a command of its own.
  function builtin(p, name, arg) {
    const back = () => p.term.focus();
    if (name === 'nyx') return nyxChat(p, arg);
    if (name === 'dial') return dialBbs(arg || '555-0199');
    if (name === 'scan') return Theatre.scan(p.el, arg || 'gibson.ellingson.net', back);
    if (name === 'cookie') return Theatre.cookie(p.el, back);
    if (name === 'wardial') return Theatre.wardial(p.el, arg || '555', back, { onCarrier: (n) => nyx.ctx.say(`Carrier at ${n}. Type  dial ${n}  if you dare.`, 'curious') });
    if (name === 'nfo') {
      if (!arg) return nyx.ctx.say('nfo what? Give me a file name, insect.', 'taunting');
      window.gibson.readFile(p.id, arg.replace(/^["']|["']$/g, '')).then((buf) => {
        if (buf) Theatre.nfo(p.el, new Uint8Array(buf), arg, back); else nyx.ctx.say(`No ${arg} here. Or it is too big to be an nfo.`, 'taunting');
      });
    }
  }
  // `dial <number>`: the modem sings, and the board answers in a tab of its own.
  function dialBbs(number) {
    try {
      const d = new Techno(); d.volume(B.shot ? 0 : cfg.music.volume);
      const len = d.dialup(number.replace(/\D/g, '') || '5550199', B.shot ? 0 : 1);
      setTimeout(() => d.ctx.close(), len * 1000 + 500);
    } catch { /* no audio device */ }
    switchTab(makeTab({ bbs: number, name: 'BBS ' + number }));
    ircPanel.event('cd', 'a BBS');
  }

  // Talking to NYX. The exchange shows in an overlay on the pane, not in the terminal
  // text: anything written into xterm behind ConPTY's back is painted over by its next redraw.
  async function nyxChat(p, message) {
    const add = (cls, text) => {
      const d = document.createElement('div'); d.className = cls; d.textContent = text; p.chat.appendChild(d);
      while (p.chat.children.length > 8) p.chat.firstChild.remove();
      return d;
    };
    add('you', '> ' + (message || 'nyx'));
    if (/hack\s+the\s+planet/i.test(message) && !B.world) Worlds.go('hack');
    const reply = add('her', 'NYX> ...');
    p.chat.classList.add('show'); clearTimeout(p.chatHide);
    const line = await nyx.chat(message);
    reply.textContent = 'NYX> ' + line.text;
    p.chatHide = setTimeout(() => p.chat.classList.remove('show'), 30000);
  }

  if (B.startTabs.length && !B.shot) { // the saved start tabs
    for (const s of B.startTabs) { const t = makeTab({ profile: s.profile, cwd: s.cwd, name: s.name, color: s.color }); if (s.panes > 1) { switchTab(t); setPanes(s.panes); } }
    switchTab(tabs[0]);
  } else switchTab(makeTab());
  if (B.panes > 1) setPanes(B.panes);
  for (let i = 1; i < (B.tabs || 1); i++) makeTab();
  if (B.tabs > 1) switchTab(tabs[0]);

  // --- NYX --------------------------------------------------------------------
  // The scroller: greetz (a few at a time, rotating), the keys, and NYX's last line.
  const GREETZ = ['f0rkz', 'sp00nz', 'the S1LV3RWAREZ crew', 'Zero Cool', 'Acid Burn', 'Cereal Killer', 'Lord Nikon', 'Phantom Phreak', 'Razor & Blade',
    'everyone at 2600', 'the #hackers regulars', 'all the sysops still running a BBS', 'whoever wrote the first keygen music', 'NOT the Plague'];
  const KEYS = 'ctrl+shift+M music  ctrl+shift+W world  ctrl+shift+N nyx  ctrl+shift+I irc  ctrl+shift+B tempo mode  ctrl+shift+T new tab  ctrl+tab next tab  ctrl+shift+1-4 panes  ctrl+shift+F find  ctrl+= bigger text  type  nyx <message>  to talk to her  dial 555-0199 for the BBS  ctrl+shift+O see-through  ctrl+shift+U frame  ctrl+shift+S hide this scroller  ctrl+shift+L hide the logo  ctrl+shift+D data packets  ctrl+shift+J your own music  ctrl+shift+P play/pause  ctrl+shift+[ ] tracks  right-click for the menu  F11 fullscreen';
  let greet = 0, nyxTail = '';
  setInterval(() => { greet = (greet + 3) % GREETZ.length; }, 45000);
  const scrollText = () => {
    const g = [0, 1, 2].map((i) => GREETZ[(greet + i) % GREETZ.length]);
    return `      GIBSON  ::  NYX IS WATCHING  ::  greetz to ${g[0]}, ${g[1]} and ${g[2]}  ::  hack the planet  ::  ${KEYS}  ::  ${nyxTail}`;
  };
  // 1337 5p34k, when NYX is in the mood (right-click > NYX speaks 1337). Not every letter: it stays readable.
  const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', g: '9', b: '8' };
  const leet = (s) => s.replace(/[aeiostlgb]/gi, (c) => (Math.random() < 0.65 ? LEET[c.toLowerCase()] : c));
  const nyx = new Nyx(cfg, {
    info: () => ({ user: B.user, host: B.host, hour: new Date().getHours(), activity: act.level().toFixed(2), cwd: (worldEnv.fs && worldEnv.fs.cwd) || B.cwd }),
    llm: (ev) => window.gibson.llm(ev),
    say(said, mood, world) {
      const text = cfg.nyx.leet ? leet(said) : said;
      const el = $('nyxtext'); el.textContent = ''; let i = 0;
      $('nyx').classList.remove('glitch'); void $('nyx').offsetWidth; $('nyx').classList.add('glitch');
      const iv = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(iv); }, 28);
      nyxTail = `NYX SAYS: ${text.toUpperCase()}  ::  `;
      go(world);
      if (cfg.nyx.voice && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(said); u.pitch = 0.55; u.rate = 1.02;
        const v = speechSynthesis.getVoices().find((x) => /zira|female|aria|jenny/i.test(x.name)); if (v) u.voice = v;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      }
    },
  });

  // --- the IRC lobby (renderer/irc.js): a fake #hackers unless config.json says real ---
  const ircPanel = IrcPanel.create($('irc'), {
    mode: (cfg.irc && cfg.irc.mode) || 'fake', nick: (cfg.irc && cfg.irc.nick) || B.user,
    ask: cfg.llm.provider === 'none' ? null : (text, history) => window.gibson.llm({ kind: 'chat', message: text, history, ...nyx.ctx.info() }).then((l) => l && l.text),
    onFocusTerminal: () => focused.term.focus(),
  });
  if (cfg.ircOpen || B.irc) ircPanel.show();
  Theatre.volume = B.shot ? 0 : cfg.music.volume;

  // --- worlds + fx ------------------------------------------------------------
  worldEnv.fs = await window.gibson.listDir(focused.id);
  Worlds.start($('world'), () => ({ level: act.level(), pulse, warp, fs: worldEnv.fs, git: worldEnv.git, net: worldEnv.net, procs: worldEnv.procs, news: worldEnv.news, packets: cfg.packets !== false, home: B.shot ? [40.7, -74] : null }));

  // --- live data: polled fast while its world is showing, slowly otherwise, so NYX can react ---
  const services = new Set(), hogs = new Map(), titles = new Set();
  let netAt = 0, procAt = 0;
  setInterval(async () => {
    const now = Date.now(), w = Worlds.current();
    if (now - netAt > (w === 'net' || w === 'traffic' ? 3000 : 20000)) {
      netAt = now; const first = !worldEnv.net; worldEnv.net = await window.gibson.net();
      for (const c of worldEnv.net) if (!services.has(c.service)) { // a kind of connection not seen this session
        services.add(c.service); if (!first) nyx.event('net', { detail: `a new connection to ${c.service}` }, false);
      }
    }
    if (now - procAt > (w === 'hive' ? 3000 : 30000)) {
      procAt = now; worldEnv.procs = await window.gibson.procs();
      for (const p of worldEnv.procs) { // two hot polls in a row is a hog, said once per process
        const n = p.cpu > 80 ? (hogs.get(p.name) || 0) + 1 : 0; hogs.set(p.name, n);
        if (n === 2) nyx.event('hog', { detail: `${p.name} is using ${Math.round(p.cpu)}% CPU` }, false);
      }
    }
  }, 1000);
  window.gibson.onNews((items) => {
    const fresh = items.filter((i) => !titles.has(i.title)), first = !worldEnv.news;
    for (const i of items) titles.add(i.title);
    worldEnv.news = items;
    if (!first && fresh.length) { Worlds.signal('news'); nyx.event('news', { headline: fresh[0].title, detail: fresh[0].source }, false); ircPanel.event('news', fresh[0].title); }
  });
  if (B.world || cfg.world) Worlds.go(B.world || cfg.world);
  Fx.start({ logo: $('logo'), scroller: $('scroller'), rain: $('rain'), smoke: $('smoke') },
    () => ({ pulse, level: act.level(), smoking: act.busyOut > 4, cig: cfg.cigarette !== false, scroll: scrollText() }));

  // --- hotkeys + right-click menu: main.js catches the keys, both land here ----
  const OPACITY = [1, 0.86, 0.7, 0.5, 0.3, 0.15, 0];
  // Per pane. The last choice is saved and becomes the default for new panes.
  const setOpacity = (p, o) => { p.opacity = o; p.el.style.setProperty('--term-alpha', o); };
  const setFramed = (on) => { cfg.framed = on; document.body.classList.toggle('unframed', !on); };
  setFramed(cfg.framed !== false && !B.unframed);
  const setScroller = (on) => { cfg.scroller = on; document.body.classList.toggle('noscroll', !on); };
  setScroller(cfg.scroller !== false);
  const setLogo = (on) => { cfg.logo = on; document.body.classList.toggle('nologo', !on); };
  setLogo(cfg.logo !== false);

  // --- the jukebox: the user's own folder instead of the synth (renderer/jukebox.js) ---
  const juke = new Jukebox((t) => { $('track').textContent = t; nyx.event('track', { detail: t }, false); ircPanel.event('track', t); });
  juke.shuffle = cfg.music.shuffle !== false; juke.volume(B.shot ? 0 : cfg.music.volume); // shots stay silent
  const jukeOn = () => cfg.music.source === 'folder' && juke.tracks.length > 0;
  const saveMusic = () => window.gibson.save('music', { source: cfg.music.source, folder: cfg.music.folder, shuffle: juke.shuffle, volume: cfg.music.volume, on: cfg.music.on });
  function showPlayer() {
    $('player').classList.toggle('off', !jukeOn());
    $('pp').textContent = juke.playing ? '||' : '>'; $('shuf').classList.toggle('lit', juke.shuffle);
  }
  function useSource(src) { // 'synth' or 'folder'; the other one goes quiet
    cfg.music.source = src;
    if (jukeOn()) { if (music) music.stop(); if ((cfg.music.on || B.shot) && !B.mute) juke.play(); }
    else { cfg.music.source = 'synth'; juke.pause(); startMusic(); }
    showPlayer(); saveMusic();
  }
  async function pickFolder() {
    const list = await window.gibson.musicPick(); if (!list) return;
    cfg.music.folder = list.folder; juke.load(list);
    if (!list.tracks.length) { nyx.ctx.say('No music in that folder. Not even a MOD file.', 'bored'); return; }
    useSource('folder');
  }
  function musicAction(a) {
    if (a === 'music:pick') return pickFolder();
    if (a === 'music:synth') return useSource('synth');
    if (a === 'music:folder' || (a === 'music:source' && cfg.music.source === 'synth')) return juke.tracks.length ? useSource('folder') : pickFolder();
    if (a === 'music:source') return useSource('synth');
    if (a === 'music:volup' || a === 'music:voldown') {
      cfg.music.volume = Math.max(0, Math.min(1, cfg.music.volume + (a === 'music:volup' ? 0.1 : -0.1)));
      juke.volume(cfg.music.volume); if (music) music.volume(cfg.music.volume);
      $('track').textContent = `VOL ${Math.round(cfg.music.volume * 100)}%`; setTimeout(() => { $('track').textContent = juke.title; }, 1200);
    } else if (jukeOn()) {
      if (a === 'music:toggle') juke.toggle(); else if (a === 'music:next') juke.next(); else if (a === 'music:prev') juke.prev();
      else if (a === 'music:shuffle') juke.setShuffle(!juke.shuffle);
    } else if (a === 'music:toggle') { cfg.music.on = !cfg.music.on; if (cfg.music.on) startMusic(); else if (music) music.stop(); }
    showPlayer(); saveMusic();
  }
  for (const b of document.querySelectorAll('#player button')) b.onclick = () => { musicAction(b.dataset.a); focused.term.focus(); };
  function action(a) {
    const t = focused.term;
    if (a === 'copy') navigator.clipboard.writeText(t.getSelection());
    else if (a === 'paste') { const p = focused; navigator.clipboard.readText().then((s) => pasteInto(p, s)); }
    else if (a === 'find') return openFind(focused);
    else if (a.startsWith('font:')) setFont(a === 'font:up' ? cfg.fontSize + 1 : a === 'font:down' ? cfg.fontSize - 1 : B.defaults.fontSize);
    else if (a === 'broadcast') { if (tab.panes.length > 1) tab.broadcast = !tab.broadcast; tab.el.classList.toggle('broadcast', !!tab.broadcast); label(tab); }
    else if (a === 'zoompane') { if (tab.panes.length > 1) { tab.zoom = !tab.zoom; for (const x of tab.panes) x.el.classList.toggle('zoom', tab.zoom && x === focused); layout(tab); } }
    else if (a === 'evenpanes') { tab.c = tab.r = 0.5; layout(tab); }
    else if (a.startsWith('tabcolor:')) { tab.opts = { ...tab.opts, color: a.slice(9) || undefined }; label(tab); }
    else if (a === 'irc') { ircPanel.toggle(); window.gibson.save('ircOpen', ircPanel.visible); if (ircPanel.visible) return ircPanel.focus(); }
    else if (a === 'leet') { cfg.nyx.leet = !cfg.nyx.leet; window.gibson.save('nyxLeet', cfg.nyx.leet); nyx.ctx.say(cfg.nyx.leet ? 'Elite mode. Try to keep up, newbie.' : 'Plain speech. For the slow.', 'playful'); }
    else if (a === 'pasteguard') { cfg.pasteGuard = cfg.pasteGuard === false; window.gibson.save('pasteGuard', cfg.pasteGuard); }
    else if (a === 'music') {
      cfg.music.on = !cfg.music.on;
      if (jukeOn()) { if (cfg.music.on) juke.play(); else juke.pause(); showPlayer(); } else if (cfg.music.on) startMusic(); else if (music) music.stop();
      saveMusic();
    }
    else if (a.startsWith('music:')) return musicAction(a);
    else if (a === 'logo') { setLogo(!cfg.logo); window.gibson.save('logo', cfg.logo); }
    else if (a === 'cigarette') { cfg.cigarette = cfg.cigarette === false; window.gibson.save('cigarette', cfg.cigarette); }
    else if (a === 'nyxworlds') { cfg.nyxWorlds = cfg.nyxWorlds === false; window.gibson.save('nyxWorlds', cfg.nyxWorlds); }
    else if (a === 'tabs:save') { window.gibson.saveTabs(tabs.map((x) => ({ id: x.panes[0].id, panes: x.panes.length, name: x.opts.name, color: x.opts.color }))); nyx.ctx.say(`${tabs.length} tab${tabs.length > 1 ? 's' : ''} saved. They will be waiting next time.`, 'tender'); }
    else if (a === 'packets') { cfg.packets = cfg.packets === false; window.gibson.save('packets', cfg.packets); }
    else if (a === 'tempo') { cfg.music.mode = cfg.music.mode === 'reactive' ? 'fixed' : 'reactive'; nyx.ctx.say(`Tempo ${cfg.music.mode === 'fixed' ? 'locked at ' + cfg.music.bpm : 'follows your hands'}.`, 'playful'); }
    else if (a === 'nyx') { cfg.nyx.on = !cfg.nyx.on; $('nyx').style.opacity = cfg.nyx.on ? 1 : 0.3; }
    else if (a === 'world') { const n = Worlds.names; Worlds.go(n[(n.indexOf(Worlds.current()) + 1) % n.length]); }
    else if (a.startsWith('world:')) Worlds.go(a.slice(6));
    else if (a === 'rain') Fx.rain(4);
    else if (a === 'frame') { setFramed(!cfg.framed); window.gibson.save('framed', cfg.framed); }
    else if (a === 'scroller') { setScroller(!cfg.scroller); window.gibson.save('scroller', cfg.scroller); }
    else if (a === 'opacity' || a.startsWith('opacity:')) {
      const o = a === 'opacity' ? OPACITY[(OPACITY.findIndex((x) => x <= focused.opacity + 0.001) + 1) % OPACITY.length] : Number(a.slice(8));
      setOpacity(focused, o); cfg.opacity = o; window.gibson.save('opacity', o);
    }
    else if (a.startsWith('panes:')) return setPanes(Number(a.slice(6)));
    else if (a === 'newtab') return switchTab(makeTab({ from: focused && focused.id }));
    else if (a.startsWith('newtab:')) return switchTab(makeTab({ profile: a.slice(7), from: focused && focused.id }));
    else if (a === 'closetab') return closeTab(tab);
    else if (a === 'renametab') return renameTab(tab);
    else if (a === 'nexttab') return stepTab(1);
    else if (a === 'prevtab') return stepTab(-1);
    else if (a === 'fullscreen') window.gibson.fullscreen();
    t.focus();
  }
  window.gibson.onHotkey(action);
  $('newtab').onclick = () => action('newtab');
  $('shells').onclick = () => window.gibson.shellMenu();
  addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const p = tab.panes.find((x) => x.el.contains(e.target)); if (p) p.term.focus();
    window.gibson.menu({
      selection: !!focused.term.getSelection(), panes: tab.panes.length, zoomed: !!tab.zoom, broadcast: !!tab.broadcast, tabColor: tab.opts.color || '', tabs: tabs.length, opacity: focused.opacity, framed: cfg.framed, scroller: cfg.scroller !== false,
      worlds: Worlds.names.map((n) => [n, Worlds.label(n)]), world: Worlds.current(),
      irc: ircPanel.visible, leet: !!cfg.nyx.leet, music: !!cfg.music.on, reactive: cfg.music.mode === 'reactive', nyx: !!cfg.nyx.on,
      source: jukeOn() ? 'folder' : 'synth', folder: cfg.music.folder, shuffle: juke.shuffle, logo: cfg.logo !== false, packets: cfg.packets !== false,
    });
  });

  // --- the loop ---------------------------------------------------------------
  // A command is done when the output has gone quiet and the cursor sits at an empty prompt.
  // ponytail: prompt-shape heuristic, like typedLine; OSC 133 would be exact.
  let doneCheck = 0;
  function finishedCommands() {
    const now = Date.now(), after = (cfg.notifyAfterSec ?? 10) * 1000;
    for (const p of allPanes()) {
      if (!p.cmdAt || now - p.lastOut < 1200) continue;
      const line = typedLine(p); if (line === null || line.trim()) continue;
      const took = now - p.cmdAt; p.cmdAt = 0;
      if (!after || took < after || (document.hasFocus() && p.tab === tab)) continue; // you saw it finish
      const secs = Math.round(took / 1000), dur = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
      if (p.tab !== tab) { p.tab.done = true; label(p.tab); }
      if (!B.shot) new Notification(p.errorSeen ? 'GIBSON: finished with errors' : 'GIBSON: finished', { body: `${p.lastCmd}  (${dur})`, silent: false }).onclick = () => { window.gibson.focusWindow?.(); switchTab(p.tab); };
    }
  }
  let cookieDone = false, lastT = performance.now(), idleSaid = false, compileSaid = false, streakAt = 0, lateSaid = false;
  setInterval(() => {
    const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
    act.tick(dt);
    const lvl = act.level();
    if (jukeOn()) { pulse = Math.max(juke.pulse(), pulse - dt * 3); juke.draw($('player')); } // the beat of your own track, and the player skin
    else if (music) { music.level = lvl; music.bpm = act.glide(dt, cfg.music); pulse = music.on ? music.pulse() : 0; }
    else pulse = Math.max(0, pulse - dt * 3);
    warp = Math.max(lvl, warp - dt * 2.5);
    const fr = $('frame').style; fr.setProperty('--glow', pulse.toFixed(3)); fr.setProperty('--warp', warp.toFixed(3));
    $('status').textContent = `${jukeOn() ? (juke.playing ? 'JUKEBOX' : 'PAUSED') : Math.round(act.bpm) + ' BPM'}  ${'▮'.repeat(Math.round(lvl * 10)).padEnd(10, '▯')}\n${Worlds.label()}  //  ${B.user}@${B.host}`;

    if (act.idle > 75 && !idleSaid) { idleSaid = true; nyx.event('idle', {}, true); go('maze'); ircPanel.event('idle'); } // the screensaver kicks in
    if (act.idle < 1) {
      // Back from a long idle, once a session, maybe: the cookie monster wants feeding.
      if (idleSaid && cfg.eggs !== false && !cookieDone && performance.now() > 20 * 60000 && Math.random() < 0.15) { cookieDone = true; Theatre.cookie(focused.el, () => focused.term.focus()); }
      idleSaid = false;
    }
    if (act.busyOut > 4 && !compileSaid) { compileSaid = true; nyx.event('compile', { cmd: focused.lastCmd }, true); go('pipes'); ircPanel.event('compile'); }
    if (compileSaid && act.busyOut === 0) { compileSaid = false; nyx.event('done', { cmd: focused.lastCmd, output: focused.outTail }, true); ircPanel.event('done'); }
    if (lvl > 0.85 && now - streakAt > 60000) { streakAt = now; nyx.event('streak', {}, false); }
    if (now - doneCheck > 500) { doneCheck = now; finishedCommands(); }
    const h = new Date().getHours();
    if (!lateSaid && h >= 1 && h < 5 && act.idle < 2) { lateSaid = true; nyx.event('late', {}, true); }
    if (Math.random() < dt * (1 / 100 + lvl / 35)) Fx.rain(1.5 + Math.random() * 2.5);
  }, 50);

  // --- boot: dial in, then hand over -------------------------------------------
  function startMusic() {
    if (B.mute || !cfg.music.on || jukeOn()) return;
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
  if (cfg.music.source === 'folder' && cfg.music.folder) juke.load(await window.gibson.musicList());
  focused.term.focus(); if (jukeOn()) useSource('folder'); else startMusic();
  nyx.event('boot', {}, true);

  if (B.shot) { // headless screenshot: give it something to look at
    if (tab.panes.length > 1) tab.panes.forEach((p, i) => setOpacity(p, [0.86, 0.55, 0.3, 0.7][i]));
    setTimeout(() => tab.panes.forEach((p, i) => window.gibson.write(p.id, demoCmd(i))), 1500);
    if (B.chat) setTimeout(() => { const t = tab.panes[0].term; for (const ch of `nyx ${B.chat}\r`) t.input(ch); }, 4000); // the real keystroke path
    if (B.cmd) setTimeout(() => { const t = tab.panes[0].term; for (const ch of `${B.cmd}\r`) t.input(ch); }, 3000); // a GIBSON command, typed
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
