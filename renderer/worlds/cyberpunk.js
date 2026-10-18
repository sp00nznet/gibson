// MEGACITY 2049: a spinner's ride through a rain-soaked megacity. Arcology towers with a thousand
// lit windows, vertical neon signs in katakana, a hologram ad turning in the air, traffic lanes of
// flying cars, flame stacks on the industrial horizon, and rain over everything.
(function (Worlds) {
  Worlds.define('cyberpunk', (k) => {
    const { C, rand, pick, env, seg, ring, ship, setCam, text3, line2 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", L = 300, FOG = 220;
    const KANA = ['サイバー', 'ネオン', 'ハッカー', '電脳', '強化', 'ラーメン', 'ギブソン', '未来', '夢', 'データ'];
    const ADS = ['ENHANCE', 'GIBSON CORP', 'REPLICANT? ASK US', 'NYX LOVES YOU', 'OFF-WORLD COLONIES', 'MORE HUMAN'];
    const towers = [];
    for (let z = 0; z < L; z += 26) for (const side of [-1, 1]) for (const lane of [0, 1]) {
      towers.push({ x: side * (22 + lane * 30 + rand(-4, 4)), z: z + rand(-5, 5) + lane * 13, w: rand(8, 14), h: rand(70, 200) * (lane ? 1.3 : 1),
        col: pick([C.violet, C.ice, C.violet]), sign: Math.random() < 0.6 ? { s: pick(KANA), col: pick([C.hot, C.neon, C.gold, C.ice]), y: rand(10, 50) } : null, seed: rand(0, 100) });
    }
    const cars = Array.from({ length: 40 }, () => ({ x: rand(-60, 60), y: pick([30, 45, 60, 80]), z: rand(0, L), v: pick([-1, 1]) * rand(20, 45), col: pick([C.hot, C.gold, C.ice]) }));
    const rain = Array.from({ length: 260 }, () => [rand(-50, 50), rand(0, 100), rand(2, 110)]);
    let cz = 0, ad = pick(ADS), adT = 0, burst = 0;
    const zOf = (o) => ((o.z - cz) % L + L) % L - 30;

    return {
      label: 'MEGACITY 2049',
      update(dt) {
        cz += (16 + env.level * 30 + env.warp * 30) * dt;
        for (const c of cars) c.z += c.v * dt;
        for (const r of rain) { r[1] -= dt * 70; if (r[1] < 0) { r[1] = 100; r[2] = rand(2, 110); r[0] = rand(-50, 50); } }
        adT += dt; if (adT > 8) { adT = 0; ad = pick(ADS); }
        burst = Math.max(0, burst - dt) || (Math.random() < dt * 0.3 ? 1.5 : 0);
      },
      signal(kind) { if (kind === 'error') burst = 1.5; },
      draw() {
        const t = env.t, cy = 48 + Math.sin(t * 0.17) * 14;
        const cam = { x: Math.sin(t * 0.11) * 6, y: cy, z: cz, yaw: Math.sin(t * 0.09) * 0.2, pitch: -0.08 + Math.sin(t * 0.13) * 0.05 };
        setCam(cam);
        // the horizon: refinery stacks breathing fire, and the pyramid
        const hz = cz + 380;
        for (let i = -4; i <= 4; i++) {
          const x = i * 45; seg(x, 0, hz, x, 40, hz, C.gold, 0.4, 900);
          if (burst > 0 && (i + Math.floor(t)) % 3 === 0) for (let n = 0; n < 5; n++) seg(x, 40, hz, x + Math.sin(t * 20 + n) * 3, 40 + burst * (10 + n * 6), hz, n % 2 ? C.gold : C.hot, burst / 1.5, 900);
        }
        for (const [a, b] of [[[-90, 0], [0, 110]], [[90, 0], [0, 110]]]) seg(a[0], a[1], hz + 60, b[0], b[1], hz + 60, C.gold, 0.6, 900);
        for (let y = 10; y < 110; y += 10) { const w = 90 * (1 - y / 110); seg(-w, y, hz + 60, w, y, hz + 60, C.gold, 0.25, 900); }
        // the towers
        for (const tw of towers) {
          const zz = zOf(tw); if (zz > 230) continue;
          const z = cz + zz, x = tw.x, w = tw.w / 2, h = tw.h;
          for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) seg(x + dx, 0, z + dz, x + dx, h, z + dz, tw.col, 0.7, FOG);
          for (const y of [h, h * 0.6]) { seg(x - w, y, z - w, x + w, y, z - w, tw.col, 0.6, FOG); seg(x - w, y, z + w, x + w, y, z + w, tw.col, 0.4, FOG); }
          seg(x, h, z, x, h + 12, z, C.hot, 0.6 + 0.4 * Math.sin(t * 4 + tw.seed), FOG); // the aircraft warning light on its mast
          if (zz < 140) { // lit windows on the face toward the street, twinkling
            const fx = x - Math.sign(x) * w;
            for (let y = 4; y < h; y += 4) for (let c = 0; c < 3; c++) {
              const on = Math.sin(tw.seed + y * 7.1 + c * 3.3 + Math.floor(t * 0.5 + tw.seed) * 0.7) > 0.2; if (!on) continue;
              const zc = z - w + 1 + c * (tw.w - 2) / 3; seg(fx, y, zc, fx, y, zc + 1.2, C.gold, 0.45, 160);
            }
          }
          if (tw.sign && zz < 160) { // a vertical neon sign, flickering now and then
            const fx = x - Math.sign(x) * (w + 0.5), fl = Math.sin(t * 23 + tw.seed) > 0.95 ? 0.2 : 1;
            [...tw.sign.s].forEach((ch, i) => text3(ch, fx, tw.sign.y - i * 3.2, z - w, tw.sign.col, 3, fl));
            seg(fx, tw.sign.y + 2.5, z - w - 1.5, fx, tw.sign.y - tw.sign.s.length * 3.2, z - w - 1.5, tw.sign.col, 0.7 * fl, FOG);
          }
        }
        // traffic
        for (const c of cars) {
          const zz = ((c.z - cz) % L + L) % L - 30; if (zz < 2 || zz > 200) continue;
          ship(c.x, c.y, cz + zz, c.v > 0 ? 0 : Math.PI, 1.2, C.ice, 0.8, 0);
          seg(c.x, c.y, cz + zz, c.x, c.y, cz + zz - Math.sign(c.v) * 8, c.col, 0.9, FOG); // tail lights streak
        }
        // the hologram: a turning ad hung over the street
        const hz2 = cz + 90 - (cz % 90), hy = 70;
        for (let i = 0; i < 4; i++) ring(0, hy + i * 6, hz2, 10, 20, C.ice, 0.25 + 0.15 * Math.sin(t * 3 + i), FOG, 'xy');
        text3(ad, -ad.length * 0.9, hy + 8, hz2, Math.floor(t * 2) % 2 ? C.hot : C.ice, 3.2, 0.8);
        // rain, in front of everything
        for (const r of rain) seg(cam.x + r[0], r[1], cz + r[2], cam.x + r[0] - 0.4, r[1] - 2.4, cz + r[2], C.ice, 0.35, 120);

        // spinner HUD
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
        g.font = `bold ${15 * s | 0}px ${MONO}`;
        g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText('SPINNER  LAPD 44', W * 0.03, H * 0.1);
        g.fillStyle = `rgba(${C.ice},0.85)`; g.fillText(`ALT ${(cy * 4).toFixed(0)} M`, W * 0.03, H * 0.1 + 24 * s);
        g.fillText(`RAIN 14MM/H  ACID 3.1`, W * 0.03, H * 0.1 + 46 * s);
        g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('2049 11 20  LOS ANGELES', W * 0.85, H * 0.17);
        for (let i = 0; i < 12; i++) { const y = H * 0.25 + i * 12 * s, l = (0.5 + 0.5 * Math.sin(t * 2 + i)) * 60 * s; line2(W * 0.97 - l, y, W * 0.97, y, C.ice, 0.6); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
