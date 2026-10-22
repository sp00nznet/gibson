// VIDEO STORE: a rental shop after closing. The camera drifts down an aisle between shelves of
// tapes (a spine per slot, a few face-out boxes with their titles), under a NEW RELEASES sign
// that buzzes, toward the front window: a wall of stacked CRTs, each running its own loop
// (static, colour bars, a bouncing line, a turning wireframe, a PLAY arrow). A command that works
// rents a tape onto the slip in the corner; one that fails knocks every set to snow.
(function (Worlds) {
  Worlds.define('videostore', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, text3, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 70, AL = 15, WIN = 18;
    const TITLES = ['CYBER NINJA III', 'LASER COP', 'NIGHT DRIVE', 'ROBO SHARK', 'MALL OF THE DEAD', 'TURBO KARATE', 'DEADLY MODEM', 'SPACE MALL', 'NEON HEAT', 'GALAXY LUAU', 'BEACH COMMANDO', 'HYPERDRIVE HIGH', 'ATTACK OF THE 50 FT TELEMARKETER', 'CHROME DRAGON', 'POLICE ROBOT 2', 'SYNTH WARS', 'THE BLOB FROM ACCOUNTING', 'SKATEBOARD NINJAS'];
    const COLS = [C.hot, C.ice, C.gold, C.neon, C.violet, C.white];
    const hash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; return (Math.imul(h, 0xc2b2ae35) >>> 0) / 4294967296; };
    // face-out boxes: a few covers turned to the aisle, with titles
    const faces = Array.from({ length: 10 }, (_, i) => ({ side: i % 2 ? 1 : -1, z: 1.5 + i * 1.3, y: [0.45, 1.05, 1.65][i % 3], t: TITLES[i % TITLES.length], col: COLS[i % COLS.length] }));
    let snow = 0, slip = [], fee = 0;

    function tv(i, x, y, w, h) { // one set: cabinet, screen, and its loop drawn on the glass
      const z = WIN, t = env.t, sx0 = x - w / 2 + 0.06, sx1 = x + w / 2 - 0.06, sy0 = y + 0.06, sy1 = y + h - 0.06, zz = z - 0.02;
      box(x, y, z + 0.2, w, h, 0.4, C.white, 0.35, FOG);
      seg(sx0, sy0, zz, sx1, sy0, zz, C.ice, 0.5, FOG); seg(sx1, sy0, zz, sx1, sy1, zz, C.ice, 0.5, FOG); seg(sx1, sy1, zz, sx0, sy1, zz, C.ice, 0.5, FOG); seg(sx0, sy1, zz, sx0, sy0, zz, C.ice, 0.5, FOG);
      const u = (a) => sx0 + (sx1 - sx0) * a, v = (b) => sy0 + (sy1 - sy0) * b, mode = snow > 0 ? 0 : i % 5;
      if (mode === 0) for (let n = 0; n < 7; n++) { const a = Math.random(), b = Math.random(); seg(u(a), v(b), zz, u(Math.min(1, a + 0.15)), v(b), zz, C.white, 0.6, FOG); }
      else if (mode === 1) for (let n = 0; n < 6; n++) for (let m = 0; m < 3; m++) seg(u((n + m / 3) / 6), v(0.25), zz, u((n + m / 3) / 6), v(1), zz, COLS[n], 0.8, FOG);
      else if (mode === 2) { const b = Math.abs(((t * 0.7 + i * 0.3) % 2) - 1); seg(u(0), v(b), zz, u(1), v(b), zz, C.neon, 0.9, FOG); }
      else if (mode === 3) { // a turning wireframe square-in-a-square
        const a = t * 1.3 + i, cx = (sx0 + sx1) / 2, cy = (sy0 + sy1) / 2, r = (sy1 - sy0) * 0.38;
        for (let q = 0; q < 4; q++) { const a0 = a + q * Math.PI / 2, a1 = a0 + Math.PI / 2; seg(cx + Math.cos(a0) * r * 1.3, cy + Math.sin(a0) * r, zz, cx + Math.cos(a1) * r * 1.3, cy + Math.sin(a1) * r, zz, C.hot, 0.9, FOG); }
      } else if (Math.sin(t * 3) > 0) { const cx = u(0.45), cy = v(0.5), r = (sy1 - sy0) * 0.25; seg(cx, cy - r, zz, cx + r, cy, zz, C.neon, 1, FOG); seg(cx + r, cy, zz, cx, cy + r, zz, C.neon, 1, FOG); seg(cx, cy + r, zz, cx, cy - r, zz, C.neon, 1, FOG); }
    }

    return {
      label: 'VIDEO STORE',
      signal(kind) {
        if (kind === 'error') snow = 2;
        if (kind === 'ok') { slip.unshift(`${pick(TITLES).slice(0, 18).padEnd(18)} DUE ${pick(['MON', 'TUE', 'WED', 'THU', 'FRI'])}  $2.99`); slip.length = Math.min(slip.length, 5); }
      },
      update(dt) { snow = Math.max(0, snow - dt); fee += dt * (0.01 + env.level * 0.05); },
      draw() {
        const t = env.t, cz = 2 + (Math.sin(t * 0.05) + 1) * 3.5;
        setCam(lookAt({ x: Math.sin(t * 0.11) * 0.4, y: 1.6, z: cz - 3 }, Math.sin(t * 0.07) * 0.8, 1.3, cz + 8));
        // floor tiles and ceiling strip lights
        for (let x = -5; x <= 5; x += 1) seg(x, 0, -2, x, 0, WIN, C.violet, 0.2, FOG);
        for (let z = -2; z <= WIN; z += 1) seg(-5, 0, z, 5, 0, z, C.violet, 0.2, FOG);
        for (let z = 0; z < WIN; z += 4) seg(0, 3.2, z, 0, 3.2, z + 2.5, C.white, 0.5 + 0.1 * Math.sin(t * 50 + z), FOG);
        // the shelves either side of the aisle: uprights, boards, a spine per slot
        for (const side of [-1, 1]) {
          const x = side * 1.6, back = side * 2.1;
          for (let z = 0; z <= AL; z += 3) seg(x, 0, z, x, 2.3, z, C.ice, 0.5, FOG);
          for (const y of [0.4, 1.0, 1.6, 2.2]) { seg(x, y, 0, x, y, AL, C.ice, 0.45, FOG); seg(back, y, 0, back, y, AL, C.ice, 0.2, FOG); }
          for (const [r, y] of [[0, 0.42], [1, 1.02], [2, 1.62]]) for (let n = 0; n < AL / 0.2; n++) {
            const z = n * 0.2 + 0.1, hgt = 0.34 + hash(n * 7 + r * 131 + side) * 0.08;
            seg(x - side * 0.02, y, z, x - side * 0.02, y + hgt, z, COLS[Math.floor(hash(n + r * 97 + side * 31) * COLS.length)], 0.45, FOG);
          }
        }
        for (const f of faces) { // face-out boxes
          const x = f.side * 1.55, y = f.y, z0 = f.z, z1 = z0 + 0.45;
          seg(x, y, z0, x, y + 0.55, z0, f.col, 0.9, FOG); seg(x, y + 0.55, z0, x, y + 0.55, z1, f.col, 0.9, FOG); seg(x, y + 0.55, z1, x, y, z1, f.col, 0.9, FOG); seg(x, y, z1, x, y, z0, f.col, 0.9, FOG);
          text3(f.t.slice(0, 14), x, y + 0.3, z0 + 0.03, f.col, 0.07, 0.9);
        }
        // NEW RELEASES, hanging over the aisle, buzzing
        const buzz = Math.random() < 0.04 ? 0.2 : 1;
        box(0, 2.6, 9, 2.6, 0.45, 0.05, C.hot, 0.7 * buzz, FOG);
        text3('NEW RELEASES', -1.05, 2.72, 8.96, C.hot, 0.2, buzz);
        text3('BE KIND  REWIND', -2.9, 2.5, 5, C.gold, 0.16, 0.8);
        // the window: a wall of sets, stacked 4 x 3
        seg(-5, 0, WIN + 0.5, -5, 3.2, WIN + 0.5, C.ice, 0.4, FOG); seg(5, 0, WIN + 0.5, 5, 3.2, WIN + 0.5, C.ice, 0.4, FOG); seg(-5, 3.2, WIN + 0.5, 5, 3.2, WIN + 0.5, C.ice, 0.4, FOG);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) tv(r * 5 + c, -3.2 + c * 1.6, 0.3 + r * 0.95, 1.4, 0.85);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), R = (str, y, col) => { g.fillStyle = `rgba(${col},0.85)`; g.fillText(str, W - 28 * s - g.measureText(str).width, y); };
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.9)`; g.fillText('STARLIGHT VIDEO', 28 * s, 34 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText('OPEN 10AM - MIDNIGHT  ::  2 NIGHTS $2.99', 28 * s, 54 * s);
      g.font = `bold ${14 * s | 0}px ${MONO}`; R('MEMBER #0042-1337', 34 * s, C.gold);
      g.font = `${12 * s | 0}px ${MONO}`; R(`LATE FEES OWED  $${fee.toFixed(2)}`, 54 * s, C.ice);
      // the rental slip
      const x = 28 * s, y0 = H - 40 * s - Math.max(1, slip.length) * 18 * s;
      g.fillStyle = `rgba(${C.white},0.75)`; g.fillText('-- RENTAL SLIP ----------------------', x, y0 - 6 * s);
      (slip.length ? slip : ['(NOTHING OUT. RENT SOMETHING.)']).forEach((l, i) => { g.fillStyle = `rgba(${C.gold},${0.85 - i * 0.12})`; g.fillText(l, x, y0 + (i + 1) * 18 * s); });
      if (snow > 0) { g.font = `bold ${16 * s | 0}px ${MONO}`; R('TRACKING...', H - 30 * s, C.hot); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
