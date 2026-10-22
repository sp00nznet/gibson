// SNEAKERS: the anagram decoder. Behind a wall of cycling glyphs, a phrase resolves letter by
// letter out of noise, holds, then its letters lift and fly to new places and spell its anagram:
// SETEC ASTRONOMY becomes TOO MANY SECRETS. Your commands get the same treatment, scrambled then
// put back. The phrase also runs, readable, along the bottom edge; an error scrambles it again.
(function (Worlds) {
  const PAIRS = [['SETEC ASTRONOMY', 'TOO MANY SECRETS'], ['GIBSON MAINFRAME', "MAN'S BIG IRON FAME"], ['THE MORSE CODE', 'HERE COME DOTS'],
    ['DORMITORY', 'DIRTY ROOM'], ['ASTRONOMER', 'MOON STARER'], ['CONVERSATION', 'VOICES RANT ON'], ['ELEVEN PLUS TWO', 'TWELVE PLUS ONE']];
  const letters = (s) => s.replace(/[^A-Z0-9]/g, '').split('').sort().join('');
  const isAnagram = (a, b) => letters(a) === letters(b);
  // Each target letter takes a source letter that's the same: map[target index] = source index.
  function pairUp(src, dst) {
    const free = new Map();
    [...src].forEach((ch, i) => { if (/[A-Z0-9]/.test(ch)) { if (!free.has(ch)) free.set(ch, []); free.get(ch).push(i); } });
    return [...dst].map((ch) => (free.get(ch) || []).shift() ?? -1);
  }
  function scramble(s) { const a = s.replace(/[^A-Z0-9]/g, '').split(''); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join(''); }
  Worlds.anagrams = { PAIRS, isAnagram, pairUp, scramble }; // for the self-check

  Worlds.define('sneakers', (k) => {
    const { C, env, text3, setCam } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", GLYPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@';
    const rg = () => GLYPH[Math.floor(Math.random() * GLYPH.length)];
    let queue = [], next = 0, cur = null, lastCmd = 0;
    const WC = 16, WR = 8, wall = Array.from({ length: WC * WR }, rg);
    function start(src, dst) { cur = { src, dst, map: pairUp(src, dst), phase: 'resolve', t: 0, locked: new Set(), order: [...src].map((_, i) => i).filter((i) => src[i] !== ' ').sort(() => Math.random() - 0.5), noise: [...src].map(rg) }; }
    function nextPuzzle() { const p = queue.length ? queue.shift() : PAIRS[next++ % PAIRS.length]; start(p[0], p[1]); }
    nextPuzzle();
    // slot x for character i of a string of length n, in units of one letter
    const slot = (i, n) => i - (n - 1) / 2;

    // where each visible letter is drawn now: [char, x (letters), lift (0..1), done?]
    function glyphs() {
      const c = cur, out = [];
      if (c.phase === 'resolve' || c.phase === 'hold') {
        [...c.src].forEach((ch, i) => { if (ch !== ' ') out.push([c.locked.has(i) || c.phase === 'hold' ? ch : c.noise[i], slot(i, c.src.length), 0, c.locked.has(i) || c.phase === 'hold']); });
      } else { // fly, then hold the answer
        const f = c.phase === 'fly' ? Math.min(1, c.t / 2) : 1, e = f * f * (3 - 2 * f);
        [...c.dst].forEach((ch, j) => { if (ch === ' ' || ch === "'") { if (ch === "'" && f === 1) out.push([ch, slot(j, c.dst.length), 0, true]); return; } const i = c.map[j], x0 = i >= 0 ? slot(i, c.src.length) : slot(j, c.dst.length), x1 = slot(j, c.dst.length); out.push([ch, x0 + (x1 - x0) * e, Math.sin(Math.PI * f), f === 1]); });
      }
      return out;
    }

    return {
      label: 'SNEAKERS',
      signal(kind) { if (kind === 'error' && cur) start(cur.src, cur.dst); },
      update(dt) {
        const c = env.cmd;
        if (c && c.at !== lastCmd) { // your command, scrambled, then put back
          lastCmd = c.at;
          const plain = c.text.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 22);
          if (plain.replace(/ /g, '').length >= 4) queue.unshift([scramble(plain), plain]);
        }
        const p = cur; p.t += dt;
        for (let i = 0; i < p.noise.length; i++) if (Math.random() < dt * 20) p.noise[i] = rg();
        for (let i = 0; i < wall.length; i++) if (Math.random() < dt * (3 + env.level * 10)) wall[i] = rg();
        if (p.phase === 'resolve') {
          const want = Math.floor(p.t * (5 + env.level * 10));
          while (p.locked.size < Math.min(want, p.order.length)) p.locked.add(p.order[p.locked.size]);
          if (p.locked.size >= p.order.length) { p.phase = 'hold'; p.t = 0; }
        } else if (p.phase === 'hold' && p.t > 1.6) { p.phase = 'fly'; p.t = 0; }
        else if (p.phase === 'fly' && p.t > 2) { p.phase = 'answer'; p.t = 0; }
        else if (p.phase === 'answer' && p.t > 4.5) nextPuzzle();
      },
      draw() {
        const t = env.t;
        setCam({ x: Math.sin(t * 0.1) * 1.5, y: Math.sin(t * 0.07), z: 0, yaw: Math.sin(t * 0.08) * 0.05, pitch: 0 });
        // the wall of glyphs, far back
        for (let i = 0; i < wall.length; i++) { const cx = i % WC, cy = Math.floor(i / WC); text3(wall[i], (cx - (WC - 1) / 2) * 9, (cy - (WR - 1) / 2) * 8, 70, C.neon, 2.2, 0.6); }
        // the phrase, in front of it
        const answer = cur.phase === 'answer';
        for (const [ch, x, lift, done] of glyphs()) text3(ch, x * 1.5 - 0.5, lift * 2.5 - 0.5, 34, answer ? C.gold : done ? C.white : C.neon, 1.6, done ? 1 : 0.6);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), px = 34 * s;
      // the phrase again, crisp, in the bottom margin
      g.font = `bold ${px | 0}px ${MONO}`;
      const cw = g.measureText('M').width * 1.15, base = H - 22 * s, answer = cur.phase === 'answer';
      for (const [ch, x, lift, done] of glyphs()) { g.fillStyle = `rgba(${answer ? C.gold : done ? C.white : C.neon},${done ? 0.95 : 0.6})`; g.fillText(ch, W / 2 + x * cw - cw / 2, base - lift * 30 * s); }
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`;
      const stage = { resolve: `DECRYPTING  ${cur.locked.size}/${cur.order.length}`, hold: 'DECRYPTED', fly: 'REARRANGING...', answer: 'SOLVED' }[cur.phase];
      g.fillText(`ANAGRAM DECODER  ::  ${stage}`, 28 * s, 34 * s);
      g.fillStyle = `rgba(${C.white},0.6)`; g.fillText(`IN   ${cur.src}`, 28 * s, 54 * s);
      if (cur.phase !== 'resolve') g.fillText(`OUT  ${cur.phase === 'answer' ? cur.dst : '?'.repeat(cur.dst.length)}`, 28 * s, 72 * s);
      const q = `QUEUE ${queue.length}`; g.fillText(q, W - 28 * s - g.measureText(q).width, 34 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
