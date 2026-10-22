// DEFRAG: the 90s disk optimizer. The drive is a plane of clusters running away from the camera:
// fragmented files scattered through free space, a few unmovable system clusters, and the packed,
// optimized region growing from the front. The head reads a cluster (red, it lifts) and writes it
// at the front (green), one at a time, faster the harder you work and fastest during a build.
// When it's done it says so, then the disk fragments again. A flat classic map sits in a corner.
(function (Worlds) {
  Worlds.define('defrag', (k) => {
    const { C, env, seg, setCam, lookAt } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 140, COLS = 48, ROWS = 30, N = COLS * ROWS, CS = 1.2;
    const FREE = 0, FRAG = 1, DONE = 2, FIXED = 3;
    const cell = new Uint8Array(N), rd = new Float32Array(N), wr = new Float32Array(N);
    let wp = 0, acc = 0, moved = 0, status = 'Starting...', complete = 0, total = 1, lastR = 0, lastW = 0, scan = 0;

    function fragment() { // a fresh, badly fragmented disk
      cell.fill(FREE); rd.fill(0); wr.fill(0);
      for (let i = 0; i < N * 0.04; i++) cell[i] = DONE; // the system files, already in place
      let i = Math.floor(N * 0.04);
      while (i < N) { // runs of file clusters with holes between them
        const run = 1 + Math.floor(Math.random() * 7), gap = Math.floor(Math.random() * 6);
        for (let j = 0; j < run && i < N; j++) cell[i++] = FRAG;
        i += gap;
      }
      for (let j = 0; j < N * 0.015; j++) cell[Math.floor(Math.random() * N)] = FIXED;
      wp = 0; moved = 0; complete = 0; scan = 0; total = cell.reduce((n, c) => n + (c === FRAG), 0) || 1; status = 'Reading drive information...';
    }
    function step() { // one cluster: if the next slot is free, fetch the next fragment into it
      while (wp < N && (cell[wp] === DONE || cell[wp] === FIXED)) wp++;
      if (wp >= N) return finish();
      if (cell[wp] === FRAG) { cell[wp] = DONE; wr[wp] = 1; lastW = wp; moved++; return; } // already where it belongs
      if (scan <= wp) scan = wp + 1;
      while (scan < N && cell[scan] !== FRAG) scan++;
      if (scan >= N) return finish();
      cell[scan] = FREE; rd[scan] = 1; lastR = scan;
      cell[wp] = DONE; wr[wp] = 1; lastW = wp; moved++;
    }
    function finish() { if (!complete) { complete = 0.001; status = 'Defragmentation complete.'; } }
    fragment();

    return {
      label: 'DEFRAG',
      signal(kind) { // an error: some of the last stretch has to be checked again
        if (kind !== 'error' || complete) return;
        for (let j = 0; j < 40; j++) { const i = wp - 1 - Math.floor(Math.random() * Math.min(wp, 200)); if (i >= 0 && cell[i] === DONE) { cell[i] = FRAG; rd[i] = 1; total++; wp = Math.min(wp, i); } }
        scan = wp;
      },
      update(dt) {
        for (let i = 0; i < N; i++) { if (rd[i]) rd[i] = Math.max(0, rd[i] - dt * 2.5); if (wr[i]) wr[i] = Math.max(0, wr[i] - dt * 1.5); }
        if (complete) { complete += dt; if (complete > 6) fragment(); return; }
        acc += dt * (3 + env.level * 30 + (env.build > 4 ? 40 : 0));
        while (acc >= 1) { acc--; step(); if (complete) break; }
        if (!complete) status = rd[lastR] > wr[lastW] - 0.4 ? `Reading cluster ${lastR}...` : `Writing cluster ${lastW}...`;
      },
      draw() {
        const t = env.t, W0 = COLS * CS, D0 = ROWS * CS;
        setCam(lookAt({ x: Math.sin(t * 0.06) * 10, y: 20 + Math.sin(t * 0.09) * 3, z: -16 }, 0, 0, D0 * 0.45));
        // free space is just the grid; each used cluster draws its front and left edge, lifted while read or written
        for (let x = 0; x <= COLS; x += 2) seg(x * CS - W0 / 2, 0, 0, x * CS - W0 / 2, 0, D0, C.white, 0.08, FOG);
        for (let z = 0; z <= ROWS; z += 2) seg(-W0 / 2, 0, z * CS, W0 / 2, 0, z * CS, C.white, 0.08, FOG);
        for (let i = 0; i < N; i++) {
          const c = cell[i], r = rd[i], w = wr[i];
          if (c === FREE && r < 0.05) continue;
          const x0 = (i % COLS) * CS - W0 / 2, z0 = Math.floor(i / COLS) * CS;
          let col, al;
          if (r > 0.05) { col = C.hot; al = 1; } else if (w > 0.05) { col = C.neon; al = 1; }
          else if (c === FRAG) { col = C.violet; al = 0.7; } else if (c === DONE) { col = C.ice; al = 0.75; } else { col = C.gold; al = 0.9; }
          const y = (r + w) * 1.4, s = CS * 0.85;
          seg(x0, y, z0, x0 + s, y, z0, col, al, FOG); seg(x0, y, z0, x0, y, z0 + s, col, al, FOG);
          if (y > 0.1) { seg(x0, 0, z0, x0, y, z0, col, al * 0.6, FOG); seg(x0 + s, y, z0 + s, x0 + s, y, z0, col, al, FOG); seg(x0 + s, y, z0 + s, x0, y, z0 + s, col, al, FOG); }
          if (c === FIXED) seg(x0, y, z0, x0 + s, y, z0 + s, col, al, FOG); // unmovable: crossed
        }
        // the head, over the write point
        const hx = (wp % COLS) * CS - W0 / 2 + CS / 2, hz = Math.floor(wp / COLS) * CS + CS / 2;
        seg(hx, 4 + env.pulse, hz, hx, 0.3, hz, C.neon, 0.8, FOG); seg(hx - 1, 4 + env.pulse, hz, hx + 1, 4 + env.pulse, hz, C.neon, 0.8, FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 28 * s;
      const pct = complete ? 100 : Math.min(99, Math.floor(moved / total * 100));
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText('DISK OPTIMIZER  ::  DRIVE C:', x0, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.8)`; g.fillText(status, x0, 56 * s);
      // the progress bar, in blocks
      const bw = 260 * s, filled = Math.round(pct / 100 * 26);
      g.strokeStyle = `rgba(${C.white},0.6)`; g.lineWidth = 1; g.strokeRect(x0, 66 * s, bw, 14 * s);
      g.fillStyle = `rgba(${C.ice},0.85)`; for (let i = 0; i < filled; i++) g.fillRect(x0 + 2 * s + i * 10 * s, 68 * s, 8 * s, 10 * s);
      g.fillStyle = `rgba(${C.white},0.85)`; g.fillText(`${pct}% Complete`, x0, 98 * s);
      // the legend
      const key = [[C.ice, 'Optimized data'], [C.violet, 'Data not yet optimized'], [C.hot, 'Data being read'], [C.neon, 'Data being written'], [C.white, 'Free space'], [C.gold, 'Unmovable']];
      key.forEach(([col, lab], i) => { const y = H - (130 - i * 18) * s; g.fillStyle = `rgba(${col},${col === C.white ? 0.4 : 0.9})`; g.fillRect(x0, y - 9 * s, 10 * s, 10 * s); g.fillStyle = `rgba(${C.white},0.7)`; g.fillText(lab, x0 + 18 * s, y); });
      // the classic flat map, top right
      const cw = 4 * s, mx = W - 28 * s - COLS * cw, my = 24 * s;
      g.fillStyle = `rgba(${C.white},0.08)`; g.fillRect(mx - 2, my - 2, COLS * cw + 4, ROWS * cw + 4);
      for (const [want, col, al] of [[FRAG, C.violet, 0.8], [DONE, C.ice, 0.85], [FIXED, C.gold, 0.9], [FREE, C.white, 0.15]]) {
        g.fillStyle = `rgba(${col},${al})`;
        for (let i = 0; i < N; i++) if (cell[i] === want && !rd[i] && !wr[i]) g.fillRect(mx + (i % COLS) * cw, my + Math.floor(i / COLS) * cw, cw - 1, cw - 1);
      }
      g.fillStyle = `rgba(${C.hot},1)`; for (let i = 0; i < N; i++) if (rd[i] > 0.05) g.fillRect(mx + (i % COLS) * cw, my + Math.floor(i / COLS) * cw, cw - 1, cw - 1);
      g.fillStyle = `rgba(${C.neon},1)`; for (let i = 0; i < N; i++) if (wr[i] > 0.05) g.fillRect(mx + (i % COLS) * cw, my + Math.floor(i / COLS) * cw, cw - 1, cw - 1);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`;
      const info = `${N} clusters  ::  ${moved} moved`; g.fillText(info, W - 28 * s - g.measureText(info).width, my + ROWS * cw + 18 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
