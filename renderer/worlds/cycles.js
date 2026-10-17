// LIGHT CYCLES: Tron arena, AI cycles laying light walls on grid lanes until they crash into one.
(function (Worlds) {
  Worlds.define('cycles', (k) => {
    const { C, rand, env, seg, ring, setCam, lookAt } = k;
    const GX = 80, GZ = 36, S = 2, WALL = 3, TRAIL = 150, FOG = 260;
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const occ = new Int8Array(GX * GZ); // 0 free, else owner index + 1
    const wx = (i) => (i - GX / 2 + 0.5) * S, wz = (j) => (j - GZ / 2 + 0.5) * S;
    const blocked = (i, j) => i < 0 || j < 0 || i >= GX || j >= GZ || occ[j * GX + i] !== 0;
    const room = (i, j, d) => { let n = 0; while (n < 10 && !blocked(i + DIRS[d][0] * (n + 1), j + DIRS[d][1] * (n + 1))) n++; return n; };
    const NAMES = ['FLYNN', 'CLU', 'TRON', 'RAM', 'YORI', 'SARK'];
    const cycles = [C.ice, C.hot, C.gold, C.neon, C.violet, C.white].map((col, n) => ({ n, col, name: NAMES[n], crashes: 0, trail: [], dead: 0, ghost: null }));
    let booms = [];

    function spawn(c) {
      for (let tries = 0; tries < 40; tries++) {
        const i = (rand(4, GX - 4)) | 0, j = (rand(4, GZ - 4)) | 0, d = (Math.random() * 4) | 0;
        if (!blocked(i, j) && room(i, j, d) >= 8) { Object.assign(c, { i, j, d, f: 0, trail: [[i, j]], dead: 0 }); occ[j * GX + i] = c.n + 1; return; }
      }
      c.dead = 0.5; // arena too full: try again shortly
    }
    function crash(c) {
      c.crashes++; booms.push({ x: wx(c.i) + DIRS[c.d][0] * S * 0.5, z: wz(c.j) + DIRS[c.d][1] * S * 0.5, col: c.col, t: 0 });
      for (const [i, j] of c.trail) occ[j * GX + i] = 0;
      c.ghost = { trail: c.trail, t: 0 }; c.trail = []; c.dead = 1.6;
    }
    // ponytail: greedy lookahead (free cells ahead per direction), no pathfinding
    function steer(c) {
      const ahead = room(c.i, c.j, c.d);
      if (ahead > 3 && Math.random() > 0.04) return;
      const opts = [(c.d + 1) % 4, (c.d + 3) % 4].map((d) => [d, room(c.i, c.j, d) + Math.random() * 2]);
      opts.sort((a, b) => b[1] - a[1]);
      if (opts[0][1] > ahead + 0.5 || ahead === 0) c.d = opts[0][0];
    }
    function step(c) {
      const ni = c.i + DIRS[c.d][0], nj = c.j + DIRS[c.d][1];
      if (blocked(ni, nj)) return crash(c);
      c.i = ni; c.j = nj; occ[nj * GX + ni] = c.n + 1; c.trail.push([ni, nj]);
      if (c.trail.length > TRAIL) { const [oi, oj] = c.trail.shift(); occ[oj * GX + oi] = 0; }
      steer(c);
    }
    for (const c of cycles) spawn(c);

    // Light wall along cell centres, ending at the head; edges per straight run, struts every 2 cells.
    function wall(pts, col, a, h) {
      if (pts.length < 2) return;
      let s = 0;
      for (let e = 1; e < pts.length; e++) {
        const last = e === pts.length - 1;
        const turn = !last && (Math.sign(pts[e + 1][0] - pts[e][0]) !== Math.sign(pts[e][0] - pts[e - 1][0]) || Math.sign(pts[e + 1][2] - pts[e][2]) !== Math.sign(pts[e][2] - pts[e - 1][2]));
        if (turn || last) {
          const p = pts[s], q = pts[e];
          seg(p[0], 0.05, p[2], q[0], 0.05, q[2], col, a, FOG); seg(p[0], h, p[2], q[0], h, q[2], col, a, FOG);
          s = e;
        }
        if (e % 2 === 0) seg(pts[e][0], 0, pts[e][2], pts[e][0], h, pts[e][2], col, a * 0.45, FOG);
      }
    }
    const pts3 = (trail) => trail.map(([i, j]) => [wx(i), 0, wz(j)]);

    function bike(x, z, d, col) {
      const fx = DIRS[d][0], fz = DIRS[d][1], sx = -fz, sz = fx, L = 1.6, Wd = 0.55, Hh = 0.9;
      const nose = [x + fx * L, 0.35, z + fz * L], tl = [x + sx * Wd, Hh, z + sz * Wd], tr = [x - sx * Wd, Hh, z - sz * Wd];
      const bl = [x + sx * Wd, 0.05, z + sz * Wd], br = [x - sx * Wd, 0.05, z - sz * Wd];
      for (const [p, q] of [[nose, tl], [nose, tr], [nose, bl], [nose, br], [tl, tr], [bl, br], [tl, bl], [tr, br]]) seg(...p, ...q, col, 1, FOG);
      ring(nose[0], nose[1], nose[2], 0.35 + env.pulse * 0.25, 8, C.white, 1, FOG);
    }

    return {
      label: 'LIGHT CYCLES',
      update(dt) {
        const cps = 7 + env.level * 16;
        for (const c of cycles) {
          if (c.ghost && (c.ghost.t += dt) > 1.2) c.ghost = null;
          if (c.dead > 0) { if ((c.dead -= dt) <= 0) spawn(c); continue; }
          c.f += dt * cps;
          while (c.f >= 1 && !c.dead) { c.f -= 1; step(c); }
        }
        for (const b of booms) b.t += dt;
        booms = booms.filter((b) => b.t < 1.2);
      },
      draw() {
        const a = Math.sin(env.t * 0.05) * 0.35;
        setCam(lookAt({ x: Math.sin(a) * 80, y: 46 + Math.sin(env.t * 0.13) * 5, z: -Math.cos(a) * 80 }, 0, 0, 6));
        const X = GX * S / 2, Z = GZ * S / 2;
        for (let x = -X; x <= X; x += S * 2) seg(x, 0, -Z, x, 0, Z, C.ice, 0.16, FOG);
        for (let z = -Z; z <= Z; z += S * 2) seg(-X, 0, z, X, 0, z, C.ice, 0.16, FOG);
        wall([[-X, 0, -Z], [X, 0, -Z], [X, 0, Z], [-X, 0, Z], [-X, 0, -Z]], C.violet, 0.8, 4);
        for (let x = -X; x <= X; x += 8) { seg(x, 0, -Z, x, 4, -Z, C.violet, 0.3, FOG); seg(x, 0, Z, x, 4, Z, C.violet, 0.3, FOG); }
        for (let z = -Z; z <= Z; z += 8) { seg(-X, 0, z, -X, 4, z, C.violet, 0.3, FOG); seg(X, 0, z, X, 4, z, C.violet, 0.3, FOG); }
        for (const c of cycles) {
          if (c.ghost) { const k = c.ghost.t / 1.2; wall(pts3(c.ghost.trail), c.col, 0.8 * (1 - k), WALL * (1 - k)); }
          if (c.dead > 0) continue;
          const hx = wx(c.i) + DIRS[c.d][0] * c.f * S, hz = wz(c.j) + DIRS[c.d][1] * c.f * S;
          const pts = pts3(c.trail); pts.push([hx, 0, hz]);
          wall(pts, c.col, 1, WALL);
          bike(hx, hz, c.d, c.col);
        }
        for (const b of booms) {
          const r = 1 + b.t * 10, al = 1 - b.t / 1.2;
          for (let i = 0; i < 16; i++) {
            const t = i / 16 * Math.PI * 2, up = (i % 4) * 1.2 + b.t * 4;
            seg(b.x + Math.cos(t) * r * 0.3, 0.3, b.z + Math.sin(t) * r * 0.3, b.x + Math.cos(t) * r, up, b.z + Math.sin(t) * r, i % 2 ? b.col : C.white, al, FOG);
          }
          ring(b.x, 0.1, b.z, r * 0.8, 16, b.col, al, FOG);
        }
        const g = k.g; g.font = "14px 'Cascadia Mono', Consolas, monospace";
        g.fillStyle = `rgba(${C.white},0.7)`; g.fillText('DEREZZED', 24, 32);
        cycles.forEach((c, n) => { g.fillStyle = `rgba(${c.col},0.85)`; g.fillText(`${c.name.padEnd(6)}${String(c.crashes).padStart(3)}`, 24, 54 + n * 20); });
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
