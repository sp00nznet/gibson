// THE REAL: a battered hovercraft running the ruined service tunnels under a dead city. Ribbed
// arches with broken pipes and hanging cable, then a collapse and it bursts out onto the scorched
// surface: a black sky in a permanent storm, stumps of towers, and far off the endless fields of
// pod towers with harvesters climbing them. Then back underground. Squid machines hunt it in packs
// (more when you're busy, a swarm when a command fails); when the EMP is charged, or on a commit,
// it fires and they drop dark. Your activity is the throttle.
(function (Worlds) {
  Worlds.define('real', (k) => {
    const { C, rand, env, seg, setCam, lookAt, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 200, RED = '255,40,40';
    const CYC = 1100, TUN = 650, R = 14, RIB = 8; // a cycle: TUN metres of tunnel, the rest out on the surface
    const hash = (n, s) => { let x = Math.imul(n * 374761393 + s * 668265263, 1274126177); x ^= x >>> 13; return (Math.imul(x, 1103515245) >>> 0) / 4294967296; };
    const pathX = (z) => Math.sin(z * 0.011) * 14 + Math.sin(z * 0.027 + 1) * 5;
    const surf = (z) => { const m = ((z % CYC) + CYC) % CYC; return m < TUN - 60 ? 0 : m < TUN ? (m - TUN + 60) / 60 : m > CYC - 60 ? (CYC - m) / 60 : 1; }; // 0 tunnel .. 1 surface
    const pathY = (z) => 2 + surf(z) * 9;
    const ship = { x: 0, y: 2, z: 0, v: 30, yaw: 0, roll: 0 };
    let sents = [], emp = null, charge = 0.3, flash = 0, bolt = null, camX = 0, camY = 7, camR = 0, spawnT = 2, glyphs = [];

    // hull: cross sections along the length (z, half-width, top, bottom), nose +z
    const HULL = [[7.5, 0.6, 0.9, 0.3], [6, 1.6, 1.4, 0.1], [3, 1.9, 1.6, 0], [-1, 2, 1.6, 0], [-4.5, 1.9, 1.5, 0], [-7, 1.5, 1.3, 0.2]];
    function P(lx, ly, lz) { // ship local → world: bank, then yaw
      const cr = Math.cos(ship.roll), sr = Math.sin(ship.roll), x1 = lx * cr - ly * sr, y1 = lx * sr + ly * cr;
      const cy = Math.cos(ship.yaw), sy = Math.sin(ship.yaw);
      return [ship.x + x1 * cy + lz * sy, ship.y + y1, ship.z - x1 * sy + lz * cy];
    }
    const L = (a, b, col, al) => seg(...P(...a), ...P(...b), col, al, FOG);
    function drawShip() {
      for (let i = 0; i < HULL.length; i++) {
        const [z, w, t, b] = HULL[i];
        L([-w, b, z], [w, b, z], C.white, 0.5); L([-w, b, z], [-w, t * 0.8, z], C.white, 0.7); L([w, b, z], [w, t * 0.8, z], C.white, 0.7);
        L([-w, t * 0.8, z], [-w * 0.5, t, z], C.white, 0.7); L([w, t * 0.8, z], [w * 0.5, t, z], C.white, 0.7); L([-w * 0.5, t, z], [w * 0.5, t, z], C.white, 0.7);
        if (i) { const [z0, w0, t0, b0] = HULL[i - 1]; for (const sx of [-1, 1]) { L([sx * w0, b0, z0], [sx * w, b, z], C.ice, 0.8); L([sx * w0, t0 * 0.8, z0], [sx * w, t * 0.8, z], C.ice, 0.8); L([sx * w0 * 0.5, t0, z0], [sx * w * 0.5, t, z], C.ice, 0.6); } }
      }
      for (let z = -6.5; z < 6; z += 1.2) for (const sx of [-1, 1]) L([sx * 1.95, 0.25, z], [sx * 1.95, 1.15, z], C.ice, 0.35); // armour plates
      for (const [a, b] of [[[-0.6, 1.5, 4.5], [0.6, 1.5, 4.5]], [[-0.6, 1.5, 4.5], [-0.4, 2.1, 3.6]], [[0.6, 1.5, 4.5], [0.4, 2.1, 3.6]], [[-0.4, 2.1, 3.6], [0.4, 2.1, 3.6]], [[-0.4, 2.1, 3.6], [-0.6, 1.6, 2.4]], [[0.4, 2.1, 3.6], [0.6, 1.6, 2.4]]]) L(a, b, C.gold, 0.9); // the cockpit hump
      for (const [x, h] of [[-0.9, 1.6], [0.7, 2.4], [0.2, 1.2]]) L([x, 1.5, -5], [x + 0.2, 1.5 + h, -5.6], C.white, 0.6); // antennas
      for (const z of [4.5, 1.5, -1.5, -4.5]) for (const sx of [-1, 1]) { // the hover pads, under the hull
        const c = P(sx * 1.1, -0.05, z); ring(c[0], c[1], c[2], 0.55 + env.pulse * 0.15, 10, C.ice, 0.5 + env.pulse * 0.5, FOG);
        seg(c[0], c[1], c[2], c[0], c[1] - 0.6 - env.pulse * 0.8, c[2], C.ice, 0.4, FOG);
      }
    }

    function tunnel(z0, z1) {
      for (let i = Math.ceil(z0 / RIB); i * RIB < z1; i++) {
        const z = i * RIB, s = surf(z); if (s >= 1) continue;
        const cx = pathX(z), cy = 2, broken = s > 0 || hash(i, 1) < 0.08, n = 11;
        for (let j = 0; j < n; j++) { // the arch, its floor cut flat
          const a0 = Math.PI * (-0.15 + j / n * 1.3), a1 = Math.PI * (-0.15 + (j + 1) / n * 1.3);
          if (broken && hash(i, j + 5) < 0.4 + s * 0.5) continue;
          seg(cx + Math.cos(a0) * R, cy - 2 + Math.sin(a0) * R * 0.85 + 1.5, z, cx + Math.cos(a1) * R, cy - 2 + Math.sin(a1) * R * 0.85 + 1.5, z, C.ice, 0.8, FOG);
        }
        const nx = pathX(z + RIB);
        for (const [ax, ay, col] of [[-R * 0.95, 1.2, C.gold], [R * 0.95, 1.2, C.gold], [-R * 0.7, 7, C.violet], [R * 0.75, 6.5, C.violet]]) // pipes, some snapped
          if (hash(i, ax * 3 + ay) > 0.15 + s) seg(cx + ax, ay, z, nx + ax, ay, z + RIB, col, 0.5, FOG);
        seg(cx - R * 0.95, -0.5, z, nx - R * 0.95, -0.5, z + RIB, C.ice, 0.3, FOG); seg(cx + R * 0.95, -0.5, z, nx + R * 0.95, -0.5, z + RIB, C.ice, 0.3, FOG);
        if (hash(i, 9) < 0.35) { // a hanging cable, swaying
          const hx = cx + (hash(i, 10) - 0.5) * R * 1.2, len = 3 + hash(i, 11) * 4; let p = [hx, 13, z + 4];
          for (let q = 1; q <= 5; q++) { const np = [hx + Math.sin(env.t * 1.5 + i + q) * 0.15 * q, 13 - len * q / 5, z + 4]; seg(...p, ...np, C.white, 0.4, FOG); p = np; }
        }
      }
    }

    function surface(z0, z1) {
      const lit = 0.25 + flash * 0.75;
      for (let i = Math.ceil(z0 / 12); i * 12 < z1; i++) { const z = i * 12; if (surf(z) <= 0) continue; seg(ship.x - 120, -1, z, ship.x + 120, -1, z, C.hot, 0.15, FOG); }
      for (let i = Math.ceil(z0 / 30); i * 30 < z1; i++) { // tower stumps either side
        const z = i * 30; if (surf(z) <= 0) continue;
        for (const side of [-1, 1]) {
          const x = pathX(z) + side * (24 + hash(i, side + 3) * 50), h = 6 + hash(i, side + 7) * 28, w = 4 + hash(i, side) * 5;
          for (const sx of [-1, 1]) seg(x + sx * w, -1, z, x + sx * w, h * (sx > 0 ? 1 : 0.7), z, C.white, 0.35 + lit * 0.3, FOG);
          seg(x - w, h * 0.7, z, x, h * 0.85, z, C.white, 0.4, FOG); seg(x, h * 0.85, z, x + w, h, z, C.white, 0.4, FOG); // the broken top
          for (let y = 3; y < h * 0.7; y += 3) seg(x - w, y, z, x + w, y, z, C.white, 0.12, FOG);
        }
      }
      for (let layer = 0; layer < 3; layer++) { // the storm ceiling
        const y = 34 + layer * 7; let p = null;
        for (let x = -160; x <= 160; x += 20) { const q = [ship.x + x, y + Math.sin(x * 0.05 + env.t * 0.3 + layer) * 3, ship.z + 70 + layer * 30]; if (p) seg(...p, ...q, C.violet, lit * 0.8, 400); p = q; }
      }
      for (let tw = 0; tw < 8; tw++) { // the fields: towers of pods, a harvester climbing each
        const x = ship.x - 140 + tw * 40, z = ship.z + 230, hy = ((env.t * 3 + tw * 7) % 30);
        seg(x, -1, z, x, 31, z, C.white, 0.25, 500);
        for (let p = 0; p < 10; p++) ring(x, p * 3, z, 0.7, 6, (p + tw) % 3 ? RED : C.neon, 0.35, 500, 'xy');
        for (const sx of [-1, 1]) seg(x + sx * 1.6, hy, z, x + sx * 1.6, hy + 2, z, C.gold, 0.6, 500);
        seg(x - 1.6, hy + 2, z, x + 1.6, hy + 2, z, C.gold, 0.6, 500);
      }
      if (bolt) for (let j = 1; j < bolt.length; j++) seg(...bolt[j - 1], ...bolt[j], C.white, flash, 500);
    }

    function sentinel(s) {
      const eye = s.dead ? C.white : RED, ea = s.dead ? 0.15 : 1;
      ring(s.x, s.y, s.z, 0.9, 8, C.white, 0.5, FOG, 'xy');
      for (let e = 0; e < 3; e++) ring(s.x + Math.cos(e * 2.1) * 0.45, s.y + Math.sin(e * 1.3) * 0.35, s.z - 0.1, 0.12, 5, eye, ea, FOG, 'xy');
      for (let t = 0; t < 4; t++) { // the tentacles, streaming back
        const a = t / 4 * Math.PI * 2 + 0.6; let p = [s.x + Math.cos(a) * 0.7, s.y + Math.sin(a) * 0.7, s.z];
        for (let q = 1; q <= 4; q++) { const w = Math.sin(env.t * 6 + q * 0.9 + t) * 0.35 * q; const np = [p[0] + Math.cos(a) * 0.3 + w * 0.3, p[1] + Math.sin(a) * 0.3 + w * 0.2, p[2] - 1.3]; seg(...p, ...np, C.ice, 0.5, FOG); p = np; }
      }
    }

    function fireEmp() { if (emp) return; emp = { r: 0 }; charge = 0; flash = Math.max(flash, 0.4); }
    function spawn(n) { for (let i = 0; i < n && sents.length < 18; i++) sents.push({ x: ship.x + rand(-12, 12), y: ship.y + rand(2, 9), z: ship.z - rand(25, 50), ox: rand(-11, 11), oy: rand(2, 8), oz: rand(-4, 22), ph: rand(0, 6), vy: 0 }); }

    return {
      label: 'THE REAL',
      signal(kind) { if (kind === 'error') spawn(12); if (kind === 'commit') fireEmp(); if (kind === 'ok') charge = Math.min(1, charge + 0.15); },
      update(dt) {
        ship.v += (32 + env.level * 45 - ship.v) * Math.min(1, dt * 0.8);
        ship.z += ship.v * dt;
        const nx = pathX(ship.z), ax = pathX(ship.z + 6) - nx;
        ship.roll += (-ax * 0.12 - ship.roll) * Math.min(1, dt * 3); ship.yaw = Math.atan2(ax, 6);
        ship.x = nx; ship.y = pathY(ship.z) + Math.sin(env.t * 1.7) * 0.15;
        spawnT -= dt * (0.6 + env.level * 1.5); if (spawnT < 0) { spawn(3 + (Math.random() * 3 | 0)); spawnT = rand(4, 8); }
        for (const s of sents) {
          if (s.dead) { s.vy -= 20 * dt; s.y += s.vy * dt; s.z += ship.v * 0.6 * dt; s.t -= dt; continue; }
          const tx = ship.x + s.ox + Math.sin(env.t + s.ph) * 2, ty = ship.y + s.oy, tz = ship.z + s.oz;
          s.x += (tx - s.x) * dt * 1.2; s.y += (ty - s.y) * dt * 1.2; s.z += (tz - s.z) * dt * 0.9 + ship.v * dt * 0.9;
        }
        charge = Math.min(1, charge + dt * (0.03 + env.level * 0.04));
        if (charge >= 1 && sents.filter((s) => !s.dead).length >= 6) fireEmp();
        if (emp) {
          emp.r += dt * 70;
          for (const s of sents) if (!s.dead && Math.hypot(s.x - ship.x, s.y - ship.y, s.z - ship.z) < emp.r) { s.dead = true; s.t = 3; }
          if (emp.r > 90) emp = null;
        }
        sents = sents.filter((s) => !s.dead || s.t > 0);
        flash = Math.max(0, flash - dt * 2.5);
        if (surf(ship.z) > 0.5 && Math.random() < dt * 0.4) { // lightning
          let p = [ship.x + rand(-100, 100), 38, ship.z + rand(80, 200)]; bolt = [p];
          for (let j = 0; j < 7; j++) { p = [p[0] + rand(-6, 6), p[1] - 5.5, p[2]]; bolt.push(p); }
          flash = 1;
        }
        if (flash < 0.05) bolt = null;
        for (const gl of glyphs) gl.y += dt * gl.v;
        if (glyphs.length < 40 && Math.random() < dt * 30) glyphs.push({ c: (Math.random() * 7) | 0, y: 0, v: rand(40, 110), ch: String.fromCharCode(0xff66 + ((Math.random() * 40) | 0)) });
        glyphs = glyphs.filter((gl) => gl.y < 150);
        camX += (ship.x - Math.sin(ship.yaw) * 16 - camX) * Math.min(1, dt * 3);
        camY += (ship.y + 4.5 - camY) * Math.min(1, dt * 2);
        camR += (ship.roll * 0.5 - camR) * Math.min(1, dt * 3);
      },
      draw() {
        const cam = lookAt({ x: camX, y: camY, z: ship.z - 16 }, ship.x, ship.y + 1, ship.z + 12); cam.roll = camR;
        setCam(cam);
        tunnel(ship.z - 20, ship.z + FOG);
        surface(ship.z - 20, ship.z + FOG);
        drawShip();
        for (const s of sents) sentinel(s);
        if (emp) { const a = Math.max(0, 1 - emp.r / 90); ring(ship.x, ship.y + 1, ship.z, emp.r, 40, C.white, a, FOG); ring(ship.x, ship.y + 1, ship.z, emp.r, 40, C.white, a, FOG, 'xy'); }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), up = surf(ship.z);
      const live = sents.filter((q) => !q.dead).length;
      if (flash > 0.3) { g.fillStyle = `rgba(${C.white},${(flash - 0.3) * 0.15})`; g.fillRect(0, 0, W, H); }
      const depth = Math.round((1 - up) * 1240 + 60 + Math.sin(env.t * 0.7) * 8);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText(`BROADCAST DEPTH  ${String(depth).padStart(4, '0')} M`, 28 * s, 36 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText(up > 0.5 ? 'SURFACE  ::  STORM CEILING' : 'SERVICE TUNNELS  ::  SECTOR 12', 28 * s, 58 * s);
      const r1 = `SENTINELS  ${String(live).padStart(2, '0')}`;
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${live > 8 ? RED : C.gold},0.95)`; g.fillText(r1, W - 28 * s - g.measureText(r1).width, 36 * s);
      // the EMP charge bar
      const bw = 200 * s, bx = W - 28 * s - bw, by = 50 * s;
      g.strokeStyle = `rgba(${C.white},0.6)`; g.lineWidth = 1; g.strokeRect(bx, by, bw, 10 * s);
      g.fillStyle = `rgba(${charge >= 1 ? C.white : C.ice},0.85)`; g.fillRect(bx + 2, by + 2, (bw - 4) * charge, 10 * s - 4);
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; const el = emp ? 'EMP DISCHARGED' : charge >= 1 ? 'EMP ARMED' : 'EMP CHARGING'; g.fillText(el, bx, by + 26 * s);
      // the operator's screen: falling code, the only green out here
      const ox = 28 * s, oy = H - 190 * s, ow = 120 * s, oh = 150 * s;
      g.strokeStyle = `rgba(${C.neon},0.5)`; g.strokeRect(ox, oy, ow, oh);
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.8)`; g.fillText('OPERATOR', ox, oy - 6 * s);
      g.save(); g.beginPath(); g.rect(ox, oy, ow, oh); g.clip();
      g.font = `${12 * s | 0}px ${MONO}`;
      for (const gl of glyphs) for (let j = 0; j < 5; j++) { g.fillStyle = `rgba(${C.neon},${j ? 0.5 - j * 0.09 : 0.95})`; g.fillText(gl.ch, ox + (6 + gl.c * 16) * s, oy + (gl.y - j * 13) * s); }
      g.restore();
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
