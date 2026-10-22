// HOMEPAGE: a walk through a 1998 personal homepage, its pieces hung like a gallery on a tiled
// starfield: the UNDER CONSTRUCTION sign with its little digger, the hit counter rolling over
// (faster when you're busy), the guestbook, the webring, NEW! bursts, a flaming rule, a marquee,
// the spinning mailto envelope and BEST VIEWED AT 800x600. A command that works signs the
// guestbook; one that fails is a 404 and a broken image.
(function (Worlds) {
  Worlds.define('geocities', (k) => {
    const { C, rand, pick, env, seg, setCam, text3, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 90, GAP = 16;
    const NAMES = ['cyb3rpunk_kid', 'Mary from Ohio', 'DarkAngel', 'webmaster_jim', 'sk8r', 'Anonymous', 'gr8_page_dude', 'ElfQueen77'];
    const NOTES = ['cool page!!', 'great links', 'sign my guestbook too', 'your midi rocks', 'found you thru the webring', 'when is it gonna be finished?', 'awesome site, bookmarked', 'hi from Sweden'];
    const PANELS = ['construction', 'counter', 'guestbook', 'webring', 'new', 'flame', 'marquee', 'mailto', 'bestviewed'];
    let z = 0, stop = 0, wait = 0, hits = 31337, guest = [], err = 0;
    const sign = () => { guest.unshift(`${pick(NAMES)}: ${pick(NOTES)}`); guest.length = Math.min(guest.length, 5); };
    for (let i = 0; i < 4; i++) sign();

    function frame(x, y, w, h, pz, col, al) { const a = [x - w / 2, y - h / 2], b = [x + w / 2, y + h / 2]; seg(a[0], a[1], pz, b[0], a[1], pz, col, al, FOG); seg(b[0], a[1], pz, b[0], b[1], pz, col, al, FOG); seg(b[0], b[1], pz, a[0], b[1], pz, col, al, FOG); seg(a[0], b[1], pz, a[0], a[1], pz, col, al, FOG); }
    function panel(kind, x, pz, t) {
      const y = 2;
      frame(x, y, 9, 6, pz, C.violet, 0.5);
      if (kind === 'construction') { // the striped sign and a stick figure digging
        frame(x, y + 1.6, 7, 1.4, pz, C.gold, 0.9);
        for (let i = -3; i < 3; i++) seg(x + i + 0.2, y + 0.9, pz, x + i + 0.9, y + 2.3, pz, C.gold, 0.7, FOG);
        text3('UNDER CONSTRUCTION', x - 3.2, y - 0.3, pz, C.gold, 0.55, 1);
        const sx = x - 1.5, gy = y - 2.4, dig = Math.sin(t * 5) * 0.5;
        ring(sx, gy + 1.7, pz, 0.25, 8, C.white, 0.9, FOG, 'xy');
        seg(sx, gy + 1.45, pz, sx, gy + 0.7, pz, C.white, 0.9, FOG); seg(sx, gy + 0.7, pz, sx - 0.3, gy, pz, C.white, 0.9, FOG); seg(sx, gy + 0.7, pz, sx + 0.3, gy, pz, C.white, 0.9, FOG);
        seg(sx, gy + 1.2, pz, sx + 0.7, gy + 0.6 + dig, pz, C.white, 0.9, FOG); seg(sx + 0.5, gy + 1.3 + dig, pz, sx + 1.2, gy + dig * 0.3, pz, C.ice, 0.9, FOG); // the shovel
        seg(sx + 1.4, gy, pz, sx + 2.6, gy + 0.3, pz, C.ice, 0.6, FOG); seg(sx + 2.6, gy + 0.3, pz, sx + 3.4, gy, pz, C.ice, 0.6, FOG); // the pile
      } else if (kind === 'counter') { // an odometer, a digit to a box
        text3('YOU ARE VISITOR NUMBER', x - 3.3, y + 1.6, pz, C.ice, 0.42, 0.9);
        const digits = String(Math.floor(hits)).padStart(7, '0');
        for (let i = 0; i < 7; i++) { const dx = x - 3.15 + i * 0.9; frame(dx + 0.4, y - 0.2, 0.8, 1.3, pz, C.white, 0.7); text3(digits[i], dx + 0.12, y - 0.55, pz, C.neon, 0.9, 1); }
      } else if (kind === 'guestbook') {
        text3('~*~ GUESTBOOK ~*~', x - 2.8, y + 2.2, pz, C.hot, 0.5, 1);
        guest.forEach((g, i) => text3(g.slice(0, 34), x - 4.2, y + 1.2 - i * 0.75, pz, i ? C.white : C.neon, 0.32, 1 - i * 0.12));
      } else if (kind === 'webring') {
        ring(x, y + 0.9, pz, 1.3, 16, C.ice, 0.8, FOG, 'xy'); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t; ring(x + Math.cos(a) * 1.3, y + 0.9 + Math.sin(a) * 1.3, pz, 0.15, 6, C.gold, 1, FOG, 'xy'); }
        text3('THE CYBER-HACKERS WEBRING', x - 3.9, y - 1, pz, C.white, 0.42, 0.9);
        text3('<< PREV | RANDOM | NEXT >>', x - 3.9, y - 1.9, pz, C.gold, 0.42, 1);
      } else if (kind === 'new') { // a starburst, pulsing
        const r = 1.6 + Math.sin(t * 6) * 0.3; let p = null;
        for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.6 : r, q = [x + Math.cos(a) * rr, y + 0.6 + Math.sin(a) * rr]; if (p) seg(p[0], p[1], pz, q[0], q[1], pz, C.hot, 1, FOG); p = q; }
        text3('NEW!', x - 0.8, y + 0.35, pz, C.gold, 0.7, 1); text3('my links page', x - 2.1, y - 2, pz, C.white, 0.42, 0.8);
      } else if (kind === 'flame') { // a flaming horizontal rule
        for (let i = 0; i < 26; i++) { const fx = x - 4.2 + i * 0.33, h = 0.6 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 1.1 + (env.pulse * 0.6); seg(fx, y - 0.5, pz, fx + 0.16, y - 0.5 + h, pz, i % 2 ? C.hot : C.gold, 0.9, FOG); seg(fx + 0.16, y - 0.5 + h, pz, fx + 0.33, y - 0.5, pz, i % 2 ? C.gold : C.hot, 0.9, FOG); }
        seg(x - 4.2, y - 0.5, pz, x + 4.2, y - 0.5, pz, C.gold, 1, FOG);
      } else if (kind === 'marquee') { // stepped a character at a time, like the tag did
        const msg = '*** WELCOME TO MY HOMEPAGE *** THANKS FOR STOPPING BY *** ', n = Math.floor(t * 6) % msg.length;
        text3((msg + msg).slice(n, n + 26), x - 4.2, y, pz, C.neon, 0.48, 1);
      } else if (kind === 'mailto') { // an envelope, turning
        const a = t * 1.5, cw = Math.cos(a) * 1.6, sw = Math.sin(a) * 1.6, pts = [[-1, -0.7], [1, -0.7], [1, 0.7], [-1, 0.7]].map(([u, v]) => [x + u * cw, y + 0.7 + v * 1.6 * 0.7, pz + u * sw]);
        for (let i = 0; i < 4; i++) seg(...pts[i], ...pts[(i + 1) % 4], C.white, 0.9, FOG);
        seg(...pts[3], x, y + 0.6, pz, C.white, 0.9, FOG); seg(x, y + 0.6, pz, ...pts[2], C.white, 0.9, FOG);
        text3('E-MAIL ME!', x - 1.7, y - 1.7, pz, C.ice, 0.5, 1);
      } else {
        text3('BEST VIEWED AT 800x600', x - 3.6, y + 0.8, pz, C.white, 0.48, 0.9); text3('IN ANY BROWSER', x - 2.4, y - 0.2, pz, C.ice, 0.48, 0.8);
        text3('last updated 03/14/1998', x - 3.5, y - 1.6, pz, C.violet, 0.4, 0.8);
      }
      if (err > 0 && kind === 'guestbook') { frame(x + 3, y - 2, 1, 1, pz - 0.1, C.hot, 1); seg(x + 2.5, y - 2.5, pz - 0.1, x + 3.5, y - 1.5, pz - 0.1, C.hot, 1, FOG); }
    }

    return {
      label: 'HOMEPAGE',
      signal(kind) { if (kind === 'ok') sign(); if (kind === 'error') err = 3; },
      update(dt) {
        // a gallery walk: glide to the next panel, look at it a while, move on (moving text smears)
        if (Math.abs(stop - z) < 0.05) { z = stop; wait -= dt * (1 + env.level * 2); if (wait < 0) { stop += GAP; wait = 4; } }
        else z += (stop - z) * Math.min(1, dt * 1.6);
        hits += dt * (0.5 + env.level * 12); err = Math.max(0, err - dt);
      },
      draw() {
        const t = env.t;
        const side = (Math.round(stop / GAP) % 2) ? 1 : -1; // turn toward the panel we're stopped at
        setCam({ x: 0, y: 2.2, z, yaw: side * 0.32, pitch: -0.02 });
        // the tiled starfield wallpaper, behind everything
        const wz = z + 70;
        for (let x = -40; x <= 40; x += 5) for (let y = -14; y <= 20; y += 5) { const tw = (Math.sin(x * 3.1 + y * 7.7 + t * 2) + 1) / 2; seg(x - 0.3, y, wz, x + 0.3, y, wz, C.white, 0.3 + tw * 0.4, 120); seg(x, y - 0.3, wz, x, y + 0.3, wz, C.white, 0.3 + tw * 0.4, 120); }
        const i0 = Math.floor(z / GAP);
        for (let i = i0; i < i0 + 6; i++) { const pz = i * GAP + GAP; panel(PANELS[((i % PANELS.length) + PANELS.length) % PANELS.length], i % 2 ? 6 : -6, pz, t); }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 24 * s;
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText('FREEPAGES / AREA51 / HANGAR / 2600', x0, 34 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText(`http://www.freepages.example/area51/hangar/2600/`, x0, 54 * s);
      g.fillStyle = `rgba(${C.white},0.7)`; g.fillText(`you are visitor #${String(Math.floor(hits)).padStart(7, '0')}`, x0, H - 48 * s);
      g.fillText(`now playing: ${(env.song || 'canyon').toLowerCase().replace(/\s+/g, '_')}.mid`, x0, H - 30 * s);
      if (err > 0) { g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; const m = '404 NOT FOUND'; g.fillText(m, W - 24 * s - g.measureText(m).width, 40 * s); }
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.7)`; const r = 'this page made with NOTEPAD'; g.fillText(r, W - 24 * s - g.measureText(r).width, H - 30 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
