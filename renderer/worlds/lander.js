// LUNAR LANDER: a vector-style moon landing that flies itself. Jagged heightfield terrain with
// craters and a few flat pads (the small ones pay more), Earth hanging over the horizon, and an
// autopilot that picks a pad, kills its speed and sets down, or runs dry / comes in hot and makes
// a new crater. Your activity makes the pilot bolder; a failed command makes the engine sputter.
(function (Worlds) {
  Worlds.define('lander', (k) => {
    const { C, rand, pick, env, seg, ring, setCam, lookAt, line2, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", N = 33, S = 8, HALF = (N - 1) * S / 2, FOG = 270;
    const G = 1.62, AMAX = 4.4, BURN = 0.42, GREY = '160,175,215';

    // --- the terrain: a heightfield, craters pressed in, pads flattened ----------------------
    const hf = new Float32Array(N * N);
    let craters = [], pads = [], scorch = [];
    const vx = (i) => -HALF + i * S;
    function build() {
      const p = [rand(0, 9), rand(0, 9), rand(0, 9)];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = vx(i), z = vx(j), r = Math.max(Math.abs(x), Math.abs(z)) / HALF;
        hf[j * N + i] = 7 * Math.sin(x * 0.031 + p[0]) * Math.cos(z * 0.027 + p[1]) + 4 * Math.sin(x * 0.07 + z * 0.05 + p[2]) + rand(-1.8, 1.8) + Math.max(0, r - 0.55) ** 2 * 140;
      }
      craters = Array.from({ length: 7 }, () => ({ x: rand(-100, 100), z: rand(-100, 100), r: rand(7, 20) }));
      for (const c of craters) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const d = Math.hypot(vx(i) - c.x, vx(j) - c.z), dep = c.r * 0.3;
        if (d < c.r) hf[j * N + i] -= dep * (1 - (d / c.r) ** 2);
        hf[j * N + i] += dep * 0.45 * Math.exp(-(((d - c.r) / (c.r * 0.25)) ** 2)); // the rim
      }
      pads = [];
      for (const [mult, w] of [[2, 2], [3, 1], [5, 1]]) {
        let ci, cj, n = 0;
        do { ci = 7 + Math.floor(Math.random() * (N - 14)); cj = 7 + Math.floor(Math.random() * (N - 14)); n++; }
        while (n < 50 && pads.some((q) => Math.abs(q.i - ci) < 6 && Math.abs(q.j - cj) < 6));
        let sum = 0, cnt = 0;
        for (let j = cj - w; j <= cj + w; j++) for (let i = ci - w; i <= ci + w; i++) { sum += hf[j * N + i]; cnt++; }
        const y = sum / cnt + (mult === 5 ? 4 : 0); // the x5 sits up on a little mesa
        for (let j = cj - w; j <= cj + w; j++) for (let i = ci - w; i <= ci + w; i++) hf[j * N + i] = y;
        pads.push({ i: ci, j: cj, w, mult, x: vx(ci), z: vx(cj), y, half: w * S });
      }
      scorch = [];
    }
    function ground(x, z) {
      const fx = Math.max(0, Math.min(N - 1.001, (x + HALF) / S)), fz = Math.max(0, Math.min(N - 1.001, (z + HALF) / S));
      const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, a = hf[j * N + i], b = hf[j * N + i + 1], c = hf[(j + 1) * N + i], d = hf[(j + 1) * N + i + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    const ridge = Array.from({ length: 72 }, (_, i) => 14 + Math.abs(Math.sin(i * 1.7)) * 22 + rand(0, 14) * (i % 3 === 0));

    // --- the lander, as local edges (y up from the footpads), each with a colour -------------
    const E = [];
    const L = (a, b, col) => E.push([a[0], a[1], a[2], b[0], b[1], b[2], col]);
    const oct = (r, y) => Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4 + Math.PI / 8) * r, y, Math.sin(i * Math.PI / 4 + Math.PI / 8) * r]);
    const lo = oct(2.1, 1.3), hi = oct(2.1, 2.9);
    for (let i = 0; i < 8; i++) { L(lo[i], lo[(i + 1) % 8], C.gold); L(hi[i], hi[(i + 1) % 8], C.gold); L(lo[i], hi[i], C.gold); }
    L(lo[0], hi[1], C.gold); L(lo[4], hi[5], C.gold); // foil crumple
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a), foot = [c * 4.1, 0.3, s * 4.1];
      L([c * 1.9, 2.7, s * 1.9], foot, C.white); L([c * 1.9, 1.4, s * 1.9], [c * 3.1, 1.0, s * 3.1], C.white);
      L([foot[0] - 0.5, 0, foot[2] - 0.5], [foot[0] + 0.5, 0, foot[2] + 0.5], C.white); L([foot[0] - 0.5, 0, foot[2] + 0.5], [foot[0] + 0.5, 0, foot[2] - 0.5], C.white);
      L(foot, [foot[0], 0, foot[2]], C.white);
    }
    L([-3.5, 1.5, 0], [-2.1, 1.6, 0], C.white); // the ladder porch
    const ab = [[-1.6, 2.9, -1.3], [1.6, 2.9, -1.3], [1.6, 2.9, 1.3], [-1.6, 2.9, 1.3]], at = [[-1.1, 5.0, -0.9], [1.1, 5.0, -0.9], [1.3, 4.6, 1.1], [-1.3, 4.6, 1.1]];
    for (let i = 0; i < 4; i++) { L(ab[i], ab[(i + 1) % 4], C.white); L(at[i], at[(i + 1) % 4], C.white); L(ab[i], at[i], C.white); }
    L([-0.9, 3.4, 1.3], [0, 4.4, 1.25], C.ice); L([0, 4.4, 1.25], [0.9, 3.4, 1.3], C.ice); L([0.9, 3.4, 1.3], [-0.9, 3.4, 1.3], C.ice); // the window
    L([0.6, 5.0, -0.5], [0.6, 6.4, -0.5], C.white); L([0.2, 6.4, -0.5], [1.0, 6.4, -0.5], C.white); // antenna
    const nz0 = oct(0.5, 1.3), nz1 = oct(0.95, 0.45);
    for (let i = 0; i < 8; i += 2) { L(nz0[i], nz1[i], C.white); L(nz1[i], nz1[(i + 2) % 8], C.white); }
    const NE = E.length;

    // --- flight ------------------------------------------------------------------------------
    const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ux: 0, uy: 1, uz: 0, thr: 0, fuel: 100 };
    let state = 'fly', stateT = 0, pad, pilot, score = 0, descents = 0, landings = 0, crashes = 0;
    let sputter = 0, leak = 0, debris = [], flash = null, dust = [], feed = [], called = {}, result = '';
    const camE = { x: 0, y: 60, z: -60 }, camL = { x: 0, y: 0, z: 0 };
    let camYaw = 0, camPitch = -0.3, baseYaw = 0;
    const say = (s, col) => { feed.push({ s, t: 7, col: col || C.white }); if (feed.length > 6) feed.shift(); };
    function descent() {
      if (!pads.length || Math.random() < 0.5) build();
      pad = Math.random() < 0.5 ? pads[0] : pick(pads);
      const a = rand(0, Math.PI * 2), d = rand(60, 95);
      me.x = Math.max(-HALF + 10, Math.min(HALF - 10, pad.x + Math.cos(a) * d)); me.z = Math.max(-HALF + 10, Math.min(HALF - 10, pad.z + Math.sin(a) * d));
      me.y = pad.y + rand(85, 115);
      const dx = pad.x - me.x, dz = pad.z - me.z, dl = Math.hypot(dx, dz) || 1, v0 = rand(5, 9);
      me.vx = dx / dl * v0; me.vz = dz / dl * v0; me.vy = rand(-3, -1); me.ux = 0; me.uy = 1; me.uz = 0; me.thr = 0;
      pilot = { agg: Math.random() < 0.14 ? rand(0.85, 1.1) : rand(0, 0.3) };
      me.fuel = Math.random() < 0.18 ? rand(26, 38) : rand(78, 100);
      state = 'fly'; stateT = 0; sputter = 0; leak = 0; debris = []; called = {}; result = ''; descents++;
      baseYaw = Math.atan2(dx, dz) + rand(-0.4, 0.4);
      Object.assign(camE, { x: me.x - Math.sin(baseYaw) * 70, y: me.y + 40, z: me.z - Math.cos(baseYaw) * 70 });
      Object.assign(camL, { x: me.x, y: me.y, z: me.z });
      say(`DESCENT ${descents}  TARGET PAD x${pad.mult}`, C.gold);
    }
    const toWorld = (lx, ly, lz) => { // local -> world, leaning along the thrust vector
      let rx = me.uy, ry = -me.ux; const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl; // right = up x z
      const fx = ry * me.uz, fy = -rx * me.uz, fz = rx * me.uy - ry * me.ux; // forward = right x up
      return [me.x + rx * lx + me.ux * ly + fx * lz, me.y + ry * lx + me.uy * ly + fy * lz, me.z + me.uz * ly + fz * lz];
    };
    function crash(why) {
      state = 'crashed'; stateT = 0; crashes++; result = why;
      for (let i = 0; i < NE; i++) {
        const e = E[i], a = toWorld(e[0], e[1], e[2]), b = toWorld(e[3], e[4], e[5]);
        debris.push({ m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], h: [(b[0] - a[0]) / 2, (b[1] - a[1]) / 2, (b[2] - a[2]) / 2], v: [rand(-9, 9) + me.vx * 0.4, rand(3, 16), rand(-9, 9) + me.vz * 0.4], w: rand(-6, 6), col: e[6] });
      }
      flash = { x: me.x, y: ground(me.x, me.z) + 0.3, z: me.z, t: 0 };
      scorch.push([me.x, me.z, rand(5, 8)]);
      say(why, C.hot);
    }
    function touch(gy) {
      const hs = Math.hypot(me.vx, me.vz), vs = -me.vy;
      const on = pads.find((p) => Math.abs(me.x - p.x) < p.half - 1 && Math.abs(me.z - p.z) < p.half - 1);
      let lo = Infinity, hi = -Infinity;
      for (const [fx, fz] of [[2.9, 2.9], [-2.9, 2.9], [2.9, -2.9], [-2.9, -2.9]]) { const h = ground(me.x + fx, me.z + fz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      me.y = gy;
      if (vs > 2.5) return crash(`IMPACT ${vs.toFixed(1)} M/S`);
      if (hs > 1.8) return crash(`SKIDDED AT ${hs.toFixed(1)} M/S`);
      if (hi - lo > 1.6) return crash('TIPPED OVER');
      const pts = on ? 50 * on.mult + Math.round(me.fuel) : 15;
      score += pts; landings++; state = 'landed'; stateT = 0; me.vx = me.vy = me.vz = 0; me.thr = 0;
      result = on ? `LANDED ON x${on.mult}  +${pts}` : `LANDED OFF PAD  +${pts}`;
      say('CONTACT LIGHT', C.neon); say('ENGINE STOP', C.white); say(result, C.gold);
    }

    build(); descent();

    return {
      label: 'LUNAR LANDER',
      update(dt0) {
        const dt = dt0 * (1 + env.level * 1.2);
        stateT += dt; sputter = Math.max(0, sputter - dt);
        for (const f of feed) f.t -= dt0;
        for (const p of debris) {
          p.v[1] -= G * 2 * dt; p.m[0] += p.v[0] * dt; p.m[1] += p.v[1] * dt; p.m[2] += p.v[2] * dt;
          const c = Math.cos(p.w * dt), s = Math.sin(p.w * dt), hx = p.h[0], hy = p.h[1]; p.h[0] = hx * c - hy * s; p.h[1] = hx * s + hy * c;
          const gy = ground(p.m[0], p.m[2]) + 0.2; if (p.m[1] < gy) { p.m[1] = gy; p.v[1] *= -0.3; p.v[0] *= 0.5; p.v[2] *= 0.5; p.w *= 0.5; }
        }
        if (flash) { flash.t += dt0; if (flash.t > 2.5) flash = null; }
        for (const d of dust) { d.r += d.v * dt; d.t -= dt; }
        dust = dust.filter((d) => d.t > 0);
        if (state !== 'fly') { if (stateT > (state === 'landed' ? 9 : 8)) descent(); return; }

        const gy = ground(me.x, me.z), alt = me.y - gy, pa = me.y - pad.y;
        const dx = pad.x - me.x, dz = pad.z - me.z, dist = Math.hypot(dx, dz), agg = pilot.agg + env.level * 0.3;
        const kh = 0.07, hmax = 9 * (1 + agg * 0.6); // ease over to the pad
        let wx = dx * kh, wz = dz * kh; const wl = Math.hypot(wx, wz); if (wl > hmax) { wx *= hmax / wl; wz *= hmax / wl; }
        let wy;
        if (dist > 5) { wy = Math.max(-4.5 * (1 + agg), Math.min(2, (10 + dist * 0.5 - pa) * 0.15)); if (alt < 12) wy = Math.max(wy, 1.5); } // glide slope, clear the ridges
        else wy = -Math.max(0.8 + agg * 2.6, Math.min(6, pa * 0.12)); // the last few metres
        let ax = (wx - me.vx) * 0.5, az = (wz - me.vz) * 0.5, ay = Math.max(0, (wy - me.vy) * 0.9 + G);
        const ah = Math.hypot(ax, az), lim = ay * 0.7 + 0.2; if (ah > lim) { ax *= lim / ah; az *= lim / ah; }
        let am = Math.hypot(ax, ay, az); if (am > AMAX) { ax *= AMAX / am; ay *= AMAX / am; az *= AMAX / am; am = AMAX; }
        if (sputter > 0 && Math.sin(env.t * 37) + Math.sin(env.t * 23) > 0) { ax *= 0.1; ay *= 0.1; az *= 0.1; am *= 0.1; }
        if (me.fuel <= 0) { ax = ay = az = am = 0; if (!called.dry) { called.dry = 1; say('FUEL DEPLETED', C.hot); } }
        me.fuel = Math.max(0, me.fuel - am * BURN * dt - leak * dt);
        me.thr = am / AMAX;
        me.vx += ax * dt; me.vy += (ay - G) * dt; me.vz += az * dt;
        me.x += me.vx * dt; me.y += me.vy * dt; me.z += me.vz * dt;
        if (am > 0.3) { const r = Math.min(1, dt * 2); me.ux += (ax / am - me.ux) * r; me.uy += (ay / am - me.uy) * r; me.uz += (az / am - me.uz) * r; }
        else { const r = Math.min(1, dt); me.ux -= me.ux * r; me.uy += (1 - me.uy) * r; me.uz -= me.uz * r; }
        const ul = Math.hypot(me.ux, me.uy, me.uz); me.ux /= ul; me.uy /= ul; me.uz /= ul;
        if (alt < 14 && am > 1 && Math.random() < dt * 25) dust.push({ x: me.x, z: me.z, y: gy, a: rand(0, 6.28), r: 1, v: rand(8, 18), t: rand(0.4, 1) });
        if (alt < 45 && !called.low) { called.low = 1; say('LOW GATE  PITCHOVER', C.ice); }
        if (me.fuel < 15 && me.fuel > 0 && !called.fuel) { called.fuel = 1; say('LOW FUEL', C.hot); }
        if (alt <= 0) touch(gy);
      },
      signal(kind) {
        if (kind !== 'error' || state !== 'fly') return;
        sputter = 3; leak += 1.5; me.fuel = Math.max(0, me.fuel - 12);
        say('ENGINE SPUTTER  FUEL LEAK', C.hot);
      },
      draw() {
        const t = env.t, cx = state === 'crashed' && flash ? flash.x : me.x, cz = state === 'crashed' && flash ? flash.z : me.z;
        // the camera: high and wide while we are up, settling in as we come down, drifting round
        const alt = Math.max(0, me.y - ground(me.x, me.z)), yaw = baseYaw + Math.sin(t * 0.045) * 0.45;
        const D = 32 + alt * 0.3, ch = 9 + alt * 0.4;
        const ex = me.x - Math.sin(yaw) * D, ez = me.z - Math.cos(yaw) * D, ey = Math.max(me.y + ch, ground(ex, ez) + 8);
        const r = 0.02;
        camE.x += (ex - camE.x) * r; camE.y += (ey - camE.y) * r; camE.z += (ez - camE.z) * r;
        camL.x += (cx - camL.x) * 0.08; camL.y += (me.y + 2 - camL.y) * 0.08; camL.z += (cz - camL.z) * 0.08;
        const cam = lookAt({ x: camE.x, y: camE.y, z: camE.z, roll: Math.sin(t * 0.07) * 0.03 }, camL.x, camL.y, camL.z);
        camYaw = cam.yaw; camPitch = cam.pitch; setCam(cam);

        // far off: the ridge line and Earth (pinned near the top right, it is a long way away)
        for (let i = 0; i < ridge.length; i++) {
          const a0 = i / ridge.length * Math.PI * 2, a1 = (i + 1) / ridge.length * Math.PI * 2, R = 700;
          seg(camE.x + Math.sin(a0) * R, ridge[i] - 10, camE.z + Math.cos(a0) * R, camE.x + Math.sin(a1) * R, ridge[(i + 1) % ridge.length] - 10, camE.z + Math.cos(a1) * R, GREY, 0.5, 2000);
        }
        const ey2 = camYaw + 0.62, ep = camPitch + 0.3, ED = 900, ER = 52;
        const ox = camE.x + Math.sin(ey2) * Math.cos(ep) * ED, oy = camE.y + Math.sin(ep) * ED, oz = camE.z + Math.cos(ey2) * Math.cos(ep) * ED, spin = t * 0.05;
        for (let la = -2; la <= 2; la++) { const yy = Math.sin(la * 0.5) * ER; ring(ox, oy + yy, oz, Math.cos(la * 0.5) * ER, 20, C.ice, la ? 0.45 : 0.7, 2000); }
        for (let m = 0; m < 6; m++) { // meridians, turning
          const a = m * Math.PI / 6 + spin;
          for (let i = 0; i < 12; i++) {
            const b0 = -Math.PI / 2 + i / 12 * Math.PI, b1 = b0 + Math.PI / 12;
            seg(ox + Math.cos(b0) * Math.cos(a) * ER, oy + Math.sin(b0) * ER, oz + Math.cos(b0) * Math.sin(a) * ER, ox + Math.cos(b1) * Math.cos(a) * ER, oy + Math.sin(b1) * ER, oz + Math.cos(b1) * Math.sin(a) * ER, C.neon, 0.35, 2000);
          }
        }
        // the terrain
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const x = vx(i), z = vx(j);
          if (Math.abs(x - camE.x) > FOG + S || Math.abs(z - camE.z) > FOG + S) continue;
          const h = hf[j * N + i];
          if (i < N - 1) seg(x, h, z, x + S, hf[j * N + i + 1], z, GREY, 0.7, FOG);
          if (j < N - 1) seg(x, h, z, x, hf[(j + 1) * N + i], z + S, GREY, 0.7, FOG);
        }
        const rim = (x, z, r, n, col, a) => { // a ring laid on the ground
          let px = x + r, pz = z, py = ground(px, pz) + 0.2;
          for (let i = 1; i <= n; i++) { const q = i / n * Math.PI * 2, nx = x + Math.cos(q) * r, nz = z + Math.sin(q) * r, ny = ground(nx, nz) + 0.2; seg(px, py, pz, nx, ny, nz, col, a, FOG); px = nx; py = ny; pz = nz; }
        };
        for (const c of craters) { rim(c.x, c.z, c.r, 18, C.white, 0.5); rim(c.x, c.z, c.r * 0.6, 12, GREY, 0.3); }
        for (const [x, z, r] of scorch) rim(x, z, r, 12, C.hot, 0.5);
        for (const p of pads) {
          const h = p.half, y = p.y + 0.15, lit = p === pad && state === 'fly' ? 0.7 + env.pulse * 0.3 : 0.6;
          seg(p.x - h, y, p.z - h, p.x + h, y, p.z - h, C.gold, lit, FOG); seg(p.x + h, y, p.z - h, p.x + h, y, p.z + h, C.gold, lit, FOG);
          seg(p.x + h, y, p.z + h, p.x - h, y, p.z + h, C.gold, lit, FOG); seg(p.x - h, y, p.z + h, p.x - h, y, p.z - h, C.gold, lit, FOG);
          seg(p.x - h * 0.4, y, p.z, p.x + h * 0.4, y, p.z, C.gold, lit, FOG); seg(p.x, y, p.z - h * 0.4, p.x, y, p.z + h * 0.4, C.gold, lit, FOG);
          text3(`x${p.mult}`, p.x - 2, y + 4, p.z, C.gold, 2.2, 0.9);
        }
        for (const d of dust) seg(d.x + Math.cos(d.a) * d.r, d.y + 0.3, d.z + Math.sin(d.a) * d.r, d.x + Math.cos(d.a) * (d.r + 2), d.y + 0.3, d.z + Math.sin(d.a) * (d.r + 2), GREY, d.t, FOG);

        // the lander, its flame, or what is left of it
        if (state !== 'crashed') {
          for (let i = 0; i < NE; i++) { const e = E[i], a = toWorld(e[0], e[1], e[2]), b = toWorld(e[3], e[4], e[5]); seg(a[0], a[1], a[2], b[0], b[1], b[2], e[6], 1, FOG); }
          if (me.thr > 0.02) {
            const len = 1 + me.thr * 6 * (0.7 + Math.random() * 0.6), tip = toWorld(rand(-0.2, 0.2), 0.45 - len, rand(-0.2, 0.2));
            for (let i = 0; i < 8; i += 2) { const p = toWorld(nz1[i][0], 0.45, nz1[i][2]); seg(p[0], p[1], p[2], tip[0], tip[1], tip[2], i % 4 ? C.gold : C.hot, 0.9, FOG); }
            const core = toWorld(0, 0.45 - len * 0.6, 0), top = toWorld(0, 0.6, 0); seg(top[0], top[1], top[2], core[0], core[1], core[2], C.white, 0.9, FOG);
          }
        } else for (const p of debris) seg(p.m[0] - p.h[0], p.m[1] - p.h[1], p.m[2] - p.h[2], p.m[0] + p.h[0], p.m[1] + p.h[1], p.m[2] + p.h[2], p.col, Math.max(0.3, 1 - stateT / 8), FOG);
        if (flash) {
          const q = flash.t / 2.5;
          rim(flash.x, flash.z, 2 + q * 34, 24, C.hot, 1 - q); rim(flash.x, flash.z, 1 + q * 18, 16, C.gold, 1 - q);
          for (let i = 0; i < 10; i++) { const a = i * 0.628; seg(flash.x, flash.y, flash.z, flash.x + Math.cos(a) * 14 * q, flash.y + 10 * q * (1 - q) * 4, flash.z + Math.sin(a) * 14 * q, C.white, 1 - q, FOG); }
        }

        // HUD, in the margins
        const g = k.g, W = k.W, H = k.H, sc = Math.min(W / 1920, H / 1080), x0 = W * 0.02, y0 = H * 0.12;
        const hs = Math.hypot(me.vx, me.vz);
        g.font = `bold ${16 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText('LUNAR LANDER', x0, y0);
        g.font = `${13 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText(`DESCENT ${descents}   PAD x${pad.mult}`, x0, y0 + 24 * sc);
        const rows = [['ALTITUDE', `${alt.toFixed(0)} M`, C.white], ['HORIZ SPD', `${hs.toFixed(1)} M/S`, hs > 1.8 && alt < 10 ? C.hot : C.ice], ['VERT SPD', `${(-me.vy).toFixed(1)} M/S ${me.vy < -0.1 ? 'v' : me.vy > 0.1 ? '^' : ' '}`, -me.vy > 2.5 && alt < 15 ? C.hot : C.ice], ['THRUST', `${Math.round(me.thr * 100)} %`, C.gold]];
        rows.forEach(([a, b, col], i) => { const y = y0 + (60 + i * 30) * sc; g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.55)`; g.fillText(a, x0, y); g.font = `bold ${20 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${col},0.95)`; g.fillText(b, x0 + 110 * sc, y + 2 * sc); });
        const fy = y0 + 200 * sc, fw = 230 * sc, fl = me.fuel / 100, low = me.fuel < 15 && Math.sin(t * 8) > 0;
        g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.55)`; g.fillText(`FUEL ${me.fuel.toFixed(0)}%`, x0, fy);
        for (let i = 0; i < 6; i++) line2(x0, fy + (8 + i) * sc, x0 + fw * fl, fy + (8 + i) * sc, me.fuel < 15 ? C.hot : C.neon, low ? 0.4 : 0.9);
        line2(x0, fy + 6 * sc, x0 + fw, fy + 6 * sc, C.white, 0.4); line2(x0, fy + 16 * sc, x0 + fw, fy + 16 * sc, C.white, 0.4); line2(x0 + fw, fy + 6 * sc, x0 + fw, fy + 16 * sc, C.white, 0.4);
        g.font = `bold ${30 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(String(score).padStart(5, '0'), x0, fy + 62 * sc);
        g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.55)`; g.fillText(`SCORE   LANDED ${landings}  LOST ${crashes}`, x0, fy + 80 * sc);
        g.font = `${13 * sc | 0}px ${MONO}`;
        feed.forEach((f, i) => { if (f.t > 0) { g.fillStyle = `rgba(${f.col},${Math.min(1, f.t)})`; g.fillText(f.s, x0, fy + (120 + i * 20) * sc); } });
        if (state !== 'fly') {
          const ok = state === 'landed', blink = Math.sin(t * 5) > -0.3;
          g.font = `bold ${22 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${ok ? C.neon : C.hot},${blink ? 0.95 : 0.4})`;
          g.fillText(ok ? 'CONTACT LIGHT' : 'SIGNAL LOST', x0, fy + 270 * sc);
          g.font = `bold ${16 * sc | 0}px ${MONO}`; g.fillText(result, x0, fy + 296 * sc);
        }
        if (sputter > 0) { g.font = `bold ${16 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},${Math.sin(t * 20) > 0 ? 1 : 0.3})`; g.fillText('MASTER ALARM', x0, fy + 330 * sc); }
        // right margin: the terrain profile from here to the pad, and a top-down scope
        const rx = W * 0.86, ry = H * 0.36, rw = 220 * sc, rh = 90 * sc;
        g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText('TERRAIN PROFILE', rx, ry - 8 * sc);
        const ux = (pad.x - me.x), uz = (pad.z - me.z), ud = Math.hypot(ux, uz) || 1, span = Math.max(60, ud + 30);
        const px = (u) => rx + (u / span) * rw, py = (h) => ry + rh - Math.max(0, Math.min(1, (h - pad.y + 20) / 140)) * rh;
        let ph = null;
        for (let i = 0; i <= 40; i++) { const u = i / 40 * span, h = ground(me.x + ux / ud * u, me.z + uz / ud * u); if (ph != null) line2(px((i - 1) / 40 * span), ph, px(u), py(h), C.ice, 0.8); ph = py(h); }
        line2(px(ud - pad.half), py(pad.y) - 2, px(ud + pad.half), py(pad.y) - 2, C.gold, 1);
        const ly = py(me.y); line2(px(0) - 4, ly, px(0) + 4, ly, C.neon, 1); line2(px(0), ly - 4, px(0), ly + 4, C.neon, 1);
        const sx = rx + rw / 2, sy = ry + rh + 110 * sc, sr = 80 * sc, ss = sr / 110;
        for (const rr of [0.33, 0.66, 1]) for (let i = 0; i < 24; i++) { const a0 = i / 24 * 6.283, a1 = (i + 1) / 24 * 6.283; line2(sx + Math.cos(a0) * sr * rr, sy + Math.sin(a0) * sr * rr, sx + Math.cos(a1) * sr * rr, sy + Math.sin(a1) * sr * rr, C.neon, 0.35); }
        const sw = t * 1.3; line2(sx, sy, sx + Math.cos(sw) * sr, sy + Math.sin(sw) * sr, C.neon, 0.8);
        for (const p of pads) { const qx = (p.x - me.x) * ss, qz = -(p.z - me.z) * ss; if (Math.hypot(qx, qz) < sr) { line2(sx + qx - 3, sy + qz, sx + qx + 3, sy + qz, C.gold, 1); g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(`x${p.mult}`, sx + qx + 5, sy + qz + 4); } }
        line2(sx - 4, sy, sx + 4, sy, C.white, 1); line2(sx, sy - 4, sx, sy + 4, C.white, 1);
        line2(sx, sy, sx + me.vx * ss * 4, sy - me.vz * ss * 4, C.white, 0.8);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
