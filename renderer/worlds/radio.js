// ON AIR: a late-night radio booth. The desk's faders and the twin VU needles ride whatever is
// playing (the jukebox's spectrum, or the kick when it's the synth), a record spins, the reels of
// the tape deck turn, and the mast outside the window sends rings out over the town on every beat.
// The dial at the top tunes in, the song's name runs along the bottom, and the request line
// lights up when you're busy. A command that fails is dead air for a moment.
(function (Worlds) {
  Worlds.define('radio', (k) => {
    const { C, rand, env, seg, setCam, lookAt, text3, ring, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 120, CALL = 'WGBS', FREQ = 101.5;
    const N = 12, fad = new Array(N).fill(0);
    let spin = 0, rings = [], dead = 0, calls = 0, callT = 3, tune = 88;
    const town = Array.from({ length: 30 }, (_, i) => ({ x: -60 + i * 4 + rand(-1, 1), h: rand(2, 9), w: rand(2, 3.5) }));

    function level(i) { // 0..1 for channel i
      if (env.spec && env.spec.some((v) => v > 0)) return env.spec[Math.floor(i * env.spec.length / N)];
      return Math.max(0, env.pulse * (0.5 + 0.5 * Math.sin(i * 1.7 + env.t * 3)) * (0.4 + env.level * 0.6) + Math.sin(env.t * (1 + i * 0.3)) * 0.08);
    }
    function circle(x, y, z, r, a0, n, col, al, rot) { // a wheel facing the camera (xy plane) with spokes
      ring(x, y, z, r, n, col, al, FOG, 'xy');
      for (let s = 0; s < 3; s++) { const a = rot + s * Math.PI * 2 / 3; seg(x, y, z, x + Math.cos(a) * r, y + Math.sin(a) * r, z, col, al * 0.8, FOG); }
      ring(x, y, z, r * 0.2, 10, col, al, FOG, 'xy');
    }

    return {
      label: 'ON AIR',
      signal(kind) { if (kind === 'error') dead = 1.5; },
      update(dt) {
        dead = Math.max(0, dead - dt);
        spin += dt * (dead ? 0.3 : 3.5);
        for (let i = 0; i < N; i++) fad[i] += ((dead ? 0 : level(i)) - fad[i]) * Math.min(1, dt * 12);
        if (env.pulse > 0.9 && !dead && (!rings.length || rings[rings.length - 1].r > 6)) rings.push({ r: 0 });
        for (const r of rings) r.r += dt * 22;
        rings = rings.filter((r) => r.r < 70);
        callT -= dt * (0.3 + env.level * 2); if (callT < 0) { calls++; callT = rand(2, 6); }
        tune += (FREQ - tune) * Math.min(1, dt * 0.8);
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: Math.sin(t * 0.07) * 0.6, y: 1.9, z: -3.2 }, 0, 1.1, 3));
        // the room: floor, walls, ceiling
        for (let x = -4; x <= 4; x += 1) seg(x, 0, -3, x, 0, 5, C.violet, 0.25, FOG);
        for (let z = -3; z <= 5; z += 1) seg(-4, 0, z, 4, 0, z, C.violet, 0.25, FOG);
        for (const sx of [-4, 4]) { seg(sx, 0, 5, sx, 3, 5, C.violet, 0.5, FOG); seg(sx, 3, -3, sx, 3, 5, C.violet, 0.4, FOG); for (let y = 0.5; y < 3; y += 0.5) seg(sx, y, 0, sx, y, 5, C.violet, 0.12, FOG); } // acoustic panels
        seg(-4, 3, 5, 4, 3, 5, C.violet, 0.5, FOG);
        // the window, and the night beyond it
        const wy0 = 1.3, wy1 = 2.7;
        for (const [a, b] of [[[-2.6, wy0], [2.6, wy0]], [[2.6, wy0], [2.6, wy1]], [[2.6, wy1], [-2.6, wy1]], [[-2.6, wy1], [-2.6, wy0]]]) seg(a[0], a[1], 5, b[0], b[1], 5, C.ice, 0.8, FOG);
        for (const b of town) { const z = 45; seg(b.x, -4, z, b.x, b.h - 4, z, C.ice, 0.35, 200); seg(b.x, b.h - 4, z, b.x + b.w, b.h - 4, z, C.ice, 0.35, 200); seg(b.x + b.w, b.h - 4, z, b.x + b.w, -4, z, C.ice, 0.35, 200); }
        const mx = 8, mz = 40, mh = 26; // the mast: a lattice tower
        for (let y = -4; y < mh; y += 2) {
          const w0 = 2 * (1 - (y + 4) / (mh + 4)), w1 = 2 * (1 - (y + 6) / (mh + 4));
          seg(mx - w0, y, mz, mx - w1, y + 2, mz, C.white, 0.6, 200); seg(mx + w0, y, mz, mx + w1, y + 2, mz, C.white, 0.6, 200);
          seg(mx - w0, y, mz, mx + w1, y + 2, mz, C.white, 0.3, 200); seg(mx + w0, y, mz, mx - w1, y + 2, mz, C.white, 0.3, 200);
        }
        if (Math.sin(t * 3) > 0) ring(mx, mh, mz, 0.4, 8, C.hot, 1, 200, 'xy');
        for (const r of rings) ring(mx, mh, mz, r.r, 40, C.hot, Math.max(0, 1 - r.r / 70) * 0.8, 200, 'xy');
        // ON AIR, over the window
        box(0, 2.85, 4.9, 1.4, 0.35, 0.1, C.hot, 0.8, FOG);
        text3(dead ? 'DEAD AIR' : 'ON AIR', dead ? -0.62 : -0.45, 2.92, 4.8, dead ? C.ice : C.hot, 0.24, dead ? 0.6 : 0.7 + env.pulse * 0.3);
        // the desk
        const dz = 1.2, dy = 0.9;
        box(0, 0, dz + 0.6, 6, dy, 1.4, C.ice, 0.55, FOG);
        // the console: a sloped panel of faders
        const cx0 = -1.4, cw = 2.8, zf = dz + 0.1, zb = dz + 0.9, yf = dy + 0.05, yb = dy + 0.35;
        seg(cx0, yf, zf, cx0 + cw, yf, zf, C.neon, 0.8, FOG); seg(cx0, yb, zb, cx0 + cw, yb, zb, C.neon, 0.8, FOG);
        seg(cx0, yf, zf, cx0, yb, zb, C.neon, 0.8, FOG); seg(cx0 + cw, yf, zf, cx0 + cw, yb, zb, C.neon, 0.8, FOG);
        for (let i = 0; i < N; i++) {
          const x = cx0 + 0.15 + i * (cw - 0.3) / (N - 1), f = Math.min(1, fad[i]);
          seg(x, yf + 0.02, zf + 0.1, x, yb - 0.04, zb - 0.1, C.neon, 0.3, FOG);
          const q = 0.1 + f * 0.6, py = yf + (yb - yf) * q, pz = zf + (zb - zf) * q;
          seg(x - 0.06, py, pz, x + 0.06, py, pz, f > 0.8 ? C.hot : C.gold, 1, FOG);
          ring(x, yb + 0.08, zb + 0.02, 0.05, 6, C.neon, 0.5, FOG, 'xy'); // a knob per channel
        }
        // the VU meters
        for (const [i, sx] of [[0, -0.5], [1, 0.5]]) {
          const x = sx, y = dy + 0.75, z = dz + 1.1, v = Math.min(1, (fad[i * 3] + fad[i * 3 + 1]) * 0.7);
          for (let a = 0; a <= 8; a++) { const ang = Math.PI * (0.8 - a * 0.075); seg(x + Math.cos(ang) * 0.3, y + Math.sin(ang) * 0.3, z, x + Math.cos(ang) * 0.34, y + Math.sin(ang) * 0.34, z, a > 6 ? C.hot : C.gold, 0.8, FOG); }
          const ang = Math.PI * (0.8 - v * 0.6);
          seg(x, y, z, x + Math.cos(ang) * 0.32, y + Math.sin(ang) * 0.32, z, C.white, 1, FOG);
          seg(x - 0.4, y - 0.05, z, x + 0.4, y - 0.05, z, C.gold, 0.4, FOG);
        }
        // the turntable, left
        const tx = -2.3, tz = dz + 0.5;
        box(tx, dy, tz, 1.2, 0.12, 1, C.ice, 0.5, FOG);
        ring(tx, dy + 0.14, tz, 0.45, 24, C.white, 0.8, FOG);
        for (let g = 0.15; g < 0.45; g += 0.07) ring(tx, dy + 0.15, tz, g, 20, C.violet, 0.4, FOG);
        seg(tx, dy + 0.16, tz, tx + Math.cos(spin) * 0.43, dy + 0.16, tz + Math.sin(spin) * 0.43, C.hot, 0.9, FOG); // the label's edge, going round
        seg(tx + 0.5, dy + 0.2, tz + 0.4, tx + 0.15, dy + 0.18, tz - 0.1, C.gold, 0.9, FOG); // tonearm
        // the reel-to-reel, right
        const rx = 2.3, rz = dz + 1.0;
        box(rx, dy, rz, 1.2, 1.2, 0.3, C.ice, 0.5, FOG);
        circle(rx - 0.3, dy + 0.85, rz - 0.2, 0.25, 0, 16, C.white, 0.8, spin * 0.8);
        circle(rx + 0.3, dy + 0.85, rz - 0.2, 0.25, 0, 16, C.white, 0.8, spin * 0.8);
        seg(rx - 0.3, dy + 0.6, rz - 0.2, rx + 0.3, dy + 0.6, rz - 0.2, C.gold, 0.6, FOG);
        // the mic on its boom
        const m = [0.15, 1.45, dz - 0.2];
        seg(1.4, dy + 0.4, dz + 0.9, 0.9, 1.9, dz + 0.4, C.white, 0.6, FOG); seg(0.9, 1.9, dz + 0.4, m[0], m[1] + 0.12, m[2], C.white, 0.6, FOG);
        for (let y = -0.12; y <= 0.12; y += 0.06) ring(m[0], m[1] + y, m[2], 0.09, 12, C.gold, 0.8, FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      // the dial: a tuning scale with the needle drifting onto the station
      const x0 = 28 * s, x1 = 360 * s, y = 52 * s, f2x = (f) => x0 + (f - 88) / 20 * (x1 - x0);
      g.strokeStyle = `rgba(${C.gold},0.7)`; g.lineWidth = 1; g.beginPath();
      for (let f = 88; f <= 108; f += 0.5) { const x = f2x(f), big = f % 2 === 0; g.moveTo(x, y); g.lineTo(x, y - (big ? 12 : 6) * s); }
      g.stroke();
      g.font = `${10 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.7)`;
      for (let f = 88; f <= 108; f += 4) g.fillText(String(f), f2x(f) - 6 * s, y + 14 * s);
      g.fillStyle = `rgba(${C.hot},0.95)`; g.fillRect(f2x(tune) - 1.5 * s, y - 22 * s, 3 * s, 26 * s);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.9)`; g.fillText(`${CALL}  ${tune.toFixed(1)} FM`, x0, 24 * s);
      // now playing
      const song = (env.song || 'STATION ID').toUpperCase(), msg = `NOW PLAYING  ::  ${song}  ::  ${CALL} ${FREQ} FM  ::  ALL NIGHT, EVERY NIGHT  ::  `;
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.9)`;
      const w = g.measureText(msg).width, off = (env.t * 35 * s) % w;
      g.save(); g.beginPath(); g.rect(28 * s, H - 50 * s, 420 * s, 30 * s); g.clip();
      g.fillText(msg + msg, 28 * s - off, H - 30 * s); g.restore();
      // the request line
      const r = 'REQUEST LINE', lit = callT < 1 && Math.sin(env.t * 18) > 0;
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${lit ? C.hot : C.ice},0.9)`; g.fillText(r, W - 28 * s - g.measureText(r).width, 24 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`;
      const c = `${String(calls).padStart(3, '0')} CALLERS TONIGHT`; g.fillText(c, W - 28 * s - g.measureText(c).width, 46 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
