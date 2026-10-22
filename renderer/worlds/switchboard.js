// SWITCHBOARD: a 1940s telephone exchange. A long wall of switchboard sections, each a grid of
// jacks with a lamp over every one. Calls light up (more when you're busy), and a cord rises from
// the keyshelf to answer, then a second patches it through; the pair hangs there while they talk,
// then drops. Operators' chairs line the shelf. A command that works puts a call through at once;
// one that fails flashes ALL CIRCUITS BUSY. The call log in the corner reads the old exchange names.
(function (Worlds) {
  Worlds.define('switchboard', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, ring, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 60;
    const SECS = 8, SW = 3, COLS = 10, ROWS = 7, X0 = -SECS * SW / 2, WALL = 6, SHELF = 0.8, PY0 = 1.2, PY1 = 3.1;
    const EXCH = ['KLONDIKE', 'BUTTERFIELD', 'PENNSYLVANIA', 'MURRAY HILL', 'ELMWOOD', 'TEMPLETON', 'CAPITAL', 'LEHIGH', 'MAIN', 'GARFIELD'];
    const jack = (sec, c, r) => [X0 + sec * SW + 0.25 + c * (SW - 0.5) / (COLS - 1), PY0 + 0.15 + r * (PY1 - PY0 - 0.3) / (ROWS - 1), WALL];
    let calls = [], busy = 0, done = 0, log = [], next = 1;
    const num = () => `${pick(EXCH)} ${(Math.random() * 9 + 1) | 0}-${String((Math.random() * 10000) | 0).padStart(4, '0')}`;

    function ring_(urgent) { // a new call: a lamp lights somewhere free
      for (let tries = 0; tries < 10; tries++) {
        const sec = (Math.random() * SECS) | 0, c = (Math.random() * COLS) | 0, r = (Math.random() * ROWS) | 0;
        if (calls.some((q) => q.sec === sec && (q.a[0] === c && q.a[1] === r || q.b && q.b[0] === c && q.b[1] === r))) continue;
        const b = [(Math.random() * COLS) | 0, (Math.random() * ROWS) | 0];
        calls.push({ sec, a: [c, r], b, slot: (Math.random() * 8) | 0, t: urgent ? 1.1 : 0, ans: rand(1, 2.5), talk: rand(6, 16), from: num(), to: num() });
        return;
      }
    }
    function cord(sec, slot, J, col, f) { // from the keyshelf up to the jack, sagging toward the operator; f: how far it's reached
      const S = [X0 + sec * SW + 0.3 + slot * 0.33, SHELF + 0.02, WALL - 0.9];
      let p = S;
      for (let i = 1; i <= 12; i++) {
        const t = i / 12 * f, b = Math.sin(Math.PI * t);
        const q = [S[0] + (J[0] - S[0]) * t, S[1] + (J[1] - S[1]) * t - b * 0.35, S[2] + (J[2] - 0.05 - S[2]) * t - b * 0.4];
        seg(...p, ...q, col, 0.9, FOG); p = q;
      }
      seg(...p, p[0], p[1] + 0.08, p[2], C.white, 1, FOG); // the plug
    }

    return {
      label: 'SWITCHBOARD',
      signal(kind) { if (kind === 'ok') ring_(true); if (kind === 'error') busy = 2; },
      update(dt) {
        busy = Math.max(0, busy - dt);
        if (Math.random() < dt * (0.4 + env.level * 3) && calls.length < 40) ring_(false);
        for (const q of calls) {
          q.t += dt;
          if (!q.logged && q.t > q.ans + 0.8) { q.logged = true; log.unshift(`${String(next++).padStart(4, '0')}  ${q.from}  >  ${q.to}`); log.length = Math.min(log.length, 8); }
        }
        const before = calls.length;
        calls = calls.filter((q) => q.t < q.ans + 1 + q.talk);
        done += before - calls.length;
      },
      draw() {
        const t = env.t, cx = Math.sin(t * 0.04) * 6;
        setCam(lookAt({ x: cx - 4, y: 1.75, z: 0.2 }, cx + 1, 1.7, WALL));
        // floor boards, ceiling lamps
        for (let x = X0 - 2; x <= -X0 + 2; x += 1) seg(x, 0, -2, x, 0, WALL, C.gold, 0.15, FOG);
        for (let x = X0; x <= -X0; x += 6) { seg(x, 4, 3, x, 3.6, 3, C.gold, 0.4, FOG); ring(x, 3.5, 3, 0.25, 10, C.gold, 0.6, FOG); }
        for (let s = 0; s < SECS; s++) {
          const x0 = X0 + s * SW, x1 = x0 + SW;
          // cabinet: the upright, the top, the keyshelf
          seg(x0, 0, WALL, x0, PY1 + 0.5, WALL, C.ice, 0.7, FOG);
          seg(x0, PY1 + 0.5, WALL, x1, PY1 + 0.5, WALL, C.ice, 0.7, FOG);
          seg(x0, PY0, WALL, x1, PY0, WALL, C.ice, 0.5, FOG); seg(x0, PY1, WALL, x1, PY1, WALL, C.ice, 0.5, FOG);
          text3(`POS ${s + 1}`, x0 + 0.1, PY1 + 0.2, WALL, C.ice, 0.13, 0.6);
          seg(x0, SHELF, WALL - 1.1, x1, SHELF, WALL - 1.1, C.ice, 0.7, FOG); seg(x0, SHELF, WALL - 1.1, x0, SHELF, WALL, C.ice, 0.5, FOG);
          seg(x0, SHELF, WALL - 1.1, x0, 0, WALL - 1.1, C.ice, 0.4, FOG);
          for (let i = 0; i < 8; i++) { const px = x0 + 0.3 + i * 0.33; seg(px, SHELF, WALL - 0.9, px, SHELF + 0.08, WALL - 0.9, C.white, 0.6, FOG); seg(px, SHELF, WALL - 0.6, px, SHELF + 0.05, WALL - 0.6, C.gold, 0.5, FOG); } // idle plugs and keys
          // the jack field: a dash per jack
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const j = jack(s, c, r); seg(j[0] - 0.04, j[1], j[2], j[0] + 0.04, j[1], j[2], C.violet, 0.45, FOG); }
          // a chair at each position
          const ch = x0 + SW / 2, cz = WALL - 1.8;
          for (const [a, b] of [[[-0.3, 0.5, -0.3], [0.3, 0.5, -0.3]], [[0.3, 0.5, -0.3], [0.3, 0.5, 0.3]], [[0.3, 0.5, 0.3], [-0.3, 0.5, 0.3]], [[-0.3, 0.5, 0.3], [-0.3, 0.5, -0.3]], [[-0.3, 0.5, -0.3], [-0.3, 1.2, -0.35]], [[0.3, 0.5, -0.3], [0.3, 1.2, -0.35]], [[-0.3, 1.2, -0.35], [0.3, 1.2, -0.35]], [[0, 0, 0], [0, 0.5, 0]]])
            seg(ch + a[0], a[1], cz + a[2], ch + b[0], b[1], cz + b[2], C.gold, 0.5, FOG);
        }
        // the calls: lamp blinking, then cords
        for (const q of calls) {
          const A = jack(q.sec, ...q.a), B = jack(q.sec, ...q.b);
          const waiting = q.t < q.ans, blink = waiting ? Math.sin(q.t * 14) > 0 : true;
          if (blink) ring(A[0], A[1] + 0.1, A[2] - 0.01, 0.04, 6, waiting ? C.hot : C.gold, 1, FOG, 'xy');
          if (!waiting) {
            const f = Math.min(1, (q.t - q.ans) * 2.5), end = q.ans + 1 + q.talk;
            const drop = q.t > end - 0.5 ? Math.max(0, (end - q.t) * 2) : 1;
            cord(q.sec, q.slot, A, C.hot, Math.min(f, drop));
            if (q.t > q.ans + 0.6) { ring(B[0], B[1] + 0.1, B[2] - 0.01, 0.04, 6, C.neon, 1, FOG, 'xy'); cord(q.sec, (q.slot + 1) % 8, B, C.neon, Math.min(1, (q.t - q.ans - 0.6) * 2.5, drop)); }
          }
        }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('CENTRAL OFFICE  ::  LONG LINES', 28 * s, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.75)`;
      g.fillText(`LINES IN USE ${String(calls.length).padStart(2, '0')}/${SECS * COLS * ROWS}   CALLS COMPLETED ${String(done).padStart(5, '0')}`, 28 * s, 56 * s);
      g.font = `${12 * s | 0}px ${MONO}`;
      log.forEach((l, i) => { g.fillStyle = `rgba(${C.ice},${0.85 - i * 0.09})`; g.fillText(l, 28 * s, H - (30 + i * 18) * s); });
      if (busy > 0 && Math.sin(env.t * 10) > 0) {
        g.font = `bold ${28 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`;
        const m = 'ALL CIRCUITS BUSY'; g.fillText(m, W - 28 * s - g.measureText(m).width, 40 * s);
      }
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.7)`;
      const nb = 'NUMBER, PLEASE?'; g.fillText(nb, W - 28 * s - g.measureText(nb).width, H - 30 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
