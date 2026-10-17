// THE STREET: Snow Crash's endless neon boulevard, curving down over a black planet, lined with signs, a monorail overhead, avatars on the sidewalks.
(function (Worlds) {
  Worlds.define('street', (k) => {
    const { C, rand, pick, env, seg, setCam, toCam } = k;
    const L = 200, K = 0.0011, FOG = 230, FACE = 13;
    const NAMES = ['THE BLACK SUN', 'HACKERS WELCOME', 'MONORAIL', 'PORT 80', 'MEGAPOWER', 'KOURIER', 'NOSTRA PIZZA', 'GREATER HONG KONG', 'RADIKAL', 'AVATARS 4 LESS', 'PORT 443', 'DAEMON', 'CENTRAL INTEL', 'RAFT', 'NAM-SHUB', 'METAVERSE', 'EXPRESS PORT', 'ZONE 7', 'VIRUS FREE', 'LAGOS', 'SOFTWARE', 'BRANDY BAR', 'GARGOYLE'];
    let off = 0, bend = 0, train = null, trainT = 4;

    // The planet's curvature: everything drops (and drifts a little sideways) with distance.
    const P = (x, y, z) => { const zz = Math.max(0, z); return [x + zz * zz * bend, y - zz * zz * K, z]; };
    function S(ax, ay, az, bx, by, bz, col, a) { // long segments are split so they follow the curve
      const n = Math.max(1, Math.ceil(Math.abs(bz - az) / 6));
      let p = P(ax, ay, az);
      for (let i = 1; i <= n; i++) {
        const t = i / n, q = P(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
        seg(p[0], p[1], p[2], q[0], q[1], q[2], col, a, FOG); p = q;
      }
    }
    function B(x, y, z, w, h, d, col, a) {
      const X = [x - w / 2, x + w / 2], Z = [z - d / 2, z + d / 2];
      for (const yy of [y, y + h]) { S(X[0], yy, Z[0], X[1], yy, Z[0], col, a); S(X[1], yy, Z[0], X[1], yy, Z[1], col, a); S(X[1], yy, Z[1], X[0], yy, Z[1], col, a); S(X[0], yy, Z[1], X[0], yy, Z[0], col, a); }
      for (const xx of X) for (const zz of Z) S(xx, y, zz, xx, y + h, zz, col, a);
    }
    const rect = (x0, y0, x1, y1, z, col, a) => { S(x0, y0, z, x1, y0, z, col, a); S(x1, y0, z, x1, y1, z, col, a); S(x1, y1, z, x0, y1, z, col, a); S(x0, y1, z, x0, y0, z, col, a); };
    // Big sign text, centred and allowed to grow past text3's 40 px cap.
    function T(s, x, y, z, col, size, a) {
      const q = P(x, y, z), p = toCam(q[0], q[1], q[2]); if (p[2] < 1) return;
      const px = size * k.F / p[2]; if (px < 6) return;
      const g = k.g;
      g.fillStyle = `rgba(${col},${(a || 1) * Math.max(0, 1 - p[2] / 190) * Math.min(1, (p[2] - 2) / 12)})`; // fade up close: huge letters smear in the trails
      g.font = `bold ${Math.min(px, 110) | 0}px 'Cascadia Mono', Consolas, monospace`;
      g.textAlign = 'center'; g.fillText(s, k.W / 2 + p[0] * k.F / p[2], k.H / 2 - p[1] * k.F / p[2]); g.textAlign = 'left';
    }

    const blds = [];
    for (const side of [-1, 1]) for (let z = 0; z < L - 8;) {
      const d = rand(8, 14), w = rand(8, 20), name = pick(NAMES);
      const kind = name.length <= 9 && Math.random() < 0.45 ? 'blade' : 'board';
      blds.push({ side, z: z + d / 2, d, w, h: rand(14, 55), name, kind, col: pick([C.violet, C.violet, C.ice]), sign: pick([C.hot, C.gold, C.neon, C.ice, C.hot]), ph: rand(0, 6) });
      z += d + rand(1, 3);
    }
    const walkers = Array.from({ length: 64 }, () => {
      const side = Math.random() < 0.5 ? -1 : 1, r = Math.random();
      return { x: side * rand(9, 12), z: rand(0, L), v: (Math.random() < 0.5 ? -1 : 1) * rand(0.8, 1.8), ph: rand(0, 6), kind: r < 0.3 ? 'block' : 'stick', h: r > 0.85 ? rand(1.5, 1.8) : rand(0.95, 1.1), col: pick([C.white, C.ice, C.neon, C.gold, C.hot]) };
    });
    const wrap = (z) => ((z - off) % L + L) % L - 10; // -10 keeps things alongside the camera drawn

    function avatar(a, z) {
      const s = a.h, x = a.x, sw = Math.sin(a.ph) * 0.35 * s, col = a.col, al = 0.85;
      const hip = 0.95 * s, sh = 1.45 * s;
      S(x, hip, z, x - 0.12 * s, 0, z + sw, col, al); S(x, hip, z, x + 0.12 * s, 0, z - sw, col, al);
      S(x - 0.05 * s, sh - 0.05 * s, z, x - 0.3 * s, hip, z - sw * 0.8, col, al); S(x + 0.05 * s, sh - 0.05 * s, z, x + 0.3 * s, hip, z + sw * 0.8, col, al);
      if (a.kind === 'block') { // the cheap off-the-shelf Brandy/Clint look
        B(x, hip, z, 0.6 * s, 0.55 * s, 0.35 * s, col, al); B(x, sh + 0.05 * s, z, 0.4 * s, 0.35 * s, 0.4 * s, col, al);
      } else {
        S(x, hip, z, x, sh, z, col, al);
        const hy = sh + 0.2 * s, r = 0.15 * s;
        S(x - r, hy, z, x, hy + r, z, col, al); S(x, hy + r, z, x + r, hy, z, col, al); S(x + r, hy, z, x, hy - r, z, col, al); S(x, hy - r, z, x - r, hy, z, col, al);
      }
    }

    return {
      label: 'THE STREET',
      update(dt) {
        off += (4 + env.level * 30) * dt;
        bend = Math.sin(env.t * 0.05) * 0.0005;
        for (const a of walkers) { a.z += a.v * dt; a.ph += dt * Math.abs(a.v) * 3.2; }
        trainT -= dt;
        if (!train && trainT < 0) train = { z: L + 20 };
        if (train) { train.z -= (45 + env.level * 40) * dt; if (train.z < -60) { train = null; trainT = rand(6, 14); } }
      },
      draw() {
        setCam({ x: Math.sin(env.t * 0.13) * 1.2, y: 2.6 + Math.sin(env.t * 1.7) * 0.05, z: 0, yaw: Math.sin(env.t * 0.07) * 0.06, pitch: 0.13 });
        // the road: curbs, sidewalk backs, lane dashes, cross lines scrolling past
        for (const x of [-8, 8]) S(x, 0, -5, x, 0, L, C.hot, 0.9);
        for (const x of [-FACE + 0.5, FACE - 0.5]) S(x, 0, -5, x, 0, L, C.violet, 0.4);
        for (let z = 6 - (off % 6); z < L; z += 6) { S(-8, 0, z, 8, 0, z, C.neon, 0.18); S(-0.15, 0, z, -0.15, 0, z + 2.5, C.gold, 0.8); }
        // monorail: a rail on cross-beams strung between the facades, a train every so often
        S(-0.7, 16, -5, -0.7, 16, L, C.ice, 0.7); S(0.7, 16, -5, 0.7, 16, L, C.ice, 0.7);
        for (let z = 30 - (off % 30); z < L; z += 30) { S(-FACE, 18, z, FACE, 18, z, C.ice, 0.5); S(0, 18, z, 0, 16, z, C.ice, 0.5); }
        if (train) for (let i = 0; i < 6; i++) {
          const cz = train.z + i * 7.5 + 3.5;
          B(0, 13.4, cz, 2.6, 2.4, 7, C.gold, 0.95);
          for (let wz = cz - 2.8; wz < cz + 3; wz += 1.4) S(-1.31, 14.8, wz, -1.31, 15.4, wz, C.white, 0.6), S(1.31, 14.8, wz, 1.31, 15.4, wz, C.white, 0.6);
        }
        for (const b of blds) {
          const z = wrap(b.z), x0 = b.side * FACE, xc = b.side * (FACE + b.w / 2), z0 = z - b.d / 2, z1 = z + b.d / 2;
          B(xc, 0, z, b.w, b.h, b.d, b.col, 0.9);
          for (let y = 4; y < b.h; y += 4) {
            S(x0, y, z0, x0, y, z1, b.col, 0.35);
            if (Math.sin(b.ph + y * 1.3 + env.t * 0.7) > 0.7) S(x0, y + 1.5, z0 + 1, x0, y + 1.5, z1 - 1, C.gold, 0.6);
          }
          const flick = Math.sin(env.t * 9 + b.ph) > 0.97 ? 0.3 : 1, glow = (0.75 + env.pulse * 0.25) * flick;
          if (b.kind === 'blade') { // vertical sign sticking out over the sidewalk, facing us
            const n = b.name.length, xo = x0 - b.side * 3, top = Math.min(b.h, 6 + n * 2.2 + 1);
            rect(x0, top - n * 2.2 - 1, xo, top, z0, b.sign, glow);
            for (let i = 0; i < n; i++) T(b.name[i], (x0 + xo) / 2, top - 2.1 - i * 2.2, z0, b.sign, 1.9, glow);
          } else { // billboard on the roof, sized to its building
            const n = b.name.length, size = Math.min(5, b.w * 0.92 / (0.6 * n)), xo = x0 + b.side * b.w, y0 = b.h + 0.5, y1 = y0 + size * 1.3;
            rect(x0, y0, xo, y1, z0, b.sign, glow * 0.8);
            S(x0, b.h, z0, x0, y0, z0, b.sign, 0.5); S(xo, b.h, z0, xo, y0, z0, b.sign, 0.5);
            T(b.name, (x0 + xo) / 2, y0 + size * 0.3, z0, b.sign, size, glow);
          }
        }
        for (const a of walkers) { const z = wrap(a.z); if (z < 130) avatar(a, z); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
