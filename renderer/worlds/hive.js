// PROCESS HIVE: running programs (sysinfo.js) as a honeycomb. Memory is a cell's height, CPU its
// heat; busy cells draw a swarm, and a runaway one glows red and shakes. Biggest in the middle.
(function (Worlds) {
  Worlds.define('hive', (k) => {
    const { C, rand, env, seg, text3, setCam, lookAt } = k;
    const R = 4.2, S = R * Math.sqrt(3); // hex radius, centre spacing
    let cells = [], builtFrom;
    // Axial hex coordinates spiralling out from the centre: 1, then rings of 6, 12, 18...
    function spiral(n) {
      const out = [[0, 0]], dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
      for (let r = 1; out.length < n; r++) {
        let q = -r, s = r; // start at the ring's corner, walk its six sides
        for (const [dq, ds] of dirs) for (let i = 0; i < r && out.length < n; i++) { out.push([q, s]); q += dq; s += ds; }
      }
      return out;
    }
    function build(list) {
      builtFrom = list;
      const pos = spiral((list || []).length), old = new Map(cells.map((c) => [c.p.name, c]));
      cells = (list || []).map((p, i) => {
        const [q, s] = pos[i], prev = old.get(p.name);
        return { p, x: S * (q + s / 2), z: S * s * Math.sqrt(3) / 2, h: 2 + Math.max(0, Math.log2(p.mem / 1048576 + 1)) * 1.4, heat: prev ? prev.heat : 0,
          bees: prev ? prev.bees : Array.from({ length: 6 }, () => ({ a: rand(0, 6.3), r: rand(2, 5), y: rand(0, 3), v: rand(1.5, 3.5) })) };
      });
    }
    const hex = (x, y, z, col, a) => {
      for (let i = 0; i < 6; i++) {
        const a0 = i / 6 * Math.PI * 2 + Math.PI / 6, a1 = a0 + Math.PI / 3;
        seg(x + Math.cos(a0) * R, y, z + Math.sin(a0) * R, x + Math.cos(a1) * R, y, z + Math.sin(a1) * R, col, a, 220);
      }
    };
    return {
      label: 'PROCESS HIVE',
      enter() { build(env.procs); },
      update(dt) {
        if (env.procs !== builtFrom) build(env.procs);
        for (const c of cells) { c.heat += (Math.min(1, c.p.cpu / 100) - c.heat) * Math.min(1, dt * 2); for (const b of c.bees) b.a += b.v * dt * (0.5 + c.heat * 2); }
      },
      draw() {
        const a = env.t * 0.06, span = Math.sqrt(cells.length) * S * 0.6 + 12;
        setCam(lookAt({ x: Math.sin(a) * span * 1.4, y: span * 0.9, z: Math.cos(a) * span * 1.4 }, 0, 2, 0));
        for (const c of cells) {
          const hot = c.heat > 0.5, col = hot ? C.hot : c.heat > 0.1 ? C.gold : C.ice;
          const j = hot ? (c.heat - 0.5) * 1.2 : 0, x = c.x + rand(-j, j), z = c.z + rand(-j, j); // a runaway process shakes
          hex(x, 0, z, col, 0.6); hex(x, c.h, z, col, 0.95);
          for (let i = 0; i < 6; i += 2) { const a0 = i / 6 * Math.PI * 2 + Math.PI / 6; seg(x + Math.cos(a0) * R, 0, z + Math.sin(a0) * R, x + Math.cos(a0) * R, c.h, z + Math.sin(a0) * R, col, 0.5, 220); }
          const fill = c.h * Math.min(1, c.heat * 1.5); // honey level = CPU
          if (fill > 0.2) hex(x, fill, z, C.gold, 0.5);
          text3(c.p.name.slice(0, 16), x - R * 0.8, c.h + 1.2, z, col, 1.2, 0.9);
          if (c.heat > 0.05) text3(`${Math.round(c.p.cpu)}%`, x - R * 0.4, c.h + 2.6, z, C.white, 0.8, 0.7);
          const nb = Math.round(c.heat * 6);
          for (let i = 0; i < nb; i++) {
            const b = c.bees[i], bx = x + Math.cos(b.a) * b.r, bz = z + Math.sin(b.a) * b.r, by = c.h + 1 + b.y + Math.sin(env.t * 6 + i) * 0.4;
            seg(bx, by, bz, bx - Math.sin(b.a) * 0.5, by + 0.15, bz + Math.cos(b.a) * 0.5, C.gold, 1, 220);
          }
        }
        const g = k.g, top = cells.reduce((m, c) => (c.p.cpu > (m ? m.p.cpu : -1) ? c : m), null);
        g.fillStyle = `rgba(${C.neon},0.75)`; g.font = "14px 'Cascadia Mono', Consolas, monospace";
        g.fillText(`PROCESS HIVE :: ${cells.length} PROGRAMS${top ? ` :: BUSIEST ${top.p.name} ${Math.round(top.p.cpu)}%` : ''}`, 24, k.H - 28);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
