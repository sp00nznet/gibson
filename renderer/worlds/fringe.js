// LUNATIC FRINGE: a vector space shooter that plays itself. The ship hunts tumbling wireframe
// rocks (they split, then burst into debris), a saucer skims the top or bottom edge now and then,
// and the score ticks up in the corner. Rocks drift up and down the side margins, and the pilot
// likes it out there too, so most of the fight happens around the terminal.
(function (Worlds) {
  Worlds.define('fringe', (k) => {
    const { C, rand, pick, env, line2 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", VW = 1920, VH = 1080, TAU = Math.PI * 2;
    // a rock is a jittered icosahedron, tumbling about its own axis
    const PHI = (1 + Math.sqrt(5)) / 2, ICO = [];
    for (const a of [-1, 1]) for (const b of [-PHI, PHI]) ICO.push([0, a, b], [a, b, 0], [b, 0, a]);
    const EDGES = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(Math.hypot(ICO[i][0] - ICO[j][0], ICO[i][1] - ICO[j][1], ICO[i][2] - ICO[j][2]) - 2) < 0.01) EDGES.push([i, j]);
    let ship, rocks = [], bullets = [], debris = [], saucer = null, respawn = 0, saucerT = 6, fireT = 0, score = 0, hi = 31337, lives = 3;
    const wrap = (o) => { o.x = (o.x + VW) % VW; o.y = (o.y + VH) % VH; };
    const newShip = () => { ship = { x: pick([160, VW - 160]), y: VH / 2, vx: 0, vy: 0, a: -Math.PI / 2, safe: 2, thrust: false }; };
    function rock(x, y, size, d) {
      if (d == null) d = pick([-1, 1]) * Math.PI / 2 + rand(-0.5, 0.5); // big ones drift up and down
      const sp = rand(40, 90) * (4 - size) / 2, ax = [rand(-1, 1), rand(-1, 1), rand(-1, 1)], al = Math.hypot(...ax) || 1;
      rocks.push({ x, y, size, r: size * 24, v: ICO.map((p) => p.map((c) => c * rand(0.75, 1.05) / 1.9)), ax: ax.map((c) => c / al), a: rand(0, TAU), spin: rand(-1.5, 1.5), vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, col: pick([C.ice, C.ice, C.violet]) });
    }
    const wave = () => { for (let i = 0; i < 6; i++) rock(i % 2 ? rand(20, 300) : VW - rand(20, 300), rand(0, VH), 3); };
    function burst(x, y, n, col) {
      for (let i = 0; i < n && debris.length < 300; i++) { const d = rand(0, TAU), s = rand(40, 220); debris.push({ x, y, vx: Math.cos(d) * s, vy: Math.sin(d) * s, a: rand(0, TAU), spin: rand(-8, 8), len: rand(3, 10), life: rand(0.6, 1.5), col }); }
    }
    newShip(); wave();
    // Rodrigues: rotate p about unit axis u by angle a
    function rot(p, u, a) {
      const c = Math.cos(a), s = Math.sin(a), d = (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) * (1 - c);
      return [p[0] * c + (u[1] * p[2] - u[2] * p[1]) * s + u[0] * d, p[1] * c + (u[2] * p[0] - u[0] * p[2]) * s + u[1] * d, p[2] * c + (u[0] * p[1] - u[1] * p[0]) * s + u[2] * d];
    }
    return {
      label: 'LUNATIC FRINGE',
      update(dt) {
        dt *= 1 + env.level * 0.8;
        if (ship) { // pilot: turn toward the nearest target (leading it), thrust when far, fire when lined up
          let best = null, bd = Infinity;
          for (const t of saucer ? rocks.concat([saucer]) : rocks) { const d = Math.hypot(t.x - ship.x, t.y - ship.y), score = d + (Math.abs(t.x - VW / 2) < 620 ? 700 : 0); if (score < bd) { bd = score; best = t; } } // ponytail: targets out in the margins first
          if (best) bd = Math.hypot(best.x - ship.x, best.y - ship.y);
          if (best) {
            const lead = bd / 460, want = Math.atan2(best.y + best.vy * lead - ship.y, best.x + best.vx * lead - ship.x);
            const diff = ((want - ship.a + Math.PI * 3) % TAU) - Math.PI;
            ship.a += Math.max(-4 * dt, Math.min(4 * dt, diff));
            ship.thrust = bd > 280 || bd < 80;
            const sign = bd < 80 ? -1 : 1;
            if (ship.thrust) { ship.vx += Math.cos(ship.a) * 170 * sign * dt; ship.vy += Math.sin(ship.a) * 170 * sign * dt; }
            fireT -= dt;
            if (Math.abs(diff) < 0.12 && fireT <= 0) { fireT = 0.2; bullets.push({ x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14, vx: ship.vx + Math.cos(ship.a) * 460, vy: ship.vy + Math.sin(ship.a) * 460, life: 1.1 }); }
          }
          // ponytail: a gentle shove out from behind the terminal, toward the nearer side margin
          if (Math.abs(ship.x - VW / 2) < 640) ship.vx += Math.sign(ship.x - VW / 2 || 1) * 240 * dt;
          ship.vx *= Math.pow(0.6, dt); ship.vy *= Math.pow(0.6, dt);
          ship.x += ship.vx * dt; ship.y += ship.vy * dt; wrap(ship); ship.safe -= dt;
        } else if ((respawn -= dt) <= 0) { newShip(); if (--lives < 0) { lives = 3; if (score > hi) hi = score; score = 0; } }
        for (const r of rocks) {
          r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.spin * dt; wrap(r);
          if (ship && ship.safe <= 0 && Math.hypot(r.x - ship.x, r.y - ship.y) < r.r * 0.8 + 11) { burst(ship.x, ship.y, 40, C.gold); ship = null; respawn = 2; }
        }
        saucerT -= dt;
        if (!saucer && saucerT <= 0) { const left = Math.random() < 0.5; saucer = { x: left ? -30 : VW + 30, y0: pick([36, VH - 36]), y: 0, vx: left ? 140 : -140, vy: 0, t: 0 }; }
        if (saucer) {
          saucer.t += dt; saucer.x += saucer.vx * dt; saucer.vy = Math.cos(saucer.t * 2) * 30; saucer.y = saucer.y0 + Math.sin(saucer.t * 2) * 15;
          if (saucer.x < -60 || saucer.x > VW + 60) { saucer = null; saucerT = rand(8, 16); }
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b);
          let hit = b.life <= 0;
          for (let j = rocks.length - 1; j >= 0 && !hit; j--) {
            const r = rocks[j];
            if (Math.hypot(r.x - b.x, r.y - b.y) < r.r) {
              hit = true; rocks.splice(j, 1); burst(r.x, r.y, 8 + r.size * 6, C.ice); score += [0, 100, 50, 20][r.size];
              if (r.size > 1) for (let n = 0; n < 2; n++) rock(r.x, r.y, r.size - 1, rand(0, TAU));
            }
          }
          if (!hit && saucer && Math.hypot(saucer.x - b.x, saucer.y - b.y) < 26) { hit = true; burst(saucer.x, saucer.y, 50, C.hot); saucer = null; saucerT = rand(8, 16); score += 1000; }
          if (hit) bullets.splice(i, 1);
        }
        if (!rocks.length) wave();
        for (const d of debris) { d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.spin * dt; }
        debris = debris.filter((d) => d.life > 0);
      },
      draw() {
        const W = k.W, H = k.H, g = k.g, sx = W / VW, sy = H / VH, s = Math.min(sx, sy);
        const L = (x1, y1, x2, y2, col, a) => line2(x1 * sx, y1 * sy, x2 * sx, y2 * sy, col, a);
        const poly = (pts, col, a, closed) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; L(p[0], p[1], q[0], q[1], col, a); } };
        for (const r of rocks) {
          const P = r.v.map((p) => rot(p, r.ax, r.a));
          for (const [i, j] of EDGES) { const z = (P[i][2] + P[j][2]) / 2; L(r.x + P[i][0] * r.r, r.y + P[i][1] * r.r, r.x + P[j][0] * r.r, r.y + P[j][1] * r.r, r.col, 0.55 + z * 0.45); }
        }
        if (saucer) {
          const x = saucer.x, y = saucer.y;
          poly([[x - 26, y], [x + 26, y], [x + 14, y + 8], [x - 14, y + 8]], C.hot, 1, true);
          poly([[x - 26, y], [x - 12, y - 7], [x + 12, y - 7], [x + 26, y]], C.hot, 1);
          poly([[x - 9, y - 7], [x - 6, y - 15], [x + 6, y - 15], [x + 9, y - 7]], C.hot, 1);
        }
        for (const b of bullets) L(b.x, b.y, b.x - b.vx * 0.02, b.y - b.vy * 0.02, C.gold, 1);
        for (const d of debris) { const c = Math.cos(d.a) * d.len, n = Math.sin(d.a) * d.len; L(d.x - c, d.y - n, d.x + c, d.y + n, d.col, Math.min(1, d.life)); }
        if (ship && (ship.safe <= 0 || ((ship.safe * 8) | 0) % 2)) { // flickers while it is still safe after a respawn
          const p = (r, a) => [ship.x + Math.cos(ship.a + a) * r, ship.y + Math.sin(ship.a + a) * r];
          poly([p(22, 0), p(17, 2.5), p(7, Math.PI), p(17, -2.5)], C.neon, 1, true);
          if (ship.thrust && Math.random() < 0.7) poly([p(11, 2.8), p(24 + Math.random() * 10, Math.PI), p(11, -2.8)], C.gold, 0.9);
        }
        // scores in the corners, spare ships under them
        g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.9)`;
        g.fillText(`1UP ${String(score).padStart(6, '0')}`, 30 * sx, 40 * sy);
        g.fillStyle = `rgba(${C.hot},0.9)`; const hs = `HI ${String(Math.max(hi, score)).padStart(6, '0')}`;
        g.fillText(hs, W - 30 * sx - g.measureText(hs).width, 40 * sy);
        for (let i = 0; i < lives; i++) { const x = 40 + i * 26, y = 74; poly([[x, y - 10], [x + 7, y + 7], [x, y + 3], [x - 7, y + 7]], C.neon, 0.8, true); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
