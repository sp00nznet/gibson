// STARFIGHTER: the Gunstar's cockpit at the Frontier. Ko-Dan deckfighters come in waves from the
// command ship, the twin guns converge on them, and every 20 kills (or a commit) it's the DEATH
// BLOSSOM: the ship spins and fires in every direction until the sky is clear. Before the first
// wave, the attract screen: GREETINGS, STARFIGHTER.
(function (Worlds) {
  Worlds.define('starfighter', (k) => {
    const { C, rand, env, seg, setCam, ship, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 240;
    let foes = [], beams = [], bits = [], kills = 0, wave = 0, blossom = 0, greet = 6, cool = 0, roll = 0, sinceBlossom = 0;
    function spawn() {
      wave++;
      const n = 4 + Math.min(8, wave), cx = rand(-45, 45), cy = rand(-12, 16);
      for (let i = 0; i < n; i++) foes.push({ x: cx + (i - n / 2) * 6, y: cy + Math.sin(i) * 3, z: 200 + i * 6, ph: rand(0, 6), v: rand(18, 30) });
    }
    function boom(f, col) { for (let i = 0; i < 14; i++) bits.push({ x: f.x, y: f.y, z: f.z, vx: rand(-14, 14), vy: rand(-14, 14), vz: rand(-14, 14), t: rand(0.5, 1.2), col }); }
    function kill(f) { f.dead = true; boom(f, Math.random() < 0.5 ? C.gold : C.hot); kills++; sinceBlossom++; }
    return {
      label: 'STARFIGHTER',
      enter() { greet = 6; },
      signal(kind) { if (kind === 'commit') blossom = 4; },
      update(dt) {
        greet -= dt; if (greet > 0) return;
        if (!foes.length || (foes.length < 4 && Math.random() < dt * 0.5)) spawn();
        for (const f of foes) { f.z -= (f.v + env.level * 30) * dt; f.x += Math.sin(env.t * 1.3 + f.ph) * dt * 6; f.y += Math.cos(env.t * 0.9 + f.ph) * dt * 3; if (f.z < 3) f.dead = true; }
        cool -= dt;
        if (blossom > 0) { // spin, and fire everywhere
          blossom -= dt; roll += dt * 7;
          for (const f of foes) if (!f.dead && Math.random() < dt * 3) { beams.push({ x: f.x, y: f.y, z: f.z, t: 0.15, all: true }); kill(f); }
        } else {
          roll *= 1 - dt * 3;
          if (cool < 0) {
            const tgt = foes.filter((f) => !f.dead && f.z < 70).sort((a, b) => a.z - b.z)[0];
            if (tgt) { beams.push({ x: tgt.x, y: tgt.y, z: tgt.z, t: 0.18 }); kill(tgt); }
            cool = rand(0.25, 0.8) / (0.6 + env.level);
          }
          if (sinceBlossom >= 20) { blossom = 4; sinceBlossom = 0; }
        }
        foes = foes.filter((f) => !f.dead);
        for (const b of beams) b.t -= dt;
        beams = beams.filter((b) => b.t > 0);
        for (const p of bits) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.t -= dt; }
        bits = bits.filter((p) => p.t > 0);
      },
      draw() {
        const t = env.t;
        setCam({ x: 0, y: 0, z: 0, yaw: Math.sin(t * 0.2) * 0.04, pitch: Math.sin(t * 0.15) * 0.03, roll });
        // the Frontier: a curtain of light far ahead, and the Ko-Dan command ship behind it
        for (let x = -160; x <= 160; x += 16) seg(x, -80, 210, x, 80, 210, C.violet, 0.12 + env.pulse * 0.1, 400);
        for (let y = -80; y <= 80; y += 16) seg(-160, y, 210, 160, y, 210, C.violet, 0.12, 400);
        const mx = Math.sin(t * 0.05) * 40;
        for (let i = 0; i < 3; i++) ring(mx, 30, 300, 26 - i * 7, 32, C.hot, 0.7, 500);
        seg(mx - 60, 30, 300, mx + 60, 30, 300, C.hot, 0.8, 500); seg(mx, 30, 300, mx, 30, 360, C.hot, 0.6, 500);
        if (greet > 0) return hud(true);
        for (const f of foes) {
          ship(f.x, f.y, f.z, Math.PI, 1.6, C.hot, 1, Math.sin(t * 2 + f.ph) * 0.5);
          seg(f.x - 2.2, f.y, f.z, f.x + 2.2, f.y, f.z, C.gold, 0.8); // the deckfighter's wing bar
        }
        for (const b of beams) {
          if (b.all) { for (let a = 0; a < 8; a++) { const r = a / 8 * Math.PI * 2 + roll; seg(Math.cos(r) * 2, Math.sin(r) * 2, 2, Math.cos(r) * 90, Math.sin(r) * 90, 60, C.neon, 1, 200); } }
          for (const s of [-1, 1]) seg(s * 2.5, -1.6, 1, b.x, b.y, b.z, C.neon, 1, 200);
        }
        for (const p of bits) seg(p.x, p.y, p.z, p.x + p.vx * 0.05, p.y + p.vy * 0.05, p.z + p.vz * 0.05, p.col, Math.min(1, p.t * 2), 200);
        hud(false);
      },
    };
    function hud(attract) {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      // canopy struts
      g.strokeStyle = `rgba(${C.ice},0.6)`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, H * 0.18); g.lineTo(W * 0.12, 0); g.moveTo(W, H * 0.18); g.lineTo(W * 0.88, 0);
      g.moveTo(0, H * 0.82); g.lineTo(W * 0.14, H); g.moveTo(W, H * 0.82); g.lineTo(W * 0.86, H); g.stroke();
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`;
      g.fillText(`KO-DAN DESTROYED ${String(kills).padStart(4, '0')}`, 28 * s, 40 * s);
      g.fillStyle = `rgba(${C.ice},0.85)`; g.fillText(`WAVE ${String(wave).padStart(2, '0')}`, 28 * s, 64 * s);
      const right = (str, y, col) => { g.fillStyle = `rgba(${col},0.9)`; g.fillText(str, W - 28 * s - g.measureText(str).width, y); };
      right('GUNSTAR  ::  STAR LEAGUE', 40 * s, C.ice);
      right(`BLOSSOM ${'#'.repeat(Math.min(20, sinceBlossom)).padEnd(20, '.')}`, 64 * s, blossom > 0 ? C.hot : C.neon);
      if (blossom > 0 && Math.sin(env.t * 20) > 0) { g.font = `bold ${44 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; const m = 'DEATH BLOSSOM'; g.fillText(m, (W - g.measureText(m).width) / 2, H - 60 * s); }
      if (attract) {
        const lines = ['GREETINGS, STARFIGHTER.', 'YOU HAVE BEEN RECRUITED BY THE STAR LEAGUE', 'TO DEFEND THE FRONTIER AGAINST XUR', 'AND THE KO-DAN ARMADA.'];
        g.font = `bold ${22 * s | 0}px ${MONO}`;
        lines.forEach((l, i) => { const shown = l.slice(0, Math.max(0, Math.floor((6 - greet) * 28 - i * 30))); g.fillStyle = `rgba(${i ? C.ice : C.gold},0.95)`; g.fillText(shown, (W - g.measureText(l).width) / 2, H - (150 - i * 30) * s); });
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
