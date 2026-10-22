// DATA CENTER: an endless cold aisle. Rows of racks run off forever on both sides, every server
// blinking its lights (faster the harder you work), cable trays overhead, perforated floor tiles,
// containment doors every so often and cross-aisles where more rows run off into the dark. The
// row counter never stops climbing. A failed command trips an alarm: one rack goes red and the
// beacon over it spins until the hall calms down.
(function (Worlds) {
  Worlds.define('datacenter', (k) => {
    const { C, env, seg, setCam, box, ring, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 90, RW = 1.2, RH = 2.3, AISLE = 1.6, BLOCK = 16, X = AISLE + 0.5;
    const hash = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return (Math.imul(h, 1103515245) >>> 0) / 4294967296; };
    let z = 0, alarm = 0, alarmRack = 0, temp = 21;

    function rack(side, i, rz) { // one cabinet; side -1 left, 1 right; its face looks into the aisle
      const fx = side * AISLE, bx = side * (AISLE + 1), red = alarm > 0 && i === alarmRack;
      const col = red ? C.hot : C.ice, near = rz - z < 34;
      seg(fx, 0, rz, fx, RH, rz, col, 0.6, FOG); seg(fx, RH, rz, bx, RH, rz, col, 0.35, FOG); seg(fx, RH, rz, fx, RH, rz + RW, col, 0.6, FOG);
      if (!near) return;
      for (let u = 0; u < 10; u++) { // servers: a front edge and a few lights
        const y = 0.15 + u * 0.21;
        seg(fx, y, rz + 0.06, fx, y, rz + RW - 0.06, col, 0.25, FOG);
        if (rz - z > 22) continue;
        const rate = 2 + env.level * 14;
        for (let l = 0; l < 3; l++) {
          const on = hash(i * 31 + u, l * 977 + Math.floor(env.t * rate * (0.5 + hash(i, u)))) > 0.45;
          if (!on) continue;
          const lz = rz + 0.15 + l * 0.09, c = red ? C.hot : l === 2 && hash(i, u + 50) > 0.85 ? C.gold : C.neon;
          seg(fx, y + 0.07, lz, fx, y + 0.07, lz + 0.04, c, 1, FOG);
        }
      }
    }

    return {
      label: 'DATA CENTER',
      signal(kind) { if (kind === 'error') { alarm = 6; alarmRack = (Math.floor(z / RW) + 6) * 2; if (alarmRack / 2 % BLOCK === 0) alarmRack += 2; } },
      update(dt) {
        z += (1.2 + env.level * 5) * dt;
        alarm = Math.max(0, alarm - dt);
        temp += ((19 + env.level * 9 + (alarm ? 6 : 0)) - temp) * dt * 0.2;
      },
      draw() {
        const t = env.t;
        setCam({ x: Math.sin(t * 0.1) * 0.25, y: 1.65 + Math.sin(t * 1.6) * 0.015, z, yaw: Math.sin(t * 0.07) * 0.08, pitch: -0.02 });
        const i0 = Math.floor(z / RW) - 1;
        for (let i = i0; i < i0 + FOG / RW; i++) {
          const rz = i * RW;
          if (((i % BLOCK) + BLOCK) % BLOCK === 0) { // a cross-aisle: no racks, rows running off sideways
            for (const sx of [-1, 1]) for (let r = 0; r < 6; r++) {
              const xx = sx * (X + 1 + r * 2.4);
              seg(xx, RH, rz - 0.2, xx, RH, rz - 30, C.ice, 0.22, FOG); seg(xx, 0, rz - 0.2, xx, RH, rz - 0.2, C.ice, 0.3, FOG);
            }
            seg(-X - 14, RH + 0.6, rz, X + 14, RH + 0.6, rz, C.violet, 0.3, FOG);
            text3(`ROW ${String(Math.floor(i / BLOCK)).padStart(4, '0')}`, -0.6, RH + 0.3, rz + 0.1, C.gold, 0.18, 0.8);
            continue;
          }
          for (const side of [-1, 1]) rack(side, i * 2 + (side > 0), rz);
          // floor tiles across the aisle, perforated ones down the middle
          seg(-AISLE, 0, rz, AISLE, 0, rz, C.violet, 0.3, FOG);
          if (rz - z < 20) for (let p = -0.4; p <= 0.4; p += 0.2) seg(p, 0, rz + 0.3, p, 0, rz + 0.9, C.violet, 0.2, FOG);
          // cable trays: ladders overhead, with bundles riding them
          seg(-0.6, RH + 0.4, rz, 0.6, RH + 0.4, rz, C.gold, 0.35, FOG);
          if (((i % 4) + 4) % 4 === 1) { ring(0, RH + 0.75, rz, 0.15, 6, C.white, 0.3, FOG, 'xy'); seg(-1.2, 3.2, rz, 1.2, 3.2, rz, C.white, 0.6, FOG); } // a light strip
          if (((i % BLOCK) + BLOCK) % BLOCK === 8) { // containment doors
            for (const sx of [-1, 1]) { seg(sx * AISLE, 0, rz, sx * 0.05, 0, rz, C.ice, 0.15, FOG); seg(sx * AISLE, RH, rz, sx * 0.05, RH, rz, C.ice, 0.4, FOG); seg(sx * 0.05, 0, rz, sx * 0.05, RH, rz, C.ice, 0.4, FOG); }
          }
        }
        for (const sx of [-0.6, 0.6]) seg(sx, RH + 0.4, z, sx, RH + 0.4, z + FOG, C.gold, 0.35, FOG);
        for (const sx of [-1, 1]) seg(sx * AISLE, 0, z, sx * AISLE, 0, z + FOG, C.violet, 0.4, FOG);
        if (alarm > 0) { // the beacon over the tripped rack
          const az = Math.floor(alarmRack / 2) * RW + RW / 2, a = t * 8;
          ring(-AISLE + 0.2, RH + 0.15, az, 0.12, 8, C.hot, 1, FOG);
          seg(-AISLE + 0.2, RH + 0.15, az, -AISLE + 0.2 + Math.cos(a) * 3, RH + 0.15, az + Math.sin(a) * 3, C.hot, 0.6, FOG);
        }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), row = Math.floor(z / RW / BLOCK);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText(`HALL 7  ::  ROW ${String(row).padStart(4, '0')}  ::  RACK ${String(Math.floor(z / RW) % BLOCK).padStart(2, '0')}`, 28 * s, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.75)`;
      g.fillText(`${(row * 640 + 4096).toLocaleString('en-US')} RACKS  ::  ${(1.2 + env.level * 3.4).toFixed(1)} MW IT LOAD  ::  PUE ${(1.12 + env.level * 0.2).toFixed(2)}`, 28 * s, 56 * s);
      const tc = temp > 27 ? C.hot : temp > 24 ? C.gold : C.neon, tt = `INLET ${temp.toFixed(1)} C`;
      g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${tc},0.9)`; g.fillText(tt, W - 28 * s - g.measureText(tt).width, 38 * s);
      if (alarm > 0 && Math.sin(env.t * 10) > 0) {
        g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`;
        const m = `ALARM :: RACK ${alarmRack} :: PSU FAULT`; g.fillText(m, W - 28 * s - g.measureText(m).width, 62 * s);
      }
      // a strip of load bars along the bottom-left, one per pod
      for (let p = 0; p < 16; p++) {
        const v = Math.min(1, 0.2 + env.level * 0.6 + hash(p, Math.floor(env.t * 2)) * 0.25), x = 28 * s + p * 14 * s, h = 40 * s * v;
        g.fillStyle = `rgba(${v > 0.85 ? C.hot : C.neon},0.7)`; g.fillRect(x, H - 24 * s - h, 9 * s, h);
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
