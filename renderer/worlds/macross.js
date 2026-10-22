// MISSILE CIRCUS: a variable fighter out ahead of us, weaving through a sky full of missiles.
// It fires volleys that corkscrew out on long white smoke trails and curl onto the enemy pods,
// and the pods fire back: red trails that come at us and scream past. Every so often the fighter
// half-transforms, legs down, to brake and dodge. The fortress hangs far off. Activity is the
// size of the volleys.
(function (Worlds) {
  Worlds.define('macross', (k) => {
    const { C, rand, pick, env, seg, setCam, toCam, line2, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 260, TRAIL = 22, MAX = 70;
    let missiles = [], bits = [], pods = [], cool = 1, ecool = 2, gw = 0, gwT = rand(14, 24), stock = 1200, kills = 0;
    const fighter = { x: 0, y: 0, z: 24, roll: 0 };
    function newPod() { return { x: rand(-60, 60), y: rand(-15, 25), z: rand(90, 170), ph: rand(0, 6), v: rand(0.3, 0.8) }; }
    for (let i = 0; i < 6; i++) pods.push(newPod());
    function launch(from, tgt, col, mine) {
      if (missiles.length >= MAX) return;
      const d = [tgt.x - from.x, tgt.y - from.y, tgt.z - from.z], l = Math.hypot(...d) || 1, sp = mine ? 45 : 55;
      const kick = mine ? [rand(-30, 30), rand(5, 30), rand(-5, 10)] : [rand(-12, 12), rand(-12, 12), 0]; // fan out, then curl in
      missiles.push({ x: from.x, y: from.y, z: from.z, vx: d[0] / l * sp + kick[0], vy: d[1] / l * sp + kick[1], vz: d[2] / l * sp + kick[2], tgt, col, mine, sp, ph: rand(0, 6), t: 0, tr: [], acc: 0 });
    }
    function boom(x, y, z, col, n) { for (let i = 0; i < n; i++) bits.push({ x, y, z, vx: rand(-16, 16), vy: rand(-16, 16), vz: rand(-16, 16), t: rand(0.4, 1.1), col }); }
    // the fighter: nose +z, swept wings, twin fins; gerwalk drops the legs and tilts it up
    function drawFighter(f, t) {
      const cr = Math.cos(f.roll), sr = Math.sin(f.roll), pitch = gw * 0.35, cp = Math.cos(pitch), sp = Math.sin(pitch);
      const P = (x, y, z) => { const y1 = y * cp + z * sp, z1 = z * cp - y * sp; return [f.x + x * cr - y1 * sr, f.y + x * sr + y1 * cr, f.z + z1]; };
      const L = (a, b, col, al) => seg(...P(...a), ...P(...b), col || C.white, al || 0.95, FOG);
      const N = [0, 0, 3.2], Ck = [0, 0.5, 1.2];
      L(N, [0.5, 0, 0]); L(N, [-0.5, 0, 0]); L(N, Ck); L(Ck, [0, 0.4, -0.5]);
      for (const sx of [-1, 1]) {
        L([sx * 0.5, 0, 0.6], [sx * 3.4, 0, -1.4]); L([sx * 3.4, 0, -1.4], [sx * 0.8, 0, -1.6]); // the wing
        L([sx * 0.5, 0, 0], [sx * 0.6, 0, -2.4]); L([sx * 0.6, 0, -2.4], [sx * 0.6, 1.3, -2.8]); L([sx * 0.6, 1.3, -2.8], [sx * 0.6, 0, -1.8], C.ice); // body and fin
        const leg = gw * 2.2, ex = sx * 0.6; // the engines become legs
        L([ex, -0.2, -1.2], [ex, -0.2 - leg, -1.2 - leg * 0.3], C.ice); L([ex, -0.2 - leg, -1.2 - leg * 0.3], [ex, -0.2 - leg, -0.5 - leg * 0.3], C.ice);
        L([ex, -0.2, -2.6], [ex, -0.2, -2.6 - 1 + gw], C.hot, 0.6 + env.pulse * 0.4); // exhaust
      }
      if (gw > 0.5) for (const sx of [-1, 1]) L([sx * 0.6, 0.1, 0.2], [sx * 1.4, -0.6 * gw, 0.9], C.gold); // arms
    }
    function drawPod(p, t) {
      for (let i = -1; i <= 1; i++) ring(p.x, p.y + i * 0.9, p.z, 2 - Math.abs(i) * 0.6, 10, C.hot, 0.8, FOG, 'xy');
      seg(p.x - 1.4, p.y - 0.5, p.z, p.x - 2, p.y - 3.5 + Math.sin(t * 3 + p.ph) * 0.4, p.z, C.hot, 0.7, FOG); seg(p.x + 1.4, p.y - 0.5, p.z, p.x + 2, p.y - 3.5 - Math.sin(t * 3 + p.ph) * 0.4, p.z, C.hot, 0.7, FOG);
      seg(p.x - 0.4, p.y + 0.4, p.z - 1, p.x + 0.4, p.y + 0.4, p.z - 1, C.gold, 1, FOG); // the eye
    }
    return {
      label: 'MISSILE CIRCUS',
      update(dt) {
        const t = env.t;
        fighter.x = Math.sin(t * 0.6) * 8 + Math.sin(t * 1.7) * 2; fighter.y = Math.sin(t * 0.45) * 4 - 2;
        fighter.roll = -Math.cos(t * 0.6) * 0.5 - Math.cos(t * 1.7) * 0.25;
        gwT -= dt; if (gwT < 0) gwT = rand(14, 24);
        gw += ((gwT < 5 ? 1 : 0) - gw) * Math.min(1, dt * 2);
        cool -= dt; ecool -= dt;
        if (cool < 0) { // a volley at a pod
          const p = pick(pods), n = 6 + Math.round(env.level * 14);
          for (let i = 0; i < n; i++) launch(fighter, p, C.white, true);
          stock = Math.max(0, stock - n); if (!stock) stock = 1200; cool = rand(2, 4) / (0.6 + env.level);
        }
        if (ecool < 0) { const p = pick(pods); for (let i = 0; i < 4 + env.level * 6; i++) launch(p, { x: rand(-14, 14), y: rand(-8, 8), z: -10 }, C.hot, false); ecool = rand(2, 5); }
        for (const p of pods) { p.x += Math.sin(t * p.v + p.ph) * dt * 4; p.y += Math.cos(t * p.v * 1.3 + p.ph) * dt * 2; }
        for (const m of missiles) {
          m.t += dt;
          if (m.mine || m.z > 10) { // home in, a little harder each second
            const d = [m.tgt.x - m.x, m.tgt.y - m.y, m.tgt.z - m.z], l = Math.hypot(...d) || 1, turn = Math.min(1, dt * (1 + m.t * 2));
            m.vx += (d[0] / l * m.sp - m.vx) * turn; m.vy += (d[1] / l * m.sp - m.vy) * turn; m.vz += (d[2] / l * m.sp - m.vz) * turn;
          }
          m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
          m.acc += dt;
          if (m.acc > 0.04) { m.acc = 0; const w = m.t * 9 + m.ph, r = 0.7; m.tr.push([m.x + Math.cos(w) * r, m.y + Math.sin(w) * r, m.z]); if (m.tr.length > TRAIL) m.tr.shift(); }
          if (m.mine && Math.hypot(m.tgt.x - m.x, m.tgt.y - m.y, m.tgt.z - m.z) < 2.5) {
            m.dead = true; boom(m.x, m.y, m.z, pick([C.gold, C.hot, C.white]), 6);
            if (!m.tgt.dead) { m.tgt.dead = true; kills++; boom(m.tgt.x, m.tgt.y, m.tgt.z, C.gold, 18); }
          }
          if (m.t > 7 || m.z < -15) m.dead = true;
        }
        for (const m of missiles) if (m.dead) m.tr.shift(); // a spent missile's trail burns away from the tail
        missiles = missiles.filter((m) => !m.dead || m.tr.length > 1);
        pods = pods.map((p) => (p.dead ? newPod() : p));
        for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.t -= dt; }
        bits = bits.filter((b) => b.t > 0);
      },
      draw() {
        const t = env.t;
        setCam({ x: fighter.x * 0.3, y: 3 + fighter.y * 0.3, z: 0, yaw: Math.sin(t * 0.2) * 0.05, pitch: -0.03, roll: fighter.roll * 0.15 });
        // the fortress, far off: a long hull, two booms forward, a tower
        const fx = -70, fy = 30, fz = 420;
        const F = (a, b, c, d, e, f) => seg(fx + a, fy + b, fz + c, fx + d, fy + e, fz + f, C.violet, 0.55, 700);
        F(-60, 0, 0, 60, 0, 0); F(-60, -14, 0, 50, -14, 0); F(-60, 0, 0, -60, -14, 0); F(60, 0, 0, 50, -14, 0);
        for (const by of [3, -17]) { F(60, by, 0, 120, by, 0); F(60, by + 2, 0, 120, by + 2, 0); F(120, by, 0, 120, by + 2, 0); }
        F(-10, 0, 0, -10, 30, 0); F(5, 0, 0, 5, 30, 0); F(-10, 30, 0, 5, 30, 0); F(-20, 22, 0, 15, 22, 0);
        for (const p of pods) drawPod(p, t);
        for (const m of missiles) {
          const tr = m.tr, n = tr.length;
          for (let i = 1; i < n; i++) seg(...tr[i - 1], ...tr[i], m.col, (i / n) * (m.dead ? 0.5 : 0.9), FOG);
          if (!m.dead) seg(m.x, m.y, m.z, m.x - m.vx * 0.02, m.y - m.vy * 0.02, m.z - m.vz * 0.02, m.mine ? C.gold : C.white, 1, FOG);
        }
        for (const b of bits) seg(b.x, b.y, b.z, b.x + b.vx * 0.05, b.y + b.vy * 0.05, b.z + b.vz * 0.05, b.col, Math.min(1, b.t * 2), FOG);
        drawFighter(fighter, t);
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.95)`; g.fillText(`VF-1  ::  ${gw > 0.5 ? 'GERWALK' : 'FIGHTER'}`, 28 * s, 40 * s);
      g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(`MISSILES ${String(stock).padStart(4, '0')}`, 28 * s, 64 * s);
      g.fillStyle = `rgba(${C.hot},0.9)`; g.fillText(`DOWNED ${String(kills).padStart(4, '0')}`, 28 * s, 88 * s);
      // lock-on: a box round every pod we can see, and the list in the top-right corner
      let row = 0;
      for (const p of pods) {
        const c = toCam(p.x, p.y, p.z); if (c[2] < 1) continue;
        const sx = W / 2 + c[0] * k.F / c[2], sy = H / 2 - c[1] * k.F / c[2], r = Math.max(8, 3 * k.F / c[2]), spin = env.t * 2 + p.ph;
        const col = missiles.some((m) => m.tgt === p && !m.dead) ? C.hot : C.neon;
        for (let i = 0; i < 4; i++) { const a = spin + i * Math.PI / 2, b = a + Math.PI / 2; line2(sx + Math.cos(a) * r, sy + Math.sin(a) * r, sx + Math.cos(b) * r, sy + Math.sin(b) * r, col, 0.7); }
        const txt = `LOCK ${String(row + 1).padStart(2, '0')}  ${Math.round(Math.hypot(p.x, p.y, p.z))}M`;
        g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${col},0.9)`;
        g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 1.5;
        const y = (40 + row * 22) * s, x = W - 28 * s - g.measureText(txt).width;
        g.strokeRect(x - 20 * s, y - 11 * s, 12 * s, 12 * s); g.fillText(txt, x, y); row++;
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
