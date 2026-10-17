// 3D MAZE: the old Windows screensaver in neon: a random maze walked by the right-hand rule,
// stopping to turn at corners, a spinning icosahedron on the way, a new maze at every exit.
(function (Worlds) {
  Worlds.define('maze', (k) => {
    const { C, rand, env, seg, ring, text3, setCam } = k;
    const N = 15, S = 4, WH = 4, EYE = 1.7, FOG = 32;
    const DX = [0, 1, 0, -1], DZ = [1, 0, -1, 0]; // dir 0 = +z, turning right adds 1 (yaw grows toward +x)
    const id = (i, j) => i * N + j, inside = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
    let open, me, ico;

    function build() { // recursive backtracker, iterative
      open = Array.from({ length: N * N }, () => [false, false, false, false]);
      const seen = new Set([0]), stack = [[0, 0]];
      while (stack.length) {
        const [i, j] = stack[stack.length - 1];
        const ds = [0, 1, 2, 3].filter((d) => inside(i + DX[d], j + DZ[d]) && !seen.has(id(i + DX[d], j + DZ[d])));
        if (!ds.length) { stack.pop(); continue; }
        const d = ds[Math.floor(Math.random() * ds.length)], ni = i + DX[d], nj = j + DZ[d];
        open[id(i, j)][d] = open[id(ni, nj)][(d + 2) % 4] = true;
        seen.add(id(ni, nj)); stack.push([ni, nj]);
      }
      me = { i: 0, j: 0, d: open[0][0] ? 0 : 1, yaw: 0, p: 0, turning: false };
      me.yaw = me.d * Math.PI / 2;
      ico = { i: Math.floor(rand(3, N - 3)), j: Math.floor(rand(3, N - 3)) };
    }

    // icosahedron: cyclic permutations of (0, ±1, ±φ); edges join vertices at distance 2
    const P = (1 + Math.sqrt(5)) / 2, IV = [];
    for (const a of [-1, 1]) for (const b of [-P, P]) IV.push([0, a, b], [a, b, 0], [b, 0, a]);
    const IE = [];
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) if (Math.abs(Math.hypot(IV[a][0] - IV[b][0], IV[a][1] - IV[b][1], IV[a][2] - IV[b][2]) - 2) < 0.01) IE.push([a, b]);

    function decide() { // at a cell centre: right, straight, left, back
      const o = open[id(me.i, me.j)];
      for (const t of [1, 0, 3, 2]) if (o[(me.d + t) % 4]) { me.d = (me.d + t) % 4; break; }
      me.turning = true;
    }

    // one wall panel along an edge from (x0,z0) to (x1,z1)
    function panel(x0, z0, x1, z1) {
      const col = C.ice;
      seg(x0, 0, z0, x1, 0, z1, col, 0.9, FOG); seg(x0, WH, z0, x1, WH, z1, col, 0.9, FOG);
      seg(x0, 0, z0, x0, WH, z0, col, 0.9, FOG); seg(x1, 0, z1, x1, WH, z1, col, 0.9, FOG);
      for (let y = 1; y < WH; y += 1) seg(x0, y, z0, x1, y, z1, C.violet, 0.3, FOG);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; // staggered brick joints
      seg(mx, 1, mz, mx, 2, mz, C.violet, 0.3, FOG); seg(mx, 3, mz, mx, 4, mz, C.violet, 0.3, FOG);
    }

    build();
    return {
      label: '3D MAZE',
      enter() { build(); },
      update(dt) {
        if (me.turning) {
          let diff = me.d * Math.PI / 2 - me.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          const step = (2.6 + env.level * 2) * dt;
          if (Math.abs(diff) <= step) { me.yaw = me.d * Math.PI / 2; me.turning = false; } else me.yaw += Math.sign(diff) * step;
          return;
        }
        me.p += (1.3 + env.level * 1.6) * dt;
        if (me.p >= 1) {
          me.p = 0; me.i += DX[me.d]; me.j += DZ[me.d];
          if (me.i === N - 1 && me.j === N - 1) return build();
          decide();
        }
      },
      draw() {
        const x = (me.i + 0.5 + DX[me.d] * me.p) * S, z = (me.j + 0.5 + DZ[me.d] * me.p) * S;
        const bob = Math.sin((me.i + me.j + me.p) * Math.PI * 2) * 0.04;
        setCam({ x, y: EYE + bob, z, yaw: me.yaw, pitch: 0 });
        const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw), L = N * S;
        // floor and ceiling grids, only the lines near us
        for (let n = 0; n <= N; n++) {
          const c = n * S;
          if (Math.abs(c - x) < FOG) { seg(c, 0, 0, c, 0, L, C.hot, 0.45, FOG); seg(c, WH, 0, c, WH, L, C.violet, 0.25, FOG); }
          if (Math.abs(c - z) < FOG) { seg(0, 0, c, L, 0, c, C.hot, 0.45, FOG); seg(0, WH, c, L, WH, c, C.violet, 0.25, FOG); }
        }
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const cx = (i + 0.5) * S - x, cz = (j + 0.5) * S - z;
          if (cx * fx + cz * fz < -S || cx * cx + cz * cz > FOG * FOG) continue; // behind or fogged out
          const o = open[id(i, j)], x0 = i * S, z0 = j * S, x1 = x0 + S, z1 = z0 + S;
          if (!o[0]) panel(x0, z1, x1, z1);
          if (!o[1]) panel(x1, z0, x1, z1);
          if (j === 0) panel(x0, z0, x1, z0); // outer walls not owned by any +z/+x side
          if (i === 0) panel(x0, z0, x0, z1);
        }
        // the exit: a gold portal on the floor
        const ex = (N - 0.5) * S, ez = (N - 0.5) * S;
        ring(ex, 0.05, ez, 1.2 + env.pulse * 0.3, 16, C.gold, 1, FOG);
        if (Math.hypot(ex - x, ez - z) < 12) text3('EXIT', ex - 0.6, WH - 0.6, ez, C.gold, 0.6);
        // the spinning thing
        const ox = (ico.i + 0.5) * S, oz = (ico.j + 0.5) * S, oy = 2 + Math.sin(env.t * 1.3) * 0.25, a = env.t * 1.1, b = env.t * 0.7, r = 0.55 + env.pulse * 0.1;
        const V = IV.map(([vx, vy, vz]) => {
          const x1 = vx * Math.cos(a) - vz * Math.sin(a), z1 = vx * Math.sin(a) + vz * Math.cos(a);
          const y2 = vy * Math.cos(b) - z1 * Math.sin(b), z2 = vy * Math.sin(b) + z1 * Math.cos(b);
          return [ox + x1 * r, oy + y2 * r, oz + z2 * r];
        });
        for (const [p, q] of IE) seg(...V[p], ...V[q], C.neon, 1, FOG);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
