// CYBERBRAIN: a ghost-hack dive. Down a tunnel walled with streams of green glyphs, through
// barrier rings (they go red, attack barriers, when a command fails), toward a cyberbrain: a
// wireframe brain of nodes and links. Once there, the ghost line traces node to node; at 100%
// every node rearranges into one vast face, holds, and dissolves, and the next dive begins.
(function (Worlds) {
  Worlds.define('cyberbrain', (k) => {
    const { C, rand, env, seg, setCam, text3, ring, hex } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 220, R = 14, COLS = 22, GAP = 70;
    const GLYPH = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ABCDEF';
    const hash = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return (Math.imul(h, 1103515245) >>> 0) / 4294967296; };

    // the brain: nodes on a lumpy ellipsoid, each also given a spot on the face
    const N = 140, nodes = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996, lump = 1 + 0.12 * Math.sin(i * 1.7) * Math.sin(i * 0.9);
      const b = [Math.cos(a) * r * 11 * lump, y * 8.5 * lump, Math.sin(a) * r * 13 * lump];
      const u = i / N, fx = (() => { // face: outline, eyes, nose, mouth, by share of nodes
        if (u < 0.5) { const t = u / 0.5 * Math.PI * 2; return [Math.sin(t) * 16, Math.cos(t) * 21, -Math.abs(Math.sin(t)) * 4]; }
        if (u < 0.7) { const t = (u - 0.5) / 0.1 * Math.PI, s = u < 0.6 ? -1 : 1; return [s * 6.5 + Math.cos(t * 2) * 3.2, 5 + Math.sin(t * 2) * 1.4, -3]; }
        if (u < 0.8) { const t = (u - 0.7) / 0.1; return [t * 1.6, 3 - t * 9, -5 + t * 1.5]; }
        const t = (u - 0.8) / 0.2 * Math.PI; return [Math.cos(t) * 7, -10 - Math.sin(t) * 2.5, -3];
      })();
      nodes.push({ b, f: fx, d: [rand(-1, 1), rand(-1, 1), rand(-1, 1)] });
    }
    const links = [];
    nodes.forEach((n, i) => {
      const near = nodes.map((m, j) => [Math.hypot(m.b[0] - n.b[0], m.b[1] - n.b[1], m.b[2] - n.b[2]), j]).filter((x) => x[1] > i).sort((a, b) => a[0] - b[0]).slice(0, 3);
      for (const [, j] of near) links.push([i, j]);
    });

    let camZ = 0, dive = 0, trace = 0, face = 0, level = 1, alarm = 0, path = [0], packets = [], pk = 0;
    function newPath() { path = [Math.floor(rand(0, N))]; for (let i = 0; i < 24; i++) { const c = path[path.length - 1], opts = links.filter((l) => l[0] === c || l[1] === c); const l = opts[Math.floor(rand(0, opts.length))]; path.push(l ? (l[0] === c ? l[1] : l[0]) : Math.floor(rand(0, N))); } }
    newPath();

    return {
      label: 'CYBERBRAIN',
      signal(kind) { if (kind === 'error') alarm = 3; if (kind === 'ok' && dive >= 1) trace = Math.min(100, trace + 8); },
      update(dt) {
        camZ += (18 + env.level * 45) * dt; alarm = Math.max(0, alarm - dt);
        if (face > 0) { face += dt; if (face > 7) { face = 0; dive = 0; trace = 0; level++; newPath(); } }
        else if (dive < 1) dive = Math.min(1, dive + dt * (0.05 + env.level * 0.1));
        else { trace += dt * (4 + env.level * 18); if (trace >= 100) { trace = 100; face = 0.001; } }
        pk -= dt; if (pk < 0) { pk = 0.08; packets.unshift(`${hex(4)} ${hex(4)} ${hex(4)} ${hex(4)}`); packets.length = Math.min(packets.length, 9); }
      },
      draw() {
        const t = env.t, sway = Math.sin(t * 0.3) * 0.04;
        setCam({ x: Math.sin(t * 0.4) * 1.5, y: Math.cos(t * 0.33) * 1.2, z: camZ, yaw: sway, pitch: Math.sin(t * 0.21) * 0.03 });
        // the tunnel: glyph streams along the walls, falling toward us
        const z0 = Math.floor(camZ / 4) * 4;
        let glyphs = 0;
        for (let c = 0; c < COLS; c++) {
          const a = c / COLS * Math.PI * 2 + t * 0.05, x = Math.cos(a) * R, y = Math.sin(a) * R, run = t * (6 + hash(c, 1) * 10);
          for (let z = z0; z < camZ + FOG; z += 4) {
            const h = hash(c, Math.floor((z + run) / 4)); if (h > 0.55) continue;
            const zz = z - (run % 4);
            seg(x, y, zz, x, y, zz + 2.6, C.neon, 0.35 + h, FOG);
            if (h < 0.05 && glyphs < 60 && zz - camZ > 18 && zz - camZ < 110) { glyphs++; text3(GLYPH[Math.floor(hash(c, z) * GLYPH.length)], x * 0.97, y * 0.97, zz, C.neon, 0.7, 0.9); }
          }
        }
        // barriers every GAP: rings with teeth; attack barriers burn red
        const bc = alarm > 0 ? C.hot : C.ice;
        for (let z = Math.ceil(camZ / GAP) * GAP; z < camZ + FOG; z += GAP) {
          ring(0, 0, z, R * 0.92, 32, bc, 0.8, FOG, 'xy'); ring(0, 0, z, R * 0.7, 6, bc, 0.6, FOG, 'xy');
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + z; seg(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, z, Math.cos(a) * R * (alarm > 0 ? 0.55 : 0.78), Math.sin(a) * R * (alarm > 0 ? 0.55 : 0.78), z, bc, 0.7, FOG); }
        }
        // the brain, coming closer; then the face
        const bz = camZ + 150 - 115 * dive, m = face ? Math.min(1, face / 1.5) : 0, dis = face > 4.5 ? (face - 4.5) / 2.5 : 0;
        const spin = t * 0.25 * (1 - m), cs = Math.cos(spin), sn = Math.sin(spin);
        const P = nodes.map((n) => {
          const bx = n.b[0] * cs + n.b[2] * sn, bzz = -n.b[0] * sn + n.b[2] * cs;
          const x = bx + (n.f[0] - bx) * m, y = n.b[1] + (n.f[1] - n.b[1]) * m, z = bzz + (n.f[2] - bzz) * m;
          return [x + n.d[0] * dis * 40, y + n.d[1] * dis * 40, bz + z + n.d[2] * dis * 40];
        });
        const al = (face ? 1 : 0.75) * (1 - dis), lc = face ? C.white : C.neon;
        for (const [i, j] of links) seg(...P[i], ...P[j], lc, al * 0.5, 260);
        if (!face) for (const p of P) seg(p[0] - 0.25, p[1], p[2], p[0] + 0.25, p[1], p[2], C.ice, 0.9, 260);
        // the ghost line: node to node as the trace climbs
        if (dive >= 1 && !face) {
          const n = Math.floor(trace / 100 * (path.length - 1));
          for (let i = 0; i < n; i++) seg(...P[path[i]], ...P[path[i + 1]], C.gold, 1, 260);
          const q = P[path[n]]; ring(q[0], q[1], q[2], 0.8 + env.pulse, 10, C.gold, 1, 260, 'xy');
        }
        hud(face && dis < 0.8);
      },
    };

    function hud(speaking) {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.95)`;
      g.fillText(`ACCESS LEVEL ${String(level).padStart(2, '0')}`, 28 * s, 40 * s);
      g.fillText(`GHOST LINE  ${String(Math.floor(trace)).padStart(3, ' ')}%`, 28 * s, 64 * s);
      g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText(dive < 1 ? `DIVE ${String(Math.floor(dive * 100)).padStart(3, ' ')}%` : 'TRACING', 28 * s, 88 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.6)`;
      packets.forEach((p, i) => g.fillText(p, W - 28 * s - g.measureText(p).width, 40 * s + i * 16 * s));
      g.font = `bold ${14 * s | 0}px ${MONO}`;
      const b = alarm > 0 ? 'ATTACK BARRIER // EVADE' : 'BARRIER: IR // CLEAR';
      g.fillStyle = `rgba(${alarm > 0 ? C.hot : C.ice},${alarm > 0 && Math.sin(env.t * 16) < 0 ? 0.4 : 0.9})`; g.fillText(b, 28 * s, H - 40 * s);
      if (speaking) {
        g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.9)`;
        const l = 'THE NET IS VAST AND INFINITE'; g.fillText(l, W - 28 * s - g.measureText(l).width, H - 40 * s);
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
