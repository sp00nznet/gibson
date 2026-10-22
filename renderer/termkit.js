// Small terminal helpers for app.js: quoting dropped paths for each shell, searching text, and the
// global search panel (every pane in every tab). Loaded by the page and by test/check.mjs.
(function (root) {
  // Which quoting a profile's shell wants, from its name ('PowerShell', 'cmd', 'Ubuntu (WSL)', 'Git Bash', 'zsh'...).
  function shellKind(name, platform) {
    const n = (name || '').toLowerCase();
    if (/wsl/.test(n)) return 'wsl';
    if (/^cmd|command prompt/.test(n)) return 'cmd';
    if (/powershell|pwsh/.test(n) || (!n && platform === 'win32')) return 'pwsh';
    return 'posix';
  }
  // Dropped paths, quoted for that shell and space-separated; WSL gets /mnt/c/... for C:\...
  function quotePaths(paths, kind) {
    return paths.map((p) => {
      if (kind === 'wsl') { const m = /^([A-Za-z]):\\(.*)$/.exec(p); if (m) p = `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`; }
      if (kind === 'pwsh') return `'${p.replace(/'/g, "''")}'`;
      if (kind === 'cmd') return `"${p}"`; // cmd has no escape for " inside quotes; Windows paths can't contain it anyway
      return `'${p.replace(/'/g, "'\\''")}'`;
    }).join(' ');
  }
  // Every match of query in lines: [{ row, start, end }]. Stops at max. A bad regex matches nothing.
  function findAll(lines, query, { regex = false, caseSensitive = false, max = 500 } = {}) {
    if (!query) return [];
    let re;
    try { re = new RegExp(regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi'); } catch { return []; }
    const out = [];
    for (let row = 0; row < lines.length && out.length < max; row++) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(lines[row])) && out.length < max;) {
        if (!m[0].length) { re.lastIndex++; continue; }
        out.push({ row, start: m.index, end: m.index + m[0].length });
      }
    }
    return out;
  }

  // The global search panel. panes(): [{ label, lines() }]; jump(i, match) goes there.
  const CSS = `
#gsearch { position: fixed; z-index: 20; top: 8%; left: 50%; transform: translateX(-50%); width: min(820px, 92vw); max-height: 76vh; display: flex; flex-direction: column;
  background: rgba(8, 2, 14, 0.94); border: 1px solid #ff2e88; box-shadow: 0 0 24px rgba(255, 46, 136, 0.4); font: 12px 'Cascadia Mono', Consolas, monospace; color: #b8ffd9; }
#gsearch .q { display: flex; gap: 4px; padding: 6px; border-bottom: 1px solid #3a0f4a; }
#gsearch input { flex: 1; background: #020a06; color: #ffd6ec; border: 1px solid #0f3a26; font: inherit; padding: 4px 6px; outline: none; }
#gsearch .q .count { align-self: center; color: #8bffc4; min-width: 90px; text-align: right; }
#gsearch .list { overflow-y: auto; padding: 2px 0; }
#gsearch .grp { color: #ff2e88; padding: 4px 8px 1px; letter-spacing: 1px; }
#gsearch .hit { padding: 1px 8px 1px 18px; white-space: pre; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
#gsearch .hit.sel, #gsearch .hit:hover { background: rgba(255, 46, 136, 0.22); }
#gsearch mark { background: #ffc448; color: #000; }
.tglbtn { font: bold 10px 'Cascadia Mono', Consolas, monospace; background: #0b1f16; color: #4d6b5c; border: 1px solid #0f3a26; cursor: pointer; padding: 0 5px; }
.tglbtn.on { color: #fff; background: #4a1030; border-color: #ff2e88; }
.pane.bellflash::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 0 3px #ffc448; animation: bellfade 0.4s forwards; }
@keyframes bellfade { to { box-shadow: inset 0 0 0 3px transparent; } }`;
  // Aa / .* toggles, shared by the find bar and the panel
  function toggles(state, onChange) {
    return [['caseSensitive', 'Aa', 'match case'], ['regex', '.*', 'regular expression']].map(([k, txt, title]) => {
      const b = document.createElement('button'); b.className = 'tglbtn'; b.textContent = txt; b.title = title;
      b.onclick = (e) => { e.preventDefault(); state[k] = !state[k]; b.classList.toggle('on', state[k]); onChange(); };
      return b;
    });
  }
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  if (typeof document !== 'undefined') { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  function openGlobalSearch({ panes, jump, onClose, seed }) {
    let el = document.getElementById('gsearch');
    if (el) { el.querySelector('input').focus(); return; }
    el = document.createElement('div'); el.id = 'gsearch';
    el.innerHTML = '<div class="q"><input placeholder="search every pane in every tab"><span class="count"></span></div><div class="list"></div>';
    document.body.appendChild(el);
    const inp = el.querySelector('input'), count = el.querySelector('.count'), list = el.querySelector('.list'), opts = { regex: false, caseSensitive: false };
    // ponytail: a snapshot when the panel opens (re-reading 16 x 5000 rows per keystroke is slow);
    // rows are searched one by one, so a match split across a wrapped line is missed.
    const snap = panes().map((p) => ({ label: p.label, lines: p.lines() }));
    let hits = [], sel = 0, timer = 0;
    const close = () => { el.remove(); onClose(); };
    const show = () => {
      hits = []; let html = '';
      snap.forEach((p, i) => {
        const found = findAll(p.lines, inp.value, { ...opts, max: 200 });
        if (!found.length) return;
        html += `<div class="grp">${esc(p.label)}  (${found.length}${found.length === 200 ? '+' : ''})</div>`;
        for (const m of found) {
          const line = p.lines[m.row], a = Math.max(0, m.start - 40);
          html += `<div class="hit" data-i="${hits.length}">${esc(line.slice(a, m.start))}<mark>${esc(line.slice(m.start, m.end))}</mark>${esc(line.slice(m.end, m.end + 80))}</div>`;
          hits.push({ pane: i, m });
        }
      });
      list.innerHTML = html; sel = 0; mark();
      count.textContent = inp.value ? `${hits.length} match${hits.length === 1 ? '' : 'es'}` : '';
    };
    const mark = () => { for (const h of list.querySelectorAll('.hit')) h.classList.toggle('sel', Number(h.dataset.i) === sel); const s = list.querySelector('.hit.sel'); if (s) s.scrollIntoView({ block: 'nearest' }); };
    const go = (i) => { const h = hits[i]; if (!h) return; el.remove(); jump(h.pane, h.m); };
    for (const b of toggles(opts, show)) el.querySelector('.q').insertBefore(b, count);
    inp.oninput = () => { clearTimeout(timer); timer = setTimeout(show, 120); };
    inp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter') go(sel);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); mark(); }
    };
    list.onclick = (e) => { const h = e.target.closest('.hit'); if (h) go(Number(h.dataset.i)); };
    if (seed) { inp.value = seed; show(); }
    inp.focus(); inp.select();
  }

  const api = { shellKind, quotePaths, findAll, toggles, openGlobalSearch };
  if (typeof module !== 'undefined') module.exports = api; else root.TermKit = api;
})(this);
