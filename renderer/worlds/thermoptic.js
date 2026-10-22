// THERMOPTIC: the rooftop dive. Night over a harbour city of towers and canals; a wireframe
// operative stands at the roof edge, back to the drop, then tips over backwards and falls,
// cloaking as she goes until only a shimmer of refracted outline is left. The camera rides
// down the lit face of the tower with her, she swings in through a window in a burst of
// glass, and it starts again. A green cyberbrain HUD tracks her (and loses her) from the corners.
(function (Worlds) {
  Worlds.define('thermoptic', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, toCam, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 320, TOP = 120, HW = 8, FL = 3.5, S = 2.2;
    const hash = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return (Math.imul(h, 1103515245) >>> 0) / 4294967296; };
    const towers = [];
    for (let i = 0; i < 110; i++) { // all round the tower, clear of it and of the camera
      const x = rand(-220, 220), z = rand(-260, 200); if (Math.hypot(x, z) < 30 || (x > -6 && x < 30 && z > 0 && z < 50)) continue;
      towers.push({ x, z, w: rand(8, 18), d: rand(8, 18), h: rand(20, 150) * (Math.hypot(x, z) > 120 ? 1.2 : 0.75), col: pick([C.ice, C.ice, C.violet, C.neon]), sign: Math.random() < 0.35 ? pick([C.hot, C.gold, C.hot]) : null, sy: rand(0.3, 0.85) });
    }
    for (const x of [-34, 34]) towers.push({ x, z: rand(-6, 6), w: 14, d: 16, h: rand(70, 100), col: C.violet, sign: null }); // neighbours, for the fall
    const CANALS = [-44, -38, 52, 58];

    let phase, pt, fig, vy, crashY, shards = [], glitch = 0, camY = TOP + 3;
    function reset() { phase = 'stand'; pt = 0; fig = { y: TOP, z: HW - 0.3, tilt: 0, cloak: 0 }; vy = 0; crashY = rand(20, 50); }
    reset();

    // the operative: hip-relative joints, x across, y along the body; she tips back toward +z
    function body() {
      const sw = Math.sin(env.t * 3) * (phase === 'fall' ? 0.25 : 0.04), up = [0, Math.cos(fig.tilt), Math.sin(fig.tilt)];
      const P = (x, y) => [x * S, fig.y + y * S * up[1], fig.z + y * S * up[2]];
      const J = { head: P(0, 0.85), neck: P(0, 0.6), hip: P(0, 0), ls: P(-0.22, 0.55), rs: P(0.22, 0.55), lh: P(-0.42 - sw, 0.05 + sw), rh: P(0.42 + sw, 0.05 - sw),
        lk: P(-0.12, -0.45), rk: P(0.12, -0.45), lf: P(-0.14 - sw * 0.5, -0.95), rf: P(0.14 + sw * 0.5, -0.95) };
      return [[J.head, J.neck], [J.neck, J.hip], [J.ls, J.rs], [J.ls, J.lh], [J.rs, J.rh], [J.hip, J.lk], [J.hip, J.rk], [J.lk, J.lf], [J.rk, J.rf],
        [P(-0.1, 0.75), P(0.1, 0.75)], [P(-0.1, 0.95), P(0.1, 0.95)]];
    }
    function drawFig() {
      const bones = body(), cl = fig.cloak, flick = glitch > 0 && Math.random() < 0.5 ? 0.6 : 0;
      const solid = Math.max(0, 1 - cl * 1.2) + flick;
      for (const [a, b] of bones) {
        if (solid > 0.03) seg(...a, ...b, C.white, solid, FOG);
        for (let j = 0; j < 3; j++) { // refraction: jittering copies of the outline
          const o = [rand(-0.12, 0.12), rand(-0.12, 0.12), 0];
          seg(a[0] + o[0], a[1] + o[1], a[2], b[0] + o[0], b[1] + o[1], b[2], j ? C.ice : C.violet, 0.12 + 0.3 * cl, FOG);
        }
      }
    }

    return {
      label: 'THERMOPTIC',
      enter() { reset(); },
      signal(kind) { if (kind === 'error') glitch = 1.5; },
      update(dt) {
        pt += dt; glitch = Math.max(0, glitch - dt);
        if (phase === 'stand') { if (pt > 2.5) { phase = 'fall'; pt = 0; } }
        else if (phase === 'fall') {
          fig.tilt = Math.min(1.6, pt * 1.4); fig.z = HW - 0.3 + Math.min(1.8, pt * 1.8);
          vy = Math.max(-30, vy - 9.81 * 0.45 * (1 + env.level * 0.6) * dt); fig.y += vy * dt;
          fig.cloak = Math.min(1, pt / 2.5);
          if (fig.y <= crashY + 1.5) {
            phase = 'crash'; pt = 0;
            for (let i = 0; i < 50; i++) shards.push({ x: rand(-1.6, 1.6), y: crashY + rand(0, FL), z: HW + 0.1, vx: rand(-5, 5), vy: rand(-2, 6), vz: rand(2, 11), ax: rand(-1, 1), ay: rand(-1, 1), t: rand(2, 4) });
          }
        } else if (phase === 'crash') {
          fig.z = Math.max(HW - 4, fig.z - dt * 7); fig.tilt = Math.max(0.3, fig.tilt - dt * 2); fig.y = Math.max(crashY + 0.3, fig.y - dt * 2);
          if (pt > 3) reset();
        }
        for (const s of shards) { s.vy -= 9.81 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.t -= dt; }
        shards = shards.filter((s) => s.t > 0 && s.y > 0);
        const want = phase === 'stand' ? TOP + 3 : phase === 'fall' ? fig.y + 3 : crashY + 4;
        camY += (want - camY) * Math.min(1, dt * (phase === 'fall' ? 6 : 1.5));
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: 7 + Math.sin(t * 0.2), y: camY, z: HW + 10 }, 0, phase === 'stand' ? TOP + 1.2 : fig.y, HW + 1));
        // the city below and beyond
        for (const b of towers) {
          box(b.x, 0, b.z, b.w, b.h, b.d, b.col, 0.6, FOG);
          for (let y = 6; y < b.h; y += 7) seg(b.x - b.w / 2, y, b.z - b.d / 2, b.x + b.w / 2, y, b.z - b.d / 2, b.col, 0.18, FOG);
          if (b.sign) { const y = b.h * b.sy, a = 0.55 + env.pulse * 0.45 * (Math.sin(t * 7 + b.x) > -0.7 ? 1 : 0.2); for (let j = 0; j < 3; j++) seg(b.x - b.w / 2 - 0.3, y + j * 0.7, b.z - b.d / 2 - 0.3, b.x + b.w / 2 + 0.3, y + j * 0.7, b.z - b.d / 2 - 0.3, b.sign, a, FOG); }
        }
        for (const x of CANALS) for (let z = -260; z < 200; z += 6) seg(x, 0.2, z + (t * 3 % 6), x, 0.2, z + 3 + (t * 3 % 6), C.ice, 0.35, FOG);
        for (let x = -220; x < 220; x += 6) seg(x + (t * 2 % 6), 0.2, -90, x + 3 + (t * 2 % 6), 0.2, 110, C.ice, 0.3, FOG);
        // the tower she's on: the face she falls down, floors and lit windows near the camera
        box(0, 0, 0, HW * 2, TOP, HW * 2, C.ice, 0.8, FOG);
        const f0 = Math.max(0, Math.floor((camY - 40) / FL)), f1 = Math.min(TOP / FL, Math.ceil((camY + 30) / FL));
        for (let f = f0; f <= f1; f++) {
          const y = f * FL; seg(-HW, y, HW, HW, y, HW, C.ice, 0.5, FOG); seg(HW, y, -HW, HW, y, HW, C.ice, 0.35, FOG);
          for (let c = 0; c < 4; c++) {
            if (hash(f, c) > 0.35) continue;
            const x0 = -HW + c * 4 + 0.4, x1 = x0 + 3.2, broke = phase === 'crash' && Math.abs(y - crashY) < 1 && c === 1;
            if (broke) continue;
            seg(x0, y + 0.5, HW, x1, y + 0.5, HW, C.gold, 0.5, FOG); seg(x0, y + FL - 0.5, HW, x1, y + FL - 0.5, HW, C.gold, 0.5, FOG);
            seg(x0, y + 0.5, HW, x0, y + FL - 0.5, HW, C.gold, 0.35, FOG); seg(x1, y + 0.5, HW, x1, y + FL - 0.5, HW, C.gold, 0.35, FOG);
          }
        }
        for (let x = -HW; x <= HW; x += 4) seg(x, f0 * FL, HW, x, f1 * FL, HW, C.ice, 0.4, FOG);
        seg(-HW, TOP + 1, HW, HW, TOP + 1, HW, C.ice, 0.8, FOG); // the parapet
        drawFig();
        for (const s of shards) seg(s.x, s.y, s.z, s.x + s.ax * 0.4, s.y + s.ay * 0.4, s.z + 0.2, Math.random() < 0.5 ? C.white : C.ice, Math.min(1, s.t), FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), G = C.neon, m = 22 * s, L = 60 * s;
      g.strokeStyle = `rgba(${G},0.7)`; g.lineWidth = 1.5; g.beginPath();
      for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { g.moveTo(x, y + dy * L); g.lineTo(x, y); g.lineTo(x + dx * L, y); }
      g.stroke();
      // lock-on: brackets on her hip, lost as the camo takes
      const p = toCam(0, fig.y, fig.z);
      if (p[2] > 1) {
        const x = W / 2 + p[0] * k.F / p[2], y = H / 2 - p[1] * k.F / p[2], r = 46 * s, lost = fig.cloak > 0.7 && Math.sin(env.t * 14) > 0;
        const col = fig.cloak > 0.7 ? C.hot : G, a = lost ? 0.25 : 0.9, b = r * 0.4;
        g.strokeStyle = `rgba(${col},${a})`; g.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cx = x + sx * r, cy = y + sy * r; g.moveTo(cx, cy - sy * b); g.lineTo(cx, cy); g.lineTo(cx - sx * b, cy); }
        g.stroke();
        g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${col},${a})`; g.fillText(fig.cloak > 0.7 ? 'TRACK LOST' : 'TARGET LOCK', x + r + 6 * s, y - r);
      }
      g.font = `bold ${15 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${G},0.9)`;
      const lines = [['OPTIC CAMO ' + String(Math.round(fig.cloak * 100)).padStart(3, ' ') + '%'], [`ALT  ${fig.y.toFixed(1).padStart(6, ' ')} M`], [`DESC ${(-vy).toFixed(1).padStart(6, ' ')} M/S`]];
      lines.forEach(([l], i) => g.fillText(l, 40 * s, 48 * s + i * 22 * s));
      const r1 = 'CYBERBRAIN LINK // ACTIVE', r2 = phase === 'crash' ? 'ENTRY: FLOOR ' + String(Math.round(crashY / FL)).padStart(2, '0') : 'HARBOUR DISTRICT // 0' + Math.floor(2 + env.t % 7) + ':1' + Math.floor(env.t / 10 % 6);
      g.fillText(r1, W - 40 * s - g.measureText(r1).width, 48 * s); g.fillText(r2, W - 40 * s - g.measureText(r2).width, 70 * s);
      // depth ladder, bottom right
      const x0 = W - 60 * s, yt = H - 300 * s, yb = H - 60 * s;
      g.strokeStyle = `rgba(${G},0.5)`; g.beginPath(); g.moveTo(x0, yt); g.lineTo(x0, yb);
      for (let i = 0; i <= 12; i++) { const y = yt + (yb - yt) * i / 12; g.moveTo(x0, y); g.lineTo(x0 - (i % 3 ? 6 : 12) * s, y); }
      g.stroke();
      const my = yb - (yb - yt) * Math.max(0, fig.y) / TOP; g.fillStyle = `rgba(${C.hot},0.95)`; g.fillRect(x0 - 22 * s, my - 2 * s, 18 * s, 4 * s);
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${G},0.8)`; g.fillText('DEPTH', x0 - 34 * s, yt - 10 * s);
      if (glitch > 0) { g.fillStyle = `rgba(${C.hot},0.9)`; g.fillText('CAMO FAULT', 40 * s, H - 48 * s); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
