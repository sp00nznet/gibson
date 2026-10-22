// SETI: the radio-search screensaver. A waterfall of power spectra: each new slice of sky noise
// lands at the front and the old ones march back, the peaks lit by height. Now and then a drifting
// blip climbs out of the noise and the corner calls it a CANDIDATE SIGNAL. The data unit's progress
// follows your work (fastest during a build); the Gaussian fit, best scores, and where in the sky
// this unit was recorded sit in the corners.
(function (Worlds) {
  Worlds.define('seti', (k) => {
    const { C, rand, env, seg, setCam, lookAt } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 160, BINS = 48, ROWS = 30, BW = 2.6, RD = 2.6;
    const noise = () => -Math.log(1 - Math.random() * 0.999) * 0.6; // exponential, like a power spectrum
    let rows = [], acc = 0, pct = 0, unit = 0, cand = null, candT = rand(12, 25), best = null, cpu = 0, sky = null, fit = [];
    function newUnit() {
      unit++; pct = 0;
      sky = { ra: `${String(rand(0, 24) | 0).padStart(2, '0')}h ${String(rand(0, 60) | 0).padStart(2, '0')}m ${String(rand(0, 60) | 0).padStart(2, '0')}s`, dec: `${Math.random() < 0.5 ? '-' : '+'}${String(rand(0, 35) | 0).padStart(2, '0')}° ${String(rand(0, 60) | 0).padStart(2, '0')}'`, freq: (1.4204 + rand(-0.0012, 0.0012)).toFixed(6) };
      best = { gauss: rand(0.3, 1.2), fit: rand(1, 3), pulse: rand(0.2, 1), triplet: rand(0.2, 1) };
    }
    function row() { // one slice: noise, plus the candidate if one is drifting through
      const r = Array.from({ length: BINS }, noise);
      if (cand) {
        for (let b = 0; b < BINS; b++) r[b] += cand.p * Math.exp(-((b - cand.b) ** 2) / 3);
        cand.b += cand.drift; cand.n--;
        best.gauss = Math.max(best.gauss, cand.p * 0.9); best.fit = Math.min(best.fit, 0.4 + Math.random() * 0.3);
        if (cand.n <= 0) cand = null;
      }
      rows.unshift(r); if (rows.length > ROWS) rows.pop();
    }
    newUnit();
    for (let i = 0; i < ROWS; i++) row();

    return {
      label: 'SETI',
      signal(kind) { if (kind === 'commit') candT = 0; },
      update(dt) {
        acc += dt * (4 + env.level * 8);
        while (acc >= 1) { acc--; row(); }
        candT -= dt;
        if (candT < 0 && !cand) { cand = { b: rand(8, BINS - 8), drift: rand(-0.15, 0.15), p: rand(4, 8), n: 30 }; candT = rand(18, 35); }
        pct += dt * (0.05 + env.level * 0.6 + (env.build > 4 ? 2 : 0));
        if (pct >= 100) newUnit();
        cpu += dt * (1 + env.level * 3);
        if (Math.random() < dt * 2) best.pulse = Math.max(best.pulse, rand(0, 1.3)), best.triplet = Math.max(best.triplet, rand(0, 1.1));
        // the fit graph's points: a gaussian when there's a candidate, scatter when not
        fit = Array.from({ length: 40 }, (_, i) => { const x = i / 39; return cand ? Math.exp(-((x - 0.5) ** 2) / 0.02) * 0.8 + rand(-0.08, 0.08) : rand(0, 0.35); });
      },
      draw() {
        const t = env.t, W0 = BINS * BW;
        setCam(lookAt({ x: Math.sin(t * 0.07) * 10, y: 16 + Math.sin(t * 0.11) * 3, z: -12 }, 0, 2, ROWS * RD * 0.3));
        for (let ri = 0; ri < rows.length; ri++) {
          const r = rows[ri], z = ri * RD, fade = 1 - ri / ROWS;
          for (let b = 1; b < BINS; b++) {
            const h0 = r[b - 1] * 1.6, h1 = r[b] * 1.6, h = Math.max(h0, h1);
            const col = h > 7 ? C.hot : h > 3.5 ? C.gold : h > 1.5 ? C.ice : C.violet;
            seg((b - 1) * BW - W0 / 2, h0, z, b * BW - W0 / 2, h1, z, col, 0.35 + 0.65 * fade, FOG);
          }
          if (ri && ri % 2 === 0) for (let b = 0; b < BINS; b += 4) seg(b * BW - W0 / 2, rows[ri - 2][b] * 1.6, z - RD * 2, b * BW - W0 / 2, r[b] * 1.6, z, C.violet, 0.3 * fade, FOG);
        }
        // the frequency axis along the front
        seg(-W0 / 2, 0, -1, W0 / 2, 0, -1, C.white, 0.5, FOG);
        for (let b = 0; b <= BINS; b += 8) seg(b * BW - W0 / 2, 0, -1, b * BW - W0 / 2, -0.8, -1, C.white, 0.5, FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 28 * s;
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('RADIO SEARCH  ::  AT HOME', x0, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.8)`;
      g.fillText(`UNIT ${String(unit).padStart(5, '0')}  ${pct.toFixed(3)}% COMPLETE`, x0, 56 * s);
      g.strokeStyle = `rgba(${C.white},0.5)`; g.lineWidth = 1; g.strokeRect(x0, 64 * s, 260 * s, 8 * s);
      g.fillStyle = `rgba(${C.gold},0.8)`; g.fillRect(x0 + 1, 65 * s, 258 * s * pct / 100, 6 * s);
      const hrs = Math.floor(cpu / 3600), mins = Math.floor(cpu / 60) % 60, secs = Math.floor(cpu) % 60;
      g.fillStyle = `rgba(${C.ice},0.8)`;
      [`RA ${sky.ra}  DEC ${sky.dec}`, `BASE FREQ ${sky.freq} GHz`, 'TELESCOPE ARRAY 7', `CPU TIME ${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`].forEach((l, i) => g.fillText(l, x0, (94 + i * 18) * s));
      // best scores, bottom left
      g.fillStyle = `rgba(${C.white},0.75)`;
      [`BEST GAUSSIAN  power ${best.gauss.toFixed(2)}  fit ${best.fit.toFixed(2)}`, `BEST PULSE     power ${best.pulse.toFixed(2)}`, `BEST TRIPLET   power ${best.triplet.toFixed(2)}`].forEach((l, i) => g.fillText(l, x0, H - (70 - i * 18) * s));
      // the gaussian fit graph, top right
      const gw = 260 * s, gh = 110 * s, gx = W - 28 * s - gw, gy = 26 * s;
      g.strokeStyle = `rgba(${C.white},0.45)`; g.strokeRect(gx, gy, gw, gh);
      g.fillStyle = `rgba(${C.ice},0.9)`; fit.forEach((v, i) => g.fillRect(gx + 4 + i / 39 * (gw - 8) - 1.5, gy + gh - 4 - v * (gh - 8) - 1.5, 3, 3));
      if (cand) {
        g.strokeStyle = `rgba(${C.hot},0.9)`; g.beginPath();
        for (let i = 0; i <= 60; i++) { const x = i / 60, y = Math.exp(-((x - 0.5) ** 2) / 0.02) * 0.8; const px = gx + 4 + x * (gw - 8), py = gy + gh - 4 - y * (gh - 8); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke();
      }
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; g.fillText('GAUSSIAN FIT', gx, gy + gh + 16 * s);
      if (cand && Math.sin(env.t * 8) > -0.3) {
        g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`;
        const m = 'CANDIDATE SIGNAL'; g.fillText(m, W - 28 * s - g.measureText(m).width, gy + gh + 44 * s);
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
