// ANGEL ATTACK: a huge glass-edged octahedron turns over a wireframe city. The towers sink into
// the ground for the battle, a giant purple mecha rises on its lift in the foreground, and the
// angel's beam strikes an octagonal barrier that ripples out from it. Orange hexagon warning
// panels top left, the sync ratio climbing with your activity on the right. A failed command
// fires the beam.
(function (Worlds) {
  Worlds.define('eva', (k) => {
    const { C, rand, env, seg, setCam, lookAt, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 300, ORANGE = '255,140,30', PURPLE = '150,70,255', CYCLE = 40;
    const towers = [];
    for (let x = -70; x <= 70; x += 9) for (let z = 40; z <= 170; z += 9) if (Math.random() < 0.7) towers.push({ x: x + rand(-2, 2), z: z + rand(-2, 2), h: rand(8, 34), w: rand(3, 6) });
    const A = { x: 40, y: 46, z: 120, r: 16 };
    let ct = 0, beam = 0, sync = 20, ripples = [], hits = 0;
    const OCT = [[0, 1.5, 0], [0, -1.5, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    const OE = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]];
    function fire() { if (beam <= 0) { beam = 1.4; ripples.push({ t: 0 }); hits++; } }
    // the mecha, an original lanky giant: [x, y] outline points, mirrored, drawn in the xy plane
    const BODY = [[0, 30], [1.2, 29], [1.6, 27.5], [3, 26], [6.5, 26.5], [7.5, 24], [5, 23], [4, 19], [3, 15], [3.5, 14], [3, 8], [3.5, 1], [4.5, 0], [1.5, 0], [1, 8], [0, 14]];
    const ARM = [[5, 23], [7, 16], [7.5, 10], [6, 10], [5.5, 16], [4, 19]];
    return {
      label: 'ANGEL ATTACK',
      signal(kind) { if (kind === 'error') fire(); },
      update(dt) {
        ct = (ct + dt) % CYCLE; beam = Math.max(0, beam - dt);
        sync += (20 + env.level * 90 - sync) * dt * 0.3; // 20% idle, 110% flat out
        if (ct > 18 && Math.random() < dt * (0.12 + env.level * 0.4)) fire();
        for (const r of ripples) r.t += dt;
        ripples = ripples.filter((r) => r.t < 1.6);
      },
      draw() {
        const t = env.t, sink = Math.min(1, Math.max(0, (ct - 2) / 6)) * (ct < CYCLE - 5 ? 1 : (CYCLE - ct) / 5);
        const rise = Math.min(1, Math.max(0, (ct - 7) / 8)) * (ct < CYCLE - 5 ? 1 : (CYCLE - ct) / 5);
        setCam(lookAt({ x: -26 + Math.sin(t * 0.05) * 6, y: 12, z: -18 }, 4, 22, 90));
        for (let x = -90; x <= 90; x += 10) seg(x, 0, 0, x, 0, 200, C.violet, 0.25, FOG);
        for (let z = 0; z <= 200; z += 10) seg(-90, 0, z, 90, 0, z, C.violet, 0.25, FOG);
        for (const b of towers) { const h = b.h * (1 - sink * 0.92); box(b.x, 0, b.z, b.w, h, b.w, C.ice, 0.55, FOG); }
        // the angel: a turning octahedron, its edges brighter on the beat
        const ry = t * 0.25, c = Math.cos(ry), sn = Math.sin(ry), r = A.r * (1 + env.pulse * 0.04);
        const P = OCT.map(([x, y, z]) => [A.x + (x * c - z * sn) * r, A.y + y * r, A.z + (x * sn + z * c) * r]);
        for (const [i, j] of OE) seg(...P[i], ...P[j], C.ice, 0.7 + env.pulse * 0.3, FOG);
        for (const [i, j] of OE) seg(...P[i], ...P[j], C.white, 0.25, FOG);
        // the mecha on its lift, rising out of the ground
        const mx = -22, mz = 34, my = -32 * (1 - rise), S = 1.15, col = PURPLE;
        for (const sx of [-1, 1]) {
          for (const pts of [BODY, ARM]) for (let i = 0; i < pts.length - 1; i++) {
            const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
            if (my + ay * S < 0 && my + by * S < 0) continue; // still below the street
            seg(mx + sx * ax * S, Math.max(0, my + ay * S), mz, mx + sx * bx * S, Math.max(0, my + by * S), mz, col, 0.95, FOG);
          }
        }
        if (my + 30 * S > 0) { seg(mx, my + 30 * S, mz, mx + 1, my + 33.5 * S, mz, C.neon, 0.9, FOG); seg(mx - 0.8, my + 28 * S, mz, mx + 0.8, my + 28 * S, mz, C.neon, 1, FOG); } // horn and eyes
        seg(mx - 9, 0.2, mz - 4, mx + 9, 0.2, mz - 4, ORANGE, 0.6, FOG); seg(mx - 9, 0.2, mz + 4, mx + 9, 0.2, mz + 4, ORANGE, 0.6, FOG); // the lift's rails
        // the beam, and the barrier's octagons rippling out where it lands
        const fx = mx + 4, fy = 22, fz = mz + 14;
        if (beam > 0) for (let i = -1; i <= 1; i++) seg(A.x, A.y - r * 1.5, A.z, fx + i * 0.4, fy, fz, beam > 0.3 ? C.white : C.hot, beam, FOG);
        for (const rp of ripples) for (let ring = 0; ring < 3; ring++) {
          const rr = 3 + (rp.t * 14 + ring * 3), al = Math.max(0, 1 - rp.t / 1.6) * (1 - ring * 0.25);
          for (let i = 0; i < 8; i++) {
            const a0 = (i + 0.5) / 8 * Math.PI * 2, a1 = (i + 1.5) / 8 * Math.PI * 2;
            seg(fx + Math.cos(a0) * rr, fy + Math.sin(a0) * rr, fz, fx + Math.cos(a1) * rr, fy + Math.sin(a1) * rr, fz, ORANGE, al, FOG);
          }
        }
        hud(sink, rise);
      },
    };

    function hex(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
    function hud(sink, rise) {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), r = 34 * s, flash = Math.sin(env.t * 6) > 0;
      const cells = [[0, 0, 'EMERGENCY'], [1, 0, ''], [0, 1, 'PATTERN'], [1, 1, 'BLUE'], [2, 0, ''], [2, 1, 'CODE 601']];
      for (const [cx, cy, label] of cells) {
        const x = 50 * s + cx * r * 1.5, y = 50 * s + cy * r * 1.74 + (cx % 2) * r * 0.87;
        hex(g, x, y, r * 0.95); g.fillStyle = `rgba(${ORANGE},${label && flash ? 0.35 : 0.12})`; g.fill();
        g.strokeStyle = `rgba(${ORANGE},0.9)`; g.lineWidth = 1.5; g.stroke();
        if (label) { g.font = `bold ${10 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${ORANGE},1)`; g.fillText(label, x - g.measureText(label).width / 2, y + 4 * s); }
      }
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${ORANGE},0.85)`;
      g.fillText(sink > 0.9 ? 'CITY SHELTERED' : sink > 0 ? 'BUILDINGS RETRACTING' : 'CITY NORMAL', 28 * s, 190 * s);
      g.fillText(rise >= 1 ? 'LIFT-OFF  ::  UNIT DEPLOYED' : rise > 0 ? 'LAUNCH  ::  LIFT RISING' : 'UNIT ON STANDBY', 28 * s, 210 * s);
      // sync ratio
      const sv = Math.min(400, sync), bx = W - 60 * s, by = 60 * s, bh = 260 * s;
      g.strokeStyle = `rgba(${C.neon},0.8)`; g.strokeRect(bx, by, 18 * s, bh);
      const f = Math.min(1, sv / 120); g.fillStyle = `rgba(${f > 0.8 ? C.hot : C.neon},0.7)`; g.fillRect(bx, by + bh * (1 - f), 18 * s, bh * f);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.95)`;
      const m = `SYNC RATIO ${sv.toFixed(1)}%`; g.fillText(m, bx + 18 * s - g.measureText(m).width, by + bh + 26 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${ORANGE},0.85)`; const h = `ABSOLUTE TERROR FIELD HITS ${String(hits).padStart(3, '0')}`;
      g.fillText(h, W - 28 * s - g.measureText(h).width, H - 30 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
