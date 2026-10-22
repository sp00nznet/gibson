// WOPR: the war room's big board. A wireframe world map seen at an angle, missile arcs between
// the continents as the simulation runs (more with activity), DEFCON counting down, a scenario
// list scrolling in a corner and a launch code cracked one digit at a time. Each cycle runs
// faster and faster until it stops dead: the machine has learned something. Then chess, then
// it starts again. A failed command drops DEFCON.
(function (Worlds) {
  Worlds.define('wopr', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 400, SIM = 45, HOLD = 12, RED = '255,70,60';
    // continents, very low-poly, [lon, lat]
    const LAND = [
      [[-165, 65], [-140, 70], [-95, 72], [-80, 63], [-60, 55], [-65, 45], [-80, 32], [-81, 25], [-97, 26], [-105, 20], [-90, 15], [-83, 9], [-100, 17], [-110, 23], [-117, 32], [-124, 40], [-125, 48], [-135, 58], [-150, 60], [-165, 65]],
      [[-50, 60], [-20, 70], [-20, 80], [-60, 82], [-70, 76], [-50, 60]],
      [[-80, 10], [-60, 10], [-35, -6], [-40, -22], [-58, -38], [-68, -55], [-75, -45], [-71, -18], [-81, -5], [-80, 10]],
      [[-10, 36], [-9, 43], [0, 49], [-5, 58], [10, 63], [25, 71], [60, 70], [100, 77], [140, 72], [170, 68], [180, 65], [160, 60], [142, 52], [135, 43], [122, 40], [121, 30], [110, 20], [105, 10], [100, 13], [95, 17], [90, 22], [80, 15], [77, 8], [72, 20], [60, 25], [50, 30], [57, 22], [45, 13], [35, 30], [28, 37], [20, 40], [15, 38], [10, 44], [3, 43], [-10, 36]],
      [[-17, 15], [-10, 30], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [35, -25], [20, -35], [12, -17], [9, 4], [-8, 5], [-17, 15]],
      [[113, -22], [130, -12], [142, -11], [153, -27], [146, -39], [135, -35], [115, -35], [113, -22]],
      [[-6, 50], [2, 51], [-3, 58], [-6, 50]], [[130, 31], [141, 36], [141, 43], [135, 35], [130, 31]],
    ];
    const WEST = [[-74, 41], [-87, 42], [-118, 34], [-122, 38], [-77, 39], [-104, 40], [-97, 33], [-71, 42], [0, 51], [2, 49]];
    const EAST = [[37, 56], [30, 60], [44, 48], [82, 55], [60, 57], [131, 43], [104, 52], [69, 41], [36, 50], [74, 43]];
    const SCEN = ['FALKEN\'S MAZE', 'BLACK JACK', 'GIN RUMMY', 'HEARTS', 'BRIDGE', 'CHECKERS', 'CHESS', 'POKER', 'FIGHTER COMBAT', 'GUERRILLA ENGAGEMENT', 'DESERT WARFARE', 'AIR-TO-GROUND ACTIONS', 'THEATERWIDE TACTICAL WARFARE', 'THEATERWIDE BIOTOXIC WARFARE', 'GLOBAL THERMONUCLEAR WAR'];
    const P = (lon, lat) => [lon * 0.45, 0, lat * 0.45 - 6];
    let phase = 'sim', pt = 0, defcon = 5, hits = 0, missiles = [], blasts = [], code = '', locked = 0, scen = 0, scenT = 0, sims = 0;
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    function reset() { phase = 'sim'; pt = 0; defcon = 5; missiles = []; blasts = []; locked = 0; sims++; code = Array.from({ length: 10 }, () => pick(CHARS)).join(''); }
    reset();
    function launch() {
      const west = Math.random() < 0.5, a = pick(west ? WEST : EAST), b = pick(west ? EAST : WEST);
      const A = P(...a), B = P(...b), d = Math.hypot(B[0] - A[0], B[2] - A[2]);
      missiles.push({ A, B, h: d * 0.35, t: 0, v: rand(0.12, 0.2), col: west ? C.ice : C.hot });
    }
    const at = (m, t) => [m.A[0] + (m.B[0] - m.A[0]) * t, m.h * 4 * t * (1 - t), m.A[2] + (m.B[2] - m.A[2]) * t];
    return {
      label: 'WOPR',
      signal(kind) { if (kind === 'error' && phase === 'sim') defcon = Math.max(1, defcon - 1); },
      update(dt) {
        pt += dt;
        if (phase === 'sim') {
          const fast = 1 + (pt / SIM) ** 2 * 8; // it learns faster and faster
          if (Math.random() < dt * (0.6 + env.level * 3) * fast) launch();
          for (const m of missiles) { m.t += m.v * dt * fast; if (m.t >= 1) { blasts.push({ p: m.B, t: 0, col: m.col }); hits++; } }
          missiles = missiles.filter((m) => m.t < 1);
          if (pt > SIM * (5 - defcon + 1) / 5 && defcon > 1) defcon--;
          locked = Math.min(10, Math.floor(pt / SIM * 11));
          scenT += dt * fast; if (scenT > 0.6) { scenT = 0; scen = (scen + 1) % SCEN.length; }
          if (pt > SIM) { phase = 'stop'; pt = 0; missiles = []; }
        } else if (pt > HOLD) reset();
        for (const b of blasts) b.t += dt;
        blasts = blasts.filter((b) => b.t < 2.5);
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: Math.sin(t * 0.04) * 10, y: 78, z: -112 }, 0, 4, 4));
        // the lat/long grid, then the coastlines
        for (let lon = -180; lon <= 180; lon += 30) seg(...P(lon, -60), ...P(lon, 85), C.ice, 0.15, FOG);
        for (let lat = -60; lat <= 85; lat += 15) seg(...P(-180, lat), ...P(180, lat), C.ice, 0.15, FOG);
        const glow = phase === 'stop' ? 0.5 : 0.8 + env.pulse * 0.2;
        for (const poly of LAND) for (let i = 1; i < poly.length; i++) seg(...P(...poly[i - 1]), ...P(...poly[i]), C.ice, glow, FOG);
        for (const c of [...WEST, ...EAST]) ring(...P(...c), 0.5, 6, C.white, 0.6, FOG);
        for (const m of missiles) {
          let p = at(m, 0);
          for (let j = 1; j <= 20; j++) { const f = (j / 20) * m.t, q = at(m, f); seg(...p, ...q, m.col, 0.35 + 0.6 * (j / 20), FOG); p = q; }
          ring(...p, 0.6, 6, C.white, 1, FOG, 'xy');
        }
        for (const b of blasts) for (let r = 1; r <= 3; r++) ring(b.p[0], 0.05, b.p[2], r * b.t * 1.6, 20, b.col, Math.max(0, 1 - b.t / 2.5), FOG);
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 28 * s;
      // launch code, cracked from the left one character at a time
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.75)`; g.fillText('LAUNCH CODE', x0, 34 * s);
      g.font = `bold ${26 * s | 0}px ${MONO}`;
      const shown = phase === 'stop' ? code : code.slice(0, locked) + Array.from({ length: 10 - locked }, () => pick(CHARS)).join('');
      for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(${i < locked || phase === 'stop' ? C.white : C.ice},${i < locked || phase === 'stop' ? 1 : 0.45})`; g.fillText(shown[i], x0 + i * 20 * s, 66 * s); }
      // DEFCON, five boxes, top right
      g.font = `bold ${20 * s | 0}px ${MONO}`; const lab = `DEFCON ${defcon}`;
      g.fillStyle = `rgba(${defcon <= 2 ? RED : C.white},0.95)`; g.fillText(lab, W - x0 - g.measureText(lab).width, 34 * s);
      for (let i = 0; i < 5; i++) {
        const n = 5 - i, bx = W - x0 - (5 - i) * 34 * s, lit = n === defcon;
        g.strokeStyle = `rgba(${C.ice},0.6)`; g.lineWidth = 1.5; g.strokeRect(bx, 46 * s, 30 * s, 22 * s);
        if (lit) { g.fillStyle = `rgba(${n <= 2 ? RED : C.ice},${0.5 + env.pulse * 0.4})`; g.fillRect(bx + 2, 46 * s + 2, 30 * s - 4, 22 * s - 4); }
        g.fillStyle = `rgba(${C.white},0.9)`; g.font = `${12 * s | 0}px ${MONO}`; g.fillText(String(n), bx + 11 * s, 62 * s);
      }
      // scenarios, bottom left, the current one lit
      g.font = `${12 * s | 0}px ${MONO}`;
      for (let i = -4; i <= 4; i++) {
        const j = (scen + i + SCEN.length) % SCEN.length, y = H - (150 - (i + 4) * 15) * s;
        g.fillStyle = `rgba(${i === 0 ? C.white : C.ice},${i === 0 ? 1 : 0.5 - Math.abs(i) * 0.08})`; g.fillText((i === 0 ? '> ' : '  ') + SCEN[j], x0, y);
      }
      g.fillStyle = `rgba(${C.ice},0.7)`; const st = `SIMULATION ${String(sims).padStart(4, '0')}   STRIKES ${String(hits).padStart(5, '0')}`;
      g.fillText(st, W - x0 - g.measureText(st).width, H - 30 * s);
      if (phase === 'stop') {
        g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.95)`;
        const l1 = 'A STRANGE GAME. THE ONLY WINNING MOVE IS NOT TO PLAY.', l2 = 'HOW ABOUT A NICE GAME OF CHESS?';
        const n1 = Math.min(l1.length, Math.floor(pt * 18)), n2 = Math.max(0, Math.min(l2.length, Math.floor((pt - 5) * 18)));
        g.fillText(l1.slice(0, n1), (W - g.measureText(l1).width) / 2, H - 40 * s);
        g.fillText(l2.slice(0, n2), (W - g.measureText(l2).width) / 2, H - 14 * s);
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
