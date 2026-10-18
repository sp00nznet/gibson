// GROUND ZERO: creeping down a dead avenue after the bombs. Broken towers with jagged tops and
// bare girders, rubble, fires in the windows, ash falling, and a mushroom cloud still standing
// on the horizon. A Geiger counter ticks in the margin, faster when you are busy.
(function (Worlds) {
  Worlds.define('ruins', (k) => {
    const { C, rand, pick, env, seg, ring, setCam, line2 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", L = 240, FOG = 170, SP = 20;
    const ASH = '150,150,150', FIRE = [C.gold, C.hot, '255,120,40'];
    const blds = [];
    for (const side of [-1, 1]) for (let z = 0; z < L; z += SP) {
      const x = side * rand(24, 38), w = rand(9, 16), d = rand(8, 13), h = rand(30, 85);
      const fallen = Math.random() < 0.25; // just a heap now
      blds.push({ x, z: z + rand(-3, 3), w, d, fallen,
        tops: [0, 1, 2, 3].map(() => fallen ? rand(1, 4) : h * rand(0.35, 1)), // each corner broken off at its own height
        rebar: Array.from({ length: 5 }, () => [rand(-w / 2, w / 2), rand(2, 7), rand(-0.6, 0.6)]),
        fires: Array.from({ length: fallen ? 1 : 3 }, () => ({ y: rand(1, h * 0.4), dx: rand(-w / 3, w / 3), ph: rand(0, 9) })),
        junk: Array.from({ length: 14 }, () => [rand(-w, w), rand(0, 3), rand(-d, d), rand(-w, w), rand(0, 3), rand(-d, d)]),
      });
    }
    const ash = Array.from({ length: 160 }, () => [rand(-40, 40), rand(0, 40), rand(0, 120)]);
    let cz = 0, ticks = [], dose = 3.2;
    const zOf = (b) => ((b.z - cz) % L + L) % L - 20;

    return {
      label: 'GROUND ZERO',
      update(dt) {
        cz += (3 + env.level * 6) * dt;
        for (const a of ash) { a[1] -= dt * (1.2 + Math.sin(a[0]) * 0.4); a[0] += Math.sin(env.t + a[2]) * dt * 0.6; if (a[1] < 0) { a[1] = 40; a[2] = rand(0, 120); } }
        // the counter: random clicks, more of them the harder you work
        if (Math.random() < dt * (6 + env.level * 40)) ticks.push(1);
        ticks = ticks.map((x) => x - dt * 4).filter((x) => x > 0);
        dose += (3 + env.level * 9 + Math.sin(env.t * 0.3) - dose) * dt * 0.5;
      },
      draw() {
        const t = env.t;
        setCam({ x: Math.sin(t * 0.1) * 2, y: 7 + Math.sin(t * 0.7) * 0.15, z: cz, yaw: Math.sin(t * 0.06) * 0.12, pitch: 0.1 });
        // the cloud on the horizon, always ahead of us
        const mx = 340, mz = cz + 420, my = 0, glow = 0.55 + Math.sin(t * 0.5) * 0.1;
        for (let y = 0; y < 130; y += 10) ring(mx, my + y, mz, 9 + Math.sin(y * 0.2 + t) * 1.5, 14, FIRE[0], glow * 0.7, 900);
        for (let i = 0; i < 7; i++) { // the cap, rolling over on itself
          const a = i / 7 * Math.PI * 2 + t * 0.3, r = 38 + Math.cos(a) * 14, y = 150 + Math.sin(a) * 18;
          ring(mx, y, mz, r, 24, i % 2 ? C.hot : FIRE[2], glow, 900);
        }
        ring(mx, 112, mz, 30 + Math.sin(t * 0.4) * 3, 22, C.white, 0.3, 900); // the collar
        for (let x = -600; x <= 600; x += 30) seg(x, 0, mz - 100, x + 30, 0, mz - 100, C.hot, 0.5, 900); // the burning horizon
        // the street: cracked, with a crater
        for (const x of [-16, 16]) seg(x, 0, cz - 5, x, 0, cz + 160, ASH, 0.5, FOG);
        for (let z = Math.ceil(cz / 9) * 9; z < cz + 160; z += 9) { const j = Math.sin(z * 1.7) * 3; seg(-16, 0, z, -2 + j, 0, z + 2, ASH, 0.3, FOG); seg(-2 + j, 0, z + 2, 16, 0, z - 1, ASH, 0.3, FOG); }
        for (const b of blds) {
          const zz = zOf(b); if (zz > 170) continue;
          const z = cz + zz, x = b.x, w = b.w / 2, d = b.d / 2;
          const P = [[x - w, z - d], [x + w, z - d], [x + w, z + d], [x - w, z + d]];
          for (const j of b.junk) seg(x + j[0], j[1], z + j[2], x + j[3], j[4], z + j[5], ASH, 0.5, FOG);
          if (b.fallen) continue;
          for (let i = 0; i < 4; i++) {
            const [ax, az] = P[i], [bx, bz] = P[(i + 1) % 4], ha = b.tops[i], hb = b.tops[(i + 1) % 4];
            seg(ax, 0, az, ax, ha, az, C.gold, 0.6, FOG);
            seg(ax, ha, az, bx, hb, bz, C.gold, 0.35, FOG); // the torn edge
            for (let y = 5; y < Math.min(ha, hb); y += 5) if (Math.sin(i * 3 + y * 1.3 + b.z) > -0.3) seg(ax, y, az, bx, y, bz, ASH, 0.3, FOG); // floors, some gone
          }
          const top = Math.max(...b.tops);
          for (const r of b.rebar) seg(x + r[0], top * 0.9, z, x + r[0] + r[2] * r[1], top * 0.9 + r[1], z, ASH, 0.6, FOG); // bare girders
          for (const f of b.fires) {
            const fx = x + f.dx, fz = z - Math.sign(x) * 0, fy = f.y;
            for (let n = 0; n < 4; n++) { const fl = 1.5 + Math.abs(Math.sin(t * 9 + f.ph + n * 2)) * 3; seg(fx + n * 0.5 - 1, fy, fz - d, fx + n * 0.5 - 1 + Math.sin(t * 5 + n) * 0.4, fy + fl, fz - d, pick(FIRE), 0.9, FOG); }
          }
        }
        for (const a of ash) seg(a[0], a[1], cz + a[2], a[0] + 0.2, a[1] - 0.2, cz + a[2], ASH, 0.6, 120);

        // the Geiger counter, in the margin
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = W * 0.03, y0 = H * 0.12;
        g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText('CD V-715', x0, y0);
        g.fillStyle = `rgba(${C.hot},${0.6 + Math.sin(t * 6) * 0.4})`; g.fillText(`${dose.toFixed(1)} Sv/h`, x0, y0 + 26 * s);
        g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${ASH},0.8)`; g.fillText('DAYS SINCE: 0', x0, y0 + 48 * s);
        const cx = x0 + 70 * s, cy = y0 + 150 * s, R = 60 * s, a = Math.PI * (1 + Math.min(1, dose / 15));
        for (let i = 0; i <= 10; i++) { const q = Math.PI * (1 + i / 10); line2(cx + Math.cos(q) * R, cy + Math.sin(q) * R, cx + Math.cos(q) * R * 0.85, cy + Math.sin(q) * R * 0.85, i > 6 ? C.hot : C.gold, 0.8); }
        line2(cx, cy, cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95, C.white, 1);
        for (const tk of ticks) line2(x0 + 150 * s, cy - tk * 20 * s, x0 + 150 * s + 14 * s, cy - tk * 20 * s, C.gold, tk);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
