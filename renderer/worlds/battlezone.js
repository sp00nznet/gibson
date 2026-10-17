// BATTLEZONE: first person from a vector tank on a black plain: mountains, a volcano, enemy tanks, a radar scope.
(function (Worlds) {
  Worlds.define('battlezone', (k) => {
    const { C, rand, pick, env, seg, line2, box, setCam } = k;
    const TAU = Math.PI * 2, wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const FOG = 240, RANGE = 120;

    // models are lists of local segments, nose +z
    const rect = (w, z0, z1, y) => [[-w, y, z0], [w, y, z0], [w, y, z1], [-w, y, z1]];
    const prism = (S, A, B, skipA) => { for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; if (!skipA) S.push([...A[i], ...A[j]]); S.push([...B[i], ...B[j]], [...A[i], ...B[i]]); } };
    const TANK = [];
    prism(TANK, rect(1.4, -2, 2, 0), rect(1.7, -2.3, 2.7, 0.8));
    prism(TANK, rect(1.7, -2.3, 2.7, 0.8), rect(1.2, -1.8, 1.5, 1.2), true);
    prism(TANK, rect(0.8, -1.3, 0.6, 1.2), rect(0.5, -1, 0.3, 1.9));
    TANK.push([0.12, 1.5, 0.4, 0.12, 1.5, 3.6], [-0.12, 1.5, 0.4, -0.12, 1.5, 3.6], [0.12, 1.5, 3.6, -0.12, 1.5, 3.6], [0, 1.9, -0.8, 0, 2.6, -0.8], [-0.3, 2.6, -0.8, 0.3, 2.6, -0.8]);
    const SAUCER = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, b = (i + 1) / 8 * TAU, P = (r, y, t) => [Math.cos(t) * r, y, Math.sin(t) * r];
      SAUCER.push([...P(2.4, 0, a), ...P(2.4, 0, b)], [...P(1, 0.7, a), ...P(1, 0.7, b)], [...P(1.1, -0.4, a), ...P(1.1, -0.4, b)], [...P(2.4, 0, a), ...P(1, 0.7, a)], [...P(2.4, 0, a), ...P(1.1, -0.4, a)]);
    }
    const place = (S, x, y, z, h) => {
      const c = Math.cos(h), s = Math.sin(h), T = (vx, vy, vz) => [x + vx * c + vz * s, y + vy, z - vx * s + vz * c];
      return S.map((q) => [...T(q[0], q[1], q[2]), ...T(q[3], q[4], q[5])]);
    };

    // the horizon is a ring that travels with the tank, so it only ever turns
    const MR = 260, MN = 96, peaks = Array.from({ length: MN }, (_, i) => 5 + Math.abs(Math.sin(i * 0.37) * 18 + Math.sin(i * 1.3) * 8) + rand(0, 12) * (i % 2));
    const VA = 0.75, VOLC = [[-0.16, 0], [-0.03, 58], [0.03, 58], [0.16, 0]];
    const MOON = VA + 2.2;

    const tank = { x: 0, z: 0, h: 0, tg: null, side: 1, cd: 1 };
    const GUN = 0.68; // ponytail: the gun is offset ~40deg so hits land in the side margins, not behind the terminal
    let foes = [], obs = [], shells = [], frags = [], bursts = [], lava = [], crack = null, respawn = 0, sw = 0, score = 0, recoil = 0;
    const hi = 107000;

    function spawnFoe() {
      const a = rand(0, TAU), d = rand(55, 95);
      return { x: tank.x + Math.sin(a) * d, z: tank.z + Math.cos(a) * d, h: rand(0, TAU), saucer: Math.random() < 0.2, cd: rand(2, 5), y: 0 };
    }
    function spawnOb(d, a) {
      return { x: tank.x + Math.sin(a) * d, z: tank.z + Math.cos(a) * d, kind: pick(['pyr', 'pyr', 'cube']), s: rand(2.5, 6) };
    }
    for (let i = 0; i < 16; i++) obs.push(spawnOb(rand(25, 130), rand(0, TAU)));
    for (let i = 0; i < 3; i++) foes.push(spawnFoe());

    function kill(f) {
      foes = foes.filter((o) => o !== f); score += f.saucer ? 5000 : 1000;
      const c = [f.x, f.y + 1, f.z];
      for (const q of place(f.saucer ? SAUCER : TANK, f.x, f.y, f.z, f.h)) {
        if (Math.random() < 0.4) continue;
        const m = [(q[0] + q[3]) / 2, (q[1] + q[4]) / 2, (q[2] + q[5]) / 2];
        frags.push({ m, d: [(q[3] - q[0]) / 2, (q[4] - q[1]) / 2, (q[5] - q[2]) / 2], v: [(m[0] - c[0]) * rand(3, 8), rand(6, 16), (m[2] - c[2]) * rand(3, 8)], w: rand(-8, 8), t: 0 });
      }
      bursts.push({ x: c[0], y: c[1], z: c[2], t: 0 });
      respawn = rand(1, 3);
    }
    function hitMe() {
      const cx = rand(0.03, 0.14) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0.12 : 0.88), cy = rand(0.25, 0.8), rays = [];
      for (let i = 0; i < 11; i++) {
        let a = i / 11 * TAU + rand(-0.2, 0.2), x = cx, y = cy;
        const n = 2 + (Math.random() * 3 | 0);
        for (let j = 0; j < n; j++) { const l = rand(0.03, 0.09); const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l * 1.7; rays.push([x, y, nx, ny]); x = nx; y = ny; a += rand(-0.5, 0.5); }
      }
      crack = { rays, t: 4 };
    }

    return {
      label: 'BATTLEZONE',
      update(dt) {
        const L = env.level, sp = 0.6 + L * 1.4;
        sw = (sw + dt * (2.5 + L * 3)) % TAU; recoil = Math.max(0, recoil - dt * 4);
        respawn -= dt;
        if (foes.length < 2 + Math.round(L * 3) && respawn <= 0) { foes.push(spawnFoe()); respawn = rand(1, 3); }

        // auto-patrol: swing the gun onto the nearest enemy, fire when it lines up
        if (!foes.includes(tank.tg)) {
          let best = null, bd = 1e9;
          for (const f of foes) { const d = Math.hypot(f.x - tank.x, f.z - tank.z); if (d < bd) { bd = d; best = f; } }
          tank.tg = best;
          if (best) tank.side = Math.sign(wrap(Math.atan2(best.x - tank.x, best.z - tank.z) - tank.h)) || 1;
        }
        tank.cd -= dt * sp;
        const tg = tank.tg;
        if (tg) {
          const want = wrap(Math.atan2(tg.x - tank.x, tg.z - tank.z) - tank.h - tank.side * GUN), turn = (0.5 + L) * dt;
          tank.h += Math.max(-turn, Math.min(turn, want));
          if (Math.abs(want) < 0.03 && tank.cd < 0 && Math.hypot(tg.x - tank.x, tg.z - tank.z) < 110) {
            const a = tank.h + tank.side * GUN;
            shells.push({ x: tank.x + Math.sin(a) * 2, z: tank.z + Math.cos(a) * 2, dx: Math.sin(a), dz: Math.cos(a), v: 110, life: 1.2, mine: true });
            tank.cd = rand(1.2, 2.2); recoil = 1;
          }
        }
        const v = 4 * sp; tank.x += Math.sin(tank.h) * v * dt; tank.z += Math.cos(tank.h) * v * dt;

        for (const f of foes) {
          const dx = tank.x - f.x, dz = tank.z - f.z, d = Math.hypot(dx, dz);
          if (f.saucer) { f.h += dt * 0.7; f.x += Math.sin(f.h) * 7 * sp * dt; f.z += Math.cos(f.h) * 7 * sp * dt; f.y = 2.5 + Math.sin(env.t * 2 + f.cd) * 0.6; continue; }
          const want = wrap(Math.atan2(dx, dz) - f.h);
          f.h += Math.max(-0.5 * sp * dt, Math.min(0.5 * sp * dt, want));
          if (d > 30) { f.x += Math.sin(f.h) * 3 * sp * dt; f.z += Math.cos(f.h) * 3 * sp * dt; }
          f.cd -= dt * sp;
          if (f.cd < 0 && d < 100 && Math.abs(want) < 0.2) {
            shells.push({ x: f.x + Math.sin(f.h) * 3.6, z: f.z + Math.cos(f.h) * 3.6, dx: Math.sin(f.h), dz: Math.cos(f.h), v: 45, life: 3 });
            f.cd = rand(4, 8);
          }
        }
        for (const s of shells) {
          s.x += s.dx * s.v * dt; s.z += s.dz * s.v * dt; s.life -= dt;
          if (s.mine) { const f = foes.find((o) => Math.hypot(o.x - s.x, o.z - s.z) < 2.6); if (f) { kill(f); s.life = 0; } }
          else if (Math.hypot(tank.x - s.x, tank.z - s.z) < 2.5) { s.life = 0; if (Math.random() < 0.5) hitMe(); }
        }
        shells = shells.filter((s) => s.life > 0);
        for (const f of frags) {
          f.t += dt; f.v[1] -= 18 * dt;
          for (let i = 0; i < 3; i++) f.m[i] += f.v[i] * dt;
          if (f.m[1] < 0) { f.m[1] = 0; f.v = f.v.map((x) => x * 0.35); f.v[1] = Math.abs(f.v[1]); f.w *= 0.5; }
        }
        frags = frags.filter((f) => f.t < 2.6);
        for (const b of bursts) b.t += dt;
        bursts = bursts.filter((b) => b.t < 0.6);
        if (crack) { crack.t -= dt; if (crack.t <= 0) crack = null; }
        for (const o of obs) if (Math.hypot(o.x - tank.x, o.z - tank.z) > 140) Object.assign(o, spawnOb(rand(100, 135), tank.h + rand(-1.4, 1.4)));
        if (Math.random() < dt * (5 + L * 25)) lava.push({ u: rand(-2, 2), y: 58, vu: rand(-14, 14), vy: rand(10, 28) });
        for (const p of lava) { p.u += p.vu * dt; p.vy -= 18 * dt; p.y += p.vy * dt; }
        lava = lava.filter((p) => p.y > 25);
      },
      draw() {
        const { x: cx, z: cz } = tank, g = k.g, W = k.W, H = k.H, F = k.F;
        setCam({ x: cx, y: 1.6, z: cz, yaw: tank.h + (crack && crack.t > 3.6 ? rand(-0.02, 0.02) : 0), pitch: -0.012 + recoil * 0.01 });
        const at = (a, r, u, y) => [cx + Math.sin(a) * r + Math.cos(a) * u, y, cz + Math.cos(a) * r - Math.sin(a) * u];
        const sg = (p, q, col, al, fog) => seg(p[0], p[1], p[2], q[0], q[1], q[2], col, al, fog);

        for (let i = 0; i < MN; i++) {
          const a = i / MN * TAU, b = (i + 1) / MN * TAU;
          sg(at(a, MR, 0, peaks[i]), at(b, MR, 0, peaks[(i + 1) % MN]), C.neon, 1, 650);
          sg(at(a, MR, 0, 0), at(b, MR, 0, 0), C.neon, 0.8, 650);
          if (i % 2 && peaks[i] > 12) sg(at(a, MR, 0, peaks[i]), at(a + 0.03, MR, 0, peaks[i] * 0.35), C.neon, 0.5, 650);
        }
        for (let i = 0; i < VOLC.length - 1; i++) sg(at(VA + VOLC[i][0], MR - 5, 0, VOLC[i][1]), at(VA + VOLC[i + 1][0], MR - 5, 0, VOLC[i + 1][1]), C.neon, 1, 650);
        for (const p of lava) sg(at(VA, MR - 6, p.u, p.y), at(VA, MR - 6, p.u - p.vu * 0.06, p.y - p.vy * 0.06), Math.random() < 0.3 ? C.hot : C.neon, 1, 650);
        for (let i = 0; i < 10; i++) { // crescent moon
          const a0 = -Math.PI / 2 + i / 10 * Math.PI, a1 = a0 + Math.PI / 10;
          sg(at(MOON, MR, Math.cos(a0) * 9, 62 + Math.sin(a0) * 9), at(MOON, MR, Math.cos(a1) * 9, 62 + Math.sin(a1) * 9), C.neon, 0.8, 650);
          sg(at(MOON, MR, Math.cos(a0) * 5 + 3, 62 + Math.sin(a0) * 8), at(MOON, MR, Math.cos(a1) * 5 + 3, 62 + Math.sin(a1) * 8), C.neon, 0.8, 650);
        }

        // ground flecks on a fixed world lattice so the plain visibly slides by
        const S = 12, gx = Math.floor(cx / S) * S, gz = Math.floor(cz / S) * S;
        for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
          const x = gx + i * S, z = gz + j * S, hsh = Math.sin(x * 12.9 + z * 78.2) * 43758.5 % 1;
          if (hsh < 0.3) continue;
          seg(x + hsh * 5, 0, z, x + hsh * 5 + 0.8, 0, z, C.neon, 0.45, 80);
        }
        for (const o of obs) {
          if (o.kind === 'cube') { box(o.x, 0, o.z, o.s, o.s, o.s, C.neon, 0.9, FOG); continue; }
          const s = o.s / 2, P = [[o.x - s, o.z - s], [o.x + s, o.z - s], [o.x + s, o.z + s], [o.x - s, o.z + s]];
          for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4]; seg(p[0], 0, p[1], q[0], 0, q[1], C.neon, 0.9, FOG); seg(p[0], 0, p[1], o.x, o.s * 1.2, o.z, C.neon, 0.9, FOG); }
        }
        for (const f of foes) for (const q of place(f.saucer ? SAUCER : TANK, f.x, f.y, f.z, f.saucer ? env.t * 2 : f.h)) seg(...q, f.saucer ? C.ice : C.neon, 1, FOG);
        for (const s of shells) seg(s.x, 1.3, s.z, s.x - s.dx * (s.mine ? 4 : 1.5), 1.3, s.z - s.dz * (s.mine ? 4 : 1.5), C.hot, 1, FOG);
        for (const f of frags) {
          const c = Math.cos(f.w * f.t), s = Math.sin(f.w * f.t), [dx, dy, dz] = f.d;
          const rx = dx * c - dy * s, ry = dx * s + dy * c, al = Math.min(1, (2.6 - f.t) * 1.5);
          seg(f.m[0] - rx, f.m[1] - ry, f.m[2] - dz, f.m[0] + rx, f.m[1] + ry, f.m[2] + dz, f.t < 0.4 ? C.hot : C.neon, al, FOG);
        }
        for (const b of bursts) for (let i = 0; i < 14; i++) {
          const a = i / 14 * TAU, r = 1 + b.t * 14, e = Math.sin(i * 2.3);
          seg(b.x + Math.cos(a) * r * 0.4, b.y + e * r * 0.3, b.z + Math.sin(a) * r * 0.4, b.x + Math.cos(a) * r, b.y + e * r * 0.6, b.z + Math.sin(a) * r, C.hot, 1 - b.t / 0.6, FOG);
        }
        // gun sight on the offset bearing
        const ga = tank.side * GUN, sx = W / 2 + Math.tan(ga) * F, syc = H / 2 + 0.0 * F, sz = 22;
        line2(sx - sz, syc - sz, sx - sz, syc - sz * 0.4, C.neon, 0.8); line2(sx - sz, syc + sz, sx - sz, syc + sz * 0.4, C.neon, 0.8);
        line2(sx + sz, syc - sz, sx + sz, syc - sz * 0.4, C.neon, 0.8); line2(sx + sz, syc + sz, sx + sz, syc + sz * 0.4, C.neon, 0.8);
        line2(sx - sz, syc - sz, sx - sz * 0.5, syc - sz, C.neon, 0.8); line2(sx + sz, syc - sz, sx + sz * 0.5, syc - sz, C.neon, 0.8);
        line2(sx, syc - sz * 1.6, sx, syc - sz * 1.1, C.neon, 0.8);

        // radar scope in the top-left margin, forward is up
        const rx = W * 0.085, ry = H * 0.14, rr = Math.min(W, H) * 0.075;
        for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, b = (i + 1) / 40 * TAU; line2(rx + Math.sin(a) * rr, ry - Math.cos(a) * rr, rx + Math.sin(b) * rr, ry - Math.cos(b) * rr, C.neon, 0.8); }
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; line2(rx + Math.sin(a) * rr, ry - Math.cos(a) * rr, rx + Math.sin(a) * rr * 0.86, ry - Math.cos(a) * rr * 0.86, C.neon, 0.8); }
        const fov = Math.atan(W / 2 / F);
        for (const s of [-1, 1]) line2(rx, ry, rx + Math.sin(fov * s) * rr * 0.3, ry - Math.cos(fov * s) * rr * 0.3, C.neon, 0.6);
        for (let j = 0; j < 6; j++) { const a = sw - j * 0.06; line2(rx, ry, rx + Math.sin(a) * rr, ry - Math.cos(a) * rr, C.neon, 0.9 - j * 0.14); }
        let near = Infinity, off = 0;
        for (const f of foes) {
          const dx = f.x - cx, dz = f.z - cz, d = Math.hypot(dx, dz), b = wrap(Math.atan2(dx, dz) - tank.h);
          if (d < near) { near = d; off = Math.abs(b) > fov ? Math.sign(b) : 0; }
          if (d > RANGE) continue;
          const bx = rx + Math.sin(b) * d / RANGE * rr, by = ry - Math.cos(b) * d / RANGE * rr, age = ((sw - b) % TAU + TAU) % TAU;
          const al = Math.max(0.15, 1 - age / 4);
          line2(bx - 3, by, bx + 3, by, C.neon, al); line2(bx, by - 3, bx, by + 3, C.neon, al);
        }
        g.font = "15px 'Cascadia Mono', Consolas, monospace"; g.textAlign = 'center';
        const msgs = [];
        if (near < 70 && Math.sin(env.t * 8) > -0.3) msgs.push(['ENEMY IN RANGE', C.hot]);
        if (off) msgs.push([off < 0 ? 'ENEMY TO LEFT' : 'ENEMY TO RIGHT', C.hot]);
        msgs.forEach(([s, col], i) => { g.fillStyle = `rgba(${col},0.9)`; g.fillText(s, rx, ry + rr + 26 + i * 20); });
        g.textAlign = 'right'; g.fillStyle = `rgba(${C.neon},0.85)`;
        g.fillText(`SCORE ${String(score).padStart(7, '0')}`, W - 28, 34); g.fillText(`HIGH SCORE ${Math.max(hi, score)}`, W - 28, 56);
        g.textAlign = 'start';
        if (crack) {
          const al = Math.min(1, crack.t);
          for (const r of crack.rays) line2(r[0] * W, r[1] * H, r[2] * W, r[3] * H, C.white, al * 0.9);
        }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
