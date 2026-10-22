// PNEUMATIC POST: the tube room of an old office. Glass tubes snake down the wall from every
// department and meet over a brass basket. A capsule comes whooshing down one for every new
// network connection (and more the busier you are), lands in the basket with a thunk, and the
// pile gets cleared when it's full. The station list counts what each line has sent.
(function (Worlds) {
  Worlds.define('pneumatic', (k) => {
    const { C, rand, env, seg, setCam, lookAt, ring, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 80, R = 0.09, END = [0, 1.25, 3.3];
    const NAMES = ['ACCOUNTS', 'TELEGRAMS', 'CASHIER', 'MAIL ROOM', 'DISPATCH', 'ARCHIVE', 'TYPING POOL', 'BOARD ROOM'];
    const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
    // the tubes: from a hole at the wall's edge, wandering across the wall, down to the basket
    const tubes = NAMES.map((name, i) => {
      const side = i % 3, y0 = 1.5 + (i / NAMES.length) * 2.6;
      const start = side === 0 ? [-6, y0, 5] : side === 1 ? [6, y0, 5] : [-4 + i, 4.8, 5];
      const ctrl = [start, [start[0] * 0.6 + rand(-1, 1), rand(2.2, 4.2), 5], [start[0] * 0.25 + rand(-0.6, 0.6), rand(2, 3.4), 5], [(i - 3.5) * 0.12, 1.9, 4.8], [(i - 3.5) * 0.05, 1.6, 4.2], END];
      const pts = []; // Catmull-Rom through the controls
      for (let c = 0; c < ctrl.length - 1; c++) {
        const p0 = ctrl[Math.max(0, c - 1)], p1 = ctrl[c], p2 = ctrl[c + 1], p3 = ctrl[Math.min(ctrl.length - 1, c + 2)];
        for (let j = 0; j < 10; j++) { const t = j / 10, t2 = t * t, t3 = t2 * t; pts.push([0, 1, 2].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3))); }
      }
      pts.push(END);
      const cum = [0]; for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1], pts[j][2] - pts[j - 1][2]));
      return { name, pts, cum, len: cum[cum.length - 1], sent: 0, col: [C.ice, C.violet][i % 2] };
    });
    function at(tb, d) { // position and direction along a tube
      let j = 1; while (j < tb.cum.length - 1 && tb.cum[j] < d) j++;
      const a = tb.pts[j - 1], b = tb.pts[j], f = Math.max(0, Math.min(1, (d - tb.cum[j - 1]) / (tb.cum[j] - tb.cum[j - 1] || 1)));
      const dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...dir) || 1;
      return [[a[0] + dir[0] * f, a[1] + dir[1] * f, a[2] + dir[2] * f], dir.map((v) => v / l)];
    }
    let caps = [], pile = 0, clear = 0, thunk = 0, seen = new Set(), netFrom, landed = 0;
    const send = (i) => { caps.push({ tb: tubes[i % tubes.length], d: 0, v: rand(2, 4) }); tubes[i % tubes.length].sent++; };

    return {
      label: 'PNEUMATIC POST',
      update(dt) {
        if (env.net && env.net !== netFrom) { // a capsule for every new connection
          netFrom = env.net; const now = new Set();
          for (const c of env.net) { const key = `${c.ip}:${c.port}`; now.add(key); if (!seen.has(key) && seen.size) send(hash(c.ip)); }
          if (!seen.size) for (const c of env.net) now.add(`${c.ip}:${c.port}`);
          seen = now;
          // name the lines after the busiest services
          const svc = [...new Set(env.net.map((c) => (c.service || c.ip).toUpperCase()))];
          svc.slice(0, tubes.length).forEach((n, i) => { tubes[i].name = n.slice(0, 12); });
        }
        if (Math.random() < dt * (0.3 + env.level * 3)) send((Math.random() * tubes.length) | 0);
        for (const c of caps) { c.v = Math.min(14, c.v + dt * 10); c.d += c.v * dt; if (c.d >= c.tb.len) { c.done = true; pile++; landed++; thunk = 1; } }
        caps = caps.filter((c) => !c.done);
        thunk = Math.max(0, thunk - dt * 3);
        if (pile >= 14 && !clear) clear = 1;
        if (clear) { clear -= dt * 0.7; if (clear <= 0) { clear = 0; pile = 0; } }
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: Math.sin(t * 0.06) * 1.2, y: 2.0, z: -1.2 }, 0, 2.3, 5));
        // the room: floor, wall panels, the counter
        for (let x = -6; x <= 6; x += 1) seg(x, 0, -1, x, 0, 5, C.violet, 0.2, FOG);
        for (let x = -6; x <= 6; x += 2) seg(x, 0, 5, x, 5, 5, C.violet, 0.2, FOG);
        seg(-6, 5, 5, 6, 5, 5, C.violet, 0.4, FOG); seg(-6, 0.9, 5, 6, 0.9, 5, C.violet, 0.4, FOG);
        box(0, 0, 3.2, 4, 0.9, 0.8, C.gold, 0.45, FOG);
        // the tubes: two walls of glass and a collar every so often
        for (const tb of tubes) {
          for (let j = 1; j < tb.pts.length; j++) {
            const a = tb.pts[j - 1], b = tb.pts[j], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * R, ny = dx / l * R;
            seg(a[0] + nx, a[1] + ny, a[2], b[0] + nx, b[1] + ny, b[2], tb.col, 0.55, FOG); seg(a[0] - nx, a[1] - ny, a[2], b[0] - nx, b[1] - ny, b[2], tb.col, 0.55, FOG);
            if (j % 10 === 0) ring(a[0], a[1], a[2], R * 1.4, 8, C.gold, 0.6, FOG, 'xy');
          }
          ring(tb.pts[0][0], tb.pts[0][1], tb.pts[0][2], R * 1.8, 10, C.gold, 0.8, FOG, 'xy'); // the station's mouth
        }
        // capsules in flight
        for (const c of caps) {
          const [p, d] = at(c.tb, c.d), h = 0.14, w = 0.06;
          const a = [p[0] - d[0] * h, p[1] - d[1] * h, p[2] - d[2] * h], b = [p[0] + d[0] * h, p[1] + d[1] * h, p[2] + d[2] * h], nx = -d[1] * w, ny = d[0] * w;
          seg(a[0] + nx, a[1] + ny, a[2], b[0] + nx, b[1] + ny, b[2], C.gold, 1, FOG); seg(a[0] - nx, a[1] - ny, a[2], b[0] - nx, b[1] - ny, b[2], C.gold, 1, FOG);
          seg(a[0] + nx, a[1] + ny, a[2], a[0] - nx, a[1] - ny, a[2], C.gold, 1, FOG); seg(b[0] + nx, b[1] + ny, b[2], b[0] - nx, b[1] - ny, b[2], C.hot, 1, FOG);
          const [q] = at(c.tb, Math.max(0, c.d - c.v * 0.12)); seg(...q, ...a, C.white, 0.35, FOG); // the whoosh
        }
        // the basket and the pile in it
        const bx = END[0], by = 0.9, bz = END[2];
        box(bx, by, bz, 0.9, 0.3, 0.5, C.gold, 0.9, FOG);
        const shown = clear ? Math.floor(pile * clear) : pile;
        for (let i = 0; i < shown; i++) { const x = bx - 0.35 + (i % 5) * 0.17, y = by + 0.05 + Math.floor(i / 5) * 0.07, z = bz - 0.1 + (i % 2) * 0.12; seg(x - 0.07, y, z, x + 0.07, y, z, C.gold, 0.9, FOG); seg(x - 0.07, y + 0.04, z, x + 0.07, y + 0.04, z, C.gold, 0.6, FOG); }
        if (thunk > 0) ring(bx, by + 0.32, bz, 0.3 + (1 - thunk) * 0.5, 16, C.white, thunk, FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('PNEUMATIC DISPATCH  ::  CENTRAL', 28 * s, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.75)`; g.fillText(`IN TRANSIT ${String(caps.length).padStart(2, '0')}   RECEIVED ${String(landed).padStart(5, '0')}`, 28 * s, 56 * s);
      g.font = `bold ${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText('STATIONS', 28 * s, H - (40 + tubes.length * 18) * s);
      g.font = `${13 * s | 0}px ${MONO}`;
      tubes.forEach((tb, i) => {
        const busy = caps.some((c) => c.tb === tb);
        g.fillStyle = `rgba(${busy ? C.gold : C.white},${busy ? 1 : 0.65})`; g.fillText(`${tb.name.padEnd(13)}${String(tb.sent).padStart(4, '0')}`, 28 * s, H - (30 + (tubes.length - 1 - i) * 18) * s);
      });
      if (clear) { const m = 'CLEARING BASKET'; g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.9)`; g.fillText(m, W - 28 * s - g.measureText(m).width, 34 * s); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
