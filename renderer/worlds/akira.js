// NEO-TOKYO: low behind a long red bike at night, down an elevated highway through a ruined
// megacity. The tail light draws a long red streak as it weaves; rival bikes come past with their
// own trails. Overhead gantries, tunnel stretches, the crater dome far off. Now and then the
// power-slide: the bike swings broadside, skids to a stop with its trail sweeping round, and
// takes off again. Your activity is the throttle.
(function (Worlds) {
  Worlds.define('akira', (k) => {
    const { C, rand, env, seg, setCam, lookAt, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 230, RED = '255,40,40', HW = 11, TUN = 700, TUNL = 160;
    const hash = (n, s) => { let x = Math.imul(n * 374761393 + s * 668265263, 1274126177); x ^= x >>> 13; return (Math.imul(x, 1103515245) >>> 0) / 4294967296; };
    const bike = { x: 0, z: 0, v: 20, yaw: 0, lean: 0, trail: [] };
    let phase = 'ride', pt = 0, rideFor = rand(15, 25), weave = 0, camX = 0;
    const rivals = [C.ice, C.gold, C.neon].map((col) => ({ col, x: rand(-8, 8), dz: rand(-30, -10), v: rand(4, 9), trail: [] }));
    const SIGNS = ['NEO TOKYO 2019', 'EXIT 3  SHINJUKU', 'ネオ東京', 'CAPSULES ONLY', 'MILITARY ZONE  ->'];

    // the bike: long and low, nose +z; drawn in its own frame, yawed (slide) and leaned (weave)
    const BODY = [[0, 0.35, 1.9], [0, 0.95, 1.4], [0, 1.0, 0.2], [0, 0.8, -0.6], [0, 0.85, -1.6], [0, 0.4, -1.9]];
    function drawBike(b, col, al) {
      const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw), cl = Math.cos(b.lean), sl = Math.sin(b.lean);
      const P = (x, y, z) => { const rx = x * cl - y * sl, ry = x * sl + y * cl; return [b.x + rx * cy + z * sy, ry, b.z - rx * sy + z * cy]; };
      const L = (p, q, c, a) => seg(...P(...p), ...P(...q), c || col, a || al, FOG);
      for (const sx of [-0.45, 0.45]) for (let i = 0; i < BODY.length - 1; i++) L([sx, BODY[i][1], BODY[i][2]], [sx, BODY[i + 1][1], BODY[i + 1][2]]);
      for (const [, y, z] of BODY) L([-0.45, y, z], [0.45, y, z]);
      for (const wz of [1.3, -1.3]) { let p = null; for (let a = 0; a <= 10; a++) { const t = a / 10 * Math.PI * 2, q = [0, 0.38 + Math.sin(t) * 0.38, wz + Math.cos(t) * 0.38]; if (p) L(p, q, C.white, 0.6); p = q; } }
      L([-0.3, 0.75, -1.95], [0.3, 0.75, -1.95], RED, 1); // tail light
      return P(0, 0.75, -1.95);
    }
    function pushTrail(tr, p, n) { tr.push(p); if (tr.length > n) tr.shift(); }
    function drawTrail(tr, col) {
      for (let i = 1; i < tr.length; i++) { const a = tr[i - 1], b = tr[i]; seg(...a, ...b, col, i / tr.length, FOG); }
    }
    const inTunnel = (z) => ((z % TUN) + TUN) % TUN < TUNL;

    return {
      label: 'NEO-TOKYO',
      update(dt) {
        pt += dt;
        const cruise = 24 + env.level * 36;
        if (phase === 'ride') {
          bike.v += (cruise - bike.v) * dt * 0.8; weave += dt * (0.6 + env.level * 0.6);
          const nx = Math.sin(weave) * 5 + Math.sin(weave * 2.3) * 2;
          bike.lean = -(nx - bike.x) / dt * 0.02; bike.lean = Math.max(-0.5, Math.min(0.5, bike.lean)); bike.x = nx;
          if (pt > rideFor && !inTunnel(bike.z + 60)) { phase = 'slide'; pt = 0; bike.dir = bike.x > 0 ? -1 : 1; }
        } else if (phase === 'slide') { // swing broadside and skid to a stop
          bike.yaw += (bike.dir * 1.45 - bike.yaw) * dt * 4; bike.lean = bike.dir * 0.5 * Math.min(1, pt);
          bike.v = Math.max(0, bike.v - dt * 22); bike.x += bike.dir * -bike.v * dt * 0.15;
          if (bike.v === 0 && pt > 2.6) { phase = 'go'; pt = 0; }
        } else if (phase === 'go') {
          bike.yaw *= 1 - dt * 3; bike.lean *= 1 - dt * 3; bike.v += dt * 18;
          if (pt > 1.5) { phase = 'ride'; pt = 0; rideFor = rand(15, 25); weave = Math.asin(Math.max(-1, Math.min(1, bike.x / 7))); }
        }
        bike.z += bike.v * dt;
        const tl = drawBikePos(); pushTrail(bike.trail, tl, 70);
        for (const r of rivals) {
          r.dz += (cruise + r.v - bike.v) * dt; r.x += Math.sin(env.t * 1.3 + r.v) * dt * 4; // rivals hold their pace; we slow, they pass
          r.x = Math.max(-HW + 1.5, Math.min(HW - 1.5, r.x));
          if (r.dz > 140) { r.dz = rand(-30, -14); r.x = rand(-8, 8); r.v = rand(4, 10); r.trail = []; }
          pushTrail(r.trail, [r.x, 0.75, bike.z + r.dz - 1.95], 50);
        }
        camX += (bike.x * 0.5 - camX) * Math.min(1, dt * 2);
      },
      draw() {
        const t = env.t, cz = bike.z - 8.5;
        setCam(lookAt({ x: camX, y: 1.9 + Math.sin(t * 0.3) * 0.2, z: cz }, bike.x * 0.7, 1.1, bike.z + 14));
        const s0 = Math.floor(cz / 8) * 8;
        for (let z = s0; z < cz + FOG; z += 8) {
          const zi = z / 8;
          seg(-HW, 0, z, -HW, 0, z + 8, C.white, 0.6, FOG); seg(HW, 0, z, HW, 0, z + 8, C.white, 0.6, FOG);
          if (zi % 2 === 0) for (const lx of [-HW / 3, HW / 3]) seg(lx, 0, z, lx, 0, z + 4, C.gold, 0.6, FOG);
          if (inTunnel(z)) { // tunnel: a ring of frames and a row of strip lights
            seg(-HW, 0, z, -HW, 7, z, C.ice, 0.6, FOG); seg(HW, 0, z, HW, 7, z, C.ice, 0.6, FOG); seg(-HW, 7, z, HW, 7, z, C.ice, 0.6, FOG);
            seg(-2, 6.9, z + 1, 2, 6.9, z + 1, C.gold, 0.9, FOG);
            continue;
          }
          if (zi % 4 === 0) for (const sx of [-1, 1]) { seg(sx * (HW + 1), 0, z, sx * (HW + 1), 6, z, C.violet, 0.5, FOG); seg(sx * (HW + 1), 6, z, sx * (HW - 2), 6.4, z, C.violet, 0.5, FOG); }
          if (zi % 14 === 0) { // gantry with a sign
            seg(-HW - 1, 0, z, -HW - 1, 8, z, C.ice, 0.7, FOG); seg(HW + 1, 0, z, HW + 1, 8, z, C.ice, 0.7, FOG); seg(-HW - 1, 8, z, HW + 1, 8, z, C.ice, 0.7, FOG);
            text3(SIGNS[Math.floor(hash(zi, 3) * SIGNS.length)], -5, 6.8, z, C.neon, 1, 0.9);
          }
          if (zi % 3 === 0) for (const sx of [-1, 1]) { // the ruined city, both sides
            const x = sx * (22 + hash(zi, sx + 5) * 26), w = 6 + hash(zi, 8) * 8, hgt = 15 + hash(zi, sx + 9) * 60, br = hash(zi, sx + 11) * 12;
            const col = hash(zi, 2) < 0.25 ? C.hot : C.violet;
            seg(x - w / 2, 0, z, x - w / 2, hgt, z, col, 0.55, FOG); seg(x + w / 2, 0, z, x + w / 2, hgt - br, z, col, 0.55, FOG);
            seg(x - w / 2, hgt, z, x, hgt - br * 0.3, z, col, 0.55, FOG); seg(x, hgt - br * 0.3, z, x + w / 2, hgt - br, z, col, 0.55, FOG); // a broken top
            for (let y = 6; y < hgt - br; y += 6) if (hash(zi * 7 + y, sx) < 0.4) seg(x - w / 2 + 1, y, z, x + w / 2 - 1, y, z, C.gold, 0.35, FOG);
          }
        }
        // the crater dome, far off to the right
        const dz = cz + 300, dx = 90;
        for (let m = 0; m < 10; m++) { const a = m / 10 * Math.PI; let p = null; for (let e = 0; e <= 8; e++) { const el = e / 8 * Math.PI / 2, q = [dx + Math.cos(a) * Math.cos(el) * 70, Math.sin(el) * 45, dz + Math.sin(a) * Math.cos(el) * 30]; if (p) seg(...p, ...q, C.white, 0.35, 500); p = q; } }
        for (const r of rivals) { drawTrail(r.trail, r.col); drawBike({ x: r.x, z: bike.z + r.dz, yaw: 0, lean: Math.sin(t + r.v) * 0.2 }, r.col, 0.85); }
        drawTrail(bike.trail, RED);
        drawBike(bike, RED, 1);
        hud();
      },
    };
    function drawBikePos() { const cy = Math.cos(bike.yaw), sy = Math.sin(bike.yaw); return [bike.x - 1.95 * sy, 0.75, bike.z - 1.95 * cy]; }
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${RED},0.95)`; g.fillText('CAPSULES', 28 * s, 40 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText(`ROUTE 7  ::  ${inTunnel(bike.z) ? 'TUNNEL' : 'NEO TOKYO'}  ::  2019`, 28 * s, 62 * s);
      g.font = `bold ${56 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${phase === 'slide' ? C.white : RED},0.95)`;
      const kmh = String(Math.round(bike.v * 3.6)).padStart(3, '0'), w = g.measureText(kmh).width;
      g.fillText(kmh, W - 110 * s - w, H - 40 * s);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText('KM/H', W - 100 * s, H - 44 * s);
      if (phase === 'slide') { g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('KANEDA!', 28 * s, H - 40 * s); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
