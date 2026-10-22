// NIGHT SKY: the sky over you right now, as best we can guess where you are (your time zone's city;
// see homeSpot in earth.js). About 140 of the brightest stars with the constellation figures, the
// Milky Way, the Sun, the Moon with its phase, and the five naked-eye planets from their orbital
// elements (JPL's approximate Keplerian set, good to well under a degree for 1800-2050). The view
// turns slowly round the horizon; the corners say what's up and where.
(function (Worlds) {
  const D = Math.PI / 180, J2000 = 946728000000; // 2000-01-01 12:00 UTC, in ms
  const days = (ms) => (ms - J2000) / 86400000;
  const norm360 = (a) => ((a % 360) + 360) % 360;
  const EPS = 23.4393 * D;
  // ecliptic xyz → [RA deg, Dec deg]
  function eclToRaDec(x, y, z) {
    const ye = y * Math.cos(EPS) - z * Math.sin(EPS), ze = y * Math.sin(EPS) + z * Math.cos(EPS);
    return [norm360(Math.atan2(ye, x) / D), Math.atan2(ze, Math.hypot(x, ye)) / D];
  }
  // Greenwich mean sidereal time, degrees
  const gmst = (ms) => norm360(280.46061837 + 360.98564736629 * days(ms));
  // [alt, az] in degrees (az from north through east) of RA/Dec seen from lat/lon at time ms
  function altAz(ra, dec, lat, lon, ms) {
    const H = (gmst(ms) + lon - ra) * D, d = dec * D, p = lat * D;
    const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(H));
    return [alt / D, norm360(az / D)];
  }
  // Planets: a, e, I, L, long. of perihelion, long. of node, then their rates per century (Standish, JPL)
  const EL = {
    mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
    earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
    mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  };
  function helio(name, ms) { // heliocentric ecliptic xyz, AU
    const T = days(ms) / 36525, e0 = EL[name], [a, e, I, L, w, N] = e0.slice(0, 6).map((v, i) => v + e0[i + 6] * T);
    const M = norm360(L - w) * D, om = (w - N) * D, Om = N * D, i = I * D;
    let E = M + e * Math.sin(M); for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(i), si = Math.sin(i);
    return [(co * cO - so * sO * ci) * xp + (-so * cO - co * sO * ci) * yp, (co * sO + so * cO * ci) * xp + (-so * sO + co * cO * ci) * yp, so * si * xp + co * si * yp];
  }
  function planetRaDec(name, ms) { const p = helio(name, ms), E = helio('earth', ms); return eclToRaDec(p[0] - E[0], p[1] - E[1], p[2] - E[2]); }
  function sunRaDec(ms) { const E = helio('earth', ms); return eclToRaDec(-E[0], -E[1], -E[2]); }
  function moonRaDec(ms) { // a few terms: good to a degree or so, plenty for a picture
    const d = days(ms), L = 218.316 + 13.176396 * d, M = (134.963 + 13.064993 * d) * D, F = (93.272 + 13.22935 * d) * D;
    const lon = (L + 6.289 * Math.sin(M)) * D, lat = 5.128 * Math.sin(F) * D;
    return eclToRaDec(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
  }
  const sep = (a, b) => Math.acos(Math.max(-1, Math.min(1, Math.sin(a[1] * D) * Math.sin(b[1] * D) + Math.cos(a[1] * D) * Math.cos(b[1] * D) * Math.cos((a[0] - b[0]) * D)))) / D;

  // name, RA (hours), Dec (deg), magnitude
  const STARS = `Sirius 6.752 -16.716 -1.46|Canopus 6.399 -52.696 -0.74|Arcturus 14.261 19.182 -0.05|Rigil Kent 14.66 -60.834 -0.27|Vega 18.616 38.784 0.03|Capella 5.278 45.998 0.08|Rigel 5.242 -8.202 0.13|Procyon 7.655 5.225 0.34|Achernar 1.629 -57.237 0.46|Betelgeuse 5.919 7.407 0.5|Hadar 14.064 -60.373 0.61|Altair 19.846 8.868 0.76|Acrux 12.443 -63.099 0.77|Aldebaran 4.599 16.509 0.85|Antares 16.49 -26.432 0.96|Spica 13.42 -11.161 0.97|Pollux 7.755 28.026 1.14|Fomalhaut 22.961 -29.622 1.16|Deneb 20.69 45.28 1.25|Mimosa 12.795 -59.689 1.25|Regulus 10.139 11.967 1.35|Adhara 6.977 -28.972 1.5|Castor 7.577 31.888 1.58|Shaula 17.56 -37.104 1.62|Gacrux 12.519 -57.113 1.63|Bellatrix 5.419 6.35 1.64|Elnath 5.438 28.608 1.65|Miaplacidus 9.22 -69.717 1.67|Alnilam 5.604 -1.202 1.69|Alnair 22.137 -46.961 1.73|Alnitak 5.679 -1.943 1.74|Alioth 12.9 55.96 1.76|Dubhe 11.062 61.751 1.79|Mirfak 3.405 49.861 1.79|Wezen 7.14 -26.393 1.83|Sargas 17.622 -42.998 1.86|Kaus Australis 18.403 -34.385 1.85|Avior 8.375 -59.51 1.86|Alkaid 13.792 49.313 1.86|Menkalinan 5.992 44.948 1.9|Atria 16.811 -69.028 1.91|Alhena 6.629 16.399 1.92|Peacock 20.427 -56.735 1.94|Polaris 2.53 89.264 1.98|Mirzam 6.378 -17.956 1.98|Alphard 9.46 -8.659 1.98|Hamal 2.12 23.462 2|Algieba 10.333 19.842 2.08|Diphda 0.727 -17.987 2.04|Nunki 18.921 -26.297 2.05|Menkent 14.111 -36.37 2.06|Saiph 5.796 -9.67 2.07|Alpheratz 0.14 29.091 2.06|Mirach 1.162 35.621 2.05|Kochab 14.845 74.156 2.08|Rasalhague 17.582 12.56 2.08|Algol 3.136 40.956 2.1|Almach 2.065 42.33 2.1|Denebola 11.818 14.572 2.13|Tsih 0.945 60.717 2.15|Schedar 0.675 56.537 2.24|Caph 0.153 59.15 2.28|Ruchbah 1.43 60.235 2.68|Segin 1.907 63.67 3.35|Mizar 13.399 54.925 2.23|Merak 11.031 56.383 2.37|Phecda 11.897 53.695 2.44|Megrez 12.257 57.033 3.31|Mintaka 5.533 -0.299 2.23|Meissa 5.585 9.934 3.39|Sadr 20.37 40.257 2.23|Gienah 20.77 33.97 2.48|Fawaris 19.75 45.131 2.87|Albireo 19.512 27.96 3.08|Eltanin 17.943 51.489 2.24|Rastaban 17.507 52.301 2.79|Grumium 17.892 56.873 3.75|Enif 21.736 9.875 2.39|Scheat 23.063 28.083 2.42|Markab 23.079 15.205 2.49|Algenib 0.22 15.184 2.83|Dschubba 16.006 -22.622 2.29|Acrab 16.091 -19.806 2.62|Fang 15.981 -26.114 2.89|Alniyat 16.353 -25.593 2.9|Paikauhale 16.598 -28.216 2.82|Larawag 16.836 -34.293 2.29|Xamidimura 16.864 -38.047 3|Zeta Sco 16.896 -42.36 3.6|Eta Sco 17.202 -43.239 3.33|Iota Sco 17.793 -40.127 3|Girtab 17.708 -39.03 2.39|Lesath 17.512 -37.296 2.7|Sheliak 18.835 33.363 3.5|Sulafat 18.982 32.69 3.25|Zeta Lyr 18.746 37.605 4.3|Delta Lyr 18.908 36.899 4.3|Tarazed 19.771 10.613 2.72|Alshain 19.922 6.407 3.71|Delta Aql 19.425 3.115 3.36|Okab 19.09 13.863 2.99|Izar 14.75 27.074 2.37|Muphrid 13.911 18.398 2.68|Seginus 14.535 38.308 3.03|Nekkar 15.032 40.39 3.5|Zosma 11.235 20.524 2.56|Chertan 11.237 15.43 3.33|Eta Leo 10.122 16.763 3.5|Ras Elased 9.764 23.774 2.98|Adhafera 10.278 23.417 3.44|Rasalas 9.879 26.007 3.88|Wasat 7.335 21.982 3.53|Mebsuta 6.732 25.131 3.06|Tejat 6.383 22.514 2.87|Alzirr 6.755 12.896 3.35|Ain 4.477 19.18 3.53|Hyadum 4.33 15.628 3.65|Tianguan 5.627 21.143 3|Alcyone 3.791 24.105 2.87|Kaus Media 18.35 -29.828 2.7|Kaus Borealis 18.466 -25.422 2.81|Alnasl 18.097 -30.424 2.99|Ascella 19.044 -29.88 2.6|Phi Sgr 18.761 -26.991 3.17|Tau Sgr 19.116 -27.671 3.3|Imai 12.252 -58.749 2.8|Aludra 7.402 -29.303 2.45|Furud 6.338 -30.064 3|Yildun 17.537 86.586 4.36|Eps UMi 16.766 82.037 4.2|Zeta UMi 15.734 77.794 4.3|Pherkad 15.345 71.834 3|Eta UMi 16.292 75.755 4.95|Delta And 0.656 30.861 3.27|Delta Per 3.715 47.788 3|Eps Per 3.964 40.01 2.9|Gamma Per 3.08 53.506 2.9|Theta Aur 5.995 37.213 2.62|Hassaleh 4.95 33.166 2.69|Almaaz 5.032 43.823 3|Porrima 12.694 -1.449 2.74|Vindemiatrix 13.036 10.959 2.85|Zavijava 11.845 1.765 3.6|Minelauva 12.927 3.397 3.38|Alderamin 21.31 62.585 2.45|Alfirk 21.478 70.561 3.2|Errai 23.656 77.632 3.2|Iota Cep 22.828 66.2 3.5|Zeta Cep 22.181 58.201 3.35|Gomeisa 7.453 8.289 2.89`
    .split('|').map((r) => { const m = /^(.+) (\S+) (\S+) (\S+)$/.exec(r); return { name: m[1], ra: Number(m[2]) * 15, dec: Number(m[3]), mag: Number(m[4]) }; });
  const RED = new Set(['Betelgeuse', 'Antares', 'Aldebaran', 'Arcturus', 'Pollux', 'Mirach', 'Kochab', 'Gacrux']), BLUE = new Set(['Rigel', 'Spica', 'Vega', 'Regulus', 'Achernar', 'Bellatrix', 'Alnilam', 'Alnitak', 'Mintaka', 'Hadar', 'Acrux', 'Sirius']);
  // constellation figures: chains of star names ('-' links), several chains per figure (',')
  const FIGS = {
    ORION: 'Betelgeuse-Meissa-Bellatrix,Betelgeuse-Alnitak-Alnilam-Mintaka-Bellatrix,Alnitak-Saiph,Mintaka-Rigel',
    'URSA MAJOR': 'Dubhe-Merak-Phecda-Megrez-Dubhe,Megrez-Alioth-Mizar-Alkaid',
    'URSA MINOR': 'Polaris-Yildun-Eps UMi-Zeta UMi-Kochab-Pherkad-Eta UMi-Zeta UMi',
    CASSIOPEIA: 'Caph-Schedar-Tsih-Ruchbah-Segin', CYGNUS: 'Deneb-Sadr-Albireo,Gienah-Sadr-Fawaris', LYRA: 'Vega-Zeta Lyr-Sheliak-Sulafat-Delta Lyr-Zeta Lyr',
    AQUILA: 'Alshain-Altair-Tarazed,Altair-Delta Aql,Tarazed-Okab',
    SCORPIUS: 'Acrab-Dschubba-Fang,Dschubba-Alniyat-Antares-Paikauhale-Larawag-Xamidimura-Zeta Sco-Eta Sco-Sargas-Iota Sco-Girtab-Shaula-Lesath',
    SAGITTARIUS: 'Alnasl-Kaus Media-Kaus Borealis,Kaus Media-Kaus Australis-Alnasl,Kaus Media-Phi Sgr-Nunki-Tau Sgr-Ascella-Phi Sgr,Ascella-Kaus Australis',
    LEO: 'Regulus-Eta Leo-Algieba-Adhafera-Rasalas-Ras Elased,Algieba-Zosma-Denebola-Chertan-Regulus,Zosma-Chertan',
    GEMINI: 'Castor-Pollux,Castor-Mebsuta-Tejat,Pollux-Wasat-Alhena,Wasat-Alzirr', TAURUS: 'Elnath-Ain-Hyadum-Aldebaran-Tianguan', 'CANIS MAJOR': 'Mirzam-Sirius-Adhara-Wezen-Aludra,Adhara-Furud,Sirius-Wezen',
    CRUX: 'Acrux-Gacrux,Mimosa-Imai', CENTAURUS: 'Rigil Kent-Hadar-Menkent', PEGASUS: 'Alpheratz-Scheat-Markab-Algenib-Alpheratz,Markab-Enif', ANDROMEDA: 'Alpheratz-Delta And-Mirach-Almach',
    PERSEUS: 'Gamma Per-Mirfak-Delta Per-Eps Per,Mirfak-Algol', AURIGA: 'Capella-Menkalinan-Theta Aur-Elnath-Hassaleh-Almaaz-Capella', BOOTES: 'Arcturus-Izar-Nekkar-Seginus-Arcturus,Arcturus-Muphrid',
    VIRGO: 'Spica-Porrima-Vindemiatrix,Porrima-Zavijava,Porrima-Minelauva', CEPHEUS: 'Alderamin-Alfirk-Errai-Iota Cep-Zeta Cep-Alderamin,Iota Cep-Alfirk', DRACO: 'Eltanin-Rastaban-Grumium-Eltanin', 'CANIS MINOR': 'Procyon-Gomeisa',
  };
  const byName = new Map(STARS.map((s) => [s.name, s]));
  // The galactic equator, for the Milky Way: galactic (l, b) → RA/Dec
  function galToRaDec(l, b) {
    const dG = 27.12825 * D, aG = 192.85948, lN = 122.93192, dl = (lN - l) * D, bb = b * D;
    const dec = Math.asin(Math.sin(bb) * Math.sin(dG) + Math.cos(bb) * Math.cos(dG) * Math.cos(dl));
    const ra = aG + Math.atan2(Math.cos(bb) * Math.sin(dl), Math.sin(bb) * Math.cos(dG) - Math.cos(bb) * Math.sin(dG) * Math.cos(dl)) / D;
    return [norm360(ra), dec / D];
  }
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const DUST = Array.from({ length: 700 }, () => { const l = rnd() * 360, b = (rnd() + rnd() + rnd() - 1.5) * 9 * (l < 60 || l > 300 ? 1.5 : 1); return galToRaDec(l, b); }); // fatter toward the centre

  Worlds.sky = { gmst, altAz, sunRaDec, moonRaDec, planetRaDec, sep, galToRaDec }; // for the self-check

  Worlds.define('sky', (k) => {
    const { C, env, seg, setCam, text3, toCam } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", R = 100, FOG = 400;
    const PLANETS = [['MERCURY', 'mercury', C.ice, 0], ['VENUS', 'venus', C.white, -4], ['MARS', 'mars', C.hot, 0.5], ['JUPITER', 'jupiter', C.gold, -2.2], ['SATURN', 'saturn', C.gold, 0.6]];
    const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dir = (az) => COMPASS[Math.round(az / 45) % 8];
    const vec = (alt, az) => [Math.cos(alt * D) * Math.sin(az * D) * R, Math.sin(alt * D) * R, Math.cos(alt * D) * Math.cos(az * D) * R];
    let home = null, at = 0, sky = null;
    const hills = Array.from({ length: 73 }, (_, i) => 1.2 + Math.abs(Math.sin(i * 0.9) * 1.6 + Math.sin(i * 0.31) * 2.2));

    function compute(ms) { // positions move slowly: once every few seconds is plenty
      const [lat, lon] = home, aa = (ra, dec) => altAz(ra, dec, lat, lon, ms);
      const stars = STARS.map((s) => { const [alt, az] = aa(s.ra, s.dec); return { ...s, alt, az, v: vec(alt, az) }; });
      const sun = sunRaDec(ms), moon = moonRaDec(ms), elong = sep(sun, moon);
      const sunAA = aa(...sun), moonAA = aa(...moon);
      const planets = PLANETS.map(([label, key, col, mag]) => { const rd = planetRaDec(key, ms), [alt, az] = aa(...rd); return { label, col, mag, alt, az, v: vec(alt, az) }; });
      const dust = DUST.map(([ra, dec]) => { const [alt, az] = aa(ra, dec); return alt > 0 ? vec(alt, az) : null; }).filter(Boolean);
      sky = { stars, planets, dust, sun: { alt: sunAA[0], az: sunAA[1], v: vec(...sunAA) }, moon: { alt: moonAA[0], az: moonAA[1], v: vec(...moonAA), lit: (1 - Math.cos(elong * D)) / 2, waxing: norm360(moon[0] - sun[0]) < 180 }, lst: norm360(gmst(ms) + lon) };
      for (const s of stars) byName.get(s.name).now = s;
    }

    return {
      label: 'NIGHT SKY',
      update() {
        const want = env.home || (Worlds.geo && Worlds.geo.homeSpot()) || [40, -100]; // env.home: the screenshots' made-up place
        if (!home || want[0] !== home[0] || want[1] !== home[1]) { home = want; at = 0; }
        const now = Date.now(); if (now - at > 5000) { at = now; compute(now); }
      },
      draw() {
        if (!sky) return;
        const t = env.t, yaw = (t * 0.012) % (Math.PI * 2), pitch = 0.42 + Math.sin(t * 0.05) * 0.12;
        setCam({ x: 0, y: 0, z: 0, yaw, pitch });
        // the Milky Way: a haze of short dashes along the galactic plane
        for (const v of sky.dust) seg(v[0], v[1], v[2], v[0] * 1.004, v[1] * 1.004 + 0.25, v[2] * 1.004, C.violet, 0.35, FOG);
        // constellation figures, then their names
        for (const [name, chains] of Object.entries(FIGS)) {
          let cx = 0, cy = 0, cz = 0, n = 0;
          for (const ch of chains.split(',')) {
            const ss = ch.split('-').map((x) => byName.get(x).now);
            for (let i = 1; i < ss.length; i++) { const a = ss[i - 1], b = ss[i]; if (a.alt > 0 && b.alt > 0) seg(...a.v, ...b.v, C.ice, 0.4, FOG); }
            for (const s of ss) if (s.alt > 0) { cx += s.v[0]; cy += s.v[1]; cz += s.v[2]; n++; }
          }
          if (n > 2) text3(name, cx / n, cy / n - 3, cz / n, C.violet, 1.4, 0.55);
        }
        // the stars, size and brightness by magnitude, a little twinkle
        for (const s of sky.stars) {
          if (s.alt < 0) continue;
          const sz = Math.max(0.2, (3.6 - s.mag) * 0.26), tw = 0.75 + 0.25 * Math.sin(t * (3 + (s.ra % 7)) + s.dec), col = RED.has(s.name) ? C.gold : BLUE.has(s.name) ? C.ice : C.white, [x, y, z] = s.v;
          seg(x - sz, y, z, x + sz, y, z, col, tw, FOG); seg(x, y - sz, z, x, y + sz, z, col, tw, FOG);
          if (s.mag < 1) { const q = sz * 0.5; seg(x - q, y - q, z, x + q, y + q, z, col, tw * 0.7, FOG); seg(x - q, y + q, z, x + q, y - q, z, col, tw * 0.7, FOG); } // the brightest get a glint
          if (s.mag < 1.6) text3(s.name.toUpperCase(), x + 1, y - 0.6, z, col, 1, 0.6);
        }
        // planets: a ring and a name
        for (const p of sky.planets) if (p.alt > 0) { k.ring(...p.v, 0.6 + Math.max(0, 1 - p.mag) * 0.25, 10, p.col, 1, FOG, 'xy'); text3(p.label, p.v[0] + 1.2, p.v[1] + 0.8, p.v[2], p.col, 1.3, 0.95); }
        // the horizon: a ring, the hills, and the compass points
        for (let i = 0; i < 72; i++) {
          const a0 = i * 5 * D, a1 = (i + 1) * 5 * D, h0 = hills[i] * D * R, h1 = hills[i + 1] * D * R;
          seg(Math.sin(a0) * R, 0, Math.cos(a0) * R, Math.sin(a1) * R, 0, Math.cos(a1) * R, C.neon, 0.5, FOG);
          seg(Math.sin(a0) * R, h0, Math.cos(a0) * R, Math.sin(a1) * R, h1, Math.cos(a1) * R, C.violet, 0.8, FOG);
        }
        for (let i = 0; i < 8; i++) { const a = i * 45 * D; text3(COMPASS[i], Math.sin(a) * R * 0.9 - 1, -4, Math.cos(a) * R * 0.9, i % 2 ? C.ice : C.gold, i % 2 ? 1.6 : 2.4, 0.9); }
        // the Sun, when it's up (or near it)
        if (sky.sun.alt > -2) { const [x, y, z] = sky.sun.v; k.ring(x, y, z, 2.2, 20, C.gold, 1, FOG, 'xy'); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; seg(x + Math.cos(a) * 2.8, y + Math.sin(a) * 2.8, z, x + Math.cos(a) * 4, y + Math.sin(a) * 4, z, C.gold, 0.8, FOG); } }
        moonDraw();
        hud();
      },
    };

    function moonDraw() { // a disc with its lit part, drawn in screen space at the Moon's place
      const m = sky.moon; if (m.alt < -1) return;
      const p = toCam(...m.v); if (p[2] < 1) return;
      const g = k.g, sx = k.W / 2 + p[0] * k.F / p[2], sy = k.H / 2 - p[1] * k.F / p[2], r = 2.4 * k.F / p[2];
      const sp = toCam(...sky.sun.v), ang = Math.atan2(-(sp[1] / Math.max(1, sp[2]) - p[1] / p[2]), sp[0] / Math.max(1, sp[2]) - p[0] / p[2]); // toward the Sun
      g.save(); g.translate(sx, sy); g.rotate(ang);
      g.strokeStyle = `rgba(${C.white},0.35)`; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(${C.white},0.8)`; g.beginPath(); // lit limb (facing the Sun), then the terminator as a half-ellipse
      g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); g.ellipse(0, 0, Math.abs(1 - 2 * m.lit) * r, r, 0, Math.PI / 2, -Math.PI / 2, m.lit > 0.5);
      g.fill(); g.restore();
      g.font = `${12 * Math.min(k.W / 1920, k.H / 1080) | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.75)`; g.fillText('MOON', sx + r + 6, sy + 4);
    }

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), x0 = 28 * s, now = new Date();
      const [lat, lon] = home, deg = (v, p, n) => `${Math.abs(v).toFixed(1)}${v >= 0 ? p : n}`;
      const hm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
      const sun = sky.sun.alt, phase = sun > 0 ? 'DAYTIME: THE STARS ARE STILL THERE' : sun > -6 ? 'CIVIL TWILIGHT' : sun > -12 ? 'NAUTICAL TWILIGHT' : sun > -18 ? 'ASTRONOMICAL TWILIGHT' : 'FULL DARK';
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(`THE SKY OVER ${deg(lat, 'N', 'S')} ${deg(lon, 'E', 'W')}`, x0, 34 * s);
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`;
      let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* none */ }
      g.fillText(env.home ? 'a made-up place, for the screenshots' : `a guess, from your time zone${tz ? ' (' + tz + ')' : ''}`, x0, 54 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.85)`;
      g.fillText(`LOCAL ${now.toTimeString().slice(0, 5)}   SIDEREAL ${hm(sky.lst / 15)}`, x0, 76 * s);
      g.fillStyle = `rgba(${sun > -6 ? C.gold : C.neon},0.85)`; g.fillText(`SUN ${sun.toFixed(0)}°  ${phase}`, x0, 96 * s);
      // what's up: Moon, planets, the brightest stars above the horizon
      const m = sky.moon, pct = Math.round(m.lit * 100), pname = pct < 3 ? 'NEW' : pct > 97 ? 'FULL' : `${m.waxing ? 'WAXING' : 'WANING'} ${pct < 50 ? 'CRESCENT' : pct === 50 ? 'QUARTER' : 'GIBBOUS'}`;
      const rows = [[`MOON  ${pname} ${pct}%`, m.alt > 0 ? `${dir(m.az)} ${m.alt.toFixed(0)}°` : 'BELOW', C.white]];
      for (const p of sky.planets) rows.push([p.label, p.alt > 0 ? `${dir(p.az)} ${p.alt.toFixed(0)}°` : 'BELOW', p.alt > 0 ? p.col : C.violet]);
      for (const st of sky.stars.filter((x) => x.alt > 5).sort((a, b) => a.mag - b.mag).slice(0, 6)) rows.push([st.name.toUpperCase(), `${dir(st.az)} ${st.alt.toFixed(0)}°`, C.ice]);
      const rx = W - 28 * s;
      g.font = `bold ${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; const hd = 'ABOVE YOU NOW'; g.fillText(hd, rx - g.measureText(hd).width, 34 * s);
      g.font = `${12 * s | 0}px ${MONO}`;
      rows.forEach(([a, b, col], i) => { const y = (56 + i * 17) * s; g.fillStyle = `rgba(${col},0.85)`; g.fillText(a, rx - 270 * s, y); g.fillText(b, rx - g.measureText(b).width, y); });
      g.fillStyle = `rgba(${C.white},0.5)`; const lk = `LOOKING ${dir(((Math.atan2(Math.sin(env.t * 0.012), Math.cos(env.t * 0.012)) / D) + 360) % 360)}`; g.fillText(lk, x0, H - 30 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
