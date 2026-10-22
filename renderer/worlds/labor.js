// POLICE LABOR: a harbour on the bay at dawn. The sky warms toward gold, the sun comes up out of
// the water, cranes and container stacks stand along the quay, and a big white-and-black patrol
// robot walks the pier with its light bar turning and its shield on its arm. Its partner rides
// past lying on a trailer truck, and now and then a freighter crosses the bay. Slow and calm:
// the clock creeps from five to half six, then the night shift starts over.
(function (Worlds) {
  Worlds.define('labor', (k) => {
    const { C, rand, env, seg, setCam, lookAt, box, toCam, line2 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 400, DAWN = '255,150,90', BLUE = '60,120,255', RED = '255,50,50';
    const QX = -18; // the quay's edge runs along z at this x; water beyond (x > QX)
    let clock = 5 * 60 + 12, walk = 0, rz = 40, rdir = 1, truck = -60, ship = null, shipT = 8;
    const cont = Array.from({ length: 16 }, (_, i) => ({ x: -34 - (i % 4) * 3.2, z: 60 + Math.floor(i / 4) * 7, h: 1 + ((i * 7) % 3), col: [C.hot, C.ice, C.gold, C.neon][i % 4] }));

    function robot(x, z, ph) { // boxy patrol mecha, about 8 m tall, facing +z or -z
      const sw = Math.sin(ph) * 0.9, lift = Math.max(0, Math.sin(ph)) * 0.3, lift2 = Math.max(0, -Math.sin(ph)) * 0.3;
      box(x - 0.8, lift, z + sw * rdir, 0.9, 3, 1.2, C.white, 0.9, FOG); box(x + 0.8, lift2, z - sw * rdir, 0.9, 3, 1.2, C.white, 0.9, FOG); // legs
      box(x, 3, z, 2.6, 0.8, 1.6, C.ice, 0.7, FOG); // hips, dark
      box(x, 3.8, z, 3, 2.4, 2, C.white, 0.95, FOG); // chest
      box(x - 2, 4.6, z, 1, 1.4, 1.6, C.ice, 0.7, FOG); box(x + 2, 4.6, z, 1, 1.4, 1.6, C.ice, 0.7, FOG); // shoulders
      box(x + 2.1, 2.6, z - sw * 0.5 * rdir, 0.7, 2, 0.8, C.white, 0.9, FOG); // right arm
      box(x - 2.4, 2.2, z + 0.4 * rdir, 0.3, 2.8, 1.8, C.white, 0.9, FOG); // the shield on the left
      box(x, 6.2, z, 1.2, 1, 1.2, C.white, 0.95, FOG); // head
      const on = Math.sin(env.t * 6) > 0; // the light bar
      seg(x - 0.6, 7.3, z, x, 7.3, z, on ? RED : C.white, 1, FOG); seg(x, 7.3, z, x + 0.6, 7.3, z, on ? C.white : BLUE, 1, FOG);
      seg(x - 0.4, 6.7, z + 0.61 * rdir, x + 0.4, 6.7, z + 0.61 * rdir, C.gold, 1, FOG); // visor
    }

    return {
      label: 'POLICE LABOR',
      signal(kind) { if (kind === 'error') shipT = 0; },
      update(dt) {
        clock += dt / 3; if (clock > 6.5 * 60) clock = 5 * 60; // a minute every three seconds
        walk += dt * (1.6 + env.level * 0.8); rz += rdir * dt * (1.2 + env.level * 0.6);
        if (rz > 110) rdir = -1; if (rz < 20) rdir = 1;
        truck += dt * 9; if (truck > 200) truck = -80;
        shipT -= dt; if (!ship && shipT < 0) ship = { z: rand(140, 220), x: 220 };
        if (ship) { ship.x -= dt * 7; if (ship.x < -40) { ship = null; shipT = rand(20, 40); } }
      },
      draw() {
        const t = env.t, sun = (clock - 5 * 60) / 90; // 0 at five, 1 at half six
        setCam(lookAt({ x: QX - 15, y: 7, z: rz - 22 + Math.sin(t * 0.03) * 3 }, QX + 30, 5, rz + 50)); // follows the robot along the quay
        // the sky: bands warming toward the horizon, the sun rising out of the bay
        for (let i = 0; i < 14; i++) {
          const y = 2 + i * i * 0.9, warm = Math.max(0, 1 - i / 10) * (0.4 + sun * 0.6);
          seg(-200, y, 380, 400, y, 380, warm > 0.3 ? DAWN : C.violet, 0.15 + warm * 0.5, 800);
        }
        const p = toCam(120, -6 + sun * 30, 370);
        if (p[2] > 1) {
          const sx = k.W / 2 + p[0] * k.F / p[2], sy = k.H / 2 - p[1] * k.F / p[2], r = 22 * k.F / p[2], hz = k.H / 2 - toCam(120, 0, 370)[1] * k.F / p[2];
          for (let yy = -r; yy < r; yy += 3) { if (sy + yy > hz) break; const w = Math.sqrt(r * r - yy * yy); line2(sx - w, sy + yy, sx + w, sy + yy, yy < 0 ? C.gold : DAWN, 0.8); }
        }
        // the bay: wave lines, brighter in the sun's path
        for (let z = 6; z < 360; z += z < 60 ? 5 : 14) {
          let px = null;
          for (let x = QX; x <= 300; x += 12) {
            const y = Math.sin(x * 0.15 + z * 0.3 + t * 1.2) * 0.25, q = [x, y, z];
            if (px) seg(...px, ...q, Math.abs(x - 120) < 20 + z * 0.1 ? DAWN : C.ice, 0.35 + sun * 0.2, FOG); px = q;
          }
        }
        // the quay: edge, bollards, a road with dashes
        seg(QX, 1.5, 0, QX, 1.5, 300, C.white, 0.8, FOG); seg(QX, 0, 0, QX, 1.5, 0, C.white, 0.5, FOG);
        for (let z = 8; z < 300; z += 12) box(QX - 0.6, 1.5, z, 0.5, 0.6, 0.5, C.gold, 0.6, FOG);
        for (let z = 0; z < 300; z += 8) seg(QX - 9, 1.5, z, QX - 9, 1.5, z + 4, C.gold, 0.5, FOG);
        // cranes along the quay
        for (const cz of [70, 150, 230]) {
          for (const dx of [-4, 4]) { seg(QX - 6, 1.5, cz + dx, QX - 6, 30, cz + dx, C.hot, 0.7, FOG); seg(QX - 14, 1.5, cz + dx, QX - 14, 30, cz + dx, C.hot, 0.7, FOG); }
          seg(QX - 20, 30, cz, QX + 30, 30, cz, C.hot, 0.8, FOG); seg(QX - 10, 38, cz, QX + 30, 30, cz, C.hot, 0.6, FOG); seg(QX - 10, 38, cz, QX - 20, 30, cz, C.hot, 0.6, FOG);
          seg(QX + 18, 30, cz, QX + 18, 12 + Math.sin(t * 0.2 + cz) * 4, cz, C.white, 0.5, FOG);
        }
        for (const c of cont) for (let h = 0; h < c.h; h++) box(c.x, 1.5 + h * 2.6, c.z, 2.6, 2.6, 6, c.col, 0.55, FOG);
        robot(QX - 4, rz, walk);
        // the partner on a trailer, lying down
        const tz = truck;
        box(QX - 12, 1.5, tz + 6, 2.6, 2.4, 3, C.ice, 0.7, FOG); box(QX - 12, 1.5, tz - 2, 2.6, 0.8, 12, C.ice, 0.6, FOG);
        box(QX - 12, 2.3, tz - 2, 2.4, 1.4, 9, C.white, 0.8, FOG); box(QX - 12, 2.3, tz - 7.5, 1.2, 1.2, 1.2, C.white, 0.8, FOG);
        if (ship) { // a freighter crossing the bay
          const { x, z } = ship;
          seg(x - 30, 0, z, x + 30, 0, z, C.white, 0.7, FOG); seg(x - 34, 5, z, x + 32, 5, z, C.white, 0.7, FOG); seg(x - 30, 0, z, x - 34, 5, z, C.white, 0.7, FOG); seg(x + 30, 0, z, x + 32, 5, z, C.white, 0.7, FOG);
          box(x + 22, 5, z, 6, 7, 4, C.white, 0.6, FOG); for (let i = 0; i < 4; i++) box(x - 20 + i * 9, 5, z, 8, 3, 5, [C.hot, C.ice, C.gold, C.neon][i], 0.5, FOG);
        }
        hud(sun);
      },
    };

    function hud(sun) {
      const g = k.g, W = k.W, s = Math.min(W / 1920, k.H / 1080), hh = String(Math.floor(clock / 60)).padStart(2, '0'), mm = String(Math.floor(clock % 60)).padStart(2, '0');
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.9)`; g.fillText('SECTION 2  ::  PATROL', 28 * s, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${DAWN},0.9)`; g.fillText(`HARBOUR WATCH  ${hh}:${mm}`, 28 * s, 56 * s);
      const R = (str, y, col) => { g.fillStyle = `rgba(${col},0.85)`; g.fillText(str, W - 28 * s - g.measureText(str).width, y); };
      R(`WIND SE 3 M/S  ::  ${(14 + sun * 4).toFixed(1)} C`, 34 * s, C.ice);
      R(`TIDE ${sun < 0.5 ? 'RISING' : 'HIGH'}  ::  VIS ${(6 + sun * 14).toFixed(0)} KM`, 54 * s, C.ice);
      R(`UNIT 1 ${rdir > 0 ? 'NORTH' : 'SOUTH'}BOUND  ::  PIER 7`, 74 * s, C.white);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
