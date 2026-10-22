// WAVE MOTION: a battleship of the old shape, flying through space. On a cycle it charges the
// great gun in its bow: energy spirals in to the muzzle, the meter climbs, the countdown runs,
// and then the beam tears out ahead through the enemy fleet and rattles the planet beyond, the
// ship kicking back with the recoil. During a long build the charge follows the build instead.
// A successful command adds a little charge.
(function (Worlds) {
  Worlds.define('yamato', (k) => {
    const { C, rand, env, seg, setCam, lookAt, ring, box, ship } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 520, MZ = 14.2;
    // hull cross-sections: z, half-width, deck height, keel depth
    const SECT = [[-16, 1.6, 1.2, -1.2], [-10, 2.6, 1.4, -2.4], [0, 3, 1.5, -3], [8, 2.4, 1.6, -2.4], [14, 1.3, 1.8, -1.3]];
    let phase = 'cruise', pt = 0, charge = 0, swirl = [], fleet = [], bits = [], recoil = 0, days = 365, wave = [];
    const spawn = () => { fleet = Array.from({ length: 9 }, () => ({ x: rand(-30, 30), y: rand(-10, 12), z: rand(150, 210), dead: false })); };
    spawn();
    const sect = ([z, w, d, kl], o) => [[-w, d, z], [w, d, z], [w * 0.85, (d + kl) / 2, z], [0, kl, z], [-w * 0.85, (d + kl) / 2, z]].map(([x, y, zz]) => [x, y, zz + o]);

    function hull(o) {
      const S = SECT.map((s) => sect(s, o));
      for (let i = 0; i < S.length; i++) {
        for (let j = 0; j < 5; j++) { const a = S[i][j], b = S[i][(j + 1) % 5]; seg(...a, ...b, C.white, 0.7, FOG); if (i) seg(...S[i - 1][j], ...a, C.white, 0.8, FOG); }
      }
      ring(0, 0.3, MZ + o, 0.9, 14, phase === 'charge' || phase === 'fire' ? C.ice : C.white, 0.9, FOG, 'xy'); // the muzzle
      ring(0, 0.3, MZ + o, 0.5, 10, C.ice, 0.4 + charge / 150, FOG, 'xy');
      for (const [z, back] of [[8, 0], [4.5, 0], [-9, 1]]) { // turrets, three barrels each
        box(0, 1.6, z + o, 1.6, 0.6, 1.8, C.white, 0.8, FOG);
        for (const bx of [-0.45, 0, 0.45]) seg(bx, 1.95, z + o + (back ? -0.9 : 0.9), bx, 1.95, z + o + (back ? -3.2 : 3.2), C.white, 0.8, FOG);
      }
      box(0, 1.5, -2 + o, 1.4, 2, 2.2, C.white, 0.7, FOG); box(0, 3.5, -2.4 + o, 1, 1.6, 1.4, C.white, 0.7, FOG); box(0, 5.1, -2.6 + o, 0.6, 1, 0.8, C.gold, 0.8, FOG);
      seg(0, 6.1, -2.6 + o, 0, 7.6, -2.8 + o, C.white, 0.6, FOG); // the mast
      ring(0, 0, -16.2 + o, 1.1, 14, C.hot, 0.6 + env.pulse * 0.4, FOG, 'xy'); // the engine
      for (let i = 0; i < 4; i++) seg(rand(-0.6, 0.6), rand(-0.6, 0.6), -16.3 + o, rand(-0.4, 0.4), rand(-0.4, 0.4), -19 - rand(0, 4) + o, C.hot, 0.6, FOG);
    }
    function boom(x, y, z, n) { for (let i = 0; i < n; i++) bits.push({ x, y, z, vx: rand(-20, 20), vy: rand(-20, 20), vz: rand(-20, 20), t: rand(0.6, 1.6) }); }

    return {
      label: 'WAVE MOTION',
      signal(kind) { if (kind === 'ok' && phase === 'charge') charge = Math.min(99, charge + 8); },
      update(dt) {
        pt += dt; recoil *= 1 - dt * 1.5;
        if (phase === 'cruise' && (pt > 6 || env.build > 4)) { phase = 'charge'; pt = 0; charge = 0; }
        if (phase === 'charge') {
          charge = env.build > 4 ? Math.max(charge, Math.min(100, (env.build - 4) * 8)) : Math.min(100, charge + dt * (10 + env.level * 6));
          if (Math.random() < dt * (10 + charge * 0.4)) swirl.push({ a: rand(0, 6.3), r: rand(5, 9), z: rand(1, 5) });
          if (charge >= 100) { phase = 'fire'; pt = 0; recoil = 4; swirl = []; }
        }
        if (phase === 'fire') {
          if (Math.random() < dt * 8) wave.push({ z: MZ, r: 1 });
          for (const f of fleet) if (!f.dead && pt > 0.3 + f.z / 600 && Math.hypot(f.x, f.y) < 26) { f.dead = true; boom(f.x, f.y, f.z, 18); }
          if (pt > 2.5) { phase = 'after'; pt = 0; }
        }
        if (phase === 'after' && pt > 4) { phase = 'cruise'; pt = 0; spawn(); days = Math.max(0, days - 1); charge = 0; wave = []; }
        for (const s of swirl) { s.a += dt * (3 + charge * 0.05); s.r -= dt * 3; s.z -= dt * 1.5; }
        swirl = swirl.filter((s) => s.r > 0.6);
        for (const w of wave) { w.z += dt * 180; w.r += dt * 9; }
        wave = wave.filter((w) => w.z < 420);
        for (const f of fleet) f.x += Math.sin(env.t * 0.3 + f.y) * dt;
        for (const p of bits) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.t -= dt; }
        bits = bits.filter((p) => p.t > 0);
      },
      draw() {
        const t = env.t, o = -recoil + Math.sin(t * 0.5) * 0.3;
        setCam(lookAt({ x: -34 + Math.sin(t * 0.05) * 6, y: 11 + Math.sin(t * 0.07) * 2, z: -40 }, 0, 0, 30));
        // the planet beyond the fleet
        for (let i = 0; i < 5; i++) ring(20, 10, 330, 34 - i * 7 + (phase === 'fire' ? Math.sin(pt * 30) * 1.5 : 0), 36, C.violet, 0.5, 700, 'xy');
        for (const f of fleet) if (!f.dead) ship(f.x, f.y, f.z, Math.PI, 2.4, C.hot, 0.9, Math.sin(t + f.x) * 0.3);
        hull(o);
        for (const s of swirl) { const x = Math.cos(s.a) * s.r, y = 0.3 + Math.sin(s.a) * s.r, z = MZ + o + s.z; seg(x, y, z, x - Math.sin(s.a) * 0.8, y + Math.cos(s.a) * 0.8, z, C.ice, 0.9, FOG); }
        if (phase === 'fire') {
          const w = Math.min(1, pt * 3) * (pt > 2 ? (2.5 - pt) * 2 : 1);
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + t * 6, r = 1.2 * w; seg(Math.cos(a) * r * 0.5, 0.3 + Math.sin(a) * r * 0.5, MZ + o, Math.cos(a) * r * 3, 0.3 + Math.sin(a) * r * 3, 420, i % 2 ? C.ice : C.white, w, 700); }
          for (const wv of wave) ring(0, 0.3, wv.z, wv.r, 18, C.ice, 0.8 * w, 700, 'xy');
        }
        for (const p of bits) seg(p.x, p.y, p.z, p.x + p.vx * 0.05, p.y + p.vy * 0.05, p.z + p.vz * 0.05, C.gold, Math.min(1, p.t), 700);
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(`ENERGY ${String(Math.round(charge)).padStart(3, ' ')}%`, 28 * s, 34 * s);
      g.strokeStyle = `rgba(${C.ice},0.8)`; g.lineWidth = 1.5; g.strokeRect(28 * s, 44 * s, 240 * s, 12 * s);
      g.fillStyle = `rgba(${charge > 90 ? C.hot : C.ice},0.8)`; g.fillRect(30 * s, 46 * s, 236 * s * charge / 100, 8 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`;
      g.fillText(env.build > 4 && phase === 'charge' ? 'CHARGING FROM THE BUILD' : phase === 'after' ? 'TARGET DESTROYED' : 'ENGINE ROOM: NOMINAL', 28 * s, 76 * s);
      const d = `DAYS REMAINING  ${days}`; g.fillStyle = `rgba(${C.gold},0.85)`; g.fillText(d, W - 28 * s - g.measureText(d).width, 34 * s);
      if (phase === 'charge' && Math.sin(env.t * 8) > 0) { g.fillStyle = `rgba(${C.hot},0.9)`; const m = 'TARGET SCOPE OPEN'; g.fillText(m, W - 28 * s - g.measureText(m).width, 56 * s); }
      if (phase === 'charge' && charge > 50) {
        g.font = `bold ${40 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`;
        const m = `FIRE IN ${Math.max(1, Math.ceil((100 - charge) / 10))}`; g.fillText(m, W - 28 * s - g.measureText(m).width, H - 40 * s);
      }
      if (phase === 'fire') { g.fillStyle = `rgba(${C.ice},${Math.max(0, 0.1 - pt * 0.15)})`; g.fillRect(0, 0, W, H); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
