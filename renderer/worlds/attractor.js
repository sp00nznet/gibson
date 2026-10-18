// STRANGE ATTRACTOR: eight particles riding a chaotic flow, each dragging a long glowing filament,
// with the camera orbiting the shape. Every so often the flow changes (Lorenz, Aizawa, Thomas,
// Halvorsen) and the filaments unravel into the new one; the live parameters drift so it breathes.
// The equations and a readout sit in the margins.
(function (Worlds) {
  Worlds.define('attractor', (k) => {
    const { C, rand, env, seg, ring, setCam, lookAt } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", R = 34, TRAIL = 340, NP = 8, FOG = 260;
    const COLS = [C.neon, C.ice, C.hot, C.gold, C.violet, C.ice, C.neon, C.hot];
    const FLOWS = [
      { name: 'LORENZ', h: 0.005, c: [0, 0, 25], s: 1 / 24, eq: ['dx/dt = s(y - x)', 'dy/dt = x(r - z) - y', 'dz/dt = xy - bz'],
        p: (t) => ({ s: 10, r: 28 + Math.sin(t * 0.13) * 5, b: 8 / 3 }), init: () => [rand(-2, 2), rand(-2, 2), rand(20, 30)],
        f: ([x, y, z], q) => [q.s * (y - x), x * (q.r - z) - y, x * y - q.b * z] },
      { name: 'AIZAWA', h: 0.012, c: [0, 0, 0.7], s: 1 / 1.3, eq: ['dx/dt = (z - b)x - dy', 'dy/dt = dx + (z - b)y', 'dz/dt = c + az - z^3/3 - (x^2 + y^2)(1 + ez) + fzx^3'],
        p: (t) => ({ a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1 + Math.sin(t * 0.2) * 0.03 }), init: () => [rand(-0.2, 0.2) + 0.1, rand(-0.2, 0.2), rand(-0.2, 0.2)],
        f: ([x, y, z], q) => [(z - q.b) * x - q.d * y, q.d * x + (z - q.b) * y, q.c + q.a * z - z * z * z / 3 - (x * x + y * y) * (1 + q.e * z) + q.f * z * x * x * x] },
      { name: 'THOMAS', h: 0.05, c: [0, 0, 0], s: 1 / 3.6, eq: ['dx/dt = sin y - bx', 'dy/dt = sin z - by', 'dz/dt = sin x - bz'],
        p: (t) => ({ b: 0.2 + Math.sin(t * 0.17) * 0.012 }), init: () => [rand(-1, 1), rand(-1, 1), rand(-1, 1)],
        f: ([x, y, z], q) => [Math.sin(y) - q.b * x, Math.sin(z) - q.b * y, Math.sin(x) - q.b * z] },
      { name: 'HALVORSEN', h: 0.005, c: [-2.5, -2.5, -2.5], s: 1 / 8, eq: ['dx/dt = -ax - 4y - 4z - y^2', 'dy/dt = -ay - 4z - 4x - z^2', 'dz/dt = -az - 4x - 4y - x^2'],
        p: (t) => ({ a: 1.89 + Math.sin(t * 0.11) * 0.04 }), init: () => [rand(-1, 1), rand(-1, 1), rand(-1, 1)],
        f: ([x, y, z], q) => [-q.a * x - 4 * y - 4 * z - y * y, -q.a * y - 4 * z - 4 * x - z * z, -q.a * z - 4 * x - 4 * y - x * x] },
    ];
    let fi = 0, flow = FLOWS[0], swap = 30, q = flow.p(0);
    // trails hold world points; null marks a break where a particle was re-seeded
    const parts = Array.from({ length: NP }, () => ({ p: flow.init(), trail: [] }));
    const world = (p) => [(p[0] - flow.c[0]) * flow.s * R, (p[2] - flow.c[2]) * flow.s * R, (p[1] - flow.c[1]) * flow.s * R]; // z up
    function reseed(pt) { pt.p = flow.init(); pt.trail.push(null); }
    return {
      label: 'STRANGE ATTRACTOR',
      update(dt) {
        swap -= dt;
        if (swap < 0) { swap = 30; fi = (fi + 1) % FLOWS.length; flow = FLOWS[fi]; for (const pt of parts) reseed(pt); }
        q = flow.p(env.t);
        const steps = 2 + Math.round(env.level * 3);
        for (const pt of parts) {
          for (let n = 0; n < steps; n++) {
            for (let sub = 0; sub < 2; sub++) { // midpoint (RK2): Euler wanders off the thinner flows
              const p = pt.p, d1 = flow.f(p, q), h = flow.h, m = [p[0] + d1[0] * h / 2, p[1] + d1[1] * h / 2, p[2] + d1[2] * h / 2], d2 = flow.f(m, q);
              pt.p = [p[0] + d2[0] * h, p[1] + d2[1] * h, p[2] + d2[2] * h];
            }
            if (!pt.p.every((v) => Number.isFinite(v) && Math.abs(v) < 1e3)) reseed(pt);
            pt.trail.push(world(pt.p));
          }
          if (pt.trail.length > TRAIL) pt.trail.splice(0, pt.trail.length - TRAIL);
        }
      },
      draw() {
        const a = env.t * 0.07, d = 60 - env.warp * 10;
        setCam(lookAt({ x: Math.sin(a) * d, y: 10 + Math.sin(env.t * 0.09) * 14, z: Math.cos(a) * d }, 0, 0, 0));
        // plot axes and a floor ring, faint, so the shape has something to sit in
        seg(-R, -R * 0.9, 0, R, -R * 0.9, 0, C.violet, 0.3, FOG); seg(0, -R * 0.9, -R, 0, -R * 0.9, R, C.violet, 0.3, FOG); seg(0, -R * 0.9, 0, 0, R * 0.9, 0, C.violet, 0.2, FOG);
        ring(0, -R * 0.9, 0, R * 1.05, 48, C.violet, 0.3, FOG); ring(0, -R * 0.9, 0, R * 0.6, 36, C.violet, 0.15, FOG);
        parts.forEach((pt, i) => {
          const tr = pt.trail, n = tr.length, col = COLS[i];
          for (let j = 1; j < n; j++) {
            const p = tr[j - 1], c = tr[j]; if (!p || !c) continue;
            seg(p[0], p[1], p[2], c[0], c[1], c[2], col, (j / n) * (0.6 + env.pulse * 0.4), FOG);
          }
          const h = tr[n - 1]; if (h) { seg(h[0] - 0.6, h[1], h[2], h[0] + 0.6, h[1], h[2], C.white, 1, FOG); seg(h[0], h[1] - 0.6, h[2], h[0], h[1] + 0.6, h[2], C.white, 1, FOG); }
        });
        // the margins: what is being drawn, and the numbers driving it
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), lx = 28 * s;
        g.font = `bold ${20 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(flow.name, lx, H * 0.14);
        g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`;
        flow.eq.forEach((e, i) => {
          const parts2 = e.length > 34 ? [e.slice(0, e.indexOf(' - (') + 1), '    ' + e.slice(e.indexOf(' - (') + 1)] : [e];
          parts2.forEach((l, j) => g.fillText(l, lx, H * 0.14 + (34 + i * 40 + j * 17) * s));
        });
        g.fillStyle = `rgba(${C.neon},0.8)`;
        Object.entries(q).forEach(([key, v], i) => g.fillText(`${key} = ${v.toFixed(4)}`, lx, H * 0.14 + (180 + i * 18) * s));
        g.fillStyle = `rgba(${C.violet},0.85)`; g.fillText(`NEXT FLOW IN ${swap.toFixed(1)}s`, lx, H * 0.86);
        const rx = W - 230 * s;
        g.fillStyle = `rgba(${C.ice},0.85)`; g.fillText('PARTICLE   X       Y       Z', rx, H * 0.14);
        parts.forEach((pt, i) => {
          g.fillStyle = `rgba(${COLS[i]},0.85)`;
          g.fillText(`  ${String(i).padStart(2, '0')}  ${pt.p.map((v) => v.toFixed(2).padStart(7)).join(' ')}`, rx - 12 * s, H * 0.14 + (22 + i * 18) * s);
        });
        g.fillStyle = `rgba(${C.gold},0.8)`; g.fillText(`dt = ${flow.h}  RK2`, rx, H * 0.86);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
