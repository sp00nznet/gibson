// SPIDER TANK: the museum fight. A four-legged think-tank stalks a ruined exhibition hall,
// its red eye-lamp sweeping, its turret chewing the columns apart (tracers, chunks, brass
// casings rattling on the floor). Behind it, the whole back wall is a great branching tree of
// life. Now and then a figure leaps onto its back and tears at the hatch. Faster typing, faster
// fire; a failed command, a burst.
(function (Worlds) {
  Worlds.define('spidertank', (k) => {
    const { C, rand, env, seg, setCam, lookAt, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 200, BACK = 70, CH = 24;

    // the tree on the back wall: branches and nodes in (x, y), drawn at z = BACK
    const tree = [], tnodes = [];
    (function grow(x, y, a, len, d) {
      const x2 = x + Math.sin(a) * len, y2 = y + Math.cos(a) * len; tree.push([x, y, x2, y2, d]);
      if (d >= 6) { tnodes.push([x2, y2]); return; }
      if (d % 2 === 1) tnodes.push([x2, y2]);
      const n = d < 2 ? 3 : 2;
      for (let i = 0; i < n; i++) grow(x2, y2, a + (i - (n - 1) / 2) * (0.9 - d * 0.08) + rand(-0.12, 0.12), len * 0.74, d + 1);
    })(0, 1, 0, 7, 0);

    const columns = [];
    for (const x of [-22, 22]) for (let z = 12; z <= 60; z += 12) columns.push({ x, z, hp: 4, cut: CH, fade: 1 });
    let chunks = [], tracers = [], casings = [], hits = [];
    const tank = { x: 0, z: 34, yaw: Math.PI, aim: Math.PI, walk: 0, tx: 0 };
    let cool = 1, ammo = 480, armour = 100, burst = 0, jumper = null, jumpT = 12, reload = 0, reset = 0;

    function legs() { // hip, knee, foot for each of four legs
      const out = [];
      for (let i = 0; i < 4; i++) {
        const a = tank.yaw + Math.PI / 4 + i * Math.PI / 2, ph = tank.walk + i * Math.PI / 2, lift = Math.max(0, Math.sin(ph)) * 1.6;
        const ca = Math.cos(a), sa = Math.sin(a), stride = Math.cos(ph) * 1.2;
        out.push([[tank.x + sa * 2.4, 5.5, tank.z + ca * 2.4], [tank.x + sa * 6, 9 + lift * 0.5, tank.z + ca * 6], [tank.x + sa * 9 + ca * stride, lift, tank.z + ca * 9 - sa * stride]]);
      }
      return out;
    }
    function turret() { const ca = Math.cos(tank.aim), sa = Math.sin(tank.aim); return [tank.x + sa * 3.6, 7.6, tank.z + ca * 3.6]; }
    function fire() {
      if (ammo <= 0) { reload = 3; return; }
      const live = columns.filter((c) => c.hp > 0), tgt = live.length && Math.random() < 0.7 ? live[Math.floor(rand(0, live.length))] : null;
      const to = tgt ? [tgt.x + rand(-1, 1), rand(3, Math.min(tgt.cut, 18)), tgt.z] : [rand(-25, 25), rand(4, 26), BACK];
      tank.aim += Math.atan2(to[0] - tank.x, to[2] - tank.z) - tank.aim; // snap the turret on
      const from = turret();
      tracers.push({ a: from, b: to, f: 0, tgt });
      casings.push({ x: from[0], y: from[1], z: from[2], vx: rand(-4, 4), vy: rand(3, 6), vz: rand(-4, 4), t: 4, spin: rand(0, 6) });
      ammo--;
    }
    function impact(tr) {
      const [x, y, z] = tr.b;
      for (let i = 0; i < 8; i++) chunks.push({ x, y, z, vx: rand(-6, 6), vy: rand(0, 8), vz: rand(-8, 2), t: rand(1, 2.5), col: C.gold });
      if (!tr.tgt) { hits.push({ x, y, t: 6 }); return; }
      const c = tr.tgt; if (--c.hp > 0) return;
      c.cut = rand(3, 11); // shattered: the shaft above comes down in pieces
      for (let i = 0; i < 16; i++) chunks.push({ x: c.x + rand(-1.5, 1.5), y: rand(c.cut, CH), z: c.z + rand(-1.5, 1.5), vx: rand(-3, 3), vy: rand(-1, 3), vz: rand(-3, 3), t: rand(2, 4), col: C.white });
    }

    return {
      label: 'SPIDER TANK',
      signal(kind) { if (kind === 'error') burst = 1.2; },
      update(dt) {
        // stalk between waypoints
        if (Math.abs(tank.tx - tank.x) < 0.5) tank.tx = rand(-14, 14);
        const step = Math.sign(tank.tx - tank.x) * dt * 2.2; tank.x += step; tank.walk += Math.abs(step) * 1.6 + dt * 0.6;
        tank.yaw += (Math.PI + Math.sin(env.t * 0.2) * 0.3 - tank.yaw) * dt;
        // the gun
        cool -= dt; burst = Math.max(0, burst - dt); reload = Math.max(0, reload - dt);
        if (reload === 0 && ammo <= 0) ammo = 480;
        if (cool < 0 && reload === 0) { fire(); cool = burst > 0 ? 0.06 : rand(0.15, 0.6) / (0.4 + env.level); }
        for (const tr of tracers) { tr.f += dt * 4; if (tr.f >= 1 && !tr.done) { tr.done = true; impact(tr); } }
        tracers = tracers.filter((tr) => tr.f < 1.3);
        for (const c of chunks) { c.vy -= 12 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; if (c.y < 0) { c.y = 0; c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; } c.t -= dt; }
        chunks = chunks.filter((c) => c.t > 0);
        for (const c of casings) { c.vy -= 14 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.spin += dt * 9; if (c.y < 0) { c.y = 0; c.vy *= -0.35; c.vx *= 0.5; c.vz *= 0.5; } c.t -= dt; }
        casings = casings.filter((c) => c.t > 0);
        for (const h of hits) h.t -= dt;
        hits = hits.filter((h) => h.t > 0);
        // a hall nearly down: wait, then it's all standing again
        if (columns.filter((c) => c.hp > 0).length <= 2) { reset += dt; if (reset > 3) { for (const c of columns) { c.hp = 4; c.cut = CH; } reset = 0; armour = 100; } }
        // the leap onto its back
        jumpT -= dt;
        if (!jumper && jumpT < 0) jumper = { t: 0, x0: -30, z0: 20 };
        if (jumper) {
          jumper.t += dt;
          if (jumper.t > 1.2 && jumper.t < 5) armour = Math.max(0, armour - dt * 4);
          if (jumper.t > 6.2) { jumper = null; jumpT = rand(14, 24); }
        }
      },
      draw() {
        const t = env.t, kick = env.pulse * 0.15;
        setCam(lookAt({ x: -15 + Math.sin(t * 0.1) * 3, y: 5 + kick, z: 4 }, tank.x * 0.6, 8, 40));
        // the hall: floor grid, side walls, the tree of life on the back wall
        for (let x = -40; x <= 40; x += 5) seg(x, 0, -20, x, 0, BACK, C.violet, 0.25, FOG);
        for (let z = -20; z <= BACK; z += 5) seg(-40, 0, z, 40, 0, z, C.violet, 0.25, FOG);
        for (const x of [-40, 40]) { seg(x, 0, BACK, x, 32, BACK, C.violet, 0.5, FOG); seg(x, 32, -20, x, 32, BACK, C.violet, 0.35, FOG); for (let z = -20; z <= BACK; z += 15) seg(x, 0, z, x, 32, z, C.violet, 0.25, FOG); }
        seg(-40, 32, BACK, 40, 32, BACK, C.violet, 0.5, FOG);
        for (const [x1, y1, x2, y2, d] of tree) seg(x1 * 1.15, y1 * 1.15, BACK, x2 * 1.15, y2 * 1.15, BACK, C.gold, 0.75 - d * 0.06, FOG);
        for (const [x, y] of tnodes) ring(x * 1.15, y * 1.15, BACK, 0.9, 10, C.ice, 0.7, FOG, 'xy');
        for (const h of hits) ring(h.x, h.y, BACK - 0.1, 0.5, 6, C.white, h.t / 6, FOG, 'xy');
        // columns, octagonal; broken ones end in a jagged stump
        for (const c of columns) {
          let prev = null;
          for (let i = 0; i <= 8; i++) {
            const a = i / 8 * Math.PI * 2, x = c.x + Math.cos(a) * 1.5, z = c.z + Math.sin(a) * 1.5, top = c.hp > 0 ? CH : c.cut + Math.sin(i * 2.7) * 0.9;
            if (i < 8) seg(x, 0, z, x, top, z, C.ice, 0.55, FOG);
            if (prev) { seg(prev[0], 0, prev[1], x, 0, z, C.ice, 0.5, FOG); seg(prev[0], prev[2], prev[1], x, top, z, C.ice, 0.6, FOG); }
            prev = [x, z, top];
          }
        }
        // the tank: legs, a pod in three rings, the turret and its eye
        for (const [h, kn, f] of legs()) { seg(...h, ...kn, C.white, 0.9, FOG); seg(...kn, ...f, C.white, 0.9, FOG); ring(f[0], f[1] + 0.1, f[2], 0.5, 6, C.white, 0.6, FOG); }
        ring(tank.x, 4.6, tank.z, 3, 16, C.white, 0.8, FOG); ring(tank.x, 6, tank.z, 3.6, 16, C.white, 0.9, FOG); ring(tank.x, 7.4, tank.z, 2.4, 16, C.white, 0.8, FOG);
        const tu = turret(), ca = Math.cos(tank.aim), sa = Math.sin(tank.aim);
        for (const o of [-0.4, 0.4]) seg(tank.x + ca * o, 7.6, tank.z - sa * o, tu[0] + ca * o + sa * 2, tu[1], tu[2] - sa * o + ca * 2, C.white, 1, FOG);
        const eye = [tank.x + sa * 3.4, 6, tank.z + ca * 3.4], sw = Math.sin(t * 0.9) * 0.9, ex = eye[0] + Math.sin(tank.aim + sw) * 22, ez = eye[2] + Math.cos(tank.aim + sw) * 22;
        ring(...eye, 0.5 + env.pulse * 0.3, 8, C.hot, 1, FOG, 'xy');
        for (const o of [-1.5, 0, 1.5]) seg(...eye, ex + o * Math.cos(tank.aim + sw), 0, ez - o * Math.sin(tank.aim + sw), C.hot, 0.35, FOG);
        ring(ex, 0.05, ez, 2, 12, C.hot, 0.6, FOG);
        // fire, debris, brass
        for (const tr of tracers) { if (tr.f > 1) continue; const f0 = Math.max(0, tr.f - 0.25), p = (f) => tr.a.map((v, i) => v + (tr.b[i] - v) * f); seg(...p(f0), ...p(tr.f), C.gold, 1, FOG); }
        for (const c of chunks) seg(c.x, c.y, c.z, c.x + 0.4, c.y + 0.3, c.z, c.col, Math.min(1, c.t), FOG);
        for (const c of casings) seg(c.x, c.y, c.z, c.x + Math.cos(c.spin) * 0.35, c.y + Math.sin(c.spin) * 0.2, c.z, C.gold, Math.min(1, c.t), FOG);
        if (jumper) drawJumper(jumper);
        hud();
      },
    };

    function drawJumper(j) { // a parabola from the left wall onto its back, a struggle, a leap away
      let x, y, z;
      if (j.t < 1.2) { const f = j.t / 1.2; x = j.x0 + (tank.x - j.x0) * f; z = j.z0 + (tank.z - j.z0) * f; y = 8.6 + Math.sin(f * Math.PI) * 9 + (1 - f) * -8.6; }
      else if (j.t < 5) { x = tank.x; z = tank.z; y = 8.6; }
      else { const f = (j.t - 5) / 1.2; x = tank.x + f * 28; z = tank.z - f * 10; y = 8.6 + Math.sin(f * Math.PI) * 8 - f * 8.6; }
      const pull = j.t > 1.2 && j.t < 5 ? Math.sin(j.t * 9) * 0.3 : 0, B = [[0, 1.8, 0, 1.3], [0, 1.3, 0, 0.8], [-0.4, 2.2 + pull, 0, 1.4], [0.4, 2.2 - pull, 0, 1.4], [0, 0.8, -0.4, 0], [0, 0.8, 0.4, 0]];
      for (const [x1, y1, x2, y2] of B) seg(x + x1, y + y1, z, x + x2, y + y2, z, C.neon, 1, FOG);
      ring(x, y + 2.05, z, 0.25, 6, C.neon, 1, FOG, 'xy');
    }
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), R = (str, y, col) => { g.fillStyle = `rgba(${col},0.9)`; g.fillText(str, W - 28 * s - g.measureText(str).width, y); };
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText('THINK TANK // AP ROUNDS', 28 * s, 40 * s);
      g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(reload > 0 ? 'RELOADING' : `AMMO ${String(ammo).padStart(4, '0')}`, 28 * s, 64 * s);
      const bars = Math.round(armour / 10);
      R('ARMOUR ' + '#'.repeat(bars).padEnd(10, '.') + ' ' + String(Math.round(armour)).padStart(3, ' ') + '%', 40 * s, armour < 50 ? C.hot : C.neon);
      R(jumper && jumper.t > 1.2 && jumper.t < 5 ? 'HOSTILE ON HULL' : 'HULL CLEAR', 64 * s, jumper ? C.hot : C.ice);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`;
      g.fillText(`COLUMNS STANDING ${columns.filter((c) => c.hp > 0).length}/${columns.length}`, 28 * s, H - 40 * s);
      R('EXHIBIT HALL // TREE OF LIFE', H - 40 * s, C.gold);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
