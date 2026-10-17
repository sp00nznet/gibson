// The worlds behind the terminal. Everything is line segments through one
// perspective projector, drawn additively over a fading canvas so motion leaves
// trails. A world is { enter(), update(dt, e), draw(e) }; NYX picks which one.
(function (root) {
  const C = { neon: '57,255,156', hot: '255,46,136', ice: '54,214,255', gold: '255,196,72', violet: '168,96,255', white: '230,240,255' };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const HEX = '0123456789ABCDEF';
  const hex = (n) => Array.from({ length: n }, () => pick(HEX)).join('');

  let cv, g, W = 0, H = 0, F = 1;
  let cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, cy = 1, sy = 0, cp = 1, sp = 0;
  const batches = new Map();

  function setCam(c) { cam = c; cy = Math.cos(c.yaw); sy = Math.sin(c.yaw); cp = Math.cos(c.pitch); sp = Math.sin(c.pitch); }
  function lookAt(c, tx, ty, tz) { const dx = tx - c.x, dy = ty - c.y, dz = tz - c.z; c.yaw = Math.atan2(dx, dz); c.pitch = Math.atan2(dy, Math.hypot(dx, dz)); return c; }
  function toCam(x, y, z) {
    x -= cam.x; y -= cam.y; z -= cam.z;
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    return [x1, y2, z2];
  }
  const NEAR = 0.3;
  // A segment in world space. fog: distance where it fades out.
  function seg(ax, ay, az, bx, by, bz, col, a, fog) {
    let p = toCam(ax, ay, az), q = toCam(bx, by, bz);
    if (p[2] < NEAR && q[2] < NEAR) return;
    if (p[2] < NEAR) { const t = (NEAR - p[2]) / (q[2] - p[2]); p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, NEAR]; }
    if (q[2] < NEAR) { const t = (NEAR - q[2]) / (p[2] - q[2]); q = [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t, NEAR]; }
    const d = (p[2] + q[2]) / 2, f = fog || 140;
    const al = (a == null ? 1 : a) * Math.max(0, 1 - d / f);
    if (al < 0.03) return;
    line2(W / 2 + p[0] * F / p[2], H / 2 - p[1] * F / p[2], W / 2 + q[0] * F / q[2], H / 2 - q[1] * F / q[2], col, al);
  }
  function line2(x1, y1, x2, y2, col, al) {
    const key = col + ',' + Math.min(1, Math.round(al * 5) / 5 * env.bright).toFixed(2);
    let b = batches.get(key); if (!b) batches.set(key, (b = []));
    b.push(x1, y1, x2, y2);
  }
  function flush() {
    for (const [key, b] of batches) {
      g.strokeStyle = `rgba(${key})`; g.beginPath();
      for (let i = 0; i < b.length; i += 4) { g.moveTo(b[i], b[i + 1]); g.lineTo(b[i + 2], b[i + 3]); }
      g.stroke();
    }
    batches.clear();
  }
  function text3(s, x, y, z, col, size, al) {
    const p = toCam(x, y, z); if (p[2] < 1) return;
    const px = size * F / p[2]; if (px < 6) return;
    g.fillStyle = `rgba(${col},${(al || 1) * Math.max(0, 1 - p[2] / 160)})`;
    g.font = `${Math.min(px, 40) | 0}px 'Cascadia Mono', Consolas, monospace`;
    g.fillText(s, W / 2 + p[0] * F / p[2], H / 2 - p[1] * F / p[2]);
  }
  function box(x, y, z, w, h, d, col, a, fog) {
    const X = [x - w / 2, x + w / 2], Z = [z - d / 2, z + d / 2], Y = [y, y + h];
    for (const yy of Y) { seg(X[0], yy, Z[0], X[1], yy, Z[0], col, a, fog); seg(X[1], yy, Z[0], X[1], yy, Z[1], col, a, fog); seg(X[1], yy, Z[1], X[0], yy, Z[1], col, a, fog); seg(X[0], yy, Z[1], X[0], yy, Z[0], col, a, fog); }
    for (const xx of X) for (const zz of Z) seg(xx, Y[0], zz, xx, Y[1], zz, col, a, fog);
  }
  // Arrowhead craft in the zero-set mould: nose +z.
  const SHIP_V = [[0, 0, 2.2], [-1.4, 0, -1], [1.4, 0, -1], [0, 0.45, -0.7], [0, -0.2, -0.9], [-0.5, 0.1, -1.1], [0.5, 0.1, -1.1]];
  const SHIP_E = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [0, 4], [1, 4], [2, 4], [5, 6], [3, 5], [3, 6]];
  function ship(x, y, z, heading, scale, col, a, roll) {
    const ch = Math.cos(heading), sh = Math.sin(heading), cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    const P = SHIP_V.map(([vx, vy, vz]) => { const rx = vx * cr - vy * sr, ry = vx * sr + vy * cr; return [x + (rx * ch + vz * sh) * scale, y + ry * scale, z + (-rx * sh + vz * ch) * scale]; });
    for (const [i, j] of SHIP_E) seg(P[i][0], P[i][1], P[i][2], P[j][0], P[j][1], P[j][2], col, a);
  }

  // --- shared layers ---------------------------------------------------------
  const stars = Array.from({ length: 360 }, () => [rand(-90, 90), rand(-60, 60), rand(1, 160)]);
  let flyby = null, flyT = 3, packets = [];
  function sharedLayers(dt) {
    setCam({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    const sp = env.speed;
    for (const s of stars) {
      s[2] -= sp * dt; if (s[2] < 1) { s[0] = rand(-90, 90); s[1] = rand(-60, 60); s[2] = 160; }
      seg(s[0], s[1], s[2], s[0], s[1], s[2] + 0.4 + sp * 0.04, C.white, 0.7, 170);
    }
    flyT -= dt;
    if (!flyby && flyT < 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      flyby = { x: -60 * dir, y: rand(-12, 14), z: rand(18, 50), vx: dir * rand(30, 60), col: pick([C.ice, C.hot, C.gold, C.neon]), n: Math.random() < 0.3 ? 3 : 1 };
    }
    if (flyby) {
      flyby.x += flyby.vx * dt;
      for (let k = 0; k < flyby.n; k++) {
        const ox = -Math.sign(flyby.vx) * k * 5, oy = k * 1.6;
        ship(flyby.x + ox, flyby.y + oy, flyby.z + k * 2, Math.sign(flyby.vx) * Math.PI / 2, 1.6, flyby.col, 0.9, Math.sin(env.t * 2) * 0.3);
        seg(flyby.x + ox, flyby.y + oy, flyby.z + k * 2, flyby.x + ox - flyby.vx * 0.5, flyby.y + oy, flyby.z + k * 2, flyby.col, 0.35);
      }
      if (Math.abs(flyby.x) > 70) { flyby = null; flyT = rand(3, 9) / (0.5 + env.level); }
    }
    // data packets zipping across the margins, in screen space
    if (Math.random() < dt * (1.5 + env.level * 10)) packets.push({ x: Math.random() < 0.5 ? -200 : W + 200, y: rand(0, H), v: 0, s: `${hex(4)}:${hex(4)} >> ${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.0.${(Math.random() * 255) | 0}`, col: pick([C.neon, C.ice, C.hot]) });
    g.font = "11px 'Cascadia Mono', Consolas, monospace";
    for (const p of packets) {
      if (!p.v) p.v = (p.x < 0 ? 1 : -1) * rand(500, 1400) * (0.6 + env.level);
      p.x += p.v * dt;
      line2(p.x, p.y, p.x - p.v * 0.08, p.y, p.col, 0.8);
      g.fillStyle = `rgba(${p.col},0.7)`; g.fillText(p.s, p.x + (p.v > 0 ? 6 : -6 - g.measureText(p.s).width), p.y + 4);
    }
    packets = packets.filter((p) => p.x > -400 && p.x < W + 400);
  }

  // --- worlds ----------------------------------------------------------------
  const worlds = {};

  worlds.grid = (() => {
    let off = 0; const ridge = Array.from({ length: 61 }, (_, i) => Math.abs(Math.sin(i * 0.7) * 9 + Math.sin(i * 0.23) * 7 + Math.random() * 3));
    return {
      label: 'THE GRID',
      update(dt) { off += env.speed * dt * 0.6; },
      draw() {
        setCam({ x: 0, y: 2.2, z: 0, yaw: Math.sin(env.t * 0.1) * 0.05, pitch: -0.06 });
        for (let x = -60; x <= 60; x += 3) seg(x, 0, 1, x, 0, 130, C.hot, 0.8);
        for (let z = 4 - (off % 4); z < 130; z += 4) seg(-60, 0, z, 60, 0, z, C.hot, 0.8);
        for (let i = 0; i < ridge.length - 1; i++) {
          const x0 = -120 + i * 4, x1 = x0 + 4;
          seg(x0, ridge[i], 118, x1, ridge[i + 1], 118, C.violet, 1, 400);
          if (i % 2 === 0) seg(x0, 0, 118, x0, ridge[i], 118, C.violet, 0.5, 400);
        }
        // the sun: horizontal bars, gaps widening toward the horizon
        const p = toCam(0, 22, 125); const sx = W / 2 + p[0] * F / p[2], syy = H / 2 - p[1] * F / p[2], r = 18 * F / p[2];
        for (let k = -r; k < r; k += 3) {
          const gap = k > 0 ? (k / r) * 6 : 0; if (k > 0 && (k % 9) < gap) continue;
          const w = Math.sqrt(r * r - k * k);
          line2(sx - w, syy + k, sx + w, syy + k, k < 0 ? C.gold : C.hot, 0.9);
        }
      },
    };
  })();

  worlds.city = (() => {
    const L = 160, blds = [];
    for (let z = 0; z < L; z += 9) for (const side of [-1, 1]) for (let row = 0; row < 3; row++)
      blds.push({ x: side * (9 + row * 9 + rand(0, 2)), z: z + rand(0, 3), w: rand(4, 7), d: rand(4, 7), h: rand(6, 26) * (1 + row * 0.6), col: pick([C.ice, C.ice, C.neon, C.violet]) });
    const cars = Array.from({ length: 26 }, () => ({ x: rand(-5, 5), y: rand(6, 30), z: rand(0, L), v: rand(-40, 40) }));
    let off = 0;
    return {
      label: 'NEON CITY',
      update(dt) { off += env.speed * dt * 0.5; for (const c of cars) c.z = (c.z + c.v * dt + L) % L; },
      draw() {
        setCam({ x: Math.sin(env.t * 0.3) * 1.5, y: 9 + Math.sin(env.t * 0.21) * 2, z: 0, yaw: Math.sin(env.t * 0.13) * 0.12, pitch: 0.05 });
        for (const b of blds) {
          const z = ((b.z - off) % L + L) % L;
          box(b.x, 0, z, b.w, b.h, b.d, b.col, 0.85, 150);
          for (let wy = 3; wy < b.h; wy += 3) seg(b.x - b.w / 2, wy, z - b.d / 2, b.x + b.w / 2, wy, z - b.d / 2, b.col, 0.25, 110);
          if (b.h > 40) text3(hex(2), b.x, b.h + 1, z, C.hot, 1.4, 0.8);
        }
        for (let x = -40; x <= 40; x += 5) seg(x, 0, 1, x, 0, 150, C.neon, 0.3);
        for (let z = 5 - (off % 5); z < 150; z += 5) seg(-40, 0, z, 40, 0, z, C.neon, 0.3);
        for (const c of cars) seg(c.x, c.y, c.z, c.x, c.y, c.z - c.v * 0.1, c.v > 0 ? C.gold : C.hot, 1);
      },
    };
  })();

  worlds.files = (() => {
    let towers = [], cwd = '', flow = [], builtFrom;
    function build(fs) {
      const ents = fs && fs.entries && fs.entries.length ? fs.entries : ['SYSTEM32', 'GARBAGE.DAT', 'DAVINCI.EXE', 'ZERO.COOL', 'ACID.BURN', 'PLAGUE.LOG', 'KERNEL.SYS'].map((n, i) => ({ name: n, dir: i % 3 === 0, size: 1 << (10 + i * 2) }));
      builtFrom = fs; cwd = (fs && fs.cwd) || 'C:\\GIBSON';
      const n = ents.length, cols = Math.ceil(Math.sqrt(n)), sp = 7;
      towers = ents.map((e, i) => ({
        name: e.name.length > 18 ? e.name.slice(0, 17) + '~' : e.name, dir: e.dir,
        x: ((i % cols) - (cols - 1) / 2) * sp, z: (Math.floor(i / cols) - (cols - 1) / 2) * sp,
        h: e.dir ? rand(14, 22) : 2 + Math.log2(e.size + 2) * 0.9,
      }));
      flow = [];
    }
    return {
      label: 'FILESYSTEM',
      enter() { build(env.fs); },
      refresh() { build(env.fs); },
      update(dt) {
        if (env.fs !== builtFrom) build(env.fs);
        if (towers.length > 1 && Math.random() < dt * (2 + env.level * 12)) { const a = pick(towers), b = pick(towers); flow.push({ a, b, t: 0 }); }
        for (const f of flow) f.t += dt * (0.6 + env.level);
        flow = flow.filter((f) => f.t < 1);
      },
      draw() {
        const span = Math.sqrt(towers.length) * 7, r = span * 0.75 + 16 - env.warp * 8, a = env.t * 0.06;
        setCam(lookAt({ x: Math.sin(a) * r, y: 14 + Math.sin(env.t * 0.17) * 4, z: Math.cos(a) * r }, 0, 4, 0));
        for (let x = -span; x <= span; x += 3.5) seg(x, 0, -span, x, 0, span, C.neon, 0.18, 220);
        for (let z = -span; z <= span; z += 3.5) seg(-span, 0, z, span, 0, z, C.neon, 0.18, 220);
        for (const t of towers) {
          const col = t.dir ? C.ice : C.hot;
          box(t.x, 0, t.z, 3, t.h, 3, col, 0.95, 220);
          for (let y = 2; y < t.h; y += 2) seg(t.x - 1.5, y, t.z + 1.5, t.x + 1.5, y, t.z + 1.5, col, 0.22, 160);
          text3(t.name, t.x - 1.5, t.h + 1.2, t.z, col, 1.1);
        }
        for (const f of flow) {
          const k = f.t, mx = f.a.x + (f.b.x - f.a.x) * Math.min(1, k * 2), mz = k < 0.5 ? f.a.z : f.a.z + (f.b.z - f.a.z) * (k - 0.5) * 2;
          seg(mx, 0.3, mz, mx, 2.3, mz, C.gold, 1, 220);
        }
        text3(cwd, -span * 0.5, 0.2, -span - 4, C.neon, 2.2, 0.8);
      },
    };
  })();

  worlds.battle = (() => {
    const ships = [], lasers = [], booms = [];
    function spawn(team) { return { team, x: team ? 70 : -70, y: rand(-12, 14), z: rand(14, 60), v: rand(8, 18) * (team ? -1 : 1), cd: rand(0.2, 2) }; }
    for (let i = 0; i < 26; i++) { const s = spawn(i % 2); s.x = rand(-60, 60); ships.push(s); }
    let cap = -140;
    return {
      label: 'DEEP SPACE',
      update(dt) {
        const k = 0.5 + env.level * 1.5; cap += dt * 4;
        if (cap > 160) cap = -160;
        for (let i = 0; i < ships.length; i++) {
          const s = ships[i]; s.x += s.v * dt * k; s.cd -= dt * k;
          if (s.cd < 0) {
            s.cd = rand(0.6, 2.4); const foes = ships.filter((o) => o.team !== s.team && Math.abs(o.x - s.x) < 60);
            if (foes.length) {
              const o = pick(foes); lasers.push({ a: [s.x, s.y, s.z], b: [o.x, o.y, o.z], life: 0.18, col: s.team ? C.hot : C.neon });
              if (Math.random() < 0.18) { booms.push({ x: o.x, y: o.y, z: o.z, t: 0 }); ships[ships.indexOf(o)] = spawn(o.team); }
            }
          }
          if (Math.abs(s.x) > 75) ships[i] = spawn(s.team);
        }
        for (const l of lasers) l.life -= dt; for (const b of booms) b.t += dt;
        lasers.splice(0, lasers.length, ...lasers.filter((l) => l.life > 0));
        booms.splice(0, booms.length, ...booms.filter((b) => b.t < 1.2));
      },
      draw() {
        setCam({ x: 0, y: 2, z: 0, yaw: Math.sin(env.t * 0.07) * 0.35, pitch: Math.sin(env.t * 0.05) * 0.08 });
        // capital ship sliding past in the back
        const cz = 120; box(cap, -6, cz, 70, 9, 14, C.violet, 0.8, 300); box(cap + 30, 3, cz, 12, 6, 8, C.violet, 0.8, 300);
        for (let i = -30; i < 30; i += 5) seg(cap + i, -6, cz - 7, cap + i + 2, 3, cz - 7, C.violet, 0.4, 300);
        for (const s of ships) ship(s.x, s.y, s.z, s.v > 0 ? Math.PI / 2 : -Math.PI / 2, 1.8, s.team ? C.hot : C.neon, 1, Math.sin(env.t + s.z) * 0.4);
        for (const l of lasers) seg(...l.a, ...l.b, l.col, Math.min(1, l.life * 8), 200);
        for (const b of booms) {
          const r = b.t * 9;
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, e = i * 1.7; seg(b.x + Math.cos(a) * r * 0.4, b.y + Math.sin(a) * r * 0.4, b.z + Math.sin(e) * r * 0.3, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, b.z + Math.sin(e) * r * 0.7, C.gold, 1 - b.t / 1.2, 200); }
        }
      },
    };
  })();

  worlds.planet = (() => {
    let rot = 0; const orbit = Array.from({ length: 5 }, (_, i) => ({ r: 30 + i * 4, s: rand(0.2, 0.6) * (i % 2 ? 1 : -1), p: rand(0, 6), tilt: rand(-0.5, 0.5) }));
    return {
      label: 'ORBIT',
      update(dt) { rot += dt * (0.08 + env.level * 0.4); },
      draw() {
        const P = [0, 0, 70];
        setCam({ x: Math.sin(env.t * 0.05) * 8, y: 6, z: 0, yaw: Math.sin(env.t * 0.05) * -0.1, pitch: -0.06 });
        const R = 20;
        for (let la = -75; la <= 75; la += 15) {
          const y = Math.sin(la * Math.PI / 180) * R, rr = Math.cos(la * Math.PI / 180) * R;
          for (let i = 0; i < 36; i++) { const a0 = i / 36 * Math.PI * 2, a1 = (i + 1) / 36 * Math.PI * 2; seg(P[0] + Math.cos(a0) * rr, P[1] + y, P[2] + Math.sin(a0) * rr, P[0] + Math.cos(a1) * rr, P[1] + y, P[2] + Math.sin(a1) * rr, C.ice, 0.8, 200); }
        }
        for (let lo = 0; lo < 12; lo++) {
          const a = lo / 12 * Math.PI * 2 + rot;
          for (let i = 0; i < 18; i++) {
            const b0 = -Math.PI / 2 + i / 18 * Math.PI, b1 = -Math.PI / 2 + (i + 1) / 18 * Math.PI;
            seg(P[0] + Math.cos(b0) * Math.cos(a) * R, P[1] + Math.sin(b0) * R, P[2] + Math.cos(b0) * Math.sin(a) * R, P[0] + Math.cos(b1) * Math.cos(a) * R, P[1] + Math.sin(b1) * R, P[2] + Math.cos(b1) * Math.sin(a) * R, C.ice, 0.55, 200);
          }
        }
        for (const r of [28, 31, 33]) for (let i = 0; i < 72; i++) {
          const a0 = i / 72 * Math.PI * 2, a1 = (i + 1) / 72 * Math.PI * 2;
          seg(P[0] + Math.cos(a0) * r, P[1] + Math.sin(a0) * r * 0.18, P[2] + Math.sin(a0) * r * 0.5, P[0] + Math.cos(a1) * r, P[1] + Math.sin(a1) * r * 0.18, P[2] + Math.sin(a1) * r * 0.5, C.gold, 0.5, 200);
        }
        for (const o of orbit) {
          const a = env.t * o.s + o.p, x = P[0] + Math.cos(a) * o.r, z = P[2] + Math.sin(a) * o.r * 0.6, y = P[1] + Math.sin(a) * o.r * o.tilt;
          ship(x, y, z, a + (o.s > 0 ? Math.PI : 0), 1.2, C.hot, 1);
        }
      },
    };
  })();

  worlds.tunnel = (() => {
    let z0 = 0; const glyphs = [];
    const cx = (z) => Math.sin(z * 0.045) * 7, cyf = (z) => Math.cos(z * 0.031) * 5;
    return {
      label: 'DATASTREAM',
      update(dt) {
        z0 += (25 + env.level * 90) * dt;
        if (Math.random() < dt * 14) glyphs.push({ z: z0 + 120, a: rand(0, Math.PI * 2), s: hex(6), col: pick([C.neon, C.ice, C.hot]) });
        while (glyphs.length && glyphs[0].z < z0) glyphs.shift();
      },
      draw() {
        const ahead = z0 + 6;
        setCam(lookAt({ x: cx(z0), y: cyf(z0), z: z0 }, cx(ahead), cyf(ahead), ahead));
        const R = 7, N = 14, step = 4, base = Math.floor(z0 / step) * step;
        let prev = null;
        for (let z = base; z < z0 + 130; z += step) {
          const pts = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pts.push([cx(z) + Math.cos(a) * R, cyf(z) + Math.sin(a) * R, z]); }
          const col = (Math.floor(z / step) % 8 === 0) ? C.hot : C.neon;
          for (let i = 0; i < N; i++) { const p = pts[i], q = pts[(i + 1) % N]; seg(...p, ...q, col, 0.9, 130); if (prev) seg(...p, ...prev[i], C.neon, 0.4, 130); }
          prev = pts;
        }
        for (const gl of glyphs) text3(gl.s, cx(gl.z) + Math.cos(gl.a) * R * 0.9, cyf(gl.z) + Math.sin(gl.a) * R * 0.9, gl.z, gl.col, 0.9);
      },
    };
  })();

  // --- engine ----------------------------------------------------------------
  const env = { t: 0, speed: 10, level: 0, pulse: 0, warp: 0, bright: 1, fs: null };
  let cur = 'grid', prev = null, trans = 1, last = 0, source = () => ({});

  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; F = H * 0.9; }
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    Object.assign(env, source(dt));
    env.t += dt; env.speed = 8 + env.level * 70 + env.warp * 60;
    env.bright = 0.75 + env.pulse * 0.25;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(0,0,0,${0.28 + (1 - env.level) * 0.25})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.5;
    sharedLayers(dt); flush();
    if (trans < 1 && prev) {
      trans = Math.min(1, trans + dt * 1.6);
      worlds[prev].update(dt); g.globalAlpha = 1 - trans; worlds[prev].draw(); flush();
    }
    worlds[cur].update(dt); g.globalAlpha = trans; worlds[cur].draw(); flush(); g.globalAlpha = 1;
    if (trans < 1) { // glitch slices during the crossing
      for (let i = 0; i < 6; i++) { const y = Math.random() * H, h = rand(4, 30); g.drawImage(cv, 0, y, W, h, rand(-40, 40), y, W, h); }
    }
    requestAnimationFrame(frame);
  }

  root.Worlds = {
    names: Object.keys(worlds),
    label: (name) => worlds[name || cur].label,
    current: () => cur,
    go(name) {
      if (!worlds[name] || name === cur) return;
      prev = cur; cur = name; trans = 0; if (worlds[cur].enter) worlds[cur].enter();
    },
    refreshFiles() { if (worlds.files.refresh && cur === 'files') worlds.files.refresh(); },
    start(canvas, src) { cv = canvas; g = cv.getContext('2d'); source = src; resize(); addEventListener('resize', resize); requestAnimationFrame(frame); },
  };
})(this);
