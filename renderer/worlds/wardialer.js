// WAR DIALER: a thousand numbers in one exchange, dialed one at a time in random order. The board
// lies tilted on the desk, a tile per number: each one rings and settles as BUSY, VOICE, NO ANSWER,
// FAX, TONE or the prize, CARRIER, which stays lit. The tile being dialed stands up with its
// number on it. Status top left, the modem's lights top right, hits bottom left. Busier hands dial
// faster; a command that works finds a carrier on the next number; one that fails loses dial tone.
(function (Worlds) {
  Worlds.define('wardialer', (k) => {
    const { C, rand, env, seg, setCam, lookAt, box, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", COLS = 40, ROWS = 25, N = COLS * ROWS, SP = 2.2, FOG = 220;
    const ST = { BUSY: C.gold, VOICE: C.violet, 'NO ANSWER': '85,85,110', FAX: C.ice, TONE: C.white, CARRIER: C.neon };
    const roll = () => { const r = Math.random(); return r < 0.04 ? 'CARRIER' : r < 0.11 ? 'FAX' : r < 0.14 ? 'TONE' : r < 0.3 ? 'BUSY' : r < 0.62 ? 'VOICE' : 'NO ANSWER'; };
    let prefix = 0, order = [], idx = 0, state = [], cur = -1, phase = 'dial', pt = 0, rings = 0, need = 0, digits = '', hits = [], lucky = false, noTone = 0, avg = 4;
    function board() {
      prefix = (prefix + 1) % 10; state = new Array(N).fill(null); idx = 0;
      order = Array.from({ length: N }, (_, i) => i); for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      next();
    }
    const num = (i) => `555-${prefix}${String(i).padStart(3, '0')}`;
    function next() { if (idx >= N) { board(); return; } cur = order[idx++]; phase = 'dial'; pt = 0; digits = ''; rings = 0; need = 1 + Math.floor(rand(0, 4)); }
    const cell = (i) => [(i % COLS - (COLS - 1) / 2) * SP, Math.floor(i / COLS) * SP];

    board();
    return {
      label: 'WAR DIALER',
      signal(kind) { if (kind === 'ok') lucky = true; if (kind === 'error') noTone = 2; },
      update(dt) {
        if (noTone > 0) { noTone -= dt; return; }
        const sp = 1 + env.level * 5; pt += dt * sp;
        if (phase === 'dial') { const full = num(cur).replace('-', ''); digits = full.slice(0, Math.min(full.length, Math.floor(pt / 0.12))); if (pt > full.length * 0.12 + 0.3) { phase = 'ring'; pt = 0; } }
        else if (phase === 'ring') { rings = Math.floor(pt / 0.8) + 1; if (pt > need * 0.8) { phase = 'result'; pt = 0; state[cur] = lucky ? 'CARRIER' : roll(); lucky = false;
          const r = state[cur]; if (r === 'CARRIER' || r === 'FAX' || r === 'TONE') { hits.unshift({ n: num(cur), r, baud: [2400, 9600, 14400, 28800][Math.floor(rand(0, 4))] }); hits.length = Math.min(hits.length, 9); } } }
        else if (phase === 'result' && pt > 0.5) next();
        avg += ((0.12 * 8 + 0.3 + need * 0.8 + 0.5) / sp - avg) * 0.05;
      },
      draw() {
        const t = env.t, [cx, cz] = cell(cur);
        setCam(lookAt({ x: cx * 0.2 + Math.sin(t * 0.1) * 4, y: 30, z: -14 }, cx * 0.25, 0, 22)); // the whole board, wider than the screen, so the margins show it
        for (let i = 0; i < N; i++) {
          const [x, z] = cell(i), st = state[i], h = SP * 0.4;
          if (!st) { seg(x - 0.2, 0, z, x + 0.2, 0, z, C.ice, 0.45, FOG); continue; }
          const col = ST[st], a = st === 'CARRIER' ? 0.9 + env.pulse * 0.1 : 0.8;
          seg(x - h, 0, z - h, x + h, 0, z - h, col, a, FOG); seg(x - h, 0, z + h, x + h, 0, z + h, col, a, FOG); // two bars a tile: a full box per number was 4000 lines
          if (st === 'CARRIER') { seg(x - h, 0, z - h, x - h, 0, z + h, col, a, FOG); seg(x + h, 0, z - h, x + h, 0, z + h, col, a, FOG); seg(x - h, 0, z - h, x + h, 0, z + h, col, a, FOG); seg(x + h, 0, z - h, x - h, 0, z + h, col, a, FOG); }
        }
        // the number being dialed, standing up
        const up = phase === 'result' ? 1 - pt * 2 : 1, col = phase === 'result' ? ST[state[cur]] : C.hot;
        box(cx, 0, cz, SP * 0.8, 1.5 * Math.max(0.1, up), SP * 0.8, col, 1, FOG);
        text3(num(cur), cx - 3, 3.4, cz, col, 1.4, 1);
        if (phase === 'ring') for (let r = 1; r <= rings; r++) k.ring(cx, 0.8, cz, 0.6 + r * 0.5 + (pt % 0.8), 16, C.hot, 0.5 / r, FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 28 * s, done = idx - (phase === 'result' ? 0 : 1);
      const count = (st) => state.reduce((n, x) => n + (x === st), 0), carriers = count('CARRIER');
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.9)`; g.fillText('WAR DIALER  v1.04', x0, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`;
      const line = noTone > 0 ? 'NO DIALTONE' : phase === 'dial' ? `ATDT ${digits}` : phase === 'ring' ? `RINGING... ${rings}` : state[cur];
      [[`EXCHANGE  555-${prefix}xxx`, C.white], [`NOW       ${num(cur)}  ${line}`, noTone > 0 ? C.hot : C.gold], [`SCANNED   ${done}/${N}`, C.white], [`CARRIERS  ${carriers}`, C.neon],
        [`ETA       ${Math.floor((N - done) * avg / 3600)}h ${String(Math.floor((N - done) * avg / 60) % 60).padStart(2, '0')}m`, C.white]].forEach(([tx, c], i) => { g.fillStyle = `rgba(${c},0.85)`; g.fillText(tx, x0, (58 + i * 19) * s); });
      g.fillStyle = `rgba(${C.white},0.25)`; g.fillRect(x0, 160 * s, 260 * s, 6 * s); g.fillStyle = `rgba(${C.neon},0.8)`; g.fillRect(x0, 160 * s, 260 * s * done / N, 6 * s);
      // hits
      g.font = `bold ${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('HITS', x0, H - (40 + 9 * 18) * s);
      g.font = `${12 * s | 0}px ${MONO}`;
      hits.forEach((h, i) => { g.fillStyle = `rgba(${ST[h.r]},${0.9 - i * 0.07})`; g.fillText(`${h.n}  ${h.r === 'CARRIER' ? 'CONNECT ' + h.baud : h.r}`, x0, H - (40 + (8 - i) * 18) * s); });
      // the modem's lights
      const L = { HS: true, AA: false, CD: phase === 'result' && state[cur] === 'CARRIER', OH: phase !== 'result' && noTone <= 0, RD: phase === 'dial' ? Math.random() < 0.5 : phase === 'ring' && Math.random() < 0.15, SD: phase === 'dial' && Math.random() < 0.6, TR: true, MR: true };
      const rx = W - 28 * s - 8 * 34 * s;
      Object.entries(L).forEach(([n, on], i) => {
        const x = rx + i * 34 * s; g.fillStyle = `rgba(${on ? (n === 'CD' ? C.neon : C.hot) : '60,20,30'},${on ? 1 : 0.6})`; g.fillRect(x + 8 * s, 22 * s, 14 * s, 7 * s);
        g.font = `${10 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; g.fillText(n, x + 8 * s, 44 * s);
      });
      g.font = `${12 * s | 0}px ${MONO}`;
      Object.keys(ST).forEach((st, i) => { const tx = `${st.padEnd(10)}${String(count(st)).padStart(4)}`; g.fillStyle = `rgba(${ST[st]},0.85)`; g.fillText(tx, W - 28 * s - g.measureText(tx).width, (74 + i * 18) * s); });
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
