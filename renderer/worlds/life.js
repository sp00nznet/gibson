// GAME OF LIFE: Conway's automaton on a wide plane seen in perspective, the camera circling.
// Newborn cells flash white, then age through green, blue and violet; the long-lived ones rise
// into little towers. When the board dies out or settles into a loop it reseeds with fresh soup.
// Generation and population (with a history trace) sit in the margins.
(function (Worlds) {
  Worlds.define('life', (k) => {
    const { C, env, seg, line2, setCam, lookAt } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", CW = 84, CH = 52, S = 2.4, FOG = 260;
    let grid = new Uint8Array(CW * CH), next = new Uint8Array(CW * CH), age = new Uint16Array(CW * CH);
    let gen = 0, pops = [], stepT = 0, flash = 0;
    function seed() {
      for (let i = 0; i < grid.length; i++) { grid[i] = Math.random() < 0.22 ? 1 : 0; age[i] = grid[i]; }
      gen = 0; pops = []; flash = 1.5;
    }
    function step() {
      let pop = 0;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += grid[((y + dy + CH) % CH) * CW + (x + dx + CW) % CW];
        const i = y * CW + x, alive = grid[i] ? n === 2 || n === 3 : n === 3;
        next[i] = alive ? 1 : 0;
        if (alive) { age[i] = Math.min(age[i] + 1, 9999); pop++; } else age[i] = 0;
      }
      [grid, next] = [next, grid]; gen++;
      pops.push(pop); if (pops.length > 240) pops.shift();
      // dead, or stuck: the same count as 1, 2 or 3 generations ago for a long stretch (still lifes, blinkers, the usual)
      const n = pops.length, stuck = n > 90 && [1, 2, 3].some((p) => pops.slice(-80).every((v, i, a) => i < p || v === a[i - p]));
      if (!pop || stuck || gen > 2500) seed();
    }
    seed();
    const colOf = (a) => a <= 1 ? C.white : a < 5 ? C.neon : a < 14 ? C.ice : a < 40 ? C.violet : C.hot;
    return {
      label: 'GAME OF LIFE',
      update(dt) {
        stepT += dt * (1 + env.level * 2); flash = Math.max(0, flash - dt);
        while (stepT > 0.11) { stepT -= 0.11; step(); }
      },
      draw() {
        const a = env.t * 0.035, X0 = -CW * S / 2, Z0 = -CH * S / 2;
        setCam(lookAt({ x: Math.sin(a) * 78, y: 52 + Math.sin(env.t * 0.08) * 8, z: -Math.cos(a) * 78 }, 0, -6, 0));
        for (let x = 0; x <= CW; x += 4) seg(X0 + x * S, 0, Z0, X0 + x * S, 0, -Z0, C.violet, 0.22, FOG);
        for (let y = 0; y <= CH; y += 4) seg(X0, 0, Z0 + y * S, -X0, 0, Z0 + y * S, C.violet, 0.22, FOG);
        const m = S * 0.12;
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
          const ag = age[y * CW + x]; if (!ag) continue;
          const col = colOf(ag), x0 = X0 + x * S + m, x1 = x0 + S - 2 * m, z0 = Z0 + y * S + m, z1 = z0 + S - 2 * m;
          const h = ag < 14 ? 0 : Math.min(6, (ag - 12) * 0.12); // old cells rise
          seg(x0, h, z0, x1, h, z0, col, 0.95, FOG); seg(x1, h, z0, x1, h, z1, col, 0.95, FOG);
          seg(x1, h, z1, x0, h, z1, col, 0.95, FOG); seg(x0, h, z1, x0, h, z0, col, 0.95, FOG);
          if (h) { seg(x0, 0, z0, x0, h, z0, col, 0.5, FOG); seg(x1, 0, z0, x1, h, z0, col, 0.5, FOG); seg(x1, 0, z1, x1, h, z1, col, 0.5, FOG); seg(x0, 0, z1, x0, h, z1, col, 0.5, FOG); }
          else if (ag <= 1) { seg(x0, 0, z0, x1, 0, z1, col, 0.7, FOG); seg(x1, 0, z0, x0, 0, z1, col, 0.7, FOG); }
        }
        // margins: the counters, and the population over the last 240 generations
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), pop = pops[pops.length - 1] || 0;
        g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.9)`;
        g.fillText(`GEN ${String(gen).padStart(5, '0')}`, 28 * s, H * 0.12);
        g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText(`POP ${String(pop).padStart(5, '0')}`, 28 * s, H * 0.12 + 26 * s);
        g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.violet},0.8)`;
        g.fillText(`B3/S23  ${CW}x${CH}  TORUS`, 28 * s, H * 0.12 + 48 * s);
        if (flash > 0) { g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},${Math.min(1, flash)})`; g.fillText('RESEED :: FRESH SOUP', 28 * s, H * 0.12 + 74 * s); }
        const gx = W - 270 * s, gw = 240 * s, gy = H * 0.12, gh = 90 * s, top = Math.max(...pops, 1);
        line2(gx, gy + gh, gx + gw, gy + gh, C.violet, 0.6); line2(gx, gy, gx, gy + gh, C.violet, 0.6);
        for (let i = 1; i < pops.length; i++) line2(gx + (i - 1) / 240 * gw, gy + gh - pops[i - 1] / top * gh, gx + i / 240 * gw, gy + gh - pops[i] / top * gh, C.neon, 0.9);
        g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText('POPULATION', gx, gy - 8 * s);
        const ages = [['NEWBORN', C.white], ['YOUNG', C.neon], ['ADULT', C.ice], ['ELDER', C.violet], ['ANCIENT', C.hot]];
        ages.forEach(([n, c], i) => { const y = H * 0.82 + i * 18 * s; line2(gx, y - 4 * s, gx + 12 * s, y - 4 * s, c, 1); g.fillStyle = `rgba(${c},0.85)`; g.fillText(n, gx + 20 * s, y); });
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
