// HARDSUIT: night, stacked freeway overpasses curving through a megacity. Four powered-armour
// figures skate the middle deck in formation, jumping the gaps, chasing a hulking rogue android
// that smashes through the barriers ahead of them. Their shots spark off its plating until it
// blows, and another drops onto the road. Police flyers blink overhead. A failed command means
// the android hits back.
(function (Worlds) {
  Worlds.define('hardsuit', (k) => {
    const { C, rand, env, seg, setCam, lookAt, ring, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 200, HW = 7, POST = 18;
    const DECKS = [{ y: 6, o: -26, f: 0.011, col: C.violet }, { y: 16, o: 0, f: 0.008, col: C.ice }, { y: 28, o: 30, f: 0.006, col: C.violet }];
    const cx = (d, z) => d.o + Math.sin(z * d.f + d.o) * 14; // a deck's centreline
    const SUITS = [{ name: 'VEGA', col: C.hot }, { name: 'MIRA', col: C.neon }, { name: 'KAI', col: C.gold }, { name: 'SOLA', col: C.white }];
    const suits = SUITS.map((u, i) => ({ ...u, lane: (i - 1.5) * 2.6, dz: 14 + (i % 2) * 5, hp: 100, jump: 0, ph: i }));
    const D = DECKS[1];
    let z = 0, droid = { dz: 55, hp: 100, lane: 0, dead: 0 }, shots = [], sparks = [], debris = [], flyers = [], kills = 0;
    for (let i = 0; i < 4; i++) flyers.push({ x: rand(-60, 60), y: rand(40, 60), dz: rand(20, 160), v: rand(-10, 10) });

    function spark(x, y, z0, n, col) { for (let i = 0; i < n; i++) sparks.push({ x, y, z: z0, vx: rand(-8, 8), vy: rand(-2, 10), vz: rand(-8, 8), t: rand(0.3, 0.8), col: col || C.gold }); }
    function figure(x, y, zz, h, col, swing, crouch) { // a sleek armoured line figure, facing +z
      const hip = y + h * (0.48 - crouch * 0.1), sh = y + h * (0.8 - crouch * 0.12), sw = Math.sin(swing) * 0.35 * h;
      ring(x, sh + h * 0.13, zz, h * 0.09, 6, col, 1, FOG, 'xy');
      seg(x, hip, zz, x, sh, zz, col, 1, FOG); seg(x - h * 0.2, sh, zz, x + h * 0.2, sh, zz, col, 1, FOG);
      for (const s of [-1, 1]) {
        seg(x + s * h * 0.2, sh, zz, x + s * h * 0.28, sh - h * 0.28, zz + s * sw * 0.5, col, 0.9, FOG); // arms
        seg(x, hip, zz, x + s * h * 0.14, y + h * 0.22, zz + s * sw, col, 1, FOG); seg(x + s * h * 0.14, y + h * 0.22, zz + s * sw, x + s * h * 0.12, y, zz + s * sw * 1.3, col, 1, FOG); // legs
        seg(x + s * h * 0.12, y, zz + s * sw * 1.3 - 0.4, x + s * h * 0.12, y, zz + s * sw * 1.3 + 0.4, C.white, 0.8, FOG); // skates
      }
    }
    function android(x, y, zz, col) { // hulking: a block chest on short legs, long arms
      box(x, y + 3.4, zz, 4.4, 3.2, 2.4, col, 0.95, FOG);
      box(x, y + 6.6, zz, 1.4, 1.1, 1.4, col, 0.95, FOG);
      seg(x - 0.4, y + 7.1, zz - 0.71, x + 0.4, y + 7.1, zz - 0.71, C.hot, 1, FOG); // eye slit
      for (const s of [-1, 1]) {
        const w = Math.sin(env.t * 6 + s) * 0.6;
        seg(x + s * 2.2, y + 6.4, zz, x + s * 3.2, y + 3, zz + w, col, 0.9, FOG); seg(x + s * 3.2, y + 3, zz + w, x + s * 3, y + 0.8, zz - w, col, 0.9, FOG);
        seg(x + s * 1, y + 3.4, zz, x + s * 1.2, y + 1.6, zz + w, col, 0.9, FOG); seg(x + s * 1.2, y + 1.6, zz + w, x + s * 1.2, y, zz - w, col, 0.9, FOG);
      }
    }

    return {
      label: 'HARDSUIT',
      signal(kind) { if (kind === 'error') for (const u of suits) { u.hp = Math.max(10, u.hp - rand(10, 30)); spark(cx(D, z + u.dz) + u.lane, D.y + 1.5, z + u.dz, 6, C.hot); } },
      update(dt) {
        const v = 26 + env.level * 30; z += v * dt;
        for (const u of suits) { u.jump = Math.max(0, u.jump - dt); if (Math.random() < dt * 0.15) u.jump = 0.9; u.hp = Math.min(100, u.hp + dt * 2); }
        if (droid.dead > 0) { droid.dead -= dt; if (droid.dead <= 0) Object.assign(droid, { hp: 100, dz: 70, lane: rand(-4, 4) }); }
        else {
          droid.dz += (50 - droid.dz) * dt * 0.3; droid.lane += Math.sin(env.t * 0.8) * dt * 3;
          if (Math.abs(droid.lane) > HW - 2.5) { // crashes through the barrier
            const s = Math.sign(droid.lane), dz = z + droid.dz;
            for (let i = 0; i < 4; i++) debris.push({ x: cx(D, dz) + s * HW, y: D.y + 1, z: dz + rand(-2, 2), vx: s * rand(4, 10), vy: rand(2, 8), vz: rand(-3, 3), t: 2.5 });
            spark(cx(D, dz) + s * HW, D.y + 1, dz, 10); droid.lane = s * (HW - 4);
          }
          if (Math.random() < dt * (1.5 + env.level * 5)) {
            const u = suits[(Math.random() * 4) | 0]; shots.push({ u, t: 0.15 });
            droid.hp -= rand(2, 6);
            spark(cx(D, z + droid.dz) + droid.lane + rand(-2, 2), D.y + rand(2, 6), z + droid.dz - 1.2, 4);
            if (droid.hp <= 0) { droid.dead = 4; kills++; spark(cx(D, z + droid.dz) + droid.lane, D.y + 4, z + droid.dz, 40, C.hot); }
          }
        }
        for (const s of shots) s.t -= dt;
        shots = shots.filter((s) => s.t > 0);
        for (const p of [...sparks, ...debris]) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 15 * dt; p.t -= dt; }
        sparks = sparks.filter((p) => p.t > 0); debris = debris.filter((p) => p.t > 0 && p.y > -40);
        for (const f of flyers) { f.x += f.v * dt; if (Math.abs(f.x) > 90) f.v = -f.v; }
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: cx(D, z) - 10, y: D.y + 7, z: z - 8 }, cx(D, z + 30), D.y + 3, z + 30));
        for (const d of DECKS) { // each deck: edges, rails, posts, lights
          const z0 = Math.floor(z / 6) * 6;
          for (let zz = z0; zz < z + FOG; zz += 6) {
            const a = cx(d, zz), b = cx(d, zz + 6);
            for (const s of [-1, 1]) { seg(a + s * HW, d.y, zz, b + s * HW, d.y, zz + 6, d.col, 0.7, FOG); seg(a + s * HW, d.y + 1.2, zz, b + s * HW, d.y + 1.2, zz + 6, d.col, 0.45, FOG); }
            if (zz % 12 === 0) seg(a, d.y, zz, a, d.y, zz + 3, C.gold, 0.6, FOG);
            if (zz % POST === 0) {
              seg(a - HW, d.y, zz, a - HW, d.y - 30, zz, d.col, 0.3, FOG); seg(a + HW, d.y, zz, a + HW, d.y - 30, zz, d.col, 0.3, FOG); // pillars
              seg(a + HW, d.y, zz, a + HW, d.y + 6, zz, C.white, 0.5, FOG); seg(a + HW, d.y + 6, zz, a + HW - 2, d.y + 6, zz, C.white, 0.5, FOG);
              ring(a + HW - 2, d.y + 5.9, zz, 0.4, 6, C.gold, 0.9, FOG); // streetlight
            }
          }
        }
        for (let i = 0; i < 24; i++) { const bx = -120 + i * 11, bz = z + 180 + (i % 3) * 15, h = 30 + Math.abs(Math.sin(i * 2.3)) * 70; box(bx, -20, bz, 7, h, 7, C.violet, 0.35, 260); } // the city behind
        for (const u of suits) {
          const uz = z + u.dz, ux = cx(D, uz) + u.lane, j = u.jump > 0 ? Math.sin((0.9 - u.jump) / 0.9 * Math.PI) * 3 : 0;
          figure(ux, D.y + j, uz, 2.4, u.col, t * 6 + u.ph, u.jump > 0 ? 0.6 : 0.2);
        }
        if (droid.dead <= 0) android(cx(D, z + droid.dz) + droid.lane, D.y, z + droid.dz, C.hot);
        for (const s of shots) {
          const uz = z + s.u.dz, ux = cx(D, uz) + s.u.lane;
          seg(ux, D.y + 1.9, uz, cx(D, z + droid.dz) + droid.lane, D.y + 4, z + droid.dz, s.u.col, 1, FOG);
        }
        for (const p of sparks) seg(p.x, p.y, p.z, p.x - p.vx * 0.04, p.y - p.vy * 0.04, p.z - p.vz * 0.04, p.col, Math.min(1, p.t * 2), FOG);
        for (const p of debris) seg(p.x, p.y, p.z, p.x + 1.5, p.y, p.z, C.ice, 0.8, FOG);
        for (const f of flyers) { const fz = z + f.dz; box(f.x, f.y, fz, 4, 1, 2, C.ice, 0.6, 260); seg(f.x - 1, f.y + 1.1, fz, f.x + 1, f.y + 1.1, fz, Math.sin(t * 8 + f.dz) > 0 ? C.hot : C.ice, 1, 260); }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText('NIGHT SABRES', 28 * s, 34 * s);
      g.font = `${12 * s | 0}px ${MONO}`;
      suits.forEach((u, i) => {
        const y = (58 + i * 22) * s;
        g.fillStyle = `rgba(${u.col},0.9)`; g.fillText(u.name.padEnd(10), 28 * s, y);
        g.strokeStyle = `rgba(${u.col},0.7)`; g.strokeRect(120 * s, y - 10 * s, 140 * s, 10 * s);
        g.fillRect(120 * s, y - 10 * s, 140 * s * u.hp / 100, 10 * s);
      });
      const R = (str, y, col) => { g.fillStyle = `rgba(${col},0.9)`; g.fillText(str, W - 28 * s - g.measureText(str).width, y); };
      g.font = `bold ${16 * s | 0}px ${MONO}`; R('TARGET :: ROGUE ANDROID', 34 * s, C.gold);
      g.font = `${12 * s | 0}px ${MONO}`; R(droid.dead > 0 ? 'TARGET DESTROYED' : `ARMOUR ${Math.max(0, droid.hp | 0)}%`, 56 * s, droid.dead > 0 ? C.neon : C.hot);
      R(`TAKEDOWNS ${String(kills).padStart(3, '0')}`, 76 * s, C.white);
      g.fillStyle = `rgba(${C.ice},0.75)`; g.fillText('TOKYO 2033  ::  ROUTE 9 ELEVATED  ::  02:40', 28 * s, H - 30 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
