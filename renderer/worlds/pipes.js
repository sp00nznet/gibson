// 3D PIPES: the old Windows screensaver in neon wireframe — pipes snake through a 3D grid until it fills, then it starts over.
(function (Worlds) {
  Worlds.define('pipes', (k) => {
    const { C, rand, pick, env, seg, box, setCam, lookAt } = k;
    const N = [16, 8, 12], S = 6, R = 1.1, CAP = 270, LIVE = 5, FOG = 220, CLEAR = 0.8;
    const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const COLS = [C.neon, C.hot, C.ice, C.gold, C.violet];
    const key = (c) => (c[0] * N[1] + c[1]) * N[2] + c[2];
    const free = (c) => c.every((v, i) => v >= 0 && v < N[i]) && !occ[key(c)];
    const pos = (c) => c.map((v, i) => (v - N[i] / 2 + 0.5) * S);
    const axis = (a, b) => (a[0] !== b[0] ? 0 : a[1] !== b[1] ? 1 : 2);
    let occ, pipes, used, timer, acc, clearing;

    function spawn() {
      for (let t = 0; t < 40; t++) {
        const c = N.map((n) => Math.floor(Math.random() * n));
        if (free(c)) { occ[key(c)] = 1; used++; return { cells: [c], d: pick(DIRS), col: pick(COLS), live: true }; }
      }
      return null;
    }
    function reset() {
      occ = new Uint8Array(N[0] * N[1] * N[2]); pipes = []; used = 0; timer = 0; acc = 0; clearing = 0;
      for (let i = 0; i < LIVE; i++) { const p = spawn(); if (p) pipes.push(p); }
    }
    function step(p) {
      const h = p.cells[p.cells.length - 1], next = (d) => h.map((v, i) => v + d[i]);
      const opts = DIRS.filter((d) => free(next(d)));
      if (!opts.length) { p.live = false; return; }
      if (!opts.includes(p.d) || Math.random() < 0.25) p.d = pick(opts);
      const c = next(p.d); occ[key(c)] = 1; used++; p.cells.push(c);
    }

    // a circle of radius r around point p, in the plane perpendicular to axis ax
    function circ(p, ax, r, n, col, a) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, q0 = p.slice(), q1 = p.slice();
        q0[u] += Math.cos(a0) * r; q0[v] += Math.sin(a0) * r; q1[u] += Math.cos(a1) * r; q1[v] += Math.sin(a1) * r;
        seg(...q0, ...q1, col, a, FOG);
      }
    }
    function tube(p, q, ax, col, a) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3;
      for (let i = 0; i < 6; i++) {
        const o = [0, 0, 0]; o[u] = Math.cos(i / 6 * Math.PI * 2) * R; o[v] = Math.sin(i / 6 * Math.PI * 2) * R;
        seg(p[0] + o[0], p[1] + o[1], p[2] + o[2], q[0] + o[0], q[1] + o[1], q[2] + o[2], col, a, FOG);
      }
    }
    // straight runs are drawn as one tube; turns get a ball joint (two crossed rings)
    function drawPipe(p, a) {
      const cs = p.cells, pts = cs.map(pos), n = pts.length - 1;
      if (p.live && n > 0) pts[n] = pts[n].map((v, i) => pts[n - 1][i] + (v - pts[n - 1][i]) * acc); // the head grows in smoothly
      for (const ax of [0, 1]) circ(pts[0], ax, R * 1.5, 8, p.col, a);
      let s = 0;
      for (let i = 1; i <= n; i++) {
        const ax = axis(cs[i], cs[i - 1]), nx = i < n ? axis(cs[i + 1], cs[i]) : -1;
        if (nx === ax) { if (i % 2 === 0) circ(pts[i], ax, R * 1.25, 6, p.col, a * 0.7); continue; }
        tube(pts[s], pts[i], ax, p.col, a);
        if (nx >= 0) { circ(pts[i], ax, R * 1.5, 8, p.col, a); circ(pts[i], nx, R * 1.5, 8, p.col, a); }
        else circ(pts[i], ax, R * 1.3, 8, C.white, a); // end cap
        s = i;
      }
    }

    reset();
    return {
      label: '3D PIPES',
      enter() { reset(); },
      update(dt) {
        if (clearing > 0) { clearing -= dt; if (clearing <= 0) reset(); return; }
        timer += dt; acc += dt * (5 + env.level * 25);
        while (acc >= 1) {
          acc -= 1;
          for (const p of pipes) if (p.live) step(p);
          const live = pipes.filter((p) => p.live).length;
          for (let i = live; i < LIVE; i++) { const p = spawn(); if (p) pipes.push(p); }
        }
        if (used > CAP || timer > 40) clearing = CLEAR;
      },
      draw() {
        const a = env.t * 0.07;
        setCam(lookAt({ x: Math.sin(a) * 62, y: 16 + Math.sin(env.t * 0.13) * 10, z: Math.cos(a) * 62 }, 0, 0, 0));
        const fade = clearing > 0 ? clearing / CLEAR : Math.min(1, timer * 2);
        box(0, -N[1] * S / 2, 0, N[0] * S, N[1] * S, N[2] * S, clearing > 0 ? C.white : C.violet, clearing > 0 ? 0.3 + fade * 0.7 : 0.25, FOG);
        for (const p of pipes) drawPipe(p, (0.5 + env.pulse * 0.4) * fade + 0.1);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
