// MISSION CONTROL: a 1969 control room, seen from the back row. Tiered rows of consoles, each with
// a CRT of traces and numbers, face a wall screen plotting the flight from Earth to the Moon.
// When a build starts (heavy output, light typing) the clock counts down, flight polls the room,
// and at zero it's LIFTOFF: the dot leaves Earth. Otherwise the clock shows mission elapsed time.
// If the build stops before zero, the count holds.
(function (Worlds) {
  Worlds.define('mission', (k) => {
    const { C, env, seg, setCam, lookAt, text3, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 70, COUNT = 15;
    const POLL = ['BOOSTER', 'RETRO', 'FIDO', 'GUIDO', 'SURGEON', 'EECOM', 'GNC', 'TELCOM', 'CONTROL', 'PROCEDURES', 'INCO', 'CAPCOM', 'FLIGHT'];
    const ROWS = [{ z: 0.6, y: 1.0, n: 7 }, { z: 2.4, y: 0.5, n: 8 }, { z: 4.2, y: 0, n: 9 }];
    let mode = 'met', tm = COUNT, met = 0, lift = 0, flight = -1, hold = 0;

    function crt(x, y, z, w, h, seed, a) { // a console screen: a frame, a trace or a column of bars
      const c = C.neon;
      seg(x - w, y, z, x + w, y, z, c, a, FOG); seg(x + w, y, z, x + w, y + h, z, c, a, FOG); seg(x + w, y + h, z, x - w, y + h, z, c, a, FOG); seg(x - w, y + h, z, x - w, y, z, c, a, FOG);
      if (seed % 3 === 0) { let p = null; for (let i = 0; i <= 10; i++) { const q = [x - w * 0.9 + i * w * 0.18, y + h / 2 + Math.sin(env.t * 2 + i * 0.9 + seed) * h * 0.3, z]; if (p) seg(...p, ...q, c, a, FOG); p = q; } }
      else for (let r = 0; r < 4; r++) { const l = (0.3 + 0.6 * Math.abs(Math.sin(seed * 7 + r * 3 + Math.floor(env.t * 2) * 0.7))) * w * 1.7; seg(x - w * 0.85, y + h * (0.2 + r * 0.2), z, x - w * 0.85 + l, y + h * (0.2 + r * 0.2), z, c, a * 0.8, FOG); }
    }

    return {
      label: 'MISSION CONTROL',
      update(dt) {
        const building = (env.build || 0) > 4;
        if (mode === 'met' && building) { mode = 'count'; tm = COUNT; hold = 0; }
        if (mode === 'count') {
          if (!building) { hold += dt; if (hold > 3) mode = 'met'; } // the build stopped: hold, then stand down
          else { hold = 0; tm -= dt; if (tm <= 0) { mode = 'lift'; lift = 0; met = 0; flight = 0; } }
        }
        if (mode === 'lift') { lift += dt; if (lift > 6) mode = 'met'; }
        met += dt;
        if (flight >= 0) flight = Math.min(1, flight + dt / 60);
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: Math.sin(t * 0.05) * 1.5, y: 3.3, z: -2 }, 0, 2.2, 9));
        // the room
        for (let x = -7; x <= 7; x += 1) seg(x, 0, 5, x, 0, 9, C.violet, 0.2, FOG);
        for (const sx of [-7, 7]) { seg(sx, 0, -2, sx, 0, 9, C.violet, 0.5, FOG); seg(sx, 6, -2, sx, 6, 9, C.violet, 0.3, FOG); seg(sx, 0, 9, sx, 6, 9, C.violet, 0.5, FOG); }
        // the tiers and their consoles
        ROWS.forEach((r, ri) => {
          seg(-6.5, r.y, r.z - 0.9, 6.5, r.y, r.z - 0.9, C.violet, 0.4, FOG); seg(-6.5, r.y, r.z + 0.9, 6.5, r.y, r.z + 0.9, C.violet, 0.3, FOG);
          const w = 1.3;
          for (let i = 0; i < r.n; i++) {
            const x = (i - (r.n - 1) / 2) * w, y = r.y + 0.75, z = r.z;
            seg(x - w / 2 + 0.05, y, z - 0.3, x + w / 2 - 0.05, y, z - 0.3, C.ice, 0.6, FOG); // desk edge
            seg(x - w / 2 + 0.05, y + 0.15, z + 0.1, x + w / 2 - 0.05, y + 0.15, z + 0.1, C.ice, 0.5, FOG); // panel top
            seg(x - w / 2 + 0.05, y, z - 0.3, x - w / 2 + 0.05, y + 0.15, z + 0.1, C.ice, 0.5, FOG);
            seg(x - w / 2 + 0.05, r.y, z - 0.3, x - w / 2 + 0.05, y, z - 0.3, C.ice, 0.3, FOG);
            crt(x, y + 0.2, z + 0.15, 0.25, 0.32, ri * 11 + i, 0.75);
            for (let b = 0; b < 6; b++) if (Math.sin(t * 3 + i * 2 + b * 1.3 + ri) > 0.6) seg(x + 0.32 + (b % 3) * 0.06, y + 0.25 + Math.floor(b / 3) * 0.08, z + 0.15, x + 0.35 + (b % 3) * 0.06, y + 0.25 + Math.floor(b / 3) * 0.08, z + 0.15, b % 2 ? C.gold : C.hot, 1, FOG); // status lamps
          }
        });
        // the wall screen: Earth, Moon, the path between and the craft
        const W0 = -5, W1 = 5, Y0 = 1.4, Y1 = 5, Z = 8.95;
        seg(W0, Y0, Z, W1, Y0, Z, C.ice, 0.7, FOG); seg(W1, Y0, Z, W1, Y1, Z, C.ice, 0.7, FOG); seg(W1, Y1, Z, W0, Y1, Z, C.ice, 0.7, FOG); seg(W0, Y1, Z, W0, Y0, Z, C.ice, 0.7, FOG);
        for (let x = W0 + 1; x < W1; x += 1) seg(x, Y0, Z, x, Y1, Z, C.ice, 0.12, FOG);
        for (let y = Y0 + 0.6; y < Y1; y += 0.6) seg(W0, y, Z, W1, y, Z, C.ice, 0.12, FOG);
        const E = [-3.6, 3.0], M = [3.8, 3.4];
        ring(E[0], E[1], Z, 0.5, 20, C.ice, 0.9, FOG, 'xy'); ring(M[0], M[1], Z, 0.22, 14, C.white, 0.9, FOG, 'xy');
        const path = (f) => { // a loop out, round the Moon and back: a skewed figure eight
          const a = f * Math.PI * 2, cx = (E[0] + M[0]) / 2, rx = (M[0] - E[0]) / 2 + 0.25;
          return [cx - Math.cos(a) * rx, E[1] + 0.2 + Math.sin(a) * 0.9 * Math.sin(a / 2 + 0.2)];
        };
        let p = path(0); for (let i = 1; i <= 60; i++) { const q = path(i / 60); seg(p[0], p[1], Z, q[0], q[1], Z, C.gold, 0.35, FOG); p = q; }
        if (flight >= 0) { const d = path(flight); ring(d[0], d[1], Z - 0.02, 0.08 + env.pulse * 0.04, 8, C.hot, 1, FOG, 'xy'); let q = path(0); for (let i = 1; i <= flight * 60; i++) { const r2 = path(i / 60); seg(q[0], q[1], Z - 0.01, r2[0], r2[1], Z - 0.01, C.hot, 0.9, FOG); q = r2; } }
        // side screens: ground tracks
        for (const sx of [-6.3, 6.3]) {
          seg(sx - 0.9, 2, Z, sx + 0.9, 2, Z, C.ice, 0.5, FOG); seg(sx - 0.9, 3.4, Z, sx + 0.9, 3.4, Z, C.ice, 0.5, FOG);
          let q = null; for (let i = 0; i <= 20; i++) { const r2 = [sx - 0.85 + i * 0.085, 2.7 + Math.sin(i * 0.5 + t * 0.4 + sx) * 0.45, Z]; if (q) seg(...q, ...r2, C.neon, 0.6, FOG); q = r2; }
        }
        // the clock over the screen
        text3(clock(), -1.9, 5.3, Z, mode === 'lift' ? C.hot : mode === 'count' ? C.gold : C.neon, 0.42, 1);
        hud();
      },
    };

    function clock() {
      if (mode === 'lift') return 'LIFTOFF';
      const sec = mode === 'count' ? Math.ceil(tm) : Math.floor(met), h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = sec % 60;
      return `${mode === 'count' ? (hold > 0 ? 'HOLD ' : 'T-') : 'MET '}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;
    }
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('MISSION OPERATIONS CONTROL ROOM', 28 * s, 34 * s);
      g.font = `bold ${30 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${mode === 'lift' ? C.hot : C.white},0.95)`; g.fillText(clock(), 28 * s, 74 * s);
      // the poll: in a count each station goes GO in turn; FLIGHT last
      const polled = mode === 'count' ? Math.floor((COUNT - tm) / ((COUNT - 2) / POLL.length)) : POLL.length;
      g.font = `${13 * s | 0}px ${MONO}`;
      POLL.forEach((name, i) => {
        const go = i < polled, y = H - (30 + (POLL.length - 1 - i) * 19) * s, st = mode === 'count' && !go ? (i === polled ? 'STANDBY' : '') : 'GO';
        g.fillStyle = `rgba(${C.white},${mode === 'count' ? 0.8 : 0.45})`; g.fillText(name.padEnd(11), 28 * s, y);
        g.fillStyle = `rgba(${go ? C.neon : C.gold},${mode === 'count' ? 1 : 0.5})`; g.fillText(st, 28 * s + g.measureText('X'.repeat(12)).width, y);
      });
      const r = mode === 'count' ? (hold > 0 ? 'HOLDING' : 'COUNTDOWN IN PROGRESS') : mode === 'lift' ? 'WE HAVE LIFTOFF' : flight >= 0 ? `TRANSLUNAR  ${Math.round(flight * 100)}%` : 'AWAITING BUILD';
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${mode === 'lift' ? C.hot : C.ice},0.9)`; g.fillText(r, W - 28 * s - g.measureText(r).width, 34 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
