// ARCADE: closing time. Two rows of cabinets face each other across a dark aisle of loud carpet,
// every screen still running its attract loop: a vector ship among drifting rocks, a dot running a
// maze, a paddle rally, blocks dropping into a stack, and one that only blinks INSERT COIN. The
// change machine glows at the far end. A command that works puts points on your score in the
// high-score table; one that fails flashes GAME OVER on every screen.
(function (Worlds) {
  Worlds.define('arcade', (k) => {
    const { C, rand, env, seg, setCam, lookAt, text3, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 60, N = 9, GAP = 1.6, AX = 2.2;
    const NAMES = ['NEBULA RAIDERS', 'DOT RUNNER', 'PADDLE WARS', 'BLOCK DROP', 'TURBO DRAG', 'ROCK STORM', 'MAZE MOUSE', 'SKY DUEL', 'BRICK CITY'];
    const COLS = [C.hot, C.ice, C.gold, C.neon, C.violet];
    // side profile of a cabinet: (d back from the front face, y)
    const PROF = [[0, 0], [0, 0.9], [0.32, 1.0], [0.2, 1.06], [0.32, 1.7], [0.06, 1.78], [0.06, 2.02], [0.8, 2.02], [0.8, 0]];
    const cabs = [];
    for (const side of [-1, 1]) for (let i = 0; i < N; i++) cabs.push({ side, z: 2 + i * GAP + (side > 0 ? 0.6 : 0), game: (i + (side > 0 ? 2 : 0)) % 5, name: NAMES[(i * 2 + (side > 0)) % NAMES.length], col: COLS[(i + side + 2) % COLS.length] });
    const carpet = Array.from({ length: 140 }, () => { const x = rand(-1.4, 1.4), z = rand(0, 18), a = rand(0, 6); return [x, z, a, COLS[(Math.random() * COLS.length) | 0]]; });
    const scores = [['NYX', 999950], ['ZRC', 873200], ['ACB', 810400], ['CRK', 655000], ['PHR', 402300], ['LRD', 180700]];
    let you = 0, over = 0;

    // a point on cabinet c's screen: u across (-1..1), v up (0..1)
    function scr(c, u, v) {
      const a = PROF[3], b = PROF[4], d = a[0] + (b[0] - a[0]) * (0.08 + v * 0.84), y = a[1] + (b[1] - a[1]) * (0.08 + v * 0.84);
      return [c.side * (AX + d) - c.side * 0.01, y, c.z + u * 0.26 * -c.side];
    }
    const S = (c, u0, v0, u1, v1, col, al) => { const p = scr(c, u0, v0), q = scr(c, u1, v1); seg(p[0], p[1], p[2], q[0], q[1], q[2], col, al == null ? 0.9 : al, FOG); };
    function attract(c, i) {
      const t = env.t + i * 1.7;
      if (over > 0) { const p = scr(c, -0.7, 0.5); text3('GAME OVER', p[0], p[1], p[2], C.hot, 0.07, Math.sin(env.t * 8) > 0 ? 1 : 0.3); return; }
      if (c.game === 0) { // a ship turning among rocks
        const a = t * 1.2;
        for (let q = 0; q < 3; q++) { const a0 = a + q * 2.1, a1 = a0 + 2.1; S(c, Math.cos(a0) * 0.18, 0.5 + Math.sin(a0) * 0.18, Math.cos(a1) * 0.18, 0.5 + Math.sin(a1) * 0.18, C.white); }
        for (let r = 0; r < 4; r++) { const u = ((t * 0.2 + r * 0.5) % 2) - 1, v = (r * 0.27 + 0.1) % 1; S(c, u - 0.08, v, u + 0.08, v, C.ice); S(c, u + 0.08, v, u, v + 0.1, C.ice); S(c, u, v + 0.1, u - 0.08, v, C.ice); }
      } else if (c.game === 1) { // a maze and a running dot
        for (let m = 0; m < 4; m++) { S(c, -0.8, 0.15 + m * 0.23, 0.8, 0.15 + m * 0.23, C.violet, 0.6); S(c, -0.8 + m * 0.53, 0.15, -0.8 + m * 0.53, 0.84, C.violet, 0.4); }
        const p = (t * 0.3) % 1, u = p < 0.5 ? -0.8 + p * 3.2 : 0.8, v = p < 0.5 ? 0.38 : 0.38 + (p - 0.5) * 0.92;
        S(c, u - 0.04, v, u + 0.04, v, C.gold, 1); S(c, u, v - 0.04, u, v + 0.04, C.gold, 1);
      } else if (c.game === 2) { // a paddle rally
        const bu = Math.sin(t * 2.1) * 0.75, bv = 0.5 + Math.sin(t * 3.3) * 0.35;
        S(c, -0.85, bv - 0.12, -0.85, bv + 0.12, C.white); S(c, 0.85, bv - 0.1, 0.85, bv + 0.1, C.white);
        S(c, bu - 0.03, bv, bu + 0.03, bv, C.neon, 1); S(c, 0, 0.05, 0, 0.95, C.white, 0.3);
      } else if (c.game === 3) { // blocks dropping into a stack
        const f = (t * 0.4) % 1, col = Math.floor(t * 0.4) % 5;
        for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) if ((q + r) % 4) S(c, -0.75 + q * 0.27, 0.08 + r * 0.1, -0.53 + q * 0.27, 0.08 + r * 0.1, COLS[(q + r) % 5], 0.8);
        const bu = -0.75 + col * 0.27, bv = 0.95 - f * 0.6;
        S(c, bu, bv, bu + 0.22, bv, C.hot, 1); S(c, bu, bv - 0.08, bu + 0.22, bv - 0.08, C.hot, 1);
      } else if (Math.sin(env.t * 4) > 0) { const p = scr(c, -0.75, 0.45); text3('INSERT COIN', p[0], p[1], p[2], C.gold, 0.06, 1); }
    }

    return {
      label: 'ARCADE',
      signal(kind) { if (kind === 'ok') you += 1000 + Math.round(env.level * 9000); if (kind === 'error') over = 2; },
      update(dt) { over = Math.max(0, over - dt); you += Math.round(dt * env.level * 400); },
      draw() {
        const t = env.t, cz = 1 + (Math.sin(t * 0.05) + 1) * 4.5;
        setCam(lookAt({ x: Math.sin(t * 0.13) * 0.3, y: 1.65, z: cz - 3 }, Math.sin(t * 0.09) * 1.5, 1.2, cz + 6));
        // walls, ceiling, the loud carpet
        for (const sx of [-3.2, 3.2]) { seg(sx, 0, -2, sx, 0, 19, C.violet, 0.3, FOG); seg(sx, 2.8, -2, sx, 2.8, 19, C.violet, 0.3, FOG); }
        for (const [x, z, a, col] of carpet) { const dx = Math.cos(a) * 0.2, dz = Math.sin(a) * 0.2; seg(x - dx, 0.01, z - dz, x, 0.01, z + 0.1, col, 0.3, FOG); seg(x, 0.01, z + 0.1, x + dx, 0.01, z + dz, col, 0.3, FOG); }
        for (const c of cabs) {
          const x0 = c.side * AX, zl = c.z - 0.35, zr = c.z + 0.35;
          const P = PROF.map(([d, y]) => [x0 + c.side * d, y]);
          for (const z of [zl, zr]) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; seg(a[0], a[1], z, b[0], b[1], z, C.ice, 0.55, FOG); }
          for (const [x, y] of P.slice(1, 8)) seg(x, y, zl, x, y, zr, C.ice, 0.4, FOG);
          // the marquee glows, the joystick and buttons sit on the panel
          const m = P[5];
          seg(m[0], m[1] + 0.13, zl, m[0], m[1] + 0.13, zr, c.col, 0.9, FOG);
          text3(c.name.slice(0, 12), m[0] - c.side * 0.01, m[1] + 0.08, c.side > 0 ? zr - 0.05 : zl + 0.05, c.col, 0.05, 0.9);
          const pnl = [x0 + c.side * 0.16, 0.96];
          seg(pnl[0], pnl[1], c.z - 0.15, pnl[0], pnl[1] + 0.12, c.z - 0.15, C.hot, 0.9, FOG);
          for (let b = 0; b < 3; b++) seg(pnl[0], pnl[1] + 0.01, c.z + 0.02 + b * 0.08, pnl[0], pnl[1] + 0.04, c.z + 0.02 + b * 0.08, COLS[b], 0.9, FOG);
        }
        cabs.forEach(attract);
        // the change machine at the far end
        box(0, 0, 19, 0.9, 1.7, 0.6, C.gold, 0.7, FOG);
        text3('CHANGE', -0.3, 1.45, 18.65, C.gold, 0.12, 0.9);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},${Math.sin(env.t * 2) > -0.3 ? 0.95 : 0.3})`; g.fillText('CLOSING IN 5 MIN', 28 * s, 34 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText('TOKENS 4 FOR $1  ::  NO FOOD OR DRINK ON THE CABINETS', 28 * s, 54 * s);
      const table = [...scores, ['YOU', you]].sort((a, b) => b[1] - a[1]).slice(0, 7);
      g.font = `bold ${14 * s | 0}px ${MONO}`;
      const head = 'HIGH SCORES'; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(head, W - 28 * s - g.measureText(head).width, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`;
      table.forEach(([n, v], i) => { const l = `${i + 1}. ${n}  ${String(v).padStart(7, '0')}`; g.fillStyle = `rgba(${n === 'YOU' ? C.neon : C.ice},0.85)`; g.fillText(l, W - 28 * s - g.measureText(l).width, (58 + i * 18) * s); });
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
