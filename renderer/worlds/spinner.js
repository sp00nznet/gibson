// SPINNER: a police flyer gliding down a canyon of towers at night, in the rain. Stepped pyramid
// arcologies stand off to the sides, refinery stacks on the horizon belch fire now and then,
// giant ad screens flicker glyphs, searchlights sweep the clouds. The flyer's nose and dash sit
// at the bottom; a scanner readout (an iris and its numbers) runs top left. Activity is airspeed.
(function (Worlds) {
  Worlds.define('spinner', (k) => {
    const { C, rand, pick, env, seg, box, setCam, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 320, DEPTH = 380;
    const GLYPH = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';
    function tower(z) {
      const side = Math.random() < 0.5 ? -1 : 1, w = rand(6, 14);
      return { x: side * rand(16, 80), z, w, d: rand(6, 14), h: rand(28, 120), side, col: pick([C.ice, C.violet, C.ice]),
        ad: Math.random() < 0.3 ? { y: rand(12, 40), h: rand(7, 12), col: pick([C.hot, C.gold, C.neon]), seed: Math.floor(rand(0, 999)) } : null };
    }
    const towers = Array.from({ length: 55 }, (_, i) => tower(i * DEPTH / 55));
    const pyramids = [[-150, 180], [170, 320], [-190, 460]].map(([x, z]) => ({ x, z, base: rand(90, 120), h: rand(70, 95) }));
    const stacks = Array.from({ length: 6 }, (_, i) => ({ x: -260 + i * 100 + rand(-30, 30), z: rand(480, 560), h: rand(25, 45), fire: 0, next: rand(0, 5) }));
    const lights = [-50, -15, 25, 60].map((x) => ({ x, ph: rand(0, 6), sp: rand(0.2, 0.5) }));
    let cars = Array.from({ length: 30 }, () => ({ x: rand(-12, 12), y: rand(5, 26), z: rand(0, DEPTH), v: rand(-30, 30) }));
    let scan = 0;

    return {
      label: 'SPINNER',
      signal(kind) { if (kind === 'error') for (const s of stacks) s.next = rand(0, 0.4); },
      update(dt) {
        const v = 18 + env.level * 60;
        for (const t of towers) { t.z -= v * dt; if (t.z < -20) Object.assign(t, tower(t.z + DEPTH)); }
        for (const p of pyramids) { p.z -= v * 0.25 * dt; if (p.z < -80) { p.z += 600; p.x = -Math.sign(p.x) * rand(140, 200); } }
        for (const s of stacks) { s.next -= dt; s.fire = Math.max(0, s.fire - dt * 0.7); if (s.next < 0) { s.fire = 1; s.next = rand(2, 8); } }
        for (const c of cars) { c.z += (c.v - v) * dt; if (c.z < -10) c.z += DEPTH; if (c.z > DEPTH) c.z -= DEPTH; }
        scan += dt * (0.5 + env.level);
      },
      draw() {
        const t = env.t, cx = Math.sin(t * 0.15) * 7, dx = Math.cos(t * 0.15) * 0.15 * 7;
        setCam({ x: cx, y: 34 + Math.sin(t * 0.23) * 4, z: 0, yaw: Math.sin(t * 0.11) * 0.06, pitch: -0.05, roll: -dx * 0.12 });
        // the horizon: refinery stacks, fire bursting from the tops
        for (const s of stacks) {
          seg(s.x - 2, 0, s.z, s.x - 1, s.h, s.z, C.violet, 0.6, 800); seg(s.x + 2, 0, s.z, s.x + 1, s.h, s.z, C.violet, 0.6, 800);
          if (s.fire > 0) for (let i = 0; i < 9; i++) {
            const fx = s.x + rand(-1.5, 1.5) * (1 + s.fire), top = s.h + rand(4, 40) * s.fire;
            seg(s.x + rand(-1, 1), s.h, s.z, fx, top, s.z, i % 3 ? C.gold : C.hot, s.fire, 800);
          }
          if (s.fire > 0.6) k.ring(s.x, s.h + 20 * s.fire, s.z, 6 + (1 - s.fire) * 30, 16, C.gold, s.fire - 0.6, 800, 'xy');
        }
        // the arcologies: stepped pyramids, a light on every terrace
        for (const p of pyramids) for (let i = 0; i < 7; i++) {
          const w = p.base * (1 - i / 8), col = i % 2 ? C.gold : C.violet;
          box(p.x, i * p.h / 7, p.z, w, p.h / 7, w, col, 0.55, 600);
          if (Math.sin(t * 2 + i * 1.7 + p.x) > 0.6) seg(p.x - w / 2, (i + 0.5) * p.h / 7, p.z - w / 2, p.x + w / 2, (i + 0.5) * p.h / 7, p.z - w / 2, C.gold, 0.8, 600);
        }
        // searchlights from below, sweeping up into the murk
        for (const l of lights) {
          const a = Math.sin(t * l.sp + l.ph), x1 = l.x + a * 70, z1 = 260 + Math.cos(t * l.sp * 0.7 + l.ph) * 60;
          for (let o = -1; o <= 1; o++) seg(l.x + o, 0, 200, x1 + o * 6, 150, z1, C.white, 0.12, 500);
        }
        // the towers, and the ad screens on the faces looking into the canyon
        for (const b of towers) {
          box(b.x, 0, b.z, b.w, b.h, b.d, b.col, 0.75, FOG);
          for (let y = 4; y < b.h; y += 6) seg(b.x - b.side * b.w / 2, y, b.z - b.d / 2, b.x - b.side * b.w / 2, y, b.z + b.d / 2, b.col, 0.2, FOG * 0.7);
          if (b.ad) {
            const fx = b.x - b.side * (b.w / 2 + 0.2), z0 = b.z - b.d / 2 + 0.5, z1 = b.z + b.d / 2 - 0.5, y0 = b.ad.y, y1 = y0 + b.ad.h;
            seg(fx, y0, z0, fx, y0, z1, b.ad.col, 0.9, FOG); seg(fx, y1, z0, fx, y1, z1, b.ad.col, 0.9, FOG);
            seg(fx, y0, z0, fx, y1, z0, b.ad.col, 0.9, FOG); seg(fx, y0, z1, fx, y1, z1, b.ad.col, 0.9, FOG);
            const n = Math.floor(t * 5) + b.ad.seed, flick = (n * 7919) % 13 ? 1 : 0.3;
            for (let r = 0; r < 2; r++) text3(GLYPH[(n * 31 + r * 17 + b.ad.seed) % GLYPH.length], fx, y0 + b.ad.h * (0.35 + r * 0.4), (z0 + z1) / 2, b.ad.col, b.ad.h * 0.32, flick);
          }
        }
        // traffic lanes
        for (const c of cars) seg(c.x, c.y, c.z, c.x, c.y, c.z - c.v * 0.12, c.v > 0 ? C.gold : C.hot, 0.9, FOG);
        for (let z = 0; z < FOG; z += 20) seg(-12, 0, z, 12, 0, z, C.ice, 0.15, FOG);
        hud(t, dx);
      },
    };

    function hud(t, bank) {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      // rain, in screen space, slanted by the bank
      for (let i = 0; i < 70; i++) { const x = Math.random() * W, y = Math.random() * H, l = (20 + Math.random() * 30) * s; k.line2(x, y, x - l * (0.25 + bank * 0.5), y + l, C.ice, 0.25); }
      // the flyer's nose and dash
      const nose = [[0.3, 1], [0.4, 0.93], [0.47, 0.915], [0.53, 0.915], [0.6, 0.93], [0.7, 1]];
      for (let i = 1; i < nose.length; i++) k.line2(nose[i - 1][0] * W, nose[i - 1][1] * H, nose[i][0] * W, nose[i][1] * H, C.ice, 0.8);
      k.line2(0.47 * W, 0.915 * H, 0.45 * W, H, C.ice, 0.4); k.line2(0.53 * W, 0.915 * H, 0.55 * W, H, C.ice, 0.4);
      g.font = `bold ${15 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`;
      g.fillText(`ALT ${String(Math.round(340 + Math.sin(t * 0.23) * 12)).padStart(4, '0')} M   AIRSPEED ${Math.round(110 + env.level * 260)} KM/H`, 28 * s, H - 30 * s);
      g.fillStyle = `rgba(${C.hot},${Math.sin(t * 4) > 0 ? 0.9 : 0.3})`; g.fillText('POLICE  //  SECTOR 4 PATROL', 28 * s, H - 54 * s);
      // the scanner: an iris, radial fibres turning, and numbers that never settle
      const ix = 120 * s, iy = 120 * s, r = 70 * s;
      g.strokeStyle = `rgba(${C.ice},0.7)`; g.lineWidth = 1.2;
      g.beginPath(); g.arc(ix, iy, r, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(ix, iy, r * (0.3 + env.pulse * 0.08), 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2 + scan * 0.2, r0 = r * 0.38, r1 = r * (0.75 + 0.2 * Math.sin(i * 3.7));
        g.strokeStyle = `rgba(${i % 5 ? C.ice : C.gold},0.45)`; g.beginPath(); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); g.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); g.stroke();
      }
      const sy = iy - r + ((scan * 60 * s) % (2 * r)); g.strokeStyle = `rgba(${C.hot},0.8)`; g.beginPath(); g.moveTo(ix - r, sy); g.lineTo(ix + r, sy); g.stroke();
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.85)`;
      const n = (m) => String(Math.floor(Math.abs(Math.sin(scan * 3 + m) * 1e4))).padStart(4, '0');
      g.fillText(`IRIS ${n(1)}.${n(2)}`, 28 * s, iy + r + 28 * s); g.fillText(`PUPIL ${n(3)}  FLUX ${n(4)}`, 28 * s, iy + r + 46 * s);
      g.fillStyle = `rgba(${C.gold},0.85)`; g.fillText(Math.sin(scan) > 0 ? 'RESPONSE: WITHIN BASELINE' : 'RESPONSE: ...', 28 * s, iy + r + 64 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
