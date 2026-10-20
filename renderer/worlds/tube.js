// VECTOR TUBE: a tube shooter in the old vector-arcade mould, playing itself. The tube is a
// cross-section of lanes extruded into the distance; the claw rides the near rim, lane to lane,
// firing down the lanes at flippers, tankers and spikers climbing up from the far end. Clear the
// level and the camera warps down the tube to the next shape. A failed command lets one grab you.
(function (Worlds) {
  Worlds.define('tube', (k) => {
    const { C, rand, pick, env, seg, setCam, line2 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", L = 60, SX = 13, SY = 7.4, CAMZ = -17, FOG = 220, RED = '255,70,60';
    const TAU = Math.PI * 2;

    // --- the shapes: lanes are the gaps between consecutive points ---------------------------
    function poly(v, n) { // n points evenly round a closed polygon
      const len = v.map((p, i) => Math.hypot(v[(i + 1) % v.length][0] - p[0], v[(i + 1) % v.length][1] - p[1]));
      const per = len.reduce((a, b) => a + b, 0), out = [];
      for (let i = 0; i < n; i++) {
        let d = i * per / n, j = 0; while (d > len[j]) d -= len[j++];
        const a = v[j], b = v[(j + 1) % v.length], f = d / len[j];
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      }
      return out;
    }
    const curve = (f, n, open) => Array.from({ length: open ? n + 1 : n }, (_, i) => f(i / n));
    const SHAPES = [
      ['CIRCLE', () => curve((t) => [Math.cos(t * TAU), Math.sin(t * TAU)], 16)],
      ['SQUARE', () => poly([[-1, -1], [1, -1], [1, 1], [-1, 1]], 16)],
      ['PLUS', () => poly([[-0.4, -1], [0.4, -1], [0.4, -0.4], [1, -0.4], [1, 0.4], [0.4, 0.4], [0.4, 1], [-0.4, 1], [-0.4, 0.4], [-1, 0.4], [-1, -0.4], [-0.4, -0.4]], 16)],
      ['V', () => curve((t) => [t * 2 - 1, Math.abs(t * 2 - 1) * 1.6 - 0.8], 14, true), 0.5],
      ['STAR', () => curve((t) => { const r = (Math.round(t * 16) % 2) ? 0.5 : 1; return [Math.cos(t * TAU + 1.57) * r, Math.sin(t * TAU + 1.57) * r]; }, 16)],
      ['FLAT', () => curve((t) => [t * 2 - 1, -0.55], 14, true), 0.5],
      ['TRIANGLE', () => poly([[0, 1], [1, -0.9], [-1, -0.9]], 15)],
      ['FIGURE 8', () => curve((t) => [Math.sin(t * TAU), Math.sin(t * TAU * 2) * 0.85], 16)],
      ['STEPS', () => curve((t) => { const x = t * 2 - 1; return [x, Math.floor((x + 1) * 2.5) * 0.35 - 0.7]; }, 14, true), 2],
      ['HEART', () => curve((t) => { const a = t * TAU; return [Math.pow(Math.sin(a), 3), (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 15 + 0.1]; }, 16)],
    ];
    let tube; // { name, P, open, n, mid, nrm, wid }
    function makeTube(idx) {
      const [name, f, cy] = SHAPES[idx % SHAPES.length], raw = f(), open = cy != null; // open shapes give where their inside is
      const P = raw.map(([x, y]) => [x * SX, y * SY]), n = open ? P.length - 1 : P.length;
      const mid = [], nrm = [], wid = [];
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % P.length], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, w = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        let nx = -(b[1] - a[1]) / w, ny = (b[0] - a[0]) / w; // a perpendicular, flipped to face away from the middle
        if (nx * mx + ny * (my - (cy || 0) * SY) < 0) { nx = -nx; ny = -ny; }
        mid.push([mx, my]); nrm.push([nx, ny]); wid.push(w);
      }
      tube = { name, P, open, n, mid, nrm, wid, col: [C.ice, C.violet, RED, C.neon, C.gold][idx % 5] };
    }
    const wrap = (i) => tube.open ? Math.max(0, Math.min(tube.n - 1, i)) : ((i % tube.n) + tube.n) % tube.n;
    const laneDist = (a, b) => { const d = b - a; return tube.open ? d : ((d % tube.n) + tube.n * 1.5) % tube.n - tube.n / 2; };

    // --- the game ------------------------------------------------------------------------------
    let score = 0, hi = 0, level = 0, lives = 3, foes = [], shots = [], bursts = [], spikes = [], toSpawn = 0, spawnT = 0;
    let state = 'enter', stateT = 0, grabber = null, msg = '', msgT = 0, zapper = 1, zapT = 0, flash = 0;
    const ship = { lane: 0, want: 0, step: 0, cool: 0, z: 0 };
    const say = (s, t) => { msg = s; msgT = t || 2.5; };
    function newLevel() {
      makeTube(level); foes = []; shots = []; spikes = new Array(tube.n).fill(L); toSpawn = Math.min(24, 8 + level * 2); spawnT = 1;
      ship.lane = ship.want = tube.n >> 1; ship.z = 0; zapper = 1; state = 'enter'; stateT = 0; say(`LEVEL ${level + 1}`, 3);
    }
    newLevel();

    const speedK = () => (1 + level * 0.12) * (0.8 + env.level * 1.2);
    function spawn() {
      const r = Math.random(), type = r < 0.6 ? 'flipper' : r < 0.82 ? 'tanker' : 'spiker';
      foes.push({ type, lane: (Math.random() * tube.n) | 0, to: -1, f: 0, z: L, flipT: rand(0.5, 2.5), stop: rand(14, 34), back: false, ph: rand(0, 6) });
    }
    function boom(x, y, z, col, big) { bursts.push({ x, y, z, col, t: 0, r: big ? 2.6 : 1 }); }
    const at = (lane, z) => [tube.mid[lane][0], tube.mid[lane][1], z];
    function kill(e, i) {
      const p = at(e.lane, e.z); boom(p[0], p[1], p[2], e.type === 'tanker' ? C.violet : e.type === 'spiker' ? C.neon : C.hot);
      score += e.type === 'tanker' ? 100 : e.type === 'spiker' ? 50 : 150; foes.splice(i, 1);
      if (e.type === 'tanker') for (const d of [-1, 1]) foes.push({ type: 'flipper', lane: e.lane, to: wrap(e.lane + d), f: 0, z: e.z, flipT: rand(0.5, 1.5), stop: 0, back: false, ph: 0 });
    }
    function grab(e) { grabber = e; e.lane = ship.lane; e.to = -1; e.z = 0; state = 'grabbed'; stateT = 0; say('GRABBED', 2); }

    function step(dt) {
      const sk = speedK();
      stateT += dt; msgT -= dt; flash = Math.max(0, flash - dt * 2.5); hi = Math.max(hi, score);
      for (const b of bursts) b.t += dt;
      bursts = bursts.filter((b) => b.t < 0.7 * b.r);
      if (state === 'enter') { if (stateT > 1.4) { state = 'play'; stateT = 0; } return; }
      if (state === 'warp') { if (stateT > 2.2) { level++; newLevel(); } return; }
      if (state === 'over') { if (stateT > 3.5) { score = 0; level = 0; lives = 3; newLevel(); } return; }
      if (state === 'dead') {
        if (stateT > 1.4) { if (--lives < 0) { state = 'over'; stateT = 0; say('GAME OVER', 3.5); return; } for (const e of foes) if (e.z < 20) e.z = L; shots = []; ship.z = 0; state = 'play'; stateT = 0; }
        return;
      }
      if (state === 'grabbed') { // dragged down the tube, then blown apart
        ship.z = Math.min(L * 0.7, stateT * stateT * 14); grabber.z = ship.z;
        if (stateT > 1.8) { const p = at(ship.lane, ship.z); boom(p[0], p[1], p[2], C.gold, true); foes.splice(foes.indexOf(grabber), 1); grabber = null; state = 'dead'; stateT = 0; }
        return;
      }
      // play
      spawnT -= dt * (0.8 + env.level);
      if (toSpawn > 0 && spawnT < 0) { spawn(); toSpawn--; spawnT = rand(0.6, 1.4) / (1 + level * 0.08); }
      for (let i = foes.length - 1; i >= 0; i--) {
        const e = foes[i];
        if (e.to >= 0) { e.f += dt * 3.5; if (e.f >= 1) { e.lane = e.to; e.to = -1; e.f = 0; } }
        if (e.type === 'spiker') {
          if (!e.back) { e.z -= dt * 7 * sk; spikes[e.lane] = Math.min(spikes[e.lane], e.z); if (e.z < e.stop) e.back = true; }
          else { e.z += dt * 7 * sk; if (e.z >= L) { e.type = 'flipper'; e.z = L; } }
          continue;
        }
        if (e.z > 0) e.z = Math.max(0, e.z - dt * (e.type === 'tanker' ? 5 : 7.5) * sk);
        if (e.type === 'tanker' && e.z <= 0) { e.type = 'flipper'; foes.push({ ...e, to: wrap(e.lane + 1) }); e.to = wrap(e.lane - 1); continue; }
        if (e.type === 'flipper' && e.to < 0 && (e.flipT -= dt * sk) < 0) {
          const d = e.z <= 0 ? Math.sign(laneDist(e.lane, ship.lane)) || 1 : pick([-1, 1]);
          const to = wrap(e.lane + d); if (to !== e.lane) { e.to = to; e.f = 0; }
          e.flipT = e.z <= 0 ? 0.55 : rand(0.6, 2.2);
        }
        if (e.z <= 0 && e.to < 0 && e.lane === ship.lane) { grab(e); return; }
      }
      // the claw: hunts the nearest thing up its tube
      let tgt = null;
      for (const e of foes) if (!tgt || e.z < tgt.z) tgt = e;
      if (tgt) ship.want = tgt.to >= 0 && tgt.f > 0.5 ? tgt.to : tgt.lane;
      else { let best = L; spikes.forEach((s, i) => { if (s < best) { best = s; ship.want = i; } }); }
      ship.step -= dt;
      if (ship.step < 0 && ship.want !== ship.lane) { ship.lane = wrap(ship.lane + (Math.sign(laneDist(ship.lane, ship.want)) || 1)); ship.step = 0.07 / (0.8 + env.level * 0.6); }
      ship.cool -= dt;
      if (ship.cool < 0 && shots.length < 8 && (ship.want === ship.lane || Math.random() < 0.08)) { shots.push({ lane: ship.lane, z: 0.5 }); ship.cool = 0.11 / (0.8 + env.level * 0.7); }
      if (zapper && foes.filter((e) => e.z < 12).length >= 4) { zapper = 0; zapT = 0.6; flash = 1; say('ZAPPER', 2); for (let i = foes.length - 1; i >= 0; i--) if (foes[i].type !== 'tanker') kill(foes[i], i); }
      for (let s = shots.length - 1; s >= 0; s--) {
        const sh = shots[s]; sh.z += dt * 95;
        let hit = sh.z > L;
        for (let i = foes.length - 1; i >= 0 && !hit; i--) {
          const e = foes[i], lane = e.to >= 0 && e.f > 0.5 ? e.to : e.lane;
          if (lane === sh.lane && Math.abs(e.z - sh.z) < 2.5) { kill(e, i); hit = true; }
        }
        if (!hit && spikes[sh.lane] < L && sh.z >= spikes[sh.lane]) { spikes[sh.lane] += 4; score += 3; if (spikes[sh.lane] >= L - 1) spikes[sh.lane] = L; hit = true; }
        if (hit) shots.splice(s, 1);
      }
      if (!toSpawn && !foes.length) { state = 'warp'; stateT = 0; shots = []; score += 1000 + level * 500; say('WARP', 2.2); }
    }

    // --- line art --------------------------------------------------------------------------------
    // lane geometry at depth z, with an optional flip toward lane `to`
    const E = [0, 0, 0, 0, 0, 0, 0]; // ax, ay, bx, by, nx, ny, w
    function lane(i, to, f) {
      const P = tube.P, a = P[i], b = P[(i + 1) % P.length];
      E[0] = a[0]; E[1] = a[1]; E[2] = b[0]; E[3] = b[1]; E[4] = tube.nrm[i][0]; E[5] = tube.nrm[i][1]; E[6] = tube.wid[i];
      if (to >= 0) { // swing across, lifting off the tube wall
        const c = P[to], d = P[(to + 1) % P.length], s = f * f * (3 - 2 * f), up = Math.sin(f * Math.PI) * tube.wid[i] * 0.5;
        const nx = E[4] + (tube.nrm[to][0] - E[4]) * s, ny = E[5] + (tube.nrm[to][1] - E[5]) * s;
        E[0] += (c[0] - E[0]) * s - nx * up; E[1] += (c[1] - E[1]) * s - ny * up; E[2] += (d[0] - E[2]) * s - nx * up; E[3] += (d[1] - E[3]) * s - ny * up; E[4] = nx; E[5] = ny;
      }
      return E;
    }
    const pts = Array.from({ length: 8 }, () => [0, 0]);
    function loop(n, z, col, a, close) { for (let i = 0; i < n - (close ? 0 : 1); i++) { const p = pts[i], q = pts[(i + 1) % n]; seg(p[0], p[1], z, q[0], q[1], z, col, a, FOG); } }
    function set(i, x, y) { pts[i][0] = x; pts[i][1] = y; }
    function claw(i, z, col, a) {
      const [ax, ay, bx, by, nx, ny, w] = lane(i, -1, 0), mx = (ax + bx) / 2, my = (ay + by) / 2, ux = (bx - ax) * 0.18, uy = (by - ay) * 0.18, h = w * 0.55;
      set(0, ax, ay); set(1, mx - ux + nx * h * 1.3, my - uy + ny * h * 1.3); set(2, mx + nx * h * 0.45, my + ny * h * 0.45);
      set(3, mx + ux + nx * h * 1.3, my + uy + ny * h * 1.3); set(4, bx, by); set(5, mx + nx * h * 0.75, my + ny * h * 0.75);
      loop(6, z - 0.3, col, a, true);
    }
    function foe(e) {
      const [ax, ay, bx, by, nx, ny, w] = lane(e.lane, e.to, e.f), mx = (ax + bx) / 2, my = (ay + by) / 2, z = e.z, h = w * 0.3;
      if (e.type === 'flipper') { // a bowtie across the lane
        set(0, ax + nx * h, ay + ny * h); set(1, ax - nx * h * 0.3, ay - ny * h * 0.3); set(2, mx, my); loop(3, z, C.hot, 1, true);
        set(0, bx + nx * h, by + ny * h); set(1, bx - nx * h * 0.3, by - ny * h * 0.3); set(2, mx, my); loop(3, z, C.hot, 1, true);
      } else if (e.type === 'tanker') { // a diamond in a diamond
        for (const s of [1, 0.5]) { const ex = (bx - ax) / 2 * s * 0.9, ey = (by - ay) / 2 * s * 0.9; set(0, mx - ex, my - ey); set(1, mx + nx * h * 1.4 * s, my + ny * h * 1.4 * s); set(2, mx + ex, my + ey); set(3, mx - nx * h * 1.4 * s, my - ny * h * 1.4 * s); loop(4, z, C.violet, 1, true); }
      } else { // a spinning spiral
        const r = w * 0.32, a0 = env.t * 9 + e.ph;
        for (let j = 0; j < 7; j++) set(j, mx + Math.cos(a0 + j * 1.3) * r * (j + 1) / 7, my + Math.sin(a0 + j * 1.3) * r * (j + 1) / 7);
        loop(7, z, C.neon, 1, false);
      }
    }
    const DIRS = Array.from({ length: 14 }, (_, i) => { const a = i * 2.4, b = Math.sin(i * 1.7) * 0.6; return [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)]; });

    return {
      label: 'VECTOR TUBE',
      enter() { if (state === 'over') { score = 0; level = 0; lives = 3; newLevel(); } },
      update(dt) { step(dt); },
      signal(kind) { // a failed command: something reaches the rim
        if (kind !== 'error' || state !== 'play') return;
        let e = foes.reduce((m, x) => (!m || x.z < m.z ? x : m), null);
        if (!e || e.type !== 'flipper') { e = { type: 'flipper', lane: ship.lane, to: -1, f: 0, z: 0, flipT: 1, stop: 0, back: false, ph: 0 }; foes.push(e); }
        grab(e);
      },
      draw() {
        const t = env.t, W = k.W, H = k.H, g = k.g, sc = Math.min(W / 1920, H / 1080);
        // the camera: dives down the tube to warp, comes in from far away on a new level
        let cz = CAMZ;
        if (state === 'warp') { const s = Math.min(1, stateT / 2.2); cz = CAMZ + s * s * (L + 20 - CAMZ); }
        else if (state === 'enter') { const s = Math.min(1, stateT / 1.4); cz = CAMZ - (1 - s * s * (3 - 2 * s)) * 130; }
        const shake = state === 'dead' && stateT < 0.4 ? 0.6 : 0;
        setCam({ x: rand(-shake, shake), y: 0.6 + rand(-shake, shake), z: cz, yaw: 0, pitch: 0, roll: Math.sin(t * 0.3) * 0.04 });
        const P = tube.P, n = P.length, col = flash > 0 ? C.white : tube.col, rimA = 0.75 + env.pulse * 0.25 + flash;
        // the tube: near rim, far rim, and the lane edges between them (in pieces, so the fog shades them)
        for (let i = 0; i < n - (tube.open ? 1 : 0); i++) {
          const a = P[i], b = P[(i + 1) % n];
          seg(a[0], a[1], 0, b[0], b[1], 0, col, rimA, FOG); seg(a[0], a[1], 0, b[0], b[1], 0, col, 0.6, FOG); // twice: a second batch, so it glows
          seg(a[0], a[1], L, b[0], b[1], L, col, 0.8, FOG);
        }
        for (let i = 0; i < n; i++) for (let z = 0; z < L; z += 15) { seg(P[i][0], P[i][1], z, P[i][0], P[i][1], z + 15, col, 1 - z / L * 0.4, FOG); if (z < 30) seg(P[i][0], P[i][1], z, P[i][0], P[i][1], z + 15, col, 0.4, FOG); }
        if (state === 'play' || state === 'grabbed') { // the claw's lane, lit
          const [ax, ay, bx, by] = lane(ship.lane, -1, 0);
          for (let z = 0; z < L; z += 15) { seg(ax, ay, z, ax, ay, z + 15, C.gold, 0.45, FOG); seg(bx, by, z, bx, by, z + 15, C.gold, 0.45, FOG); }
        }
        spikes.forEach((s, i) => { if (s < L) { const m = tube.mid[i]; seg(m[0], m[1], s, m[0], m[1], L, C.neon, 0.9, FOG); seg(m[0] - 0.3, m[1], s, m[0] + 0.3, m[1], s, C.white, 0.9, FOG); } });
        for (const e of foes) foe(e);
        for (const s of shots) { const m = tube.mid[s.lane]; seg(m[0], m[1], s.z, m[0], m[1], s.z + 2.2, C.white, 1, FOG); seg(m[0] - 0.4, m[1], s.z + 1.1, m[0] + 0.4, m[1], s.z + 1.1, C.gold, 0.9, FOG); }
        if (state === 'play' || state === 'grabbed' || state === 'enter') claw(ship.lane, ship.z, C.gold, 1);
        for (const b of bursts) { // line bursts
          const r = b.t * 11 * b.r, a = 1 - b.t / (0.7 * b.r);
          for (const d of DIRS) seg(b.x + d[0] * r * 0.45, b.y + d[1] * r * 0.45, b.z + d[2] * r * 0.45, b.x + d[0] * r, b.y + d[1] * r, b.z + d[2] * r, b.col, a, FOG);
        }
        if (state === 'warp') for (let i = 0; i < n; i++) { const p = P[i], s = Math.min(1, stateT / 2.2); seg(p[0] * 1.6, p[1] * 1.6, cz + 2, p[0] * 1.6, p[1] * 1.6, cz + 2 + 40 * s, C.white, 0.5, FOG); }

        // HUD, in the margins
        const x0 = W * 0.02, y0 = H * 0.12, xr = W * 0.855;
        g.font = `bold ${30 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(String(score).padStart(6, '0'), x0, y0);
        g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${tube.col},0.9)`; g.fillText(`LEVEL ${String(level + 1).padStart(2, '0')}  ${tube.name}`, x0, y0 + 28 * sc);
        for (let i = 0; i < Math.max(0, lives); i++) { // spare claws
          const x = x0 + 14 * sc + i * 34 * sc, y = y0 + 58 * sc, s = 12 * sc;
          line2(x - s, y, x - s * 0.4, y - s, C.gold, 0.9); line2(x - s * 0.4, y - s, x, y - s * 0.35, C.gold, 0.9); line2(x, y - s * 0.35, x + s * 0.4, y - s, C.gold, 0.9);
          line2(x + s * 0.4, y - s, x + s, y, C.gold, 0.9); line2(x + s, y, x, y - s * 0.6, C.gold, 0.9); line2(x, y - s * 0.6, x - s, y, C.gold, 0.9);
        }
        g.fillStyle = `rgba(${C.white},0.6)`; g.fillText(`ZAPPER ${zapper ? 'READY' : 'USED'}`, x0, y0 + 86 * sc);
        g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.85)`; g.fillText(`HI ${String(hi).padStart(6, '0')}`, xr, y0);
        g.fillStyle = `rgba(${C.white},0.7)`; g.fillText(`ENEMIES ${String(toSpawn + foes.length).padStart(2)}`, xr, y0 + 24 * sc);
        g.fillText(`LANES   ${tube.n}${tube.open ? ' OPEN' : ''}`, xr, y0 + 46 * sc);
        if (msgT > 0) { g.font = `bold ${22 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${msg === 'GRABBED' || msg === 'GAME OVER' ? C.hot : C.neon},${Math.min(1, msgT) * (0.7 + 0.3 * Math.sin(t * 12))})`; g.fillText(msg, xr, y0 + 90 * sc); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
