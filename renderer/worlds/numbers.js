// NUMBERS STATION: a shortwave set on a table in a dark room, a desk lamp, and through the window a
// field with a great curtain of antennas, their lights blinking. The dial hunts across the bands,
// settles on 6.840, a chime plays, and a voice reads out five-figure groups, one digit at a time,
// in the top corner; the waterfall at the bottom shows the carrier come and go. The groups are
// seeded from the last command you typed. A failed command is a burst of static.
(function (Worlds) {
  Worlds.define('numbers', (k) => {
    const { C, rand, env, seg, setCam, lookAt, text3, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 120, FREQ = 6.84, ROWS = 26, BINS = 48;
    const PH = [['hunt', 4], ['chime', 3], ['call', 3], ['groups', 0], ['end', 3]], DIG = 0.6, GP = 1.2;
    let ph = 0, pt = 0, groups = [], seed = 1, freq = 9, noise = 0, rowT = 0, msg = 0;
    const fall = Array.from({ length: ROWS }, () => new Float32Array(BINS));
    const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
    function newMessage() {
      seed = env.cmd ? hashStr(env.cmd.text + msg) : (Math.random() * 1e9) | 0; msg++;
      let x = seed || 1; const r = () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) % 10;
      groups = Array.from({ length: 6 }, () => Array.from({ length: 5 }, r).join(''));
      PH[3][1] = groups.length * (5 * DIG + GP);
    }
    newMessage();
    const at = () => PH[ph][0];

    return {
      label: 'NUMBERS STATION',
      signal(kind) { if (kind === 'error') noise = 1.5; },
      update(dt) {
        pt += dt; noise = Math.max(0, noise - dt);
        if (pt > PH[ph][1]) { pt = 0; ph = (ph + 1) % PH.length; if (ph === 0) newMessage(); }
        const t = env.t;
        if (at() === 'hunt') freq = 9 + Math.sin(t * 0.9) * 6 + Math.sin(t * 2.3) * 1.5; // sweeping the bands
        else freq += (FREQ - freq) * Math.min(1, dt * 4);
        rowT -= dt;
        if (rowT < 0) {
          rowT = 0.08;
          const row = fall.pop(), on = at() !== 'hunt', cb = Math.round((freq - 2) / 16 * (BINS - 1));
          for (let i = 0; i < BINS; i++) row[i] = Math.random() * (0.45 + noise * 0.5);
          if (on && cb >= 0 && cb < BINS) { row[cb] = 1; if (cb > 0) row[cb - 1] = 0.6; if (cb < BINS - 1) row[cb + 1] = 0.6; }
          fall.unshift(row);
        }
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: Math.sin(t * 0.06) * 0.25, y: 1.55, z: -1.1 }, Math.sin(t * 0.05) * 0.2, 1.2, 4));
        // the room: floor, back wall with the window
        for (let x = -3; x <= 3; x += 0.5) seg(x, 0, -1, x, 0, 4, C.violet, 0.18, FOG);
        seg(-3, 0, 4, 3, 0, 4, C.violet, 0.4, FOG); seg(-3, 3, 4, 3, 3, 4, C.violet, 0.3, FOG);
        for (const [a, b] of [[[-1.5, 1.2], [1.5, 1.2]], [[1.5, 1.2], [1.5, 2.6]], [[1.5, 2.6], [-1.5, 2.6]], [[-1.5, 2.6], [-1.5, 1.2]], [[0, 1.2], [0, 2.6]], [[-1.5, 1.9], [1.5, 1.9]]]) seg(a[0], a[1], 4, b[0], b[1], 4, C.ice, 0.6, FOG);
        // outside: the field and the antenna curtain, lights blinking in turn
        seg(-200, 0, 150, 200, 0, 150, C.violet, 0.4, 400);
        const az = 70;
        for (let x = -40; x <= 40; x += 10) {
          seg(x, -6, az, x, 26, az, C.white, 0.45, 300);
          if (Math.sin(t * 2 + x * 0.3) > 0.3) ring(x, 26.5, az, 0.4, 6, C.hot, 1, 300, 'xy');
          if (x < 40) for (const y of [8, 15, 22]) {
            seg(x, y, az, x + 10, y, az, C.white, 0.25, 300);
            for (let d = 1; d < 5; d++) seg(x + d * 2, y - 1.2, az, x + d * 2, y + 1.2, az, C.ice, 0.35, 300); // the dipoles
          }
        }
        // the table
        const ty = 0.8;
        seg(-1.8, ty, 0.6, 1.8, ty, 0.6, C.gold, 0.6, FOG); seg(-1.8, ty, 2.2, 1.8, ty, 2.2, C.gold, 0.5, FOG);
        seg(-1.8, ty, 0.6, -1.8, ty, 2.2, C.gold, 0.5, FOG); seg(1.8, ty, 0.6, 1.8, ty, 2.2, C.gold, 0.5, FOG);
        for (const x of [-1.7, 1.7]) seg(x, 0, 0.7, x, ty, 0.7, C.gold, 0.4, FOG);
        // the receiver: a box, the big dial, the signal meter, the speaker grille, knobs
        k.box(0, ty, 1.6, 1.6, 0.6, 0.6, C.ice, 0.6, FOG);
        const fz = 1.29, dx = -0.3, dy = ty + 0.28, dr = 0.2;
        for (let i = 0; i <= 16; i++) { const a = Math.PI * (0.9 - i * 0.05), r1 = i % 4 ? dr * 0.92 : dr * 0.84; seg(dx + Math.cos(a) * dr, dy + Math.sin(a) * dr, fz, dx + Math.cos(a) * r1, dy + Math.sin(a) * r1, fz, C.gold, 0.8, FOG); }
        const na = Math.PI * (0.9 - (freq - 2) / 16 * 0.8);
        seg(dx, dy - 0.02, fz, dx + Math.cos(na) * dr * 1.05, dy + Math.sin(na) * dr * 1.05, fz, C.hot, 1, FOG);
        const sig = at() === 'hunt' ? 0.2 + Math.random() * 0.2 : 0.75 + Math.random() * 0.1 - noise * 0.3, mx = 0.3, my = ty + 0.38, ma = Math.PI * (0.8 - sig * 0.6);
        for (let i = 0; i <= 6; i++) { const a = Math.PI * (0.8 - i * 0.1); seg(mx + Math.cos(a) * 0.1, my + Math.sin(a) * 0.1, fz, mx + Math.cos(a) * 0.12, my + Math.sin(a) * 0.12, fz, C.neon, 0.7, FOG); }
        seg(mx, my, fz, mx + Math.cos(ma) * 0.11, my + Math.sin(ma) * 0.11, fz, C.white, 1, FOG);
        for (let y = ty + 0.08; y < ty + 0.22; y += 0.03) seg(0.15, y, fz, 0.7, y, fz, C.ice, 0.35, FOG);
        for (const x of [-0.55, -0.3, -0.05]) ring(x, ty + 0.08, fz - 0.01, 0.035, 8, C.white, 0.7, FOG, 'xy');
        seg(0.5, ty + 0.6, 1.8, 0.9, ty + 1.6, 2.0, C.white, 0.5, FOG); // the whip antenna
        // the desk lamp, and its pool of light
        const lb = [-1.3, ty, 1.5], le = [-1.15, ty + 0.75, 1.25], ls = [-0.85, ty + 0.62, 1.2];
        ring(lb[0], lb[1] + 0.01, lb[2], 0.14, 10, C.gold, 0.7, FOG); seg(...lb, ...le, C.gold, 0.7, FOG); seg(...le, ...ls, C.gold, 0.7, FOG);
        ring(ls[0], ls[1] - 0.12, ls[2], 0.15, 12, C.gold, 0.8, FOG);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, ex = ls[0] + Math.cos(a) * 0.15, ez = ls[2] + Math.sin(a) * 0.15; seg(ls[0], ls[1], ls[2], ex, ls[1] - 0.12, ez, C.gold, 0.6, FOG); seg(ex, ls[1] - 0.12, ez, ls[0] + Math.cos(a) * 0.5, ty + 0.01, ls[2] + Math.sin(a) * 0.5, C.gold, 0.12, FOG); }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), R = (str, y, col, a) => { g.fillStyle = `rgba(${col},${a || 0.85})`; g.fillText(str, W - 28 * s - g.measureText(str).width, y); };
      const locked = at() !== 'hunt';
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(`FREQ ${freq.toFixed(3)} MHz  ${locked ? 'USB' : '...'}`, 28 * s, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`;
      const d = new Date(); g.fillText(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC  ::  SIGNAL S${locked ? 7 : 2}  ::  MESSAGE ${String(msg).padStart(3, '0')}`, 28 * s, 54 * s);
      // the voice, top right
      const p = at();
      g.font = `bold ${40 * s | 0}px ${MONO}`;
      if (p === 'chime') R('♪ ♫ ♪ ♫ ♪'.slice(0, 1 + Math.floor(pt / 3 * 9)), 70 * s, C.gold);
      else if (p === 'call') R(Math.sin(pt * 4) > -0.5 ? 'READY. READY.' : '', 70 * s, C.ice);
      else if (p === 'end') R('END. END.', 70 * s, C.hot);
      else if (p === 'groups') {
        const per = 5 * DIG + GP, gi = Math.min(groups.length - 1, Math.floor(pt / per)), n = Math.min(5, Math.floor((pt - gi * per) / DIG) + 1);
        R(groups[gi].slice(0, n).split('').join(' ').padEnd(9, ' '), 70 * s, C.white, 0.95);
        g.font = `${15 * s | 0}px ${MONO}`;
        const done = groups.slice(0, gi);
        for (let r = 0; r * 3 < done.length; r++) R(done.slice(r * 3, r * 3 + 3).join('   '), (100 + r * 22) * s, C.ice, 0.75);
      }
      // the waterfall
      const cw = 5.5 * s, ch = 4 * s, x0 = 28 * s, y0 = H - 36 * s - ROWS * ch;
      g.strokeStyle = `rgba(${C.ice},0.4)`; g.lineWidth = 1; g.strokeRect(x0 - 2, y0 - 2, BINS * cw + 4, ROWS * ch + 4);
      for (let r = 0; r < ROWS; r++) for (let i = 0; i < BINS; i++) {
        const v = fall[r][i]; if (v < 0.35) continue;
        g.fillStyle = `rgba(${v > 0.9 ? C.gold : C.neon},${v * (1 - r / ROWS)})`; g.fillRect(x0 + i * cw, y0 + r * ch, cw - 1, ch - 1);
      }
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; g.fillText('2 MHz', x0, H - 20 * s); g.fillText('18 MHz', x0 + BINS * cw - 40 * s, H - 20 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
