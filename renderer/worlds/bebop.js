// BEBOP: a little red one-seat fighter racing through an asteroid field and down a chain of
// hyperspace gates, the gate lights flashing on the beat. A big boxy trawler of a mothership
// hangs off in the distance. A walking bass line strolls along a staff in the corner, the bounty
// board ticks over top right, and every sixth gate the run ends with a line and a fade.
(function (Worlds) {
  Worlds.define('bebop', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 260, RED = '255,60,50', GAP = 140;
    const path = (z) => [Math.sin(z * 0.006) * 18 + Math.sin(z * 0.017) * 6, Math.sin(z * 0.009) * 8];
    const ship = { z: 0, v: 40 };
    const rocks = Array.from({ length: 60 }, () => newRock(rand(20, FOG)));
    let gates = 0, cycle = 0, endT = 0, beat = 0, lastPulse = 0, note = 0, sinceBeat = 0;
    const NAMES = ['VINCENT VOLAJU', 'ASIMOV SOLENSAN', 'MAD PIERROT', 'TWINKLE MURDOCK', 'ROCCO BONNARO', 'DOCTOR LONDES', 'TEDDY BOMBER', 'GEREN WRIGHT'];
    let board = Array.from({ length: 4 }, () => [pick(NAMES), (rand(2, 90) | 0) * 100000]);
    function newRock(dz) {
      const z = ship.z + dz, [px, py] = path(z), side = Math.random() < 0.5 ? -1 : 1;
      return { x: px + side * rand(8, 50), y: py + rand(-25, 25), z, r: rand(0.8, 4), ph: rand(0, 6), spin: rand(-1, 1) };
    }
    function rock(o) { // a lumpy low-poly boulder: three tumbling loops
      for (let p = 0; p < 3; p++) {
        let prev = null;
        for (let i = 0; i <= 7; i++) {
          const a = i / 7 * Math.PI * 2, r = o.r * (0.75 + 0.25 * Math.sin(a * 3 + o.ph + p)), c = Math.cos(a) * r, s = Math.sin(a) * r, t = env.t * o.spin + p * 1.05;
          const q = p === 0 ? [c * Math.cos(t), s, c * Math.sin(t)] : p === 1 ? [c, s * Math.cos(t), s * Math.sin(t)] : [c * Math.cos(t) - s * Math.sin(t), c * Math.sin(t) + s * Math.cos(t), 0];
          const w = [o.x + q[0], o.y + q[1], o.z + q[2]];
          if (prev) seg(...prev, ...w, C.violet, 0.7, FOG); prev = w;
        }
      }
    }
    // the fighter: long nose +z, swept wings, a tail fin, nose drawn ahead of the canopy
    const V = [[0, 0, 3.2], [-0.35, 0, 0.6], [0.35, 0, 0.6], [0, 0.45, 0.2], [-2.4, -0.1, -1.4], [2.4, -0.1, -1.4], [-0.4, 0, -1.6], [0.4, 0, -1.6], [0, 1.1, -1.5]];
    const E = [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 5], [4, 6], [5, 7], [6, 7], [3, 8], [8, 6], [8, 7], [1, 6], [2, 7]];
    function fighter(x, y, z, roll) {
      const cr = Math.cos(roll), sr = Math.sin(roll), P = V.map(([a, b, c]) => [x + a * cr - b * sr, y + a * sr + b * cr, z + c]);
      for (const [i, j] of E) seg(...P[i], ...P[j], RED, 1, FOG);
      seg(...P[6], P[6][0], P[6][1], P[6][2] - 1.5 - env.level * 2, C.gold, 0.8, FOG); seg(...P[7], P[7][0], P[7][1], P[7][2] - 1.5 - env.level * 2, C.gold, 0.8, FOG);
    }

    return {
      label: 'BEBOP',
      signal(kind) { if (kind === 'ok') board.unshift([pick(NAMES), (rand(2, 90) | 0) * 100000]), board.length = 4; },
      update(dt) {
        ship.v = 38 + env.level * 50;
        const z0 = ship.z; ship.z += ship.v * dt;
        if (Math.floor(ship.z / GAP) > Math.floor(z0 / GAP)) { gates++; if (gates % 6 === 0) { cycle++; endT = 3.5; } }
        endT = Math.max(0, endT - dt);
        for (let i = 0; i < rocks.length; i++) if (rocks[i].z < ship.z - 10) rocks[i] = newRock(FOG + rand(0, 40));
        sinceBeat += dt;
        if ((env.pulse > 0.9 && lastPulse <= 0.9) || sinceBeat > 0.6) { beat++; sinceBeat = 0; // no music: walk anyway
          note = [0, 2, 4, 5, 7, 5, 4, 2][beat % 8]; }
        lastPulse = env.pulse;
      },
      draw() {
        const z = ship.z, [px, py] = path(z), [nx, ny] = path(z + 4), roll = -(nx - px) * 0.25 + Math.sin(env.t * 2) * 0.08;
        setCam(lookAt({ x: px - (nx - px) * 2, y: py + 3.6, z: z - 15 }, nx, ny + 1.5, z + 20));
        // the mothership: a long boxy hull with a ring arm, far off to one side
        const mx = px - 120, my = py + 30, mz = z + 330;
        for (const [a, b] of [[[-30, 0, -10], [30, 0, -10]], [[30, 0, -10], [30, 8, -6]], [[30, 8, -6], [-30, 8, -6]], [[-30, 8, -6], [-30, 0, -10]], [[-30, 0, -10], [-38, 3, 0]], [[-30, 8, -6], [-38, 3, 0]], [[0, 8, -6], [0, 18, -6]], [[-6, 18, -6], [6, 18, -6]]])
          seg(mx + a[0], my + a[1], mz + a[2], mx + b[0], my + b[1], mz + b[2], C.gold, 0.7, 600);
        ring(mx + 10, my + 4, mz, 9, 20, C.gold, 0.6, 600, 'xy');
        // the gate chain
        for (let g = Math.ceil(z / GAP) * GAP; g < z + FOG; g += GAP) {
          const [gx, gy] = path(g), lit = 0.4 + env.pulse * 0.6;
          ring(gx, gy, g, 18, 28, C.ice, 1, FOG, 'xy'); ring(gx, gy, g, 19.5, 28, C.ice, 0.5, FOG, 'xy');
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + env.t * 0.5; seg(gx + Math.cos(a) * 18, gy + Math.sin(a) * 18, g, gx + Math.cos(a) * 21, gy + Math.sin(a) * 21, g, (i + Math.floor(env.t * 4)) % 2 ? C.hot : C.gold, lit, FOG); }
        }
        for (const o of rocks) rock(o);
        fighter(px, py, z, roll);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), R = (str, y, col, a) => { g.fillStyle = `rgba(${col},${a || 0.9})`; g.fillText(str, W - 28 * s - g.measureText(str).width, y); };
      g.font = `bold ${16 * s | 0}px ${MONO}`; R('BOUNTY BOARD', 34 * s, C.gold);
      g.font = `${13 * s | 0}px ${MONO}`;
      board.forEach(([n, w], i) => R(`${n.padEnd(16)} ${w.toLocaleString('en-US').padStart(11)} WOOLONG`, (58 + i * 20) * s, C.white, 0.8 - i * 0.12));
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${RED},0.9)`; g.fillText(`GATE ${String(gates).padStart(3, '0')}  ::  ${Math.round(ship.v * 9)} KM/S`, 28 * s, 34 * s);
      // the walking bass: a staff, and a dot stepping along it on the beat
      const x0 = 28 * s, y0 = H - 110 * s, w = 260 * s, sp = 8 * s;
      g.strokeStyle = `rgba(${C.ice},0.5)`; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < 5; i++) { g.moveTo(x0, y0 + i * sp); g.lineTo(x0 + w, y0 + i * sp); } g.stroke();
      const dx = x0 + ((beat % 8) + 0.5) * w / 8, dy = y0 + 4 * sp - note * sp / 2;
      g.fillStyle = `rgba(${C.gold},${0.6 + env.pulse * 0.4})`; g.beginPath(); g.ellipse(dx, dy, 5 * s, 4 * s, -0.3, 0, Math.PI * 2); g.fill();
      g.fillRect(dx + 4 * s, dy - 22 * s, 1.5 * s, 22 * s);
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.7)`; g.fillText('WALKING BASS  ::  SESSION ' + String(cycle + 1).padStart(2, '0'), x0, y0 + 60 * s);
      if (endT > 0) {
        g.font = `bold ${30 * s | 0}px ${MONO}`; const m = 'SEE YOU SPACE COWBOY...';
        g.fillStyle = `rgba(${C.white},${Math.min(1, endT)})`; g.fillText(m, W - 28 * s - g.measureText(m).width, H - 40 * s);
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
