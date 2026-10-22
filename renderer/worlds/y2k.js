// Y2K: an office on New Year's Eve 1999. A wall of CRTs under a big clock counting down the last
// forty seconds of the century. At midnight some screens roll over to 1900, then the rest go one
// by one (19100, 00-00-00, garbage), the strip lights flicker, the fax starts spewing and the
// systems list turns to FAULT. Then the patches land, screen by screen, ALL SYSTEMS NOMINAL, and
// it's 23:59:20 again. A failed command faults a system early; one that works fixes a 2-digit year.
(function (Worlds) {
  Worlds.define('y2k', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, box, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 90, COUNT = 40, BUG = 14, FIX = 9;
    const SYSTEMS = ['BANK', 'POWER GRID', 'ELEVATORS', 'VCR CLOCK', 'AIR TRAFFIC', 'PAYROLL', 'SATELLITE LINK', 'MICROWAVE', 'PAGER NET', 'PHONE SWITCH'];
    const GLITCH = ['01-JAN-1900', '01-JAN-19100', '00-00-00', '##-###-####', '31-DEC-1899', 'ERR 0x7CF', '01/01/:0', 'JAN 00 1900'];
    const COBOL = ['MOVE WS-YY TO OUT-YEAR.', 'IF WS-YY < 50 ADD 100 TO WS-YY.', 'COMPUTE AGE = 99 - BIRTH-YY.', 'PIC 99 VALUE ZERO.', 'ADD 1 TO WS-YY GIVING NEXT-YY.', 'WRITE REC-DATE FROM WS-DATE.', 'IF EXPIRY-YY > CUR-YY PERFORM RENEW.', '*> FIXME: 2 DIGITS ENOUGH TIL 2000'];
    const MON = Array.from({ length: 18 }, (_, i) => ({ x: (i % 6 - 2.5) * 2.4, y: 1.4 + Math.floor(i / 6) * 1.9, bug: null, at: 0, fixAt: 0 }));
    let phase = 'count', pt = 0, fault = new Set(), found = 0, fixed = 0, paper = 0, code = [], codeT = 0, lit = 1;
    function restart() { phase = 'count'; pt = 0; fault = new Set(); paper = 0; for (const m of MON) { m.bug = null; m.at = rand(0.3, BUG - 3); m.fixAt = rand(0.5, FIX - 2); } }
    restart();
    const pad = (n) => String(n).padStart(2, '0');

    return {
      label: 'Y2K',
      signal(kind) { if (kind === 'error') fault.add(pick(SYSTEMS)); if (kind === 'ok') fixed++; },
      update(dt) {
        pt += dt;
        codeT -= dt * (1 + env.level * 3);
        if (codeT < 0) { codeT = 0.9; /* a line at a time, slowly: scrolling text smears on the fading canvas */ code.push(pick(COBOL)); if (code.length > 10) code.shift(); if (phase === 'count') found += 1 + Math.floor(env.level * 3); }
        if (phase === 'count' && pt > COUNT) { phase = 'bug'; pt = 0; for (const m of MON) if (Math.random() < 0.3) m.bug = '01-JAN-1900'; }
        else if (phase === 'bug') {
          for (const m of MON) if (!m.bug && pt > m.at) m.bug = pick(GLITCH);
          if (Math.random() < dt * 1.5) fault.add(pick(SYSTEMS));
          paper = Math.min(6, paper + dt * 0.6);
          if (pt > BUG) { phase = 'fix'; pt = 0; }
        } else if (phase === 'fix') {
          for (const m of MON) if (m.bug && pt > m.fixAt) m.bug = m.bug === 'PATCHED' ? m.bug : 'PATCHED';
          if (Math.random() < dt * 2 && fault.size) fault.delete([...fault][0]);
          if (pt > FIX) restart();
        }
        lit = phase === 'bug' ? (Math.random() < 0.15 ? 0.2 : 1) : 1;
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: Math.sin(t * 0.08) * 2, y: 2.4, z: -9 }, 0, 3, 4));
        // the room: floor tiles, ceiling strip lights, the back wall
        for (let x = -8; x <= 8; x += 2) seg(x, 0, -6, x, 0, 6, C.violet, 0.2, FOG);
        for (let z = -6; z <= 6; z += 2) seg(-8, 0, z, 8, 0, z, C.violet, 0.2, FOG);
        for (let z = -4; z <= 4; z += 4) for (const x of [-4, 4]) { seg(x - 1.5, 6, z, x + 1.5, 6, z, C.white, 0.7 * lit, FOG); seg(x - 1.5, 5.9, z, x + 1.5, 5.9, z, C.white, 0.4 * lit, FOG); }
        seg(-8, 0, 5, 8, 0, 5, C.ice, 0.4, FOG); seg(-8, 6.2, 5, 8, 6.2, 5, C.ice, 0.3, FOG);
        // the wall of CRTs
        for (const m of MON) {
          const bad = m.bug && m.bug !== 'PATCHED', jit = bad && Math.random() < 0.3 ? rand(-0.08, 0.08) : 0, col = !m.bug ? C.neon : bad ? C.hot : C.gold;
          box(m.x, m.y - 0.8, 4.8, 2, 1.5, 0.6, C.ice, 0.4, FOG);
          if (bad && Math.random() < 0.08) continue; // a flicker
          const txt = !m.bug ? (phase === 'count' ? '31-DEC-1999' : '01-JAN-2000') : m.bug === 'PATCHED' ? (pt > m.fixAt + 1 ? '01-JAN-2000' : 'PATCHED') : m.bug;
          text3(txt, m.x - 0.85 + jit, m.y + jit, 4.4, col, 0.32, lit);
        }
        // desks, and the fax spewing paper
        for (const x of [-4, 0, 4]) box(x, 0, 0, 3, 0.8, 1.4, C.gold, 0.4, FOG);
        box(4, 0.8, 0, 0.8, 0.35, 0.6, C.white, 0.6, FOG);
        if (paper > 0) { let px = 4, py = 1.15, pz = -0.3; for (let i = 1; i <= paper * 4; i++) { const nz = pz - 0.25, ny = Math.max(0.02, py - 0.04 * i), nx = 4 + Math.sin(i * 0.9) * 0.15; seg(px - 0.3, py, pz, nx - 0.3, ny, nz, C.white, 0.7, FOG); seg(px + 0.3, py, pz, nx + 0.3, ny, nz, C.white, 0.7, FOG); px = nx; py = ny; pz = nz; } }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 28 * s;
      const left = Math.max(0, COUNT - pt), secs = 60 - Math.ceil(left);
      const clock = phase === 'count' ? (left > 0 ? `23:59:${pad(Math.min(59, secs))}` : '00:00:00') : `00:00:${pad(Math.floor(pt) % 60)}`;
      const date = phase === 'count' ? '31-DEC-1999' : phase === 'bug' && Math.sin(env.t * 9) > 0 ? '01-JAN-1900' : '01-JAN-2000';
      g.font = `bold ${44 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${phase === 'bug' ? C.hot : C.gold},0.95)`; g.fillText(clock, x0, 60 * s);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.8)`; g.fillText(phase === 'count' ? `${date}   T-${Math.ceil(left)}s` : date, x0, 84 * s);
      // the systems
      g.font = `${13 * s | 0}px ${MONO}`;
      SYSTEMS.forEach((n, i) => { const bad = fault.has(n), st = bad ? 'FAULT' : 'NOMINAL'; g.fillStyle = `rgba(${bad ? C.hot : C.neon},${bad && Math.sin(env.t * 8 + i) < 0 ? 0.4 : 0.85})`; g.fillText(`${n.padEnd(15)}${st}`, x0, H - (40 + (SYSTEMS.length - 1 - i) * 18) * s); });
      if (phase === 'fix' && !fault.size) { g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.95)`; g.fillText('ALL SYSTEMS NOMINAL', x0, H - (40 + SYSTEMS.length * 18 + 6) * s); }
      // remediation, right margin
      const rx = W - 28 * s, right = (str, y, col, f) => { g.font = f; g.fillStyle = `rgba(${col},0.9)`; g.fillText(str, rx - g.measureText(str).width, y); };
      right(`2-DIGIT YEARS FOUND: ${found}`, 34 * s, C.gold, `bold ${15 * s | 0}px ${MONO}`);
      right(`REMEDIATED: ${fixed + Math.floor(found * 0.6)}`, 54 * s, C.ice, `${13 * s | 0}px ${MONO}`);
      g.font = `${11 * s | 0}px ${MONO}`;
      code.forEach((l, i) => { g.fillStyle = `rgba(${/YY|99/.test(l) ? C.gold : C.neon},${0.4 + i * 0.06})`; g.fillText(l, rx - 290 * s, (84 + i * 16) * s); });
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
