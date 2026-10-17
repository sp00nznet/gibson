// NEWSWIRE: RSS/Atom headlines (sysinfo.js, config news.feeds) crawling across LED ticker bands
// at different depths. A fresh headline flashes BREAKING; NYX comments on it (app.js).
(function (Worlds) {
  Worlds.define('news', (k) => {
    const { C, env, seg, text3, setCam, toCam } = k;
    const BANDS = [ // y, z, text size, speed (units/s), colour
      [20, 70, 2.0, 9, C.gold], [9, 95, 2.6, 6, C.neon], [-2, 60, 1.6, 12, C.ice], [-13, 85, 2.2, 7, C.hot], [-24, 110, 3.0, 5, C.violet],
    ];
    let breaking = 0, builtFrom, items = [];
    const CHAR = 0.62; // width of one character, in text sizes (monospace)
    const sources = () => [...new Set(items.map((i) => i.source).filter(Boolean))].join('  //  ');
    return {
      label: 'NEWSWIRE',
      signal(kind) { if (kind === 'news') breaking = 1; },
      update(dt) {
        if (env.news !== builtFrom) { builtFrom = env.news; items = env.news && env.news.length ? env.news : [{ title: 'NEWSWIRE OFFLINE :: add RSS feeds to news.feeds in config.json', source: '' }]; }
        breaking = Math.max(0, breaking - dt * 0.15);
      },
      draw() {
        setCam({ x: Math.sin(env.t * 0.07) * 4, y: Math.sin(env.t * 0.05) * 2, z: 0, yaw: Math.sin(env.t * 0.07) * -0.05, pitch: 0 });
        // Back to front, and each band wiped to black before its text: moving text in the world's
        // fading trails smears into an unreadable double image otherwise.
        const P = (x, y, z) => { const p = toCam(x, y, z); return [k.W / 2 + p[0] * k.F / p[2], k.H / 2 - p[1] * k.F / p[2]]; };
        BANDS.map((b, bi) => [b, bi]).sort((p, q) => q[0][1] - p[0][1]).forEach(([[y, z, size, speed, col], bi]) => {
          const half = z * 1.25, top = y + size * 1.3, bot = y - size * 0.6, g = k.g;
          g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(0,0,0,0.92)'; g.beginPath();
          for (const [i, [px, py]] of [P(-half, top, z), P(half, top, z), P(half, bot, z), P(-half, bot, z)].entries()) i ? g.lineTo(px, py) : g.moveTo(px, py);
          g.fill(); g.restore();
          seg(-half, top, z, half, top, z, col, 0.7, 260); seg(-half, bot, z, half, bot, z, col, 0.7, 260);
          for (let x = -half; x < half; x += 6) seg(x, top + 0.4, z, x + 3, top + 0.4, z, col, 0.2, 260); // LED edge
          // Each band runs the whole list, starting at a different headline, end to end.
          const list = items.map((_, i) => items[(i + bi * 3) % items.length]);
          const widths = list.map((h) => (h.title.length + 8) * size * CHAR), total = widths.reduce((a, b) => a + b, 0);
          let x = half - ((env.t * speed * (0.6 + env.level * 0.4)) % total);
          for (let i = 0; i < list.length * 2 && x < half; i++) {
            const h = list[i % list.length], w = widths[i % list.length];
            if (x + w > -half) {
              const fresh = breaking > 0 && h === items[0] && bi === 1;
              text3((fresh ? 'BREAKING  ' : '') + h.title.toUpperCase(), x, y, z, fresh ? C.hot : col, size, 0.95);
              text3('  ::  ', x + (h.title.length + (fresh ? 10 : 0)) * size * CHAR, y, z, C.white, size, 0.5);
            }
            x += w;
          }
        });
        if (breaking > 0) for (let i = 0; i < 3; i++) seg(-140, 9 + 3.4 - i * 0.3, 95, 140, 9 + 3.4 - i * 0.3, 95, C.hot, breaking, 260);
        const g = k.g;
        g.fillStyle = `rgba(${C.neon},0.75)`; g.font = "14px 'Cascadia Mono', Consolas, monospace";
        g.fillText(`NEWSWIRE :: ${items.length} HEADLINES${sources() ? ' :: ' + sources() : ''}`.slice(0, 160), 24, k.H - 28);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
