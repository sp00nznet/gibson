// MYSTIFY: Mystify Your Mind, in neon. Two polygons whose corners drift and bounce off the
// edges of the screen, each dragging a tail of echoes that slide through the palette. The corners
// sweep the whole screen, so the shapes keep crossing the margins around the terminal.
(function (Worlds) {
  Worlds.define('mystify', (k) => {
    const { C, rand, env, line2 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", ECHO = 12, GAP = 4; // echoes, frames apart
    const PAL = [C.neon, C.ice, C.violet, C.hot, C.gold].map((c) => c.split(',').map(Number));
    const mix = (f) => { // a colour that slides around the palette
      f = ((f % PAL.length) + PAL.length) % PAL.length;
      const i = Math.floor(f), a = PAL[i], b = PAL[(i + 1) % PAL.length], t = f - i;
      return a.map((v, j) => Math.round(v + (b[j] - v) * t)).join(',');
    };
    // corners live in 0..1 screen units, so a resize just stretches them
    const shapes = [0, 2.5].map((hue) => ({ hue, hist: [], v: Array.from({ length: 4 }, () => {
      const a = rand(0, Math.PI * 2), s = rand(0.07, 0.13); return { x: rand(0, 1), y: rand(0, 1), vx: Math.cos(a) * s, vy: Math.sin(a) * s };
    }) }));
    return {
      label: 'MYSTIFY',
      update(dt) {
        const sp = 1 + env.level * 2.5 + env.warp;
        for (const sh of shapes) {
          for (const v of sh.v) {
            v.x += v.vx * dt * sp; v.y += v.vy * dt * sp * 1.6; // y in shorter units: same pace on screen
            if (v.x < 0) { v.x = 0; v.vx = Math.abs(v.vx); } if (v.x > 1) { v.x = 1; v.vx = -Math.abs(v.vx); }
            if (v.y < 0) { v.y = 0; v.vy = Math.abs(v.vy); } if (v.y > 1) { v.y = 1; v.vy = -Math.abs(v.vy); }
          }
          sh.hue += dt * 0.25;
          sh.hist.unshift(sh.v.map((v) => [v.x, v.y]));
          if (sh.hist.length > ECHO * GAP) sh.hist.pop();
        }
      },
      draw() {
        const W = k.W, H = k.H, g = k.g, s = Math.min(W / 1920, H / 1080);
        for (const sh of shapes) {
          for (let e = ECHO - 1; e >= 0; e--) {
            const p = sh.hist[e * GAP]; if (!p) continue;
            const col = mix(sh.hue - e * 0.12), al = 1 - e / ECHO;
            for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; line2(a[0] * W, a[1] * H, b[0] * W, b[1] * H, col, al); }
          }
          // the lead polygon's corners get a crosshair and a readout
          g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${mix(sh.hue)},0.75)`;
          for (const v of sh.v) {
            const x = v.x * W, y = v.y * H, r = 7 * s;
            line2(x - r, y, x + r, y, C.white, 0.7); line2(x, y - r, x, y + r, C.white, 0.7);
            const t = `${(x | 0).toString(16).toUpperCase().padStart(3, '0')}:${(y | 0).toString(16).toUpperCase().padStart(3, '0')}`;
            g.fillText(t, Math.min(W - 70 * s, x + 10 * s), Math.max(14 * s, y - 8 * s));
          }
        }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
