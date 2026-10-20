// TRENCH RUN: first person down a long wireframe trench in the old vector-arcade style. Duck the
// catwalks, laser the turrets on the walls and the rim, and every minute or so the exhaust port
// comes up: lock on, torpedo away, pull up, and watch the whole station go. Then the next run.
// A failed command gets a bolt through the shields.
(function (Worlds) {
  Worlds.define('trench', (k) => {
    const { C, rand, env, seg, setCam, line2, toCam, ship } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", HW = 9, TH = 13, SL = 8, FOG = 170, SR = 70, RED = '255,70,60';
    const hh = (i, n) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); }; // the trench, by slice
    const cam = { x: 0, y: 5, z: 0, yaw: 0, pitch: 0, roll: 0 };
    let phase, phaseT, runT, runDur, portZ, run = 0, score = 0, shield = 100, hurt = 0, downed = 0, kills = 0;
    let dead = new Set(), bolts = [], beams = [], bursts = [], torps = [], cool = 0;
    function newRun() {
      run++; phase = 'run'; phaseT = 0; runT = 0; runDur = rand(40, 60); portZ = Infinity; shield = 100; downed = 0;
      cam.y = 5; cam.pitch = 0; dead.clear(); bolts = []; torps = []; startSlice = Math.floor(cam.z / SL);
    }
    let startSlice = 0; newRun();

    // what stands in slice i
    const quiet = (i) => i < startSlice + 12 || i * SL > portZ - 130;
    const catwalk = (i) => !quiet(i) && hh(i, 1) < 0.07 ? (hh(i, 2) < 0.5 ? 8.5 : 2.4) : 0; // its underside
    const turret = (i) => { // [x, y, z, side] or null
      if (quiet(i) || hh(i, 3) > 0.28 || dead.has(i)) return null;
      const s = hh(i, 4) < 0.5 ? -1 : 1, rim = hh(i, 5) < 0.55;
      return [s * (rim ? HW + 1.6 : HW - 0.9), rim ? TH : 6 + hh(i, 6) * 4, i * SL + 4, s, rim];
    };
    function boom(x, y, z, col, r) { bursts.push({ x, y, z, col, t: 0, r: r || 1 }); }
    const speed = () => (phase === 'boom' ? 0 : 48 + env.level * 55);

    // --- the station, for the big finish: a wire sphere with a trench round its middle ----------
    const STATION = [];
    {
      const P = (la, lo, r) => [Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r];
      const add = (a, b) => STATION.push([...a, ...b, 8 + hh(STATION.length, 9) * 26]);
      for (let la = -75; la <= 75; la += 15) for (let j = 0; j < 32; j++) { if (Math.abs(la) < 1) continue; const l = la * Math.PI / 180; add(P(l, j * Math.PI / 16, SR), P(l, (j + 1) * Math.PI / 16, SR)); }
      for (let j = 0; j < 16; j++) for (let la = -90; la < 90; la += 15) add(P(la * Math.PI / 180, j * Math.PI / 8, SR), P((la + 15) * Math.PI / 180, j * Math.PI / 8, SR));
      for (const dy of [-1.5, 1.5]) for (let j = 0; j < 48; j++) add(P(dy / SR, j * Math.PI / 24, SR * 0.97), P(dy / SR, (j + 1) * Math.PI / 24, SR * 0.97));
      for (let j = 0; j < 24; j++) { // the dish, up and left
        const c = (a) => { const [x, y, z] = P(0.6 + Math.sin(a) * 0.22, -0.7 + Math.cos(a) * 0.26, SR * 1.001); return [x, y, z]; };
        add(c(j * Math.PI / 12), c((j + 1) * Math.PI / 12));
      }
    }
    const DIRS = Array.from({ length: 16 }, (_, i) => { const a = i * 2.4, b = Math.sin(i * 1.9) * 0.9; return [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)]; });

    function update(dt) {
      phaseT += dt; hurt = Math.max(0, hurt - dt * 1.6);
      for (const b of bursts) b.t += dt;
      bursts = bursts.filter((b) => b.t < 0.8 * b.r);
      if (phase === 'boom') { if (phaseT > 8) newRun(); return; }
      const v = speed(); cam.z += v * dt; runT += dt;
      // flying: weave, and duck or climb for the next catwalk
      const t = env.t, s0 = Math.floor(cam.z / SL);
      let wantY = 5.5;
      for (let i = s0 + 1; i < s0 + 1 + (60 + v * 0.6) / SL; i++) { const c = catwalk(i); if (c) { wantY = c > 5 ? 3.4 : 7.6; break; } }
      if (phase === 'pull') { wantY = 45; cam.pitch = Math.min(0.7, cam.pitch + dt * 0.6); }
      else if (phase === 'approach' && portZ - cam.z < 160) wantY = 4;
      cam.y += (wantY - cam.y) * Math.min(1, dt * 5);
      const nx = Math.sin(t * 0.7) * 3.2 + Math.sin(t * 1.9) * 0.8;
      cam.x = phase === 'run' ? nx : cam.x * (1 - dt * 2); // line up on the port
      cam.roll = phase === 'run' ? -(2.24 * Math.cos(t * 0.7) + 1.52 * Math.cos(t * 1.9)) * 0.04 : cam.roll * (1 - dt * 2); // bank into the weave
      if (phase === 'run' && runT > runDur) { phase = 'approach'; phaseT = 0; portZ = Math.ceil((cam.z + 420) / SL) * SL; }
      if (phase === 'approach' && portZ - cam.z < 70) { phase = 'pull'; phaseT = 0; for (const s of [-1, 1]) torps.push({ x: cam.x + s * 1.5, y: cam.y - 1.2, z: cam.z + 2, x0: cam.x + s * 1.5, y0: cam.y - 1.2, z0: cam.z + 2 }); }
      if (phase === 'pull' && torps.length) {
        for (const p of torps) { p.z += (v + 30) * dt; const f = Math.min(1, (p.z - p.z0) / (portZ - p.z0)); p.x = p.x0 * (1 - f); p.y = p.y0 * (1 - f * f) + 0.3; }
        if (torps[0].z >= portZ) { boom(0, 0.5, portZ, C.gold, 2.5); torps = []; score += 5000; phaseT = 0; }
      }
      if (phase === 'pull' && !torps.length && phaseT > 1.1) { phase = 'boom'; phaseT = 0; bolts = []; beams = []; }
      // the turrets fire back (they mostly miss)
      for (let i = s0 + 4; i < s0 + 16; i++) {
        const tu = turret(i); if (!tu || Math.random() > dt * (0.5 + env.level * 1.5)) continue;
        const tx = cam.x + rand(-3, 3), ty = cam.y + rand(-2, 3), tz = cam.z + v * 0.6, dx = tx - tu[0], dy = ty - tu[1] - 1, dz = tz - tu[2], d = Math.hypot(dx, dy, dz);
        bolts.push({ x: tu[0], y: tu[1] + 1, z: tu[2], vx: dx / d * 70, vy: dy / d * 70, vz: dz / d * 70, t: 2 });
      }
      for (const b of bolts) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.t -= dt; }
      bolts = bolts.filter((b) => b.t > 0 && b.z > cam.z - 2);
      // our lasers: both guns converge on the nearest turret in range
      cool -= dt;
      if (cool < 0 && phase !== 'pull') {
        for (let i = s0 + 3; i < s0 + 12; i++) {
          const tu = turret(i); if (!tu) continue;
          beams.push({ x: tu[0], y: tu[1] + 1, z: tu[2], t: 0.22 }); boom(tu[0], tu[1] + 1, tu[2], C.gold, 1.4);
          dead.add(i); downed++; kills++; score += 250; cool = rand(0.25, 0.6) / (0.8 + env.level); break;
        }
        if (cool < -1.2) { beams.push({ x: cam.x, y: cam.y, z: cam.z + 60, t: 0.18 }); cool = rand(0.3, 1); } // and the odd speculative shot
      }
      for (const b of beams) b.t -= dt;
      beams = beams.filter((b) => b.t > 0);
      for (const d of dead) if (d < s0 - 2) dead.delete(d);
      shield = Math.min(100, shield + dt * 1.5);
    }

    // --- drawing -------------------------------------------------------------------------------
    function rect(x, y0, y1, z0, z1, col, a) { seg(x, y0, z0, x, y0, z1, col, a, FOG); seg(x, y1, z0, x, y1, z1, col, a, FOG); seg(x, y0, z0, x, y1, z0, col, a, FOG); seg(x, y0, z1, x, y1, z1, col, a, FOG); }
    function boxL(x0, y0, z0, x1, y1, z1, col, a) {
      for (const y of [y0, y1]) { seg(x0, y, z0, x1, y, z0, col, a, FOG); seg(x1, y, z0, x1, y, z1, col, a, FOG); seg(x1, y, z1, x0, y, z1, col, a, FOG); seg(x0, y, z1, x0, y, z0, col, a, FOG); }
      for (const x of [x0, x1]) for (const z of [z0, z1]) seg(x, y0, z, x, y1, z, col, a, FOG);
    }
    function trench() {
      const s0 = Math.floor(cam.z / SL), end = portZ + 24, pa = 0.75 + env.pulse * 0.25;
      for (let i = s0; i < s0 + FOG / SL; i++) {
        const z0 = i * SL, z1 = z0 + SL; if (z0 >= end) break;
        seg(-HW, 0, z0, HW, 0, z0, C.ice, 0.5, FOG);
        for (const s of [-1, 1]) {
          const x = s * HW;
          seg(x, 0, z0, x, TH, z0, C.ice, 0.6, FOG);
          for (let y = 0; y <= TH; y += TH / 3) seg(x, y, z0, x, y, z1, C.ice, y === TH ? pa : 0.7, FOG);
          for (let r = 0; r < 3; r++) if (hh(i, 10 + r + s) < 0.5) { // panels, set into the wall
            const y0 = 0.8 + r * 4.2, y1 = y0 + 2.6 + hh(i, 20 + r) * 0.8, q = s * (HW - 0.5);
            rect(x, y0, y1, z0 + 1, z1 - 1, C.violet, 0.55); rect(q, y0 + 0.4, y1 - 0.4, z0 + 1.6, z1 - 1.6, C.violet, 0.4);
          }
          if (hh(i, 30 + s) < 0.3) { const w = 1 + hh(i, 32) * 3, h = 1.5 + hh(i, 33) * 5, xo = x + s * (1 + hh(i, 34) * 6); boxL(xo - w / 2, TH, z0 + 1, xo + w / 2, TH + h, z0 + 1 + w, C.ice, 0.55); } // rim towers
        }
        for (let x = -HW / 2; x < HW; x += HW / 2) seg(x, 0, z0, x, 0, z1, C.ice, 0.45, FOG);
        const c = catwalk(i); if (c) { boxL(-HW, c, z0 + 3, HW, c + 1.2, z0 + 5, C.white, 0.9); seg(-HW, c + 0.6, z0 + 3, HW, c + 0.6, z0 + 5, C.white, 0.5, FOG); }
        const tu = turret(i);
        if (tu) { // a squat tower with a barrel, swinging to track us
          const [x, y, z, s, rim] = tu, w = rim ? 1.3 : 0.9, ox = rim ? 0 : -s * w;
          boxL(x + ox - w, y, z - w, x + ox + w, y + (rim ? 2.2 : 1.2), z + w, C.gold, 0.95);
          const ax = (cam.x - x) * 0.06, ay = (cam.y - y) * 0.04;
          seg(x + ox, y + 1.4, z - w, x + ox + ax - s * 0.3, y + 1.4 + ay, z - w - 2.2, C.gold, 1, FOG);
        }
      }
      if (portZ < Infinity) { // the end wall, and the port in the floor before it
        for (let y = 0; y <= TH; y += TH / 4) seg(-HW, y, end, HW, y, end, C.ice, 0.7, FOG);
        for (let x = -HW; x <= HW; x += HW / 3) seg(x, 0, end, x, TH, end, C.ice, 0.5, FOG);
        for (const r of [3, 2, 1]) { const a = r === 1 ? 1 : 0.8; seg(-r, 0.05, portZ - r, r, 0.05, portZ - r, C.gold, a, FOG); seg(r, 0.05, portZ - r, r, 0.05, portZ + r, C.gold, a, FOG); seg(r, 0.05, portZ + r, -r, 0.05, portZ + r, C.gold, a, FOG); seg(-r, 0.05, portZ + r, -r, 0.05, portZ - r, C.gold, a, FOG); }
      }
    }
    function station() {
      const T = phaseT, B = T - 1, spin = T * 0.06, cs = Math.cos(spin), sn = Math.sin(spin);
      setCam(k.lookAt({ x: -45, y: 80, z: -170, yaw: 0, pitch: 0, roll: 0.15 }, 0, 0, 0));
      for (const [x1, y1, z1, x2, y2, z2, v] of STATION) { // after the blast the shell flies apart
        let ox = 0, oy = 0, oz = 0, a = 0.85;
        if (B > 0) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, mz = (z1 + z2) / 2, f = v * B / SR; ox = mx * f; oy = my * f; oz = mz * f; a = Math.max(0, 1 - B / 5.5); }
        if (a > 0.03) seg(x1 * cs + z1 * sn + ox, y1 + oy, -x1 * sn + z1 * cs + oz, x2 * cs + z2 * sn + ox, y2 + oy, -x2 * sn + z2 * cs + oz, B > 0 ? C.gold : C.ice, a, 900);
      }
      if (B < 0) { const r = 4 + T * T * 14; for (const d of DIRS) seg(d[0] * 0.2, d[1] * 0.2 + 0, -SR + d[2] * 0.2, d[0] * r, d[1] * r, -SR + d[2] * r, C.white, 1, 900); return; }
      // the blast: a white shell, a flat shockwave ring, rays
      const R1 = SR * 0.4 + B * 60, R2 = SR + B * 120, a1 = Math.max(0, 1 - B / 3.5), a2 = Math.max(0, 1 - B / 6.5);
      for (let j = 0; j < 40; j++) {
        const p = j * Math.PI / 20, q = p + Math.PI / 20;
        if (a1 > 0.03) for (const la of [-0.6, 0, 0.6]) { const c = Math.cos(la) * R1, y = Math.sin(la) * R1; seg(Math.cos(p) * c, y, Math.sin(p) * c, Math.cos(q) * c, y, Math.sin(q) * c, C.white, a1, 900); }
        if (a2 > 0.03) { seg(Math.cos(p) * R2, Math.sin(p) * R2 * 0.12, Math.sin(p) * R2, Math.cos(q) * R2, Math.sin(q) * R2 * 0.12, Math.sin(q) * R2, C.hot, a2, 900); seg(Math.cos(p) * R2 * 0.8, 0, Math.sin(p) * R2 * 0.8, Math.cos(q) * R2 * 0.8, 0, Math.sin(q) * R2 * 0.8, C.gold, a2 * 0.7, 900); }
      }
      if (a1 > 0.03) for (const d of DIRS) seg(d[0] * R1 * 0.5, d[1] * R1 * 0.5, d[2] * R1 * 0.5, d[0] * R1 * 1.6, d[1] * R1 * 1.6, d[2] * R1 * 1.6, C.gold, a1, 900);
      const sz = -40 - T * 40; ship(-20 + T * 4, 40 + T * 3, sz, Math.PI, 3, C.neon, 0.9, 0.3); // and away
    }

    return {
      label: 'TRENCH RUN',
      update,
      signal(kind) { // a failed command: a bolt through the shields
        if (kind !== 'error' || phase === 'boom') return;
        shield = Math.max(0, shield - 30); hurt = 1;
        bolts.push({ x: cam.x + 6, y: cam.y + 6, z: cam.z + 30, vx: -12, vy: -12, vz: speed() - 60, t: 0.5 });
      },
      draw() {
        const W = k.W, H = k.H, g = k.g, sc = Math.min(W / 1920, H / 1080), t = env.t;
        if (phase === 'boom') station();
        else {
          setCam(cam); trench();
          for (const b of bolts) seg(b.x, b.y, b.z, b.x - b.vx * 0.04, b.y - b.vy * 0.04, b.z - b.vz * 0.04, C.hot, 1, FOG);
          for (const p of torps) { seg(p.x - 0.3, p.y, p.z, p.x + 0.3, p.y, p.z, C.white, 1, FOG); seg(p.x, p.y - 0.3, p.z, p.x, p.y + 0.3, p.z, C.white, 1, FOG); seg(p.x, p.y, p.z, p.x, p.y, p.z - 3, C.gold, 0.7, FOG); }
          for (const b of beams) for (const s of [-1, 1]) { // from both guns, converging
            const gx = cam.x + s * 3.5, gy = cam.y - 2.2, gz = cam.z + 1;
            seg(gx, gy, gz, b.x, b.y, b.z, C.neon, Math.min(1, b.t * 6), 400); seg(gx, gy - 0.15, gz, b.x, b.y, b.z, C.white, Math.min(1, b.t * 4), 400);
          }
        }
        for (const b of bursts) { const r = b.t * 9 * b.r, a = 1 - b.t / (0.8 * b.r); for (const d of DIRS) seg(b.x + d[0] * r * 0.4, b.y + d[1] * r * 0.4, b.z + d[2] * r * 0.4, b.x + d[0] * r, b.y + d[1] * r, b.z + d[2] * r, b.col, a, FOG); }
        // the port's target box
        if (phase === 'approach' && portZ - cam.z < 230) {
          const p = toCam(0, 0, portZ);
          if (p[2] > 1) {
            const x = W / 2 + p[0] * k.F / p[2], y = H / 2 - p[1] * k.F / p[2], r = Math.max(14, 3.5 * k.F / p[2]) + 10, c = 0.4 * r;
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { line2(x + sx * r, y + sy * r, x + sx * (r - c), y + sy * r, C.gold, 1); line2(x + sx * r, y + sy * r, x + sx * r, y + sy * (r - c), C.gold, 1); }
          }
        }

        // HUD, in the margins
        const x0 = W * 0.02, y0 = H * 0.12, xr = W * 0.855;
        g.font = `bold ${16 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.95)`; g.fillText(`TRENCH RUN ${String(run).padStart(2, '0')}`, x0, y0);
        g.font = `bold ${30 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(String(score).padStart(7, '0'), x0, y0 + 40 * sc);
        g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.75)`;
        g.fillText(`TURRETS DOWN  ${String(downed).padStart(3)}`, x0, y0 + 68 * sc); g.fillText(`TOTAL         ${String(kills).padStart(3)}`, x0, y0 + 88 * sc);
        g.fillStyle = `rgba(${shield < 35 ? C.hot : C.neon},0.9)`; g.fillText('SHIELDS', x0, y0 + 124 * sc);
        for (let i = 0; i < 10; i++) { // the shield bar, in blocks
          const bx = x0 + i * 22 * sc, by = y0 + 134 * sc, on = shield > i * 10, col = shield < 35 ? C.hot : C.neon;
          line2(bx, by, bx + 16 * sc, by, col, on ? 1 : 0.25); line2(bx, by + 12 * sc, bx + 16 * sc, by + 12 * sc, col, on ? 1 : 0.25);
          line2(bx, by, bx, by + 12 * sc, col, on ? 1 : 0.25); line2(bx + 16 * sc, by, bx + 16 * sc, by + 12 * sc, col, on ? 1 : 0.25);
          if (on) for (let yy = 3; yy < 12; yy += 3) line2(bx + 2, by + yy * sc, bx + 16 * sc - 2, by + yy * sc, col, 0.6);
        }
        g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`;
        g.fillText(`SPEED  ${String(Math.round(speed() * 9)).padStart(4)}`, xr, y0);
        const range = phase === 'run' ? '----' : phase === 'approach' ? String(Math.max(0, Math.round(portZ - cam.z) * 3)).padStart(4, '0') : '0000';
        g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('EXHAUST PORT', xr, y0 + 30 * sc); g.fillText(`RANGE  ${range}`, xr, y0 + 50 * sc);
        const blink = 0.55 + 0.45 * Math.sin(t * 14);
        let m = '', mc = C.gold;
        if (phase === 'approach') m = portZ - cam.z < 230 ? 'TARGET LOCKED' : 'PORT AHEAD';
        else if (phase === 'pull') m = torps.length ? 'TORPEDO AWAY' : 'PULL UP';
        else if (phase === 'boom') { m = phaseT > 1 ? 'STATION DESTROYED' : 'DIRECT HIT'; mc = C.hot; }
        else if (hurt > 0) { m = 'SHIELD HIT'; mc = C.hot; }
        if (m) { g.font = `bold ${20 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${mc},${blink})`; g.fillText(m, xr, y0 + 94 * sc); }
        if (phase === 'boom' && phaseT > 1.5) { g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.8)`; g.fillText('BONUS  5000', xr, y0 + 120 * sc); g.fillText(`NEXT RUN ${Math.max(0, 8 - phaseT) | 0}`, xr, y0 + 140 * sc); }
        if (hurt > 0) for (let i = 0; i < 4; i++) { const q = i * 6; line2(q, q, W - q, q, RED, hurt); line2(q, H - q, W - q, H - q, RED, hurt); line2(q, q, q, H - q, RED, hurt); line2(W - q, q, W - q, H - q, RED, hurt); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
