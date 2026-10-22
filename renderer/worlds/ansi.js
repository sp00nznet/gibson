// ANSI GALLERY: BBS-era block art drawn a line at a time, as if over a slow modem. The left margin
// streams pieces from fictional art groups: blocky logos built from a 5x5 font, a skull, a sunset,
// an ONLY THE ELITE header, and now and then whatever you just typed, as a logo. The right margin
// is an .NFO viewer, and a big faint piece hangs behind the terminal. All 16 CGA colours, cells
// shaded like the block characters (light, medium, dark, full). A failed command drops carrier.
(function (Worlds) {
  Worlds.define('ansi', (k) => {
    const { env, pick } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace";
    const CGA = ['0,0,0', '0,0,170', '0,170,0', '0,170,170', '170,0,0', '170,0,170', '170,85,0', '170,170,170', '85,85,85', '85,85,255', '85,255,85', '85,255,255', '255,85,85', '255,85,255', '255,255,85', '255,255,255'];
    const SHADE = [0, 0.25, 0.5, 0.75, 1]; // space, light, medium, dark, full block
    // 5x5 font, row by row
    const F = {
      A: '.###.#...######...##...#', B: '####.#...#####.#...#####.', C: '.#####....#....#.....####', D: '####.#...##...##...#####.', E: '######....####.#....#####',
      F: '######....####.#....#....', G: '.#####....#..###...#.####', H: '#...##...#######...##...#', I: '#####..#....#....#..#####', J: '..###...#....#.#..#..##..',
      K: '#...##..#.###..#..#.#...#', L: '#....#....#....#....#####', M: '#...###.###.#.##...##...#', N: '#...###..##.#.##..###...#', O: '.###.#...##...##...#.###.',
      P: '####.#...#####.#....#....', Q: '.###.#...##.#.##..#..##.#', R: '####.#...#####.#..#.#...#', S: '.#####.....###.....#####.', T: '#####..#....#....#....#..',
      U: '#...##...##...##...#.###.', V: '#...##...##...#.#.#...#..', W: '#...##...##.#.###.###...#', X: '#...#.#.#...#...#.#.#...#', Y: '#...#.#.#...#....#....#..',
      Z: '#####...#...#...#...#####', 0: '.###.#..###.#.###..#.###.', 1: '..#...##....#....#...###.', 2: '####.....#.###.#....#####', 3: '####.....#.###.....#####.',
      4: '#...##...######....#....#', 5: '######....####.....#####.', 6: '.###.#....####.#...#.###.', 7: '#####....#...#...#....#..', 8: '.###.#...#.###.#...#.###.',
      9: '.###.#...#.####....#.###.', '!': '..#....#....#.........#..', '.': '......................#..', '-': '..........###............', '?': '.###.....#..##.........#..', ':': '.......#.........#.......',
    };
    // A blocky logo: rows of cells {s: shade, c: colour}. Bright at the top, dark at the foot, a shadow, an underline.
    function logo(text, ramp, width) {
      const words = text.toUpperCase().replace(/[^A-Z0-9!.?:\- ]/g, '').split(/\s+/).filter(Boolean), lines = [];
      for (const w of words) { const last = lines[lines.length - 1]; if (last && (last + ' ' + w).length * 6 <= width) lines[lines.length - 1] = last + ' ' + w; else lines.push(w.slice(0, Math.floor(width / 6))); }
      const rows = [];
      for (const ln of lines) {
        const grid = Array.from({ length: 6 }, () => Array.from({ length: ln.length * 6 + 1 }, () => ({ s: 0, c: 0 })));
        [...ln].forEach((ch, i) => { const g = F[ch] || '.'.repeat(25); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '#') grid[r][i * 6 + c] = { s: 4, c: ramp[r] }; });
        for (let r = 4; r >= 0; r--) for (let c = grid[r].length - 2; c >= 0; c--) if (grid[r][c].s === 4 && !grid[r + 1][c + 1].s) grid[r + 1][c + 1] = { s: 1, c: 8 };
        rows.push(...grid);
      }
      rows.push(Array.from({ length: Math.min(width, rows[0] ? rows[0].length : 10) }, (_, i) => ({ s: i % 2 ? 2 : 1, c: ramp[2] })));
      return rows;
    }
    const SKULL = ['      ########      ', '    ############    ', '   ##############   ', '  ################  ', '  ###  ######  ###  ', '  ##    ####    ##  ', '  ###  ##++##  ###  ',
      '   ######++######   ', '    ####    ####    ', '     ## #### ##     ', '     ##########     ', '      # # # # #     '];
    const skull = () => SKULL.map((row, r) => [...('  ' + row + row.slice(0, 0))].map((ch) => (ch === '#' ? { s: r < 4 ? 4 : 3, c: r < 4 ? 15 : 7 } : ch === '+' ? { s: 2, c: 12 } : { s: 0, c: 0 }))).map((row) => row.flatMap((x) => [x, x]));
    function sunset(w) { // stripes of sky, a striped half sun, a dithered sea
      const rows = [];
      for (let r = 0; r < 18; r++) {
        const row = [];
        for (let c = 0; c < w; c++) {
          const dx = (c - w / 2) / 2, dy = 11 - r, inSun = r < 11 && dx * dx + dy * dy < 49 && !(r > 6 && r % 2 === 0);
          if (r >= 11) row.push({ s: (c + r) % 3 ? 1 : 2, c: r % 2 ? 1 : 9 });
          else if (inSun) row.push({ s: 4, c: r < 5 ? 14 : r < 8 ? 6 : 12 });
          else row.push({ s: r < 3 ? 1 : r < 6 ? 2 : 3, c: r < 3 ? 5 : r < 6 ? 13 : 4 });
        }
        rows.push(row);
      }
      return rows;
    }
    const RAMPS = [[15, 11, 3, 1, 1], [15, 14, 6, 4, 4], [15, 13, 5, 1, 1], [15, 10, 2, 2, 8], [14, 12, 4, 4, 8]];
    const GROUPS = ['NEON KNIGHTS', 'PHOSPHOR', 'ONLY THE ELITE', 'CARRIER LOST', 'SYSOP SAYS HI', 'BLOCK PARTY', 'MIDNITE', 'HIGH ASCII'];
    const NFO = [
      ['╔══════════════════════════════╗', 3], ['║   P H O S P H O R   9 7     ║', 11], ['║   ░▒▓█ PROUDLY PRESENTS █▓▒░ ║', 13], ['╚══════════════════════════════╝', 3], ['', 7],
      ['  TITLE....: GIBSON TERM v4.2', 7], ['  TYPE.....: UTILITY', 7], ['  DISKS....: 03 x 1.44', 7], ['  DATE.....: 10/21/97', 7], ['  SUPPLIER.: ZERO', 7], ['  CRACKER..: NYX', 7], ['', 7],
      ['  ─────────── NOTES ───────────', 3], ['  Unzip, run SETUP.EXE, enjoy.', 7], ['  Support the sysops who host', 7], ['  you. Leechers get the boot.', 7], ['', 7],
      ['  ─────────── GREETS ──────────', 3], ['  NEON KNIGHTS . MIDNITE CREW', 13], ['  BLOCK PARTY . HIGH ASCII', 13], ['  all the boards that stay up', 13], ['  past 3am on one phone line', 13], ['', 7],
      ['  CALL THE HQ: 555-0123 (28.8)', 14], ['  ░▒▓█ 1997 █▓▒░', 8],
    ];
    // a stream of rows feeding a panel, one line at a time
    function panel(make) { return { lines: [], queue: [], make, acc: 0, hold: 0 }; }
    const left = panel(() => { const r = Math.random(); const p = r < 0.5 ? logo(pick(GROUPS), pick(RAMPS), 54) : r < 0.75 ? skull() : sunset(54); return [...p, [], []]; });
    const back = panel(() => [...logo(pick(GROUPS), pick(RAMPS), 40), [], [], ...sunset(40), [], []]);
    let nfoAt = 0, nfoLines = [], lastCmd = 0, dropped = 0;

    function feed(p, dt, rate, max) {
      if (p.hold > 0) { p.hold -= dt; return; }
      p.acc += dt * rate;
      while (p.acc >= 1) {
        p.acc -= 1;
        if (!p.queue.length) { p.queue = p.make(); p.hold = 3; return; }
        p.lines.push(p.queue.shift()); if (p.lines.length > max) p.lines.shift();
      }
    }
    function drawCells(p, x0, y0, cw, ch, alpha) {
      const g = k.g;
      p.lines.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const q = row[c]; if (!q.s) continue; g.fillStyle = `rgba(${CGA[q.c]},${SHADE[q.s] * alpha})`; g.fillRect(x0 + c * cw, y0 + r * ch, cw, ch); } });
    }

    return {
      label: 'ANSI GALLERY',
      signal(kind) { if (kind === 'error') { dropped = 2; left.lines.push([]); left.queue = []; } },
      update(dt) {
        const baud = 5 + env.level * 25; // rows per second
        dropped = Math.max(0, dropped - dt);
        const c = env.cmd;
        if (c && c.at !== lastCmd) { lastCmd = c.at; const w = (c.text.match(/[A-Za-z0-9]+/g) || []).slice(0, 2).join(' '); if (w) left.queue.push([], ...logo(w, pick(RAMPS), 54), []); }
        if (!dropped) { feed(left, dt, baud, 120); feed(back, dt, baud * 0.6, 40); }
        nfoAt += dt * (baud * 0.4); if (nfoAt >= 1) { nfoAt = 0; nfoLines.push(NFO[nfoLines.length % NFO.length]); if (nfoLines.length > 60) nfoLines = nfoLines.slice(-NFO.length); }
      },
      draw() {
        const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), cw = 5 * s, ch = 8 * s;
        const rows = Math.floor((H - 40 * s) / ch);
        while (left.lines.length > rows) left.lines.shift();
        drawCells(back, W / 2 - 20 * 12 * s, 60 * s, 12 * s, 20 * s, 0.14 + env.pulse * 0.06);
        drawCells(left, 16 * s, 20 * s, cw, ch, 0.95);
        // the cursor, blinking under the last line
        if (Math.sin(env.t * 8) > 0) { g.fillStyle = `rgba(${CGA[7]},0.9)`; g.fillRect(16 * s, 20 * s + left.lines.length * ch, cw, ch); }
        if (dropped) { g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${CGA[12]},0.95)`; g.fillText('NO CARRIER', 16 * s, 20 * s + (left.lines.length + 2) * ch); }
        // the NFO viewer, right margin
        const rx = W - 300 * s, lh = 14 * s, show = Math.floor((H - 120 * s) / lh);
        g.font = `bold ${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${CGA[11]},0.9)`; g.fillText('VIEWING: PHSPHR97.NFO', rx, 30 * s);
        g.font = `${12 * s | 0}px ${MONO}`;
        nfoLines.slice(-show).forEach(([t, c], i) => { g.fillStyle = `rgba(${CGA[c]},0.9)`; g.fillText(t, rx, 54 * s + i * lh); });
        g.fillStyle = `rgba(${CGA[8]},0.9)`; g.fillText(`${(2400 * (1 + Math.round(env.level * 11))).toLocaleString('en-US')} BPS  ::  ANSI-BBS  ::  80x25`, rx, H - 24 * s);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
