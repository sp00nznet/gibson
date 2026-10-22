// STUNT TRACK: an elevated rollercoaster circuit up on scaffolding, raced against one rival.
// The track is a closed spline with a ramp and gap, a big dip, humps and banked bends; the cars
// fly when the road drops away beneath them, land hard sometimes, and now and then miss the far
// side of the gap and need the crane. Damage grows as a crack across the top of the screen.
// Your activity is the throttle; a failed command means a bad landing.
(function (Worlds) {
  Worlds.define('stunt', (k) => {
    const { C, rand, pick, env, seg, setCam, line2, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", DS = 3, HW = 5.5, GR = 9.81, BASE = 24, LAPS = 3;
    const NAMES = ['HIGH WIRE', 'SCAFFOLD RUN', 'THE DIPPER', 'GIRDER LOOP', 'SKY BRIDGE'];
    const PLAN = [[0, -240], [0, -80], [0, 80], [0, 240], [30, 320], [110, 350], [190, 310], [215, 230], [180, 150], [200, 60], [240, -20], [230, -130], [190, -250], [120, -320], [40, -310]];
    const GAP_A = 80, GAP_B = 100, DIP_A = 180, DIP_B = 380, HUMP_A = 400, HUMP_B = 480;
    const V3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
      cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };

    // --- the track: plan spline, height profile by distance, banked frames every DS metres -----
    let pts = [], n = 0, LEN = 0, trackName = '';
    const gapAt = (s) => s >= GAP_A && s < GAP_B;
    function height(s) {
      let h = BASE;
      if (gapAt(s)) return BASE + 6 - (s - GAP_A) / (GAP_B - GAP_A); // thin air, but it keeps the slopes and the map honest
      if (s >= 40 && s < GAP_A) h += 6 * ((s - 40) / 40) ** 2; // the ramp, kicking up at the lip
      else if (s >= GAP_B && s < GAP_B + 30) h += 5 * (1 - (s - GAP_B) / 30) ** 2; // the landing, sloped to meet you
      if (s >= DIP_A && s < DIP_B) h -= 20 * Math.sin(Math.PI * (s - DIP_A) / (DIP_B - DIP_A)) ** 2; // the big dip
      if (s >= HUMP_A && s < HUMP_B) h += 3 * Math.sin(Math.PI * (s - HUMP_A) / 40) ** 2; // humps
      if (s > 520 && s < LEN - 40) h += 7 * Math.sin(Math.PI * (s - 520) / (LEN - 560)) * Math.sin((s - 520) * 0.02); // the back side rolls
      return h;
    }
    function build() {
      const P = PLAN.map((p, i) => (i < 4 ? p : [p[0] + rand(-25, 25), p[1] + rand(-25, 25)])), m = P.length, dense = [];
      for (let i = 0; i < m; i++) {
        const p0 = P[(i + m - 1) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
        for (let j = 0; j < 60; j++) {
          const t = j / 60, t2 = t * t, t3 = t2 * t;
          dense.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
        }
      }
      dense.push(dense[0]);
      const xz = []; let acc = 0, want = 0;
      for (let i = 1; i < dense.length; i++) {
        const a = dense[i - 1], b = dense[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        while (want <= acc + l) { const f = (want - acc) / l; xz.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); want += DS; }
        acc += l;
      }
      n = xz.length; LEN = n * DS;
      pts = xz.map((p, i) => ({ s: i * DS, P: [p[0], height(i * DS), p[1]] }));
      const yaw = pts.map((_, i) => { const a = xz[(i + n - 1) % n], b = xz[(i + 1) % n]; return Math.atan2(b[0] - a[0], b[1] - a[1]); });
      const kk = yaw.map((_, i) => { const d = yaw[(i + 1) % n] - yaw[(i + n - 1) % n]; return Math.atan2(Math.sin(d), Math.cos(d)) / (2 * DS); });
      pts.forEach((p, i) => {
        let ks = 0; for (let j = -5; j <= 5; j++) ks += kk[(i + j + n) % n]; ks /= 11;
        const T = V3.norm(V3.sub(pts[(i + 1) % n].P, pts[(i + n - 1) % n].P));
        let R = V3.norm([T[2], 0, -T[0]]), U = V3.cross(T, R);
        const a = Math.max(-0.6, Math.min(0.6, -ks * 30)), c = Math.cos(a), sn = Math.sin(a); // bank into the bend
        R = [R[0] * c + U[0] * sn, R[1] * c + U[1] * sn, R[2] * c + U[2] * sn]; U = V3.cross(T, R);
        Object.assign(p, { T, R, U, k: ks, hpp: (pts[(i + 1) % n].P[1] - 2 * p.P[1] + pts[(i + n - 1) % n].P[1]) / (DS * DS), gap: gapAt(i * DS), vlim: Math.sqrt(11 / Math.max(Math.abs(ks), 1e-4)) });
      });
      for (let pass = 0; pass < 2; pass++) for (let i = n - 1; i >= 0; i--) { const q = pts[(i + 1) % n]; pts[i].vlim = Math.min(pts[i].vlim, Math.sqrt(q.vlim * q.vlim + 2 * 9 * DS)); } // brake in time
      trackName = pick(NAMES);
    }
    const wrap = (s) => ((s % LEN) + LEN) % LEN;
    const at = (s) => pts[Math.floor(wrap(s) / DS) % n];
    const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    // A point on the road, s along it and lane across. With fr, also the road's frame there (T, U, R),
    // blended between the two samples either side: taken from one sample, a car's heading and bank
    // jumped every 3 m, and its lane offset with them.
    function posAt(s, lane, out, fr) {
      const w = wrap(s), i = Math.floor(w / DS) % n, f = w / DS - Math.floor(w / DS), a = pts[i], b = pts[(i + 1) % n], R = mix(a.R, b.R, f);
      for (let c = 0; c < 3; c++) out[c] = a.P[c] + (b.P[c] - a.P[c]) * f + R[c] * lane;
      if (fr) { fr.T = V3.norm(mix(a.T, b.T, f)); fr.R = V3.norm(R); fr.U = V3.cross(fr.T, fr.R); }
      return out;
    }

    // --- the cars ----------------------------------------------------------------------------
    const mk = (name, col, lane, skill) => ({ name, col, lane, skill, s: 0, v: 0, mode: 'track', p: [0, 0, 0], vel: [0, 0, 0], T: [0, 0, 1], U: [0, 1, 0], R: [1, 0, 0],
      laps: 0, lapT: 0, last: 0, best: 0, luck: 1, dmg: 0, hard: false, lt: 1, crane: 0, from: null, spin: 0, done: false });
    const me = mk('NYX', C.neon, -2.6, 1), rival = mk('', C.hot, 2.6, 1), cars = [me, rival];
    let state = 'grid', stateT = 0, sparks = [], feed = [], shake = 0, crack = [], results = [], raceNo = 0;
    const camE = [0, 40, 0], camL = [0, 24, 0];
    const say = (s, col) => { feed.push({ s, t: 6, col: col || C.white }); if (feed.length > 6) feed.shift(); };
    function newCrack() { // a jagged run across the top, with branches; drawn as far as the damage goes
      crack = []; let x = 10, y = 14, a = 0.05;
      while (x < 1500) { a = Math.max(-0.5, Math.min(0.5, a + rand(-0.5, 0.5))); if (y < 8) a = Math.abs(a); if (y > 58) a = -Math.abs(a); const nx = x + 16 * Math.cos(a), ny = y + 16 * Math.sin(a); crack.push([x, y, nx, ny, 0]); x = nx; y = ny;
        if (Math.random() < 0.18) { let bx = x, by = y, ba = a + pick([-1, 1]) * rand(0.6, 1.2); for (let j = 0; j < 5; j++) { const cx = bx + 9 * Math.cos(ba), cy = by + 9 * Math.sin(ba); crack.push([bx, by, cx, cy, 1]); bx = cx; by = cy; ba += rand(-0.4, 0.4); } } }
    }
    function newRace() {
      build(); newCrack(); raceNo++;
      rival.name = pick(['RAZOR', 'THE PLAGUE', 'ACID BURN', 'ROADKILL', 'BLADE']); rival.skill = rand(0.93, 1.05);
      cars.forEach((c, i) => Object.assign(c, { s: 6 + i * 9, v: 0, mode: 'track', laps: 0, lapT: 0, last: 0, best: 0, dmg: 0, hard: false, done: false, luck: 1 }));
      state = 'grid'; stateT = 0; sparks = []; results = [];
      say(`RACE ${raceNo}  ${trackName}`, C.gold);
    }
    function burst(p, nSp, pow) { for (let i = 0; i < nSp; i++) sparks.push({ p: p.slice(), v: [rand(-pow, pow), rand(1, pow), rand(-pow, pow)], t: rand(0.4, 1.2) }); }
    function land(c, fr, hs) {
      const slope = fr.T[1] / Math.hypot(fr.T[0], fr.T[2]), impact = Math.max(0, slope * hs - c.vel[1]);
      const q = posAt(c.s, c.lane, [0, 0, 0]); c.off = V3.sub(c.p, q); // where it came down vs. its lane: eased out, not snapped (it was up to 1 m)
      c.mode = 'track'; c.v = hs; c.lt = 0;
      if (impact > 5 || c.hard) {
        c.dmg = Math.min(100, c.dmg + Math.max(0, impact - 7.5) * 3 + (c.hard ? 10 : 0)); c.v *= 0.85; burst(c.p, Math.min(40, 8 + impact * 3) | 0, 6);
        if (c === me) { shake = Math.min(1.5, impact / 8 + (c.hard ? 0.8 : 0)); if (impact > 9 || c.hard) say(c.hard ? 'BAD LANDING' : 'HARD LANDING', C.hot); }
      }
      c.hard = false;
    }
    const road = {};
    function drive(c, dt) {
      if (c.done) { c.v *= 1 - dt * 0.5; c.s = wrap(c.s + c.v * dt); return; }
      c.lapT += dt;
      const fr = at(c.s);
      if (c.mode === 'track') {
        const ahead = wrap(c.s - (GAP_A - 160)) < 160; // lining up for the jump
        if (ahead && c.luck === 1) c.luck = Math.random() < 0.12 ? rand(0.5, 0.62) : rand(0.98, 1.08);
        if (!ahead) c.luck = 1;
        const vt = ahead ? 21 * c.luck : fr.vlim * Math.min(1, 0.62 + env.level * 0.25 + c.skill * 0.18) * (1 - c.dmg * 0.002);
        c.v += Math.max(-9 * dt, Math.min(7 * dt, vt - c.v)) - GR * fr.T[1] * dt * 0.6;
        c.v = Math.max(2, c.v);
        c.s = wrap(c.s + c.v * dt);
        const nf = at(c.s);
        c.lt += dt;
        if (nf.gap || (c.lt > 0.4 && nf.hpp * c.v * c.v < -GR)) { c.mode = 'air'; c.vel = [fr.T[0] * c.v, fr.T[1] * c.v, fr.T[2] * c.v]; } // the road drops away
        else {
          posAt(c.s, c.lane, c.p, road);
          if (c.off) { const e = Math.exp(-dt * 6); for (let i = 0; i < 3; i++) { c.off[i] *= e; c.p[i] += c.off[i]; } if (Math.abs(c.off[0]) + Math.abs(c.off[2]) < 0.01) c.off = null; }
          const e = Math.min(1, dt * 12); // eases the nose down onto the road after a landing; on the road it just follows
          c.T = V3.norm(mix(c.T, road.T, e)); c.R = V3.norm(mix(c.R, road.R, e)); c.U = V3.cross(c.T, c.R);
        }
      } else if (c.mode === 'air' || c.mode === 'fall') {
        c.vel[1] -= GR * dt; for (let i = 0; i < 3; i++) c.p[i] += c.vel[i] * dt;
        c.T = V3.norm(V3.add(c.T, V3.norm(c.vel), dt * 1.5)); c.R = V3.norm([c.T[2], 0, -c.T[0]]); c.U = V3.cross(c.T, c.R);
        if (c.mode === 'fall') { c.spin += dt * 2; if (c.p[1] <= 0.3) { c.p[1] = 0.3; c.dmg = Math.min(100, c.dmg + 20); burst(c.p, 40, 8); c.mode = 'crane'; c.crane = 0; c.from = c.p.slice(); if (c === me) { shake = 1.5; say('OFF THE TRACK  CALLING THE CRANE', C.hot); } } return; }
        const hs = Math.hypot(c.vel[0], c.vel[2]), tl = Math.hypot(fr.T[0], fr.T[2]);
        c.s = wrap(c.s + (c.vel[0] * fr.T[0] + c.vel[2] * fr.T[2]) / tl * dt);
        const nf = at(c.s), deck = posAt(c.s, c.lane, [0, 0, 0])[1];
        if (c.p[1] < deck - 2.5) { c.mode = 'fall'; if (c === me) say('SHORT!', C.hot); }
        else if (!nf.gap && c.p[1] <= deck) { c.p[1] = deck; land(c, nf, hs); }
      } else if (c.mode === 'crane') {
        c.crane += dt;
        if (c.crane > 6) { c.mode = 'track'; c.s = GAP_B + 12; c.v = 3; c.spin = 0; c.off = null; return; }
        else if (c.crane > 1.5) { // up, over, and down onto the landing deck
          const u = Math.min(1, (c.crane - 1.5) / 4), e = u * u * (3 - 2 * u), to = posAt(GAP_B + 12, c.lane, [0, 0, 0]);
          c.p = [c.from[0] + (to[0] - c.from[0]) * e, c.from[1] + (to[1] + 6 - c.from[1]) * e - (c.crane > 5.5 ? (c.crane - 5.5) * 12 : 0), c.from[2] + (to[2] - c.from[2]) * e];
          c.spin *= 1 - dt; c.T = at(GAP_B + 12).T; c.R = V3.norm([c.T[2], 0, -c.T[0]]); c.U = [0, 1, 0];
        }
      }
    }
    function lapCheck(c, was) {
      if (c.s >= was - LEN / 2) return;
      c.laps++; c.last = c.lapT; c.best = c.best ? Math.min(c.best, c.lapT) : c.lapT; c.lapT = 0;
      if (c === me) say(`LAP ${c.laps}  ${c.last.toFixed(2)}`, C.ice);
      if (c.laps >= LAPS) c.done = true;
    }
    const progress = (c) => c.laps * LEN + c.s;

    // --- the car, as a box with a cage and four wheels --------------------------------------
    const CAR = [];
    const boxE = (x0, x1, y0, y1, z0, z1, top) => { const X = [x0, x1], Z = [z0, z1]; for (const y of [y0, y1]) for (let i = 0; i < 4; i++) { const a = [[0, 0], [1, 0], [1, 1], [0, 1]][i], b = [[1, 0], [1, 1], [0, 1], [0, 0]][i]; CAR.push([X[a[0]], y, Z[a[1]], X[b[0]], y, Z[b[1]]]); } for (const x of X) for (const z of Z) CAR.push([x, y0, z, top ? x * 0.75 : x, y1, top ? z * 0.6 - 0.3 : z]); };
    boxE(-1.1, 1.1, 0.35, 0.95, -2.2, 2.2);
    CAR.push([-0.8, 1.65, -1.3, 0.8, 1.65, -1.3], [0.8, 1.65, -1.3, 0.8, 1.65, 0.3], [0.8, 1.65, 0.3, -0.8, 1.65, 0.3], [-0.8, 1.65, 0.3, -0.8, 1.65, -1.3]);
    for (const x of [-1, 1]) CAR.push([x, 0.95, -1.8, x * 0.8, 1.65, -1.3], [x, 0.95, 1.0, x * 0.8, 1.65, 0.3], [x * 1.1, 1.35, -2.3, x * 1.1, 0.95, -2.0]);
    CAR.push([-1.15, 1.35, -2.3, 1.15, 1.35, -2.3], [-0.5, 0.95, 2.2, 0.5, 1.15, 1.2], [0.5, 0.95, 2.2, -0.5, 1.15, 1.2]); // wing, and an engine scoop
    const WH = [[-1.25, 1.45], [1.25, 1.45], [-1.25, -1.45], [1.25, -1.45]];

    newRace();

    return {
      label: 'STUNT TRACK',
      update(dt) {
        stateT += dt; shake = Math.max(0, shake - dt * 2);
        for (const f of feed) f.t -= dt;
        for (const s of sparks) { s.v[1] -= GR * dt; for (let i = 0; i < 3; i++) s.p[i] += s.v[i] * dt; s.t -= dt; }
        sparks = sparks.filter((s) => s.t > 0);
        if (state === 'grid') { cars.forEach((c) => { posAt(c.s, c.lane, c.p, c); c.off = null; }); if (stateT > 3) { state = 'race'; stateT = 0; say('GO', C.neon); } return; }
        const sp = 1 + env.level * 0.3;
        for (const c of cars) { const was = c.s; drive(c, dt * sp); if (!c.done) lapCheck(c, was); }
        if (state === 'race' && (me.done || me.dmg >= 100)) {
          state = 'done'; stateT = 0;
          const won = me.dmg < 100 && progress(me) >= progress(rival);
          results = me.dmg >= 100 ? ['WRECKED', 'DID NOT FINISH'] : [won ? 'YOU WIN' : `${rival.name} WINS`, `BEST LAP ${me.best.toFixed(2)}`];
          say(results[0], won ? C.gold : C.hot);
        }
        if (state === 'done' && stateT > 8) newRace();
      },
      signal(kind) {
        if (kind !== 'error' || state !== 'race' || me.done) return;
        me.hard = true;
        if (me.mode === 'track') { me.mode = 'air'; me.vel = [me.T[0] * me.v, me.T[1] * me.v + 4, me.T[2] * me.v]; }
      },
      draw() {
        const t = env.t, c0 = me, off = c0.mode === 'fall' || c0.mode === 'crane';
        // chase camera; when we come off, it waits at the lip and watches
        let ex, ey, ez, lx, ly, lz;
        if (off) { const a = posAt(GAP_A - 30, 0, [0, 0, 0]), f = at(GAP_A - 30); ex = a[0] + f.R[0] * 22; ey = a[1] + 12; ez = a[2] + f.R[2] * 22; [lx, ly, lz] = c0.p; }
        else { ex = c0.p[0] - c0.T[0] * 15 + c0.U[0] * 2; ey = c0.p[1] - c0.T[1] * 15 + 7; ez = c0.p[2] - c0.T[2] * 15 + c0.U[2] * 2; lx = c0.p[0] + c0.T[0] * 12; ly = c0.p[1] + c0.T[1] * 12 - 0.5; lz = c0.p[2] + c0.T[2] * 14; }
        const r = off ? 0.05 : 0.25;
        camE[0] += (ex - camE[0]) * r; camE[1] += (ey - camE[1]) * r; camE[2] += (ez - camE[2]) * r;
        camL[0] += (lx - camL[0]) * 0.3; camL[1] += (ly - camL[1]) * 0.3; camL[2] += (lz - camL[2]) * 0.3;
        const sh = shake * 0.4, fw = V3.norm(V3.sub(camL, camE)), yaw = Math.atan2(fw[0], fw[2]) + rand(-sh, sh) * 0.05, pitch = Math.asin(Math.max(-1, Math.min(1, fw[1]))) + rand(-sh, sh) * 0.05;
        const r0 = [Math.cos(yaw), 0, -Math.sin(yaw)], u0 = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
        const roll = off ? 0 : Math.atan2(V3.dot(c0.U, r0), V3.dot(c0.U, u0)) * 0.7;
        setCam({ x: camE[0], y: camE[1] + rand(-sh, sh), z: camE[2], yaw, pitch, roll });

        // the ground, and hills far off
        const GS = 30, gx0 = Math.round(camE[0] / GS) * GS, gz0 = Math.round(camE[2] / GS) * GS, GE = 330;
        for (let a = -GE; a <= GE; a += GS) for (let b = -GE; b < GE; b += 110) {
          seg(gx0 + a, 0, gz0 + b, gx0 + a, 0, gz0 + b + 110, C.violet, 0.9, 420); seg(gx0 + b, 0, gz0 + a, gx0 + b + 110, 0, gz0 + a, C.violet, 0.9, 420);
        }
        for (let i = 0; i < 48; i++) { const a0 = i / 48 * 6.283, a1 = (i + 1) / 48 * 6.283, R = 1500, h = (q) => 40 + Math.abs(Math.sin(q * 3.1) * 70) + Math.sin(q * 11) * 15; seg(camE[0] + Math.sin(a0) * R, h(a0), camE[2] + Math.cos(a0) * R, camE[0] + Math.sin(a1) * R, h(a1), camE[2] + Math.cos(a1) * R, C.violet, 0.6, 3000); }

        // the track: deck, kerbs, ribs, and the scaffolding under it
        const here = wrap(c0.s) / DS;
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          let d = i - here; d = ((d % n) + n) % n; if (d > n / 2) d -= n;
          const near = d > -15 && d < 60;
          if (!a.gap) {
            const AL = V3.add(a.P, a.R, -HW), AR = V3.add(a.P, a.R, HW), BL = V3.add(b.P, b.R, -HW), BR = V3.add(b.P, b.R, HW);
            seg(AL[0], AL[1], AL[2], BL[0], BL[1], BL[2], C.ice, 1, 700); seg(AR[0], AR[1], AR[2], BR[0], BR[1], BR[2], C.ice, 1, 700);
            if (near) {
              for (const [p, q] of [[AL, BL], [AR, BR]]) seg(p[0] + a.U[0] * 0.7, p[1] + a.U[1] * 0.7, p[2] + a.U[2] * 0.7, q[0] + b.U[0] * 0.7, q[1] + b.U[1] * 0.7, q[2] + b.U[2] * 0.7, C.ice, 0.6, 300);
              if (i % 2 === 0) seg(a.P[0], a.P[1], a.P[2], a.P[0] + a.T[0] * 1.5, a.P[1] + a.T[1] * 1.5, a.P[2] + a.T[2] * 1.5, C.white, 0.6, 250);
            }
            if (near || i % 5 === 0) seg(AL[0], AL[1], AL[2], AR[0], AR[1], AR[2], i === 0 ? C.gold : C.ice, near ? 0.5 : 0.35, 600);
            if ((b.gap && !a.gap) || (i > 0 && pts[i - 1].gap)) for (let q = 0; q < 4; q++) seg(AL[0] + a.R[0] * q * 2.75, AL[1] + a.R[1] * q * 2.75 + 0.05, AL[2] + a.R[2] * q * 2.75, AL[0] + a.R[0] * (q * 2.75 + 1.4) + a.T[0] * 1.5, AL[1] + a.R[1] * (q * 2.75 + 1.4) + 0.05, AL[2] + a.R[2] * (q * 2.75 + 1.4) + a.T[2] * 1.5, C.gold, 1, 500); // hazard chevrons at the gap
          }
          if (i % 8 === 0 && !a.gap) { // a scaffold bent: two legs, a cross bar, an X, and stringers back to the last one
            const L = V3.add(a.P, a.R, -HW), R = V3.add(a.P, a.R, HW), m = a.P[1] * 0.5, col = '200,140,255', al = 1;
            seg(L[0], L[1], L[2], L[0], 0, L[2], col, al, 450); seg(R[0], R[1], R[2], R[0], 0, R[2], col, al, 450);
            seg(L[0], m, L[2], R[0], m, R[2], col, al * 0.8, 450); seg(L[0], m, L[2], R[0], 0, R[2], col, al * 0.5, 450); seg(R[0], m, R[2], L[0], 0, L[2], col, al * 0.5, 450);
            const p = pts[(i + n - 8) % n];
            if (!p.gap && !pts[(i + n - 4) % n].gap) { const pL = V3.add(p.P, p.R, -HW), pR = V3.add(p.P, p.R, HW), pm = p.P[1] * 0.5; seg(pL[0], pm, pL[2], L[0], m, L[2], col, al * 0.5, 400); seg(pR[0], pm, pR[2], R[0], m, R[2], col, al * 0.5, 400); }
          }
        }
        { const a = pts[0], L = V3.add(a.P, a.R, -HW - 1), R = V3.add(a.P, a.R, HW + 1); // the start gantry
          seg(L[0], L[1], L[2], L[0], L[1] + 8, L[2], C.gold, 0.9, 600); seg(R[0], R[1], R[2], R[0], R[1] + 8, R[2], C.gold, 0.9, 600); seg(L[0], L[1] + 8, L[2], R[0], R[1] + 8, R[2], C.gold, 0.9, 600); seg(L[0], L[1] + 6.5, L[2], R[0], R[1] + 6.5, R[2], C.gold, 0.6, 600);
          text3(state === 'grid' ? String(3 - Math.floor(stateT)) : 'START', a.P[0] - 2, a.P[1] + 9.5, a.P[2], C.gold, 1.6, 0.9); }

        // the cars
        for (const c of cars) {
          const cs = Math.cos(c.spin), sn = Math.sin(c.spin), R = [c.R[0] * cs + c.T[0] * sn, c.R[1] * cs + c.T[1] * sn, c.R[2] * cs + c.T[2] * sn], T = [c.T[0] * cs - c.R[0] * sn, c.T[1] * cs - c.R[1] * sn, c.T[2] * cs - c.R[2] * sn], U = c.U, p = c.p;
          const w = (x, y, z) => [p[0] + R[0] * x + U[0] * y + T[0] * z, p[1] + R[1] * x + U[1] * y + T[1] * z, p[2] + R[2] * x + U[2] * y + T[2] * z];
          for (const e of CAR) { const A = w(e[0], e[1], e[2]), B = w(e[3], e[4], e[5]); seg(A[0], A[1], A[2], B[0], B[1], B[2], c.col, 1, 500); }
          const turn = c.s * 2.2;
          for (const [x, z] of WH) {
            let q = w(x, 0.45 + 0.45, z);
            for (let j = 1; j <= 8; j++) { const a = j / 8 * 6.283, nq = w(x, 0.45 + Math.cos(a) * 0.45, z + Math.sin(a) * 0.45); seg(q[0], q[1], q[2], nq[0], nq[1], nq[2], C.white, 0.8, 400); q = nq; }
            const A = w(x, 0.45 + Math.cos(turn) * 0.45, z + Math.sin(turn) * 0.45), B = w(x, 0.45 - Math.cos(turn) * 0.45, z - Math.sin(turn) * 0.45); seg(A[0], A[1], A[2], B[0], B[1], B[2], C.white, 0.6, 300);
          }
          if (c.mode === 'track' && c.v > 20) for (const x of [-0.5, 0.5]) { const A = w(x, 0.6, -2.3), B = w(x + rand(-0.2, 0.2), 0.6 + rand(-0.2, 0.2), -2.3 - rand(0.5, 2) * (env.pulse + 0.4)); seg(A[0], A[1], A[2], B[0], B[1], B[2], C.gold, 0.8, 300); }
          if (c !== me) text3(c.name, p[0] - 1.5, p[1] + 3.2, p[2], c.col, 0.7, 0.8);
          if (c.mode === 'crane') { // the hook comes down, takes it up and over
            const top = w(0, 1.65, -0.5), hy = c.crane < 1.5 ? 140 - (140 - top[1]) * (c.crane / 1.5) : top[1], hx = top[0], hz = top[2];
            seg(hx, 160, hz, hx, hy + 2, hz, C.white, 0.9, 600);
            seg(hx, hy + 2, hz, hx - 0.6, hy + 1, hz, C.white, 0.9, 600); seg(hx - 0.6, hy + 1, hz, hx, hy, hz, C.white, 0.9, 600);
            if (c.crane >= 1.5) for (const [x, z] of [[-1, 1.8], [1, 1.8], [-1, -1.8], [1, -1.8]]) { const q = w(x, 0.95, z); seg(hx, hy + 2, hz, q[0], q[1], q[2], C.white, 0.5, 600); }
          }
        }
        for (const s of sparks) seg(s.p[0], s.p[1], s.p[2], s.p[0] - s.v[0] * 0.04, s.p[1] - s.v[1] * 0.04, s.p[2] - s.v[2] * 0.04, C.gold, Math.min(1, s.t * 2), 300);

        // HUD, in the margins
        const g = k.g, W = k.W, H = k.H, sc = Math.min(W / 1920, H / 1080), x0 = W * 0.02, y0 = H * 0.12;
        g.font = `bold ${16 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.95)`; g.fillText('STUNT TRACK', x0, y0);
        g.font = `${13 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText(`${trackName}   RACE ${raceNo}`, x0, y0 + 24 * sc);
        const place = progress(me) >= progress(rival) ? 1 : 2, lead = (progress(me) - progress(rival)) / Math.max(10, me.v || 10);
        g.font = `bold ${44 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${place === 1 ? C.gold : C.hot},0.95)`; g.fillText(`P${place}/2`, x0, y0 + 80 * sc);
        g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.85)`; g.fillText(`${lead >= 0 ? '+' : ''}${lead.toFixed(1)}s ${rival.name}`, x0, y0 + 104 * sc);
        const fmt = (x) => (x ? `${(x / 60) | 0}:${(x % 60).toFixed(2).padStart(5, '0')}` : '-:--.--');
        [['LAP', `${Math.min(LAPS, me.laps + 1)}/${LAPS}`], ['TIME', fmt(me.lapT)], ['LAST', fmt(me.last)], ['BEST', fmt(me.best)]].forEach(([a, b], i) => {
          const y = y0 + (140 + i * 26) * sc; g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.55)`; g.fillText(a, x0, y); g.font = `bold ${18 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.95)`; g.fillText(b, x0 + 70 * sc, y + 1 * sc);
        });
        const dy = y0 + 260 * sc, dw = 230 * sc, dm = me.dmg / 100;
        g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.55)`; g.fillText(`DAMAGE ${me.dmg.toFixed(0)}%`, x0, dy);
        for (let i = 0; i < 6; i++) line2(x0, dy + (8 + i) * sc, x0 + dw * dm, dy + (8 + i) * sc, dm > 0.6 ? C.hot : C.gold, 0.9);
        line2(x0, dy + 6 * sc, x0 + dw, dy + 6 * sc, C.white, 0.4); line2(x0, dy + 16 * sc, x0 + dw, dy + 16 * sc, C.white, 0.4); line2(x0 + dw, dy + 6 * sc, x0 + dw, dy + 16 * sc, C.white, 0.4);
        g.font = `${13 * sc | 0}px ${MONO}`;
        feed.forEach((f, i) => { if (f.t > 0) { g.fillStyle = `rgba(${f.col},${Math.min(1, f.t)})`; g.fillText(f.s, x0, dy + (50 + i * 20) * sc); } });
        if (state === 'done') { g.font = `bold ${20 * sc | 0}px ${MONO}`; results.forEach((s, i) => { g.fillStyle = `rgba(${i ? C.white : C.gold},0.95)`; g.fillText(s, x0, dy + (190 + i * 26) * sc); }); }
        // the crack: the further the damage, the further it runs across the top
        let left = me.dmg / 100 * crack.length;
        for (const [ax, ay, bx, by] of crack) { if (left-- <= 0) break; line2(ax * sc, ay * sc, bx * sc, by * sc, C.white, 0.85); line2(ax * sc + 1, ay * sc + 1, bx * sc + 1, by * sc + 1, C.ice, 0.4); }
        // right margin: speed and the map
        const rx = W * 0.86;
        g.font = `bold ${48 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.95)`; g.fillText(String(Math.round((me.mode === 'track' ? me.v : Math.hypot(me.vel[0], me.vel[2])) * 3.6 * (me.mode === 'crane' ? 0 : 1))), rx, H * 0.16);
        g.font = `${13 * sc | 0}px ${MONO}`; g.fillText(me.mode === 'air' ? 'KM/H  AIRBORNE' : 'KM/H', rx, H * 0.16 + 20 * sc);
        const mx = W * 0.915, my = H * 0.42, ms = 120 * sc / 360;
        for (let i = 0; i < n; i += 3) { const a = pts[i].P, b = pts[(i + 3) % n].P; line2(mx + a[0] * ms - 30 * sc, my - a[2] * ms, mx + b[0] * ms - 30 * sc, my - b[2] * ms, pts[i].gap ? C.hot : C.ice, 0.7); }
        for (const c of cars) { const px = mx + c.p[0] * ms - 30 * sc, pz = my - c.p[2] * ms; line2(px - 4, pz, px + 4, pz, c.col, 1); line2(px, pz - 4, px, pz + 4, c.col, 1); }
        const by = my + 150 * sc; // the height profile of the lap, and where we are on it
        g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.55)`; g.fillText('PROFILE', rx, by - 6 * sc);
        for (let i = 0; i < n - 3; i += 3) if (!pts[i].gap) line2(rx + i / n * 230 * sc, by + 50 * sc - pts[i].P[1] * 1.3 * sc, rx + (i + 3) / n * 230 * sc, by + 50 * sc - pts[i + 3].P[1] * 1.3 * sc, C.ice, 0.7);
        for (const c of cars) { const px = rx + wrap(c.s) / LEN * 230 * sc, py = by + 50 * sc - c.p[1] * 1.3 * sc; line2(px - 3, py, px + 3, py, c.col, 1); line2(px, py - 3, px, py + 3, c.col, 1); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
