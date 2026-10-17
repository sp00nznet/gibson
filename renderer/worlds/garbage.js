// THE GARBAGE FILE: the Gibson's file system as a city of stacked data slabs, wired together into
// a directory tree. Over the middle the garbage file spins, glowing, while hunters circle it and a
// worm crawls the tree. The status and the slogans live in the margins, around the terminal.
(function (Worlds) {
  Worlds.define('garbage', (k) => {
    const { C, rand, pick, hex, env, seg, line2, text3, ring, ship, setCam, lookAt } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 260, SP = 15;
    const SLOGANS = [['MESS WITH THE BEST', 'DIE LIKE THE REST'], ['THERE IS NO GARBAGE FILE', 'THERE IS ONLY THE GIBSON'], ['FOUR HUNTERS. ONE FILE.', 'NOWHERE LEFT TO HIDE'], ['TRASH IS JUST DATA', 'NOBODY BOTHERED TO READ']];
    const DIRS = ['ELLINGSON', 'PAYROLL', 'KERNEL', 'DA VINCI', 'BALLAST', 'TANKERS', 'MAIL', 'SECURITY', 'LOGS', 'BACKUP', 'TMP', 'GARBAGE'];

    // The towers: a 6x6 grid around an empty plaza. Each is a stack of slabs; its parent is the
    // neighbour one step toward the middle, the inner ring hangs off the root hub.
    const towers = [];
    for (let i = -2.5; i <= 2.5; i++) for (let j = -2.5; j <= 2.5; j++) {
      if (Math.abs(i) < 1 && Math.abs(j) < 1) continue;
      const n = 3 + Math.floor(rand(0, 4));
      towers.push({ i, j, x: i * SP, z: j * SP, n, h: n * 4.2, ph: rand(0, 6.3), col: pick([C.ice, C.ice, C.violet, C.neon]), name: `${pick(DIRS)}/${hex(3)}` });
    }
    const HUB = [0, 2, 0], top = (t) => [t.x, t.h + 1, t.z];
    for (const t of towers) {
      const pi = t.i - Math.sign(t.i) * (Math.abs(t.i) >= Math.abs(t.j) ? 1 : 0), pj = t.j - Math.sign(t.j) * (Math.abs(t.j) >= Math.abs(t.i) ? 1 : 0);
      t.parent = towers.find((o) => o.i === pi && o.j === pj && o !== t) || null;
    }
    const up = (t) => { const out = []; for (let c = t; c; c = c.parent) out.push(top(c)); out.push(HUB); return out; };

    // The worm: crawls from one leaf up to the hub and down to another, then picks again.
    let path = [], plen = [], wd = 0;
    function route() {
      const a = up(pick(towers)), b = up(pick(towers)).reverse();
      path = a.concat(b.slice(1)); plen = [0];
      for (let i = 1; i < path.length; i++) plen.push(plen[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
      wd = 0;
    }
    const along = (d, out) => {
      let i = 1; while (i < plen.length - 1 && plen[i] < d) i++;
      const u = Math.max(0, Math.min(1, (d - plen[i - 1]) / ((plen[i] - plen[i - 1]) || 1))), p = path[i - 1], q = path[i];
      out[0] = p[0] + (q[0] - p[0]) * u; out[1] = p[1] + (q[1] - p[1]) * u; out[2] = p[2] + (q[2] - p[2]) * u; return out;
    };
    route();

    // The garbage file: an icosahedron around a cube.
    const PH = (1 + Math.sqrt(5)) / 2;
    const ICO = [[-1, PH, 0], [1, PH, 0], [-1, -PH, 0], [1, -PH, 0], [0, -1, PH], [0, 1, PH], [0, -1, -PH], [0, 1, -PH], [PH, 0, -1], [PH, 0, 1], [-PH, 0, -1], [-PH, 0, 1]];
    const ICE = []; for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) if (Math.hypot(ICO[a][0] - ICO[b][0], ICO[a][1] - ICO[b][1], ICO[a][2] - ICO[b][2]) < 2.1) ICE.push([a, b]);
    const CUBE = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const CUE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const IP = ICO.map(() => [0, 0, 0]), CP = CUBE.map(() => [0, 0, 0]);
    const G = [0, 30, 0]; // where the file is: it runs from the hunters, out over the towers
    function spin(src, dst, r, a, b) {
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      src.forEach((v, i) => { const x = v[0] * ca - v[2] * sa, z = v[0] * sa + v[2] * ca; dst[i][0] = G[0] + x * r; dst[i][1] = G[1] + (v[1] * cb - z * sb) * r; dst[i][2] = G[2] + (v[1] * sb + z * cb) * r; });
    }
    const hunters = [0, 1, 2, 3].map((i) => ({ r: 15 + i * 3.5, a: i * 1.6, v: (i % 2 ? -1 : 1) * (0.5 + i * 0.12), y: G[1] - 4 + i * 2.5, col: [C.gold, C.hot, C.ice, C.neon][i] }));
    let beams = [], trace = 0, scanAt = 0, said = 0, alarm = 0;
    const W0 = [0, 0, 0], W1 = [0, 0, 0];
    const text = (s, x, y, px, col, a, bold) => { const g = k.g; g.font = `${bold ? 'bold ' : ''}${px | 0}px ${MONO}`; g.fillStyle = `rgba(${col},${a})`; g.fillText(s, x, y); };

    return {
      label: 'THE GARBAGE FILE',
      signal(kind) { if (kind === 'error') { alarm = 1; route(); } },
      update(dt) {
        const sp = 1 + env.level * 1.5;
        wd += dt * 14 * sp; if (wd > plen[plen.length - 1] + 16) route();
        for (const h of hunters) h.a += h.v * dt * sp;
        if (Math.random() < dt * (0.8 + env.level * 3 + alarm * 6)) beams.push({ h: pick(hunters), life: 0.4 });
        for (const b of beams) b.life -= dt;
        beams = beams.filter((b) => b.life > 0);
        const b = env.t * 0.07 + Math.PI / 2 + Math.sin(env.t * 0.21) * 0.3, R = 50 + Math.sin(env.t * 0.3) * 5; // left of the camera, in the margin
        G[0] = Math.sin(b) * R; G[2] = Math.cos(b) * R; G[1] = 30 + Math.sin(env.t * 0.4) * 4;
        trace += dt * 0.035 * sp; if (trace > 1.15) trace = 0;
        scanAt += dt * 1.2 * sp; said += dt; alarm = Math.max(0, alarm - dt * 0.3);
      },
      draw() {
        const t = env.t, a = t * 0.07;
        setCam(lookAt({ x: Math.sin(a) * 64, y: 26 + Math.sin(t * 0.13) * 8, z: Math.cos(a) * 64 }, 0, 20, 0));
        // floor: a circuit grid
        for (let v = -48; v <= 48; v += 8) { seg(v, 0, -48, v, 0, 48, C.violet, 0.22, FOG); seg(-48, 0, v, 48, 0, v, C.violet, 0.22, FOG); }
        ring(0, 0.1, 0, 9, 24, C.hot, 0.5, FOG);
        // towers: stacked slabs that breathe apart, data climbing the corners
        for (const tw of towers) {
          const s = 2.6, x = tw.x, z = tw.z;
          for (let n = 0; n < tw.n; n++) {
            const y = n * 4.2 + Math.sin(t * 1.3 + tw.ph + n) * 0.3, r = n % 2 ? 0.25 * Math.sin(t * 0.4 + tw.ph) : 0, c = Math.cos(r + 0.785) * s * 1.414, si = Math.sin(r + 0.785) * s * 1.414;
            for (const yy of [y, y + 3]) { seg(x + c, yy, z + si, x - si, yy, z + c, tw.col, 0.8, FOG); seg(x - si, yy, z + c, x - c, yy, z - si, tw.col, 0.8, FOG); seg(x - c, yy, z - si, x + si, yy, z - c, tw.col, 0.8, FOG); seg(x + si, yy, z - c, x + c, yy, z + si, tw.col, 0.8, FOG); }
          }
          seg(x - s, 0, z - s, x - s, tw.h, z - s, tw.col, 0.25, FOG); seg(x + s, 0, z + s, x + s, tw.h, z + s, tw.col, 0.25, FOG);
          const d = (t * 6 + tw.ph * 4) % tw.h; seg(x + s, d, z - s, x + s, d + 2, z - s, C.gold, 1, FOG);
          // the directory tree, tower top to parent
          const p = tw.parent ? top(tw.parent) : HUB, q = top(tw);
          seg(q[0], q[1], q[2], p[0], p[1], p[2], C.neon, 0.35, FOG);
          if (Math.floor(scanAt) % towers.length === towers.indexOf(tw)) { text3(tw.name, x - 2, tw.h + 2.5, z, C.gold, 1.2, 1); seg(G[0], G[1], G[2], q[0], q[1], q[2], C.white, 0.3, FOG); }
        }
        // the worm
        for (let i = 0; i < 20; i++) {
          along(wd - i * 1.2, W0); along(wd - (i + 1) * 1.2, W1);
          const w = Math.sin(t * 9 - i * 0.8) * 0.4;
          seg(W0[0], W0[1] + w + 0.6, W0[2], W1[0], W1[1] + w + 0.6, W1[2], i < 2 ? C.white : i % 2 ? C.hot : C.neon, 1 - i / 22, FOG);
        }
        along(wd, W0); text3('WORM', W0[0] + 1, W0[1] + 2.4, W0[2], C.hot, 1.4, 1);
        // the garbage file, spinning and hunted
        const glow = 0.6 + env.pulse * 0.4, r = 7 * (1 + env.pulse * 0.08);
        spin(ICO, IP, r * 0.6, t * 0.8, t * 0.5); spin(CUBE, CP, r * 0.45, -t * 1.3, t * 0.9);
        for (const [i, j] of ICE) seg(IP[i][0], IP[i][1], IP[i][2], IP[j][0], IP[j][1], IP[j][2], C.hot, glow, FOG);
        for (const [i, j] of CUE) seg(CP[i][0], CP[i][1], CP[i][2], CP[j][0], CP[j][1], CP[j][2], C.gold, 1, FOG);
        for (let i = 0; i < 3; i++) ring(G[0], G[1] - 4 + i * 4, G[2], 9 + Math.sin(t * 2 + i) * 1.5, 28, C.hot, 0.3, FOG);
        seg(G[0], 0, G[2], G[0], G[1] - 5, G[2], C.hot, 0.4, FOG);
        text3('GARBAGE.DAT', G[0] - 5, G[1] + 10, G[2], C.gold, 1.6, 1);
        for (const h of hunters) ship(G[0] + Math.cos(h.a) * h.r, h.y + Math.sin(t + h.r) * 1.5, G[2] + Math.sin(h.a) * h.r, -h.a + (h.v > 0 ? 0 : Math.PI), 1.4, h.col, 1, 0.4 * Math.sign(h.v));
        for (const b of beams) { const h = b.h; seg(G[0] + Math.cos(h.a) * h.r, h.y, G[2] + Math.sin(h.a) * h.r, G[0], G[1], G[2], h.col, b.life * 2.5, FOG); }

        // --- margins ---
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), lx = W * 0.845, rx = W * 0.02;
        // right: the hunt log, scanning the tree
        text('GIBSON :: FILE SYSTEM', lx, H * 0.1, 18 * s, C.ice, 1, true); line2(lx, H * 0.1 + 8 * s, lx + W * 0.13, H * 0.1 + 8 * s, C.ice, 0.6);
        const cur = Math.floor(scanAt);
        for (let i = 0; i < 18; i++) {
          const tw = towers[(cur - i + towers.length * 9) % towers.length], hot = i === 0;
          text(`${hot ? '>' : ' '} /${tw.name}`, lx, H * 0.14 + i * 22 * s, 13 * s, hot ? C.gold : C.ice, hot ? 1 : 0.75 - i * 0.035);
          text(hot ? 'SCAN' : i % 7 === 3 ? 'LOCKED' : 'CLEAN', lx + W * 0.105, H * 0.14 + i * 22 * s, 13 * s, hot ? C.gold : i % 7 === 3 ? C.hot : C.neon, hot ? 1 : 0.6);
        }
        // left: the target, with a leader line from the file itself (it keeps to the camera's left)
        const q = k.toCam(G[0], G[1], G[2]);
        const ty = H * 0.62;
        if (q[2] > 1) { const sx = W / 2 + q[0] * k.F / q[2], sy = H / 2 - q[1] * k.F / q[2]; line2(sx, sy + 40 * s, rx + W * 0.13, ty, C.hot, 0.5); line2(rx, ty, rx + W * 0.13, ty, C.hot, 0.8); }
        const tr = Math.min(1, trace);
        text('TARGET ACQUIRED', rx, ty - 12 * s, 18 * s, C.hot, 0.6 + env.pulse * 0.4, true);
        [['FILE', 'GARBAGE.DAT'], ['SIZE', '48K (ENCRYPTED)'], ['ORIGIN', 'UNKNOWN'], ['HUNTERS', String(hunters.length)], ['WORM', `${Math.round(wd)}/${Math.round(plen[plen.length - 1])}`]].forEach(([kk, v], i) => {
          text(kk, rx, ty + 28 * s + i * 22 * s, 13 * s, C.ice, 0.7); text(v, rx + 90 * s, ty + 28 * s + i * 22 * s, 13 * s, C.white, 0.95);
        });
        const by = ty + 150 * s, bw = W * 0.13;
        line2(rx, by, rx + bw, by, C.hot, 0.6); line2(rx, by + 14 * s, rx + bw, by + 14 * s, C.hot, 0.6); line2(rx, by, rx, by + 14 * s, C.hot, 0.6); line2(rx + bw, by, rx + bw, by + 14 * s, C.hot, 0.6);
        g.fillStyle = `rgba(${C.hot},0.55)`; g.fillRect(rx + 2, by + 2, (bw - 4) * tr, 14 * s - 4);
        text(trace > 1 ? 'TRACE COMPLETE. COPYING...' : `TRACE ${Math.round(tr * 100)}%`, rx, by + 34 * s, 14 * s, trace > 1 ? C.gold : C.hot, trace > 1 && Math.sin(t * 12) < 0 ? 0.3 : 1, true);
        if (alarm > 0.05) text('!! INTRUDER IN THE TREE !!', rx, by + 60 * s, 14 * s, C.hot, alarm, true);
        // the slogan drifts along the top and bottom edges, a new one every so often
        const [s1, s2] = SLOGANS[Math.floor(said / 16) % SLOGANS.length], u = (said % 16) / 16, fade = Math.min(1, u * 6, (1 - u) * 6);
        text(s1, W * (0.6 - u * 0.5), H * 0.045, 34 * s, C.hot, fade, true);
        text(s2, W * (0.15 + u * 0.4), H * 0.978, 34 * s, C.gold, fade, true);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
