// THE WIRED: a quiet suburban street under a pale sky, walked slowly. Utility poles march down
// both sides, their wires sagging and swaying and humming; the hum is drawn in the corner and
// grows with your activity. Red shadows pool on the road. Now and then the scene jump-cuts to a
// dark bedroom packed with computer towers, fans turning, cables everywhere, then cuts back.
// Captions glitch, sometimes into the last thing you typed. A failed command forces the cut.
(function (Worlds) {
  Worlds.define('wired', (k) => {
    const { C, rand, env, seg, setCam, ring, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 140, GAP = 14, SPAN = 112;
    const blots = Array.from({ length: 22 }, () => ({ x: rand(-6, 6), z: rand(0, SPAN), r: rand(0.6, 2.2), n: 4 + (Math.random() * 6 | 0) }));
    const houses = Array.from({ length: 16 }, (_, i) => ({ side: i % 2 ? 1 : -1, z: Math.floor(i / 2) * 18 + rand(0, 6), w: rand(7, 10), h: rand(5, 8), d: rand(7, 10) }));
    const towers = Array.from({ length: 14 }, (_, i) => ({ x: -4 + (i % 7) * 1.3, z: 4 + Math.floor(i / 7) * 1.4, h: rand(1.2, 2.4) }));
    let walk = 0, cut = 0, cutT = rand(12, 20), cap = 'PRESENT DAY. PRESENT TIME.', capT = 0, laugh = 0;

    function pole(x, z) {
      seg(x, 0, z, x, 9, z, C.white, 0.6, FOG);
      seg(x - 1.4, 8.2, z, x + 1.4, 8.2, z, C.white, 0.6, FOG); seg(x - 1, 7, z, x + 1, 7, z, C.white, 0.5, FOG);
      seg(x, 6, z, x + (x < 0 ? 0.8 : -0.8), 5.6, z, C.white, 0.4, FOG); // a transformer bracket
    }
    function wire(x0, y, z0, x1, z1, sag, col, al) { // sagging span, swaying in the wind
      let p = [x0, y, z0];
      for (let i = 1; i <= 6; i++) {
        const t = i / 6, b = 4 * t * (1 - t), sw = Math.sin(env.t * 1.3 + z0 * 0.2) * 0.25 * b;
        const q = [x0 + (x1 - x0) * t + sw, y - sag * b, z0 + (z1 - z0) * t];
        seg(...p, ...q, col, al, FOG); p = q;
      }
    }
    function street() {
      setCam({ x: Math.sin(env.t * 0.2) * 0.3, y: 1.6, z: 0, yaw: Math.sin(env.t * 0.05) * 0.06, pitch: 0.12 });
      for (let i = 0; i < 6; i++) seg(-200, 40 + i * 8, 180, 200, 40 + i * 8, 180, C.white, 0.06 + i * 0.015, 400); // the pale sky
      const off = walk % GAP;
      for (const sx of [-5, 5]) {
        seg(sx * 1.2, 0, 0, sx * 1.2, 0, SPAN, C.violet, 0.4, FOG); // kerbs
        for (let z = -off; z < SPAN; z += GAP) {
          pole(sx, z);
          if (z + GAP < SPAN) for (const [dx, y] of [[-1.3, 8.2], [0, 8.2], [1.3, 8.2], [-0.9, 7], [0.9, 7]]) wire(sx + dx, y, z, sx + dx, z + GAP, 0.8 + Math.abs(dx) * 0.2, C.white, 0.45 + env.level * 0.3);
        }
      }
      wire(-5, 8.2, 30 - off, 5, 30 - off, 1.4, C.white, 0.5); // a span across the road
      for (const h of houses) { const z = ((h.z - walk) % SPAN + SPAN) % SPAN; box(h.side * (9 + h.w / 2), 0, z, h.w, h.h, h.d, C.ice, 0.35, FOG); }
      for (const b of blots) { // red shadows: clusters of rings and dots on the road
        const z = ((b.z - walk) % SPAN + SPAN) % SPAN;
        for (let j = 0; j < b.n; j++) ring(b.x + Math.sin(j * 2.4) * b.r * 0.6, 0.02, z + Math.cos(j * 2.4) * b.r * 0.6, b.r * (0.3 + (j % 3) * 0.15), 7, C.hot, 0.6, FOG);
      }
    }
    function room() { // the bedroom: a wall of towers, fans, cables
      const t = env.t;
      setCam({ x: Math.sin(t * 0.3) * 0.2 + rand(-0.03, 0.03), y: 1.4, z: -1, yaw: 0.1, pitch: -0.15 });
      for (let x = -5; x <= 5; x++) seg(x, 0, 0, x, 0, 8, C.violet, 0.2, FOG);
      for (let z = 0; z <= 8; z++) seg(-5, 0, z, 5, 0, z, C.violet, 0.2, FOG);
      for (const tw of towers) {
        box(tw.x, 0, tw.z, 1, tw.h, 1, C.ice, 0.6, FOG);
        ring(tw.x, tw.h * 0.6, tw.z - 0.51, 0.3, 8, C.ice, 0.5, FOG, 'xy');
        const a = t * 9 + tw.x; seg(tw.x - Math.cos(a) * 0.28, tw.h * 0.6 + Math.sin(a) * 0.28, tw.z - 0.52, tw.x + Math.cos(a) * 0.28, tw.h * 0.6 - Math.sin(a) * 0.28, tw.z - 0.52, C.white, 0.6, FOG);
        if (Math.sin(t * 7 + tw.x * 5) > 0.3) seg(tw.x - 0.3, tw.h - 0.2, tw.z - 0.51, tw.x - 0.2, tw.h - 0.2, tw.z - 0.51, C.neon, 1, FOG); // LED
      }
      for (let c = 0; c < 9; c++) wire(-4 + c, 0.3, 4, -3 + c * 0.7, 1, -0.2, [C.hot, C.ice, C.white][c % 3], 0.5); // cables over the floor
      box(1.5, 0.7, 2, 1.6, 1.2, 1.2, C.white, 0.7, FOG); // the monitor, glowing
      for (let y = 0.9; y < 1.8; y += 0.12) seg(0.9, y, 1.39, 2.1, y, 1.39, C.neon, 0.3 + Math.random() * 0.3, FOG);
    }

    return {
      label: 'THE WIRED',
      signal(kind) { if (kind === 'error') { cut = 2.5; laugh = 2; } },
      update(dt) {
        walk += dt * (1.2 + env.level * 2);
        cut = Math.max(0, cut - dt); laugh = Math.max(0, laugh - dt);
        cutT -= dt; if (cutT < 0) { cut = rand(1.8, 3); cutT = rand(12, 22); }
        capT -= dt;
        if (capT < 0) { // a new caption: the line, the laugh, or what you typed
          const c = env.cmd && env.cmd.text && Math.random() < 0.4 ? env.cmd.text.toUpperCase().slice(0, 36) : 'PRESENT DAY. PRESENT TIME.';
          cap = c; capT = rand(5, 9); if (Math.random() < 0.4) laugh = 2;
        }
      },
      draw() { if (cut > 0) room(); else street(); hud(); },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), t = env.t;
      // the hum
      g.strokeStyle = `rgba(${C.white},0.7)`; g.lineWidth = 1.2; g.beginPath();
      const amp = (3 + env.level * 18 + env.pulse * 4) * s;
      for (let i = 0; i <= 120; i++) { const x = 28 * s + i * 2.4 * s, y = 52 * s + Math.sin(i * 0.35 + t * 20) * amp * (0.7 + 0.3 * Math.sin(i * 0.05)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; g.fillText('HUM  60HZ', 28 * s, 22 * s);
      // the caption, typed out, glitching
      const shown = cap.slice(0, Math.floor((9 - Math.max(0, capT)) * 18)), j = Math.random() < 0.1 ? rand(-6, 6) * s : 0;
      g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.9)`; g.fillText(shown, 28 * s + j, H - 40 * s);
      if (Math.random() < 0.08) { g.fillStyle = `rgba(${C.hot},0.6)`; g.fillText(shown, 28 * s + 3 * s, H - 40 * s + 2 * s); }
      if (laugh > 0) {
        g.font = `bold ${28 * s | 0}px ${MONO}`;
        for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(${i ? C.hot : C.white},${0.4 + Math.random() * 0.5})`; g.fillText('HAHAHA', W - 220 * s + rand(-8, 8) * s, H * (0.3 + i * 0.18) + rand(-4, 4) * s); }
      }
      const r = cut > 0 ? 'NODE: BEDROOM' : 'LAYER 01  ::  CONNECTED'; g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`;
      g.fillText(r, W - 28 * s - g.measureText(r).width, 34 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
