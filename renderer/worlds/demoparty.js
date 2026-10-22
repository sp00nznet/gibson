// DEMOPARTY: a demoscene intro on the big screen. Every 12 seconds the next effect: a plasma in
// coarse blocks, a rotozoomer turning a checkered logo, copper bars bouncing, and a ball object
// spinning in 3D. They all pump on the kick and swell with the bass. A sine scroller runs greets to
// (made-up) groups along the bottom, and the title, effect and entry number sit along the top.
(function (Worlds) {
  Worlds.define('demoparty', (k) => {
    const { env } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FX = ['PLASMA', 'ROTOZOOM', 'COPPER BARS', 'VECTOR BALLS'];
    const GREETS = 'GIBSON PRESENTS A 4K INTRO  ::  CODE NYX  ::  MUSIC THE SYNTH  ::  GREETINGS TO NEON SYNDICATE, CRYSTAL VOID, BITSHIFTERS, THE ORANGE BOX, PHOSPHOR, STACK SMASHERS, MODEMS OF DOOM, RASTER KIDS AND EVERYONE AT THE PARTY  ::  NO COPPER WAS HARMED  ::  ';
    // the rotozoomer's texture: a 16x16 checker with a ring cut into it
    const TEX = Array.from({ length: 256 }, (_, i) => { const x = i % 16, y = i >> 4, r = Math.hypot(x - 7.5, y - 7.5); return ((x >> 2) + (y >> 2)) % 2 === 0 ? (r > 4 && r < 6 ? 0 : 1) : (r > 4 && r < 6 ? 2 : 0); });
    const BALLS = []; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) BALLS.push([x, y, z]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; BALLS.push([Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2]); } // and a ring round it
    const hsl = (h, l, a) => `hsla(${h | 0},100%,${l | 0}%,${a})`;
    let effect = 0, fxT = 0;
    // dimmer where the terminal sits (the middle two-thirds), so the text stays readable
    const behind = (x, y, W, H) => (x > W * 0.16 && x < W * 0.84 && y > H * 0.06 && y < H * 0.94 ? 0.3 : 1);

    function plasma(g, W, H, t, a) {
      const cw = 40, chh = 40, b = env.bass;
      for (let y = 0; y < H; y += chh) for (let x = 0; x < W; x += cw) {
        const v = Math.sin(x * 0.006 + t) + Math.sin(y * 0.008 + t * 1.3) + Math.sin((x + y) * 0.004 + t * 0.7) + Math.sin(Math.hypot(x - W / 2, y - H / 2) * 0.01 - t * 2);
        g.fillStyle = hsl(200 + v * 60 + t * 20, 45 + b * 20, a * behind(x, y, W, H)); g.fillRect(x, y, cw - 2, chh - 2);
      }
    }
    function rotozoom(g, W, H, t, a) {
      const cell = 28, ang = t * 0.5, z = 0.12 + 0.05 * Math.sin(t * 0.7) - env.bass * 0.03, ca = Math.cos(ang) * z, sa = Math.sin(ang) * z;
      for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
        const dx = x - W / 2, dy = y - H / 2, u = Math.floor(dx * ca - dy * sa + t * 3) & 15, v = Math.floor(dx * sa + dy * ca) & 15, c = TEX[v * 16 + u];
        if (!c) continue;
        g.fillStyle = c === 1 ? hsl(300, 55, a * behind(x, y, W, H)) : hsl(50, 60, a * behind(x, y, W, H)); g.fillRect(x, y, cell - 3, cell - 3);
      }
    }
    function copper(g, W, H, t, a) {
      for (let i = 0; i < 7; i++) {
        const y = H / 2 + Math.sin(t * 1.4 + i * 0.55) * H * 0.38, h = 26 + env.pulse * 14, hue = i * 50 + t * 30;
        const gr = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
        gr.addColorStop(0, hsl(hue, 10, 0)); gr.addColorStop(0.5, hsl(hue, 60, a * 1.6)); gr.addColorStop(1, hsl(hue, 10, 0));
        g.fillStyle = gr; g.fillRect(0, y - h / 2, W, h);
      }
    }
    function balls(g, W, H, t, a) {
      const rx = t * 0.7, ry = t * 0.5, sc = Math.min(W, H) * (0.16 + env.pulse * 0.03), out = [];
      for (const [x, y, z] of BALLS) {
        const x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry), y1 = y * Math.cos(rx) - z1 * Math.sin(rx), z2 = y * Math.sin(rx) + z1 * Math.cos(rx), d = 1 / (1 + (z2 + 4) * 0.12);
        out.push([W / 2 + x1 * sc * d, H / 2 + y1 * sc * d, d, z2]);
      }
      out.sort((p, q) => q[3] - p[3]);
      for (const [x, y, d, z] of out) { g.fillStyle = hsl(180 + z * 30, 55 + d * 20, a * 1.5); g.beginPath(); g.arc(x, y, 14 * d * (1 + env.bass * 0.5), 0, Math.PI * 2); g.fill(); }
    }
    const DRAW = [plasma, rotozoom, copper, balls];

    return {
      label: 'DEMOPARTY',
      signal(kind) { if (kind === 'ok') { effect = (effect + 1) % FX.length; fxT = 0; } },
      update(dt) { fxT += dt; if (fxT > 12) { fxT = 0; effect = (effect + 1) % FX.length; } },
      draw() {
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), t = env.t, fade = Math.min(1, fxT * 2, (12 - fxT) * 2);
        DRAW[effect](g, W, H, t, 0.18 * fade + env.pulse * 0.06);
        // the sine scroller: its band wiped each frame, so the letters stay sharp on the fading canvas
        const band = 70 * s, by = H - band;
        g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, by, W, band); g.globalCompositeOperation = 'lighter';
        g.font = `bold ${30 * s | 0}px ${MONO}`;
        const cw = 26 * s, off = (t * 160 * s) % (GREETS.length * cw), first = Math.floor(off / cw);
        for (let i = 0; i * cw < W + cw; i++) {
          const ch = GREETS[(first + i) % GREETS.length], x = i * cw - (off % cw), y = by + band * 0.6 + Math.sin(x * 0.012 + t * 3) * 12 * s * (1 + env.bass);
          g.fillStyle = hsl((x * 0.3 + t * 80) % 360, 65, 0.95); g.fillText(ch, x, y);
        }
        // the top line
        g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = hsl(50, 70, 0.95); g.fillText('GIBSON  ::  4K INTRO  ::  PARTY 2026', 28 * s, 34 * s);
        g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = hsl(190, 70, 0.85); g.fillText(`PART ${effect + 1}/4  ${FX[effect]}`, 28 * s, 54 * s);
        const e = 'ENTRY #07  ::  PC 4K COMPO'; g.fillText(e, W - 28 * s - g.measureText(e).width, 34 * s);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
