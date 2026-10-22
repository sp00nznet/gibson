// NAVIGATOR: a chrome teardrop ship skimming low and fast, over open water, then a coastline and
// rolling hills, then water again. It weaves and banks for fun, and every so often shoots
// straight up, hangs there spinning, and drops back to the deck. A light sweeps round its hull.
// Chase camera. An alien star map fills in top right as the navigation data comes back.
(function (Worlds) {
  Worlds.define('navigator', (k) => {
    const { C, rand, env, seg, ring, setCam, lookAt } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 220, TAU = Math.PI * 2;
    const ship = { x: 0, y: 3, z: 0, yaw: 0, roll: 0, spin: 0 };
    let hop = -1, hopIn = rand(8, 14), dist = 0;
    const stars = Array.from({ length: 22 }, () => [rand(0, 1), rand(0, 1)]);
    const route = [0, 5, 11, 3, 17, 8, 20, 14];

    // land shows up in long stretches; water in between, with a beach where they meet
    const landness = (z) => Math.max(0, Math.min(1, Math.sin(z * TAU / 1100) * 2.5));
    function height(x, z) {
      const f = landness(z), t = env.t;
      const water = Math.sin(x * 0.3 + t * 2) * 0.15 + Math.sin(z * 0.2 + t * 1.3) * 0.15;
      const land = ((Math.sin(x * 0.05 + z * 0.03) + Math.sin(x * 0.11 - z * 0.07) * 0.6 + 1.6) * 5 + (x / 70) ** 2 * 18) * f - 1;
      return Math.max(water, land);
    }
    function toW(lx, ly, lz) { // ship local → world: roll, then yaw (with the hover spin)
      const cr = Math.cos(ship.roll), sr = Math.sin(ship.roll), a = ship.yaw + ship.spin, cy = Math.cos(a), sy = Math.sin(a);
      const x1 = lx * cr - ly * sr, y1 = lx * sr + ly * cr;
      return [ship.x + x1 * cy + lz * sy, ship.y + y1, ship.z - x1 * sy + lz * cy];
    }
    const R = (u) => 1.9 * Math.sqrt(Math.max(0, 1 - u * u)) * (0.6 + 0.4 * (u + 1) / 2); // fat nose, tapered tail
    const P = (u, th) => toW(R(u) * Math.cos(th), R(u) * Math.sin(th) * 0.42, u * 3.4);
    function drawShip() {
      const sweep = env.t * 2.2;
      for (let u = -0.85; u <= 0.86; u += 0.17) { // hoops
        let p = P(u, 0);
        for (let i = 1; i <= 20; i++) { const q = P(u, i / 20 * TAU); seg(...p, ...q, C.gold, 0.7, FOG); p = q; }
      }
      for (let j = 0; j < 12; j++) { // meridians, one lit by the sweeping reflection
        const th = j / 12 * TAU, lit = Math.cos(th - sweep) > 0.93;
        let p = P(-1, th);
        for (let u = -0.9; u <= 1.001; u += 0.1) { const q = P(u, th); seg(...p, ...q, lit ? C.white : C.gold, lit ? 1 : 0.55, FOG); p = q; }
      }
    }

    return {
      label: 'NAVIGATOR',
      signal(kind) { if (kind === 'ok' && hop < 0) hopIn = 0; },
      update(dt) {
        const t = env.t, v = 26 + env.level * 55;
        dist += v * dt; ship.z = dist;
        const nx = Math.sin(t * 0.4) * 12 + Math.sin(t * 0.13) * 18, vx = (nx - ship.x) / Math.max(dt, 1e-3);
        ship.x = nx; ship.yaw = Math.atan2(vx, v) * 0.8; ship.roll = -vx * 0.03;
        let want = height(ship.x, ship.z) + 2.5;
        hopIn -= dt;
        if (hop < 0 && hopIn < 0) hop = 0;
        if (hop >= 0) { // up like a lift, a spin at the top, back down
          hop += dt;
          want += hop < 1 ? hop * 28 : hop < 3 ? 28 : Math.max(0, 28 - (hop - 3) * 20);
          if (hop > 1 && hop < 3) ship.spin += dt * 9;
          if (hop > 4.5) { hop = -1; hopIn = rand(9, 16); ship.spin %= TAU; }
        } else ship.spin *= 1 - dt * 3;
        ship.y += (want - ship.y) * Math.min(1, dt * (hop >= 0 ? 6 : 3));
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: ship.x * 0.7 + Math.sin(t * 0.2) * 3, y: Math.max(ship.y * 0.7, height(ship.x, ship.z - 12)) + 4.5, z: ship.z - 13 }, ship.x, ship.y + 0.5, ship.z + 8));
        // the surface: rows across, a few columns along; water ice blue, land green
        const z0 = Math.floor((ship.z - 14) / 5) * 5;
        for (let z = z0; z < ship.z + FOG; z += 5) {
          let px = -100, ph = height(px, z);
          for (let x = -92; x <= 100; x += 8) {
            const h = height(x, z), land = h > 0.35 || ph > 0.35;
            seg(px, ph, z, x, h, z, land ? C.neon : C.ice, land ? 0.6 : 0.45, FOG); px = x; ph = h;
          }
        }
        for (let x = -96; x <= 96; x += 16) {
          let pz = z0, ph = height(x, pz);
          for (let z = z0 + 5; z < ship.z + FOG; z += 5) { const h = height(x, z); seg(x, ph, pz, x, h, z, h > 0.35 ? C.neon : C.ice, 0.3, FOG); pz = z; ph = h; }
        }
        const gy = height(ship.x, ship.z), alt = ship.y - gy;
        ring(ship.x, gy + 0.05, ship.z, 1.8 + alt * 0.05, 16, C.violet, Math.max(0, 0.7 - alt / 40), FOG); // the shadow
        drawShip();
        hud(alt);
      },
    };

    function hud(alt) {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      const pct = Math.min(100, Math.floor(dist / 150) % 101);
      // the star map: dots, and the route lit as far as the data reaches
      const bx = W - 260 * s, by = 30 * s, bw = 230 * s, bh = 170 * s;
      g.strokeStyle = `rgba(${C.ice},0.5)`; g.lineWidth = 1; g.strokeRect(bx, by, bw, bh);
      for (const [x, y] of stars) { g.fillStyle = `rgba(${C.white},0.8)`; g.fillRect(bx + x * bw - 1.5, by + y * bh - 1.5, 3, 3); }
      const legs = Math.floor(pct / 100 * (route.length - 1));
      g.strokeStyle = `rgba(${C.gold},0.9)`; g.lineWidth = 1.5; g.beginPath();
      for (let i = 0; i <= legs; i++) { const [x, y] = stars[route[i]]; if (i) g.lineTo(bx + x * bw, by + y * bh); else g.moveTo(bx + x * bw, by + y * bh); }
      g.stroke();
      const [hx, hy] = stars[route[legs]]; g.strokeStyle = `rgba(${C.hot},${0.5 + env.pulse * 0.5})`; g.beginPath(); g.arc(bx + hx * bw, by + hy * bh, 6 * s, 0, TAU); g.stroke();
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`;
      g.fillText(`NAVIGATION DATA RECOVERED ${String(pct).padStart(3)}%`, bx, by + bh + 22 * s);
      g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText('HOME SYSTEM: 560 LIGHT YEARS', bx, by + bh + 40 * s);
      // flight readout, bottom left
      g.font = `bold ${15 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.85)`;
      g.fillText(`ALT ${alt.toFixed(1).padStart(5)} M   ${Math.round(400 + env.level * 900)} KM/H`, 28 * s, H - 30 * s);
      g.fillStyle = `rgba(${C.neon},0.85)`; g.fillText(landness(dist) > 0.2 ? 'TERRAIN: LAND' : 'TERRAIN: OPEN WATER', 28 * s, H - 54 * s);
      if (hop >= 0) { g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText('COMPLIANCE!', 28 * s, H - 78 * s); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
