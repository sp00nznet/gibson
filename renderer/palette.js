// The command palette: every action in one fuzzy-filtered list. app.js hands it the items
// ({ label, key, checked }); Up/Down/Enter or a click runs one, Esc closes, and the ones used most
// recently come first. Loaded by the page and by test/check.mjs (fuzzy only), hence the shim.
(function (root) {
  // 'trch' in 'World › Arcade › TRENCH RUN' → { score, hits: [indices] }, or null. Runs of
  // consecutive letters and letters that start a word score higher; spaces in the query are free.
  function fuzzy(query, text) {
    const q = query.toLowerCase().replace(/\s+/g, ''), t = text.toLowerCase(), hits = [];
    let qi = 0, score = 0, prev = -2;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] !== q[qi]) continue;
      score += 1 + (i === prev + 1 ? 3 : 0) + (i === 0 || /[\s:›>\-_/.(]/.test(t[i - 1]) ? 2 : 0);
      hits.push(i); prev = i; qi++;
    }
    return qi < q.length ? null : { score: score - t.length * 0.01, hits };
  }

  const RECENT = 'gibson.palette.recent';
  const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT)) || []; } catch { return []; } };
  const remember = (label) => { try { localStorage.setItem(RECENT, JSON.stringify([label, ...recent().filter((l) => l !== label)].slice(0, 15))); } catch { /* no storage */ } };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  let el = null;
  function build() {
    const css = document.createElement('style');
    css.textContent = `
#palette { position: fixed; inset: 0; z-index: 50; display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; background: rgba(0,0,0,0.35); }
#palette.off { display: none; }
#palette .box { width: min(640px, 92vw); background: linear-gradient(#1a0826, #0a0010); border: 1px solid #ff2e88; box-shadow: 0 0 24px rgba(255,46,136,0.45); font: 13px 'Cascadia Mono', Consolas, monospace; color: #8bffc4; }
#palette .bar { height: 14px; line-height: 14px; text-align: center; font-size: 9px; letter-spacing: 2px; color: #ffd6ec; background: #2a0a36; text-shadow: 0 0 4px #ff2e88; }
#palette input { width: 100%; box-sizing: border-box; padding: 8px 10px; background: #020a06; border: 0; border-bottom: 1px solid #0f3a26; color: #39ff9c; font: inherit; font-size: 15px; outline: none; caret-color: #ff2e88; }
#palette ul { list-style: none; margin: 0; padding: 4px 0; max-height: 52vh; overflow-y: auto; }
#palette li { display: flex; gap: 10px; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
#palette li .l { flex: 1; overflow: hidden; text-overflow: ellipsis; }
#palette li .k { color: #ffc448; opacity: 0.8; font-size: 11px; }
#palette li b { color: #ff2e88; text-shadow: 0 0 6px #ff2e88; font-weight: normal; }
#palette li.on { background: linear-gradient(90deg, #4a1030, transparent); color: #fff; }
#palette li .c { width: 1em; color: #ff2e88; }
#palette .none { padding: 8px 10px; opacity: 0.6; }`;
    document.head.append(css);
    el = document.createElement('div'); el.id = 'palette'; el.className = 'off';
    el.innerHTML = '<div class="box"><div class="bar">GIBSON :: COMMAND</div><input spellcheck="false" placeholder="type to search every action, world and shell..."><ul></ul></div>';
    document.body.append(el);
  }

  // items: [{ label, key, checked }]; run(item) does it; done() gives focus back.
  function open(items, { run, done }) {
    if (!el) build();
    const input = el.querySelector('input'), ul = el.querySelector('ul');
    let shown = [], sel = 0;
    const close = () => { el.classList.add('off'); el.onmousedown = null; done && done(); };
    function paint() {
      const q = input.value.trim(), rec = recent();
      shown = items.map((it) => {
        const m = q ? fuzzy(q, it.label) : { score: 0, hits: [] }, r = rec.indexOf(it.label);
        return m && { it, hits: m.hits, score: m.score + (r >= 0 ? (q ? 2 : 100) - r * (q ? 0.1 : 1) : 0) };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 80);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      ul.innerHTML = shown.length ? shown.map(({ it, hits }, i) => {
        const set = new Set(hits), label = [...it.label].map((ch, j) => (set.has(j) ? `<b>${esc(ch)}</b>` : esc(ch))).join('');
        return `<li data-i="${i}" class="${i === sel ? 'on' : ''}"><span class="c">${it.checked ? '✓' : ''}</span><span class="l">${label}</span><span class="k">${esc(it.key || '')}</span></li>`;
      }).join('') : '<div class="none">nothing matches</div>';
      const on = ul.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    const pick = (i) => { const s = shown[i]; if (!s) return; remember(s.it.label); close(); run(s.it); };
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault(); const d = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[e.key];
        sel = Math.max(0, Math.min(shown.length - 1, sel + d)); paint();
      }
    };
    input.oninput = () => { sel = 0; paint(); };
    ul.onclick = (e) => { const li = e.target.closest('li'); if (li) pick(Number(li.dataset.i)); };
    el.onmousedown = (e) => { if (e.target === el) { e.preventDefault(); close(); } }; // a click outside the box
    input.value = ''; sel = 0; paint();
    el.classList.remove('off'); input.focus();
  }

  const api = { fuzzy, open, isOpen: () => !!el && !el.classList.contains('off') };
  if (typeof module !== 'undefined') module.exports = api; else root.Palette = api;
})(this);
