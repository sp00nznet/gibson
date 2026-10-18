// DNA HELIX: double helices turning and scrolling. Two stand in the side margins, close to the
// glass: one reads its bases (A-T, G-C, coloured), the other is the Gibson's genome, its rungs
// labelled in hex. A long faint strand winds behind the terminal, and the sequence being read
// crawls along the bottom edge.
(function (Worlds) {
  Worlds.define('helix', (k) => {
    const { C, env, seg, text3, setCam } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 220;
    const BASE = 'ATGC', PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' }, BCOL = { A: C.hot, T: C.gold, G: C.neon, C: C.ice };
    const hash = (n, salt) => { let h = Math.imul(n * 374761393 + salt * 668265263, 1274126177); h ^= h >>> 13; return (Math.imul(h, 1103515245) >>> 0) / 4294967296; };
    const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    // o: centre, ax: axis, R: radius, len: visible length, step: rung spacing, v: scroll speed
    const strands = [
      { o: [-26, 0, 34], ax: [0, 1, 0], R: 4.4, len: 46, step: 1.6, v: 1.1, spin: 0.45, mode: 'acgt', salt: 1, a: 1 },
      { o: [26, 0, 34], ax: [0, 1, 0], R: 4.4, len: 46, step: 1.6, v: -1.1, spin: -0.45, mode: 'hex', salt: 2, a: 1 },
      { o: [0, 2, 95], ax: norm([1, 0.18, 0.25]), R: 9, len: 220, step: 3.2, v: 4, spin: 0.4, mode: 'none', salt: 3, a: 0.45 },
    ].map((h) => { const u = norm(cross(h.ax, Math.abs(h.ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])); return { ...h, u, w: cross(h.ax, u), scroll: 0 }; });
    const TW = 0.55; // twist per rung
    const base = (h, n) => BASE[Math.floor(hash(n, h.salt) * 4)];
    function draw(h, t) {
      const at = (n, side) => { // world position of strand `side` (0/1) at rung coordinate n
        const along = (n - h.scroll / h.step) * h.step, a = n * TW + t * h.spin + side * Math.PI, c = Math.cos(a) * h.R, s = Math.sin(a) * h.R;
        return [h.o[0] + h.ax[0] * along + h.u[0] * c + h.w[0] * s, h.o[1] + h.ax[1] * along + h.u[1] * c + h.w[1] * s, h.o[2] + h.ax[2] * along + h.u[2] * c + h.w[2] * s];
      };
      const half = h.len / h.step / 2, n0 = Math.floor(h.scroll / h.step - half), n1 = Math.ceil(h.scroll / h.step + half);
      const fade = (n) => { const f = 1 - Math.abs(n - h.scroll / h.step) / half; return Math.max(0, Math.min(1, f * 3)) * h.a; };
      for (let side = 0; side < 2; side++) { // the backbones, sampled between rungs
        let p = at(n0, side);
        for (let n = n0 + 0.25; n <= n1; n += 0.25) { const q = at(n, side); seg(...p, ...q, side ? C.violet : C.white, 0.85 * fade(n), FOG); p = q; }
      }
      for (let n = n0; n <= n1; n++) {
        const al = fade(n); if (al < 0.05) continue;
        const A = at(n, 0), B = at(n, 1), M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
        if (h.mode === 'hex') {
          const byte = Math.floor(hash(n, h.salt) * 256), lo = 255 - byte;
          seg(...A, ...M, C.neon, al, FOG); seg(...M, ...B, C.hot, al, FOG);
          const front = A[2] < B[2];
          text3((front ? byte : lo).toString(16).toUpperCase().padStart(2, '0'), ...(front ? A : B).map((v, i) => v + [0.5, 0.1, -0.3][i]), front ? C.neon : C.hot, 0.55, al);
        } else {
          const b = base(h, n), c = PAIR[b];
          seg(...A, ...M, BCOL[b], al, FOG); seg(...M, ...B, BCOL[c], al, FOG);
          if (h.mode === 'acgt') { const front = A[2] < B[2]; text3(front ? b : c, ...(front ? A : B).map((v, i) => v + [0.5, 0.1, -0.3][i]), BCOL[front ? b : c], 0.6, al); }
        }
      }
    }
    return {
      label: 'DNA HELIX',
      update(dt) { for (const h of strands) h.scroll += h.v * dt * (1 + env.level); },
      draw() {
        const t = env.t;
        setCam({ x: Math.sin(t * 0.13) * 1.5, y: Math.sin(t * 0.1) * 1.5, z: 0, yaw: Math.sin(t * 0.07) * 0.04, pitch: Math.sin(t * 0.09) * 0.03 });
        for (const h of strands) draw(h, t);
        // the read head: the sequence passing the left helix, crawling along the bottom margin
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), h0 = strands[0], cur = Math.round(h0.scroll / h0.step);
        g.font = `bold ${16 * s | 0}px ${MONO}`;
        const cw = g.measureText('A').width, n = Math.floor(W / cw) - 4, y = H - 22 * s;
        for (let i = 0; i < n; i++) { const b = base(h0, cur + i - (n >> 1)); g.fillStyle = `rgba(${BCOL[b]},${i === n >> 1 ? 1 : 0.55})`; g.fillText(b, 2 * cw + i * cw, y); }
        g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`;
        g.fillText(`LOCUS ${(cur >>> 0).toString(16).toUpperCase().padStart(8, '0')}  ::  SEQUENCING`, 28 * s, 40 * s);
        const r = `GIBSON GENOME  ::  ${Math.round(40 + env.level * 55)}% MAPPED`;
        g.fillText(r, W - 28 * s - g.measureText(r).width, 40 * s);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
