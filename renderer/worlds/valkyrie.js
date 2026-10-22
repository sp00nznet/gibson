// VALKYRIE: a variable fighter on a turntable in the hangar, showing off its three modes on a
// loop: fighter, GERWALK (legs down, arms out) and battroid (standing). Every point of the
// wireframe has a place in each mode, and the transformation is those points gliding from one
// set to the next. The spec sheet sits in the corner and the mode strip along the bottom.
// A successful command makes it transform right away.
(function (Worlds) {
  Worlds.define('valkyrie', (k) => {
    const { C, env, seg, setCam, lookAt, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 120;
    const MODES = ['FIGHTER', 'GERWALK', 'BATTROID'], ORDER = [0, 1, 2, 1], HOLD = 4, MORPH = 2.2;
    // left-side points (x <= 0) in [fighter, gerwalk, battroid]; centre points have x = 0
    const PTS = {
      nose: [[0, 0, 5], [0, 1.5, 5], [0, 2.4, -1.4]],
      cf: [[0, 0.5, 3], [0, 2, 3], [0, 4.4, 0.7]],
      cb: [[0, 0.6, 1.2], [0, 2.1, 1.2], [0, 4.8, -0.3]],
      bc: [[0, 0, 0], [0, 1.5, 0], [0, 4, 0]],
      br: [[0, 0, -3], [0, 1.5, -3], [0, 2.7, 0]],
      hb: [[0, 0, -0.5], [0, 1.5, -0.5], [0, 5.1, 0]],
      ht: [[0, 0.05, -0.5], [0, 1.55, -0.5], [0, 6, 0.2]],
      wl: [[-1, 0, 0.5], [-1, 1.5, 0.5], [-0.8, 4.6, -0.8]],
      wt: [[-6, 0, -2], [-5.4, 1.5, -2], [-1.6, 5.2, -1.8]],
      wr: [[-1, 0, -2.5], [-1, 1.5, -2.5], [-0.8, 4.2, -1.1]],
      fb: [[-0.8, 0.2, -3.5], [-0.8, 1.7, -3.5], [-0.6, 2.2, -1.2]],
      ft: [[-1.3, 2, -4.6], [-1.3, 3.5, -4.6], [-1, 3.4, -2.3]],
      hip: [[-0.7, -0.2, -1], [-0.7, 1.2, -1], [-0.8, 2.5, 0]],
      knee: [[-0.7, -0.3, -3.6], [-0.8, -0.6, -0.4], [-0.9, 1.2, 0.3]],
      foot: [[-0.7, -0.3, -5.1], [-0.8, -2.5, -1.1], [-0.9, 0, 0]],
      toe: [[-0.7, -0.7, -5.1], [-0.8, -2.6, 0.3], [-0.9, 0, 1.1]],
      sh: [[-0.6, -0.1, 1.5], [-1.2, 1.2, 1.2], [-1.4, 4.4, 0]],
      el: [[-0.5, -0.2, 2.5], [-1.6, 0.6, 2.2], [-1.8, 3.2, 0.3]],
      hd: [[-0.4, -0.2, 3], [-1.8, 0.6, 3.4], [-1.8, 2.2, 1]],
      g0: [[-0.3, -0.5, 1], [-1.8, 0.6, 3.4], [-1.8, 2.2, 1]], // the gun pod, left hand only
      g1: [[-0.3, -0.5, 3.6], [-1.8, 0.6, 5.6], [-1.8, 2.2, 3.4]],
    };
    const LIFT = [3, 3, 0]; // fighter and gerwalk hover; the battroid stands
    const EDGES = [['nose', 'cf'], ['cf', 'cb'], ['cb', 'bc'], ['bc', 'br'], ['cb', 'hb'], ['hb', 'ht']];
    const SIDE = [['nose', 'wl'], ['wl', 'wt'], ['wt', 'wr'], ['wr', 'br'], ['wl', 'bc'], ['br', 'fb'], ['fb', 'ft'], ['ft', 'wr'], ['br', 'hip'], ['hip', 'knee'], ['knee', 'foot'], ['foot', 'toe'], ['bc', 'sh'], ['sh', 'el'], ['el', 'hd']];
    let pos = 0, hold = HOLD, from = 0, to = 1, f = 0;
    const ease = (x) => x * x * (3 - 2 * x);
    const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    function at(name, sx) { // where a point is now, mirrored for the right side
      const p = lerp(PTS[name][from], PTS[name][to], ease(f)), y = LIFT[from] + (LIFT[to] - LIFT[from]) * ease(f);
      return [p[0] * sx, p[1] + y + Math.sin(env.t * 1.4) * 0.15 * (y > 0.5 ? 1 : 0), p[2]];
    }

    return {
      label: 'VALKYRIE',
      signal(kind) { if (kind === 'ok' && f === 0) hold = 0; },
      update(dt) {
        if (f === 0) { hold -= dt; if (hold <= 0) { from = ORDER[pos % 4]; to = ORDER[(pos + 1) % 4]; f = 0.0001; } }
        else { f = Math.min(1, f + dt / MORPH); if (f === 1) { pos++; from = to; f = 0; hold = HOLD / (0.7 + env.level * 0.6); } }
      },
      draw() {
        const t = env.t, a = t * 0.25;
        setCam(lookAt({ x: Math.sin(a) * 15, y: 5 + Math.sin(t * 0.13) * 1.5, z: Math.cos(a) * 15 }, 0, 2.5, 0));
        // the hangar: floor grid, the turntable, wall ribs
        for (let x = -24; x <= 24; x += 3) seg(x, 0, -24, x, 0, 24, C.violet, 0.2, FOG);
        for (let z = -24; z <= 24; z += 3) seg(-24, 0, z, 24, 0, z, C.violet, 0.2, FOG);
        ring(0, 0.02, 0, 7, 40, C.ice, 0.5 + env.pulse * 0.3, FOG); ring(0, 0.02, 0, 7.4, 40, C.ice, 0.3, FOG);
        for (let i = 0; i < 12; i++) { const q = i / 12 * Math.PI * 2 + t * 0.1; seg(Math.cos(q) * 6.5, 0.02, Math.sin(q) * 6.5, Math.cos(q) * 7, 0.02, Math.sin(q) * 7, C.ice, 0.6, FOG); }
        for (let i = 0; i < 10; i++) { const q = i / 10 * Math.PI * 2; seg(Math.cos(q) * 22, 0, Math.sin(q) * 22, Math.cos(q) * 22, 14, Math.sin(q) * 22, C.violet, 0.3, FOG); }
        const col = f > 0 ? C.gold : C.white;
        for (const [p, q] of EDGES) seg(...at(p, 1), ...at(q, 1), col, 0.95, FOG);
        for (const sx of [-1, 1]) for (const [p, q] of SIDE) seg(...at(p, sx), ...at(q, sx), sx < 0 ? col : C.ice, 0.95, FOG);
        seg(...at('g0', 1), ...at('g1', 1), C.hot, 0.9, FOG);
        // exhaust from the feet while airborne
        const air = LIFT[from] + (LIFT[to] - LIFT[from]) * ease(f);
        if (air > 0.5) for (const sx of [-1, 1]) { const p = at('foot', sx), q = at('toe', sx), dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2]; seg(...p, p[0] + dx * 2, p[1] + dy * 2, p[2] + dz * 2, C.hot, 0.5 + env.pulse * 0.5, FOG); }
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${30 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`;
      g.fillText(f > 0 ? `${MODES[from]} > ${MODES[to]}` : MODES[from], 28 * s, 44 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`;
      g.fillText(f > 0 ? `TRANSFORMING  ${Math.round(ease(f) * 100)}%` : 'MODE LOCKED', 28 * s, 68 * s);
      const spec = ['VARIABLE FIGHTER  VF-X', 'LENGTH       14.2 M', 'MASS         13.2 T', 'ENGINES      2 x THERMONUCLEAR', 'MAX SPEED    MACH 2.7', 'ARMAMENT     GUN POD, 12 MSL', 'PILOT        ON STANDBY'];
      const sw = Math.max(...spec.map((l) => g.measureText(l).width));
      spec.forEach((l, i) => { g.fillStyle = `rgba(${i ? C.ice : C.gold},${i ? 0.75 : 0.9})`; g.fillText(l, W - 28 * s - sw, (34 + i * 20) * s); });
      for (let i = 0; i < 3; i++) { // the mode strip
        const x = 28 * s + i * 150 * s, y = H - 50 * s, on = i === (f > 0.5 ? to : from);
        g.strokeStyle = `rgba(${on ? C.gold : C.ice},${on ? 0.95 : 0.4})`; g.lineWidth = 1.5; g.strokeRect(x, y - 18 * s, 136 * s, 26 * s);
        g.fillStyle = `rgba(${on ? C.gold : C.ice},${on ? 0.95 : 0.5})`; g.fillText(MODES[i], x + 10 * s, y);
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
