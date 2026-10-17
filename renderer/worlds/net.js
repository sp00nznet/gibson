// NETWATCH: this machine's live TCP connections (sysinfo.js) as arcs from a globe to labelled
// nodes, packets running along them. New connections flare; closed ones fade out.
(function (Worlds) {
  Worlds.define('net', (k) => {
    const { C, rand, env, seg, ring, text3, setCam, lookAt } = k;
    const COL = { https: C.ice, ssh: C.hot, http: C.gold, dns: C.violet, git: C.neon, irc: C.neon, rdp: C.hot };
    const G = [0, -2, 90], GR = 13; // the globe
    const nodes = new Map(); // ip:port -> { c, a, y, z, born, gone }
    let builtFrom, packets = [];
    // Deterministic place for an address: same host, same spot every time.
    const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

    function sync(list) {
      builtFrom = list;
      const live = new Set();
      for (const c of list || []) {
        const key = `${c.ip}:${c.port}`; live.add(key);
        // nodes live out to the sides, where the terminal does not cover them; the arcs cross the middle
        if (!nodes.has(key)) { const h = hash(c.ip); nodes.set(key, { c, side: h < 0.5 ? -1 : 1, x: 52 + hash(key) * 38, y: (hash(c.ip + 'y') - 0.5) * 56, z: (hash(c.ip + 'z') - 0.5) * 36, born: env.t, gone: null }); }
      }
      for (const [key, n] of nodes) if (!live.has(key) && n.gone == null) n.gone = env.t;
    }
    const where = (n) => [G[0] + n.side * n.x, G[1] + n.y + Math.sin(env.t * 0.4 + n.x) * 1.5, G[2] + n.z];
    // Arc from the globe's surface toward the node, bowed upward.
    function arc(p, steps, fn) {
      const d = Math.hypot(p[0] - G[0], p[1] - G[1], p[2] - G[2]) || 1;
      const s = [G[0] + (p[0] - G[0]) / d * GR, G[1] + (p[1] - G[1]) / d * GR, G[2] + (p[2] - G[2]) / d * GR];
      const m = [(s[0] + p[0]) / 2, (s[1] + p[1]) / 2 + 16, (s[2] + p[2]) / 2];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        fn([u * u * s[0] + 2 * u * t * m[0] + t * t * p[0], u * u * s[1] + 2 * u * t * m[1] + t * t * p[1], u * u * s[2] + 2 * u * t * m[2] + t * t * p[2]], i);
      }
    }
    const at = (p, t) => { let out; arc(p, 20, (q, i) => { if (i === Math.round(t * 20)) out = q; }); return out; };

    return {
      label: 'NETWATCH',
      enter() { sync(env.net); },
      update(dt) {
        if (env.net !== builtFrom) sync(env.net);
        for (const [key, n] of nodes) if (n.gone != null && env.t - n.gone > 2.5) nodes.delete(key);
        const live = [...nodes.values()].filter((n) => n.gone == null);
        if (live.length && Math.random() < dt * (4 + env.level * 30)) packets.push({ n: live[Math.floor(Math.random() * live.length)], t: 0, out: Math.random() < 0.5 });
        for (const p of packets) p.t += dt * (0.5 + env.level);
        packets = packets.filter((p) => p.t < 1 && nodes.has(`${p.n.c.ip}:${p.n.c.port}`));
      },
      draw() {
        setCam(lookAt({ x: Math.sin(env.t * 0.05) * 10, y: 10 + Math.sin(env.t * 0.08) * 4, z: 0 }, G[0], G[1], G[2]));
        const spin = env.t * 0.15;
        for (let la = -60; la <= 60; la += 30) ring(G[0], G[1] + Math.sin(la * Math.PI / 180) * GR, G[2], Math.cos(la * Math.PI / 180) * GR, 28, C.neon, 0.5, 220);
        for (let lo = 0; lo < 8; lo++) {
          const a = lo / 8 * Math.PI + spin;
          for (let i = 0; i < 16; i++) {
            const b0 = -Math.PI / 2 + i / 16 * Math.PI, b1 = b0 + Math.PI / 16;
            seg(G[0] + Math.cos(b0) * Math.cos(a) * GR, G[1] + Math.sin(b0) * GR, G[2] + Math.cos(b0) * Math.sin(a) * GR,
              G[0] + Math.cos(b1) * Math.cos(a) * GR, G[1] + Math.sin(b1) * GR, G[2] + Math.cos(b1) * Math.sin(a) * GR, C.neon, 0.35, 220);
          }
        }
        text3('YOU', G[0] - 2, G[1] + GR + 2, G[2], C.white, 1.6, 0.9);
        for (const n of nodes.values()) {
          const p = where(n), col = COL[n.c.service] || C.violet;
          const fade = n.gone == null ? 1 : Math.max(0, 1 - (env.t - n.gone) / 2.5), age = env.t - n.born;
          let prev = null;
          arc(p, 16, (q) => { if (prev) seg(...prev, ...q, col, 0.45 * fade, 240); prev = q; });
          ring(p[0], p[1], p[2], 1.2, 10, col, fade, 240, 'xy');
          if (age < 3) ring(p[0], p[1], p[2], 1.2 + age * 4, 16, C.white, (1 - age / 3) * fade, 240, 'xy'); // a new connection flares
          text3(`${n.c.ip}:${n.c.port}`, p[0] + 1.8, p[1] + 0.6, p[2], col, 1.0, fade);
          text3(n.c.service.toUpperCase(), p[0] + 1.8, p[1] - 1.2, p[2], C.white, 0.9, 0.7 * fade);
        }
        for (const pk of packets) {
          const p = where(pk.n), q = at(p, pk.out ? pk.t : 1 - pk.t);
          if (q) seg(q[0], q[1] - 0.5, q[2], q[0], q[1] + 0.5, q[2], C.white, 1, 240);
        }
        const g = k.g, live = [...nodes.values()].filter((n) => n.gone == null).length;
        g.fillStyle = `rgba(${C.neon},0.75)`; g.font = "14px 'Cascadia Mono', Consolas, monospace";
        g.fillText(`NETWATCH :: ${live} ESTABLISHED`, 24, k.H - 28);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
