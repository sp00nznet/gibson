// GIBSON TOWERS: flying the canyons between the Gibson's data towers, glass monoliths taller than
// the sky with code scrolling up their faces. The camera weaves its lane and swoops from the
// floor to the rooftops; the nearest towers fill the edges of the screen, around the terminal.
(function (Worlds) {
  Worlds.define('towers', (k) => {
    const { C, rand, pick, hex, env, seg, line2, text3, setCam } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", SP = 24, L = 240, FOG = 190, STEP = 1.6;
    const ASM = ['MOV AX,', 'XOR BX,', 'JMP 0x', 'PUSH ', 'CALL 0x', 'INT 21h', 'CMP CX,', 'LEA DI,', 'NOP', 'RET'];
    const towers = [];
    for (const x of [-60, -36, -12, 12, 36, 60]) for (let z = 0; z < L; z += SP) towers.push({ x, z: z + rand(-3, 3), h: rand(60, 160), w: rand(5.5, 8), col: pick([C.ice, C.ice, C.violet]), id: `${hex(2)}-${hex(2)}` });
    // a stable pseudo-random per (tower, line) so a face keeps its code as it scrolls
    const hash = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return (Math.imul(h, 1103515245) >>> 0) / 4294967296; };
    let cz = 0, beams = [], cam = { x: 0, y: 30, z: 0, yaw: 0, pitch: 0 }, near = null;
    const zOf = (t) => ((t.z - cz) % L + L) % L - 24; // relative depth, wrapping the field around us

    // code on a face: lines of varying length in the plane, scrolling up. ax 'z' runs along z at fixed x.
    function code(t, i, fx, fz, ax, w, y0) {
      const off = env.t * (4 + env.level * 10), first = Math.floor((y0 + off) / STEP);
      for (let n = first; n < first + 26; n++) {
        const y = n * STEP - off; if (y < 0.5 || y > t.h) continue;
        const r = hash(i, n); if (r < 0.15) continue; // blank lines
        const ind = Math.floor(r * 7) % 3 * 0.9, len = 0.8 + hash(n, i) * (w - ind - 1.2), col = r > 0.92 ? C.gold : C.neon;
        if (ax === 'z') seg(fx, y, fz - w / 2 + 0.4 + ind, fx, y, fz - w / 2 + 0.4 + ind + len, col, 1, 110);
        else seg(fx - w / 2 + 0.4 + ind, y, fz, fx - w / 2 + 0.4 + ind + len, y, fz, col, 1, 110);
      }
    }

    return {
      label: 'GIBSON TOWERS',
      update(dt) {
        const t = env.t, v = 14 + env.level * 40 + env.warp * 30;
        cz += v * dt;
        // weave the lane, swoop between the floor and the rooftops, look where we are going
        cam.x = Math.sin(cz * 0.03) * 5;
        cam.y = 34 + Math.sin(t * 0.21) * 26 + Math.sin(t * 0.57) * 6;
        const vy = (Math.cos(t * 0.21) * 0.21 * 26 + Math.cos(t * 0.57) * 0.57 * 6) / v;
        cam.z = cz; cam.yaw = Math.cos(cz * 0.03) * 0.03 * 5 + Math.sin(t * 0.13) * 0.28; cam.pitch = Math.atan(vy) * 0.8 - 0.05;
        if (Math.random() < dt * (1 + env.level * 6)) { const a = pick(towers), b = towers.find((o) => o.z === a.z && Math.abs(o.x - a.x) === SP) || pick(towers); beams.push({ a, b, y: cam.y + rand(-15, 25), life: 1 }); }
        for (const b of beams) b.life -= dt * 1.5;
        beams = beams.filter((b) => b.life > 0);
      },
      draw() {
        setCam(cam);
        const cy = cam.y, t = env.t;
        // the floor, far below or close, a sparse grid
        for (let x = -72; x <= 72; x += 12) seg(x, 0, cz - 10, x, 0, cz + 180, C.violet, 0.25, FOG);
        for (let z = Math.ceil(cz / 12) * 12; z < cz + 180; z += 12) seg(-72, 0, z, 72, 0, z, C.violet, 0.25, FOG);
        let best = 1e9; near = null;
        towers.forEach((tw, i) => {
          const zz = zOf(tw), z = cz + zz, x = tw.x, h = tw.h, w = tw.w / 2;
          if (zz > 200) return;
          // glass: four bright edges, faint floors, a lit roof
          for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) seg(x + dx, 0, z + dz, x + dx, h, z + dz, tw.col, 0.85, FOG);
          for (let y = 12; y < h; y += 12) seg(x - w, y, z - w, x + w, y, z - w, tw.col, 0.2, FOG);
          seg(x - w, h, z - w, x + w, h, z - w, C.white, 0.8, FOG); seg(x + w, h, z - w, x + w, h, z + w, C.white, 0.8, FOG); seg(x + w, h, z + w, x - w, h, z + w, C.white, 0.8, FOG); seg(x - w, h, z + w, x - w, h, z - w, C.white, 0.8, FOG);
          const p = (t * 25 + i * 37) % h; seg(x - w, p, z - w, x - w, p + 4, z - w, C.hot, 1, FOG); // a pulse up the corner
          if (zz < -2 || zz > 100 || Math.abs(x) > 40) return;
          // code on the face toward our lane and the face toward us
          code(tw, i, x - Math.sign(x) * w, z, 'z', tw.w, cy - 20);
          code(tw, i + 1000, x, z - w, 'x', tw.w, cy - 20);
          const d = Math.hypot(x - cam.x, z - cam.z); if (d < best && zz > 12) { best = d; near = tw; }
        });
        if (near) { // a few readable lines on the nearest tower
          const z = cz + zOf(near), fx = near.x - Math.sign(near.x) * near.w / 2;
          for (let n = 0; n < 3; n++) { const r = hash(near.id.charCodeAt(0), Math.floor(t * 2) + n); text3(`${ASM[Math.floor(r * ASM.length)]}${((r * 1e6) & 0xffff).toString(16).toUpperCase()}`, fx, cy + 6 - n * 2.2, z - near.w / 2, n ? C.neon : C.gold, 0.45, 0.9 - n * 0.2); }
        }
        for (const b of beams) { const za = cz + zOf(b.a), zb = cz + zOf(b.b); if (Math.abs(za - zb) < 60) seg(b.a.x, b.y, za, b.b.x, b.y, zb, C.hot, b.life, FOG); }

        // HUD in the margins: an altimeter on the left, the tower we are passing on the right
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), ax = W * 0.03;
        for (let y = Math.floor((cy - 40) / 5) * 5; y <= cy + 40; y += 5) {
          const sy = H / 2 + (cy - y) * 9 * s; if (y < 0 || sy < H * 0.12 || sy > H * 0.88) continue;
          line2(ax, sy, ax + (y % 25 ? 12 : 26) * s, sy, C.ice, 0.6);
          if (y % 25 === 0) { g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText(`${y}`, ax + 32 * s, sy + 4 * s); }
        }
        line2(ax - 6 * s, H / 2, ax + 60 * s, H / 2, C.hot, 1);
        g.font = `bold ${15 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText(`ALT ${cy.toFixed(1)}`, ax + 68 * s, H / 2 + 5 * s);
        g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText(`SECTOR ${(Math.floor(cz / L) & 0xff).toString(16).toUpperCase().padStart(2, '0')}`, ax, H * 0.1);
        if (near) {
          const rx = W * 0.85;
          g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText(`TOWER ${near.id}`, rx, H * 0.1);
          g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`;
          g.fillText(`HEIGHT  ${near.h.toFixed(0)} FLOORS`, rx, H * 0.1 + 22 * s);
          g.fillText(`LOAD    ${Math.round(40 + env.level * 55 + Math.sin(t * 3) * 4)}%`, rx, H * 0.1 + 40 * s);
        }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
