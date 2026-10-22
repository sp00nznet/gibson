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
  // On/off extras, each a right-click checkbox saved under its own key; the value is its default.
  const EXTRAS = { hollywood: false, crt: false, keyclick: false, chimes: true, bios: false, bsod: false, classic: false, readable: true, copyselect: false, rclickpaste: false, shellint: true };
  const flag = (k) => (cfg[k] === undefined ? EXTRAS[k] : !!cfg[k]);
  const READABLE = 4.5; // the contrast 'Readable text' guarantees, against black
  const applyLook = () => { document.body.classList.toggle('crt', flag('crt')); document.body.classList.toggle('classic', flag('classic')); };
  applyLook();
  const sfx = new Sfx(() => (B.mute || B.shot ? 0 : cfg.music.volume));
  let chimeAt = 0; // one chime at a time: an error that NYX then talks about rings once
  const chime = (k) => { if (!flag('chimes') || Date.now() - chimeAt < 1500) return; chimeAt = Date.now(); sfx.chime(k); };

  // --- terminals: 1 to 4 tiled panes. Each pane has its own shell. ---------
  const TERM_OPTS = {
    fontFamily: cfg.fontFamily, fontSize: cfg.fontSize, cursorBlink: true, cursorStyle: 'block',
    allowProposedApi: true, allowTransparency: true, scrollback: 5000,
    minimumContrastRatio: flag('readable') ? READABLE : 1, // dim colours get lifted so they read over the worlds
    theme: {
      background: '#00000000', foreground: '#b8ffd9', cursor: '#ff2e88', cursorAccent: '#000', selectionBackground: '#ff2e8866',
      scrollbarSliderBackground: '#39ff9c22', scrollbarSliderHoverBackground: '#39ff9c44', scrollbarSliderActiveBackground: '#ff2e8866',
      black: '#0a0f0c', red: '#ff3864', green: '#39ff9c', yellow: '#ffd23f', blue: '#36a3ff', magenta: '#ff2e88', cyan: '#36d6ff', white: '#cfe9dc',
      brightBlack: '#4d6b5c', brightRed: '#ff6b8b', brightGreen: '#8bffc4', brightYellow: '#ffe680', brightBlue: '#7cc4ff', brightMagenta: '#ff7ab8', brightCyan: '#8ae9ff', brightWhite: '#ffffff',
    },
  };
  // Tabs each hold 1 to 4 panes. Pane ids are global: main.js keys its shells by them.
  const tabs = []; let tab = null, focused = null, nextId = (B.idBase || 0) + 1, dragged = null; // ids are global across windows
  const allPanes = () => tabs.flatMap((t) => t.panes);

  // opts: { profile, cwd } for the tab's shells; blank means the default shell in the home folder.
  // adopt: pane ids of running shells (a tab torn off another window) instead of new ones.
  function makeTab(opts, adopt) {
    const t = { panes: [], focused: null, cwdName: '', opts: opts || {}, root: null, handles: new Map(), el: document.createElement('div'), btn: document.createElement('button') };
    t.el.className = 'tab n1'; $('termwrap').appendChild(t.el);
    t.btn.className = 'tabbtn'; t.btn.title = 'double-click renames, drag to reorder, out of the window or onto another, middle-click closes';
    t.btn.draggable = true; // drag a tab onto another to move it there
    t.btn.ondragstart = (e) => { dragged = t; e.dataTransfer.effectAllowed = 'move'; };
    t.btn.ondragend = (e) => { // dropped outside the window: the tab gets a window of its own
      dragged = null;
      const out = e.screenX < screenX || e.screenX > screenX + outerWidth || e.screenY < screenY || e.screenY > screenY + outerHeight;
      if (out && e.dataTransfer.dropEffect === 'none') detach(t, e.screenX, e.screenY);
    };
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
    tabs.push(t);
    if (adopt) { for (const id of adopt) makePane(t, null, id); t.root = Panes.grid(t.panes); } else makePane(t, t.opts.from);
    layout(t);
    label(t);
    window.gibson.listDir(t.panes[0].id).then((fs) => { t.cwdName = baseName(fs.cwd); label(t); });
    return t;
  }
  function label(t) {
    const shell = t.opts.profile && t.opts.profile !== B.defaultShell ? ` (${t.opts.profile})` : '';
    const prog = (t.focused || t.panes[0] || {}).title; // what the program running there calls itself (vim, ssh...)
    const name = t.opts.name || prog || `${t.cwdName || 'shell'}${shell}`; // a name you gave it wins, then the program's title, then the folder
    // typing into all panes; a command finished in the background; it rang the bell; new output while you were elsewhere
    const badge = (t.broadcast ? '\u21f6 ' : '') + (t.done ? '\u25cf ' : '') + (t.bell ? 'BEL ' : '') + (t.busy && !t.done && !t.bell ? '\u2022 ' : '');
    t.btn.firstChild.textContent = `${badge}${tabs.indexOf(t) + 1}:${name}${t.panes.length > 1 ? ' [' + t.panes.length + ']' : ''}`;
    t.btn.style.setProperty('--tabc', t.opts.color || '');
    t.btn.classList.toggle('coloured', !!t.opts.color);
  }
  // Panes sit where the tab's split tree (renderer/panes.js) puts them, GAP px apart. Each split
  // gets a handle on its gap to drag; zoomed, the zoomed pane takes the whole tab.
  const GAP = 6;
  function box(s, x, y, w, h, g) { // fractions of the tab -> position, gaps taken out (g = 0: edge to edge)
    s.left = `calc(${x} * (100% - ${g}px) + ${g}px)`; s.top = `calc(${y} * (100% - ${g}px) + ${g}px)`;
    s.width = `calc(${w} * (100% - ${g}px) - ${g}px)`; s.height = `calc(${h} * (100% - ${g}px) - ${g}px)`;
  }
  function layout(t) {
    const n = t.panes.length, R = Panes.rects(t.root), seen = new Set();
    for (const c of [...t.el.classList]) if (/^n\d+$/.test(c)) t.el.classList.remove(c);
    t.el.classList.add('n' + n);
    for (const r of R.panes) {
      if (t.zoom && r.p.el.classList.contains('zoom')) box(r.p.el.style, 0, 0, 1, 1, n > 1 ? GAP : 0);
      else box(r.p.el.style, r.x, r.y, r.w, r.h, n > 1 ? GAP : 0);
    }
    if (!t.zoom) for (const sp of R.splits) {
      let h = t.handles.get(sp.node);
      if (!h) { h = document.createElement('div'); t.el.appendChild(h); t.handles.set(sp.node, h); dragGap(t, sp.node, h); }
      seen.add(sp.node); h.rect = sp;
      const row = sp.node.dir === 'row', b = row ? sp.x + sp.w * sp.node.ratio : sp.y + sp.h * sp.node.ratio, S = `(100% - ${GAP}px)`;
      h.className = 'splitter ' + (row ? 'vsplit' : 'hsplit');
      Object.assign(h.style, row
        ? { left: `calc(${b} * ${S} + ${GAP / 2 - 4}px)`, top: `calc(${sp.y} * ${S} + ${GAP}px)`, width: '8px', height: `calc(${sp.h} * ${S} - ${GAP}px)` }
        : { top: `calc(${b} * ${S} + ${GAP / 2 - 4}px)`, left: `calc(${sp.x} * ${S} + ${GAP}px)`, height: '8px', width: `calc(${sp.w} * ${S} - ${GAP}px)` });
    }
    for (const [node, h] of t.handles) if (!seen.has(node)) { h.remove(); t.handles.delete(node); }
    t.el.classList.toggle('zoomed', !!t.zoom);
  }
  function dragGap(t, node, h) {
    h.onpointerdown = (e) => {
      e.preventDefault(); h.setPointerCapture(e.pointerId); const sp = h.rect;
      h.onpointermove = (m) => {
        const r = t.el.getBoundingClientRect(), row = node.dir === 'row';
        const f = row ? ((m.clientX - r.left - GAP / 2) / (r.width - GAP) - sp.x) / sp.w : ((m.clientY - r.top - GAP / 2) / (r.height - GAP) - sp.y) / sp.h;
        node.ratio = Math.max(0.08, Math.min(0.92, f)); layout(t);
      };
      h.onpointerup = () => { h.onpointermove = null; };
    };
  }
  // Each pane's header strip: its folder and a close x; drag it onto another pane to dock beside
  // that one (the half you're over) or swap with it (the middle). In the classic window style the
  // drawn title bar is the strip.
  function paneHead(p) {
    const h = document.createElement('div'); h.className = 'phead';
    h.innerHTML = '<span class="pname"></span><span class="px" title="close this pane">×</span>';
    p.el.appendChild(h); p.head = h;
    setTimeout(() => window.gibson.listDir(p.id).then((fs) => paneName(p, fs.cwd)), 400); // once its shell has a folder
    h.lastChild.onpointerdown = (e) => e.stopPropagation();
    h.lastChild.onclick = () => closePaneUI(p);
    h.onpointerdown = (e) => {
      if (e.button !== 0 || p.tab.panes.length < 2) return;
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null, zone = null;
      h.onpointermove = (m) => {
        if (!ghost && Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return;
        if (!ghost) { ghost = document.createElement('div'); ghost.className = 'dropzone'; p.tab.el.appendChild(ghost); p.el.classList.add('dragging'); }
        over = p.tab.panes.find((q) => { const r = q.el.getBoundingClientRect(); return m.clientX >= r.left && m.clientX < r.right && m.clientY >= r.top && m.clientY < r.bottom; });
        zone = over && over !== p ? dropZone(over.el.getBoundingClientRect(), m.clientX, m.clientY) : null;
        showZone(ghost, over, zone);
      };
      h.onpointerup = () => {
        h.onpointermove = h.onpointerup = null;
        if (ghost) { ghost.remove(); p.el.classList.remove('dragging'); }
        if (zone) movePane(p, over, zone);
      };
    };
  }
  // The middle fifth of a pane swaps; otherwise the nearest edge docks there.
  function dropZone(r, x, y) {
    const fx = (x - r.left) / r.width, fy = (y - r.top) / r.height;
    if (Math.abs(fx - 0.5) < 0.2 && Math.abs(fy - 0.5) < 0.2) return 'swap';
    const d = { left: fx, right: 1 - fx, up: fy, down: 1 - fy };
    return Object.keys(d).sort((a, b) => d[a] - d[b])[0];
  }
  function showZone(g, q, z) {
    g.style.display = z ? '' : 'none'; if (!z) return;
    let x = q.el.offsetLeft, y = q.el.offsetTop, w = q.el.offsetWidth, h = q.el.offsetHeight;
    if (z === 'left' || z === 'right') { w /= 2; if (z === 'right') x += w; } else if (z === 'up' || z === 'down') { h /= 2; if (z === 'down') y += h; }
    Object.assign(g.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    g.textContent = z === 'swap' ? 'SWAP' : 'DOCK';
  }
  function movePane(p, q, z) {
    const t = p.tab;
    if (z === 'swap') t.root = Panes.swap(t.root, p, q);
    else t.root = Panes.split(Panes.remove(t.root, p), q, p, z === 'left' || z === 'right' ? 'row' : 'col', z === 'left' || z === 'up');
    unzoom(t); layout(t); p.term.focus();
  }
  const unzoom = (t) => { t.zoom = false; for (const x of t.panes) x.el.classList.remove('zoom'); };
  // Split the focused pane: a new shell beside it (right) or under it (down), in its folder.
  function splitPane(dir) {
    if (tab.panes.length >= Panes.MAX) return nyx.ctx.say(`${Panes.MAX} panes is the limit. Even I need to see.`, 'playful');
    const p = focused, q = makePane(tab, p.id);
    tab.root = Panes.split(tab.root, p, q, dir); unzoom(tab); layout(tab); label(tab);
    setFocus(q); q.term.focus();
  }
  // Close one pane (the last one takes its tab); focus goes to the pane next to it.
  function closePaneUI(p) {
    const t = p.tab;
    if (t.panes.length < 2) return closeTab(t);
    const next = ['left', 'up', 'right', 'down'].map((d) => Panes.neighbour(t.root, p, d)).find(Boolean) || t.panes.find((x) => x !== p);
    closePane(p); unzoom(t); if (t.panes.length < 2) t.broadcast = false;
    layout(t); label(t);
    if (t === tab) { focused = null; setFocus(next); next.term.focus(); } else t.focused = next;
  }
  // Rename in place: Enter keeps it, Escape backs out, an empty name goes back to the folder.
  // A one-line text box over the page (Electron has no prompt()). Enter keeps, Escape drops.
  function askText(placeholder, value, done) {
    const inp = document.createElement('input');
    inp.className = 'asktext'; inp.placeholder = placeholder; inp.value = value; document.body.appendChild(inp); inp.focus(); inp.select();
    const close = () => { inp.remove(); if (focused) focused.term.focus(); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { const v = inp.value.trim(); close(); if (v) done(v); } else if (e.key === 'Escape') close(); };
    inp.onblur = close;
  }
  window.gibson.onLlm((c) => Object.assign(cfg.llm, c));
  window.gibson.onSay((text, mood) => nyx.ctx.say(text, mood));
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
    if (tab && tab !== t) tab.leftAt = Date.now(); // its activity dot waits a second: the last of the output shouldn't count
    tab = t;
    for (const x of tabs) { x.el.classList.toggle('hidden', x !== t); x.btn.classList.toggle('on', x === t); }
    if (t.done || t.busy || t.bell) { t.done = t.busy = t.bell = false; label(t); }
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
  // Off into another window (or a new one), shells still running: this window lets go without
  // closing them. Main says no for the only tab unless it landed on another window.
  async function detach(t, x, y, into) {
    const ok = await window.gibson.detach({ ids: t.panes.map((p) => p.id), tree: Panes.save(t.root, (p) => p.id), opts: t.opts, last: tabs.length < 2, into }, x, y);
    if (!ok || !tabs.includes(t)) return;
    for (const p of t.panes) { p.ro.disconnect(); p.term.dispose(); }
    if (tabs.length < 2) return; // the window closes behind it
    const i = tabs.indexOf(t); t.el.remove(); t.btn.remove(); tabs.splice(i, 1);
    tabs.forEach(label);
    switchTab(tab === t ? tabs[Math.min(i, tabs.length - 1)] : tab);
  }
  const stepTab = (d) => switchTab(tabs[(tabs.indexOf(tab) + d + tabs.length) % tabs.length]);
  const baseName = (dir) => dir.split(/[\\/]/).filter(Boolean).pop() || dir;

  // from: the pane whose folder the new shell starts in (split from here)
  function makePane(t, from, adoptId, own) { // own: { profile, cwd } for this pane alone (a restored session)
    const id = adoptId || nextId++, el = document.createElement('div');
    el.className = 'pane'; el.dataset.title = 'GIBSON Prompt'; t.el.appendChild(el); // the title is for the classic window style
    const term = new Terminal(TERM_OPTS), fit = new FitAddon.FitAddon(), search = new SearchAddon.SearchAddon();
    term.loadAddon(fit); term.loadAddon(search);
    fileLinks(term, id);
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, uri) => window.open(uri)));
    term.loadAddon(new Unicode11Addon.Unicode11Addon()); term.unicode.activeVersion = '11';
    term.open(el);
    try { const gl = new WebglAddon.WebglAddon(); gl.onContextLoss(() => gl.dispose()); term.loadAddon(gl); } catch { /* DOM renderer is fine */ }
    const chat = document.createElement('div'); chat.className = 'nyxchat'; el.appendChild(chat);
    const p = { id, el, term, search, tab: t, chat, line: '', lastCmd: '', outTail: '', errorSeen: false, lastOut: 0, cmdAt: 0 };
    paneComforts(p);
    ShellInt.attach(p, { cwd: shellCwd, done: shellDone });
    term.attachCustomKeyEventHandler((e) => softKey(p, e)); // the soft keys; see softKey
    if (adoptId) window.gibson.adopt(id).then((buf) => { if (buf) term.write(buf); }); // what it showed in the old window
    else window.gibson.open(id, { ...t.opts, from, ...own });
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
      if (flag('keyclick')) sfx.key(d === '\r' ? 'enter' : d === ' ' ? 'space' : 'key');
      const enter = d === '\r' || d === '\n';
      const shown = enter ? typedLine(p) : null;
      const raw = shown && shown.trim() ? shown : enter ? p.line : '';
      const cmd = raw.trim();
      // GIBSON's own commands (`nyx <message>`, `dial 555-0199`, `nfo file`...) never reach the shell.
      const own = enter && /^(nyx|dial|wardial|nfo|scan|cookie|hack(?=\s+the\s+planet\b))(\s|$)/i.exec(cmd);
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
    t.panes.push(p); if (!t.root) t.root = Panes.leaf(p); // more panes join the tree where the caller splits
    paneHead(p);
    return p;
  }
  // The command line as the screen shows it: the cursor's row plus any rows it wrapped from,
  // up to the cursor (PSReadLine draws its grey predictions to the right of it). The prompt
  // ends at its first > $ # or % plus a space. Untrimmed, so its length is what the shell
  // holds. null when no prompt is recognised.
  // With shell integration it's exact: from the end of the prompt (OSC 133 B) to the cursor.
  // ponytail: without it, a prompt-shape heuristic.
  function typedLine(p) {
    const exact = ShellInt.typed(p); if (exact !== null) return exact;
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
  // A pane's comforts: the title its program sets, the bell, files dropped on it, copy on select.
  // ponytail: titles that are just the shell's own exe (ConPTY sets those) are ignored, so tabs keep their folder names.
  function paneComforts(p) {
    const { term, el } = p;
    term.onTitleChange((s) => {
      p.title = /\.exe$|powershell|^cmd$|command prompt/i.test(s) ? '' : s.slice(0, 32);
      if (p.title) el.dataset.title = p.title; // the classic window style's title bar (and a pane header, if there is one)
      label(p.tab);
    });
    term.onBell(() => {
      if (p.tab !== tab) { p.tab.bell = true; label(p.tab); return; }
      el.classList.remove('bellflash'); void el.offsetWidth; el.classList.add('bellflash'); // restart the flash
    });
    term.onSelectionChange(() => { const s = term.getSelection(); if (s && flag('copyselect')) navigator.clipboard.writeText(s); });
    // Only files from the desktop: tabs and panes being dragged around carry no 'Files'.
    el.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    el.addEventListener('drop', (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      const paths = [...e.dataTransfer.files].map((f) => window.gibson.pathOf(f)).filter(Boolean);
      if (!paths.length) return;
      term.paste(TermKit.quotePaths(paths, TermKit.shellKind(p.tab.opts.profile || B.defaultShell, /Windows/.test(navigator.userAgent) ? 'win32' : '')) + ' ');
      term.focus();
    });
  }
  const applyReadable = () => { for (const x of allPanes()) x.term.options.minimumContrastRatio = flag('readable') ? READABLE : 1; };
  // Every pane in every tab, searched at once; picking a match goes there and selects it.
  function searchAll() {
    const list = allPanes();
    TermKit.openGlobalSearch({
      seed: focused.term.getSelection().split('\n')[0],
      panes: () => list.map((p) => {
        const n = p.tab.panes.length > 1 ? ` / pane ${p.tab.panes.indexOf(p) + 1}` : '';
        return { label: `${tabs.indexOf(p.tab) + 1}:${p.tab.btn.firstChild.textContent.replace(/^\S*\d+:/, '')}${n}`, lines: () => { const b = p.term.buffer.active, out = []; for (let i = 0; i < b.length; i++) out.push(b.getLine(i).translateToString(true)); return out; } };
      }),
      jump: (i, m) => {
        const p = list[i]; if (!p || !tabs.includes(p.tab)) return;
        if (p.tab !== tab) switchTab(p.tab);
        setFocus(p); p.term.focus();
        p.term.scrollToLine(Math.max(0, m.row - Math.floor(p.term.rows / 2)));
        p.term.select(m.start, m.row, m.end - m.start);
      },
      onClose: () => focused.term.focus(),
    });
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
      const opts = { regex: false, caseSensitive: false }; // the Aa and .* toggles
      const go = (dir) => { const o = { ...opts, decorations: FIND_DECOR }; if (dir < 0) p.search.findPrevious(inp.value, o); else p.search.findNext(inp.value, o); };
      for (const b of TermKit.toggles(opts, () => go(1))) bar.insertBefore(b, count);
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
    p.tab.panes.splice(p.tab.panes.indexOf(p), 1); p.tab.root = Panes.remove(p.tab.root, p);
    if (p.tab.focused === p) p.tab.focused = null;
  }
  function setFocus(p) {
    if (focused === p) return;
    focused = p; p.tab.focused = p;
    for (const x of p.tab.panes) x.el.classList.toggle('focus', x === p);
    window.gibson.listDir(p.id).then((fs) => { worldEnv.fs = fs; Worlds.refreshFiles(); p.tab.cwdName = baseName(fs.cwd); paneName(p, fs.cwd); label(p.tab); });
    refreshGit(p);
  }
  // A pane's folder: its header strip and its classic title bar.
  const paneName = (p, dir) => { const n = baseName(dir); p.el.dataset.title = `GIBSON Prompt - ${n}`; if (p.head) p.head.firstChild.textContent = n; };
  // An even grid of n panes (1 to 16). Growing adds panes; shrinking closes the newest ones,
  // never the focused one. The panes keep their order, so a grid rearranges rather than reshuffles.
  function setPanes(n) {
    n = Math.max(1, Math.min(Panes.MAX, n | 0 || 1));
    while (tab.panes.length < n) makePane(tab, focused && focused.id);
    while (tab.panes.length > n) closePane(tab.panes.slice().reverse().find((p) => p !== focused));
    const order = Panes.leaves(tab.root); for (const p of tab.panes) if (!order.includes(p)) order.push(p);
    tab.root = Panes.grid(order); unzoom(tab);
    if (n < 2) tab.broadcast = false;
    layout(tab); label(tab);
    focused.term.focus();
  }

  window.gibson.onData((id, d) => {
    const p = allPanes().find((x) => x.id === id); if (!p) return;
    p.term.write(d); act.output(d.length); p.lastOut = Date.now();
    if (p.tab !== tab && !p.tab.busy && Date.now() - (p.tab.leftAt || 0) > 1000) { p.tab.busy = true; label(p.tab); } // a dot on its tab
    const plain = d.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g, '');
    p.outTail = (p.outTail + plain).slice(-2000);
    if (!p.errorSeen && p.lastCmd && /(error|not recognized|command not found|fatal:|exception|failed|denied)/i.test(plain)) failed(p);
  });
  function failed(p) { // the last command went wrong: said by its output, or by its exit code (shell integration)
    p.errorSeen = true; Worlds.signal('error'); chime('error'); if (flag('bsod')) bsod(p); nyx.event('error', { cmd: p.lastCmd, output: p.outTail }, true); ircPanel.event('error', p.lastCmd);
  }
  // Shell integration's word (renderer/shellint.js): the folder as the shell says it, and how
  // each command ended. A pane without it keeps guessing from `cd` lines and output.
  function shellCwd(p, dir) {
    window.gibson.cwd(p.id, dir);
    if (dir === p.cwd) return;
    const first = p.cwd === undefined; p.cwd = dir;
    if (first) return; // the first prompt: no change of folder to show
    window.gibson.listDir(p.id).then((fs) => {
      worldEnv.fs = fs; go('files'); Worlds.refreshFiles();
      p.tab.cwdName = baseName(fs.cwd); paneName(p, fs.cwd); label(p.tab); refreshGit(p); ircPanel.event('cd', p.tab.cwdName);
    });
  }
  function shellDone(p, rec) { if (rec.code && p.lastCmd && !p.errorSeen) failed(p); }

  function onCommand(p, cmd) {
    p.lastCmd = cmd; p.errorSeen = false; p.cmdAt = cmd ? Date.now() : 0;
    if (cmd) worldEnv.cmd = { text: cmd, at: Date.now() }; // the telegraph taps it out
    if (cmd && flag('hollywood')) hollywood(p);
    window.gibson.line(p.id, cmd);
    if (NYX_KIND(cmd) === 'cd' && !ShellInt.live(p)) setTimeout(async () => { // with shell integration, shellHooks.cwd does this
      worldEnv.fs = await window.gibson.listDir(p.id); go('files'); Worlds.refreshFiles();
      p.tab.cwdName = baseName(worldEnv.fs.cwd); paneName(p, worldEnv.fs.cwd); label(p.tab); refreshGit(p); ircPanel.event('cd', p.tab.cwdName);
    }, 250);
    if (/^git\b/i.test(cmd)) setTimeout(() => refreshGit(p), 1200); // new commits ignite in the galaxy
    if (cmd) setTimeout(() => { if (!p.errorSeen && p.lastCmd === cmd) Worlds.signal('ok'); }, 1500);
    $('frame').style.setProperty('--warp', 1); warp = 1; // the Enter lunge
    nyx.command(cmd);
    if (cmd) ircPanel.event(/^git\s+commit\b/i.test(cmd) ? 'commit' : NYX_KIND(cmd), cmd);
    if (NYX_KIND(cmd) === 'danger') Theatre.alert(null, { cmd }); // the Da Vinci treatment
  }

  // Hollywood hacking: every command gets the movie treatment over its pane, hands off the keys.
  const HW_LINES = ['BYPASSING FIREWALL', 'DECRYPTING PAYLOAD', 'TRACING ROUTE', 'SPOOFING MAC ADDRESS', 'INJECTING SHELLCODE', 'CRACKING ROOT PASSWORD', 'ROUTING THROUGH 7 PROXIES', 'DISABLING THE ICE'];
  function hollywood(p) {
    const now = Date.now(); if (now - (p.hwAt || 0) < 2400) return; // typing faster than the movie: skip
    p.hwAt = now;
    const el = document.createElement('div'), hex = document.createElement('pre'), box = document.createElement('div');
    el.className = 'hw'; hex.className = 'hex'; box.className = 'steps'; el.append(hex, box); p.el.appendChild(el);
    const lines = HW_LINES.slice().sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));
    const h4 = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, '0');
    const spin = setInterval(() => { hex.textContent = Array.from({ length: 16 }, () => Array.from({ length: 6 }, h4).join(' ')).join('\n'); }, 50);
    lines.forEach((l, i) => setTimeout(() => {
      const d = document.createElement('div'), bar = document.createElement('span'), fill = document.createElement('i');
      d.textContent = l + '... '; bar.className = 'bar'; bar.appendChild(fill); d.appendChild(bar); box.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = '100%'; }));
    }, i * 1200 / lines.length));
    setTimeout(() => {
      clearInterval(spin); hex.textContent = '';
      const r = document.createElement('div'); r.className = 'verdict ' + (p.errorSeen ? 'no' : 'yes'); r.textContent = p.errorSeen ? 'ACCESS DENIED' : 'ACCESS GRANTED'; el.appendChild(r);
    }, 1400);
    setTimeout(() => el.classList.add('out'), 2000);
    setTimeout(() => el.remove(), 2450);
  }
  // A blue screen over the pane when a command fails, at most every 20 s. It never takes a key.
  let bsodAt = 0;
  function bsod(p) {
    const now = Date.now(); if (now - bsodAt < 20000) return; bsodAt = now;
    const h4 = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, '0');
    const el = document.createElement('div'); el.className = 'bsod';
    el.innerHTML = `<div class="t"><span> GIBSON </span></div>\nA fatal exception 0E has occurred at 0028:${h4()}${h4()} in VXD GIBSON(01) +\n0001${h4()}. The current command will be terminated.\n\n*  Press any key to pretend this never happened.\n*  Press CTRL+ALT+DEL again to hack the planet. You will\n   lose any unsaved information in all applications.\n\n<div class="t">Press any key to continue <span class="cur">_</span></div>`;
    p.el.appendChild(el); setTimeout(() => el.classList.add('out'), 1200); setTimeout(() => el.remove(), 1700);
  }

  // The set pieces (renderer/theatre.js) and the BBS (bbs/bbs.js), each a command of its own.
  function builtin(p, name, arg) {
    const back = () => p.term.focus();
    if (name === 'nyx') return nyxChat(p, arg);
    if (name === 'hack') { if (!B.world) Worlds.go('hack'); return nyx.ctx.say('HACK THE PLANET!', 'intense'); }
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
  // With a brain she works the problem (agent.js): each tool she uses shows as a step line.
  const chatLine = (p, cls, text, before) => {
    const d = document.createElement('div'); d.className = cls; d.textContent = text; p.chat.insertBefore(d, before || null);
    while (p.chat.children.length > 16) p.chat.firstChild.remove();
    return d;
  };
  window.gibson.onStep((id, text) => { const p = allPanes().find((x) => x.id === id); if (p && p.reply) chatLine(p, 'step', '  ~ ' + text, p.reply); });
  async function nyxChat(p, message) {
    chatLine(p, 'you', '> ' + (message || 'nyx'));
    if (/hack\s+the\s+planet/i.test(message) && !B.world) Worlds.go('hack');
    const reply = p.reply = chatLine(p, 'her', 'NYX> ...');
    p.chat.classList.add('show'); clearTimeout(p.chatHide);
    nyxPane = p;
    const line = await nyx.chat(message);
    reply.textContent = 'NYX> ' + line.text; p.reply = null;
    p.chatHide = setTimeout(() => p.chat.classList.remove('show'), Math.min(120000, 30000 + line.text.length * 60));
  }
  let nyxPane = null; // the pane whose `nyx` question is in flight: her tools work in its folder

  const adoptTab = (a) => {
    const t = makeTab(a.opts, a.ids), byId = new Map(t.panes.map((p) => [p.id, p]));
    if (a.tree) { const r = Panes.load(a.tree, (id) => byId.get(id) || null); if (r && Panes.leaves(r).length === t.panes.length) t.root = r; } // else the even grid makeTab made
    layout(t); switchTab(t);
  };
  // Last time's tabs: each pane's shell in its folder, its old scrollback dimmed above a rule.
  function restoreTab(s) {
    const cells = Panes.leaves(Panes.load(s.tree, (x) => x)); if (!cells.length) return;
    const t = makeTab({ profile: cells[0].profile, cwd: cells[0].cwd, name: s.name, color: s.color });
    for (const c of cells.slice(1)) makePane(t, null, null, { profile: c.profile, cwd: c.cwd });
    const at = new Map(cells.map((c, i) => [c, t.panes[i]]));
    t.root = Panes.load(s.tree, (c) => at.get(c) || null);
    cells.forEach((c, i) => { if (c.text) t.panes[i].term.write(`\x1b[2m${c.text.replace(/\r?\n/g, '\r\n')}\x1b[0m\r\n\x1b[35m── restored session ──\x1b[0m\r\n`); });
    layout(t); label(t);
  }
  // The session as it stands: every tab's tree, and the tail of each pane's scrollback. Main
  // adds each pane's shell and folder. ponytail: the first window only; torn-off windows' tabs
  // aren't kept.
  const SCROLL_KEEP = 2000;
  function scrollTail(p) {
    const b = p.term.buffer.normal, lines = [];
    for (let y = Math.max(0, b.length - SCROLL_KEEP); y < b.length; y++) lines.push(b.getLine(y).translateToString(true));
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.join('\n');
  }
  const saveSession = () => window.gibson.saveSession(tabs.map((t) => ({ name: t.opts.name, color: t.opts.color, tree: Panes.save(t.root, (p) => ({ id: p.id, text: scrollTail(p) })) })));
  if (!B.shot && !B.adopt && !B.idBase) { setInterval(saveSession, 30000); addEventListener('beforeunload', saveSession); }
  window.gibson.onAdopt(adoptTab); // a tab dropped here from another window
  if (B.adopt) adoptTab(B.adopt); // a torn-off tab
  else if (B.session && B.session.length && !B.shot) { for (const s of B.session) restoreTab(s); switchTab(tabs[0] || makeTab()); }
  else if (B.startTabs.length && !B.shot) { // the saved start tabs
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
    llm: (ev) => (ev.kind === 'chat' ? window.gibson.agent({ ...ev, pane: (nyxPane || focused).id }) : window.gibson.llm(ev)),
    say(said, mood, world) {
      const text = cfg.nyx.leet ? leet(said) : said;
      chime('say');
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
  const makeIrc = (mode) => IrcPanel.create($('irc'), {
    mode, nick: (cfg.irc && cfg.irc.nick) || B.user,
    ask: cfg.llm.provider === 'none' ? null : (text, history) => window.gibson.llm({ kind: 'chat', message: text, history, ...nyx.ctx.info() }).then((l) => l && l.text),
    onFocusTerminal: () => focused.term.focus(),
  });
  let ircPanel = makeIrc((cfg.irc && cfg.irc.mode) || 'fake');
  if (cfg.ircOpen || B.irc) ircPanel.show();
  Theatre.volume = B.shot ? 0 : cfg.music.volume;

  // --- worlds + fx ------------------------------------------------------------
  worldEnv.fs = await window.gibson.listDir(focused.id);
  Worlds.start($('world'), () => ({ level: act.level(), pulse, warp, fs: worldEnv.fs, git: worldEnv.git, net: worldEnv.net, procs: worldEnv.procs, news: worldEnv.news, packets: cfg.packets !== false, ships: cfg.ships !== false, spec: jukeOn() ? juke.spectrum(specBuf) : music && music.on ? music.spectrum(specBuf) : null, dance: cfg.dance !== false, calm: cfg.calm !== false, typing: act.keys, cmd: worldEnv.cmd, build: act.busyOut, song: jukeOn() ? juke.title : music && music.on ? music.styleName : '', home: B.shot ? [40.7, -74] : null }));

  const specBuf = new Float32Array(48); // the jukebox's spectrum, for the Milkdrop worlds

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
    if (now - procAt > (w === 'hive' || mon.on ? 3000 : 30000)) {
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
    if (!first && fresh.length) { Worlds.signal('news'); chime('news'); nyx.event('news', { headline: fresh[0].title, detail: fresh[0].source }, false); ircPanel.event('news', fresh[0].title); }
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
  // The synth panel: knobs on whatever is playing (FX, read by each source's Rack in audio.js),
  // plus the synth's own controls. ponytail: settings last the session; save them if anyone asks.
  const LAYERS = [['kick', 'KICK'], ['snare', 'SNARE'], ['hats', 'HATS'], ['bass', 'BASS'], ['acid', 'LEAD'], ['guitar', 'GTR'], ['pad', 'PAD'], ['all', 'ALL IN']];
  function synthPaint() {
    const el = $('synth'); if (el.classList.contains('off')) return;
    el.classList.toggle('juke', jukeOn());
    $('sy-now').textContent = jukeOn() ? juke.title || '' : music ? `${music.styleName || '--'}  ${Math.round(music.bpm)} BPM  KEY ${music.shift > 0 ? '+' : ''}${music.shift}` : 'SYNTH OFF';
    for (const b of $('sy-styles').children) b.classList.toggle('lit', ((music && music.lock && music.lock.name) || 'AUTO') === b.dataset.k);
    for (const b of $('sy-layers').children) b.classList.toggle('lit', !!music && (b.dataset.k === 'all' ? music.allIn : !music.mute.has(b.dataset.k)));
  }
  function synthRow(id, items, click) {
    for (const [k, label] of items) { const b = document.createElement('button'); b.textContent = label; b.dataset.k = k; b.onclick = () => { if (music) click(k); synthPaint(); focused.term.focus(); }; $(id).append(b); }
  }
  synthRow('sy-styles', [['AUTO', 'AUTO'], ...Techno.STYLES.map((n) => [n, n])], (k) => music.setStyle(k));
  synthRow('sy-layers', LAYERS, (k) => { if (k === 'all') music.allIn = !music.allIn; else if (music.mute.has(k)) music.mute.delete(k); else music.mute.add(k); });
  $('sy-down').onclick = () => { if (music) music.shift = Math.max(-12, music.shift - 1); synthPaint(); };
  $('sy-up').onclick = () => { if (music) music.shift = Math.min(12, music.shift + 1); synthPaint(); };
  $('sy-next').onclick = () => { if (music) music.skip(); setTimeout(synthPaint, 300); };
  $('sy-reset').onclick = () => {
    Object.assign(FX, { cut: 1, res: 0, low: 0, drive: 0, echo: 0 }); Rack.update();
    for (const i of document.querySelectorAll('#synth [data-fx]')) i.value = FX[i.dataset.fx];
    $('sy-rate').value = 1; juke.audio.playbackRate = 1;
    if (music) { music.lock = null; music.mute.clear(); music.shift = 0; music.allIn = false; }
    synthPaint();
  };
  for (const i of document.querySelectorAll('#synth [data-fx]')) i.oninput = () => { FX[i.dataset.fx] = +i.value; Rack.update(); };
  $('sy-rate').oninput = () => { juke.audio.preservesPitch = false; juke.audio.playbackRate = +$('sy-rate').value; }; // tape speed: pitch goes with it
  setInterval(synthPaint, 500);

  // The system monitor: CPU, memory, disks, network rates and the top processes, polled once a
  // second while it's open. Processes come from the same poll the PROCESS HIVE uses (below).
  const mon = { on: cfg.sysmon === true, cpu: [], rx: [], tx: [] };
  $('sysmon').classList.toggle('off', !mon.on);
  const bytes = (n) => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < 4) { n /= 1024; i++; } return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`; };
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const meterRow = (label, frac, text) => `<div class="row"><span>${label}</span><div class="meter"><i class="${frac > 0.85 ? 'hot' : ''}" style="width:${Math.round(Math.min(1, frac) * 100)}%"></i></div><span class="v">${text}</span></div>`;
  function monGraph() { // CPU (green) and network in/out (ice/pink, scaled to the busiest second shown)
    const cv = $('sm-graph'), g = cv.getContext('2d'), W = cv.width, H = cv.height, n = 60;
    g.clearRect(0, 0, W, H);
    const line = (vals, max, col) => { g.strokeStyle = col; g.beginPath(); vals.forEach((v, i) => { const x = W - (vals.length - 1 - i) * W / (n - 1), y = H - 2 - (v / max) * (H - 4); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); };
    const top = Math.max(1024, ...mon.rx, ...mon.tx);
    g.lineWidth = 1; line(mon.rx, top, '#36d6ff'); line(mon.tx, top, '#ff2e88'); g.lineWidth = 1.5; line(mon.cpu, 100, '#39ff9c');
  }
  async function monPoll() {
    if (!mon.on) return;
    const s = await window.gibson.stats(); if (!mon.on) return;
    for (const [k, v] of [['cpu', s.cpu], ['rx', s.net.rx], ['tx', s.net.tx]]) { mon[k].push(v); if (mon[k].length > 60) mon[k].shift(); }
    const used = s.mem.total - s.mem.free;
    $('sm-rows').innerHTML = meterRow('CPU', s.cpu / 100, `${Math.round(s.cpu)}% x${s.cores}`)
      + meterRow('MEM', used / s.mem.total, `${bytes(s.mem.free)} free`)
      + s.disks.map((d) => meterRow(esc(d.name), 1 - d.free / d.total, `${bytes(d.free)} free`)).join('')
      + `<div class="row"><span>NET</span><span style="color:#36d6ff">IN ${bytes(s.net.rx)}/s</span><span class="v" style="color:#ff2e88">OUT ${bytes(s.net.tx)}/s</span></div>`;
    const ps = (worldEnv.procs || []).slice().sort((a, b) => b.cpu - a.cpu).slice(0, 6);
    $('sm-procs').innerHTML = '<div class="p h"><span>PROCESS</span><span>CPU</span><span>MEM</span></div>'
      + ps.map((p) => `<div class="p"><span>${esc(p.name)}${p.n > 1 ? ' x' + p.n : ''}</span><span>${(p.cpu / s.cores).toFixed(1)}%</span><span>${bytes(p.mem)}</span></div>`).join('');
    monGraph();
  }
  setInterval(monPoll, 1000);
  function toggleMon() { mon.on = !mon.on; $('sysmon').classList.toggle('off', !mon.on); window.gibson.save('sysmon', mon.on); if (mon.on) { procAt = 0; monPoll(); } }
  // What the right-click menu and the palette show checked: the page's current state.
  const menuState = () => ({
      selection: !!focused.term.getSelection(), panes: tab.panes.length, zoomed: !!tab.zoom, broadcast: !!tab.broadcast, tabColor: tab.opts.color || '', tabs: tabs.length, opacity: focused.opacity, framed: cfg.framed, scroller: cfg.scroller !== false,
      worlds: Worlds.names.map((n) => [n, Worlds.label(n)]), world: Worlds.current(),
      irc: ircPanel.visible, leet: !!cfg.nyx.leet, music: !!cfg.music.on, reactive: cfg.music.mode === 'reactive', nyx: !!cfg.nyx.on,
      source: jukeOn() ? 'folder' : 'synth', folder: cfg.music.folder, shuffle: juke.shuffle, logo: cfg.logo !== false, packets: cfg.packets !== false, dance: cfg.dance !== false, sysmon: mon.on, ships: cfg.ships !== false,
      ...Object.fromEntries(Object.keys(EXTRAS).map((k) => [k, flag(k)])), calm: cfg.calm !== false,
  });
  // The command palette (renderer/palette.js): main flattens the menu (palette:list) and runs a pick.
  function openPalette() {
    const p = focused;
    window.gibson.paletteList(menuState()).then((items) => Palette.open(items, { run: (it) => window.gibson.paletteRun(it.id), done: () => p && p.term.focus() }));
  }
  // Soft keys (renderer/keys.js SOFT: Alt+arrows, Ctrl+Up/Down...) are caught here, in xterm's key
  // handler, not in main: they're taken from the shell only when action() acts on them and returns
  // true; anything else goes to the shell as usual.
  function softKey(p, e) { // hoisted: panes exist before this line runs
    if (e.type !== 'keydown' || p !== focused) return true;
    const a = Keys.keymap(cfg.keys)[Keys.fromInput(e)];
    return !(a && Keys.SOFT.has(a) && action(a) === true);
  }
  function action(a) {
    const t = focused.term;
    if (a === 'copy') navigator.clipboard.writeText(t.getSelection());
    else if (a === 'paste') { const p = focused; navigator.clipboard.readText().then((s) => pasteInto(p, s)); }
    else if (a === 'find') return openFind(focused);
    else if (a === 'prompt:prev' || a === 'prompt:next') return ShellInt.jump(focused, a === 'prompt:prev' ? -1 : 1); // false: no marks, the key goes on to the shell
    else if (a === 'output:copy') { const o = ShellInt.output(focused); if (o) navigator.clipboard.writeText(o.text); }
    else if (a === 'output:save') window.gibson.saveOutput(ShellInt.all(focused));
    else if (a === 'scrollback:clear') { focused.term.clear(); ShellInt.reset(focused); }
    else if (a === 'search:all') return searchAll();
    else if (a.startsWith('font:')) setFont(a === 'font:up' ? cfg.fontSize + 1 : a === 'font:down' ? cfg.fontSize - 1 : B.defaults.fontSize);
    else if (a === 'broadcast') { if (tab.panes.length > 1) tab.broadcast = !tab.broadcast; tab.el.classList.toggle('broadcast', !!tab.broadcast); label(tab); }
    else if (a === 'zoompane') { if (tab.panes.length > 1) { tab.zoom = !tab.zoom; for (const x of tab.panes) x.el.classList.toggle('zoom', tab.zoom && x === focused); layout(tab); } }
    else if (a === 'evenpanes') { tab.root = Panes.even(tab.root); layout(tab); }
    else if (a === 'split:right' || a === 'split:down') return splitPane(a === 'split:right' ? 'row' : 'col');
    else if (a === 'closepane') return closePaneUI(focused);
    // true only when something moved: softKey then swallows the key, else it reaches the shell
    else if (a.startsWith('focus:')) { const q = Panes.neighbour(tab.root, focused, a.slice(6)); if (!q) return false; setFocus(q); q.term.focus(); return true; }
    else if (a.startsWith('resize:')) { if (!Panes.nudge(tab.root, focused, a.slice(7), 0.04)) return false; layout(tab); return true; }
    else if (a.startsWith('tabcolor:')) { tab.opts = { ...tab.opts, color: a.slice(9) || undefined }; label(tab); }
    else if (a.startsWith('irc:mode:')) { ircPanel.destroy(); ircPanel = makeIrc(a.slice(9)); ircPanel.show(); window.gibson.save('ircOpen', ircPanel.visible); return ircPanel.focus(); }
    else if (a === 'irc') { ircPanel.toggle(); window.gibson.save('ircOpen', ircPanel.visible); if (ircPanel.visible) return ircPanel.focus(); }
    else if (a === 'leet') { cfg.nyx.leet = !cfg.nyx.leet; window.gibson.save('nyxLeet', cfg.nyx.leet); nyx.ctx.say(cfg.nyx.leet ? 'Elite mode. Try to keep up, newbie.' : 'Plain speech. For the slow.', 'playful'); }
    else if (a === 'pasteguard') { cfg.pasteGuard = cfg.pasteGuard === false; window.gibson.save('pasteGuard', cfg.pasteGuard); }
    else if (a === 'music') {
      cfg.music.on = !cfg.music.on;
      if (jukeOn()) { if (cfg.music.on) juke.play(); else juke.pause(); showPlayer(); } else if (cfg.music.on) startMusic(); else if (music) music.stop();
      saveMusic();
    }
    else if (a.startsWith('music:')) return musicAction(a);
    else if (a === 'synth') { $('synth').classList.toggle('off'); synthPaint(); }
    else if (a === 'logo') { setLogo(!cfg.logo); window.gibson.save('logo', cfg.logo); }
    else if (a === 'cigarette') { cfg.cigarette = cfg.cigarette === false; window.gibson.save('cigarette', cfg.cigarette); }
    else if (Object.hasOwn(EXTRAS, a)) { cfg[a] = !flag(a); window.gibson.save(a, cfg[a]); applyLook(); applyReadable(); }
    else if (a === 'sysmon') toggleMon();
    else if (a === 'palette') return openPalette();
    else if (a === 'calm') { cfg.calm = cfg.calm === false; window.gibson.save('calm', cfg.calm); }
    else if (a === 'dance') { cfg.dance = cfg.dance === false; window.gibson.save('dance', cfg.dance); }
    else if (a === 'nyxworlds') { cfg.nyxWorlds = cfg.nyxWorlds === false; window.gibson.save('nyxWorlds', cfg.nyxWorlds); }
    else if (a === 'tabs:save') { window.gibson.saveTabs(tabs.map((x) => ({ id: x.panes[0].id, panes: x.panes.length, name: x.opts.name, color: x.opts.color }))); nyx.ctx.say(`${tabs.length} tab${tabs.length > 1 ? 's' : ''} saved. They will be waiting next time.`, 'tender'); }
    else if (a === 'packets') { cfg.packets = cfg.packets === false; window.gibson.save('packets', cfg.packets); }
    else if (a === 'ships') { cfg.ships = cfg.ships === false; window.gibson.save('ships', cfg.ships); }
    else if (a === 'tempo') { cfg.music.mode = cfg.music.mode === 'reactive' ? 'fixed' : 'reactive'; nyx.ctx.say(`Tempo ${cfg.music.mode === 'fixed' ? 'locked at ' + cfg.music.bpm : 'follows your hands'}.`, 'playful'); }
    else if (a === 'ask:ollama' || a === 'ask:openai') {
      const p = a.slice(4), was = (cfg.llm.urls || {})[p];
      return askText(p === 'ollama' ? 'Ollama server, e.g. http://192.168.1.20:11434' : 'llama.cpp / LM Studio / vLLM server, e.g. http://127.0.0.1:8080',
        was || (p === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080'), (v) => {
          const url = /^https?:\/\//.test(v) ? v : 'http://' + v;
          window.gibson.setServer(p, url);
          nyx.ctx.say(`Plugged into ${url}. Its models are under right-click > NYX.`, 'curious');
        });
    }
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
    if (p && flag('rclickpaste') && !e.shiftKey) { // right-click pastes (or copies a selection, PuTTY-style); Shift+right-click is the menu
      const s = p.term.getSelection();
      if (s && !flag('copyselect')) { navigator.clipboard.writeText(s); p.term.clearSelection(); } else navigator.clipboard.readText().then((x) => pasteInto(p, x));
      return;
    }
    window.gibson.menu(menuState());
  });

  // --- the loop ---------------------------------------------------------------
  // A command is done when the output has gone quiet and the cursor sits at an empty prompt.
  // With shell integration, exactly when the shell says so (OSC 133 D).
  // ponytail: without it, a prompt-shape heuristic, like typedLine.
  let doneCheck = 0;
  const atPrompt = (p) => { const line = typedLine(p); return line !== null && !line.trim(); };
  function finishedCommands() {
    const now = Date.now(), after = (cfg.notifyAfterSec ?? 10) * 1000;
    for (const p of allPanes()) {
      if (!p.cmdAt || now - p.lastOut < 1200) continue;
      if (ShellInt.live(p) ? ShellInt.busy(p) : !atPrompt(p)) continue;
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
    if (flag('bios')) { // a 90s power-on self test first: this machine's real CPU, memory and drives (made up in screenshots)
      $('boot').classList.add('bios');
      const hw = await window.gibson.hw(), wait = (ms) => (skip ? null : sleep(ms));
      out(`GIBSON BIOS v4.51PG, An Energy Ally\nCopyright (C) 1984-99, Gibson Systems, Inc.\n\n#401A0-0207\n\n${hw.cpu.trim()} at ${hw.mhz}MHz, ${hw.cores} threads\n\n`);
      await wait(500);
      const base = log.textContent, kb = Math.round(hw.mem / 1024);
      for (let i = 1; i <= 24 && !skip; i++) { log.textContent = `${base}Memory Test :  ${Math.round(kb * i / 24)}K`; await wait(45); }
      log.textContent = `${base}Memory Test :  ${kb}K OK\n\n`;
      const SLOT = ['Primary Master  ', 'Primary Slave   ', 'Secondary Master', 'Secondary Slave '];
      for (const [i, d] of hw.disks.entries()) { if (skip) break; out(`Detecting IDE ${SLOT[i] || `SCSI ID ${i}       `} ... ${d.name} ${(d.total / 1e9).toFixed(0)} GB\n`); await wait(160); }
      const now = new Date(), date = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
      out(`\nPress DEL to enter SETUP\n${date}-GIBSON-PG-2A69KG0BC-00\n`);
      await wait(1100);
      log.textContent = ''; $('boot').classList.remove('bios'); skip = false;
    }
    if (cfg.boot) {
      let dial = null; try { dial = new Techno(); dial.volume(0); } catch { /* no audio device */ }
      const steps = [['ATZ\n', 300], ['OK\n', 400], ['ATDT 555-0199\n', 200]];
      for (const [s, ms] of steps) { if (skip) break; out(s); await sleep(ms); }
      const len = dial && !skip ? dial.dialup('5550199', B.shot ? 0 : 1) : 0;
      const lines = ['RINGING...\n', 'CARRIER 2100Hz\n', 'NEGOTIATING V.90 ...\n', 'PROTOCOL: LAPM / V.42BIS\n', 'CONNECT 57600\n\n', `ACCESSING GIBSON MAINFRAME AS ${B.user.toUpperCase()}...\n`, 'NYX ONLINE.\n'];
      for (const s of lines) { if (skip) break; out(s); await sleep((len * 1000) / lines.length); }
      if (dial) dial.ctx.close();
    }
    removeEventListener('keydown', skipper);
    $('boot').classList.add('gone'); focused.term.focus();
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  if ((cfg.boot || flag('bios')) && (!B.shot || B.bootShot)) await bootSequence(); else $('boot').classList.add('gone');
  if (cfg.music.source === 'folder' && cfg.music.folder) juke.load(await window.gibson.musicList());
  focused.term.focus(); if (jukeOn()) useSource('folder'); else startMusic();
  nyx.event('boot', {}, true);

  if (B.shot) { // headless screenshot: give it something to look at
    if (tab.panes.length > 1) tab.panes.forEach((p, i) => setOpacity(p, [0.86, 0.55, 0.3, 0.7][i]));
    setTimeout(() => tab.panes.forEach((p, i) => window.gibson.write(p.id, demoCmd(i))), 1500);
    if (B.chat) setTimeout(() => { const t = tab.panes[0].term; for (const ch of `nyx ${B.chat}\r`) t.input(ch); }, 4000); // the real keystroke path
    if (B.adopt) setTimeout(() => window.gibson.write(tab.panes[0].id, demoCmd(2)), 2000); // the torn-off shell still answers
    if (B.rejoin) setTimeout(() => detach(tab, 0, 0, true), 4000); // --rejoin: and back it goes
    if (B.detach) setTimeout(() => { if (tabs[1]) detach(tabs[1], 200, 200); }, 3500); // --detach: the second tab tears off
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
