// OUTATIME: a wireframe DeLorean down a night road. It builds to 88 mph (your activity is the
// throttle), crackles blue, and is gone in a flash, leaving twin fire trails. Every other run the
// wheels fold flat at speed and it lifts off the road and climbs away before it jumps. Then it
// comes back three flashes later. Time circuits bottom left, speedo bottom right, flux capacitor
// top right.
(function (Worlds) {
  Worlds.define('outatime', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, text3 } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 260, MPH = 2.237, RED = '255,60,40';
    const DATES = ['NOV 05 1955 06:00', 'OCT 26 1985 01:21', 'OCT 21 2015 16:29', 'SEP 02 1885 08:00', 'JUL 04 1776 10:00', 'JAN 01 2000 00:00', 'JUN 18 1984 11:05', 'DEC 25 1999 23:59'];
    const fmt = (d) => d.toLocaleString('en-US', { month: 'short' }).toUpperCase() + ' ' + String(d.getDate()).padStart(2, '0') + ' ' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    let dest = pick(DATES), present = fmt(new Date()), last = '--- -- ---- --:--';

    // body: side profile (z, y, half-width), mirrored left and right; nose +z
    const PROF = [[2.1, 0.35, 0.9], [2.15, 0.62, 0.9], [0.7, 0.86, 0.92], [0.05, 1.15, 0.66], [-0.95, 1.15, 0.66], [-1.95, 0.95, 0.9], [-2.1, 0.92, 0.9], [-2.1, 0.35, 0.9]];
    const car = { x: 0, y: 0, z: 0, v: 0, pitch: 0, fold: 0, show: true };
    let phase = 'drive', pt = 0, fly = true, trails = [], arcs = [], flash = 0, gone = null, camZ = -9, camY = 2.2;

    function toW(lx, ly, lz) { // car local → world, pitched nose-up as it climbs
      const c = Math.cos(car.pitch), s = Math.sin(car.pitch);
      return [car.x + lx, car.y + ly * c + lz * s, car.z + lz * c - ly * s];
    }
    function L(a, b, col, al) { const p = toW(...a), q = toW(...b); seg(p[0], p[1], p[2], q[0], q[1], q[2], col, al, FOG); }
    function drawCar(col, al) {
      for (const sx of [-1, 1]) for (let i = 0; i < PROF.length; i++) { const [z, y, w] = PROF[i], [z2, y2, w2] = PROF[(i + 1) % PROF.length]; L([sx * w, y, z], [sx * w2, y2, z2], col, al); }
      for (const [z, y, w] of PROF) L([-w, y, z], [w, y, z], col, al * 0.8);
      L([-0.9, 0.62, 0.05], [-0.9, 0.62, -1.8], col, al * 0.6); L([0.9, 0.62, 0.05], [0.9, 0.62, -1.8], col, al * 0.6); // the gull-wing seam
      for (let i = 0; i < 5; i++) L([-0.7, 0.95, -1.55 - i * 0.1], [0.7, 0.95, -1.55 - i * 0.1], C.ice, (0.3 + env.pulse * 0.7) * al); // rear vents, charging
      // wheels: upright, or folded flat under the car for flight
      const f = car.fold * Math.PI / 2;
      for (const wz of [1.3, -1.3]) for (const sx of [-1, 1]) {
        const cx = sx * 0.95, cy = 0.33 - car.fold * 0.1, vx = Math.sin(f) * sx, vy = Math.cos(f);
        let p = null;
        for (let a = 0; a <= 12; a++) {
          const t = a / 12 * Math.PI * 2, q = [cx + Math.sin(t) * 0.33 * vx, cy + Math.sin(t) * 0.33 * vy, wz + Math.cos(t) * 0.33];
          if (p) L(p, q, car.fold > 0.5 ? C.ice : col, al); p = q;
        }
      }
    }
    function newRun() {
      fly = !fly; phase = 'arrive'; pt = 0; car.v = 88 / MPH; car.y = 0; car.pitch = 0; car.fold = 0; car.show = false;
      car.z = (gone ? gone.z : car.z) + 120; last = present; present = dest; dest = pick(DATES.filter((d) => d !== present));
    }

    return {
      label: 'OUTATIME',
      update(dt) {
        pt += dt; flash = Math.max(0, flash - dt * 2.5);
        const mph = car.v * MPH;
        if (phase === 'arrive') { // three flashes, then it's here, braking hard
          if ([0, 0.25, 0.5].some((t) => pt - dt < t && pt >= t)) flash = 0.35;
          car.show = pt > 0.5;
          if (car.show) car.v = Math.max(14, car.v - dt * 12);
          if (pt > 3) { phase = 'drive'; pt = 0; }
        } else if (phase === 'drive') {
          car.v += (1.2 + env.level * 3.5) * dt * (mph < 30 ? 1.6 : 1); // about 10 s to 88 typing hard, half a minute idle
          if (fly && mph > 45) { car.fold = Math.min(1, car.fold + dt * 0.8); if (car.fold === 1) { car.y += (mph - 50) * 0.02 * dt * 6; car.pitch += (0.12 - car.pitch) * dt; } }
          if (mph > 70) { const n = Math.floor((mph - 70) * dt * 4 + Math.random()); for (let i = 0; i < n; i++) arcs.push({ t: 0.12, s: Math.random() }); }
          if (mph > 80) trails.push({ x: car.x, y: car.y, z: car.z });
          if (mph >= 88) { phase = 'gone'; pt = 0; flash = 0.5; car.show = false; gone = { x: car.x, y: car.y, z: car.z }; }
        } else if (phase === 'gone' && pt > 5) newRun();
        car.z += car.v * dt;
        if (!car.show && phase === 'gone') car.v *= 1 - dt * 0.6; // the camera coasts on
        for (const a of arcs) a.t -= dt;
        arcs = arcs.filter((a) => a.t > 0);
        if (phase !== 'drive' && phase !== 'gone') trails = [];
        if (trails.length > 400) trails.shift();
        // chase camera; it climbs slower than the car, so a flying car rises out of frame
        camY += (car.y * 0.55 + 2.2 - camY) * Math.min(1, dt * 2);
        camZ = car.z - 9;
      },
      draw() {
        const t = env.t, cam = lookAt({ x: -3.2 + Math.sin(t * 0.2) * 0.6, y: camY, z: camZ }, car.x, car.y * 0.8 + 0.8, car.z + 5);
        setCam(cam);
        // the road, the desert grid, the poles, the hills
        const z0 = Math.floor(camZ / 6) * 6;
        for (let z = z0; z < camZ + FOG; z += 6) {
          seg(-4, 0, z, -4, 0, z + 6, C.white, 0.7, FOG); seg(4, 0, z, 4, 0, z + 6, C.white, 0.7, FOG);
          if ((z / 6) % 2 === 0) seg(0, 0, z, 0, 0, z + 3, C.gold, 0.8, FOG);
          if (z % 12 === 0) seg(-90, 0, z, -6, 0, z, C.violet, 0.35, FOG), seg(6, 0, z, 90, 0, z, C.violet, 0.35, FOG);
          if (z % 48 === 0) for (const sx of [-1, 1]) { seg(sx * 8, 0, z, sx * 8, 7, z, C.ice, 0.5, FOG); seg(sx * 7, 6.4, z, sx * 9.4, 6.4, z, C.ice, 0.5, FOG); }
        }
        for (let x = -90; x <= 90; x += 12) if (Math.abs(x) > 6) seg(x, 0, camZ, x, 0, camZ + FOG, C.violet, 0.3, FOG);
        for (let i = 0; i < 40; i++) {
          const x0 = -240 + i * 12, h = (n) => 14 + Math.abs(Math.sin(n * 0.61) * 18 + Math.sin(n * 0.17) * 12);
          seg(x0, h(i), camZ + 250, x0 + 12, h(i + 1), camZ + 250, C.violet, 0.9, 600);
        }
        // fire trails, burning down
        const age = phase === 'gone' ? pt : 0, burn = Math.max(0, 1 - age / 5);
        if (trails.length > 1 && (phase === 'gone' || phase === 'drive')) for (let i = 1; i < trails.length; i++) {
          const a = trails[i - 1], b = trails[i];
          for (const sx of [-0.95, 0.95]) {
            seg(a.x + sx, a.y + 0.05, a.z, b.x + sx, b.y + 0.05, b.z, i % 3 ? C.hot : C.gold, burn, FOG);
            if (phase === 'gone' && Math.random() < 0.3) seg(b.x + sx, b.y, b.z, b.x + sx + rand(-0.2, 0.2), b.y + rand(0.3, 1.4) * burn, b.z, C.gold, burn * 0.8, FOG);
          }
        }
        if (car.show) {
          const mph = car.v * MPH, hot = mph > 80;
          drawCar(hot ? C.white : C.ice, 0.95);
          for (const a of arcs) { // the time field crackling over the body
            let p = toW(rand(-1.2, 1.2), rand(0.3, 1.4), rand(-2.4, 2.4));
            for (let j = 0; j < 4; j++) { const q = [p[0] + rand(-1, 1), p[1] + rand(-0.6, 0.8), p[2] + rand(-1, 1)]; seg(...p, ...q, a.s < 0.5 ? C.ice : C.white, 1, FOG); p = q; }
          }
        }
        if (phase === 'gone' && pt < 2.5) text3('OUTATIME', gone.x - 1.6, gone.y + 1.2, gone.z, C.gold, 0.9, 1 - pt / 2.5);
        if (phase === 'arrive' && pt < 0.6) for (let r = 1; r < 4; r++) k.ring(car.x, 1, car.z, r * (1 + pt * 4), 24, C.white, 1 - pt, FOG, 'xy');
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), mph = car.show ? car.v * MPH : 0;
      if (flash > 0) { g.fillStyle = `rgba(${C.ice},${flash})`; g.fillRect(0, 0, W, H); }
      // time circuits
      const rows = [['DESTINATION TIME', dest, RED], ['PRESENT TIME', present, C.neon], ['LAST TIME DEPARTED', last, C.gold]];
      rows.forEach(([lab, val, col], i) => {
        const y = H - (40 + (2 - i) * 62) * s;
        g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.6)`; g.fillText(lab, 28 * s, y - 26 * s);
        g.font = `bold ${26 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${col},0.95)`; g.fillText(val, 28 * s, y);
      });
      // the speedo
      g.font = `bold ${64 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${mph > 80 ? C.white : RED},0.95)`;
      const sp = String(Math.round(mph)).padStart(2, '0'), wsp = g.measureText(sp).width;
      g.fillText(sp, W - 120 * s - wsp, H - 40 * s);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.7)`; g.fillText('MPH', W - 105 * s, H - 44 * s);
      // the flux capacitor: a Y of three tubes, light chasing in faster as the speed climbs
      const cx = W - 110 * s, cy = 110 * s, r = 70 * s, beat = env.t * (1 + mph / 10);
      g.strokeStyle = `rgba(${C.white},0.5)`; g.lineWidth = 1.5; g.strokeRect(cx - r - 10 * s, cy - r - 10 * s, (r + 10 * s) * 2, (r + 10 * s) * 2);
      for (const a of [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI / 2]) {
        const ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
        g.strokeStyle = `rgba(${C.ice},0.35)`; g.beginPath(); g.moveTo(ex, ey); g.lineTo(cx, cy); g.stroke();
        for (let j = 0; j < 4; j++) {
          const f = 1 - ((beat + j / 4) % 1), px = cx + (ex - cx) * f, py = cy + (ey - cy) * f;
          g.fillStyle = `rgba(${mph > 80 ? C.white : C.ice},${0.4 + 0.6 * (1 - f)})`; g.fillRect(px - 3 * s, py - 3 * s, 6 * s, 6 * s);
        }
      }
      g.font = `${11 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.85)`;
      const cap = mph > 80 || phase === 'gone' && pt < 1 ? '1.21 GIGAWATTS' : 'FLUX CAPACITOR';
      g.fillText(cap, cx - g.measureText(cap).width / 2, cy + r + 30 * s);
      g.font = `bold ${16 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText(fly ? 'ROADS? WHERE WE\'RE GOING...' : 'GREAT SCOTT', 28 * s, 40 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
