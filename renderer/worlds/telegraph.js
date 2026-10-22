// TELEGRAPH: a Victorian telegraph office. The brass key taps out your last command in Morse,
// the sounder's armature clacks down with every mark, and the ticker machine pushes a paper tape
// across the desk with the dots and dashes printed on it and the letters under them. When nothing
// new comes in, the operator calls the line: CQ CQ DE GBS. Poles and wires run off past the window.
(function (Worlds) {
  Worlds.define('telegraph', (k) => {
    const { C, env, seg, setCam, lookAt, text3, ring, box } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 90, DY = 0.9, TAPE = 0.6; // tape units per second
    const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
      0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '-': '-....-', '=': '-...-', ':': '---...', '"': '.-..-.', '@': '.--.-.' };
    const IDLE = ['CQ CQ DE GBS', 'QRV', 'QTH GIBSON', 'CQ CQ CQ'];
    let text = '', els = [], i = 0, left = 0, on = false, ci = -1, lastAt = 0, wait = 1, msgNo = 1, tape = 0, marks = [], idleN = 0, arm = 0;

    function load(s) {
      text = s.toUpperCase().replace(/\s+/g, ' ').slice(0, 60); els = []; i = 0; left = 0;
      [...text].forEach((ch, n) => {
        if (ch === ' ') { els.push({ on: false, d: 4, ci: n }); return; } // with the letter gap before it, a word gap of 7
        const code = MORSE[ch]; if (!code) return;
        [...code].forEach((m, j) => { els.push({ on: true, d: m === '.' ? 1 : 3, ci: n, m }); if (j < code.length - 1) els.push({ on: false, d: 1, ci: n }); });
        els.push({ on: false, d: 3, ci: n, end: ch });
      });
    }
    const wpm = () => Math.round(12 + env.level * 16);

    return {
      label: 'TELEGRAPH',
      update(dt) {
        const cmd = env.cmd;
        if (cmd && cmd.at !== lastAt) { lastAt = cmd.at; load(cmd.text); msgNo++; }
        const unit = 1.2 / wpm();
        if (i >= els.length) { on = false; ci = -1; wait -= dt; if (wait < 0) { load(IDLE[idleN++ % IDLE.length]); wait = 3 + Math.random() * 3; } }
        else {
          left -= dt;
          while (left <= 0 && i < els.length) {
            const e = els[i++]; on = e.on; ci = e.ci; left += e.d * unit;
            if (e.on) marks.push({ s: tape, len: e.d * unit * TAPE });
            if (e.end) marks.push({ s: tape, ch: e.end });
          }
        }
        if (i < els.length) tape += dt * TAPE; // the tape runs while a message is going
        marks = marks.filter((m) => tape - m.s < 4);
        arm += ((on ? 1 : 0) - arm) * Math.min(1, dt * 40);
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: -0.4 + Math.sin(t * 0.06) * 0.5, y: 1.75, z: -1.6 }, 0.2, 1.0, 3));
        // the room: plank floor, wainscot, the window
        for (let x = -4; x <= 4; x += 0.5) seg(x, 0, -2, x, 0, 5, C.violet, 0.2, FOG);
        for (const sx of [-4, 4]) { seg(sx, 0, -2, sx, 0, 5, C.violet, 0.5, FOG); seg(sx, 1, -2, sx, 1, 5, C.violet, 0.4, FOG); seg(sx, 3.2, -2, sx, 3.2, 5, C.violet, 0.4, FOG); }
        seg(-4, 1, 5, 4, 1, 5, C.violet, 0.4, FOG); seg(-4, 3.2, 5, 4, 3.2, 5, C.violet, 0.4, FOG);
        const wx0 = -2.2, wx1 = 2.2, wy0 = 1.4, wy1 = 2.9;
        for (const [a, b] of [[[wx0, wy0], [wx1, wy0]], [[wx1, wy0], [wx1, wy1]], [[wx1, wy1], [wx0, wy1]], [[wx0, wy1], [wx0, wy0]], [[0, wy0], [0, wy1]], [[wx0, (wy0 + wy1) / 2], [wx1, (wy0 + wy1) / 2]]]) seg(a[0], a[1], 5, b[0], b[1], 5, C.gold, 0.7, FOG);
        // out the window: the line, pole after pole, wires sagging between them
        const poles = []; for (let p = 0; p < 7; p++) poles.push([-6 + p * 3.2, -3, 14 + p * 12]);
        for (const [x, y, z] of poles) { seg(x, y, z, x, y + 9, z, C.ice, 0.6, 200); seg(x - 1.2, y + 8.4, z, x + 1.2, y + 8.4, z, C.ice, 0.6, 200); }
        for (let p = 0; p < poles.length - 1; p++) for (const off of [-1, -0.4, 0.4, 1]) {
          const A = poles[p], B = poles[p + 1]; let q = [A[0] + off, A[1] + 8.4, A[2]];
          for (let s = 1; s <= 8; s++) { const f = s / 8, r = [A[0] + off + (B[0] - A[0]) * f, A[1] + 8.4 - Math.sin(Math.PI * f) * 0.6, A[2] + (B[2] - A[2]) * f]; seg(...q, ...r, C.ice, 0.4, 200); q = r; }
        }
        // the desk
        box(0, 0, 1.6, 5, DY, 1.4, C.gold, 0.4, FOG);
        // the key: base, pivot, lever dipping on every mark, the knob
        const kx = -1.2, kz = 1.2;
        box(kx, DY, kz, 0.25, 0.05, 0.6, C.gold, 0.8, FOG);
        const piv = [kx, DY + 0.12, kz + 0.15], dip = 0.06 * arm, knob = [kx, DY + 0.16 - dip, kz - 0.25];
        seg(kx, DY + 0.05, kz + 0.15, ...piv, C.gold, 0.9, FOG); seg(...piv, ...knob, C.gold, 1, FOG); seg(...piv, kx, DY + 0.12 + dip * 0.4, kz + 0.3, C.gold, 0.9, FOG);
        ring(knob[0], knob[1] + 0.02, knob[2], 0.07, 12, on ? C.white : C.gold, 1, FOG);
        ring(knob[0], knob[1] + 0.04, knob[2], 0.05, 12, C.gold, 0.8, FOG);
        // the sounder: two coils and the armature that clacks down
        const sx = -0.2, sz = 1.9;
        box(sx, DY, sz, 0.5, 0.04, 0.3, C.ice, 0.7, FOG);
        for (const cx of [-0.1, 0.1]) for (let y = 0.06; y < 0.24; y += 0.04) ring(sx + cx, DY + y, sz, 0.05, 10, C.hot, 0.6, FOG);
        const ay = DY + 0.32 - arm * 0.05;
        seg(sx - 0.25, ay, sz, sx + 0.25, ay + 0.03, sz, on ? C.white : C.ice, 1, FOG); seg(sx + 0.25, DY, sz, sx + 0.25, ay + 0.03, sz, C.ice, 0.7, FOG);
        // the ticker machine, and its tape running out across the desk toward the key
        const mx = 1.4, mz = 1.5;
        box(mx, DY, mz, 0.6, 0.35, 0.45, C.ice, 0.7, FOG);
        ring(mx + 0.1, DY + 0.5, mz, 0.12, 14, C.white, 0.6, FOG, 'xy'); // the paper roll
        seg(mx + 0.1, DY + 0.38, mz, mx - 0.3, DY + 0.06, mz - 0.25, C.white, 0.5, FOG);
        const tz = mz - 0.25, ty = DY + 0.02, x0 = mx - 0.3, len = 3.2, sc = 0.8; // tape metres per tape unit
        seg(x0, ty, tz - 0.04, x0 - len, ty, tz - 0.04, C.white, 0.5, FOG); seg(x0, ty, tz + 0.04, x0 - len, ty, tz + 0.04, C.white, 0.5, FOG);
        for (const m of marks) {
          const x = x0 - (tape - m.s) * sc; if (x < x0 - len) continue;
          if (m.ch) text3(m.ch, x - 0.02, ty + 0.005, tz - 0.12, C.hot, 0.07, 0.9);
          else seg(x, ty + 0.003, tz, x + m.len * sc, ty + 0.003, tz, C.hot, 1, FOG);
        }
        // the clock over the window
        const cc = [0, 3.0, 4.95]; ring(...cc, 0.3, 20, C.gold, 0.7, FOG, 'xy');
        const now = new Date(), hA = Math.PI / 2 - (now.getHours() % 12 + now.getMinutes() / 60) * Math.PI / 6, mA = Math.PI / 2 - now.getMinutes() * Math.PI / 30;
        seg(...cc, cc[0] + Math.cos(hA) * 0.16, cc[1] + Math.sin(hA) * 0.16, cc[2], C.gold, 0.9, FOG); seg(...cc, cc[0] + Math.cos(mA) * 0.25, cc[1] + Math.sin(mA) * 0.25, cc[2], C.gold, 0.9, FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('GIBSON & WESTERN LINE  ::  STATION GBS', 28 * s, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText(`MSG NO. ${String(msgNo).padStart(4, '0')}`, 28 * s, 56 * s);
      const w = `${wpm()} WPM`; g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${on ? C.hot : C.ice},0.9)`; g.fillText(w, W - 28 * s - g.measureText(w).width, 34 * s);
      // the message going out, the letter on the key lit
      g.font = `bold ${16 * s | 0}px ${MONO}`; const cw = g.measureText('M').width, n = Math.floor(420 * s / cw), start = Math.max(0, ci - n + 8);
      [...text.slice(start, start + n)].forEach((ch, j) => { const lit = start + j === ci; g.fillStyle = `rgba(${lit ? C.hot : C.neon},${lit ? 1 : start + j < ci ? 0.85 : 0.4})`; g.fillText(ch, 28 * s + j * cw, H - 36 * s); });
      const code = ci >= 0 && MORSE[text[ci]] || ''; g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(code.replace(/\./g, '•').replace(/-/g, '—'), 28 * s, H - 62 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
