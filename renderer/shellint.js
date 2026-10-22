// Shell integration, the page side. The shells GIBSON starts (main.js integrate(), shell/) mark
// each prompt (OSC 133;A), where typing starts (B), where output starts (C) and the exit code
// (D;n), and say their folder (OSC 7 file://host/path, or 9;9;path from PowerShell and cmd).
// Here those become markers per command: the exact command text, a dot by each prompt
// (green: worked, pink: failed, grey: running or unknown), jumping between prompts, and copying
// one command's output. A pane whose shell sends none of this is left to app.js's guesses.
// Loaded by the page and by test/check.mjs, hence the export shim at the bottom.
(function (root) {
  // OSC 133 payload → { kind, code }, or null for marks we don't use
  function mark(data) {
    const m = /^([ABCD])(?:;(-?\d+))?/.exec(data); if (!m) return null;
    return { kind: m[1], code: m[1] === 'D' && m[2] !== undefined ? Number(m[2]) : null };
  }
  // OSC 7 (file://host/path) or OSC 9 (9;path, quoted or not) → a folder, or null
  function cwdOf(osc, data) {
    if (osc === 9) { const m = /^9;(.+)$/.exec(data); return m ? m[1].replace(/^"(.*)"$/, '$1') : null; }
    const m = /^file:\/\/[^/]*(\/.*)$/.exec(data); if (!m) return null;
    let d = m[1]; try { d = decodeURIComponent(d); } catch { /* not encoded */ }
    return /^\/[A-Za-z]:/.test(d) ? d.slice(1) : d; // file:///C:/x on Windows
  }

  // Text from (y, x) to the end of that logical line (wrapped rows joined), or to (y2, x2).
  function textFrom(b, y, x, y2, x2) {
    let out = '';
    for (let r = y; r < b.length; r++) {
      const line = b.getLine(r); if (!line) break;
      if (r > y && !line.isWrapped) { if (y2 === undefined || r > y2) break; out += '\n'; }
      out += line.translateToString(r !== y2, r === y ? x : 0, r === y2 ? x2 : undefined);
      if (r === y2) break;
    }
    return out;
  }
  function rows(b, from, to) { // whole rows, wrapped ones joined, right-trimmed
    const out = [];
    for (let r = from; r <= to; r++) { const line = b.getLine(r); if (!line) break; const s = line.translateToString(true); if (line.isWrapped && out.length) out[out.length - 1] += s; else out.push(s); }
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return out.join('\n');
  }

  const live = (p) => !!(p.si && p.si.live);
  const look = (el, rec) => { el.classList.remove('run', 'ok', 'fail', 'unknown'); el.classList.add('si-dot', rec.state === 'run' ? 'run' : rec.code === 0 ? 'ok' : rec.code === null ? 'unknown' : 'fail'); };
  function dot(t, rec) {
    if (!t.registerDecoration || rec.a.isDisposed) return;
    rec.deco = t.registerDecoration({ marker: rec.a, x: 0, width: 1 });
    if (rec.deco) rec.deco.onRender((el) => look(el, rec));
  }
  const paint = (rec) => { if (rec.deco && rec.deco.element) look(rec.deco.element, rec); };
  const drop = (rec) => { for (const k of ['a', 'b', 'c', 'end']) if (rec[k]) rec[k].dispose(); if (rec.deco) rec.deco.dispose(); };

  // on: { cwd(p, dir), done(p, rec) }. rec: { cmd, code, a, b, c, end } (markers).
  function attach(p, on) {
    const t = p.term, si = p.si = { live: false, cmds: [], cur: null };
    const here = () => t.registerMarker(0), buf = () => t.buffer.active;
    const start = (rec) => { // a command started: keep it, give it a dot
      const b = buf(); rec.cmd = textFrom(b, rec.b.line, rec.bx).trim();
      if (!rec.cmd) return false;
      rec.state = 'run'; si.cmds.push(rec); dot(t, rec);
      if (si.cmds.length > 500) drop(si.cmds.shift());
      return true;
    };
    t.parser.registerOscHandler(133, (data) => {
      const m = mark(data); if (!m) return false;
      si.live = true;
      const cur = si.cur, b = buf();
      if (m.kind === 'A') si.cur = { a: here(), state: 'prompt' };
      else if (m.kind === 'B' && cur) { cur.b = here(); cur.bx = b.cursorX; cur.state = 'input'; }
      else if (m.kind === 'C' && cur && cur.state === 'input') { si.hasC = true; cur.c = here(); if (!start(cur)) { drop(cur); si.cur = null; } }
      else if (m.kind === 'D' && cur) { // the end of the last command, at the start of the next prompt
        // No C before it: a shell that never sends C (cmd, old bash) ran what was typed; one that
        // does sent this for an empty Enter or a line abandoned with Ctrl+C.
        if (cur.state === 'input' && !si.hasC) start(cur);
        if (cur.state === 'run') { cur.code = m.code; cur.end = here(); cur.state = 'done'; paint(cur); if (on.done) on.done(p, cur); }
        else drop(cur);
        si.cur = null;
      }
      return true;
    });
    const where = (osc) => (data) => { const d = cwdOf(osc, data); if (!d) return false; si.live = true; if (on.cwd) on.cwd(p, d); return true; };
    t.parser.registerOscHandler(7, where(7));
    t.parser.registerOscHandler(9, where(9));
  }

  // The command being typed, exactly: from the end of the prompt (B) to the cursor. null without it.
  function typed(p) {
    if (!live(p)) return null;
    const cur = p.si.cur, b = p.term.buffer.active;
    if (!cur || cur.state !== 'input' || !cur.b || cur.b.isDisposed) return null;
    return textFrom(b, cur.b.line, cur.bx, b.baseY + b.cursorY, b.cursorX);
  }
  const busy = (p) => live(p) && !!p.si.cur && p.si.cur.state === 'run';
  // Scroll to the previous (-1) or next (1) prompt from the top of the view.
  function jump(p, d) {
    if (!live(p)) return false;
    const b = p.term.buffer.active, top = b.viewportY;
    const lines = p.si.cmds.map((r) => r.a.line).filter((l) => l >= 0);
    const to = d < 0 ? lines.filter((l) => l < top).pop() : lines.find((l) => l > top);
    if (to === undefined) { if (d > 0) p.term.scrollToBottom(); return d > 0; }
    p.term.scrollToLine(to); return true;
  }
  // The output of one command: the one the selection starts in, else the one at the top of a
  // scrolled-up view, else the last one. null when there's nothing to give.
  function output(p) {
    if (!live(p) || !p.si.cmds.length) return null;
    const b = p.term.buffer.active, sel = p.term.hasSelection() && p.term.getSelectionPosition();
    const row = sel ? sel.start.y : b.viewportY < b.baseY ? b.viewportY : null;
    const live_ = p.si.cmds.filter((r) => !r.a.isDisposed);
    const rec = (row === null ? null : live_.filter((r) => r.a.line <= row).pop()) || live_[live_.length - 1];
    if (!rec) return null;
    const from = rec.c && !rec.c.isDisposed ? rec.c.line : rec.b.line + 1;
    const to = rec.end && !rec.end.isDisposed ? rec.end.line - 1 : b.baseY + b.cursorY - 1;
    return { cmd: rec.cmd, text: to >= from ? rows(b, from, to) : '' };
  }
  const all = (p) => { const b = p.term.buffer.active; return rows(b, 0, b.length - 1); };
  function reset(p) { if (!p.si) return; for (const r of p.si.cmds) drop(r); p.si.cmds = []; if (p.si.cur) drop(p.si.cur); p.si.cur = null; }

  const api = { mark, cwdOf, attach, typed, busy, live, jump, output, all, reset };
  if (typeof module !== 'undefined') module.exports = api; else root.ShellInt = api;
})(this);
