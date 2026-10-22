// EXPLORERS: a homemade bubble ship, a force-field sphere round a scrapyard pod, lifting off from
// a backyard at night. Up past the rooftops and trees, through the cloud deck, past the moon,
// into the hangar gate of a huge ship waiting up there; a flash, and it's back in the backyard
// for another go. A hand-drawn schematic of the rig top right, altitude bottom left.
// Activity is the climb rate; an error makes the field flicker.
(function (Worlds) {
  Worlds.define('explorers', (k) => {
    const { C, rand, env, seg, box, ring, setCam, lookAt } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 320, TOP = 1000, TAU = Math.PI * 2;
    let alt = 0, flash = 0, wobble = 0;
    const houses = [];
    for (let x = -80; x <= 80; x += 26) for (let z = -80; z <= 80; z += 26) if (Math.abs(x) > 20 || Math.abs(z) > 20) houses.push({ x: x + rand(-3, 3), z: z + rand(-3, 3), w: rand(8, 12), d: rand(7, 10), h: rand(4, 6), lit: Math.random() });
    const trees = Array.from({ length: 26 }, () => { const a = rand(0, TAU), r = rand(14, 95); return [Math.cos(a) * r, Math.sin(a) * r, rand(5, 9)]; });
    // the schematic: chips and wobbly traces, drawn once and kept
    const jit = () => rand(-1.5, 1.5);
    const chips = Array.from({ length: 5 }, () => [rand(0.05, 0.75), rand(0.1, 0.75), rand(0.12, 0.22), rand(0.08, 0.16)]);
    const traces = Array.from({ length: 14 }, () => { const a = chips[Math.floor(rand(0, 5))], b = chips[Math.floor(rand(0, 5))]; return [[a[0] + a[2], a[1] + rand(0, a[3])], [b[0], b[1] + rand(0, b[3])], [jit(), jit(), jit()]]; });

    const pos = () => { const f = 1 - Math.min(1, alt / TOP); return [Math.sin(alt * 0.012) * 7 * f, alt + 2, Math.cos(alt * 0.009) * 5 * f]; };
    function bubble(x, y, z) {
      const t = env.t, R = 3.2, flick = wobble > 0 ? (Math.random() < 0.5 ? 0.2 : 1) : 1;
      for (let j = 0; j < 6; j++) { // meridians, turning slowly
        const ph = j / 6 * Math.PI + t * 0.3, al = (0.35 + 0.3 * Math.sin(t * 3 + j)) * flick;
        let p = null;
        for (let i = 0; i <= 20; i++) {
          const th = i / 20 * TAU, q = [x + Math.cos(th) * Math.cos(ph) * R, y + Math.sin(th) * R, z + Math.cos(th) * Math.sin(ph) * R];
          if (p) seg(...p, ...q, j % 2 ? C.ice : C.white, al, FOG); p = q;
        }
      }
      for (const b of [-0.6, 0, 0.6]) ring(x, y + Math.sin(b) * R, z, Math.cos(b) * R, 24, C.ice, 0.4 * flick, FOG);
      for (let i = 0; i < 5; i++) { const a = rand(0, TAU), e = rand(-1, 1); seg(x + Math.cos(a) * R, y + e * R * 0.9, z + Math.sin(a) * R, x + Math.cos(a + 0.3) * R, y + e * R * 0.9, z + Math.sin(a + 0.3) * R, C.white, 0.9, FOG); } // the shimmering edge
      box(x, y - 1, z, 1.8, 0.9, 1.2, C.gold, 0.9, FOG); // the pod: an old fairground car
      seg(x - 0.7, y - 0.1, z - 0.4, x - 0.7, y + 0.6, z - 0.4, C.gold, 0.8, FOG); seg(x + 0.7, y - 0.1, z - 0.4, x + 0.7, y + 0.6, z - 0.4, C.gold, 0.8, FOG);
      seg(x - 0.7, y + 0.6, z - 0.4, x + 0.7, y + 0.6, z - 0.4, C.gold, 0.8, FOG);
    }

    return {
      label: 'EXPLORERS',
      enter() { alt = 0; },
      signal(kind) { if (kind === 'error') wobble = 1.5; },
      update(dt) {
        const near = alt > TOP - 60 ? 0.5 : 1;
        alt += (6 + env.level * 30) * dt * near * (alt < 20 ? 0.5 : 1);
        flash = Math.max(0, flash - dt * 1.5); wobble = Math.max(0, wobble - dt);
        if (alt > TOP + 30) { alt = 0; flash = 0.6; }
      },
      draw() {
        const t = env.t, [bx, by, bz] = pos(), a = t * 0.12, inside = alt > TOP;
        setCam(lookAt({ x: bx + Math.sin(a) * 18, y: Math.max(1.6, by - 6 + (inside ? 8 : 0)), z: bz + Math.cos(a) * 18 }, bx, by + 1, bz));
        if (alt < 330) { // the neighbourhood
          for (const h of houses) {
            box(h.x, 0, h.z, h.w, h.h, h.d, C.violet, 0.6, FOG);
            seg(h.x - h.w / 2, h.h, h.z - h.d / 2, h.x, h.h + 3, h.z - h.d / 2, C.violet, 0.6, FOG); seg(h.x + h.w / 2, h.h, h.z - h.d / 2, h.x, h.h + 3, h.z - h.d / 2, C.violet, 0.6, FOG);
            seg(h.x - h.w / 2, h.h, h.z + h.d / 2, h.x, h.h + 3, h.z + h.d / 2, C.violet, 0.6, FOG); seg(h.x + h.w / 2, h.h, h.z + h.d / 2, h.x, h.h + 3, h.z + h.d / 2, C.violet, 0.6, FOG);
            seg(h.x, h.h + 3, h.z - h.d / 2, h.x, h.h + 3, h.z + h.d / 2, C.violet, 0.6, FOG);
            if (h.lit > 0.4) seg(h.x - 1.5, 2, h.z - h.d / 2 - 0.05, h.x + 1.5, 2, h.z - h.d / 2 - 0.05, C.gold, 0.9, FOG);
          }
          for (const [x, z, h] of trees) for (let i = 0; i < 3; i++) {
            const y = h * (0.3 + i * 0.22), r = (3 - i) * 0.9;
            for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) seg(x + dx, y, z + dz, x, y + h * 0.3, z, C.neon, 0.55, FOG);
          }
          for (const [x0, z0, x1, z1] of [[-14, -14, 14, -14], [14, -14, 14, 14], [14, 14, -14, 14], [-14, 14, -14, -14]]) { seg(x0, 1.2, z0, x1, 1.2, z1, C.white, 0.4, FOG); seg(x0, 0, z0, x0, 1.2, z0, C.white, 0.4, FOG); }
          for (let r = 30; r <= 120; r += 30) ring(0, 0, 0, r, 40, C.violet, 0.15, FOG);
        }
        if (alt > 60 && alt < 420) for (const ly of [180, 205, 235, 260]) { // the cloud deck
          if (Math.abs(ly - by) > 140) continue;
          for (let z = -90; z <= 90; z += 12) {
            let px = -100, py = ly;
            for (let x = -90; x <= 100; x += 10) { const y = ly + Math.sin(x * 0.08 + z * 0.05 + t * 0.3 + ly) * 2.5; seg(px, py, z, x, y, z, C.white, 0.28, FOG); px = x; py = y; }
          }
        }
        // the moon, off to one side
        const mz = 260, my = Math.min(by + 60, 700);
        ring(120, my, mz, 55, 48, C.white, 0.8, 900, 'xy');
        for (const [cx, cy, r] of [[110, 15, 9], [140, -12, 6], [100, -22, 5], [132, 24, 4]]) ring(cx, my + cy, mz, r, 16, C.white, 0.4, 900, 'xy');
        if (alt > 520) { // the ship, and its open gate
          const y = TOP + 6;
          for (const r of [40, 80, 130, 170]) ring(0, y + r * 0.08, 0, r, 48, C.violet, 0.7, 900);
          for (let i = 0; i < 16; i++) { const a2 = i / 16 * TAU; seg(Math.cos(a2) * 20, y, Math.sin(a2) * 20, Math.cos(a2) * 170, y + 14, Math.sin(a2) * 170, C.violet, 0.4, 900); }
          const gl = 0.5 + env.pulse * 0.5;
          for (const d of [8, 10]) { seg(-d, y, -d, d, y, -d, C.hot, gl, 900); seg(d, y, -d, d, y, d, C.hot, gl, 900); seg(d, y, d, -d, y, d, C.hot, gl, 900); seg(-d, y, d, -d, y, -d, C.hot, gl, 900); }
          for (let q = 0; q < 6; q++) { const yy = y + 3 + q * 5; seg(-8, yy, -8, 8, yy, -8, C.gold, 0.5, 900); seg(-8, yy, 8, 8, yy, 8, C.gold, 0.5, 900); }
        }
        bubble(bx, by, bz);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      if (flash > 0) { g.fillStyle = `rgba(${C.white},${flash})`; g.fillRect(0, 0, W, H); }
      // the schematic, on graph paper
      const sx = W - 270 * s, sy = 30 * s, sw = 240 * s, sh = 180 * s;
      g.strokeStyle = `rgba(${C.ice},0.12)`; g.lineWidth = 1;
      for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(sx + i * sw / 12, sy); g.lineTo(sx + i * sw / 12, sy + sh); g.moveTo(sx, sy + i * sh / 12); g.lineTo(sx + sw, sy + i * sh / 12); g.stroke(); }
      g.strokeStyle = `rgba(${C.white},0.75)`; g.lineWidth = 1.3;
      for (const [x, y, w, h] of chips) {
        g.strokeRect(sx + x * sw, sy + y * sh, w * sw, h * sh);
        for (let p = 0; p < 4; p++) { const px = sx + (x + (p + 0.5) * w / 4) * sw; g.beginPath(); g.moveTo(px, sy + y * sh); g.lineTo(px, sy + y * sh - 4 * s); g.stroke(); }
      }
      g.strokeStyle = `rgba(${C.gold},0.7)`;
      for (const [[x0, y0], [x1, y1], [j0, j1, j2]] of traces) { // a dog-leg, drawn by an unsteady hand
        g.beginPath(); g.moveTo(sx + x0 * sw, sy + y0 * sh); g.lineTo(sx + ((x0 + x1) / 2) * sw + j0, sy + y0 * sh + j1); g.lineTo(sx + ((x0 + x1) / 2) * sw + j2, sy + y1 * sh); g.lineTo(sx + x1 * sw, sy + y1 * sh); g.stroke();
      }
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.85)`; g.fillText('BUBBLE RIG  REV 3  (DO NOT TOUCH)', sx, sy + sh + 20 * s);
      // altitude and where we are
      const ft = Math.max(0, Math.round(alt * 10)), stage = alt < 60 ? 'BACKYARD' : alt < 300 ? 'CLOUD DECK' : alt < TOP - 80 ? 'HIGH ORBIT' : 'DOCKING';
      g.font = `bold ${26 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(`ALT ${String(ft).padStart(5, '0')} FT`, 28 * s, H - 36 * s);
      g.font = `bold ${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${wobble > 0 ? C.hot : C.neon},0.9)`;
      g.fillText(`${stage}   FIELD ${wobble > 0 ? 'UNSTABLE' : 'STABLE'}`, 28 * s, H - 72 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
