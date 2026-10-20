// ROCK FIELD: the rock-splitting arcade game, in 3D. A wireframe ship hunts tumbling jagged rocks
// inside a wrap-around cube (fly out one face, come back through the opposite one); big rocks
// split in two, then two again, then burst into debris. A saucer crosses now and then and shoots
// back. Clear the field and a bigger wave rolls in. The camera circles the cube slowly.
// A failed command: the ship takes a rock and goes up, and the next one launches.
(function (Worlds) {
  Worlds.define('rocks', (k) => {
    const { C, rand, pick, env, seg, line2, setCam, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", TAU = Math.PI * 2, B = 60, FOG = 460, BS = 85;
    const wd = (d) => d - Math.round(d / (2 * B)) * 2 * B; // shortest way round the wrap
    const wrap = (o) => { o.x = wd(o.x); o.y = wd(o.y); o.z = wd(o.z); };

    // --- rocks: a once-split icosphere, every vertex pushed in or out --------------------------
    const PHI = (1 + Math.sqrt(5)) / 2, ICO = [], ICOF = [];
    for (const a of [-1, 1]) for (const b of [-PHI, PHI]) ICO.push([0, a, b], [a, b, 0], [b, 0, a]);
    const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let m = j + 1; m < 12; m++)
      if ([[i, j], [j, m], [i, m]].every(([a, b]) => Math.abs(d2(ICO[a], ICO[b]) - 4) < 0.01)) ICOF.push([i, j, m]);
    function template() {
      const V = ICO.map((p) => { const l = Math.hypot(...p); return p.map((c) => c / l); }), mid = new Map(), F = [];
      const m = (a, b) => { const key = a < b ? a + ',' + b : b + ',' + a; if (!mid.has(key)) { const p = V[a].map((c, i) => c + V[b][i]), l = Math.hypot(...p); mid.set(key, V.push(p.map((c) => c / l)) - 1); } return mid.get(key); };
      for (const [a, b, c] of ICOF) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); F.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      const dents = [0, 1, 2].map(() => { const p = [rand(-1, 1), rand(-1, 1), rand(-1, 1)], l = Math.hypot(...p) || 1; return p.map((c) => c / l); });
      for (const v of V) { let s = rand(0.78, 1.12); for (const d of dents) if (v[0] * d[0] + v[1] * d[1] + v[2] * d[2] > 0.85) s *= 0.75; v[0] *= s; v[1] *= s; v[2] *= s; }
      const faces = F.map(([a, b, c]) => { // normal (outward) and centre, for culling
        const p = V[a], q = V[b], r = V[c], u = q.map((x, i) => x - p[i]), w = r.map((x, i) => x - p[i]);
        let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const ce = [0, 1, 2].map((i) => (p[i] + q[i] + r[i]) / 3);
        if (n[0] * ce[0] + n[1] * ce[1] + n[2] * ce[2] < 0) n = n.map((x) => -x);
        return [n[0], n[1], n[2], n[0] * ce[0] + n[1] * ce[1] + n[2] * ce[2]];
      });
      const em = new Map();
      F.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a; if (em.has(key)) em.get(key)[3] = fi; else em.set(key, [a, b, fi, fi]); }));
      return { v: V, f: faces, e: [...em.values()], vis: new Uint8Array(F.length) };
    }
    const TEMPLATES = Array.from({ length: 6 }, template);

    const ori = (o, yaw, pitch, roll) => { o.cy = Math.cos(yaw); o.sy = Math.sin(yaw); o.cp = Math.cos(pitch); o.sp = Math.sin(pitch); o.cr = Math.cos(roll); o.sr = Math.sin(roll); return o; };
    function fwd(o, x, y, z, out) {
      const a = x * o.cr - y * o.sr, b = x * o.sr + y * o.cr, c = b * o.cp + z * o.sp, d = -b * o.sp + z * o.cp;
      out[0] = a * o.cy + d * o.sy; out[1] = c; out[2] = -a * o.sy + d * o.cy;
    }
    function inv(o, x, y, z, out) {
      const a = x * o.cy - z * o.sy, d = x * o.sy + z * o.cy, b = y * o.cp - d * o.sp;
      out[0] = a * o.cr + b * o.sr; out[1] = -a * o.sr + b * o.cr; out[2] = y * o.sp + d * o.cp;
    }
    const TW = new Float64Array(64 * 3), tv = [0, 0, 0], O = {};
    function place(m, o, r) { for (let i = 0; i < m.v.length; i++) { const v = m.v[i]; fwd(o, v[0], v[1], v[2], tv); TW[i * 3] = r.x + tv[0] * r.r; TW[i * 3 + 1] = r.y + tv[1] * r.r; TW[i * 3 + 2] = r.z + tv[2] * r.r; } }

    // --- the game --------------------------------------------------------------------------------
    let cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, ship = null, rocks = [], bullets = [], debris = [], saucer = null;
    let score = 0, hi = 25000, lives = 3, bonus = 10000, wave = 0, respawn = 1, saucerT = 12, fireT = 0, banner = 0, flash = 0;
    const SIZES = [0, 3.2, 6, 10.5];
    function rock(x, y, z, size, vx, vy, vz) {
      const s = rand(4, 8) * (5 - size) / 2, d = [rand(-1, 1), rand(-1, 1), rand(-1, 1)], l = Math.hypot(...d) || 1;
      rocks.push({ x, y, z, size, r: SIZES[size], m: pick(TEMPLATES), vx: (vx || 0) + d[0] / l * s, vy: (vy || 0) + d[1] / l * s, vz: (vz || 0) + d[2] / l * s,
        a: [rand(0, TAU), rand(0, TAU), rand(0, TAU)], w: [rand(-1, 1), rand(-1, 1), rand(-1, 1)], col: pick([C.ice, C.ice, C.violet]) });
    }
    function newWave() {
      wave++; banner = 3;
      for (let i = Math.min(12, 4 + wave); i > 0; i--) {
        let p; do p = [rand(-B, B), rand(-B, B), rand(-B, B)]; while (ship && Math.hypot(wd(p[0] - ship.x), wd(p[1] - ship.y), wd(p[2] - ship.z)) < 35);
        rock(p[0], p[1], p[2], 3);
      }
    }
    const newShip = () => { ship = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, d: [0, 0, 1], safe: 2.5, thrust: false, roll: 0 }; };
    function burst(x, y, z, n, col, sp) {
      for (let i = 0; i < n && debris.length < 600; i++) { const v = [rand(-1, 1), rand(-1, 1), rand(-1, 1)].map((c) => c * rand(4, sp)), l = rand(0.3, 1.2); debris.push({ a: [x, y, z], b: [x + v[0] * l * 0.1, y + v[1] * l * 0.1, z + v[2] * l * 0.1], va: v, vb: v.map((c) => c * 1.08), t: rand(0.6, 1.6), col }); }
    }
    function shatter(r) { // a small rock comes apart along its own edges
      ori(O, r.a[0], r.a[1], r.a[2]); place(r.m, O, r);
      for (const [i, j] of r.m.e) {
        if (Math.random() < 0.5) continue;
        const mx = (TW[i * 3] + TW[j * 3]) / 2 - r.x, my = (TW[i * 3 + 1] + TW[j * 3 + 1]) / 2 - r.y, mz = (TW[i * 3 + 2] + TW[j * 3 + 2]) / 2 - r.z, s = rand(3, 7);
        const v = [r.vx + mx * s, r.vy + my * s, r.vz + mz * s];
        debris.push({ a: [TW[i * 3], TW[i * 3 + 1], TW[i * 3 + 2]], b: [TW[j * 3], TW[j * 3 + 1], TW[j * 3 + 2]], va: v.map((c) => c + rand(-1.5, 1.5)), vb: v.map((c) => c + rand(-1.5, 1.5)), t: rand(0.8, 1.8), col: r.col });
      }
    }
    function kill() { if (!ship) return; burst(ship.x, ship.y, ship.z, 70, C.gold, 30); burst(ship.x, ship.y, ship.z, 30, C.neon, 18); ship = null; respawn = 2.5; flash = 1; }
    function hitRock(j) {
      const r = rocks[j]; rocks.splice(j, 1); score += [0, 100, 50, 20][r.size];
      if (r.size > 1) { for (let n = 0; n < 2; n++) rock(r.x, r.y, r.z, r.size - 1, r.vx, r.vy, r.vz); burst(r.x, r.y, r.z, 10, r.col, 16); }
      else { shatter(r); burst(r.x, r.y, r.z, 12, C.white, 20); }
    }
    newWave();

    function update(dt) {
      dt *= 1 + env.level * 0.8; banner = Math.max(0, banner - dt); flash = Math.max(0, flash - dt * 2);
      if (ship) { // pilot: lead the nearest target, turn onto it, fire when lined up, back off rocks that come close
        let best = null, bd = Infinity, bx = 0, by = 0, bz = 0;
        for (const t of saucer ? rocks.concat([saucer]) : rocks) {
          const dx = wd(t.x - ship.x), dy = wd(t.y - ship.y), dz = wd(t.z - ship.z), d = Math.hypot(dx, dy, dz) - (t === saucer ? 25 : 0);
          if (d < bd) { bd = d; best = t; bx = dx; by = dy; bz = dz; }
        }
        const s = ship; s.thrust = false; fireT -= dt; s.safe -= dt;
        if (best) {
          const lead = Math.hypot(bx, by, bz) / BS, ax = bx + best.vx * lead, ay = by + best.vy * lead, az = bz + best.vz * lead, al = Math.hypot(ax, ay, az) || 1;
          const want = [ax / al, ay / al, az / al], dot = s.d[0] * want[0] + s.d[1] * want[1] + s.d[2] * want[2], ang = Math.acos(Math.max(-1, Math.min(1, dot)));
          const f = Math.min(1, (3 + env.level * 3) * dt / Math.max(ang, 1e-3)), n = [s.d[0] + (want[0] - s.d[0]) * f, s.d[1] + (want[1] - s.d[1]) * f, s.d[2] + (want[2] - s.d[2]) * f], nl = Math.hypot(...n) || 1;
          const turnRate = (Math.atan2(n[0], n[2]) - Math.atan2(s.d[0], s.d[2]));
          s.d = n.map((c) => c / nl); s.roll += (Math.max(-1, Math.min(1, -Math.atan2(Math.sin(turnRate), Math.cos(turnRate)) / dt * 0.4)) - s.roll) * Math.min(1, dt * 3);
          if (al > 45) { s.thrust = true; s.vx += s.d[0] * 30 * dt; s.vy += s.d[1] * 30 * dt; s.vz += s.d[2] * 30 * dt; }
          if (dot > 0.996 && al < 80 && fireT <= 0) { fireT = 0.2 - env.level * 0.08; bullets.push({ x: s.x + s.d[0] * 3, y: s.y + s.d[1] * 3, z: s.z + s.d[2] * 3, vx: s.vx + s.d[0] * BS, vy: s.vy + s.d[1] * BS, vz: s.vz + s.d[2] * BS, t: 0.95, mine: true }); }
        }
        for (const r of rocks) { // too close: shove away
          const dx = wd(r.x - s.x), dy = wd(r.y - s.y), dz = wd(r.z - s.z), d = Math.hypot(dx, dy, dz) || 1;
          if (d < r.r + 9) { s.vx -= dx / d * 40 * dt; s.vy -= dy / d * 40 * dt; s.vz -= dz / d * 40 * dt; }
          if (s.safe <= 0 && d < r.r * 0.8 + 1.2) { kill(); break; }
        }
        if (ship) { const dr = Math.pow(0.55, dt); s.vx *= dr; s.vy *= dr; s.vz *= dr; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; wrap(s); }
      } else if ((respawn -= dt) <= 0) { newShip(); if (--lives < 0) { hi = Math.max(hi, score); score = 0; lives = 3; bonus = 10000; wave = 0; rocks = []; newWave(); } }
      for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; wrap(r); for (let i = 0; i < 3; i++) r.a[i] += r.w[i] * dt; }
      saucerT -= dt;
      if (!saucer && saucerT <= 0) { const sd = pick([-1, 1]); saucer = { x: -sd * B, y: rand(-B, B) * 0.7, z: rand(-B, B) * 0.7, vx: sd * 16, vy: 0, vz: rand(-4, 4), t: 0, cool: 1.5, y0: 0 }; saucer.y0 = saucer.y; }
      if (saucer) {
        const u = saucer; u.t += dt; u.x += u.vx * dt; u.z += u.vz * dt; u.y = u.y0 + Math.sin(u.t * 1.7) * 6; u.vy = Math.cos(u.t * 1.7) * 10; u.cool -= dt;
        if (u.cool <= 0 && ship) { // it is not a good shot
          u.cool = rand(1.2, 2.2); const dx = wd(ship.x - u.x) + rand(-6, 6), dy = wd(ship.y - u.y) + rand(-6, 6), dz = wd(ship.z - u.z) + rand(-6, 6), l = Math.hypot(dx, dy, dz) || 1;
          bullets.push({ x: u.x, y: u.y, z: u.z, vx: dx / l * 45, vy: dy / l * 45, vz: dz / l * 45, t: 1.6, mine: false });
        }
        if (Math.abs(u.x) > B + 2) { saucer = null; saucerT = rand(10, 18); }
      }
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; wrap(b); b.t -= dt;
        let hit = b.t <= 0;
        if (b.mine) {
          for (let j = rocks.length - 1; j >= 0 && !hit; j--) { const r = rocks[j]; if (Math.hypot(wd(r.x - b.x), wd(r.y - b.y), wd(r.z - b.z)) < r.r) { hit = true; hitRock(j); } }
          if (!hit && saucer && Math.hypot(wd(saucer.x - b.x), wd(saucer.y - b.y), wd(saucer.z - b.z)) < 3.5) { hit = true; burst(saucer.x, saucer.y, saucer.z, 60, C.hot, 26); saucer = null; saucerT = rand(10, 18); score += 1000; }
        } else if (ship && ship.safe <= 0 && Math.hypot(wd(ship.x - b.x), wd(ship.y - b.y), wd(ship.z - b.z)) < 2.2) { hit = true; kill(); }
        if (hit) bullets.splice(i, 1);
      }
      if (!rocks.length) newWave();
      if (score >= bonus) { lives = Math.min(6, lives + 1); bonus += 10000; } // a spare ship every 10000
      for (const d of debris) { d.t -= dt; for (let i = 0; i < 3; i++) { d.a[i] += d.va[i] * dt; d.b[i] += d.vb[i] * dt; } }
      debris = debris.filter((d) => d.t > 0);
    }

    // --- drawing ---------------------------------------------------------------------------------
    const SHIP_V = [[0, 0, 2.2], [-1.5, 0, -1.2], [1.5, 0, -1.2], [0, 0.7, -1.2], [0, -0.25, -0.7], [0, 0, -0.6]];
    const SHIP_E = [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [0, 4], [3, 5], [1, 5], [2, 5]];
    // seven-segment-ish vector digits: segments a b c d e f g on a 1 x 2 cell
    const SEGS = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] };
    const DIG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
    function digits(str, x, y, w, col, a) {
      for (let i = 0; i < str.length; i++) {
        const segs = DIG[str.charCodeAt(i) - 48]; if (!segs) continue; const ox = x + i * w * 1.5;
        for (const s of segs) { const [x1, y1, x2, y2] = SEGS[s]; line2(ox + x1 * w, y + y1 * w, ox + x2 * w, y + y2 * w, col, a); line2(ox + x1 * w + 1, y + y1 * w + 1, ox + x2 * w + 1, y + y2 * w + 1, col, a * 0.5); }
      }
    }
    function draw() {
      const g = k.g, W = k.W, H = k.H, sc = Math.min(W / 1920, H / 1080), t = env.t;
      const ca = t * 0.06, R = 108;
      cam = { x: Math.sin(ca) * R, y: 28 + Math.sin(t * 0.045) * 30, z: Math.cos(ca) * R, yaw: 0, pitch: 0 };
      k.lookAt(cam, ship ? ship.x * 0.25 : 0, ship ? ship.y * 0.25 : 0, ship ? ship.z * 0.25 : 0); setCam(cam);
      // the cube, faintly, its edges in pieces so the fog shades them
      for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
        const p = [a & 1 ? B : -B, a & 2 ? B : -B, a & 4 ? B : -B], q = [b & 1 ? B : -B, b & 2 ? B : -B, b & 4 ? B : -B];
        for (let i = 0; i < 6; i++) { const f0 = i / 6, f1 = (i + 1) / 6; seg(p[0] + (q[0] - p[0]) * f0, p[1] + (q[1] - p[1]) * f0, p[2] + (q[2] - p[2]) * f0, p[0] + (q[0] - p[0]) * f1, p[1] + (q[1] - p[1]) * f1, p[2] + (q[2] - p[2]) * f1, C.violet, 0.5 + env.pulse * 0.2, FOG); }
      }
      for (let i = -B + 20; i < B; i += 20) { seg(i, -B, -B, i, -B, B, C.violet, 0.15, FOG); seg(-B, -B, i, B, -B, i, C.violet, 0.15, FOG); } // floor grid
      for (const r of rocks) {
        ori(O, r.a[0], r.a[1], r.a[2]); const m = r.m;
        inv(O, cam.x - r.x, cam.y - r.y, cam.z - r.z, tv); tv[0] /= r.r; tv[1] /= r.r; tv[2] /= r.r;
        for (let i = 0; i < m.f.length; i++) { const f = m.f[i]; m.vis[i] = f[0] * tv[0] + f[1] * tv[1] + f[2] * tv[2] > f[3] ? 1 : 0; }
        place(m, O, r);
        for (const [i, j, p, q] of m.e) if (m.vis[p] || m.vis[q]) seg(TW[i * 3], TW[i * 3 + 1], TW[i * 3 + 2], TW[j * 3], TW[j * 3 + 1], TW[j * 3 + 2], r.col, r.size === 1 ? 1 : 0.85, FOG);
      }
      if (saucer) {
        const u = saucer, col = C.hot;
        ring(u.x, u.y, u.z, 3.2, 16, col, 1, FOG); ring(u.x, u.y + 0.7, u.z, 1.6, 12, col, 1, FOG); ring(u.x, u.y - 0.6, u.z, 1.8, 12, col, 0.8, FOG);
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + u.t, c = Math.cos(a), s = Math.sin(a); seg(u.x + c * 3.2, u.y, u.z + s * 3.2, u.x + c * 1.6, u.y + 0.7, u.z + s * 1.6, col, 0.8, FOG); seg(u.x + c * 3.2, u.y, u.z + s * 3.2, u.x + c * 1.8, u.y - 0.6, u.z + s * 1.8, col, 0.6, FOG); seg(u.x + c * 1.6, u.y + 0.7, u.z + s * 1.6, u.x, u.y + 1.6, u.z, col, 0.7, FOG); }
      }
      for (const b of bullets) seg(b.x, b.y, b.z, b.x - b.vx * 0.03, b.y - b.vy * 0.03, b.z - b.vz * 0.03, b.mine ? C.gold : C.hot, 1, FOG);
      for (const d of debris) seg(d.a[0], d.a[1], d.a[2], d.b[0], d.b[1], d.b[2], d.col, Math.min(1, d.t), FOG);
      if (ship && (ship.safe <= 0 || ((ship.safe * 8) | 0) % 2)) {
        const s = ship; ori(O, Math.atan2(s.d[0], s.d[2]), Math.asin(Math.max(-1, Math.min(1, s.d[1]))), s.roll);
        const P = SHIP_V.map((v) => { const o = [0, 0, 0]; fwd(O, v[0] * 2.8, v[1] * 2.8, v[2] * 2.8, o); return [s.x + o[0], s.y + o[1], s.z + o[2]]; });
        for (const [i, j] of SHIP_E) seg(P[i][0], P[i][1], P[i][2], P[j][0], P[j][1], P[j][2], C.neon, 1, FOG);
        if (s.thrust && Math.random() < 0.8) { const l = rand(2, 4); seg(P[5][0], P[5][1], P[5][2], P[5][0] - s.d[0] * l, P[5][1] - s.d[1] * l, P[5][2] - s.d[2] * l, C.gold, 1, FOG); }
      }

      // --- left: score, lives, wave ---
      const x0 = W * 0.02, y0 = H * 0.1, txt = (s, x, y, col, a) => { g.fillStyle = `rgba(${col},${a == null ? 0.9 : a})`; g.fillText(s, x, y); };
      g.font = `bold ${13 * sc | 0}px ${MONO}`; txt('PLAYER 1', x0, y0, C.white, 0.6);
      digits(String(score).padStart(6, '0'), x0, y0 + 14 * sc, 26 * sc, C.neon, 1);
      for (let i = 0; i < lives; i++) { const x = x0 + 12 * sc + i * 30 * sc, y = y0 + 100 * sc, s = sc; line2(x, y - 12 * s, x + 8 * s, y + 9 * s, C.neon, 0.9); line2(x + 8 * s, y + 9 * s, x, y + 4 * s, C.neon, 0.9); line2(x, y + 4 * s, x - 8 * s, y + 9 * s, C.neon, 0.9); line2(x - 8 * s, y + 9 * s, x, y - 12 * s, C.neon, 0.9); }
      g.font = `${13 * sc | 0}px ${MONO}`;
      txt('WAVE', x0, y0 + 140 * sc, C.white, 0.6); digits(String(wave).padStart(2, '0'), x0 + 60 * sc, y0 + 126 * sc, 12 * sc, C.gold, 1);
      const n = [0, 0, 0, 0]; for (const r of rocks) n[r.size]++;
      txt(`ROCKS  L ${n[3]}  M ${n[2]}  S ${n[1]}`, x0, y0 + 180 * sc, C.ice, 0.8);
      if (saucer) txt('SAUCER IN THE FIELD', x0, y0 + 204 * sc, C.hot, 0.6 + env.pulse * 0.4);
      if (!ship) txt(lives ? 'SHIP LOST // STAND BY' : 'GAME OVER', x0, y0 + 228 * sc, C.gold, 0.9);
      if (banner > 0) { g.font = `bold ${20 * sc | 0}px ${MONO}`; txt(`WAVE ${wave}`, x0, y0 + 268 * sc, C.gold, Math.min(1, banner)); }
      // --- right: high score, and the field from above ---
      const mx = W * 0.85;
      g.font = `bold ${13 * sc | 0}px ${MONO}`; txt('HIGH SCORE', mx, y0, C.white, 0.6);
      digits(String(Math.max(hi, score)).padStart(6, '0'), mx, y0 + 14 * sc, 18 * sc, C.hot, 0.9);
      const ms = 220 * sc, my = y0 + 110 * sc, f = ms / (2 * B), px = (x) => mx + (x + B) * f, pz = (z) => my + (z + B) * f;
      txt('FIELD // TOP VIEW', mx, my - 10 * sc, C.violet, 0.7);
      line2(mx, my, mx + ms, my, C.violet, 0.7); line2(mx + ms, my, mx + ms, my + ms, C.violet, 0.7); line2(mx + ms, my + ms, mx, my + ms, C.violet, 0.7); line2(mx, my + ms, mx, my, C.violet, 0.7);
      for (const r of rocks) { const x = px(r.x), z = pz(r.z), s = r.size * 1.6 * sc; line2(x - s, z, x + s, z, r.col, 0.9); line2(x, z - s, x, z + s, r.col, 0.9); }
      if (saucer) { const x = px(saucer.x), z = pz(saucer.z); line2(x - 5, z, x + 5, z, C.hot, 1); line2(x - 3, z - 2, x + 3, z - 2, C.hot, 1); }
      if (ship) { const x = px(ship.x), z = pz(ship.z), dx = ship.d[0], dz = ship.d[2], l = Math.hypot(dx, dz) || 1; line2(x, z, x + dx / l * 9 * sc, z + dz / l * 9 * sc, C.neon, 1); line2(x - 2, z, x + 2, z, C.neon, 1); }
      if (flash > 0) for (let i = 0; i < 3; i++) { const m = i * 6; line2(m, m, W - m, m, C.gold, flash); line2(m, H - m, W - m, H - m, C.gold, flash); line2(m, m, m, H - m, C.gold, flash); line2(W - m, m, W - m, H - m, C.gold, flash); }
    }

    return {
      label: 'ROCK FIELD',
      update,
      draw,
      signal(kind) { if (kind === 'error' && ship) kill(); },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
