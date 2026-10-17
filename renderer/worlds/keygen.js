// KEYGEN: the purest cracktro. A fake keygen window filling the screen: the crew logo, copper bars
// and a spinning vector star down the left margin, the serial generator down the right, a sine
// scroller of greetz along the bottom. Everything sits at the edges, around the terminal.
(function (Worlds) {
  Worlds.define('keygen', (k) => {
    const { C, env, seg, line2, setCam } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace";
    // 5x7 glyphs for the logo, one string per row.
    const GLYPH = {
      N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
      Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
      X: ['X...X', '.X.X.', '..X..', '..X..', '..X..', '.X.X.', 'X...X'],
    };
    const HANDLES = ['NULL POINTER', 'DR. HEXADECIMAL', 'R4ZORBL4DE', 'MODEM MOTH', 'C0PPERBAR', 'SYSOP NYX', 'BITROT', 'LAMER #1', 'THE PHREAKY ONE', 'CARRIER LOST'];
    const GREETZ = ['THE GIBSON CREW', 'NYX', 'SP00NZ', 'SILV3RWAREZ', 'C0PPERBAR', 'MODEM MOTH', 'BITROT', 'NULL POINTER', 'THE 2600 MEETING', 'EVERY BBS SYSOP', 'ALL ELITE CODERS', '...NOT LAMERS'];
    const SCROLL = '    NYX // GIBSON CREW PRESENTS ANOTHER FINE RELEASE ::: KEYGEN BY NULL POINTER ::: TUNE BY YOUR OWN TERMINAL ::: '
      + 'GREETZ FLY OUT TO ' + GREETZ.join(' - ') + ' ::: REMEMBER: IF YOU LIKE THIS SOFTWARE, BUY IT. WE ONLY CRACK IT FOR THE ART :::    ';
    // A serial from a name: the same name always gets the same key. ponytail: an LCG, not crypto.
    function serialOf(name) {
      let h = 2166136261; for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      let s = '';
      for (let i = 0; i < 16; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; s += '0123456789ABCDEF'[h >>> 28]; if (i % 4 === 3 && i < 15) s += '-'; }
      return s;
    }
    // Star tetrahedron in a cube: the vector object.
    const V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]];
    const STAR = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [4, 5], [4, 6], [4, 7], [5, 6], [5, 7], [6, 7]];
    const CUBE = [[0, 5], [0, 6], [0, 7], [3, 5], [3, 6], [3, 4], [1, 4], [1, 6], [1, 7], [2, 4], [2, 5], [2, 7]];
    const P = V.map(() => [0, 0, 0]);

    let who = 0, phase = 0, flash = 0, patch = 0, log = [];
    const name = () => HANDLES[who % HANDLES.length];
    function next() { log.unshift([name(), serialOf(name())]); if (log.length > 9) log.pop(); who++; phase = 0; }
    for (let i = 0; i < 4; i++) next(); // a few keys already out

    // screen helpers; s scales a 1080p layout
    const rect = (x, y, w, h, col, a) => { line2(x, y, x + w, y, col, a); line2(x + w, y, x + w, y + h, col, a); line2(x + w, y + h, x, y + h, col, a); line2(x, y + h, x, y, col, a); };
    const text = (str, x, y, px, col, a, bold) => { const g = k.g; g.font = `${bold ? 'bold ' : ''}${px | 0}px ${MONO}`; g.fillStyle = `rgba(${col},${a})`; g.fillText(str, x, y); };
    const hue = (h, a) => `hsla(${h % 360},100%,60%,${a})`;
    function button(label, x, y, w, h, lit, col, s) {
      const g = k.g;
      if (lit > 0.05) { g.fillStyle = `rgba(${col},${lit * 0.35})`; g.fillRect(x, y, w, h); }
      rect(x, y, w, h, col, 0.6 + lit * 0.4); line2(x + 2, y + h + 2, x + w + 2, y + h + 2, col, 0.3); line2(x + w + 2, y + 2, x + w + 2, y + h + 2, col, 0.3); // bevel
      g.textAlign = 'center'; text(label, x + w / 2, y + h / 2 + 6 * s, 17 * s, lit > 0.5 ? C.white : col, 1, true); g.textAlign = 'left';
    }

    return {
      label: 'KEYGEN',
      enter() { phase = 0; },
      signal(kind) { if (kind === 'ok') { flash = 1; phase = Math.max(phase, 1.2); } if (kind === 'error') flash = -1; },
      update(dt) {
        phase += dt * (1 + env.level); patch = (patch + dt * 0.09) % 1.25;
        if (phase > 3.2) next();
        flash *= Math.pow(0.1, dt);
      },
      draw() {
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), t = env.t;
        // copper bars sweeping the whole window
        for (let i = 0; i < 3; i++) {
          const cy = H * (0.5 + 0.43 * Math.sin(t * 0.9 + i * 0.75)), col = [C.hot, C.gold, C.ice][i];
          for (let j = -6; j <= 6; j++) line2(W * 0.01, cy + j * 2 * s, W * 0.99, cy + j * 2 * s, col, (1 - Math.abs(j) / 7) * 0.45);
        }
        // the window: double border, title bar
        const fx = W * 0.008, fy = H * 0.008, fw = W - 2 * fx, fh = H - 2 * fy, tb = H * 0.045;
        rect(fx, fy, fw, fh, C.ice, 1); rect(fx + 4 * s, fy + 4 * s, fw - 8 * s, fh - 8 * s, C.ice, 0.4);
        g.fillStyle = 'rgba(54,214,255,0.12)'; g.fillRect(fx + 4 * s, fy + 4 * s, fw - 8 * s, tb - 4 * s);
        line2(fx, fy + tb, fx + fw, fy + tb, C.ice, 0.8);
        text('NYX // GIBSON CREW  ::  GIBSON.EXE KEYGEN v2.6  ::  CRACKED 10/17', fx + 16 * s, fy + tb * 0.68, 18 * s, C.white, 0.95, true);
        for (let i = 0; i < 3; i++) { const bx = fx + fw - (i + 1) * 38 * s - 8 * s; rect(bx, fy + 9 * s, 30 * s, tb - 16 * s, i ? C.ice : C.hot, 0.9); }
        g.textAlign = 'center'; text('X', fx + fw - 38 * s + 7 * s, fy + tb * 0.72, 18 * s, C.hot, 1, true); g.textAlign = 'left';

        // --- left: logo, vector star, greetz ---
        const lx = W * 0.022, lw = W * 0.132;
        const cell = Math.min(lw / 17, 17 * s);
        [...'NYX'].forEach((ch, n) => GLYPH[ch].forEach((row, r) => {
          const wob = Math.sin(t * 2 + r * 0.5 + n) * cell * 0.3; // rows sway like a raster split
          for (let c = 0; c < 5; c++) if (row[c] === 'X') {
            const x = lx + (n * 6 + c) * cell + wob, y = H * 0.085 + r * cell;
            g.fillStyle = hue(t * 90 + r * 22 + n * 40, 0.85); g.fillRect(x, y, cell - 2, cell - 2);
            rect(x, y, cell - 2, cell - 2, C.white, 0.2);
          }
        }));
        const sub = 'GIBSON CREW', sp = lw / sub.length;
        [...sub].forEach((ch, i) => { g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = hue(t * 120 + i * 30, 0.95); g.fillText(ch, lx + i * sp, H * 0.085 + 7 * cell + 34 * s + Math.sin(t * 5 + i * 0.7) * 5 * s); });

        // vector star, placed in world space so it projects into the left margin
        setCam({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
        const z = 40, ox = (lx + lw / 2 - W / 2) * z / k.F, oy = -(H * 0.42 - H / 2) * z / k.F, R = lw * 0.26 * z / k.F * (1 + env.pulse * 0.12);
        const a = t * 0.9, b = t * 0.63, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        V.forEach((v, i) => { const x1 = v[0] * ca - v[2] * sa, z1 = v[0] * sa + v[2] * ca, y1 = v[1] * cb - z1 * sb, z2 = v[1] * sb + z1 * cb; P[i][0] = ox + x1 * R; P[i][1] = oy + y1 * R; P[i][2] = z + z2 * R; });
        for (const [i, j] of STAR) seg(P[i][0], P[i][1], P[i][2], P[j][0], P[j][1], P[j][2], C.hot, 1, 200);
        for (const [i, j] of CUBE) seg(P[i][0], P[i][1], P[i][2], P[j][0], P[j][1], P[j][2], C.ice, 0.5, 200);

        // greetz roll, fading in and out at the edges of its box
        const gy0 = H * 0.6, gy1 = H * 0.9, step = 30 * s;
        text('-= GREETZ =-', lx, gy0 - 14 * s, 18 * s, C.gold, 1, true);
        line2(lx, gy0 - 6 * s, lx + lw, gy0 - 6 * s, C.gold, 0.6);
        const roll = (t * 28 * s) % (GREETZ.length * step);
        for (let i = 0; i < GREETZ.length * 2; i++) {
          const y = gy1 - roll + i * step - GREETZ.length * step; if (y < gy0 + 10 * s || y > gy1) continue;
          const edge = Math.min(1, (y - gy0) / (60 * s), (gy1 - y) / (60 * s));
          text(GREETZ[i % GREETZ.length], lx + Math.sin(t * 2 + i) * 6 * s, y, 17 * s, i % 2 ? C.neon : C.ice, edge, false);
        }

        // --- right: the generator ---
        const rx = W * 0.846, rw = W * 0.132, fs = 16 * s;
        text('REGISTRATION', rx, H * 0.095, 20 * s, C.gold, 1, true);
        text('TARGET: GIBSON.EXE v4.0', rx, H * 0.095 + 24 * s, 13 * s, C.ice, 0.8);
        // NAME: typed letter by letter
        const nm = name(), typed = nm.slice(0, Math.floor(Math.min(1, phase / 0.9) * nm.length));
        const ny = H * 0.16;
        text('NAME:', rx, ny, fs, C.ice, 0.9, true); rect(rx, ny + 8 * s, rw, 30 * s, C.ice, 0.8);
        text(typed + (Math.sin(t * 10) > 0 ? '_' : ''), rx + 8 * s, ny + 29 * s, fs, C.white, 1);
        // SERIAL: rolls, then locks left to right
        const sy = H * 0.235, ser = serialOf(nm), lock = Math.floor(Math.max(0, (phase - 1) / 1.1) * ser.length);
        text('SERIAL:', rx, sy, fs, C.ice, 0.9, true); rect(rx, sy + 8 * s, rw, 30 * s, flash < -0.2 ? C.hot : C.ice, 0.8);
        let shown = '';
        if (phase > 0.9) for (let i = 0; i < ser.length; i++) shown += i < lock || ser[i] === '-' ? ser[i] : k.hex(1);
        text(shown, rx + 8 * s, sy + 29 * s, fs, lock >= ser.length ? C.neon : C.gold, 1, true);
        // buttons: GENERATE pumps on the beat
        const by = H * 0.31, bh = 40 * s;
        button('[ GENERATE ]', rx, by, rw, bh, Math.max(env.pulse, flash, phase < 0.3 ? 1 : 0), C.hot, s);
        const half = (rw - 10 * s) / 2;
        button('PATCH', rx, by + bh + 12 * s, half, bh * 0.8, patch < 1 ? 0.2 : 0.8, C.neon, s);
        button('ABOUT', rx + half + 10 * s, by + bh + 12 * s, half, bh * 0.8, 0.1 + Math.max(0, Math.sin(t * 0.7)) * 0.3, C.violet, s);
        // patching progress
        const py = by + bh * 1.8 + 34 * s, pp = Math.min(1, patch);
        rect(rx, py, rw, 14 * s, C.neon, 0.7);
        g.fillStyle = `rgba(${C.neon},0.5)`; g.fillRect(rx + 2, py + 2, (rw - 4) * pp, 14 * s - 4);
        text(patch < 1 ? `PATCHING... ${Math.round(pp * 100)}%` : 'PATCHED. CRC OK.', rx, py + 32 * s, 13 * s, patch < 1 ? C.neon : C.gold, 0.9);
        // the log of keys made so far
        const ly = H * 0.58;
        text('-= KEYS ISSUED =-', rx, ly - 14 * s, 18 * s, C.gold, 1, true); line2(rx, ly - 6 * s, rx + rw, ly - 6 * s, C.gold, 0.6);
        log.forEach(([n, key], i) => {
          const a2 = 1 - i / log.length * 0.8;
          text(n.slice(0, 22), rx, ly + 18 * s + i * 34 * s, 12 * s, C.ice, a2 * 0.7);
          text(key, rx, ly + 32 * s + i * 34 * s, 13 * s, C.neon, a2);
        });
        if (flash < -0.2) text('!! INVALID KEY !!', rx, H * 0.55, 16 * s, C.hot, -flash, true);

        // --- bottom: the sine scroller ---
        const px = 30 * s, cw = px * 0.62, off = (t * 160 * s) % (SCROLL.length * cw), y0 = H * 0.962;
        g.font = `bold ${px | 0}px ${MONO}`;
        const first = Math.floor(off / cw);
        for (let i = 0; i * cw < W + cw; i++) {
          const ci = (first + i) % SCROLL.length, ch = SCROLL[ci]; if (ch === ' ') continue;
          const x = i * cw - (off % cw);
          g.fillStyle = hue(ci * 12 + t * 60, 0.95); g.fillText(ch, x, y0 + Math.sin(x * 0.012 - t * 4) * 8 * s);
        }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
