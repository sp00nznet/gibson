// FREE TRADER: an 8-bit-era space trader that flies itself. Cruise in past the planet toward a
// rolling many-faced station, match its spin and fly in through the slot, trade, then jump to the
// next system through hyperspace. Pirates jump you now and then. Everything is wireframe with the
// back faces culled; status on the left, the elliptical 3D scanner on the right.
// A failed command gets your shields hit, your record marked, and somebody angry on your tail.
(function (Worlds) {
  Worlds.define('trader', (k) => {
    const { C, rand, pick, env, seg, line2, setCam, toCam } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", TAU = Math.PI * 2;
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const turn = (from, to, max) => from + Math.max(-max, Math.min(max, wrapA(to - from)));

    // --- models: convex hulls (brute force, they are tiny), so back faces can be culled -------
    function hull(V) {
      const P = [], E = [], n = V.length, on = (p, v) => Math.abs(p[0] * v[0] + p[1] * v[1] + p[2] * v[2] - p[3]) < 1e-6;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let m = j + 1; m < n; m++) {
        const a = V[i], b = V[j], c = V[m], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue;
        nx /= l; ny /= l; nz /= l; let d = nx * a[0] + ny * a[1] + nz * a[2], pos = 0, neg = 0;
        for (const p of V) { const s = nx * p[0] + ny * p[1] + nz * p[2] - d; if (s > 1e-6) pos++; else if (s < -1e-6) neg++; }
        if (pos && neg) continue;
        if (pos) { nx = -nx; ny = -ny; nz = -nz; d = -d; } // outward
        if (!P.some((p) => p[0] * nx + p[1] * ny + p[2] * nz > 0.99999 && Math.abs(p[3] - d) < 1e-6)) P.push([nx, ny, nz, d]);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { // an edge lies on two faces
        const f = []; P.forEach((p, q) => { if (on(p, V[i]) && on(p, V[j])) f.push(q); });
        if (f.length >= 2) E.push([i, j, f[0], f[1]]);
      }
      return { v: V, p: P, e: E, vis: new Uint8Array(P.length) };
    }
    const CUBO = []; // the station: a cuboctahedron, slot on the -z square
    for (const a of [-1, 1]) for (const b of [-1, 1]) CUBO.push([a, b, 0], [a, 0, b], [0, a, b]);
    const STATION = hull(CUBO);
    const HULLS = [
      ['RAIDER', hull([[-0.55, 0, 1.6], [0.55, 0, 1.6], [0, 0.5, 0.2], [0, -0.3, 0.4], [-2.3, -0.05, -0.7], [2.3, -0.05, -0.7], [-1.3, 0.4, -1], [1.3, 0.4, -1], [-1.3, -0.3, -1], [1.3, -0.3, -1]])],
      ['LANCE', hull([[0, 0, 2.2], [-1.2, 0, -1], [1.2, 0, -1], [0, 0.5, -0.9], [0, -0.4, -0.9], [-0.5, 0.25, -1], [0.5, 0.25, -1], [-0.5, -0.2, -1], [0.5, -0.2, -1]])],
      ['SKATE', hull([[0, 0, 2], [-0.4, 0.3, 0], [0.4, 0.3, 0], [-0.4, -0.25, 0], [0.4, -0.25, 0], [-1.8, 0, -1.2], [1.8, 0, -1.2], [-0.5, 0.2, -1.1], [0.5, 0.2, -1.1], [0, -0.2, -1.1]])],
    ];

    // orientation: roll about z, then pitch, then yaw (nose +z, the camera's convention)
    const ori = (o, yaw, pitch, roll) => { o.cy = Math.cos(yaw); o.sy = Math.sin(yaw); o.cp = Math.cos(pitch); o.sp = Math.sin(pitch); o.cr = Math.cos(roll); o.sr = Math.sin(roll); return o; };
    function fwd(o, x, y, z, out) {
      const a = x * o.cr - y * o.sr, b = x * o.sr + y * o.cr, c = b * o.cp + z * o.sp, d = -b * o.sp + z * o.cp;
      out[0] = a * o.cy + d * o.sy; out[1] = c; out[2] = -a * o.sy + d * o.cy;
    }
    function inv(o, x, y, z, out) {
      const a = x * o.cy - z * o.sy, d = x * o.sy + z * o.cy, b = y * o.cp - d * o.sp;
      out[0] = a * o.cr + b * o.sr; out[1] = -a * o.sr + b * o.cr; out[2] = y * o.sp + d * o.cp;
    }
    const TW = new Float64Array(64 * 3), tv = [0, 0, 0];
    function place(m, o, px, py, pz, s) { for (let i = 0; i < m.v.length; i++) { const v = m.v[i]; fwd(o, v[0], v[1], v[2], tv); TW[i * 3] = px + tv[0] * s; TW[i * 3 + 1] = py + tv[1] * s; TW[i * 3 + 2] = pz + tv[2] * s; } }
    function drawModel(m, o, px, py, pz, s, col, a, fog) {
      inv(o, cam.x - px, cam.y - py, cam.z - pz, tv);
      for (let i = 0; i < m.p.length; i++) { const p = m.p[i]; m.vis[i] = (p[0] * tv[0] + p[1] * tv[1] + p[2] * tv[2]) / s > p[3] ? 1 : 0; }
      place(m, o, px, py, pz, s);
      for (const [i, j, p, q] of m.e) if (m.vis[p] || m.vis[q]) seg(TW[i * 3], TW[i * 3 + 1], TW[i * 3 + 2], TW[j * 3], TW[j * 3 + 1], TW[j * 3 + 2], col, a, fog);
    }

    // --- the galaxy: names from syllable pairs ------------------------------------------------
    const SYL = ['ZA', 'RI', 'ON', 'QU', 'TE', 'BI', 'SO', 'AR', 'DI', 'VE', 'LA', 'XE', 'MO', 'US', 'IN', 'GE', 'OR', 'CE', 'TI', 'ES', 'RA', 'NU', 'KA', 'ED', 'LU', 'AT'];
    const GOV = ['ANARCHY', 'FEUDAL', 'DICTATORSHIP', 'DEMOCRACY', 'CORPORATE', 'THEOCRACY', 'COOPERATIVE'];
    const ECO = ['RICH INDUSTRIAL', 'POOR AGRICULTURAL', 'AVERAGE MINING', 'HI-TECH', 'MAINLY AGRICULTURAL', 'RICH REFINERY'];
    const GOODS = ['FOOD', 'TEXTILES', 'RADIOACTIVES', 'LIQUOR', 'LUXURIES', 'COMPUTERS', 'MACHINERY', 'ALLOYS', 'FURS', 'MINERALS', 'GOLD', 'PLATINUM', 'GEMSTONES', 'MEDICINE'];
    const PLANET_COLS = [C.ice, C.neon, C.gold, C.violet, C.hot, '120,255,200', '255,140,60'];
    const sysName = () => { let s = ''; for (let i = Math.random() < 0.15 ? 4 : ri(2, 3); i > 0; i--) s += pick(SYL); return s; };
    const newSystem = () => ({ name: sysName(), gov: pick(GOV), eco: pick(ECO), tl: ri(1, 14), col: pick(PLANET_COLS), side: pick([-1, 1]), py: rand(150, 450), r: rand(650, 800), tilt: rand(-0.5, 0.5), dist: rand(2.2, 6.8) });

    // --- state ---------------------------------------------------------------------------------
    let cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
    let sys = newSystem(), next = newSystem(), state = 'cruise', st = 0, spin = 0, plRot = 0, first = true, pirateT = 2.5;
    let pirates = [], debris = [], beams = [], laser = 0, laserHeat = 0, fireT = 0, hurt = 0, kills = 0;
    let credits = 1000, shown = 1000, fuel = 7, fs = 100, as = 100, speed = 0, offender = 0, feed = [];
    let cargo = [['FOOD', 12], ['COMPUTERS', 4]];
    const say = (s, col) => { feed.push({ s, t: 7, col: col || C.gold }); if (feed.length > 5) feed.shift(); };
    const plOri = {}, stOri = {}, shOri = {};
    const Q = [0, 0, -130]; // the start of the docking run, on the station's axis
    function arrive() {
      const a = rand(-0.6, 0.6), d = rand(440, 520);
      cam = { x: Math.sin(a) * d, y: rand(-50, 50), z: Q[2] - Math.cos(a) * d, yaw: 0, pitch: 0, roll: 0 };
      k.lookAt(cam, 0, 0, 0); const f = [Math.sin(cam.yaw), Math.cos(cam.yaw)]; // the planet hangs off to one side of the run in, out in a margin
      sys.pc = [cam.x + f[0] * 2100 + f[1] * sys.side * 1500, sys.py, cam.z + f[1] * 2100 - f[0] * sys.side * 1500]; state = 'cruise'; st = 0; pirateT = first ? 1.5 : Math.random() < 0.6 ? rand(2, 6) : Infinity; first = false;
    }
    arrive();

    function spawnPirate(name) {
      const [hn, m] = pick(HULLS), f = [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)], side = pick([-1, 1]);
      pirates.push({ name: name || hn, m, x: cam.x + f[0] * 160 + f[2] * side * rand(40, 90), y: cam.y + rand(-30, 30), z: cam.z + f[2] * 160 - f[0] * side * rand(40, 90),
        vx: 0, vy: 0, vz: 0, hp: 7, ph: rand(0, TAU), cool: rand(1, 3), col: name ? C.ice : pick([C.hot, '255,140,60', C.violet]), bounty: rand(20, 160) });
    }
    function explode(p) {
      ori(shOri, Math.atan2(p.vx, p.vz), Math.atan2(p.vy, Math.hypot(p.vx, p.vz)), Math.sin(env.t * 1.3 + p.ph) * 0.6);
      place(p.m, shOri, p.x, p.y, p.z, 2.6);
      for (const [i, j] of p.m.e) {
        const dx = (TW[i * 3] + TW[j * 3]) / 2 - p.x, dy = (TW[i * 3 + 1] + TW[j * 3 + 1]) / 2 - p.y, dz = (TW[i * 3 + 2] + TW[j * 3 + 2]) / 2 - p.z, s = rand(3, 8);
        const vx = p.vx * 0.3 + dx * s, vy = p.vy * 0.3 + dy * s, vz = p.vz * 0.3 + dz * s;
        debris.push({ a: [TW[i * 3], TW[i * 3 + 1], TW[i * 3 + 2]], b: [TW[j * 3], TW[j * 3 + 1], TW[j * 3 + 2]], va: [vx + rand(-2, 2), vy + rand(-2, 2), vz + rand(-2, 2)], vb: [vx + rand(-2, 2), vy + rand(-2, 2), vz + rand(-2, 2)], t: rand(1.2, 2.4), col: p.col });
      }
      for (let i = 0; i < 24; i++) { const v = [rand(-1, 1), rand(-1, 1), rand(-1, 1)].map((c) => c * rand(8, 20)); debris.push({ a: [p.x, p.y, p.z], b: [p.x, p.y, p.z], va: v, vb: v.map((c) => c * 1.04), t: rand(0.5, 1.4), col: C.gold }); }
      kills++; credits += p.bounty; say(`${p.name} DESTROYED  +${p.bounty.toFixed(1)} CR`, C.neon);
    }
    function trade() { // sell the hold at a profit, fill it with something else
      for (const [n, t] of cargo) { const v = t * rand(6, 30); credits += v; say(`SOLD ${n} ${t}t  +${v.toFixed(1)}`, C.neon); }
      cargo = []; let room = 20;
      for (let i = ri(2, 3); i > 0 && room > 1; i--) { const t = ri(1, Math.min(14, room)); room -= t; const n = pick(GOODS.filter((g) => !cargo.some((c) => c[0] === g))); cargo.push([n, t]); credits -= t * rand(2, 8); }
      say(`BOUGHT ${cargo.map((c) => c[0]).join(', ')}`); fuel = 7;
    }

    function steerCam(tx, ty, tz, rate, dt) {
      const dx = tx - cam.x, dy = ty - cam.y, dz = tz - cam.z, y0 = cam.yaw;
      cam.yaw = turn(cam.yaw, Math.atan2(dx, dz), rate * dt);
      cam.pitch = turn(cam.pitch, Math.atan2(dy, Math.hypot(dx, dz)), rate * dt * 0.8);
      cam.roll += (Math.max(-0.6, Math.min(0.6, -wrapA(cam.yaw - y0) / dt * 0.5)) - cam.roll) * Math.min(1, dt * 2); // bank into the turn
    }
    function advance(v, dt) { const cp = Math.cos(cam.pitch); cam.x += Math.sin(cam.yaw) * cp * v * dt; cam.y += Math.sin(cam.pitch) * v * dt; cam.z += Math.cos(cam.yaw) * cp * v * dt; }

    function update(dt) {
      dt *= 1 + env.level * 0.8; st += dt; spin += dt * 0.3; plRot += dt * 0.02;
      hurt = Math.max(0, hurt - dt * 1.5); laser = Math.max(0, laser - dt); laserHeat = Math.max(0, laserHeat - dt * 12);
      offender = Math.max(0, offender - dt); fs = Math.min(100, fs + dt * 3); as = Math.min(100, as + dt * 3);
      shown += (credits - shown) * Math.min(1, dt * 2); for (const f of feed) f.t -= dt;
      if (state === 'cruise') {
        if ((pirateT -= dt) <= 0) { pirateT = Infinity; for (let i = ri(2, 3); i > 0; i--) spawnPirate(); say('CONDITION RED: PIRATES', C.hot); }
        const tgt = pirates[0];
        if (tgt) { // dogfight: turn on the nearest, fire when it is in the sights
          steerCam(tgt.x, tgt.y, tgt.z, 1.1 + env.level, dt); speed += (8 - speed) * dt;
          setCam(cam); const q = toCam(tgt.x, tgt.y, tgt.z);
          if (q[2] > 0 && Math.abs(q[0] / q[2]) < 0.03 && Math.abs(q[1] / q[2]) < 0.03 && (fireT -= dt) <= 0 && laserHeat < 60) {
            fireT = 0.5; laser = 0.14; laserHeat += 9;
            if (--tgt.hp <= 0) { explode(tgt); pirates.shift(); if (!pirates.length) say('CONDITION GREEN'); }
          }
        } else {
          const d = Math.hypot(Q[0] - cam.x, Q[1] - cam.y, Q[2] - cam.z);
          steerCam(Q[0], Q[1], Q[2], 0.7, dt); speed += (Math.min(28 + env.level * 30, d * 0.4 + 6) - speed) * Math.min(1, dt);
          if (d < 14 || st > 80) { state = 'dock'; st = 0; say('DOCKING COMPUTER ON', C.ice); }
        }
        advance(speed, dt);
        pirates.sort((a, b) => Math.hypot(a.x - cam.x, a.y - cam.y, a.z - cam.z) - Math.hypot(b.x - cam.x, b.y - cam.y, b.z - cam.z));
      } else if (state === 'dock') { // line up on the axis, match the station's roll, in through the slot
        const e = Math.min(1, dt * 1.2);
        cam.x += (0 - cam.x) * e; cam.y += (0 - cam.y) * e; cam.yaw = turn(cam.yaw, 0, dt * 0.8); cam.pitch = turn(cam.pitch, 0, dt * 0.8);
        cam.roll = turn(cam.roll, -spin, dt * 1.6);
        speed = Math.max(4, Math.min(20, (-16 - cam.z) * 0.25)); cam.z += speed * dt;
        if (cam.z > -24) { state = 'docked'; st = 0; say(`DOCKED AT ${sys.name}`, C.ice); trade(); }
      } else if (state === 'docked') {
        speed = 0; if (st > 3.5) { state = 'hyper'; st = 0; say(`HYPERSPACE: ${next.name}`, C.violet); }
      } else if (state === 'hyper') {
        speed = 99;
        if (st > 4) { fuel = Math.max(0, fuel - next.dist); sys = next; next = newSystem(); pirates = []; arrive(); say(`ARRIVED ${sys.name}`, C.neon); }
      }
      for (const p of pirates) { // they swarm round a point just ahead of you, loosing off when they face you
        const f = [Math.sin(cam.yaw), Math.cos(cam.yaw)], a = env.t * 0.6 + p.ph, sp = 30 + env.level * 20;
        const ax = cam.x + f[0] * 70 + f[1] * Math.cos(a) * 62, ay = cam.y + Math.sin(a * 1.3) * 28, az = cam.z + f[1] * 70 - f[0] * Math.cos(a) * 62;
        let dx = ax - p.x, dy = ay - p.y, dz = az - p.z; const l = Math.hypot(dx, dy, dz) || 1, e = Math.min(1, dt * 1.4);
        p.vx += (dx / l * sp - p.vx) * e; p.vy += (dy / l * sp - p.vy) * e; p.vz += (dz / l * sp - p.vz) * e;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.cool -= dt;
        dx = cam.x - p.x; dy = cam.y - p.y; dz = cam.z - p.z; const dc = Math.hypot(dx, dy, dz), vl = Math.hypot(p.vx, p.vy, p.vz) || 1;
        if (p.cool < 0 && dc < 160 && (dx * p.vx + dy * p.vy + dz * p.vz) / (dc * vl) > 0.85) {
          p.cool = rand(1.2, 3); beams.push({ a: [p.x, p.y, p.z], b: [cam.x + Math.sin(cam.yaw) * 4, cam.y - 1.5, cam.z + Math.cos(cam.yaw) * 4], t: 0.25, col: p.col });
          if (Math.random() < 0.5) fs = Math.max(4, fs - rand(6, 14)); else as = Math.max(4, as - rand(6, 14)); hurt = Math.max(hurt, 0.5);
        }
      }
      for (const d of debris) { d.t -= dt; for (let i = 0; i < 3; i++) { d.a[i] += d.va[i] * dt; d.b[i] += d.vb[i] * dt; } }
      debris = debris.filter((d) => d.t > 0); beams = beams.filter((b) => (b.t -= dt) > 0);
    }

    // --- drawing -------------------------------------------------------------------------------
    const P1 = [0, 0, 0], P2 = [0, 0, 0];
    function planetPt(cx, cy, cz, r, lat, lon, out) {
      fwd(plOri, Math.cos(lat) * Math.cos(lon) * r, Math.sin(lat) * r, Math.cos(lat) * Math.sin(lon) * r, out);
      out[0] += cx; out[1] += cy; out[2] += cz;
    }
    function planetSeg(cx, cy, cz, r, la0, lo0, la1, lo1, col, a) {
      planetPt(cx, cy, cz, r, la0, lo0, P1); planetPt(cx, cy, cz, r, la1, lo1, P2);
      const mx = (P1[0] + P2[0]) / 2, my = (P1[1] + P2[1]) / 2, mz = (P1[2] + P2[2]) / 2;
      if ((mx - cx) * (cam.x - mx) + (my - cy) * (cam.y - my) + (mz - cz) * (cam.z - mz) > 0) seg(P1[0], P1[1], P1[2], P2[0], P2[1], P2[2], col, a, 14000);
    }
    function drawPlanet() {
      const [cx, cy, cz] = sys.pc, r = sys.r, col = sys.col;
      ori(plOri, plRot, sys.tilt, sys.tilt * 0.5);
      for (let la = -75; la <= 75; la += 25) { const L = la * Math.PI / 180; for (let i = 0; i < 40; i++) planetSeg(cx, cy, cz, r, L, i / 40 * TAU, L, (i + 1) / 40 * TAU, col, la ? 0.6 : 0.9); }
      for (let m = 0; m < 6; m++) { const lo = m / 6 * Math.PI; for (let i = 0; i < 20; i++) planetSeg(cx, cy, cz, r, -Math.PI / 2 + i / 20 * TAU, lo, -Math.PI / 2 + (i + 1) / 20 * TAU, lo, col, 0.45); }
      const q = toCam(cx, cy, cz); // the limb, in screen space
      if (q[2] > r) {
        const W = k.W, H = k.H, F = k.F, sx = W / 2 + q[0] * F / q[2], sy = H / 2 - q[1] * F / q[2], sr = r * F / Math.sqrt(q[2] * q[2] - r * r);
        for (let i = 0; i < 72; i++) { const a0 = i / 72 * TAU, a1 = (i + 1) / 72 * TAU; line2(sx + Math.cos(a0) * sr, sy + Math.sin(a0) * sr, sx + Math.cos(a1) * sr, sy + Math.sin(a1) * sr, col, 0.9); }
      }
    }
    function drawStation() {
      ori(stOri, 0, 0, spin); drawModel(STATION, stOri, 0, 0, 0, 16, C.white, 1, 2400);
      if (cam.z < -16) { // the slot, and a frame round it
        for (const [w, h, col, a] of [[0.42, 0.11, C.gold, 1], [0.5, 0.17, C.gold, 0.4]]) {
          const c = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => { const o = [0, 0, 0]; fwd(stOri, x * 16, y * 16, -16.05, o); return o; });
          for (let i = 0; i < 4; i++) { const p = c[i], n = c[(i + 1) % 4]; seg(p[0], p[1], p[2], n[0], n[1], n[2], col, a, 2400); }
        }
      }
    }
    function poly(cx, cy, r, ry, n, col, a) { for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; line2(cx + Math.cos(a0) * r, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * r, cy + Math.sin(a1) * ry, col, a); } }

    function draw() {
      const g = k.g, W = k.W, H = k.H, F = k.F, sc = Math.min(W / 1920, H / 1080), t = env.t;
      setCam(cam);
      if (state === 'hyper') { // rings rushing outward
        for (let i = 0; i < 14; i++) {
          const ph = (st * 0.9 + i / 14) % 1, r = 10 + ph * ph * W * 0.75;
          poly(W / 2, H / 2, r, r * 0.8, 40, i % 2 ? C.violet : C.ice, Math.min(1, ph * 6) * (1 - ph * 0.4) * (0.7 + env.pulse * 0.3));
        }
      } else if (state === 'docked') { // the bay, streaming past
        setCam({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
        for (let i = 0; i < 10; i++) {
          const z = 2 + ((i * 6 - st * 14) % 60 + 60) % 60, w = 8, h = 4.5;
          seg(-w, -h, z, w, -h, z, C.gold, 0.8, 70); seg(w, -h, z, w, h, z, C.gold, 0.8, 70); seg(w, h, z, -w, h, z, C.gold, 0.8, 70); seg(-w, h, z, -w, -h, z, C.gold, 0.8, 70);
          for (let x = -w; x <= w; x += 4) seg(x, -h, z, x, -h, z + 6, C.ice, 0.4, 70);
        }
      } else {
        drawPlanet(); drawStation();
        for (const p of pirates) {
          ori(shOri, Math.atan2(p.vx, p.vz), Math.atan2(p.vy, Math.hypot(p.vx, p.vz)), Math.sin(t * 1.3 + p.ph) * 0.6);
          drawModel(p.m, shOri, p.x, p.y, p.z, 2.6, p.col, 1, 600);
        }
        for (const d of debris) seg(d.a[0], d.a[1], d.a[2], d.b[0], d.b[1], d.b[2], d.col, Math.min(1, d.t), 600);
        for (const b of beams) seg(b.a[0], b.a[1], b.a[2], b.b[0], b.b[1], b.b[2], b.col, b.t * 4, 600);
        if (laser > 0) { // ours: two beams from under the screen corners into the sights
          const q = pirates[0] ? toCam(pirates[0].x, pirates[0].y, pirates[0].z) : [0, 0, 1], tx = W / 2 + q[0] * F / q[2], ty = H / 2 - q[1] * F / q[2];
          line2(W * 0.1, H, tx, ty, C.neon, 1); line2(W * 0.9, H, tx, ty, C.neon, 1); line2(W * 0.1 + 6, H, tx, ty, C.white, 0.6); line2(W * 0.9 - 6, H, tx, ty, C.white, 0.6);
        }
        const cx = W / 2, cy = H / 2, s = 14 * sc, gap = 6 * sc; // sights
        line2(cx - s - gap, cy, cx - gap, cy, C.white, 0.6); line2(cx + gap, cy, cx + s + gap, cy, C.white, 0.6); line2(cx, cy - s - gap, cx, cy - gap, C.white, 0.6); line2(cx, cy + gap, cx, cy + s + gap, C.white, 0.6);
      }

      // --- left: status ---
      const x0 = W * 0.02, y0 = H * 0.12, lh = 20 * sc, txt = (s, x, y, col, a) => { g.fillStyle = `rgba(${col},${a == null ? 0.9 : a})`; g.fillText(s, x, y); };
      g.font = `bold ${22 * sc | 0}px ${MONO}`; txt(state === 'hyper' ? next.name : sys.name, x0, y0, C.neon, 0.95);
      g.font = `${13 * sc | 0}px ${MONO}`;
      const S = state === 'hyper' ? next : sys;
      txt(`${S.gov}  TL ${S.tl}`, x0, y0 + lh * 1.2, C.gold, 0.8); txt(S.eco, x0, y0 + lh * 2.2, C.gold, 0.8);
      const cond = state === 'docked' ? ['DOCKED', C.ice] : pirates.length ? ['RED', C.hot] : offender > 0 ? ['YELLOW', C.gold] : ['GREEN', C.neon];
      txt('CONDITION', x0, y0 + lh * 4, C.white, 0.6); txt(cond[0], x0 + 150 * sc, y0 + lh * 4, cond[1], cond[0] === 'RED' ? 0.6 + env.pulse * 0.4 : 0.95);
      txt('LEGAL STATUS', x0, y0 + lh * 5, C.white, 0.6); txt(offender > 0 ? 'OFFENDER' : 'CLEAN', x0 + 150 * sc, y0 + lh * 5, offender > 0 ? C.hot : C.neon);
      txt('CREDITS', x0, y0 + lh * 6, C.white, 0.6); txt(`${shown.toFixed(1)} CR`, x0 + 150 * sc, y0 + lh * 6, C.gold);
      txt('FUEL', x0, y0 + lh * 7, C.white, 0.6); txt(`${fuel.toFixed(1)} LY`, x0 + 150 * sc, y0 + lh * 7, C.gold);
      txt('KILLS', x0, y0 + lh * 8, C.white, 0.6); txt(String(kills), x0 + 150 * sc, y0 + lh * 8, C.gold);
      txt('CARGO HOLD', x0, y0 + lh * 10, C.ice, 0.8);
      cargo.forEach(([n, tt], i) => { txt(n, x0, y0 + lh * (11 + i), C.ice, 0.7); txt(`${String(tt).padStart(2)}t`, x0 + 150 * sc, y0 + lh * (11 + i), C.ice, 0.7); });
      feed.forEach((f, i) => { if (f.t > 0) txt(f.s, x0, y0 + lh * (16 + i), f.col, Math.min(1, f.t)); });

      // --- right: the scanner, compass, bars ---
      const mx = W * 0.85, sx = W * 0.917, sy = H * 0.3, rx = 118 * sc, ry = 44 * sc, RG = 260;
      g.font = `bold ${16 * sc | 0}px ${MONO}`; txt(state === 'hyper' ? 'HYPERSPACE' : state === 'docked' ? 'STATION BAY' : 'FRONT VIEW', mx, H * 0.12, C.neon, 0.95);
      poly(sx, sy, rx, ry, 48, C.neon, 0.7); poly(sx, sy, rx * 0.5, ry * 0.5, 32, C.neon, 0.3);
      line2(sx - rx, sy, sx + rx, sy, C.neon, 0.3); line2(sx, sy - ry, sx, sy + ry, C.neon, 0.3);
      line2(sx, sy, sx - rx * 0.7, sy - ry * 0.7, C.neon, 0.25); line2(sx, sy, sx + rx * 0.7, sy - ry * 0.7, C.neon, 0.25);
      const blip = (x, y, z, col) => {
        const q = toCam(x, y, z); let bx = q[0] / RG, bz = q[2] / RG; const l = Math.hypot(bx, bz); if (l > 1) { bx /= l; bz /= l; }
        const px = sx + bx * rx, py = sy - bz * ry, top = py - Math.max(-1, Math.min(1, q[1] / RG)) * ry * 1.4;
        line2(px, py, px, top, col, 0.9); line2(px - 4 * sc, top, px + 4 * sc, top, col, 1); line2(px - 4 * sc, top + 1.5, px + 4 * sc, top + 1.5, col, 1);
      };
      if (state === 'cruise' || state === 'dock') { blip(0, 0, 0, C.ice); for (const p of pirates) blip(p.x, p.y, p.z, p.col); }
      // compass: where the station is
      const ccx = mx + 22 * sc, ccy = sy + ry + 52 * sc, cr = 20 * sc, q = toCam(0, 0, 0), ql = Math.hypot(q[0], q[1], q[2]) || 1;
      poly(ccx, ccy, cr, cr, 24, C.white, 0.6);
      if (state === 'cruise' || state === 'dock') { const dx = ccx + q[0] / ql * cr, dy = ccy - q[1] / ql * cr, col = q[2] > 0 ? C.neon : C.hot; line2(dx - 3, dy, dx + 3, dy, col, 1); line2(dx, dy - 3, dx, dy + 3, col, 1); }
      const bars = [['FS', fs / 100, C.ice], ['AS', as / 100, C.ice], ['FU', fuel / 7, C.gold], ['LT', laserHeat / 100, C.hot], ['SP', Math.min(1, speed / 60), C.neon], ['RL', 0.5 + wrapA(cam.roll) / TAU, C.violet]];
      g.font = `${12 * sc | 0}px ${MONO}`;
      bars.forEach(([n, v, col], i) => {
        const by = ccy + cr + 30 * sc + i * 18 * sc, bx = mx + 30 * sc, bw = 170 * sc;
        txt(n, mx, by + 9 * sc, C.white, 0.6); g.strokeStyle = `rgba(${col},0.4)`; g.strokeRect(bx, by, bw, 9 * sc);
        g.fillStyle = `rgba(${col},0.75)`; if (n === 'RL') g.fillRect(bx + v * bw - 2, by, 4, 9 * sc); else g.fillRect(bx, by, bw * Math.max(0, Math.min(1, v)), 9 * sc);
      });
      txt('STATION', mx + 52 * sc, ccy + 4 * sc, C.white, 0.5);
      if (hurt > 0) for (let i = 0; i < 3; i++) { const m = i * 6; line2(m, m, W - m, m, C.hot, hurt); line2(m, H - m, W - m, H - m, C.hot, hurt); line2(m, m, m, H - m, C.hot, hurt); line2(W - m, m, W - m, H - m, C.hot, hurt); }
    }

    return {
      label: 'FREE TRADER',
      update,
      draw,
      signal(kind) { // shields take it, your record is marked, and someone comes looking
        if (kind !== 'error') return;
        fs = Math.max(4, fs - 30); hurt = 1; offender = 90;
        if (state === 'cruise' && pirates.length < 4) { spawnPirate(pirates.length ? null : 'POLICE LANCE'); say('OFFENDER: VESSEL CLOSING', C.hot); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
