// ZERO SET: anti-grav racing where every track is an equation, after sp00nz's ZERO SET (written
// fresh here, none of the game's code). Four worlds, one per mode, all driving themselves:
//   zeroset   CONTINUUM     the endless road, each lap morphing into the next curve; the clock
//                           tops up every lap but pays a little less each time
//   zsrace    SINGLE RACE   three laps against seven rivals, then the results and the next track
//   zstrial   TIME TRIAL    alone against the ghost of your best lap
//   zselim    ELIMINATION   last place at the end of each lap is blown off the track
// Your activity is the throttle; a failed command puts you into the rail.
(function (Worlds) {
  const TAU = Math.PI * 2, R = 260, YS = 0.32, HW = 7, SAMPLES = 520;
  const tk = (p, q) => (t) => { const r = (2 + Math.cos(q * t)) / 3; return [r * Math.cos(p * t), Math.sin(q * t) / 3, r * Math.sin(p * t)]; }; // a (p,q) torus knot
  // Every track: a closed curve, t in [0, 2pi), roughly in a unit box, crossings at different heights.
  const CURVES = {
    LEMNISCATE: { col: '54,214,255', f: (t) => [Math.cos(t), 0.6 * Math.sin(t), 1.1 * Math.sin(t) * Math.cos(t)] },
    'LIMAÇON': { col: '100,255,80', f: (t) => { const r = 0.6 + Math.cos(t); return [r * Math.cos(t) - 0.5, 0.5 * Math.sin(t), r * Math.sin(t)]; } },
    TREFOIL: { col: '255,140,30', f: (t) => [(Math.sin(t) + 2 * Math.sin(2 * t)) / 3, -Math.sin(3 * t) / 2, (Math.cos(t) - 2 * Math.cos(2 * t)) / 3] },
    'MÖBIUS': { col: '255,50,180', mobius: true, f: (t) => [Math.cos(t), 0.2 * Math.sin(2 * t), Math.sin(t)] },
    CINQUEFOIL: { col: '150,100,255', f: tk(2, 5) },
    'TORUS 3-4': { col: '130,150,255', f: tk(3, 4) },
    'FIGURE 8 KNOT': { col: '255,80,140', f: (t) => { const r = (2 + Math.cos(2 * t)) / 3; return [r * Math.cos(3 * t), Math.sin(4 * t) / 2, r * Math.sin(3 * t)]; } },
    'TENNIS BALL': { col: '200,255,50', f: (t) => [0.75 * Math.cos(t) + 0.25 * Math.cos(3 * t), 0.87 * Math.sin(2 * t), 0.75 * Math.sin(t) - 0.25 * Math.sin(3 * t)] },
    VIVIANI: { col: '255,165,50', f: (t) => [Math.cos(2 * t), Math.sin(t), Math.sin(2 * t)] },
    EPICYCLE: { col: '50,230,255', f: (t) => [Math.cos(t) + 0.3 * Math.cos(4 * t), 0.4 * Math.sin(3 * t), Math.sin(t) + 0.3 * Math.sin(4 * t)] },
    SLINKY: { col: '50,255,200', f: (t) => { const r = (2 + 0.45 * Math.cos(9 * t)) / 2.45; return [r * Math.cos(t), 0.5 * Math.sin(9 * t), r * Math.sin(t)]; } },
  };
  const NAMES = Object.keys(CURVES), CONTINUUM = ['LEMNISCATE', 'LIMAÇON', 'TREFOIL', 'MÖBIUS', 'CINQUEFOIL', 'TENNIS BALL', 'FIGURE 8 KNOT', 'EPICYCLE'];
  const RIVALS = [['EULER', '255,46,136'], ['NOETHER', '255,196,72'], ['GAUSS', '54,214,255'], ['LOVELACE', '168,96,255'], ['TURING', '255,120,60'], ['HOPPER', '230,240,255'], ['RIEMANN', '120,255,200']];
  const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
  const smooth = (x) => x * x * (3 - 2 * x);
  const fmt = (s) => `${(s / 60) | 0}:${(s % 60).toFixed(2).padStart(5, '0')}`;

  function mode(name, label, kind) {
    Worlds.define(name, (k) => {
      const { C, rand, pick, env, seg, setCam, line2 } = k;
      const MONO = "'Cascadia Mono', Consolas, monospace";
      // --- the road: s counts laps; lap n is curve seq[n] (CONTINUUM: blending into seq[n+1]) -----
      let seq = [], laps = new Map(); // lap index -> its samples, length, minimap
      const curveOf = (n) => CURVES[seq[((n % seq.length) + seq.length) % seq.length]];
      function pos(s) {
        const n = Math.floor(s), u = s - n, t = u * TAU, a = curveOf(n).f(t);
        let p = a;
        if (kind === 'continuum') { const b = curveOf(n + 1).f(t), w = smooth(u); p = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]; }
        return [p[0] * R, p[1] * R * YS, p[2] * R];
      }
      function frame(s) { // where, forward, left, up: banked into the bends, and a half twist per lap on the Möbius
        const e = 0.0015, P = pos(s), T = v3.norm(v3.sub(pos(s + e), pos(s - e)));
        let L = v3.norm(v3.cross(T, [0, 1, 0])), U = v3.cross(L, T);
        const T2 = v3.norm(v3.sub(pos(s + 4 * e), pos(s + 2 * e))), T0 = v3.norm(v3.sub(pos(s - 2 * e), pos(s - 4 * e)));
        let a = Math.max(-0.7, Math.min(0.7, v3.cross(T0, T2)[1] * 2.2)); // lean into the turn
        const n = Math.floor(s), mob = (m) => (curveOf(m).mobius ? Math.PI : 0);
        if (kind === 'continuum') { let tw = 0; for (let m = Math.max(0, n - 8); m < n; m++) tw += mob(m); a += tw + mob(n) * smooth(s - n); } // twists so far carry on
        else a += mob(0) * s;
        const c = Math.cos(a), sn = Math.sin(a);
        L = [L[0] * c + U[0] * sn, L[1] * c + U[1] * sn, L[2] * c + U[2] * sn]; U = v3.cross(L, T);
        return { P, T, L, U };
      }
      function lap(n) {
        if (laps.has(n)) return laps.get(n);
        const pts = []; let len = 0;
        for (let i = 0; i <= SAMPLES; i++) { const f = frame(n + i / SAMPLES); if (i) len += Math.hypot(...v3.sub(f.P, pts[i - 1].P)); pts.push(f); }
        const L = { pts, len, col: curveOf(n).col };
        laps.set(n, L); for (const key of laps.keys()) if (key < n - 1) laps.delete(key);
        return L;
      }
      const lenAt = (s) => lap(Math.floor(s)).len;

      // --- the field ---------------------------------------------------------------------------
      let craft = [], me, clock = 0, timeLeft = 0, bonus = 0, best = Infinity, lapT = 0, lapTimes = [], ghost = null, rec = [];
      let cut = 0, state = 'run', stateT = 0, results = [], gibs = [], feed = [], scrape = 0, km = 0, bestKm = 0;
      const say = (s, col) => { feed.push({ s, t: 6, col }); if (feed.length > 5) feed.shift(); };
      function start() {
        laps = new Map();
        seq = kind === 'continuum' ? CONTINUUM.slice().sort(() => Math.random() - 0.5) : [pick(NAMES)];
        me = { name: 'NYX', col: C.neon, s: 0, v: 0, lat: 0, skill: 1, ph: 0, out: false, energy: 1 };
        craft = [me];
        if (kind === 'race' || kind === 'elim') RIVALS.forEach(([name, col], i) => craft.push({ name, col, s: -(i + 1) * 0.006, v: 0, lat: ((i % 3) - 1) * 0.55, skill: rand(0.94, 1.04), ph: rand(0, 6), out: false, energy: 1 }));
        me.s = kind === 'race' || kind === 'elim' ? -0.024 : 0;
        clock = 0; cut = 0; lapT = 0; lapTimes = []; rec = []; timeLeft = 60; bonus = 34; km = 0; state = 'run'; results = []; gibs = [];
        say(kind === 'continuum' ? `INTO ${seq[1]}` : seq[0], curveOf(0).col);
      }
      start();
      const place = (c) => 1 + craft.filter((o) => !o.out && o !== c && o.s > c.s).length;
      const lead = () => craft.filter((c) => !c.out).sort((a, b) => b.s - a.s)[0];
      function blow(c) { const f = frame(c.s), p = v3.add(v3.add(f.P, f.L, c.lat * HW), f.U, 0.6); for (let i = 0; i < 30; i++) gibs.push({ p: p.slice(), v: [rand(-9, 9), rand(2, 14), rand(-9, 9)], l: rand(0.3, 1), col: c.col, t: rand(1.2, 2.4) }); c.out = true; }

      return {
        label,
        update(dt) {
          clock += dt; stateT += dt; scrape = Math.max(0, scrape - dt);
          for (const f of feed) f.t -= dt;
          for (const g of gibs) { g.v[1] -= 18 * dt; g.p = v3.add(g.p, g.v, dt); g.t -= dt; }
          gibs = gibs.filter((g) => g.t > 0);
          if (state !== 'run') { // results up: drift on, then the next
            for (const c of craft) if (!c.out) c.s += c.v * 0.6 * dt / lenAt(c.s);
            if (stateT > 7) start();
            return;
          }
          const base = 120 + env.level * 90 + env.pulse * 25; // world units a second; km/h is x3.6
          const front = lead();
          for (const c of craft) {
            if (c.out) continue;
            const f0 = frame(c.s), f1 = frame(c.s + 12 / lenAt(c.s)), bend = 1 - v3.dot(f0.T, f1.T); // brake before the bends
            let want = base * c.skill * (1 - Math.min(0.3, bend * 9));
            if (c !== me && (kind === 'race' || kind === 'elim')) want *= 1 + Math.max(-0.12, Math.min(0.12, (me.s - c.s) * 3)); // the pack stays a pack
            if (c === me) { want *= 1 + Math.sin(clock * 0.21) * 0.04; if (scrape > 0) want *= 0.45; }
            c.v += (want - c.v) * Math.min(1, dt * 1.6);
            c.lat += (Math.sin(clock * 0.35 + c.ph) * 0.55 - c.lat) * dt * 0.8; // racing lines
            const was = Math.floor(c.s); c.s += c.v * dt / lenAt(c.s);
            if (Math.floor(c.s) > was && c === me) { // a lap
              const n = Math.floor(c.s);
              if (n >= 1) { lapTimes.push(lapT); if (lapT < best && kind === 'trial') { best = lapT; ghost = rec; say(`BEST LAP ${fmt(lapT)}`, C.gold); } }
              lapT = 0; rec = [];
              if (kind === 'continuum') { timeLeft += bonus; say(`+${bonus.toFixed(1)} s  INTO ${seq[(n + 1) % seq.length]}`, curveOf(n).col); bonus = Math.max(8, bonus * 0.85); }
              if (kind === 'trial' && n >= 5) { state = 'done'; stateT = 0; results = lapTimes.map((t, i) => `LAP ${i + 1}  ${fmt(t)}`); }
            }
          }
          lapT += dt; rec.push(me.s - Math.floor(me.s));
          if (kind === 'continuum') {
            km += me.v * dt / 1000 * 3; timeLeft -= dt;
            if (timeLeft <= 0) { bestKm = Math.max(bestKm, km); state = 'done'; stateT = 0; results = [`${km.toFixed(1)} KM`, `BEST ${bestKm.toFixed(1)} KM`]; }
          }
          if (kind === 'race' && front.s >= 3) { // the flag
            state = 'done'; stateT = 0;
            results = craft.slice().sort((a, b) => b.s - a.s).map((c, i) => `P${i + 1}  ${c.name}${i ? `  +${((front.s - c.s) * lenAt(c.s) / Math.max(1, c.v)).toFixed(2)}` : ''}`);
          }
          if (kind === 'elim') {
            const alive = craft.filter((c) => !c.out), n = Math.floor(front.s);
            if (n > cut && alive.length > 1) { // the leader starts a new lap: last place goes
              cut = n; const last = alive.sort((a, b) => a.s - b.s)[0]; blow(last); say(`${last.name} ELIMINATED`, C.hot);
            }
            if (alive.filter((c) => !c.out).length === 1) { state = 'done'; stateT = 0; cut = 0; results = [`WINNER  ${lead().name}`]; }
          }
        },
        signal(kind2) { if (kind2 === 'error') { scrape = 1.2; say('INTO THE RAIL', C.hot); } },
        draw() {
          const t = env.t, cam = me.out ? lead() || me : me, ls = lenAt(cam.s);
          // chase camera, leaning with the road
          const fc = frame(cam.s), fb = frame(cam.s - 10 / ls), fa = frame(cam.s + 14 / ls);
          const eye = v3.add(v3.add(fb.P, fb.U, 3.2), fb.L, cam.lat * HW), look = v3.add(v3.add(fa.P, fa.U, 1), fa.L, cam.lat * HW * 0.5);
          const fw = v3.norm(v3.sub(look, eye)), yaw = Math.atan2(fw[0], fw[2]), pitch = Math.asin(Math.max(-1, Math.min(1, fw[1])));
          const r0 = [Math.cos(yaw), 0, -Math.sin(yaw)], u0 = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
          setCam({ x: eye[0], y: eye[1], z: eye[2], yaw, pitch, roll: Math.atan2(v3.dot(fc.U, r0), v3.dot(fc.U, u0)) });
          // the road: this lap and the next, rails all the way round, a grid where you are
          const n0 = Math.floor(cam.s);
          for (const n of kind === 'continuum' ? [n0, n0 + 1] : [n0]) {
            const L = lap(Math.max(0, n)), pts = L.pts, col = L.col;
            const here = (cam.s - n) * SAMPLES;
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i], A = [v3.add(a.P, a.L, HW), v3.add(a.P, a.L, -HW)], B = [v3.add(b.P, b.L, HW), v3.add(b.P, b.L, -HW)];
              let d = i - here; if (kind !== 'continuum') d = ((d % SAMPLES) + SAMPLES) % SAMPLES; else if (n > n0) d += SAMPLES;
              const near = d > -6 && d < 70;
              for (let j = 0; j < 2; j++) { seg(A[j][0], A[j][1], A[j][2], B[j][0], B[j][1], B[j][2], col, 1, 700); if (near) { const Au = v3.add(A[j], a.U, 0.9), Bu = v3.add(B[j], b.U, 0.9); seg(Au[0], Au[1], Au[2], Bu[0], Bu[1], Bu[2], col, 0.6, 300); } }
              if (near || i % 4 === 0) seg(A[0][0], A[0][1], A[0][2], A[1][0], A[1][1], A[1][2], col, near ? 0.6 : 0.3, near ? 260 : 600); // ribs
              if (near) for (const q of [-0.5, 0, 0.5]) { const p1 = v3.add(a.P, a.L, q * HW), p2 = v3.add(b.P, b.L, q * HW); seg(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], col, 0.35, 220); }
              if (near && i % 26 === 0) { const s1 = v3.add(v3.add(a.P, a.T, -1), a.L, 1.5), s2 = v3.add(a.P, a.T, 1), s3 = v3.add(v3.add(a.P, a.T, -1), a.L, -1.5); for (const [p, q] of [[s1, s2], [s2, s3]]) seg(p[0], p[1] + 0.05, p[2], q[0], q[1] + 0.05, q[2], C.gold, env.pulse > 0.5 ? 1 : 0.5, 200); } // beat pads
            }
          }
          // the field
          const ghostS = ghost && kind === 'trial' ? Math.floor(me.s) + ghost[Math.min(ghost.length - 1, rec.length)] : null;
          const field = craft.filter((c) => !c.out).map((c) => [c, c.s, c.col, 1]);
          if (ghostS != null) field.push([{ lat: -me.lat, v: me.v }, ghostS, C.white, 0.35]);
          for (const [c, s, col, al] of field) {
            const f = frame(s), o = v3.add(v3.add(f.P, f.L, c.lat * HW), f.U, 0.7 + Math.sin(t * 3 + (c.ph || 0)) * 0.08);
            const at = (x, y, z) => [o[0] - f.L[0] * x + f.U[0] * y + f.T[0] * z, o[1] - f.L[1] * x + f.U[1] * y + f.T[1] * z, o[2] - f.L[2] * x + f.U[2] * y + f.T[2] * z];
            const V = [at(0, 0.3, 2.6), at(-1.7, 0, -1), at(1.7, 0, -1), at(0, 0.6, -0.8), at(-1, 1.2, -1.2), at(1, 1.2, -1.2), at(-1, 0, -1), at(1, 0, -1)];
            for (const [i, j] of [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [6, 4], [7, 5], [4, 3], [5, 3]]) seg(V[i][0], V[i][1], V[i][2], V[j][0], V[j][1], V[j][2], col, al, 400);
            for (const sd of [-0.8, 0.8]) { const e1 = at(sd, 0.2, -1.1), e2 = at(sd + rand(-0.2, 0.2), 0.2 + rand(-0.2, 0.2), -1.1 - 1.5 - c.v / 80 * Math.random()); seg(e1[0], e1[1], e1[2], e2[0], e2[1], e2[2], C.white, al * 0.8, 300); }
            if (c === me && scrape > 0) for (let i = 0; i < 6; i++) { const p = at(-1.7, 0, -1), q = v3.add(p, [rand(-1, 1), rand(0, 1), rand(-1, 1)], 2); seg(p[0], p[1], p[2], q[0], q[1], q[2], C.gold, scrape, 200); } // sparks off the rail
          }
          for (const g of gibs) { const q = v3.add(g.p, g.v, 0.03 * g.l); seg(g.p[0], g.p[1], g.p[2], q[0], q[1] + g.l, q[2], g.col, Math.min(1, g.t), 500); }

          // HUD, in the margins
          const g = k.g, W = k.W, H = k.H, sc = Math.min(W / 1920, H / 1080), x0 = W * 0.02, y0 = H * 0.12;
          g.font = `bold ${16 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${curveOf(Math.max(0, n0)).col},0.95)`; g.fillText(`ZERO SET // ${label.split(' // ')[1]}`, x0, y0);
          g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.85)`;
          const into = kind === 'continuum' ? `INTO ${seq[(n0 + 1) % seq.length]}` : seq[0];
          g.fillText(into, x0, y0 + 26 * sc);
          g.font = `bold ${44 * sc | 0}px ${MONO}`;
          if (kind === 'continuum') { g.fillStyle = `rgba(${timeLeft < 10 ? C.hot : C.white},0.95)`; g.fillText(Math.max(0, timeLeft).toFixed(1), x0, y0 + 84 * sc); g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.violet},0.9)`; g.fillText(`${km.toFixed(1)} KM   BEST ${bestKm.toFixed(1)}`, x0, y0 + 110 * sc); }
          else if (kind === 'trial') { g.fillStyle = `rgba(${C.white},0.95)`; g.fillText(fmt(lapT), x0, y0 + 84 * sc); g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(`LAP ${Math.max(1, Math.floor(me.s) + 1)}/5   BEST ${best < Infinity ? fmt(best) : '--'}`, x0, y0 + 110 * sc); }
          else {
            const alive = craft.filter((c) => !c.out).sort((a, b) => b.s - a.s);
            g.fillStyle = `rgba(${C.white},0.95)`; g.fillText(me.out ? 'OUT' : `P${place(me)}/${alive.length}`, x0, y0 + 84 * sc);
            g.font = `${14 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`;
            g.fillText(kind === 'race' ? `LAP ${Math.min(3, Math.max(1, Math.floor(me.s) + 1))}/3` : `${alive.length} LEFT`, x0, y0 + 110 * sc);
            alive.forEach((c, i) => { g.fillStyle = `rgba(${c.col},0.9)`; g.fillText(`${String(i + 1).padStart(2)}  ${c.name}`, x0, y0 + (144 + i * 19) * sc); });
          }
          g.font = `${13 * sc | 0}px ${MONO}`;
          feed.forEach((f, i) => { if (f.t > 0) { g.fillStyle = `rgba(${f.col || C.white},${Math.min(1, f.t)})`; g.fillText(f.s, x0, y0 + (310 + i * 19) * sc); } });
          if (state === 'done') { g.font = `bold ${17 * sc | 0}px ${MONO}`; results.slice(0, 8).forEach((r, i) => { g.fillStyle = `rgba(${i ? C.white : C.gold},0.95)`; g.fillText(r, x0, y0 + (430 + i * 22) * sc); }); }
          // the map: the curve from above, everyone on it
          const L = lap(Math.max(0, n0)), mx = W * 0.915, my = H * 0.25, ms = Math.min(W * 0.06, 110 * sc) / R;
          for (let i = 4; i < L.pts.length; i += 4) { const a = L.pts[i - 4].P, b = L.pts[i].P; line2(mx + a[0] * ms, my + a[2] * ms, mx + b[0] * ms, my + b[2] * ms, L.col, 0.7); }
          for (const c of craft) if (!c.out) { const p = pos(c.s); const px = mx + p[0] * ms, pz = my + p[2] * ms; line2(px - 3, pz, px + 3, pz, c.col, 1); line2(px, pz - 3, px, pz + 3, c.col, 1); }
          // speed and energy
          const hy = H * 0.52;
          g.font = `bold ${48 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.violet},0.95)`; g.fillText(String(Math.round(cam.v * 3.6)), W * 0.86, hy);
          g.font = `${13 * sc | 0}px ${MONO}`; g.fillText('KM/H', W * 0.86, hy + 20 * sc);
          const e = Math.max(0.1, 1 - scrape * 0.6 - env.level * 0.2);
          line2(W * 0.86, hy + 34 * sc, W * 0.86 + 220 * sc * e, hy + 34 * sc, scrape > 0 ? C.hot : C.violet, 1);
        },
      };
    });
  }
  mode('zeroset', 'ZERO SET // CONTINUUM', 'continuum');
  mode('zsrace', 'ZERO SET // SINGLE RACE', 'race');
  mode('zstrial', 'ZERO SET // TIME TRIAL', 'trial');
  mode('zselim', 'ZERO SET // ELIMINATION', 'elim');
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
