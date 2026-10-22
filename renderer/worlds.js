// The worlds behind the terminal. Everything is line segments through one
// perspective projector, drawn additively over a fading canvas so motion leaves
// trails. A world is { label, update(dt), draw(), enter?(), signal?(kind) }; NYX picks which one.
// More worlds live in renderer/worlds/*.js and register with Worlds.define(name, kit => world).
(function (root) {
  const C = { neon: '57,255,156', hot: '255,46,136', ice: '54,214,255', gold: '255,196,72', violet: '168,96,255', white: '230,240,255' };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const HEX = '0123456789ABCDEF';
  const hex = (n) => Array.from({ length: n }, () => pick(HEX)).join('');

  let cv, g, W = 0, H = 0, F = 1;
  let cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, cy = 1, sy = 0, cp = 1, sp = 0, cr = 1, sr = 0;
  const batches = new Map();

  function setCam(c) { cam = c; cy = Math.cos(c.yaw); sy = Math.sin(c.yaw); cp = Math.cos(c.pitch); sp = Math.sin(c.pitch); cr = Math.cos(c.roll || 0); sr = Math.sin(c.roll || 0); }
  function lookAt(c, tx, ty, tz) { const dx = tx - c.x, dy = ty - c.y, dz = tz - c.z; c.yaw = Math.atan2(dx, dz); c.pitch = Math.atan2(dy, Math.hypot(dx, dz)); return c; }
  function toCam(x, y, z) {
    x -= cam.x; y -= cam.y; z -= cam.z;
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    return sr ? [x1 * cr - y2 * sr, x1 * sr + y2 * cr, z2] : [x1, y2, z2]; // roll: the anti-grav worlds lean
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
    // Trim to a margin round the screen: a line through the camera can project millions of
    // pixels long, and Chrome's canvas crawls stroking those.
    const x0 = -W, x9 = 2 * W, y0 = -H, y9 = 2 * H;
    if (x1 < x0 || x1 > x9 || y1 < y0 || y1 > y9 || x2 < x0 || x2 > x9 || y2 < y0 || y2 > y9) {
      const dx = x2 - x1, dy = y2 - y1; let t0 = 0, t1 = 1;
      for (const [p, q] of [[-dx, x1 - x0], [dx, x9 - x1], [-dy, y1 - y0], [dy, y9 - y1]]) {
        if (p === 0) { if (q < 0) return; continue; }
        const r = q / p; if (p < 0) { if (r > t1) return; if (r > t0) t0 = r; } else { if (r < t0) return; if (r < t1) t1 = r; }
      }
      [x1, y1, x2, y2] = [x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1];
    }
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
    if (!flyby && flyT < 0 && env.ships !== false) {
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
    if (env.packets !== false && Math.random() < dt * (1.5 + env.level * 10)) packets.push({ x: Math.random() < 0.5 ? -200 : W + 200, y: rand(0, H), v: 0, s: `${hex(4)}:${hex(4)} >> ${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.0.${(Math.random() * 255) | 0}`, col: pick([C.neon, C.ice, C.hot]) });
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

  const ring = (x, y, z, r, n, col, a, fog, plane) => { // plane 'xz' (flat) or 'xy' (facing the camera)
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      if (plane === 'xy') seg(x + Math.cos(a0) * r, y + Math.sin(a0) * r, z, x + Math.cos(a1) * r, y + Math.sin(a1) * r, z, col, a, fog);
      else seg(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, col, a, fog);
    }
  };

  // The mainframe from the film: a ring of towers around a pulsing core, data climbing the columns.
  worlds.core = (() => {
    const N = 14, R = 34, towers = Array.from({ length: N }, (_, i) => ({ a: i / N * Math.PI * 2, h: rand(34, 58) }));
    let climb = [];
    return {
      label: 'GIBSON CORE',
      update(dt) {
        if (Math.random() < dt * (6 + env.level * 30)) climb.push({ t: pick(towers), y: 0, v: rand(12, 34), col: pick([C.gold, C.hot, C.neon]) });
        for (const c of climb) c.y += c.v * dt;
        climb = climb.filter((c) => c.y < c.t.h);
      },
      draw() {
        const a = env.t * 0.08;
        setCam(lookAt({ x: Math.sin(a) * 66, y: 16 + Math.sin(env.t * 0.1) * 6, z: Math.cos(a) * 66 }, 0, 22, 0));
        for (let r = 8; r <= 48; r += 8) ring(0, 0, 0, r, 48, C.violet, 0.35, 220);
        for (let i = 0; i < 24; i++) { const s = i / 24 * Math.PI * 2; seg(Math.cos(s) * 8, 0, Math.sin(s) * 8, Math.cos(s) * 48, 0, Math.sin(s) * 48, C.violet, 0.2, 220); }
        towers.forEach((t, i) => {
          const x = Math.cos(t.a) * R, z = Math.sin(t.a) * R;
          box(x, 0, z, 5, t.h, 5, C.ice, 0.9, 200);
          for (let y = 3; y < t.h; y += 3) {
            seg(x - 2.5, y, z - 2.5, x + 2.5, y, z - 2.5, C.ice, 0.18, 200); seg(x - 2.5, y, z + 2.5, x + 2.5, y, z + 2.5, C.ice, 0.18, 200);
            if (Math.sin(i * 13.7 + y * 3.1 + env.t * 3) > 0.75) seg(x - 1.5, y + 1, z - 2.6, x + 1.5, y + 1, z - 2.6, C.gold, 1, 200);
          }
          if (Math.sin(env.t * 2 + i * 1.9) > 0.92) seg(0, 52, 0, x, t.h, z, C.hot, 0.7, 200); // the core talking to a tower
        });
        const spin = env.t * 0.6, glow = 0.5 + env.pulse * 0.5;
        for (let i = 0; i < 16; i++) { const s = i / 16 * Math.PI * 2 + spin; seg(Math.cos(s) * 4, 0, Math.sin(s) * 4, Math.cos(s) * 4, 52, Math.sin(s) * 4, C.hot, glow, 200); }
        for (let y = 0; y <= 52; y += 4) ring(0, y, 0, 4 + env.pulse * 0.8, 16, C.hot, glow, 200);
        for (let k = 0; k < 60; k++) { const s0 = k * 0.35 + spin * 2, s1 = (k + 1) * 0.35 + spin * 2; seg(Math.cos(s0) * 2, k * 0.85, Math.sin(s0) * 2, Math.cos(s1) * 2, (k + 1) * 0.85, Math.sin(s1) * 2, C.gold, 0.8, 200); }
        for (const c of climb) { const x = Math.cos(c.t.a) * (R - 2.6), z = Math.sin(c.t.a) * (R - 2.6); seg(x, c.y, z, x, c.y + 3, z, c.col, 1, 200); }
      },
    };
  })();

  // A 90s board floating in space: main menu, who's online, the file area, a download crawling along.
  worlds.bbs = (() => {
    const HANDLES = ['ZERO COOL', 'ACID BURN', 'CEREAL KILLER', 'LORD NIKON', 'PHANTOM PHREAK', 'THE PLAGUE', 'RAZOR', 'BLADE', 'CRASH OVERRIDE'];
    const panels = [
      { x: -13, y: 9, z: 40, w: 26, h: 15, col: C.neon, title: 'THE GIBSON BBS :: NODE 1 :: 14400 BAUD',
        lines: ['[M] MESSAGE BASES      (42 NEW)', '[F] FILE AREAS         0DAY / WAREZ', '[D] DOORS: L.O.R.D.  TRADEWARS 2002', '[W] WHO IS ONLINE', '[C] CHAT WITH SYSOP    (NYX IS IN)', '[G] GOODBYE / LOGOFF'], menu: true },
      { x: -70, y: 16, z: 72, w: 23, h: 21, col: C.ice, title: 'WHO IS ONLINE', lines: HANDLES.map((h, i) => `${String(i + 1).padStart(2)} ${h.padEnd(15)} ${pick(['2400', '9600', '14400', '28800', '33600'])}`) },
      { x: 47, y: 16, z: 72, w: 23, h: 16, col: C.gold, title: 'FILE AREA 7: 0DAY',
        lines: ['GARBAGE.DAT      48K  ****', 'DAVINCI.ZIP     1.4M  *****', 'WORM.EXE         22K  ***', 'PHRACK47.TXT     96K  *****', 'ACIDBURN.NFO      3K  **', 'RATIO 1:3 // UL MORE, LEECH'] },
    ];
    let sel = 0, selT = 0, dl = 0, chat = 0;
    const tick = '  ::  SYSOP: NYX  ::  NO LAMERS  ::  CALL BACK AFTER 11PM  ::  GREETZ TO EVERYONE AT THE 2600 MEETING  ';
    return {
      label: 'BBS LOBBY',
      update(dt) {
        selT += dt; if (selT > 1.4) { selT = 0; sel = (sel + 1) % panels[0].lines.length; }
        dl = (dl + dt * (0.05 + env.level * 0.2)) % 1.15; chat += dt * 6;
      },
      draw() {
        setCam({ x: Math.sin(env.t * 0.15) * 6, y: 4 + Math.sin(env.t * 0.1) * 2, z: -4 + Math.sin(env.t * 0.07) * 4, yaw: Math.sin(env.t * 0.15) * -0.07, pitch: 0.03 });
        for (let x = -80; x <= 80; x += 8) seg(x, -14, 10, x, -14, 150, C.violet, 0.25, 160);
        for (let z = 10; z <= 150; z += 8) seg(-80, -14, z, 80, -14, z, C.violet, 0.25, 160);
        for (const p of panels) {
          const fr = (o) => { seg(p.x - o, p.y + o, p.z, p.x + p.w + o, p.y + o, p.z, p.col, 0.9, 200); seg(p.x + p.w + o, p.y + o, p.z, p.x + p.w + o, p.y - p.h - o, p.z, p.col, 0.9, 200); seg(p.x + p.w + o, p.y - p.h - o, p.z, p.x - o, p.y - p.h - o, p.z, p.col, 0.9, 200); seg(p.x - o, p.y - p.h - o, p.z, p.x - o, p.y + o, p.z, p.col, 0.9, 200); };
          fr(0); fr(0.5);
          seg(p.x, p.y - 2.2, p.z, p.x + p.w, p.y - 2.2, p.z, p.col, 0.6, 200);
          text3(p.title, p.x + 0.8, p.y - 1.5, p.z, C.white, 1.0);
          p.lines.forEach((l, i) => {
            const y = p.y - 4 - i * 1.8;
            if (p.menu && i === sel) { seg(p.x + 0.4, y + 1.2, p.z, p.x + p.w - 0.4, y + 1.2, p.z, C.hot, 0.8, 200); seg(p.x + 0.4, y - 0.5, p.z, p.x + p.w - 0.4, y - 0.5, p.z, C.hot, 0.8, 200); }
            text3(l, p.x + 1, y, p.z, p.menu && i === sel ? C.hot : p.col, 0.95);
          });
        }
        const m = panels[0], ty = m.y - m.h + 1;
        const k = Math.floor(chat) % tick.length; text3((tick + tick).slice(k, k + 38), m.x + 1, ty, m.z, C.violet, 0.9);
        // the download that never quite finishes
        const bx = -14, by = -8, bz = 48, bw = 28, f = Math.min(1, dl);
        seg(bx, by, bz, bx + bw, by, bz, C.neon, 0.9); seg(bx, by - 1.6, bz, bx + bw, by - 1.6, bz, C.neon, 0.9);
        seg(bx, by, bz, bx, by - 1.6, bz, C.neon, 0.9); seg(bx + bw, by, bz, bx + bw, by - 1.6, bz, C.neon, 0.9);
        for (let x = bx + 0.4; x < bx + bw * f; x += 0.6) seg(x, by - 0.3, bz, x, by - 1.3, bz, C.neon, 0.8);
        text3(`ZMODEM  GARBAGE.DAT  ${Math.round(f * 100)}%  ${(1.2 + env.level * 2.4).toFixed(1)} KB/s  CPS`, bx, by + 1.2, bz, C.neon, 0.9);
      },
    };
  })();

  // A warehouse party: trusses, speaker stacks pumping on the kick, laser fans, a crowd bouncing.
  worlds.rave = (() => {
    const crowd = Array.from({ length: 80 }, () => ({ x: rand(-22, 22), z: rand(6, 32), h: rand(1.5, 2.1), ph: rand(0, 6) }));
    const emit = Array.from({ length: 7 }, (_, i) => ({ x: -18 + i * 6, ph: i * 0.9, col: [C.neon, C.hot, C.ice, C.gold, C.violet, C.hot, C.neon][i] }));
    return {
      label: 'RAVE WAREHOUSE',
      update() {},
      draw() {
        const kick = env.pulse, Wd = 26, D = 56, Hh = 16;
        setCam(lookAt({ x: Math.sin(env.t * 0.2) * 5, y: 5 + kick * 0.4, z: -8 }, 0, 5, 34));
        for (let z = 0; z <= D; z += 7) {
          seg(-Wd, 0, z, -Wd, Hh, z, C.violet, 0.35, 200); seg(Wd, 0, z, Wd, Hh, z, C.violet, 0.35, 200);
          seg(-Wd, Hh, z, 0, Hh + 5, z, C.violet, 0.35, 200); seg(0, Hh + 5, z, Wd, Hh, z, C.violet, 0.35, 200);
          seg(-Wd, Hh, z, Wd, Hh, z, C.violet, 0.2, 200);
        }
        for (const x of [-Wd, Wd]) for (const y of [0, Hh]) seg(x, y, 0, x, y, D, C.violet, 0.35, 200);
        seg(0, Hh + 5, 0, 0, Hh + 5, D, C.violet, 0.35, 200);
        for (let x = -Wd; x <= Wd; x += 4) seg(x, 0, 0, x, 0, D, C.violet, 0.15, 200);
        box(0, 0, 44, 22, 1.5, 7, C.neon, 0.8, 200); box(0, 1.5, 43, 6, 1.6, 2, C.ice, 0.9, 200);
        for (const sx of [-15, 15]) for (let k = 0; k < 3; k++) {
          const y = 1.5 + k * 3.2; box(sx, y, 44, 4, 3, 3, C.ice, 0.9, 200);
          ring(sx, y + 1.5, 42.4, 1 + kick * 0.45, 14, kick > 0.6 ? C.hot : C.ice, 0.9, 200, 'xy');
        }
        for (const e of emit) for (let k = 0; k < 6; k++) {
          const ex = e.x + Math.sin(env.t * 1.1 + e.ph + k * 0.45) * 15, ez = 6 + k * 4.5 + Math.sin(env.t * 0.7 + k) * 3;
          seg(e.x, Hh - 0.5, 44, ex, 0, ez, e.col, 0.35 + kick * 0.55, 200);
        }
        for (const c of crowd) {
          const j = kick * 0.7 * (0.6 + 0.4 * Math.sin(c.ph + env.t)), sway = Math.sin(env.t * 2 + c.ph) * 0.15;
          seg(c.x, j, c.z, c.x + sway, c.h + j, c.z, C.white, 0.55, 200);
          seg(c.x + sway - 0.25, c.h + j + 0.3, c.z, c.x + sway + 0.25, c.h + j + 0.3, c.z, C.white, 0.55, 200);
          if (kick > 0.7 && Math.sin(c.ph * 7) > 0.6) seg(c.x + sway, c.h + j, c.z, c.x + sway + 0.4, c.h + j + 0.9, c.z, C.white, 0.5, 200); // hands up
        }
      },
    };
  })();

  // Your repository's history as a galaxy: one spiral arm per branch lane, the newest commits
  // on the rim. A commit that appears while you watch ignites. Not a repo: a made-up history.
  function gitLanes(commits) { // newest first, as git log prints them
    const lanes = [];
    return commits.map((c) => {
      let l = lanes.indexOf(c.h);
      if (l < 0) { l = lanes.indexOf(null); if (l < 0) l = lanes.length; }
      for (let i = 0; i < lanes.length; i++) if (lanes[i] === c.h) lanes[i] = null;
      lanes[l] = c.p[0] || null;
      for (const par of c.p.slice(1)) if (!lanes.includes(par)) { const f = lanes.indexOf(null); if (f < 0) lanes.push(par); else lanes[f] = par; }
      return { ...c, lane: l };
    });
  }
  function fakeHistory() {
    const msgs = ['hack the planet', 'remove the garbage file', 'fix the worm', 'da vinci virus: contain', 'mess with the best', 'crash override', 'add acid burn', 'it is in that place where I put that thing that time'];
    const out = []; let main = 'f0', feat = null;
    for (let i = 0; i < 90; i++) {
      const h = (1000 + i).toString(16);
      if (i % 17 === 5) feat = main;
      if (feat && i % 3 === 0) { out.push({ h, p: [feat], s: pick(msgs), refs: '' }); feat = h; if (i % 17 === 14) { const m = (5000 + i).toString(16); out.push({ h: m, p: [main, feat], s: 'merge', refs: '' }); main = m; feat = null; } }
      else { out.push({ h, p: [main], s: pick(msgs), refs: '' }); main = h; }
    }
    out.reverse(); out[0].refs = 'HEAD -> main, origin/main';
    return out;
  }
  worlds.git = (() => {
    let stars = [], builtFrom, seen = new Set(), born = new Map(), label = '';
    function build(gitData) {
      builtFrom = gitData;
      const real = gitData && gitData.commits && gitData.commits.length;
      const list = gitLanes(real ? gitData.commits : fakeHistory());
      label = real ? `${gitData.cwd} :: ${list.length} COMMITS` : 'NO REPOSITORY HERE :: SIMULATED HISTORY';
      const n = list.length, by = new Map();
      stars = list.map((c, i) => {
        // r and angle both grow with sqrt(age): commits sit evenly spaced along each arm
        const age = n - 1 - i, r = 5 + Math.sqrt(age / Math.max(1, n)) * 72, ang = Math.sqrt(age) * 0.9 + c.lane * 1.4;
        const s = { ...c, r, ang, y: Math.sin(age * 0.3 + c.lane) * 0.8 + c.lane * 0.6 };
        by.set(c.h, s); return s;
      });
      for (const s of stars) s.parents = s.p.map((h) => by.get(h)).filter(Boolean);
      const now = env.t;
      for (const s of stars) if (seen.size && !seen.has(s.h)) born.set(s.h, now);
      seen = new Set(stars.map((s) => s.h));
    }
    const pos = (s, spin) => [Math.cos(s.ang + spin) * s.r, s.y, Math.sin(s.ang + spin) * s.r];
    return {
      label: 'GIT GALAXY',
      enter() { build(env.git); },
      update() { if (env.git !== builtFrom) build(env.git); },
      draw() {
        const spin = env.t * 0.04, a = env.t * 0.05;
        setCam(lookAt({ x: Math.sin(a) * 58, y: 30 + Math.sin(env.t * 0.11) * 6, z: Math.cos(a) * 58 }, 0, 0, 0));
        ring(0, 0, 0, 2.5 + env.pulse, 20, C.gold, 0.9, 200);
        for (const s of stars) {
          const [x, y, z] = pos(s, spin), col = [C.ice, C.hot, C.neon, C.gold, C.violet][s.lane % 5];
          for (const p of s.parents) { const q = pos(p, spin); seg(x, y, z, q[0], q[1], q[2], col, 0.85, 200); }
          const sz = 0.6 + (s.parents.length > 1 ? 0.4 : 0);
          seg(x - sz, y, z, x + sz, y, z, C.white, 0.9, 200); seg(x, y - sz, z, x, y + sz, z, C.white, 0.9, 200);
          const b = born.get(s.h);
          if (b != null && env.t - b < 4) { const k = (env.t - b) / 4; ring(x, y, z, 0.5 + k * 6, 16, C.gold, 1 - k, 200); }
          if (s.refs) text3(s.refs.replace('HEAD -> ', '> ').slice(0, 30), x + 0.8, y + 0.8, z, C.gold, 1.2);
        }
        const head = stars[0];
        if (head) { const [x, y, z] = pos(head, spin); ring(x, y, z, 1 + env.pulse * 0.8, 14, C.hot, 1, 200); text3(head.s.slice(0, 40), x + 0.8, y - 1.4, z, C.white, 0.9, 0.8); }
        g.fillStyle = `rgba(${C.neon},0.75)`; g.font = "14px 'Cascadia Mono', Consolas, monospace"; g.fillText(label, 24, H - 28);
      },
    };
  })();

  // Black ICE: a lattice wall that cracks open when a command works and flares red when one fails.
  worlds.ice = (() => {
    let open = 0, alarm = 0, rot = 0;
    const cells = []; for (let i = -15; i <= 15; i++) for (let j = -9; j <= 9; j++) cells.push([i * 4 + (j & 1) * 2, j * 3.4]);
    return {
      label: 'ICE WALL',
      signal(k) { if (k === 'ok') open = 1; if (k === 'error') alarm = 1; },
      update(dt) { open = Math.max(0, open - dt * 0.45); alarm = Math.max(0, alarm - dt * 0.7); rot += dt * (0.04 + env.level * 0.15); },
      draw() {
        setCam({ x: Math.sin(env.t * 0.1) * 3, y: Math.sin(env.t * 0.13) * 2, z: 0, yaw: Math.sin(env.t * 0.1) * -0.05, pitch: 0 });
        const gap = Math.sin(Math.PI * Math.min(1, (1 - open) * 1.2)) * (open > 0 ? 9 : 0);
        for (const [layer, z, col, al, dir] of [[0, 46, alarm > 0 ? C.hot : C.ice, 0.9, 1], [1, 58, C.violet, 0.45, -1]]) {
          const c2 = Math.cos(rot * dir), s2 = Math.sin(rot * dir);
          for (const [cx0, cy0] of cells) {
            let cx = cx0 * c2 - cy0 * s2, cyy = cx0 * s2 + cy0 * c2;
            const d = Math.hypot(cx, cyy) || 1, push = layer ? gap * 0.4 : gap * Math.exp(-d / 18);
            cx += cx / d * push; cyy += cyy / d * push;
            if (alarm > 0) { cx += rand(-1, 1) * alarm * 1.5; }
            const zz = z - (layer ? 0 : push * 0.6);
            seg(cx, cyy + 1.6, zz, cx + 1.9, cyy, zz, col, al, 200); seg(cx + 1.9, cyy, zz, cx, cyy - 1.6, zz, col, al, 200);
            seg(cx, cyy - 1.6, zz, cx - 1.9, cyy, zz, col, al, 200); seg(cx - 1.9, cyy, zz, cx, cyy + 1.6, zz, col, al, 200);
          }
        }
        const sy2 = Math.sin(env.t * 0.8) * 22; seg(-45, sy2, 45, 45, sy2, 45, alarm > 0 ? C.hot : C.neon, 0.5, 200);
        if (alarm > 0) text3('ACCESS DENIED', -8, -1, 40, C.hot, 2.2, alarm);
        else if (open > 0) text3('ACCESS GRANTED', -9, -1, 40, C.neon, 2.2, open);
        else text3('BLACK ICE // SECURITY LEVEL 7', -11, -26, 46, C.ice, 1.2, 0.5);
      },
    };
  })();

  // Night drive: road lines and streetlights streaming at you, taillights ahead, the skyline far off.
  worlds.highway = (() => {
    let off = 0;
    const cars = Array.from({ length: 9 }, () => ({ x: pick([-4.6, -1.5, 1.5, 4.6]), z: rand(20, 140), v: rand(-6, 6) }));
    const sky = Array.from({ length: 70 }, (_, i) => ({ x: -175 + i * 5, h: rand(5, 34) }));
    const bend = (z) => z * z * 0.0009 * Math.sin(env.t * 0.12);
    return {
      label: 'HIGHWAY',
      update(dt) { off += (14 + env.speed * 0.7) * dt; for (const c of cars) { c.z += c.v * dt; if (c.z < 12) c.z = 140; if (c.z > 145) c.z = 20; } },
      draw() {
        setCam({ x: Math.sin(env.t * 0.2) * 0.6, y: 1.7, z: 0, yaw: Math.sin(env.t * 0.07) * 0.03, pitch: -0.015 });
        const L = (x, y, z, x2, y2, z2, col, a) => seg(x + bend(z), y, z, x2 + bend(z2), y2, z2, col, a, 160);
        for (let z = 1; z < 150; z += 6) { L(-7, 0, z, -7, 0, z + 6, C.hot, 0.9); L(7, 0, z, 7, 0, z + 6, C.hot, 0.9); }
        for (let z = 4 - (off % 8); z < 150; z += 8) for (const x of [-3.1, 0, 3.1]) L(x, 0, z, x, 0, z + 3, x ? C.white : C.gold, 0.8);
        for (let z = 20 - (off % 20); z < 150; z += 20) for (const s of [-1, 1]) {
          const x = s * 9.5; L(x, 0, z, x, 7, z, C.violet, 0.7); L(x, 7, z, x - s * 2.2, 7.3, z, C.violet, 0.7);
          L(x - s * 2.2, 7.2, z, x - s * 2.2, 6.6, z, C.gold, 1);
        }
        for (const c of cars) {
          const col = c.x > 0 ? C.hot : C.gold; // ours go away (taillights), theirs come at us (headlights)
          L(c.x - 0.7, 0.6, c.z, c.x - 0.3, 0.6, c.z, col, 1); L(c.x + 0.3, 0.6, c.z, c.x + 0.7, 0.6, c.z, col, 1);
        }
        for (let i = 0; i < sky.length - 1; i++) {
          const a = sky[i], b = sky[i + 1];
          seg(a.x, a.h, 148, b.x, a.h, 148, C.ice, 0.6, 400); seg(b.x, a.h, 148, b.x, b.h, 148, C.ice, 0.6, 400);
        }
        seg(-200, 0, 148, 200, 0, 148, C.hot, 0.6, 400);
      },
    };
  })();

  // Sunken server racks, cables swaying like kelp, data fish schooling, bubbles rising.
  worlds.sea = (() => {
    const racks = Array.from({ length: 14 }, () => ({ x: rand(-40, 40), z: rand(22, 110), h: rand(6, 14) }));
    const kelp = Array.from({ length: 32 }, () => ({ x: rand(-55, 55), z: rand(14, 120), h: rand(10, 30), ph: rand(0, 6), col: pick([C.neon, C.violet, C.ice]) }));
    const fish = Array.from({ length: 48 }, (_, i) => ({ g: i % 4, o: [rand(-5, 5), rand(-2, 2), rand(-5, 5)], ph: rand(0, 6) }));
    let bubbles = [];
    const school = (gi, t) => [Math.sin(t * 0.2 + gi * 1.7) * 46, 9 + Math.sin(t * 0.31 + gi * 2) * 4, 55 + Math.cos(t * 0.17 + gi) * 28];
    return {
      label: 'DEEP SEA',
      update(dt) {
        if (Math.random() < dt * 8) { const r = pick(racks); bubbles.push({ x: r.x + rand(-1, 1), y: r.h, z: r.z, v: rand(2, 5) }); }
        for (const b of bubbles) { b.y += b.v * dt; b.x += Math.sin(env.t * 3 + b.z) * dt * 0.5; }
        bubbles = bubbles.filter((b) => b.y < 40);
      },
      draw() {
        setCam({ x: Math.sin(env.t * 0.08) * 6, y: 10 + Math.sin(env.t * 0.17) * 1.5, z: 0, yaw: Math.sin(env.t * 0.06) * 0.1, pitch: -0.12 });
        const bed = (x, z) => Math.sin(x * 0.2 + z * 0.1) * 0.8;
        for (let x = -60; x <= 60; x += 6) for (let z = 10; z < 130; z += 6) {
          seg(x, bed(x, z), z, x, bed(x, z + 6), z + 6, C.ice, 0.22, 110); seg(x, bed(x, z), z, x + 6, bed(x + 6, z), z, C.ice, 0.22, 110);
        }
        racks.forEach((r, i) => {
          box(r.x, 0, r.z, 3, r.h, 2.5, C.ice, 0.8, 110);
          for (let y = 1; y < r.h; y += 1.2) {
            seg(r.x - 1.5, y, r.z - 1.25, r.x + 1.5, y, r.z - 1.25, C.ice, 0.25, 110);
            if (Math.sin(i * 7.3 + y * 5 + env.t * 4) > 0.6) seg(r.x + 0.8, y + 0.5, r.z - 1.3, r.x + 1.2, y + 0.5, r.z - 1.3, pick([C.hot, C.neon]), 1, 110);
          }
        });
        for (const k of kelp) {
          let px = k.x, py = 0;
          for (let s = 1; s <= 10; s++) { const y = s * k.h / 10, x = k.x + Math.sin(env.t * 0.8 + k.ph + s * 0.4) * s * 0.3; seg(px, py, k.z, x, y, k.z, k.col, 0.7, 110); px = x; py = y; }
        }
        for (const f of fish) {
          const c = school(f.g, env.t), n = school(f.g, env.t + 0.1), hx = n[0] - c[0], hz = n[2] - c[2], hl = Math.hypot(hx, hz) || 1;
          const x = c[0] + f.o[0] + Math.sin(env.t * 2 + f.ph) * 0.4, y = c[1] + f.o[1], z = c[2] + f.o[2];
          const dx = hx / hl, dz = hz / hl, wag = Math.sin(env.t * 9 + f.ph) * 0.2;
          seg(x, y, z, x - dx * 2 - dz * (0.8 + wag), y, z - dz * 2 + dx * (0.8 + wag), C.gold, 0.9, 110);
          seg(x, y, z, x - dx * 2 + dz * (0.8 - wag), y, z - dz * 2 - dx * (0.8 - wag), C.gold, 0.9, 110);
        }
        for (const b of bubbles) seg(b.x, b.y, b.z, b.x, b.y + 0.4, b.z, C.white, 0.7, 110);
        for (let i = 0; i < 6; i++) { const x = -40 + i * 16 + Math.sin(env.t * 0.2 + i) * 4; seg(x, 40, 60, x + 8, 0, 80, C.white, 0.08, 200); }
      },
    };
  })();

  // --- engine ----------------------------------------------------------------
  const env = { t: 0, speed: 10, level: 0, pulse: 0, bass: 0, mid: 0, high: 0, hush: 0, warp: 0, bright: 1, fs: null, git: null, packets: true };
  let cur = 'grid', prev = null, trans = 1, last = 0, source = () => ({});

  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; F = H * 0.9; }
  // On battery (not charging) the worlds run at about 20 fps; hidden, they don't run at all.
  let lowPower = false;
  try { navigator.getBattery().then((b) => { const f = () => { lowPower = !b.charging; }; f(); b.onchargingchange = f; }); } catch { /* no battery API */ }
  function frame(ts) {
    if ((typeof document !== 'undefined' && document.hidden) || (lowPower && ts - last < 45)) return requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    Object.assign(env, source(dt));
    // The dance: every world hears the music. bass/mid/high come from the spectrum (synth or
    // jukebox), smoothed; the kick (pulse) surges time forward and punches the camera in, the bass
    // thickens the lines, the highs brighten them, and trails stretch on the beat.
    const d = env.dance === false ? 0 : 1, sp = env.spec, band = (a, b) => { let m = 0; for (let i = a; i < b; i++) m += sp[i]; return m / (b - a); };
    for (const [key, v] of [['bass', sp ? band(0, 6) : env.pulse * 0.6], ['mid', sp ? band(12, 28) : 0], ['high', sp ? band(30, sp.length) : 0]]) env[key] += (v * d - env[key]) * Math.min(1, dt * 14);
    // Calm: typing hard dims the world and slows it, easing in and out, so the text wins.
    env.hush += ((env.calm !== false && env.typing > 3.5 ? 1 : 0) - env.hush) * Math.min(1, dt * 1.5);
    const step = dt * (1 + d * env.pulse * 0.6) * (1 - env.hush * 0.5);
    env.t += step; env.speed = (8 + env.level * 70 + env.warp * 60) * (1 - env.hush * 0.5);
    env.bright = (0.75 + env.pulse * 0.25 + env.high * 0.3) * (1 - env.hush * 0.45);
    F = H * 0.9 * (1 + d * (env.pulse * 0.025 + env.bass * 0.02));
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(0,0,0,${(0.28 + (1 - env.level) * 0.25) * (1 - d * env.pulse * 0.35)})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.5 + env.bass * 1.2;
    sharedLayers(step); flush();
    if (trans < 1 && prev) {
      trans = Math.min(1, trans + dt * 1.6);
      worlds[prev].update(step); g.globalAlpha = 1 - trans; worlds[prev].draw(); flush();
    }
    worlds[cur].update(step); g.globalAlpha = trans; worlds[cur].draw(); flush(); g.globalAlpha = 1;
    if (trans < 1) { // glitch slices during the crossing
      for (let i = 0; i < 6; i++) { const y = Math.random() * H, h = rand(4, 30); g.drawImage(cv, 0, y, W, h, rand(-40, 40), y, W, h); }
    }
    requestAnimationFrame(frame);
  }

  // What a world in its own file gets to draw with. W, H, F and g change on resize, hence getters.
  const kit = {
    C, rand, pick, hex, env, seg, line2, text3, box, ring, ship, setCam, lookAt, toCam,
    get W() { return W; }, get H() { return H; }, get F() { return F; }, get g() { return g; },
  };

  root.Worlds = {
    get names() { return Object.keys(worlds); },
    define(name, make) { worlds[name] = make(kit); },
    label: (name) => worlds[name || cur].label,
    current: () => cur,
    go(name) {
      if (!worlds[name] || name === cur) return;
      prev = cur; cur = name; trans = 0; if (worlds[cur].enter) worlds[cur].enter();
    },
    // Events the current world may react to: 'ok' (a command worked), 'error', 'commit'.
    signal(kind) { for (const w of Object.values(worlds)) if (w.signal) w.signal(kind); },
    gitLanes, // exported for the self-check
    refreshFiles() { if (worlds.files.refresh && cur === 'files') worlds.files.refresh(); },
    start(canvas, src) { cv = canvas; g = cv.getContext('2d'); source = src; resize(); addEventListener('resize', resize); requestAnimationFrame(frame); },
  };
})(this);
