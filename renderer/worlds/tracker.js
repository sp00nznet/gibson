// MOTION TRACKER: walking a ship's corridor, ribbed frames and pipes going by, warning lights
// flashing, while the tracker in the bottom-left corner pings. Blips close in, the readout counts
// the metres down, and the close ones drop out of the ceiling ahead into the sentry guns' fire;
// the ammo counter top right runs down and reloads. More blips the busier you are; a failed
// command brings a swarm.
(function (Worlds) {
  Worlds.define('tracker', (k) => {
    const { C, rand, env, seg, setCam, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 70, RIB = 4, RANGE = 40, GREEN = '120,255,140';
    // the corridor's cross-section: an octagon, a bit squashed
    const OCT = Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) / 8 * Math.PI * 2; return [Math.cos(a) * 3.4, 1.6 + Math.sin(a) * 2.2]; });
    let camZ = 0, blips = [], ping = 0, pingT = 0, ammo = [500, 500], reload = [0, 0], shots = [], kills = 0, beep = 0;
    const spawn = (n) => { for (let i = 0; i < n; i++) blips.push({ x: rand(-2.5, 2.5), d: rand(RANGE * 0.6, RANGE), side: rand(-1, 1), v: rand(1.5, 3.5), lit: 0, drop: 0 }); };
    const hh = (n) => { const x = Math.sin(n * 127.1) * 43758.5; return x - Math.floor(x); };

    return {
      label: 'MOTION TRACKER',
      signal(kind) { if (kind === 'error') spawn(12); },
      update(dt) {
        const walk = 1.4 + env.level * 2.2;
        camZ += walk * dt;
        if (Math.random() < dt * (0.25 + env.level * 1.2)) spawn(1);
        for (const b of blips) {
          b.d -= (b.v + walk) * dt; b.side *= 1 - dt * 0.3; // they come straight at you in the end
          if (b.d < 9) b.drop = Math.min(1, b.drop + dt * 2.5);
        }
        // the sentries: two guns, each takes the nearest thing that has dropped
        for (let gi = 0; gi < 2; gi++) {
          if (reload[gi] > 0) { reload[gi] -= dt; if (reload[gi] <= 0) ammo[gi] = 500; continue; }
          const tgt = blips.filter((b) => b.drop > 0.6 && !b.dead).sort((a, b) => a.d - b.d)[gi % 2 ? 1 : 0] || blips.find((b) => b.drop > 0.6 && !b.dead);
          if (tgt && Math.random() < dt * 14) {
            ammo[gi] = Math.max(0, ammo[gi] - Math.floor(rand(3, 9))); shots.push({ g: gi, x: tgt.x, z: camZ + tgt.d, t: 0.06 });
            tgt.hp = (tgt.hp || 6) - 1; if (tgt.hp <= 0) { tgt.dead = true; kills++; }
            if (ammo[gi] === 0) reload[gi] = 3;
          }
        }
        blips = blips.filter((b) => !b.dead && b.d > 1);
        for (const s of shots) s.t -= dt;
        shots = shots.filter((s) => s.t > 0);
        // the ping: a wave out from the tracker; a blip lights as it passes
        pingT -= dt; ping += dt * RANGE * 1.4;
        const near = blips.reduce((m, b) => Math.min(m, b.d), 99);
        if (pingT <= 0) { pingT = Math.max(0.25, Math.min(1.3, near / 25)); ping = 0; beep = 1; }
        beep = Math.max(0, beep - dt * 4);
        for (const b of blips) { if (Math.abs(b.d - ping) < 2) b.lit = 1; b.lit = Math.max(0, b.lit - dt * 0.8); }
      },
      draw() {
        const t = env.t, bob = Math.sin(camZ * 2.2) * 0.06;
        setCam({ x: Math.sin(t * 0.3) * 0.2, y: 1.7 + bob, z: camZ, yaw: Math.sin(t * 0.21) * 0.05, pitch: -0.02 });
        const r0 = Math.floor(camZ / RIB);
        for (let r = r0; r < r0 + FOG / RIB; r++) {
          const z = r * RIB, z2 = z + RIB;
          for (let i = 0; i < 8; i++) {
            const [ax, ay] = OCT[i], [bx, by] = OCT[(i + 1) % 8];
            seg(ax, ay, z, bx, by, z, C.ice, 0.7, FOG); // the rib
            seg(ax, ay, z, ax, ay, z2, C.ice, 0.25, FOG); // the long lines
            seg(ax * 0.9, ay * 0.95 + 0.08, z + 0.4, bx * 0.9, by * 0.95 + 0.08, z + 0.4, C.ice, 0.2, FOG);
          }
          for (let x = -2.6; x <= 2.6; x += 0.65) seg(x, 0, z, x, 0, z2, C.neon, 0.18, FOG); // floor grating
          for (const px of [-1.8, -1.5, 1.6]) seg(px, 3.55, z, px, 3.55, z2, C.gold, 0.4, FOG); // pipes along the roof
          if (hh(r) < 0.25) { const on = Math.sin(t * 6 + r) > 0; box(hh(r + 9) < 0.5 ? -2.7 : 2.7, 2.6, z + 1, 0.3, 0.3, 0.3, on ? C.hot : C.gold, on ? 1 : 0.3, FOG); } // warning lights
          if (hh(r + 3) < 0.15) for (let y = 0.3; y < 2.8; y += 0.5) seg(-3.2, y, z + 2, -2.6, y, z + 2, C.violet, 0.5, FOG); // a vent
        }
        // what dropped from the roof
        for (const b of blips) if (b.drop > 0) {
          const z = camZ + b.d, x = b.x + b.side, y = 3.7 - b.drop * 3.7, col = C.hot;
          const L = (ax, ay, az, bx, by, bz) => seg(x + ax, y + ay, z + az, x + bx, y + by, z + bz, col, 0.9, FOG);
          L(0, 1.7, 0, 0, 1.0, 0); L(0, 1.7, 0, 0.1, 2.0, 0.9); L(0.1, 2.0, 0.9, 0, 1.8, 1.5); // head, long and swept back
          L(0, 1.0, 0, 0, 0.6, 0.3); L(0, 1.0, 0, -0.6, 0.2, 0); L(0, 1.0, 0, 0.6, 0.2, 0); // arms
          L(0, 0.6, 0.3, -0.4, 0, 0.2); L(0, 0.6, 0.3, 0.4, 0, 0.2); L(0, 0.6, 0.3, 0, 0.5, 1.6); // legs, tail
        }
        for (const s of shots) seg(s.g ? 1.2 : -1.2, 0.6, camZ + 1, s.x, 1, s.z, C.gold, 1, FOG);
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), R = 150 * s, cx = 28 * s + R, cy = H - 40 * s;
      // the tracker: a fan facing forward, range rings, the wave, the blips
      g.lineWidth = 1.5;
      g.strokeStyle = `rgba(${GREEN},${0.35 + beep * 0.5})`;
      for (let r = 1; r <= 4; r++) { g.beginPath(); g.arc(cx, cy, R * r / 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      for (const a of [1.15, 1.5, 1.85]) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a * Math.PI) * R, cy + Math.sin(a * Math.PI) * R); g.stroke(); }
      const pr = Math.min(1, ping / RANGE) * R;
      g.strokeStyle = `rgba(${GREEN},${0.8 * (1 - pr / R)})`; g.beginPath(); g.arc(cx, cy, pr, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      for (const b of blips) {
        if (b.d > RANGE) continue;
        const a = -Math.PI / 2 + Math.atan2(b.x + b.side, b.d) * 1.5, r = b.d / RANGE * R;
        g.fillStyle = `rgba(${GREEN},${0.15 + b.lit * 0.85})`; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, (4 + b.lit * 4) * s, 0, Math.PI * 2); g.fill();
      }
      const near = blips.reduce((m, b) => Math.min(m, b.d), Infinity);
      g.font = `bold ${30 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${GREEN},0.95)`;
      g.fillText(near === Infinity ? '--.-' : near.toFixed(1).padStart(4, '0'), cx - R, cy - R - 16 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillText(`M   ${blips.length} CONTACTS`, cx - R + 90 * s, cy - R - 18 * s);
      // the sentries, top right
      const x1 = W - 28 * s;
      ['A', 'B'].forEach((n, i) => {
        const y = (40 + i * 46) * s, v = reload[i] > 0 ? 'RELOAD' : String(ammo[i]).padStart(4, '0');
        g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; const lab = `SENTRY ${n}`; g.fillText(lab, x1 - 150 * s, y - 6 * s);
        g.font = `bold ${28 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${ammo[i] < 100 || reload[i] > 0 ? '255,70,60' : C.gold},0.95)`; g.fillText(v, x1 - g.measureText(v).width, y + 18 * s);
      });
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; const kl = `CONFIRMED ${kills}`; g.fillText(kl, x1 - g.measureText(kl).width, 150 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
