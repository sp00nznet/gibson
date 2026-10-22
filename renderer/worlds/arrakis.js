// ARRAKIS: low over an endless wireframe dune sea at dusk, an ornithopter beating its wings out
// ahead. A thumper on the sand pulses rings with the kick. Every so often a wake comes racing
// across the dunes toward it, WORMSIGN flashes, and a sandworm rises out of the sand, ring by
// ring, opens its mouth, and sinks back. A failed command calls the worm at once.
(function (Worlds) {
  Worlds.define('arrakis', (k) => {
    const { C, rand, env, seg, setCam, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 220, SAND = '255,150,60';
    let camZ = 0, spice = rand(1000, 5000), phase = 'calm', pt = 0, wait = rand(10, 20);
    const worm = { x: 0, z: 0, sx: 0, sz: 0, rise: 0, mouth: 0 }; // z is relative to the camera
    // dunes: crested sine sums; the worm's wake is a travelling bulge
    function h(x, z) {
      let y = 7 * (1 - Math.abs(Math.sin(x * 0.035 + z * 0.021))) + 3 * Math.sin(x * 0.09 - z * 0.05 + 1) + 2 * Math.sin(z * 0.11 + x * 0.02);
      if (phase === 'sign') { const dx = x - worm.x, dz = z - camZ - worm.z; y += 3.5 * Math.exp(-(dx * dx + dz * dz) / 60); }
      return y;
    }
    function startSign(near) {
      phase = 'sign'; pt = 0;
      worm.sx = rand(-90, 90); worm.sz = near ? 70 : 180; worm.x = worm.sx; worm.z = worm.sz;
      worm.tx = rand(-30, 30); worm.tz = rand(55, 75);
    }
    function ornithopter(x, y, z, t) {
      const L = (a, b, c, d, e, f, col, al) => seg(x + a, y + b, z + c, x + d, y + e, z + f, col || C.white, al || 0.9, FOG);
      L(0, 0, 3.2, 0, 0, -3.5); L(0, 0, 3.2, 0.5, 0.4, 2); L(0, 0, 3.2, -0.5, 0.4, 2); L(0.5, 0.4, 2, -0.5, 0.4, 2);
      L(0.5, 0.4, 2, 0.4, 0.2, -1); L(-0.5, 0.4, 2, -0.4, 0.2, -1); L(0.4, 0.2, -1, -0.4, 0.2, -1); L(0, 0, -3.5, 0, 0.8, -3.8);
      for (const [wz, ph] of [[1.1, 0], [-0.4, 1.4]]) for (const sx of [-1, 1]) { // two pairs of dragonfly wings, beating
        const flap = Math.sin(t * 14 + ph) * 1.4, tip = [sx * 6, 0.3 + flap, wz - 0.6];
        L(sx * 0.4, 0.3, wz + 0.3, ...tip, C.ice, 0.8); L(sx * 0.4, 0.3, wz - 0.3, ...tip, C.ice, 0.8);
        L(sx * 2, 0.3 + flap / 3, wz + 0.15, sx * 4, 0.3 + flap * 0.66, wz - 0.2, C.ice, 0.4);
      }
    }
    function drawWorm(t) {
      const n = 16, R = 6.5, wz = camZ + worm.z, gy = h(worm.x, wz) - 2;
      let top = null;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1); if (f > worm.rise) break;
        const y = gy + i * 3.2, lean = (i * i) * 0.06, sway = Math.sin(t * 0.8 + i * 0.3) * i * 0.12;
        const r = R * (1 - f * 0.15);
        ring(worm.x + sway, y, wz - lean, r, 18, i % 2 ? SAND : C.gold, 0.85, FOG);
        if (top) for (let a = 0; a < 6; a++) { const an = a / 6 * Math.PI * 2; seg(top[0] + Math.cos(an) * top[3], top[1], top[2] + Math.sin(an) * top[3], worm.x + sway + Math.cos(an) * r, y, wz - lean + Math.sin(an) * r, C.gold, 0.45, FOG); }
        top = [worm.x + sway, y, wz - lean, r];
      }
      if (!top || worm.rise < 1) return;
      // the mouth: three petals peeling open, rings of teeth inside
      const [mx, my, mz, r] = top, open = worm.mouth;
      for (let p = 0; p < 3; p++) {
        const an = p / 3 * Math.PI * 2 + 0.5, ox = Math.cos(an), oz = Math.sin(an), reach = r * (0.6 + open * 0.9), up = 6 * (1 - open * 0.6);
        const tip = [mx + ox * reach * 1.4, my + up, mz + oz * reach * 1.4];
        for (const d of [-0.5, 0.5]) { const a2 = an + d; seg(mx + Math.cos(a2) * r, my, mz + Math.sin(a2) * r, ...tip, C.hot, 0.95, FOG); }
      }
      for (let tr = 1; tr <= 3; tr++) ring(mx, my - tr * 0.6, mz, r * (1 - tr * 0.22) * open, 24, C.white, 0.5 * open, FOG);
    }
    return {
      label: 'ARRAKIS',
      signal(kind) { if (kind === 'error' && (phase === 'calm' || phase === 'sign')) { startSign(true); worm.x = worm.tx; worm.z = worm.tz; phase = 'rise'; } },
      update(dt) {
        camZ += (8 + env.level * 22) * dt; pt += dt;
        spice += dt * (0.4 + env.level * 6);
        if (phase === 'calm' && pt > wait) startSign(false);
        else if (phase === 'sign') { // the wake closes in
          const f = Math.min(1, pt / 7); worm.x = worm.sx + (worm.tx - worm.sx) * f; worm.z = worm.sz + (worm.tz - worm.sz) * f;
          if (f === 1) { phase = 'rise'; pt = 0; }
        } else if (phase === 'rise') { worm.rise = Math.min(1, worm.rise + dt * 0.45); if (worm.rise === 1) worm.mouth = Math.min(1, worm.mouth + dt * 0.6); if (pt > 7) { phase = 'sink'; pt = 0; } }
        else if (phase === 'sink') { worm.mouth = Math.max(0, worm.mouth - dt); worm.rise = Math.max(0, worm.rise - dt * 0.35); if (worm.rise === 0) { phase = 'calm'; pt = 0; wait = rand(14, 30); } }
      },
      draw() {
        const t = env.t, cy = 24;
        setCam({ x: Math.sin(t * 0.05) * 10, y: cy, z: camZ, yaw: Math.sin(t * 0.07) * 0.08, pitch: -0.2 });
        // dune crests, row by row, plus a few long lines down the slopes
        const z0 = Math.ceil(camZ / 7) * 7;
        for (let z = z0; z < camZ + FOG; z += 7) {
          let px = -140, py = h(px, z);
          for (let x = -132; x <= 140; x += 8) { const y = h(x, z); seg(px, py, z, x, y, z, (z / 7) % 3 ? SAND : C.gold, 0.7, FOG); px = x; py = y; }
        }
        for (let x = -120; x <= 120; x += 24) {
          let pz = z0, py = h(x, pz);
          for (let z = z0 + 14; z < camZ + FOG; z += 14) { const y = h(x, z); seg(x, py, pz, x, y, z, C.violet, 0.35, FOG); pz = z; py = y; }
        }
        // the thumper and its rings, on the kick
        const tz = Math.ceil((camZ + 40) / 160) * 160, tx = -22, ty = h(tx, tz);
        seg(tx, ty, tz, tx, ty + 3, tz, C.white, 0.9, FOG);
        for (let r = 0; r < 3; r++) ring(tx, ty + 0.2, tz, 2 + r * 4 + env.pulse * 3, 20, C.hot, env.pulse * (1 - r / 3), FOG);
        if (phase === 'sign') for (let i = 0; i < 4; i++) ring(worm.x, h(worm.x, camZ + worm.z) + 0.3, camZ + worm.z, 2 + i * 2.5, 16, C.white, 0.5 - i * 0.1, FOG);
        if (phase === 'rise' || phase === 'sink') drawWorm(t);
        ornithopter(Math.sin(t * 0.3) * 9, cy - 5 + Math.sin(t * 0.7) * 1.2, camZ + 26 + Math.sin(t * 0.2) * 4, t);
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(`SPICE ${spice.toFixed(1).padStart(9, '0')} KG`, 28 * s, 40 * s);
      g.fillStyle = `rgba(${SAND},0.8)`; g.font = `${13 * s | 0}px ${MONO}`; g.fillText('HARVESTER 7  ::  DEEP DESERT', 28 * s, 62 * s);
      const warn = phase !== 'calm';
      if (warn && Math.sin(env.t * 10) > -0.3) {
        g.font = `bold ${28 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`;
        const m = 'WORMSIGN'; g.fillText(m, W - 28 * s - g.measureText(m).width, 46 * s);
      }
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${SAND},0.75)`;
      const m2 = 'THE SPICE MUST FLOW'; g.fillText(m2, W - 28 * s - g.measureText(m2).width, H - 30 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
