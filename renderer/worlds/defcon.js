// HACKER CON: a dark convention hall in 2005. Rows of tables full of laptops, a stage with the talk
// up on the big screen, attendees as little clusters of blinking badge LEDs drifting about, a
// lockpicking table, and the WALL OF SHEEP on the side wall naming logins caught in the clear
// (all made up, passwords masked). The CTF scoreboard sits top right and climbs with your
// activity; a command that works scores a flag, one that fails is FIRST BLOOD for someone else.
(function (Worlds) {
  Worlds.define('defcon', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, text3, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 90;
    const TALKS = ['OWNING THE TOASTER: IoT FOR FUN AND PROFIT', 'YOUR PRINTER IS A ROUTER NOW', 'BADGE HACKING 101', 'SOCIAL ENGINEERING THE HELP DESK', 'WARDRIVING THE SUBURBS', 'BLUETOOTH SNIPING AT 1 MILE'];
    const USERS = ['jsmith', 'admin', 'kevin_m', 'tiffany', 'webmaster', 'ceo', 'guest', 'root', 'bob1975', 'sales'];
    const HOSTS = ['pop3.mail.example', 'ftp.corp.example', 'telnet.uni.example', 'http.shop.example', 'imap.isp.example'];
    const TEAMS = [['SHELLPHISH TANK', 0], ['NULL ROUTE', 0], ['0xDEADBEEF', 0], ['GIBSON', 0], ['STACK SMASHERS', 0]];
    const LED = [C.neon, C.hot, C.ice, C.gold];
    const people = Array.from({ length: 36 }, () => ({ x: rand(-12, 12), z: rand(2, 30), vx: rand(-0.6, 0.6), vz: rand(-0.6, 0.6), ph: rand(0, 6) }));
    let sheep = [], talk = pick(TALKS), talkT = 0, blood = 0, bloodTeam = '', sheepT = 0, sched = 0;
    const baa = () => { sheep.unshift(`${pick(USERS)}@${pick(HOSTS)} / ${'*'.repeat(6 + (Math.random() * 5 | 0)).replace(/^./, () => pick('pqsmtl'))}`); sheep.length = Math.min(sheep.length, 9); };
    for (let i = 0; i < 6; i++) baa();
    const SCHED = ['10:00  TRACK 1  OPENING REMARKS', '11:00  TRACK 2  WARDRIVING THE SUBURBS', '12:00  VILLAGE  LOCKPICK BASICS', '14:00  TRACK 1  BADGE HACKING 101', '15:00  CTF      ROUND 3 OPENS', '17:00  TRACK 3  YOUR PRINTER IS A ROUTER', '21:00  PARTY    SUITE 2600', '23:59  CTF      SCOREBOARD FREEZE'];

    function table(x, z, laptops) { // a table top on legs, laptops with lit screens
      const w = 5, d = 1.2, y = 0.75;
      seg(x - w / 2, y, z - d / 2, x + w / 2, y, z - d / 2, C.violet, 0.6, FOG); seg(x - w / 2, y, z + d / 2, x + w / 2, y, z + d / 2, C.violet, 0.6, FOG);
      seg(x - w / 2, y, z - d / 2, x - w / 2, y, z + d / 2, C.violet, 0.6, FOG); seg(x + w / 2, y, z - d / 2, x + w / 2, y, z + d / 2, C.violet, 0.6, FOG);
      for (const sx of [-w / 2, w / 2]) seg(x + sx, 0, z, x + sx, y, z, C.violet, 0.4, FOG);
      for (let i = 0; i < laptops; i++) {
        const lx = x - w / 2 + 0.7 + i * 1.2, bz = z - 0.2;
        seg(lx - 0.35, y, bz, lx + 0.35, y, bz, C.ice, 0.6, FOG); seg(lx - 0.35, y, bz, lx - 0.35, y + 0.5, bz + 0.25, C.ice, 0.6, FOG); seg(lx + 0.35, y, bz, lx + 0.35, y + 0.5, bz + 0.25, C.ice, 0.6, FOG); seg(lx - 0.35, y + 0.5, bz + 0.25, lx + 0.35, y + 0.5, bz + 0.25, C.ice, 0.6, FOG);
        for (let r = 0; r < 3; r++) { const f = (r + 1) / 4, on = Math.sin(env.t * 3 + lx * 5 + r + z) > -0.3; if (on) seg(lx - 0.28, y + f * 0.5, bz + f * 0.25, lx - 0.28 + 0.4 * (0.5 + 0.5 * Math.sin(lx + r * 2)), y + f * 0.5, bz + f * 0.25, (r + i) % 3 ? C.neon : C.hot, 0.9, FOG); }
      }
    }

    return {
      label: 'HACKER CON',
      signal(kind) {
        if (kind === 'ok') TEAMS.find((x) => x[0] === 'GIBSON')[1] += 500;
        if (kind === 'error') { const tm = pick(TEAMS.filter((x) => x[0] !== 'GIBSON')); tm[1] += 300; blood = 4; bloodTeam = tm[0]; }
      },
      update(dt) {
        for (const p of people) {
          if (Math.random() < dt * 0.3) { p.vx = rand(-0.7, 0.7); p.vz = rand(-0.7, 0.7); }
          p.x = Math.max(-13, Math.min(13, p.x + p.vx * dt)); p.z = Math.max(1, Math.min(32, p.z + p.vz * dt));
        }
        sheepT -= dt * (0.2 + env.level); if (sheepT < 0) { sheepT = rand(2, 5); baa(); }
        talkT += dt; if (talkT > 30) { talkT = 0; talk = pick(TALKS.filter((x) => x !== talk)); }
        for (const tm of TEAMS) if (Math.random() < dt * (0.1 + env.level * 0.6)) tm[1] += pick([100, 200, 300]);
        blood = Math.max(0, blood - dt); sched += dt * 0.25;
      },
      draw() {
        const t = env.t;
        setCam(lookAt({ x: Math.sin(t * 0.06) * 6, y: 3.2, z: -4 }, 0, 2.2, 30));
        for (let x = -14; x <= 14; x += 2) seg(x, 0, 0, x, 0, 36, C.violet, 0.18, FOG); // the carpet
        for (let z = 0; z <= 36; z += 2) seg(-14, 0, z, 14, 0, z, C.violet, 0.18, FOG);
        // the stage and the big screen, the talk on it
        const sz = 36;
        seg(-10, 1, sz - 4, 10, 1, sz - 4, C.ice, 0.6, FOG); seg(-10, 0, sz - 4, -10, 1, sz - 4, C.ice, 0.5, FOG); seg(10, 0, sz - 4, 10, 1, sz - 4, C.ice, 0.5, FOG);
        const sx0 = -8, sx1 = 8, sy0 = 2.5, sy1 = 10;
        seg(sx0, sy0, sz, sx1, sy0, sz, C.white, 0.7, FOG); seg(sx1, sy0, sz, sx1, sy1, sz, C.white, 0.7, FOG); seg(sx1, sy1, sz, sx0, sy1, sz, C.white, 0.7, FOG); seg(sx0, sy1, sz, sx0, sy0, sz, C.white, 0.7, FOG);
        const words = talk.split(' '), half = Math.ceil(words.length / 2);
        text3(words.slice(0, half).join(' '), sx0 + 0.6, sy1 - 1.6, sz - 0.1, C.gold, 0.9, 0.95); text3(words.slice(half).join(' '), sx0 + 0.6, sy1 - 2.8, sz - 0.1, C.gold, 0.9, 0.95);
        for (let i = 0; i < 3; i++) { seg(sx0 + 1, sy1 - 4.3 - i * 1.1, sz - 0.1, sx0 + 1.3, sy1 - 4.3 - i * 1.1, sz - 0.1, C.hot, 0.9, FOG); seg(sx0 + 1.8, sy1 - 4.3 - i * 1.1, sz - 0.1, sx0 + 1.8 + 4 + ((i * 3) % 5), sy1 - 4.3 - i * 1.1, sz - 0.1, C.white, 0.5, FOG); }
        // the speaker at the podium
        seg(0, 1, sz - 5, 0, 2.2, sz - 5, C.ice, 0.6, FOG); ring(0, 2.6, sz - 5, 0.25, 8, C.ice, 0.6, FOG, 'xy');
        // rows of tables
        for (let r = 0; r < 4; r++) for (const sx of [-6.5, 6.5]) table(sx, 8 + r * 5, 4);
        // the lockpicking table: a padlock and a pick, wiggling
        table(-11, 4, 0); const lt = t * 4;
        ring(-11, 1.25, 3.9, 0.22, 10, C.gold, 0.9, FOG, 'xy'); seg(-11.25, 0.8, 3.9, -10.75, 0.8, 3.9, C.gold, 0.9, FOG); seg(-11.25, 0.8, 3.9, -11.25, 1.15, 3.9, C.gold, 0.9, FOG); seg(-10.75, 0.8, 3.9, -10.75, 1.15, 3.9, C.gold, 0.9, FOG);
        seg(-11, 0.95, 3.85, -10.4, 0.95 + Math.sin(lt) * 0.06, 3.7, C.white, 0.9, FOG);
        text3('LOCKPICK VILLAGE', -13, 1.9, 4, C.gold, 0.4, 0.8);
        // the wall of sheep, on the left wall
        const wx = -14;
        seg(wx, 3, 26, wx, 9, 26, C.hot, 0.6, FOG); seg(wx, 3, 34, wx, 9, 34, C.hot, 0.6, FOG); seg(wx, 9, 26, wx, 9, 34, C.hot, 0.6, FOG); seg(wx, 3, 26, wx, 3, 34, C.hot, 0.6, FOG);
        for (let i = 0; i < sheep.length; i++) seg(wx, 8 - i * 0.55, 27, wx, 8 - i * 0.55, 27 + 2 + (i * 7) % 5, i ? C.white : C.neon, 0.5, FOG); // its lines, unreadable at this range: the HUD has them
        // the people: three badge LEDs each, blinking
        for (const p of people) for (let j = 0; j < 3; j++) {
          if (Math.sin(t * (4 + j * 2) + p.ph * (j + 1)) < -0.2) continue;
          const y = 1.25 + j * 0.06, x = p.x + (j - 1) * 0.07;
          seg(x - 0.03, y, p.z, x + 0.03, y, p.z, LED[(j + Math.floor(p.ph)) % 4], 1, FOG);
        }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 24 * s;
      g.font = `bold ${20 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.95)`; g.fillText('HAXCON 2005', x0, 36 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.65)`; g.fillText(`NOW ON THE MAIN STAGE: ${talk}`.slice(0, 48), x0, 56 * s);
      // the wall of sheep, readable
      g.font = `bold ${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; g.fillText('WALL OF SHEEP', x0, 110 * s);
      g.font = `${11 * s | 0}px ${MONO}`;
      sheep.forEach((l, i) => { g.fillStyle = `rgba(${i ? C.white : C.neon},${0.9 - i * 0.07})`; g.fillText(l, x0, (130 + i * 16) * s); });
      // the schedule, a line at a time
      g.font = `${12 * s | 0}px ${MONO}`;
      for (let i = 0; i < 4; i++) { const l = SCHED[(Math.floor(sched) + i) % SCHED.length]; g.fillStyle = `rgba(${i ? C.ice : C.neon},${0.9 - i * 0.15})`; g.fillText(l, x0, H - (84 - i * 18) * s); }
      // the CTF scoreboard
      const rx = W - 24 * s, sorted = TEAMS.slice().sort((a, b) => b[1] - a[1]);
      g.font = `bold ${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; const hd = 'CAPTURE THE FLAG'; g.fillText(hd, rx - g.measureText(hd).width, 34 * s);
      g.font = `${12 * s | 0}px ${MONO}`;
      sorted.forEach(([name, pts], i) => { const y = (56 + i * 18) * s, sc = String(pts).padStart(6, ' '); g.fillStyle = `rgba(${name === 'GIBSON' ? C.neon : C.white},0.85)`; g.fillText(`${i + 1}. ${name}`, rx - 240 * s, y); g.fillText(sc, rx - g.measureText(sc).width, y); });
      if (blood > 0 && Math.sin(env.t * 10) > 0) { g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.hot},0.95)`; const m = `FIRST BLOOD: ${bloodTeam}`; g.fillText(m, rx - g.measureText(m).width, (56 + 5 * 18 + 10) * s); }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
