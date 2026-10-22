// COLONY: a duel in the shadow of a space colony. The cylinder hangs across the sky, turning
// slowly, its three window strips and their mirrors catching the light, the land strips faint
// inside. A white suit with a beam rifle and a mono-eye enemy circle each other on thruster
// trails, trading beam shots and closing now and then for a saber clash. When the enemy goes
// down another comes. Sometimes, a flash of insight: lines radiating across the sky.
// Activity is the pace of the fight; a commit is a flash.
(function (Worlds) {
  Worlds.define('gundam', (k) => {
    const { C, rand, env, seg, setCam, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 600;
    const CO = [-10, 46, 210], CL = 380, CR = 30, TILT = 0.22; // the colony: centre, length, radius, tilt
    let rot = 0, beams = [], bits = [], down = 0, flash = 0, flashT = rand(18, 30), clash = 0, hp = 6, tA = 0;
    const A = { x: -8, y: 0, z: 40, tr: [] }, B = { x: 8, y: 2, z: 48, tr: [], eye: 0 };

    function colonyPt(u, a, r) { // u along the axis (-.5..+.5), a angle round it, r radius
      const x = u * CL, y = Math.cos(a) * r, z = Math.sin(a) * r, c = Math.cos(TILT), s = Math.sin(TILT);
      return [CO[0] + x * c - y * s, CO[1] + x * s + y * c, CO[2] + z];
    }
    function colony() {
      for (let i = 0; i < 12; i++) { // long edges; every other pair is a window strip
        const a = rot + i * Math.PI / 6, win = i % 4 < 2;
        const p = colonyPt(-0.5, a, CR), q = colonyPt(0.5, a, CR);
        seg(...p, ...q, win ? C.ice : C.white, win ? 0.55 : 0.3, FOG);
        if (i % 4 === 0) { // its mirror, hinged at the far end, open to the sun
          const m0 = colonyPt(0.5, a + 0.26, CR), m1 = colonyPt(0.08, a + 0.26, CR * 2.4);
          seg(...m0, ...m1, C.gold, 0.4, FOG);
          const l0 = colonyPt(-0.45, a + 0.75, CR * 0.95), l1 = colonyPt(0.45, a + 0.75, CR * 0.95);
          seg(...l0, ...l1, C.neon, 0.15, FOG); // a land strip, seen through the glass
        }
      }
      for (let u = -0.5; u <= 0.501; u += 0.125) { let p = colonyPt(u, rot, CR); for (let j = 1; j <= 16; j++) { const q = colonyPt(u, rot + j * Math.PI / 8, CR); seg(...p, ...q, C.white, u === -0.5 || u > 0.49 ? 0.5 : 0.18, FOG); p = q; } }
    }
    // a mobile suit, built from a few boxes and lines; faces yaw. kind 'v': white, V-fin; 'mono': the enemy
    function suit(m, yaw, col, kind, aim) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), sw = Math.sin(env.t * 2 + (kind === 'v' ? 0 : 2)) * 0.25;
      const P = (x, y, z) => [m.x + x * cy + z * sy, m.y + y, m.z - x * sy + z * cy];
      const L = (a, b, c, al) => seg(...P(...a), ...P(...b), c || col, al || 0.95, FOG);
      const quad = (a, b, c, d, cc) => { L(a, b, cc); L(b, c, cc); L(c, d, cc); L(d, a, cc); };
      quad([-0.8, 0, 0], [0.8, 0, 0], [0.9, 1.6, 0], [-0.9, 1.6, 0]); quad([-0.8, 0, -0.5], [0.8, 0, -0.5], [0.9, 1.6, -0.5], [-0.9, 1.6, -0.5]);
      L([-0.9, 1.6, 0], [-0.9, 1.6, -0.5]); L([0.9, 1.6, 0], [0.9, 1.6, -0.5]);
      quad([-0.35, 1.7, 0.1], [0.35, 1.7, 0.1], [0.35, 2.3, 0.1], [-0.35, 2.3, 0.1]); // head
      if (kind === 'v') { L([0, 2.15, 0.12], [-0.6, 2.7, 0.12], C.gold); L([0, 2.15, 0.12], [0.6, 2.7, 0.12], C.gold); }
      else { ring(...P(0, 2.0, 0.1), 0.42, 10, col, 0.9, FOG, 'xy'); L([-0.3 + m.eye * 0.6, 2.0, 0.15], [-0.2 + m.eye * 0.6, 2.0, 0.15], C.hot, 1); }
      for (const sx of [-1, 1]) {
        L([sx * 0.9, 1.5, -0.25], [sx * 1.4, 1.5, -0.25]); // shoulder
        L([sx * 1.4, 1.5, -0.25], [sx * 1.5, 0.6, 0.2 + sw * sx]); L([sx * 1.5, 0.6, 0.2 + sw * sx], [sx * 1.5, 0.1, 0.9]); // arm
        L([sx * 0.4, 0, -0.25], [sx * 0.5, -1.2, 0.2 - sw * sx]); L([sx * 0.5, -1.2, 0.2 - sw * sx], [sx * 0.5, -2.4, -0.1]); // leg
        L([sx * 0.5, -2.4, -0.1], [sx * 0.5, -2.5, 0.4]);
        L([sx * 0.4, 1.3, -0.5], [sx * 0.4, 0.6, -1.2], C.ice, 0.6); L([sx * 0.4, 0.6, -1.2], [sx * 0.4, 0.2 + rand(-0.2, 0), -1.9], C.hot, 0.5 + env.pulse * 0.5); // backpack burner
      }
      if (aim) L([1.5, 0.1, 0.9], [1.5, 0.1, 2.6], kind === 'v' ? C.white : col); // rifle
    }
    function trail(m, col) { for (let i = 1; i < m.tr.length; i++) seg(...m.tr[i - 1], ...m.tr[i], col, i / m.tr.length * 0.6, FOG); }
    function boom(x, y, z, n) { for (let i = 0; i < n; i++) bits.push({ x, y, z, vx: rand(-12, 12), vy: rand(-12, 12), vz: rand(-12, 12), t: rand(0.5, 1.3) }); }

    return {
      label: 'COLONY',
      signal(kind) { if (kind === 'commit') flash = 1; if (kind === 'ok') tA += 1; },
      update(dt) {
        const sp = 0.5 + env.level;
        rot += dt * 0.05; tA += dt * sp * 0.6; flash = Math.max(0, flash - dt * 0.8); clash = Math.max(0, clash - dt * 2);
        flashT -= dt; if (flashT < 0) { flash = 1; flashT = rand(18, 30); }
        const close = (Math.sin(tA * 0.4) + 1) / 2 > 0.9; // now and then they close to saber range
        const r = close ? 3 : 12;
        A.x = Math.cos(tA) * r - 2; A.y = Math.sin(tA * 0.7) * 4; A.z = 32 + Math.sin(tA) * r * 0.6;
        B.x = Math.cos(tA + Math.PI) * r - 2; B.y = -Math.sin(tA * 0.7) * 4 + 1; B.z = 32 + Math.sin(tA + Math.PI) * r * 0.6;
        B.eye = (Math.sin(env.t * 2.5) + 1) / 2;
        for (const m of [A, B]) { m.tr.push([m.x, m.y + 0.6, m.z - 1]); if (m.tr.length > 40) m.tr.shift(); }
        if (close && clash === 0 && Math.random() < dt * 2) { clash = 1; boom((A.x + B.x) / 2, (A.y + B.y) / 2 + 1, (A.z + B.z) / 2, 10); }
        if (!close && Math.random() < dt * (0.8 + env.level * 2.5)) { // a beam shot, either way
          const mine = Math.random() < 0.6, s = mine ? A : B, d = mine ? B : A, hit = Math.random() < 0.35;
          beams.push({ a: [s.x + 1.5, s.y + 0.1, s.z + 1], b: [d.x + (hit ? 0 : rand(-4, 4)), d.y + (hit ? 1 : rand(-4, 4)), d.z], t: 0.25, col: mine ? C.gold : C.hot });
          if (mine && hit && --hp <= 0) { boom(B.x, B.y + 1, B.z, 30); down++; hp = 6; tA += Math.PI; B.tr = []; }
        }
        for (const b of beams) b.t -= dt;
        beams = beams.filter((b) => b.t > 0);
        for (const p of bits) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.t -= dt; }
        bits = bits.filter((p) => p.t > 0);
      },
      draw() {
        const t = env.t;
        setCam({ x: Math.sin(t * 0.07) * 4, y: 3 + Math.sin(t * 0.05) * 2, z: 10, yaw: Math.sin(t * 0.06) * 0.08, pitch: 0.08 });
        colony();
        // the Earth's limb, low and huge
        let p = null;
        for (let a = -0.9; a <= 0.9; a += 0.06) { const q = [Math.sin(a) * 900 - 200, Math.cos(a) * 900 - 1020, 600]; if (p) seg(...p, ...q, C.ice, 0.5, 1200); p = q; }
        trail(A, C.ice); trail(B, C.hot);
        suit(A, Math.atan2(B.x - A.x, B.z - A.z), C.white, 'v', true);
        suit(B, Math.atan2(A.x - B.x, A.z - B.z), C.neon, 'mono', true);
        for (const b of beams) { seg(...b.a, ...b.b, b.col, 1, FOG); seg(b.a[0], b.a[1] + 0.1, b.a[2], b.b[0], b.b[1] + 0.1, b.b[2], C.white, 0.7, FOG); }
        if (clash > 0) { const m = [(A.x + B.x) / 2, (A.y + B.y) / 2 + 1, (A.z + B.z) / 2]; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; seg(...m, m[0] + Math.cos(a) * 4 * clash, m[1] + Math.sin(a) * 4 * clash, m[2], i % 2 ? C.hot : C.gold, clash, FOG); } }
        for (const q of bits) seg(q.x, q.y, q.z, q.x + q.vx * 0.04, q.y + q.vy * 0.04, q.z + q.vz * 0.04, C.gold, Math.min(1, q.t * 2), FOG);
        hud();
      },
    };
    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      if (flash > 0) { // the flash: lines radiating from a point in the sky
        const cx = W * 0.82, cy = H * 0.22;
        g.lineWidth = 1.5; g.strokeStyle = `rgba(${C.ice},${flash})`; g.beginPath();
        for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + i * 0.3, r0 = 20 * s, r1 = (120 + (i % 3) * 140) * s * (1.2 - flash * 0.4); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
        g.stroke();
        g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},${flash})`; const m = 'NEWTYPE FLASH'; g.fillText(m, W - 28 * s - g.measureText(m).width, H - 40 * s);
      }
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('U.C. 0079', 28 * s, 34 * s);
      g.font = `${13 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.white},0.75)`;
      g.fillText(`ENEMY SUITS DOWN ${String(down).padStart(3, '0')}`, 28 * s, 56 * s);
      g.fillText(`TARGET ARMOUR ${'#'.repeat(hp).padEnd(6, '.')}`, 28 * s, 76 * s);
      const r = 'SIDE 7  ::  SHADOW OF THE COLONY'; g.fillStyle = `rgba(${C.ice},0.8)`; g.fillText(r, W - 28 * s - g.measureText(r).width, 34 * s);
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
