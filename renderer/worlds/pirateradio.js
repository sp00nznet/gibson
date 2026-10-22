// PIRATE RADIO: an old rust-bucket anchored off the coast at night, broadcasting. The view is from
// the bridge, rolling with the swell, so the horizon tips and the bow climbs and drops. A tall mast
// amidships sends a ring out on every beat, the studio cabin on deck glows, the lighthouse on the
// far shore sweeps its beam across the water, and now and then a squall blows through. A command
// that fails trips the transmitter: OFF AIR until it comes back.
(function (Worlds) {
  Worlds.define('pirateradio', (k) => {
    const { C, rand, env, seg, setCam, lookAt, text3, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 90, SEA = 260, KHZ = 1520;
    const DECK = [[-4, -12], [4, -12], [4.8, 0], [3.4, 10], [0, 17], [-3.4, 10], [-4.8, 0]];
    const drops = Array.from({ length: 140 }, () => [rand(-12, 12), rand(0, 14), rand(-8, 22)]);
    let roll = 0, pitch = 0, heave = 0, rings = [], off = 0, dial = 1400;

    function S(x, y, z) { // ship-local → world: roll, then pitch, then heave
      const cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = x * cr - y * sr, y1 = x * sr + y * cr;
      return [x1, y1 * cp + z * sp + heave, z * cp - y1 * sp];
    }
    const L = (a, b, col, al) => { const p = S(...a), q = S(...b); seg(p[0], p[1], p[2], q[0], q[1], q[2], col, al, FOG); };
    const wave = (x, z, t) => 0.45 * Math.sin(x * 0.12 + t * 0.9 + z * 0.07) + 0.3 * Math.sin(z * 0.21 - t * 1.1) + 0.15 * Math.sin((x + z) * 0.3 + t * 1.7);

    return {
      label: 'PIRATE RADIO',
      signal(kind) { if (kind === 'error') off = 2.5; },
      update(dt) {
        const t = env.t;
        roll = Math.sin(t * 0.55) * 0.07 + Math.sin(t * 1.3) * 0.015;
        pitch = Math.sin(t * 0.4 + 1) * 0.035; heave = Math.sin(t * 0.7) * 0.35;
        off = Math.max(0, off - dt);
        if (env.pulse > 0.9 && !off && (!rings.length || rings[rings.length - 1].r > 5)) rings.push({ r: 0 });
        for (const r of rings) r.r += dt * 20;
        rings = rings.filter((r) => r.r < 60);
        dial += (KHZ + Math.sin(t * 0.3) * 2 - dial) * Math.min(1, dt * 0.7);
        for (const d of drops) { d[1] -= dt * 16; d[0] += dt * 4; if (d[1] < 0) { d[1] = 14; d[0] = rand(-12, 12); } }
      },
      draw() {
        const t = env.t, eye = S(0, 8.5, -11), at = S(0, 2.5, 22), cam = lookAt({ x: eye[0], y: eye[1], z: eye[2] }, at[0], at[1], at[2]);
        cam.roll = -roll; setCam(cam);
        // the sea, fixed in the world: wave rows out to the horizon
        for (let z = -10; z < SEA; z += z < 40 ? 4 : 10) {
          let p = null;
          for (let x = -150; x <= 150; x += 10) { const q = [x, wave(x, z, t) - 1, z]; if (p) seg(...p, ...q, C.ice, 0.35, SEA); p = q; }
        }
        // the far shore: hills, the lighthouse and its sweeping beam
        for (let i = 0; i < 26; i++) { const x0 = -210 + i * 10, h = (n) => 3 + Math.abs(Math.sin(n * 0.5) * 6 + Math.sin(n * 0.19) * 5); seg(x0, h(i) - 1, 200, x0 + 10, h(i + 1) - 1, 200, C.violet, 0.6, 500); }
        const lx = -80, lz = 195, ly = 22;
        seg(lx - 1.5, 4, lz, lx - 0.8, ly, lz, C.white, 0.6, 500); seg(lx + 1.5, 4, lz, lx + 0.8, ly, lz, C.white, 0.6, 500);
        const a = t * 0.7, toCam = Math.max(0, Math.cos(a - Math.atan2(-lx, -lz)));
        for (const da of [-0.05, 0.05]) seg(lx, ly, lz, lx + Math.sin(a + da) * 160, ly - 4, lz + Math.cos(a + da) * 160, C.gold, 0.15 + toCam * 0.5, 500);
        ring(lx, ly, lz, 0.6 + toCam * 2, 10, C.gold, 0.5 + toCam * 0.5, 500, 'xy');
        // the ship: deck, hull down to the waterline, rails
        for (let i = 0; i < DECK.length; i++) {
          const [x, z] = DECK[i], [x2, z2] = DECK[(i + 1) % DECK.length];
          L([x, 2, z], [x2, 2, z2], C.hot, 1); L([x * 0.85, 0, z], [x2 * 0.85, 0, z2], C.hot, 0.4); L([x, 2, z], [x * 0.85, 0, z], C.hot, 0.4);
          L([x, 2.9, z], [x2, 2.9, z2], C.gold, 0.6); // the rail
        }
        for (let z = -10; z < 10; z += 2) L([-4.2, 2, z], [4.2, 2, z], C.hot, 0.25); // deck planks
        // the studio cabin, its window glowing
        const cb = [[-1.2, 2, 0], [1.6, 2, 0], [1.6, 2, 3], [-1.2, 2, 3]];
        for (let i = 0; i < 4; i++) { const p = cb[i], q = cb[(i + 1) % 4]; L(p, q, C.gold, 0.6); L([p[0], 3.9, p[2]], [q[0], 3.9, q[2]], C.gold, 0.6); L(p, [p[0], 3.9, p[2]], C.gold, 0.6); }
        const glow = 0.6 + env.pulse * 0.4;
        L([-0.6, 2.7, -0.01], [0.9, 2.7, -0.01], C.gold, glow); L([-0.6, 3.5, -0.01], [0.9, 3.5, -0.01], C.gold, glow); L([-0.6, 2.7, -0.01], [-0.6, 3.5, -0.01], C.gold, glow); L([0.9, 2.7, -0.01], [0.9, 3.5, -0.01], C.gold, glow);
        const top = S(0, 4.5, 3.5); text3(off ? 'OFF AIR' : 'ON AIR', top[0] - 0.9, top[1], top[2], off ? C.ice : C.hot, 0.35, off ? 0.6 : 0.7 + env.pulse * 0.3);
        // the mast, its stays and the long wire
        const mz = 6, mh = 21;
        L([0, 2, mz], [0, mh, mz], C.white, 0.7);
        for (let y = 5; y < mh; y += 4) L([-1.2 * (1 - y / mh) - 0.2, y, mz], [1.2 * (1 - y / mh) + 0.2, y, mz], C.white, 0.4);
        L([0, mh, mz], [-3.4, 2, 1], C.white, 0.25); L([0, mh, mz], [3.4, 2, 1], C.white, 0.25); L([0, mh, mz], [0, 2, 14.5], C.white, 0.25);
        L([0, mh - 1, mz], [0, 8, -11], C.ice, 0.3);
        const mt = S(0, mh, mz);
        if (Math.sin(t * 3) > 0) ring(mt[0], mt[1], mt[2], 0.3, 8, C.hot, 1, FOG, 'xy');
        if (!off) for (const r of rings) ring(mt[0], mt[1], mt[2], r.r, 36, C.hot, Math.max(0, 1 - r.r / 60) * 0.8, SEA, 'xy');
        // the bridge window frame around us
        for (const x of [-4, 4]) L([x, 6.5, -9.2], [x, 9.6, -9.2], C.violet, 0.5);
        L([-4, 6.5, -9.2], [4, 6.5, -9.2], C.violet, 0.6);
        // squalls
        if (Math.sin(t * 0.05) > 0.4) for (const d of drops) { const p = [d[0] + eye[0], d[1] + eye[1] - 6, d[2] + eye[2]]; seg(p[0], p[1], p[2], p[0] - 0.12, p[1] + 0.5, p[2], C.ice, 0.4, 40); }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      // the AM dial
      const x0 = 28 * s, x1 = 360 * s, y = 52 * s, f2x = (f) => x0 + (f - 530) / 1170 * (x1 - x0);
      g.strokeStyle = `rgba(${C.gold},0.7)`; g.lineWidth = 1; g.beginPath();
      for (let f = 530; f <= 1700; f += 30) { const x = f2x(f), big = (f - 530) % 150 === 0; g.moveTo(x, y); g.lineTo(x, y - (big ? 12 : 6) * s); }
      g.stroke();
      g.font = `${10 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.7)`;
      for (const f of [530, 800, 1100, 1400, 1700]) g.fillText(String(f), f2x(f) - 8 * s, y + 14 * s);
      g.fillStyle = `rgba(${C.hot},0.95)`; g.fillRect(f2x(dial) - 1.5 * s, y - 22 * s, 3 * s, 26 * s);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.9)`; g.fillText(`RADIO NEPTUNE  ${Math.round(dial)} AM`, x0, 24 * s);
      // the sea report
      const R = (str, yy, col) => { g.fillStyle = `rgba(${col},0.85)`; g.fillText(str, W - 28 * s - g.measureText(str).width, yy); };
      g.font = `${13 * s | 0}px ${MONO}`;
      R(`SEA STATE 4  ::  WIND NW ${Math.round(18 + env.level * 14)} KT`, 30 * s, C.ice);
      R(`HEADING ${String(Math.round(312 + roll * 60)).padStart(3, '0')}  ::  AT ANCHOR`, 50 * s, C.ice);
      // the call
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.9)`; g.fillText('BROADCASTING FROM INTERNATIONAL WATERS', 28 * s, H - 52 * s);
      g.font = `${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.85)`;
      g.fillText(off ? 'TRANSMITTER TRIPPED  ::  STAND BY' : `NOW PLAYING  ::  ${(env.song || 'THE DEEP END').toUpperCase().slice(0, 40)}`, 28 * s, H - 30 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
