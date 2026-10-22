// BLIPVERT: a TV host that lives inside the set. A wireframe room of coloured line grids turns and
// slides around the camera, and a low-poly host's head off to the right of the glass talks to
// the beat, stuttering: snapping back to where it was a moment ago, doubled in a ghost copy. The
// caption in the corner stutters with it. A failed command is a bad signal.
(function (Worlds) {
  Worlds.define('headroom', (k) => {
    const { C, rand, pick, env, seg, setCam } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 200, R = 30;
    const LINES = ['NETWORK 23', 'TWENTY MINUTES INTO THE FUTURE', 'DON\'T TOUCH THAT DIAL', 'WE INTERRUPT THIS TERMINAL', 'CATCH THE WAVE', 'COMING UP AFTER THE BREAK', 'RATINGS ARE EVERYTHING', 'YOU ARE WATCHING THE WATCHER'];
    const WALLS = [C.hot, C.ice, C.gold, C.neon, C.violet, C.hot];
    let yaw = 0, slide = 0, glitch = 0, held = null, line = pick(LINES), typed = 0, lineT = 0, stutAt = -1, snow = 0;
    const head = { yaw: 0, pitch: 0, x: 0 };

    // the room: six walls, each a set of parallel lines sliding along it
    function room() {
      const faces = [ // centre axis, u axis (lines run along u), v axis (lines spaced along v)
        [[0, 0, R], [1, 0, 0], [0, 1, 0]], [[0, 0, -R], [0, 1, 0], [1, 0, 0]], [[R, 0, 0], [0, 0, 1], [0, 1, 0]],
        [[-R, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, R, 0], [1, 0, 0], [0, 0, 1]], [[0, -R, 0], [0, 0, 1], [1, 0, 0]],
      ];
      faces.forEach(([c, u, v], f) => {
        const off = ((slide * (f % 2 ? 1 : -1) * (1 + f * 0.3)) % 6 + 6) % 6;
        for (let d = -R + off; d < R; d += 6) {
          const a = [c[0] + v[0] * d - u[0] * R, c[1] + v[1] * d - u[1] * R, c[2] + v[2] * d - u[2] * R];
          const b = [c[0] + v[0] * d + u[0] * R, c[1] + v[1] * d + u[1] * R, c[2] + v[2] * d + u[2] * R];
          seg(...a, ...b, WALLS[f], 0.55, FOG);
        }
      });
    }
    // the host: stacked loops for a head, meridians, shades, a mouth that opens on the beat
    const LOOPS = [[-1.9, 0.9], [-1.5, 1.6], [-0.9, 2.0], [-0.2, 2.15], [0.6, 2.2], [1.4, 2.05], [2.1, 1.7], [2.6, 1.05], [2.85, 0.3]];
    function host(hx, hy, hz, hy2, hp, col, al) {
      const cy = Math.cos(hy2), sy = Math.sin(hy2), cp = Math.cos(hp), sp = Math.sin(hp);
      const T = (x, y, z) => { const y1 = y * cp - z * sp, z1 = y * sp + z * cp; return [hx + x * cy + z1 * sy, hy + y1, hz - x * sy + z1 * cy]; };
      const L = (a, b, c2, a2) => seg(...a, ...b, c2 || col, (a2 || 1) * al, FOG);
      const pt = (y, r, ang) => T(Math.sin(ang) * r, y, -Math.cos(ang) * r * 1.1); // -z faces the camera
      for (const [y, r] of LOOPS) { let p = pt(y, r, 0); for (let a = 1; a <= 16; a++) { const q = pt(y, r, a / 16 * Math.PI * 2); L(p, q, null, 0.6); p = q; } }
      for (let m = 0; m < 8; m++) { const ang = m / 8 * Math.PI * 2; for (let i = 1; i < LOOPS.length; i++) L(pt(LOOPS[i - 1][0], LOOPS[i - 1][1], ang), pt(LOOPS[i][0], LOOPS[i][1], ang), null, 0.45); }
      // shades: two lenses and a bridge
      for (const sx of [-1, 1]) {
        const a = T(sx * 0.2, 0.75, -2.35), b = T(sx * 1.6, 0.75, -2.0), c = T(sx * 1.5, 0.15, -2.05), d = T(sx * 0.3, 0.2, -2.35);
        L(a, b, C.white); L(b, c, C.white); L(c, d, C.white); L(d, a, C.white);
      }
      // the grin, opening with the kick
      const open = 0.1 + env.pulse * 0.45;
      L(T(-0.9, -0.9, -2.15), T(0.9, -0.9, -2.15), C.white); L(T(-0.9, -0.9, -2.15), T(0, -0.9 - open, -2.2), C.white); L(T(0, -0.9 - open, -2.2), T(0.9, -0.9, -2.15), C.white);
      L(T(-2.2, -2.2, 0), T(-4, -3.6, 0)); L(T(2.2, -2.2, 0), T(4, -3.6, 0)); // shoulders
      L(T(-1.2, -2.6, -1), T(0, -3.4, -1.3)); L(T(1.2, -2.6, -1), T(0, -3.4, -1.3)); // the collar
    }
    // "network" → "N-N-N-NETWORK"
    function stutter(s) {
      if (stutAt < 0) return s;
      const words = s.split(' '), w = stutAt % words.length;
      words[w] = (words[w][0] + '-').repeat(2 + stutAt % 3) + words[w];
      return words.join(' ');
    }

    return {
      label: 'BLIPVERT',
      signal(kind) { if (kind === 'error') snow = 1.2; },
      update(dt) {
        yaw += dt * (0.12 + env.level * 0.35); slide += dt * (3 + env.level * 10);
        snow = Math.max(0, snow - dt);
        // stutters: on a strong beat, sometimes; more when you're busy
        glitch -= dt;
        if (glitch <= 0 && env.pulse > 0.85 && Math.random() < 0.08 + env.level * 0.25) { glitch = rand(0.25, 0.6); held = { ...head }; stutAt = Math.floor(rand(0, 20)); }
        if (glitch <= 0) { held = null; stutAt = -1; }
        head.yaw = Math.sin(env.t * 0.7) * 0.45; head.pitch = Math.sin(env.t * 1.1) * 0.12 - 0.05; head.x = Math.sin(env.t * 0.3) * 0.6;
        lineT += dt; typed += dt * 22;
        if (lineT > 5) { lineT = 0; typed = 0; line = pick(LINES.filter((l) => l !== line)); }
      },
      draw() {
        const t = env.t;
        setCam({ x: 0, y: 0, z: 0, yaw, pitch: Math.sin(t * 0.17) * 0.25, roll: Math.sin(t * 0.11) * 0.15 });
        room();
        // the host sits still in front of the glass, off to the right of the terminal
        setCam({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
        const flick = held && Math.floor(t * 18) % 2 === 0, h = flick ? held : head;
        host(13 + h.x, -1, 19, h.yaw, h.pitch, C.white, 0.9);
        if (held) host(13.6 + head.x, -1.2, 19, head.yaw + 0.25, head.pitch, C.hot, 0.45); // the ghost of a frame ago
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 28 * s;
      if (snow > 0) for (let i = 0; i < 400 * snow; i++) { g.fillStyle = `rgba(${C.white},${rand(0.1, 0.6)})`; g.fillRect(rand(0, W), rand(0, H), 2, 2); }
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText('CH 23  ::  LIVE', x0, 40 * s);
      if (Math.sin(env.t * 4) > 0) { g.fillStyle = `rgba(255,40,40,0.9)`; g.beginPath(); g.arc(x0 + 180 * s, 34 * s, 6 * s, 0, Math.PI * 2); g.fill(); }
      const r = `RATING ${(40 + env.level * 59).toFixed(1)}`; g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText(r, W - x0 - g.measureText(r).width, 40 * s);
      // the caption, typed out, stuttering when the host does
      const cap = stutter(line).slice(0, Math.floor(typed));
      g.font = `bold ${24 * s | 0}px ${MONO}`;
      const jx = stutAt >= 0 ? rand(-4, 4) * s : 0;
      g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(cap, x0 + jx, H - 44 * s);
      if (stutAt >= 0) { g.fillStyle = `rgba(${C.ice},0.5)`; g.fillText(cap, x0 + jx + 3 * s, H - 42 * s); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
