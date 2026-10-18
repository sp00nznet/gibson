// NOCTURNE: pitch dark, and in the margins around the terminal pairs of eyes open, blink,
// glance about and close again. Mostly they watch the terminal. They are NYX's: the busier you
// are the more of them there are, a failed command turns them all red, a good one makes them blink.
(function (Worlds) {
  Worlds.define('nocturne', (k) => {
    const { C, rand, pick, env, line2 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", VW = 1920, VH = 1080;
    const KINDS = [
      { iris: C.gold, slit: true, w: 1.0, h: 0.72 }, // cat
      { iris: '255,138,31', slit: false, w: 1.0, h: 1.0 }, // owl
      { iris: C.neon, slit: true, w: 1.2, h: 0.55 }, // lizard
      { iris: C.hot, slit: false, w: 0.7, h: 0.7 }, // something small
      { iris: C.ice, slit: false, w: 0.9, h: 0.6 }, // something else
    ];
    let eyes = [], spawnT = 0, red = 0, said = null;
    // somewhere in the margins (virtual 1920x1080), not too close to another pair
    function spot(size) {
      for (let n = 0; n < 20; n++) {
        const band = Math.random();
        const x = band < 0.42 ? rand(50, 300 - size * 2) : band < 0.84 ? rand(1620 + size * 2, VW - 50) : rand(330, VW - 330);
        const y = band < 0.84 ? rand(60, VH - 60) : pick([rand(16, 44), rand(VH - 44, VH - 16)]);
        const sz = band < 0.84 ? size : Math.min(size, 9); // the thin top and bottom strips only fit small ones
        if (eyes.every((e) => Math.hypot(e.x - x, e.y - y) > (e.size + sz) * 4)) return [x, y, sz];
      }
      return null;
    }
    function spawn() {
      const s = spot(rand(8, 24)); if (!s) return;
      const [x, y, size] = s;
      eyes.push({ kind: pick(KINDS), size, x, y, gap: size * rand(2.3, 3), age: 0, life: rand(5, 13), blinkAt: rand(1, 3), blink: 0, lx: 0, ly: 0, tx: 0, ty: 0, lookT: 0 });
    }
    function eye(cx, cy, e, open, col) {
      const kd = e.kind, rw = e.size * kd.w, rh = e.size * kd.h, oh = rh * open, N = 14;
      const lid = (u) => oh * (1 - u * u); // half-height of the opening at x = u*rw
      const L = (x1, y1, x2, y2, c, a) => line2(x1 * sx, y1 * sy, x2 * sx, y2 * sy, c, a);
      for (let i = 0; i < N; i++) { // the lids
        const u0 = -1 + 2 * i / N, u1 = -1 + 2 * (i + 1) / N;
        L(cx + u0 * rw, cy - lid(u0), cx + u1 * rw, cy - lid(u1), col, 0.55 * open);
        L(cx + u0 * rw, cy + lid(u0), cx + u1 * rw, cy + lid(u1), col, 0.4 * open);
      }
      const ix = cx + e.lx * rw * 0.45, iy = cy + e.ly * rh * 0.25, inside = (x, y) => Math.abs(x - cx) < rw && Math.abs(y - cy) < lid((x - cx) / rw);
      const circ = (r, rx, ry, c, a, n) => { // a ring clipped to the opening
        for (let i = 0; i < n; i++) {
          const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, x0 = ix + Math.cos(a0) * r * rx, y0 = iy + Math.sin(a0) * r * ry, x1 = ix + Math.cos(a1) * r * rx, y1 = iy + Math.sin(a1) * r * ry;
          if (inside((x0 + x1) / 2, (y0 + y1) / 2)) L(x0, y0, x1, y1, c, a);
        }
      };
      const ri = rh * 0.92;
      circ(ri, 1, 1, col, 1, 20); circ(ri * 0.8, 1, 1, col, 0.6, 18);
      for (let i = 0; i < 10; i++) { // iris streaks
        const a = i / 10 * Math.PI * 2 + e.size, x0 = ix + Math.cos(a) * ri * 0.45, y0 = iy + Math.sin(a) * ri * 0.45, x1 = ix + Math.cos(a) * ri * 0.78, y1 = iy + Math.sin(a) * ri * 0.78;
        if (inside(x1, y1)) L(x0, y0, x1, y1, col, 0.45);
      }
      if (kd.slit) circ(ri * 0.95, 0.15, 1, C.white, 0.85, 14); else circ(ri * 0.38, 1, 1, C.white, 0.8, 12);
      const gx = ix - rw * 0.25, gy = iy - rh * 0.3; if (inside(gx, gy)) L(gx - 1.5, gy, gx + 1.5, gy - 1.5, C.white, 1); // the glint
    }
    let sx = 1, sy = 1;
    return {
      label: 'NOCTURNE',
      enter() { eyes = []; spawnT = 0; for (let i = 0; i < 6; i++) { spawn(); if (eyes.length) eyes[eyes.length - 1].age = rand(0.5, 3); } },
      signal(kind) {
        if (kind === 'error') { red = 2.5; said = { s: pick(['I SAW THAT', 'TSK.', 'AGAIN?', 'WE ARE WATCHING']), e: pick(eyes) }; }
        if (kind === 'ok') for (const e of eyes) { e.blink = 0.18; e.blinkAt = rand(1.5, 4); }
      },
      update(dt) {
        red = Math.max(0, red - dt);
        for (const e of eyes) {
          e.age += dt; e.blinkAt -= dt;
          if (e.blinkAt <= 0) { e.blink = 0.18; e.blinkAt = rand(1.5, 4.5); }
          if (e.blink > 0) e.blink -= dt;
          if ((e.lookT -= dt) <= 0) { // mostly at the terminal, now and then somewhere else
            e.lookT = rand(0.8, 2.6);
            const at = red > 0 || Math.random() < 0.65;
            e.tx = at ? Math.max(-1, Math.min(1, (VW / 2 - e.x) / 500)) : rand(-1, 1); e.ty = at ? Math.max(-1, Math.min(1, (VH / 2 - e.y) / 400)) : rand(-1, 1);
          }
          const f = Math.min(1, dt * 6); e.lx += (e.tx - e.lx) * f; e.ly += (e.ty - e.ly) * f;
        }
        eyes = eyes.filter((e) => e.age < e.life);
        if (said && !eyes.includes(said.e)) said = null;
        spawnT -= dt * (1 + env.level * 3);
        if (spawnT <= 0 && eyes.length < 10 + env.level * 8) { spawn(); spawnT = rand(0.4, 1.8); }
      },
      draw() {
        const W = k.W, H = k.H, g = k.g; sx = W / VW; sy = H / VH;
        for (const e of eyes) {
          let open = Math.max(0, Math.min(1, e.age / 0.5, (e.life - e.age) / 0.5));
          if (e.blink > 0) open *= Math.abs(e.blink / 0.09 - 1);
          if (red > 0) open = Math.max(open, Math.min(1, red)); // wide awake
          if (open < 0.04) continue;
          const col = red > 0 ? C.hot : e.kind.iris;
          eye(e.x - e.gap / 2, e.y, e, open, col); eye(e.x + e.gap / 2, e.y, e, open, col);
        }
        if (said && red > 0) {
          const s = Math.min(sx, sy);
          g.font = `bold ${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},${Math.min(1, red)})`;
          g.fillText(said.s, Math.min(W - 160 * s, said.e.x * sx - 30 * s), (said.e.y + said.e.size * 2.2) * sy);
        }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
