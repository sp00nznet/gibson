// MESSENGER: an early-2000s instant messenger. The buddy list sits in the top-left corner, grouped,
// with buddies signing on and off (a little door swinging open or shut beside them), going away
// and idle; more of them come and go the busier you are. Message windows pop up in the space
// around you, wireframe, and the chat types into them a line at a time. Your away message (top
// right) is whatever you last typed. A command that works gets you an IM; one that fails gets
// you warned.
(function (Worlds) {
  Worlds.define('messenger', (k) => {
    const { C, rand, pick, env, seg, setCam, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 120;
    const GROUPS = {
      BUDDIES: ['xXsk8rboiXx', 'acid_rain_99', 'h4x0r_gr1rl', 'pixel_punk', 'modem_mike', 'zer0_c00l_2k', 'neon_dreamz', 'lazer_kat'],
      'CO-WORKERS': ['sysadmin_dave', 'helpdesk_jen', 'pointyhair01', 'build_bot'],
      FAMILY: ['mom_online', 'unclebob1952', 'lil_sis_xoxo'],
    };
    const LINES = ['hey', 'a/s/l?', 'brb', 'lol', 'did u see that??', 'k', 'g2g, mom needs the phone', 'whats up', 'nm u?', 'check ur email', ':-)', 'ROFL', 'u there?', 'one sec', 'omg', 'send me the file', 'ttyl', 'haha nice', 'w00t', 'my modem keeps dropping'];
    const AWAY = ['out in the static, back when the signal finds me', 'staring at the ceiling, counting packets', 'dial tone dreams and midnight screens', 'gone where the bandwidth is free', 'if you can read this, the wires still work'];
    const buddies = [];
    for (const [grp, names] of Object.entries(GROUPS)) for (const name of names) buddies.push({ name, grp, on: Math.random() < 0.55, state: 'on', idle: 0, door: 0, opening: true });
    let wins = [], warn = 0, next = 2, awayLine = pick(AWAY), lastCmd = 0;

    function pop(from, text) { // a message window, somewhere around you
      const a = rand(-1.1, 1.1), d = rand(20, 28);
      wins.push({ from, lines: text ? [text] : [], x: Math.sin(a) * d, y: rand(-3, 5), z: Math.cos(a) * d + 6, t: 0, next: 0.5, life: rand(10, 16) });
      if (wins.length > 6) wins.shift();
    }

    return {
      label: 'MESSENGER',
      signal(kind) {
        if (kind === 'ok') { const b = pick(buddies.filter((x) => x.on)); if (b) pop(b.name, pick(LINES)); }
        if (kind === 'error') warn = Math.min(100, warn + 10);
      },
      update(dt) {
        next -= dt * (0.4 + env.level * 2.5);
        if (next < 0) { // somebody signs on or off, goes away or comes back
          next = rand(0.6, 2.5);
          const b = pick(buddies);
          if (Math.random() < 0.6) { b.on = !b.on; b.door = 1.5; b.opening = b.on; b.state = 'on'; b.idle = 0; }
          else if (b.on) b.state = pick(['on', 'away', 'idle']);
          if (b.on && Math.random() < 0.35) pop(b.name, '');
        }
        for (const b of buddies) { b.door = Math.max(0, b.door - dt); if (b.state === 'idle') b.idle += dt / 60; }
        for (const w of wins) {
          w.t += dt; w.next -= dt;
          if (w.next < 0 && w.lines.length < 6) { w.next = rand(1, 2.5); w.lines.push((w.lines.length % 2 ? 'me: ' : '') + pick(LINES)); }
        }
        wins = wins.filter((w) => w.t < w.life);
        warn = Math.max(0, warn - dt * 0.5);
        const c = env.cmd;
        if (c && c.at !== lastCmd) { lastCmd = c.at; awayLine = `busy with: ${c.text.slice(0, 40)}`; }
      },
      draw() {
        const t = env.t;
        setCam({ x: 0, y: 1, z: 0, yaw: Math.sin(t * 0.05) * 0.5, pitch: 0.02 });
        // the desktop: a teal plane far off, tiled
        for (let x = -60; x <= 60; x += 10) seg(x, -12, 60, x, 20, 60, C.ice, 0.12, FOG);
        for (let y = -12; y <= 20; y += 8) seg(-60, y, 60, 60, y, 60, C.ice, 0.12, FOG);
        for (const w of wins) { // a window: frame, title bar, close box, lines
          const W = 7, H = 5, x0 = w.x - W / 2, y1 = w.y + H / 2, x1 = w.x + W / 2, y0 = w.y - H / 2, z = w.z, f = Math.min(1, w.t * 3, (w.life - w.t) * 2);
          const box = (a, b, c, d, col, al) => { seg(a, b, z, c, b, z, col, al, FOG); seg(c, b, z, c, d, z, col, al, FOG); seg(c, d, z, a, d, z, col, al, FOG); seg(a, d, z, a, b, z, col, al, FOG); };
          box(x0, y0, x1, y1, C.ice, 0.8 * f);
          for (let yy = y1 - 0.15; yy > y1 - 0.75; yy -= 0.15) seg(x0, yy, z, x1, yy, z, C.violet, 0.5 * f, FOG); // the title bar's stripes
          seg(x1 - 0.5, y1 - 0.15, z, x1 - 0.15, y1 - 0.6, z, C.hot, f, FOG); seg(x1 - 0.15, y1 - 0.15, z, x1 - 0.5, y1 - 0.6, z, C.hot, f, FOG);
          text3(`IM: ${w.from}`, x0 + 0.2, y1 - 0.55, z, C.white, 0.42, f);
          box(x0 + 0.2, y0 + 0.2, x1 - 0.2, y0 + 1, C.ice, 0.4 * f); // the reply box
          w.lines.forEach((l, i) => text3(l.startsWith('me:') ? l : `${w.from}: ${l}`, x0 + 0.3, y1 - 1.3 - i * 0.5, z, l.startsWith('me:') ? C.hot : C.neon, 0.34, f));
        }
        hud();
      },
    };

    function door(g, x, y, sz, open, col) { // a door frame with its leaf swinging
      g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 1; g.strokeRect(x, y - sz, sz * 0.7, sz);
      const w = sz * 0.7 * Math.cos(open * Math.PI * 0.45);
      g.fillStyle = `rgba(${col},0.7)`; g.fillRect(x, y - sz, w, sz);
    }
    function hud() {
      const g = k.g, Wd = k.W, H = k.H, s = Math.min(Wd / 1920, H / 1080), x0 = 24 * s, lh = 16 * s;
      g.font = `bold ${15 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText('BUDDY LIST', x0, 34 * s);
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; g.fillText('signed on as gibson_nyx', x0, 52 * s);
      let y = 74 * s;
      for (const grp of Object.keys(GROUPS)) {
        const list = buddies.filter((b) => b.grp === grp), on = list.filter((b) => b.on || b.door > 0);
        g.font = `bold ${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText(`${grp} (${list.filter((b) => b.on).length}/${list.length})`, x0, y); y += lh;
        g.font = `${12 * s | 0}px ${MONO}`;
        for (const b of on) {
          if (b.door > 0) door(g, x0 + 4 * s, y + 2 * s, 11 * s, b.opening ? 1 - b.door / 1.5 : b.door / 1.5, b.opening ? C.neon : C.hot);
          const col = !b.on ? C.violet : b.state === 'away' ? C.gold : b.state === 'idle' ? C.violet : C.neon;
          const tag = !b.on ? '' : b.state === 'away' ? ' (away)' : b.state === 'idle' ? ` (idle ${Math.max(1, Math.round(b.idle + 3))}m)` : '';
          g.fillStyle = `rgba(${col},0.9)`; g.fillText(b.name + tag, x0 + 18 * s, y); y += lh;
        }
        y += 6 * s;
      }
      // your away message, and the warning level
      const rx = Wd - 24 * s, right = (str, yy, col, font) => { g.font = font; g.fillStyle = `rgba(${col},0.9)`; g.fillText(str, rx - g.measureText(str).width, yy); };
      right('AWAY MESSAGE', 34 * s, C.gold, `bold ${14 * s | 0}px ${MONO}`);
      right(`"${awayLine}"`, 54 * s, C.white, `italic ${12 * s | 0}px ${MONO}`);
      right(`WARNING LEVEL ${Math.round(warn)}%`, 76 * s, warn > 0 ? C.hot : C.violet, `${12 * s | 0}px ${MONO}`);
      right(`${wins.length} OPEN WINDOW${wins.length === 1 ? '' : 'S'}`, H - 30 * s, C.ice, `${12 * s | 0}px ${MONO}`);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
