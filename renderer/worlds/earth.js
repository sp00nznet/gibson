// The globe worlds. One wireframe Earth, three uses:
//   WORLD NEWS     headlines pop up from where they happened; the globe turns to each one.
//   TRAFFIC MAP    your connections arc out from home to roughly where they go.
//   HACK THE PLANET the Earth, a Jolly Roger floppy in orbit, and the words going round.
(function (Worlds) {
  const D = Math.PI / 180;

  // Coastlines, very roughly: [lat, lon] rings, a few dozen points each. Wireframe needs no more.
  const LAND = [
    [[71, -156], [70, -141], [69, -133], [68, -115], [69, -100], [72, -95], [68, -82], [63, -79], [60, -94], [56, -88], [52, -80], [59, -78], [62, -73], [58, -68], [60, -64], [53, -56], [47, -53], [45, -61], [44, -66], [41, -70], [35, -76], [30, -81], [25, -80], [30, -84], [30, -89], [29, -95], [26, -97], [21, -97], [18, -95], [19, -91], [21, -87], [18, -88], [15, -83], [11, -84], [9, -79], [8, -77], [8, -80], [13, -88], [16, -95], [20, -105], [23, -110], [28, -114], [32, -117], [34, -120], [38, -123], [42, -124], [46, -124], [49, -125], [54, -131], [58, -136], [60, -146], [59, -152], [55, -162], [61, -166], [65, -168], [68, -166], [71, -156]],
    [[12, -72], [11, -64], [8, -60], [5, -52], [0, -50], [-3, -40], [-5, -35], [-8, -35], [-13, -38], [-23, -42], [-25, -48], [-33, -52], [-35, -57], [-39, -62], [-42, -64], [-47, -66], [-52, -69], [-55, -67], [-54, -72], [-47, -75], [-38, -74], [-30, -71], [-18, -70], [-14, -76], [-6, -81], [-1, -80], [2, -79], [7, -78], [9, -77], [12, -72]],
    [[36, -9], [43, -9], [44, -1], [48, -4], [51, 2], [53, 5], [55, 8], [57, 8], [59, 10], [58, 6], [62, 5], [66, 13], [70, 19], [71, 26], [70, 30], [69, 33], [66, 40], [68, 44], [69, 57], [72, 68], [73, 80], [76, 100], [73, 113], [72, 128], [71, 140], [70, 160], [66, 179], [64, 178], [60, 165], [57, 163], [52, 157], [59, 155], [59, 143], [54, 137], [47, 139], [43, 132], [40, 129], [35, 129], [35, 126], [38, 125], [40, 121], [37, 119], [31, 122], [25, 119], [22, 114], [21, 108], [16, 108], [10, 106], [13, 100], [7, 100], [1, 104], [4, 101], [8, 98], [16, 97], [22, 91], [20, 86], [15, 80], [8, 77], [15, 74], [21, 72], [25, 66], [25, 57], [27, 56], [24, 51], [26, 56], [22, 59], [17, 55], [13, 45], [17, 42], [22, 39], [28, 34], [31, 32], [36, 35], [37, 28], [40, 26], [38, 23], [40, 20], [45, 13], [44, 12], [40, 18], [38, 16], [41, 12], [44, 9], [43, 4], [41, 1], [37, -1], [36, -6], [36, -9]],
    [[36, -6], [35, -2], [37, 10], [33, 11], [31, 20], [32, 30], [30, 32], [22, 37], [15, 40], [12, 44], [11, 51], [2, 46], [-4, 40], [-10, 40], [-15, 41], [-25, 35], [-34, 26], [-35, 20], [-30, 17], [-22, 14], [-17, 12], [-12, 14], [-6, 12], [0, 9], [4, 8], [5, 2], [4, -4], [5, -8], [8, -13], [14, -17], [21, -17], [27, -13], [31, -10], [36, -6]],
    [[-11, 132], [-12, 137], [-17, 141], [-11, 142], [-19, 146], [-25, 153], [-33, 152], [-38, 148], [-38, 141], [-35, 137], [-32, 133], [-34, 123], [-35, 117], [-31, 115], [-22, 114], [-20, 119], [-15, 125], [-14, 129], [-11, 132]],
    [[60, -44], [65, -40], [70, -22], [77, -18], [82, -30], [83, -40], [81, -60], [77, -72], [76, -66], [70, -54], [65, -52], [60, -44]],
    [[50, -5], [51, 1], [53, 0], [56, -2], [58, -3], [58, -5], [55, -6], [53, -4], [51, -5], [50, -5]],
    [[31, 130], [34, 133], [35, 136], [37, 140], [41, 141], [43, 145], [44, 142], [41, 140], [38, 139], [35, 135], [33, 130], [31, 130]],
    [[-12, 49], [-25, 47], [-25, 44], [-16, 44], [-12, 49]],
    [[7, 117], [1, 119], [-4, 116], [-3, 111], [1, 109], [7, 117]],
    [[5, 95], [-1, 100], [-6, 105], [-5, 103], [2, 98], [5, 95]],
    [[-35, 173], [-41, 176], [-46, 170], [-44, 168], [-40, 172], [-35, 173]],
  ];

  // Where a headline happened: the first place it names. ponytail: a keyword list, not NLP.
  const PLACES = [
    ['north korea|pyongyang|lazarus', 39, 125.8], ['south korea|seoul|samsung|korea', 37.6, 127], ['japan|tokyo|sony|nintendo', 35.7, 139.7],
    ['china|beijing|chinese|huawei|tiktok|alibaba|shanghai', 39.9, 116.4], ['hong kong', 22.3, 114.2], ['taiwan|taipei|tsmc', 25, 121.5],
    ['singapore', 1.35, 103.8], ['vietnam', 21, 105.8], ['indonesia|jakarta', -6.2, 106.8], ['philippines|manila', 14.6, 121],
    ['india|delhi|bangalore|bengaluru|mumbai|indian', 28.6, 77.2], ['pakistan', 33.7, 73], ['australia|sydney|melbourne|australian', -33.9, 151.2], ['new zealand', -41.3, 174.8],
    ['russia|moscow|kremlin|russian', 55.8, 37.6], ['ukraine|kyiv|ukrainian', 50.4, 30.5], ['israel|tel aviv|israeli', 32.1, 34.8], ['iran|tehran|iranian', 35.7, 51.4],
    ['saudi|riyadh', 24.7, 46.7], ['dubai|uae|emirates', 25.2, 55.3], ['turkey|istanbul|turkish', 41, 29], ['egypt|cairo', 30, 31.2],
    ['nigeria|lagos', 6.5, 3.4], ['kenya|nairobi', -1.3, 36.8], ['south africa|johannesburg|cape town', -26.2, 28],
    ['ireland|dublin|irish', 53.3, -6.3], ['uk\\b|britain|british|london|england|nhs|bbc|scotland', 51.5, -0.1], ['france|paris|french', 48.9, 2.3],
    ['germany|berlin|german', 52.5, 13.4], ['eu\\b|european|brussels|belgium', 50.8, 4.4], ['netherlands|amsterdam|dutch', 52.4, 4.9],
    ['spain|madrid|spanish', 40.4, -3.7], ['italy|rome|italian', 41.9, 12.5], ['sweden|stockholm|swedish', 59.3, 18.1], ['norway|oslo', 59.9, 10.8],
    ['finland|helsinki', 60.2, 24.9], ['poland|warsaw|polish', 52.2, 21], ['switzerland|swiss|geneva|zurich', 46.9, 7.4],
    ['canada|toronto|canadian|ottawa', 43.7, -79.4], ['mexico', 19.4, -99.1], ['brazil|sao paulo|brazilian', -23.5, -46.6], ['argentina', -34.6, -58.4],
    ['seattle|microsoft|amazon|aws', 47.6, -122.3], ['new york|wall street|nyc', 40.7, -74], ['texas|austin', 30.3, -97.7],
    ['california|silicon valley|san francisco|apple|google|meta\\b|openai|nvidia|tesla|intel|cisco|anthropic', 37.4, -122.1],
    ['u\\.s\\.|usa|america|washington|white house|pentagon|fbi|nsa\\b|cisa|congress|senate|federal', 38.9, -77],
  ].map(([re, lat, lon]) => [new RegExp(`\\b(${re})`, 'i'), lat, lon]);
  const HUBS = [[40.7, -74], [51.5, -0.1], [35.7, 139.7], [37.4, -122.1], [52.5, 13.4], [1.35, 103.8], [-33.9, 151.2], [55.8, 37.6], [28.6, 77.2], [-23.5, -46.6]];
  const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  function placeOf(title) {
    const hit = PLACES.find(([re]) => re.test(title)), h = hash(title);
    const [lat, lon] = hit ? [hit[1], hit[2]] : HUBS[h % HUBS.length]; // nowhere named: a big hub
    return [lat + ((h >>> 8) % 5) - 2, lon + ((h >>> 12) % 5) - 2];  // a nudge, so stories from one place fan out
  }

  // Where an address goes, by which registry its block belongs to. ponytail: IANA's /8 list,
  // not a geoip lookup (no database to ship, nothing sent anywhere). Continent-level at best;
  // transferred blocks and clouds land in the wrong place. A local GeoLite file would sharpen it.
  const RIR = {
    ripe: [2, 5, 25, 31, 37, 46, 51, 53, 57, 62, [77, 95], 109, 141, 145, 151, 176, 178, 185, 188, 193, 194, 195, 212, 213, 217],
    apnic: [1, 14, 27, 36, 39, 42, 43, 49, 58, 59, 60, 61, 101, 103, 106, [110, 126], 133, 150, 153, 163, 171, 175, 180, 182, 183, 202, 203, 210, 211, [218, 223]],
    lacnic: [177, 179, 181, 186, 187, 189, 190, 191, 200, 201],
    afrinic: [41, 102, 105, 154, 196, 197],
  };
  const REGION = { arin: [39, -95, 9, 20], ripe: [50, 12, 7, 14], apnic: [30, 112, 14, 22], lacnic: [-15, -58, 14, 9], afrinic: [3, 22, 14, 14] };
  function registryOf(ip) {
    if (ip.includes(':')) return { '24': 'apnic', '26': 'arin', '28': 'lacnic', '2a': 'ripe', '2c': 'afrinic' }[ip.slice(0, 2).toLowerCase()] || 'arin';
    const a = Number(ip.split('.')[0]);
    for (const [r, list] of Object.entries(RIR)) if (list.some((x) => (Array.isArray(x) ? a >= x[0] && a <= x[1] : a === x))) return r;
    return 'arin'; // the rest is mostly old US allocations
  }
  const isLocal = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|f[cd]|fe80)/i.test(ip);
  function spotOf(ip) {
    const [lat, lon, dl, dn] = REGION[registryOf(ip)], h = hash(ip);
    return [lat + ((h % 1000) / 500 - 1) * dl, lon + (((h >>> 10) % 1000) / 500 - 1) * dn];
  }
  // Home, from the clock: the UTC offset gives the longitude, the time zone's region a latitude.
  function homeSpot() {
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* no Intl */ }
    const lon = -new Date().getTimezoneOffset() / 4;
    const lat = /Sao_Paulo|Argentina|Santiago|Lima|Bogota|Montevideo/.test(tz) ? -20 : /^America/.test(tz) ? 38 : /^Europe/.test(tz) ? 50
      : /^Australia/.test(tz) ? -30 : /^Africa/.test(tz) ? 5 : /Auckland/.test(tz) ? -40 : 30;
    return [lat, lon];
  }
  Worlds.geo = { placeOf, registryOf, spotOf }; // for the self-check

  // --- the globe ----------------------------------------------------------------
  const vec = (lat, lon) => [Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D), -Math.cos(lat * D) * Math.cos(lon * D)];
  const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  // A unit vector on the globe G = { c, R, rot, tilt } to world space. [3] < 0: facing us.
  function place(G, v, lift) {
    const cr = Math.cos(G.rot), sr = Math.sin(G.rot), ct = Math.cos(G.tilt), st = Math.sin(G.tilt), r = G.R * (lift || 1);
    const x = v[0] * cr - v[2] * sr, z = v[2] * cr + v[0] * sr, y = v[1];
    const y2 = y * ct - z * st, z2 = y * st + z * ct;
    return [G.c[0] + x * r, G.c[1] + y2 * r, G.c[2] + z2 * r, z2];
  }
  function globe(k, G, grid, land) {
    const s = (p, q, col, a) => k.seg(p[0], p[1], p[2], q[0], q[1], q[2], col, a * (p[3] + q[3] < 0 ? 1 : 0.12), 400);
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = 0; lon < 360; lon += 10) s(place(G, vec(lat, lon)), place(G, vec(lat, lon + 10)), grid, 0.45);
    for (let lon = 0; lon < 360; lon += 30) for (let lat = -80; lat < 80; lat += 10) s(place(G, vec(lat, lon)), place(G, vec(lat + 10, lon)), grid, 0.45);
    for (const ring of LAND) for (let i = 0; i < ring.length - 1; i++) s(place(G, vec(...ring[i])), place(G, vec(...ring[i + 1])), land, 1);
    for (let i = 0; i < 48; i++) { // the rim
      const a = (i / 48) * Math.PI * 2, b = ((i + 1) / 48) * Math.PI * 2;
      k.seg(G.c[0] + Math.cos(a) * G.R, G.c[1] + Math.sin(a) * G.R, G.c[2], G.c[0] + Math.cos(b) * G.R, G.c[1] + Math.sin(b) * G.R, G.c[2], grid, 0.7, 400);
    }
  }
  // A ring on the surface around v, r degrees across.
  function halo(k, G, lat, lon, r, col, a) {
    let prev = null;
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2, p = place(G, vec(lat + Math.sin(t) * r, lon + (Math.cos(t) * r) / Math.max(0.2, Math.cos(lat * D))), 1.01);
      if (prev && p[3] < 0) k.seg(prev[0], prev[1], prev[2], p[0], p[1], p[2], col, a, 400);
      prev = p;
    }
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const lines = (s, n, max) => { // word-wrap to n columns, at most max lines
    const out = [''];
    for (const w of s.split(/\s+/)) { if ((out[out.length - 1] + ' ' + w).trim().length > n) out.push(''); out[out.length - 1] = (out[out.length - 1] + ' ' + w).trim(); }
    if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].slice(0, n - 1) + '…'; }
    return out;
  };
  // Callouts: a leader line from a point on the globe out to the side of the screen and the text
  // there, so they read in the margins when the terminal is framed. list: { p, text: [], col, a }.
  function callouts(k, list) {
    const { g, W, H, C } = k, sides = [[], []];
    for (const c of list) {
      const q = k.toCam(c.p[0], c.p[1], c.p[2]); if (q[2] < 1) continue;
      c.s = [W / 2 + (q[0] * k.F) / q[2], H / 2 - (q[1] * k.F) / q[2]]; sides[c.s[0] < W / 2 ? 0 : 1].push(c);
    }
    g.font = "13px 'Cascadia Mono', Consolas, monospace";
    sides.forEach((cs, side) => {
      cs.sort((a, b) => a.s[1] - b.s[1]);
      const gap = Math.min(120, (H * 0.62) / Math.max(1, cs.length));
      cs.forEach((c, i) => {
        const y = H * 0.2 + i * gap, x = side ? W - 24 : 24, ex = side ? x - 270 : x + 270;
        k.line2(c.s[0], c.s[1], ex, y, c.col, c.a * 0.7); k.line2(ex, y, x, y, c.col, c.a * 0.7);
        g.textAlign = side ? 'right' : 'left';
        c.text.forEach((t, j) => { g.fillStyle = `rgba(${j === c.text.length - 1 && c.sub ? C.ice : c.col},${c.a})`; g.fillText(t, x, y + 17 + j * 16); });
      });
    });
    g.textAlign = 'left';
  }

  // --- WORLD NEWS -----------------------------------------------------------------
  function makeNews(k) {
    const { C, env, seg, text3, setCam } = k;
    const G = { c: [0, 0, 62], R: 28, rot: 0, tilt: 0.3 };
    let pins = [], next = 0, hold = 0, goal = null, goalTilt = 0.3;
    return {
      label: 'WORLD NEWS',
      update(dt) {
        const items = env.news || [];
        hold -= dt;
        if (items.length && hold <= 0) { // the next story: pin it, turn the globe to it
          const it = items[next++ % items.length], [lat, lon] = placeOf(it.title);
          pins.push({ lat, lon, v: vec(lat, lon), text: [...lines(it.title, 32, 3), (it.source || '').toUpperCase()].filter(Boolean), t: 0 });
          if (pins.length > 7) pins.shift();
          goal = -lon * D; goalTilt = Math.max(-0.6, Math.min(0.6, -lat * D * 0.8)); hold = 7;
        }
        if (goal == null) G.rot += dt * 0.12;
        else { G.rot += wrap(goal - G.rot) * Math.min(1, dt * 1.4); goal -= dt * 0.02; }
        G.tilt += (goalTilt - G.tilt) * Math.min(1, dt * 1.4);
        for (const p of pins) p.t += dt;
      },
      draw() {
        setCam({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
        globe(k, G, C.ice, C.neon);
        const shown = [];
        pins.forEach((p, i) => {
          const newest = i === pins.length - 1, rise = Math.min(1, p.t * 1.5), base = place(G, p.v, 1), tip = place(G, p.v, 1 + 0.25 * rise);
          if (base[3] > 0.15) return; // round the back
          const col = newest ? C.hot : C.gold;
          seg(base[0], base[1], base[2], tip[0], tip[1], tip[2], col, 1, 400);
          seg(tip[0] - 0.5, tip[1], tip[2], tip[0] + 0.5, tip[1], tip[2], col, 1, 400);
          if (newest) for (const r of [((p.t * 4) % 6) + 1, ((p.t * 4 + 3) % 6) + 1]) halo(k, G, p.lat, p.lon, r, C.hot, 1 - r / 7);
          if (i >= pins.length - 4) shown.push({ p: tip, text: p.text, col: newest ? C.white : C.gold, sub: true, a: newest ? Math.min(1, p.t) : 0.55 });
        });
        callouts(k, shown);
        if (!(env.news || []).length) text3('WAITING ON THE WIRE...', -8, -G.R - 5, G.c[2], C.gold, 1.2, 0.8);
      },
    };
  }

  // --- TRAFFIC MAP ------------------------------------------------------------------
  function makeTraffic(k) {
    const { C, env, seg, text3, setCam } = k;
    const G = { c: [0, -1, 62], R: 28, rot: 0, tilt: 0.45 };
    const arcs = new Map(); let home = null, homeV = null, sway = 0;
    const COLS = [C.neon, C.ice, C.gold, C.violet];
    return {
      label: 'TRAFFIC MAP',
      update(dt) {
        // Home stays in view: tilted to your latitude, swaying either side of your longitude.
        if (!home) { home = env.home || homeSpot(); homeV = vec(...home); G.tilt = Math.max(-0.6, Math.min(0.6, -home[0] * D * 0.8)); }
        sway += dt * (0.08 + env.level * 0.2);
        G.rot = -home[1] * D + Math.sin(sway) * 0.9;
        const live = new Set();
        for (const c of env.net || []) {
          const key = c.ip + ':' + c.port; live.add(key);
          if (!arcs.has(key)) {
            const [lat, lon] = isLocal(c.ip) ? [home[0] + 3, home[1] + 3] : spotOf(c.ip);
            arcs.set(key, { c, v: vec(lat, lon), t: 0, ph: Math.random(), col: COLS[hash(c.service) % COLS.length], gone: 0 });
          }
        }
        for (const [key, a] of arcs) {
          a.t += dt; if (!live.has(key)) a.gone += dt;
          if (a.gone > 3) arcs.delete(key);
        }
      },
      draw() {
        setCam({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
        globe(k, G, C.violet, C.ice);
        if (!home) return;
        const h = place(G, homeV, 1.02);
        if (h[3] < 0.1) { halo(k, G, home[0], home[1], 2.5 + Math.sin(env.t * 3), C.gold, 1); text3('YOU', h[0] + 1, h[1] + 1, h[2], C.gold, 1, 0.9); }
        const shown = [];
        for (const a of arcs.values()) {
          const fade = Math.min(1, a.t * 2) * (1 - a.gone / 3), N = 24;
          const dist = Math.acos(Math.max(-1, Math.min(1, homeV[0] * a.v[0] + homeV[1] * a.v[1] + homeV[2] * a.v[2])));
          const pt = (u) => place(G, norm(homeV.map((x, i) => x * (1 - u) + a.v[i] * u)), 1.01 + Math.sin(Math.PI * u) * (0.08 + dist * 0.18));
          let prev = pt(0);
          for (let i = 1; i <= N; i++) { // the arc, drawn as far as it has grown
            if (i / N > a.t * 1.5) break;
            const p = pt(i / N);
            seg(prev[0], prev[1], prev[2], p[0], p[1], p[2], a.col, fade * (p[3] < 0 ? 0.9 : 0.15), 400); prev = p;
          }
          const u = (env.t * (0.35 + env.level * 0.8) + a.ph) % 1, q = pt(u), q2 = pt(Math.min(1, u + 0.04)); // a packet in flight
          if (a.t > 0.7) seg(q[0], q[1], q[2], q2[0], q2[1], q2[2], C.white, fade * (q[3] < 0 ? 1 : 0.2), 400);
          const end = pt(1);
          if (end[3] < 0 && a.t > 0.7 && shown.length < 10) shown.push({ p: end, text: [a.c.service.toUpperCase(), a.c.ip], col: a.col, sub: true, a: fade * 0.9 });
        }
        callouts(k, shown);
        if (!arcs.size) text3('NO LINES OUT. QUIET.', -7, -G.R - 5, G.c[2], C.gold, 1.2, 0.8);
      },
    };
  }

  // --- HACK THE PLANET -----------------------------------------------------------
  function makeHack(k) {
    const { C, env, seg, text3, setCam } = k;
    const G = { c: [0, -3, 72], R: 24, rot: 0, tilt: 0.35 };
    const WORDS = 'HACK THE PLANET  //  HACK THE PLANET  //  ';
    // The floppy, in its own flat coordinates (u right, v up), drawn on both faces.
    const BODY = [[-4.5, -4.7], [4.5, -4.7], [4.5, 4.1], [3.9, 4.7], [-4.5, 4.7]];
    const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1], [u0, v0]];
    const circle = (cu, cv, r, n, a0, a1) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cu + Math.cos(a) * r, cv + Math.sin(a) * r]; });
    // Skull and crossbones on the label.
    const sk = (pts) => pts.map(([u, v]) => [u * 0.9, v * 0.9 - 1.2]);
    const JOLLY = [
      sk([...circle(0, 0.5, 1.5, 14, -0.45, Math.PI + 0.45), [-1.0, -0.6], [-0.8, -1.4], [0.8, -1.4], [1.0, -0.6], [1.35, -0.15]]),
      sk(rect(-0.85, -0.05, -0.25, 0.55)), sk(rect(0.25, -0.05, 0.85, 0.55)),
      sk([[0, -0.2], [-0.2, -0.6], [0.2, -0.6], [0, -0.2]]),
      sk([[-0.4, -1.4], [-0.4, -1.0]]), sk([[0, -1.4], [0, -1.0]]), sk([[0.4, -1.4], [0.4, -1.0]]),
      sk([[-2.1, -3.1], [2.1, -1.7]]), sk([[-2.1, -1.7], [2.1, -3.1]]),
      ...[[-2.1, -3.1], [2.1, -1.7], [-2.1, -1.7], [2.1, -3.1]].map(([u, v]) => sk(circle(u, v, 0.28, 8, 0, Math.PI * 2))),
    ];
    let spin = 0, orbit = 0;
    function floppy(pos, yaw, pitch, col, a, s) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const xf = (u, v, w) => { u *= s; v *= s; w *= s; const x = u * cy + w * sy, z = -u * sy + w * cy; return [pos[0] + x, pos[1] + v * cp - z * sp, pos[2] + v * sp + z * cp]; };
      const poly = (pts, w, c, al) => { for (let i = 0; i < pts.length - 1; i++) { const p = xf(pts[i][0], pts[i][1], w), q = xf(pts[i + 1][0], pts[i + 1][1], w); seg(...p, ...q, c, al, 300); } };
      const front = Math.cos(yaw) > 0 ? -0.18 : 0.18; // the label faces whichever way we see
      for (const w of [-0.18, 0.18]) poly([...BODY, BODY[0]], w, col, a);
      for (const [u, v] of BODY) { const p = xf(u, v, -0.18), q = xf(u, v, 0.18); seg(...p, ...q, col, a * 0.7, 300); }
      poly(rect(-2.4, 1.5, 2.2, 4.7), front, C.white, a * 0.9);      // metal shutter
      poly(rect(-1.4, 2.2, -0.3, 4.2), front, C.white, a * 0.6);      // its window
      poly(rect(-3.6, -4.4, 3.9, 1.1), front, C.gold, a * 0.8);       // label
      poly(rect(-4.2, -4.4, -3.8, -3.8), front, col, a * 0.7);        // write-protect
      for (const part of JOLLY) poly(part, front, C.hot, a);
    }
    return {
      label: 'HACK THE PLANET',
      update(dt) {
        G.rot += dt * (0.15 + env.level * 0.5); spin += dt * (0.6 + env.level * 1.2); orbit += dt * 0.18;
      },
      draw() {
        setCam({ x: 0, y: 0, z: 0, yaw: Math.sin(env.t * 0.07) * 0.03, pitch: 0 });
        globe(k, G, C.neon, C.hot);
        // a scan line sweeping the planet, brighter on the beat
        const sl = Math.sin(env.t * 0.8) * 70;
        for (let lon = 0; lon < 360; lon += 10) { const p = place(G, vec(sl, lon), 1.01), q = place(G, vec(sl, lon + 10), 1.01); if (p[3] + q[3] < 0) seg(...p.slice(0, 3), ...q.slice(0, 3), C.gold, 0.5 + env.pulse * 0.5, 400); }
        // the words go round
        const n = WORDS.length;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 - env.t * 0.2, r = 50;
          const x = G.c[0] + Math.cos(a) * r, z = G.c[2] + Math.sin(a) * r * 0.8, y = G.c[1] - 6 + Math.sin(a) * 8;
          text3(WORDS[i], x, y, z, z < G.c[2] ? C.hot : C.violet, 2.6, z < G.c[2] ? 1 : 0.3);
        }
        // the floppy, orbiting high and in front
        const oa = orbit, pos = [Math.cos(oa) * 52, 12 + Math.sin(oa * 2) * 4, G.c[2] - 10 + Math.sin(oa) * 24];
        floppy(pos, spin, 0.25 + Math.sin(env.t * 0.5) * 0.15, C.ice, 1, 1.7);
      },
    };
  }

  Worlds.define('newsglobe', makeNews);
  Worlds.define('traffic', makeTraffic);
  Worlds.define('hack', makeHack);
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
