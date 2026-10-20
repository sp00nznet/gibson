// DEATHMATCH: a wireframe arena shooter that plays itself behind your terminal. The map is laid
// out the way q3mapgen and hlmapgen lay out theirs (rooms dropped on a grid, a spanning tree of
// L-shaped corridors between them, a loop or two), and the bots are black-ice's ICE programs.
// NYX holds the railgun. A failed command gets you railed; a new map comes up every few minutes.
(function (Worlds) {
  Worlds.define('deathmatch', (k) => {
    const { C, rand, pick, env, seg, setCam, line2, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", G = 22, CELL = 6, HT = 7, EYE = 2.6, FOG = 75;
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const MAPS = ['GIBDM1 // THE PIT', 'GIBDM2 // CARRIER LOST', 'GIBDM3 // ZERO COOL', 'GIBDM4 // DA VINCI', 'GIBDM5 // THE GARBAGE FILE'];
    let grid, rooms, walls, floor, items, mapName, mapT = 0;

    // --- the map: hlmapgen's core/layout.js, cut down ---------------------------------------
    function build() {
      grid = Array.from({ length: G }, () => new Array(G).fill(0)); rooms = [];
      for (let n = 0; rooms.length < 7 && n < 300; n++) {
        const w = ri(3, 6), h = ri(3, 6), x = ri(1, G - w - 2), y = ri(1, G - h - 2);
        if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
        rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
        for (let gy = y; gy < y + h; gy++) for (let gx = x; gx < x + w; gx++) grid[gy][gx] = 1;
      }
      const inTree = rooms.map((_, i) => i === 0), edges = []; // Prim's tree over the room centres
      for (let left = rooms.length - 1; left > 0; left--) {
        let best = [Infinity, 0, 0];
        rooms.forEach((a, i) => { if (inTree[i]) rooms.forEach((b, j) => { const d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy); if (!inTree[j] && d < best[0]) best = [d, i, j]; }); });
        inTree[best[2]] = true; edges.push([best[1], best[2]]);
      }
      for (let e = ri(1, 2); e > 0; e--) edges.push([ri(0, rooms.length - 1), ri(0, rooms.length - 1)]); // loops, so there is somewhere to circle
      const dig = (x, y) => { if (!grid[y][x]) grid[y][x] = 2; };
      for (const [i, j] of edges) {
        const a = rooms[i], b = rooms[j], flip = Math.random() < 0.5, bend = flip ? [b.cx, a.cy] : [a.cx, b.cy];
        for (const [p, q] of [[[a.cx, a.cy], bend], [bend, [b.cx, b.cy]]])
          for (let y = Math.min(p[1], q[1]); y <= Math.max(p[1], q[1]); y++) for (let x = Math.min(p[0], q[0]); x <= Math.max(p[0], q[0]); x++) dig(x, y);
      }
      // walls wherever open meets solid, a floor grid between open cells
      walls = []; floor = [];
      const solid = (x, y) => x < 0 || y < 0 || x >= G || y >= G || !grid[y][x];
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        if (!grid[y][x]) continue;
        const X = x * CELL, Z = y * CELL, E = CELL;
        for (const [dx, dy, l] of [[0, -1, [X, Z, X + E, Z]], [0, 1, [X, Z + E, X + E, Z + E]], [-1, 0, [X, Z, X, Z + E]], [1, 0, [X + E, Z, X + E, Z + E]]]) {
          if (solid(x + dx, y + dy)) walls.push(l); else if (dx < 0 || dy < 0) floor.push(l);
        }
      }
      items = rooms.map((r) => ({ x: (r.cx + 0.5) * CELL, z: (r.cy + 0.5) * CELL, col: pick([C.gold, C.ice, C.neon]), ph: rand(0, 6) }));
      mapName = pick(MAPS); mapT = 0;
    }

    const open = (x, z) => { const gx = Math.floor(x / CELL), gy = Math.floor(z / CELL); return gx >= 0 && gy >= 0 && gx < G && gy < G && grid[gy][gx] > 0; };
    const sees = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.5); for (let i = 1; i < n; i++) if (!open(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)) return false; return true; };
    const randomRoomCell = () => { const r = pick(rooms); return [ri(r.x, r.x + r.w - 1), ri(r.y, r.y + r.h - 1)]; };
    function route(from, to) { // breadth-first over the open cells
      const key = (c) => c[1] * G + c[0], prev = new Map([[key(from), null]]), q = [from];
      while (q.length) {
        const c = q.shift(); if (c[0] === to[0] && c[1] === to[1]) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = [c[0] + dx, c[1] + dy];
          if (n[0] < 0 || n[1] < 0 || n[0] >= G || n[1] >= G || !grid[n[1]][n[0]] || prev.has(key(n))) continue;
          prev.set(key(n), c); q.push(n);
        }
      }
      const path = []; for (let c = to; c && prev.has(key(c)); c = prev.get(key(c))) path.unshift([(c[0] + 0.5) * CELL, (c[1] + 0.5) * CELL]);
      return path;
    }
    const cellOf = (a) => [Math.floor(a.x / CELL), Math.floor(a.z / CELL)];
    const turn = (from, to, max) => { let d = to - from; d = Math.atan2(Math.sin(d), Math.cos(d)); return from + Math.max(-max, Math.min(max, d)); };
    function walk(a, speed, dt) { // follow the path; returns the heading it wants to face
      if (!a.path || !a.path.length) a.path = route(cellOf(a), randomRoomCell());
      const t = a.path[0]; if (!t) return a.yaw;
      const dx = t[0] - a.x, dz = t[1] - a.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { a.path.shift(); return a.yaw; }
      const s = Math.min(d, speed * dt); a.x += dx / d * s; a.z += dz / d * s;
      const look = a.path[Math.min(2, a.path.length - 1)];
      return Math.atan2(look[0] - a.x, look[1] - a.z);
    }
    function spawn(a) { const c = randomRoomCell(); a.x = (c[0] + 0.5) * CELL; a.z = (c[1] + 0.5) * CELL; a.path = null; a.yaw = rand(0, 6.28); }

    // --- the players --------------------------------------------------------------------------
    const me = { name: 'NYX', frags: 0, hp: 100, armor: 50, ammo: 25, dead: 0, cool: 0, yaw: 0, kick: 0, step: 0 };
    const bots = [['ACID BURN', 'walker', C.ice], ['CEREAL KILLER', 'bit', C.neon], ['LORD NIKON', 'flyer', C.gold],
      ['THE PLAGUE', 'tripod', '255,120,90'], ['PHANTOM PHREAK', 'walker', C.hot], ['CRASH OVERRIDE', 'flyer', C.violet]]
      .map(([name, kind, col]) => ({ name, kind, col, frags: 0, dead: 0, ph: rand(0, 6), yaw: 0 }));
    let beams = [], gibs = [], feed = [], hurt = 0, killer = '';
    const say = (s) => { feed.push({ s, t: 6 }); if (feed.length > 6) feed.shift(); };
    function newMap() { build(); spawn(me); bots.forEach(spawn); me.frags = 0; bots.forEach((b) => (b.frags = 0)); say(`MAP ${mapName.split(' // ')[0]}`); }
    newMap();

    function rail(from, to, col) { beams.push({ a: from, b: to, col, t: 1 }); }
    function frag(b) { // into its own lines, flying
      for (let i = 0; i < 26; i++) gibs.push({ x: b.x, y: rand(0.3, 2), z: b.z, vx: rand(-6, 6), vy: rand(2, 9), vz: rand(-6, 6), l: rand(0.2, 0.6), col: b.col, t: rand(1, 2) });
      b.dead = 3; b.path = null;
    }
    function shootMe(b) {
      rail([b.x, b.kind === 'flyer' ? 2.6 : 1.4, b.z], [me.x + Math.cos(me.yaw) * 0.8, EYE - 0.4, me.z - Math.sin(me.yaw) * 0.8], b.col);
      const dmg = ri(25, 60), soak = Math.min(me.armor, dmg >> 1);
      me.armor -= soak; me.hp -= dmg - soak; hurt = 1;
      if (me.hp <= 0) { me.dead = 2.6; killer = b.name; b.frags++; say(`${b.name} RAILED NYX`); }
    }

    // --- line art: black-ice's WireBody, flattened -----------------------------------------
    function wire(b, t) {
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw), at = (x, y, z) => [b.x + x * c + z * s, y, b.z - x * s + z * c];
      const L = (p, q, a) => { const P = at(...p), Q = at(...q); seg(P[0], P[1], P[2], Q[0], Q[1], Q[2], b.col, a || 0.9, FOG); };
      const oct = (x, y, z, r, ry) => { const v = [[x + r, y, z], [x - r, y, z], [x, y + ry, z], [x, y - ry, z], [x, y, z + r], [x, y, z - r]]; for (const [i, j] of [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]]) L(v[i], v[j]); };
      const cube = (x, y, z, w, h) => { const X = [x - w, x + w], Z = [z - w, z + w]; for (const yy of [y, y + h]) { L([X[0], yy, Z[0]], [X[1], yy, Z[0]]); L([X[1], yy, Z[0]], [X[1], yy, Z[1]]); L([X[1], yy, Z[1]], [X[0], yy, Z[1]]); L([X[0], yy, Z[1]], [X[0], yy, Z[0]]); } for (const xx of X) for (const zz of Z) L([xx, y, zz], [xx, y + h, zz]); };
      const sw = Math.sin(t * 9 + b.ph) * 0.5;
      if (b.kind === 'walker') { // box torso, octahedron head, striding legs, swinging arms
        cube(0, 1.1, 0, 0.35, 0.8); oct(0, 2.2, 0, 0.22, 0.28);
        for (const sd of [-1, 1]) { L([sd * 0.2, 1.1, 0], [sd * 0.25, 0, sd * sw]); L([sd * 0.35, 1.8, 0], [sd * 0.55, 1.1, -sd * sw * 0.8]); }
      } else if (b.kind === 'bit') { // a spinning tetrahedron, knee-high
        const r = 0.6, a0 = t * 4 + b.ph, v = [0, 1, 2].map((i) => [Math.cos(a0 + i * 2.09) * r, 0.2, Math.sin(a0 + i * 2.09) * r]).concat([[0, 1.3, 0]]);
        for (const [i, j] of [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]]) L(v[i], v[j]);
      } else if (b.kind === 'flyer') { // a stretched octahedron with flapping triangle wings
        const y = 2.4 + Math.sin(t * 2 + b.ph) * 0.4, f = Math.sin(t * 12 + b.ph) * 0.7;
        oct(0, y, 0, 0.3, 0.3); L([0, y, 0.9], [0, y, -0.9]);
        for (const sd of [-1, 1]) { L([sd * 0.3, y, 0.2], [sd * 1.4, y + f, -0.2]); L([sd * 1.4, y + f, -0.2], [sd * 0.3, y, -0.4]); }
      } else { // tripod turret: three legs, a head that recoils
        const r = b.cool > 1.2 ? 0.25 : 0;
        for (let i = 0; i < 3; i++) L([0, 1.6, 0], [Math.cos(i * 2.09) * 0.8, 0, Math.sin(i * 2.09) * 0.8]);
        cube(0, 1.6, -r, 0.3, 0.4); L([0, 1.8, 0.3 - r], [0, 1.8, 1.1 - r]);
      }
    }

    return {
      label: 'DEATHMATCH',
      update(dt) {
        mapT += dt; hurt = Math.max(0, hurt - dt * 1.5); me.kick = Math.max(0, me.kick - dt * 3);
        if (mapT > 240) newMap();
        for (const f of feed) f.t -= dt;
        // NYX
        me.cool -= dt;
        if (me.dead > 0) { me.dead -= dt; if (me.dead <= 0) { spawn(me); me.hp = 100; me.armor = 0; me.ammo = 25; } }
        else {
          let target = null, best = 45;
          for (const b of bots) {
            if (b.dead > 0) continue;
            const d = Math.hypot(b.x - me.x, b.z - me.z), off = Math.abs(Math.atan2(Math.sin(Math.atan2(b.x - me.x, b.z - me.z) - me.yaw), Math.cos(Math.atan2(b.x - me.x, b.z - me.z) - me.yaw)));
            if (d < best && off < 1.3 && sees(me, b)) { best = d; target = b; }
          }
          const want = walk(me, (target ? 3 : 8) + env.level * 5, dt);
          if (target) {
            const aim = Math.atan2(target.x - me.x, target.z - me.z);
            me.yaw = turn(me.yaw, aim, dt * (4 + env.level * 4));
            if (me.cool <= 0 && Math.abs(Math.atan2(Math.sin(aim - me.yaw), Math.cos(aim - me.yaw))) < 0.05) {
              const c = Math.cos(me.yaw), s = Math.sin(me.yaw);
              rail([me.x + c * 0.45 + s * 0.6, EYE - 0.45, me.z - s * 0.45 + c * 0.6], [target.x, target.kind === 'flyer' ? 2.6 : 1.3, target.z], C.neon);
              frag(target); me.frags++; me.kick = 1; me.ammo = Math.max(0, me.ammo - 1);
              say(`NYX RAILED ${target.name}`); me.cool = 1.5 - env.level * 0.7;
            }
          } else me.yaw = turn(me.yaw, want, dt * 2.5);
          me.step += dt * (target ? 3 : 8);
        }
        // the bots
        for (const b of bots) {
          b.cool = (b.cool || 0) - dt;
          if (b.dead > 0) { b.dead -= dt; if (b.dead <= 0) spawn(b); continue; }
          const want = walk(b, b.kind === 'bit' ? 7 : 5, dt); b.yaw = turn(b.yaw, want, dt * 4);
          if (me.dead <= 0 && b.cool <= 0 && Math.hypot(b.x - me.x, b.z - me.z) < 30 && Math.random() < dt * (0.12 + env.level * 0.3) && sees(b, me)) { b.cool = 2; shootMe(b); }
        }
        for (const g of gibs) { g.vy -= 20 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; if (g.y < 0) { g.y = 0; g.vy *= -0.4; g.vx *= 0.6; g.vz *= 0.6; } g.t -= dt; }
        gibs = gibs.filter((g) => g.t > 0); beams = beams.filter((b) => (b.t -= dt * 0.9) > 0);
        if (me.ammo === 0 && me.cool < -3) me.ammo = 25; // picked up a rail box
      },
      signal(kind) { // a failed command: someone gets a clean shot
        if (kind !== 'error' || me.dead > 0) return;
        const b = bots.filter((x) => x.dead <= 0).sort((p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z))[0];
        if (b) { me.hp = Math.min(me.hp, 20); me.armor = 0; shootMe(b); }
      },
      draw() {
        const t = env.t, dead = me.dead > 0, fall = dead ? Math.min(1, (2.6 - me.dead) * 2) : 0;
        setCam({ x: me.x, y: EYE + Math.sin(me.step) * 0.07 - fall * 2, z: me.z, yaw: me.yaw + fall * 0.4, pitch: -0.03 + fall * 0.5 });
        const near = (x, z) => Math.abs(x - me.x) < FOG + CELL && Math.abs(z - me.z) < FOG + CELL;
        for (const [x1, z1, x2, z2] of walls) {
          if (!near(x1, z1)) continue;
          seg(x1, 0, z1, x2, 0, z2, C.ice, 1, FOG); seg(x1, HT, z1, x2, HT, z2, C.ice, 0.75, FOG);
          seg(x1, 0, z1, x1, HT, z1, C.ice, 0.55, FOG);
        }
        for (const [x1, z1, x2, z2] of floor) if (near(x1, z1)) seg(x1, 0, z1, x2, 0, z2, C.violet, 0.45, FOG * 0.7);
        for (const it of items) { // armour shards, turning over the room centres
          const a = t * 2 + it.ph, y = 1 + Math.sin(t * 3 + it.ph) * 0.2, r = 0.45;
          const v = [0, 1, 2, 3].map((i) => [it.x + Math.cos(a + i * 1.57) * r, y, it.z + Math.sin(a + i * 1.57) * r]);
          for (let i = 0; i < 4; i++) { const p = v[i], q = v[(i + 1) % 4]; seg(p[0], p[1], p[2], q[0], q[1], q[2], it.col, 0.8, FOG); seg(p[0], p[1], p[2], it.x, y + 0.6, it.z, it.col, 0.6, FOG); seg(p[0], p[1], p[2], it.x, y - 0.6, it.z, it.col, 0.6, FOG); }
        }
        for (const b of bots) if (b.dead <= 0 && near(b.x, b.z)) { wire(b, t); text3(b.name, b.x - b.name.length * 0.13, b.kind === 'flyer' ? 3.6 : 3, b.z, b.col, 0.45, 0.7); }
        for (const g of gibs) seg(g.x, g.y, g.z, g.x + g.vx * 0.03 + g.l * 0.5, g.y + g.l, g.z + g.vz * 0.03, g.col, Math.min(1, g.t), FOG);
        for (const r of beams) { // the Q3 rail: a hot core and a spiral around it
          const [ax, ay, az] = r.a, [bx, by, bz] = r.b, dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz) || 1;
          seg(ax, ay, az, bx, by, bz, C.white, r.t, FOG);
          const ux = -dz / len, uz = dx / len, n = Math.ceil(len * 3); // a sideways axis, and up
          let px = ax, py = ay, pz = az;
          for (let i = 1; i <= n; i++) {
            const f = i / n, a = i * 0.7 + (1 - r.t) * 3, rr = 0.18 + (1 - r.t) * 0.5;
            const x = ax + dx * f + ux * Math.cos(a) * rr, y = ay + dy * f + Math.sin(a) * rr, z = az + dz * f + uz * Math.cos(a) * rr;
            if (i > 1) seg(px, py, pz, x, y, z, r.col, r.t * 0.8, FOG);
            px = x; py = y; pz = z;
          }
        }
        if (!dead) { // the railgun in hand
          const c = Math.cos(me.yaw), s = Math.sin(me.yaw), kb = me.kick * 0.25, bob = Math.sin(me.step) * 0.03;
          const at = (rx, ry, fz) => [me.x + rx * c + fz * s, EYE + ry + bob, me.z - rx * s + fz * c];
          const L = (p, q, col, a) => { const P = at(...p), Q = at(...q); seg(P[0], P[1], P[2], Q[0], Q[1], Q[2], col, a, FOG); };
          for (const [rx, ry] of [[0.42, -0.4], [0.5, -0.4], [0.5, -0.48], [0.42, -0.48]]) L([rx, ry, 0.5 - kb], [rx, ry, 1.7 - kb], C.neon, 0.9);
          for (let z = 0.6; z < 1.7; z += 0.18) L([0.42, -0.4, z - kb], [0.5, -0.48, z - kb], C.neon, 0.5 + me.kick * 0.5);
        }

        // HUD, in the margins
        const g = k.g, W = k.W, H = k.H, sc = Math.min(W / 1920, H / 1080), x0 = W * 0.02, y0 = H * 0.12;
        g.font = `bold ${16 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.95)`; g.fillText(mapName, x0, y0);
        g.font = `${13 * sc | 0}px ${MONO}`;
        const left = Math.max(0, 240 - mapT), board = [me, ...bots].sort((a, b) => b.frags - a.frags);
        g.fillStyle = `rgba(${C.gold},0.8)`; g.fillText(`FRAGLIMIT 20  TIME ${(left / 60) | 0}:${String((left % 60) | 0).padStart(2, '0')}`, x0, y0 + 24 * sc);
        board.forEach((p, i) => { g.fillStyle = `rgba(${p === me ? C.neon : p.col},0.9)`; g.fillText(`${String(p.frags).padStart(2)}  ${p.name}`, x0, y0 + (56 + i * 20) * sc); });
        feed.forEach((f, i) => { if (f.t > 0) { g.fillStyle = `rgba(${f.s.startsWith('NYX') ? C.neon : C.hot},${Math.min(1, f.t)})`; g.fillText(f.s, x0, y0 + (220 + i * 20) * sc); } });
        // the minimap
        const mx = W * 0.855, my = H * 0.12, ms = Math.min(W * 0.13, 250 * sc) / (G * CELL);
        for (const [x1, z1, x2, z2] of walls) line2(mx + x1 * ms, my + z1 * ms, mx + x2 * ms, my + z2 * ms, C.ice, 0.5);
        for (const b of bots) if (b.dead <= 0) { const bx = mx + b.x * ms, bz = my + b.z * ms; line2(bx - 3, bz, bx + 3, bz, b.col, 1); line2(bx, bz - 3, bx, bz + 3, b.col, 1); }
        const px = mx + me.x * ms, pz = my + me.z * ms, s = Math.sin(me.yaw), c = Math.cos(me.yaw);
        line2(px, pz, px + s * 9, pz + c * 9, C.neon, 1); line2(px - c * 4, pz + s * 4, px + s * 9, pz + c * 9, C.neon, 1); line2(px + c * 4, pz - s * 4, px + s * 9, pz + c * 9, C.neon, 1);
        // health, armour, ammo
        const hy = H * 0.12 + G * CELL * ms + 40 * sc;
        g.font = `bold ${28 * sc | 0}px ${MONO}`;
        g.fillStyle = `rgba(${me.hp > 40 ? C.gold : C.hot},0.95)`; g.fillText(`+${Math.max(0, me.hp)}`, mx, hy);
        g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText(`[${me.armor}]`, mx + 90 * sc, hy);
        g.fillStyle = `rgba(${C.neon},0.9)`; g.fillText(`${me.ammo}`, mx + 190 * sc, hy);
        g.font = `${12 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; g.fillText('HEALTH    ARMOR     RAILS', mx, hy + 20 * sc);
        if (dead) { g.font = `bold ${18 * sc | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText('FRAGGED BY', mx, hy + 70 * sc); g.fillText(killer, mx, hy + 94 * sc); }
        if (hurt > 0) for (let i = 0; i < 4; i++) { const m = i * 6; line2(m, m, W - m, m, C.hot, hurt); line2(m, H - m, W - m, H - m, C.hot, hurt); line2(m, m, m, H - m, C.hot, hurt); line2(W - m, m, W - m, H - m, C.hot, hurt); }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
