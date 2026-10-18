// MANHATTAN 1995: on a Brooklyn rooftop at night, looking over the river. The skyline with its
// windows going on and off, a suspension bridge with traffic crossing, everything wobbling in
// the water, a helicopter sweeping its searchlight, and a water tower on your roof.
(function (Worlds) {
  Worlds.define('skyline', (k) => {
    const { C, rand, pick, env, seg, ring, setCam, text3 } = k;
    const Z = 140, RIVER = 0; // the skyline stands on the far bank; the river is the plane y=0
    const blds = []; let x = -150;
    while (x < 150) {
      const w = rand(5, 13), mid = Math.abs(x) < 50, h = rand(15, 45) * (mid ? 1.8 : 1) + (Math.random() < 0.08 ? 50 : 0);
      blds.push({ x: x + w / 2, w, h, z: Z + rand(-6, 10), spire: Math.random() < 0.15, seed: rand(0, 99), col: pick([C.ice, C.violet, C.ice]) });
      x += w + rand(0.5, 2);
    }
    const B0 = -110, B1 = -30, BY = 14, BZ = Z - 40; // the bridge, its towers at B0 and B1
    const cars = Array.from({ length: 14 }, () => ({ u: Math.random(), v: rand(0.03, 0.06) * pick([-1, 1]) }));
    let heli = 0;

    // A line on the far bank and its reflection, broken up by ripples.
    function both(ax, ay, az, bx, by, bz, col, a) {
      seg(ax, ay, az, bx, by, bz, col, a, 600);
      if (ay < 0.1 && by < 0.1) return;
      const wob = Math.sin(env.t * 2 + ay * 0.5 + ax) * 0.6;
      seg(ax + wob, -ay, az, bx + wob, -by, bz, col, a * 0.25, 600);
    }

    return {
      label: 'MANHATTAN 1995',
      update(dt) { for (const c of cars) c.u = (c.u + c.v * dt + 1) % 1; heli += dt * 0.15; },
      draw() {
        const t = env.t;
        setCam({ x: Math.sin(t * 0.05) * 4, y: 12, z: 0, yaw: Math.sin(t * 0.04) * 0.3, pitch: 0.12 });
        ring(-90, 95, Z + 120, 9, 24, C.white, 0.6, 900, 'xy'); // the moon
        for (const b of blds) {
          const l = b.x - b.w / 2, r = b.x + b.w / 2, h = b.h;
          both(l, 0, b.z, l, h, b.z, b.col, 0.6); both(r, 0, b.z, r, h, b.z, b.col, 0.6); both(l, h, b.z, r, h, b.z, b.col, 0.7);
          if (b.spire) { both(b.x - 1, h, b.z, b.x, h + 14, b.z, b.col, 0.7); both(b.x + 1, h, b.z, b.x, h + 14, b.z, b.col, 0.7); seg(b.x, h + 14, b.z, b.x, h + 15, b.z, C.hot, Math.sin(t * 3 + b.seed) > 0 ? 1 : 0.1, 600); }
          // windows: a dot each, some on, a few changing every couple of seconds
          for (let y = 2; y < h - 1; y += 3) for (let wx = l + 1; wx < r - 0.8; wx += 2) {
            const on = Math.sin(b.seed * 13 + y * 3.7 + wx * 5.3 + Math.floor(t * 0.3 + Math.sin(wx * y) * 3) * 1.9) > 0.35;
            if (on) both(wx, y, b.z, wx + 0.5, y, b.z, C.gold, 0.55);
          }
        }
        // the bridge: two towers, the deck, the main cable sagging between them
        for (const bx of [B0, B1]) { both(bx - 2, 0, BZ, bx - 2, 30, BZ, C.white, 0.6); both(bx + 2, 0, BZ, bx + 2, 30, BZ, C.white, 0.6); both(bx - 2, 30, BZ, bx + 2, 30, BZ, C.white, 0.6); }
        both(B0 - 60, BY, BZ, B1 + 60, BY, BZ, C.white, 0.5);
        const cable = (u) => [B0 + (B1 - B0) * u, BY + 16 * Math.pow(2 * u - 1, 2)];
        for (let i = 0; i < 20; i++) {
          const [x0, y0] = cable(i / 20), [x1, y1] = cable((i + 1) / 20);
          both(x0, y0, BZ, x1, y1, BZ, C.ice, 0.7); if (i % 2 === 0) both(x0, y0, BZ, x0, BY, BZ, C.ice, 0.25); // suspenders
        }
        both(B0 - 60, BY + 16, BZ, B0, 30, BZ, C.ice, 0.6); both(B1, 30, BZ, B1 + 60, BY + 16, BZ, C.ice, 0.6);
        for (const c of cars) { const cx = B0 - 60 + c.u * (B1 - B0 + 120); both(cx, BY + 0.6, BZ, cx + 1, BY + 0.6, BZ, c.v > 0 ? C.white : C.hot, 1); }
        // the river: dark ripples catching the light
        for (let i = 0; i < 40; i++) { const z = 20 + i * 3, w = Math.sin(i * 1.7 + t) * 6; seg(-30 + w + Math.sin(i) * 40, 0, z, -26 + w + Math.sin(i) * 40, 0, z, C.ice, 0.2, 300); }
        // the helicopter and its searchlight, sweeping the water
        const hx = Math.sin(heli) * 70, hy = 55, hz = Z - 50 + Math.cos(heli * 0.7) * 20;
        seg(hx - 2, hy, hz, hx + 2, hy, hz, C.white, 0.8, 600); seg(hx - 3, hy + 0.8, hz, hx + 3, hy + 0.8, hz, C.white, Math.abs(Math.sin(t * 30)), 600);
        seg(hx, hy + 0.2, hz, hx, hy + 0.2, hz, C.hot, Math.sin(t * 5) > 0 ? 1 : 0, 600);
        const sx = hx + Math.sin(t * 0.6) * 25, sz = hz - 30 + Math.cos(t * 0.4) * 15;
        for (let i = -1; i <= 1; i++) seg(hx, hy, hz, sx + i * 3, 0, sz, C.white, 0.15, 600);
        ring(sx, 0, sz, 4, 16, C.white, 0.35, 600);
        // the rooftop: a ledge, a water tower, a payphone
        seg(-30, 9, 8, 30, 9, 8, C.violet, 0.8, 60);
        const wt = [-18, 9, 14];
        for (const [dx, dz] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) seg(wt[0] + dx, wt[1], wt[2] + dz, wt[0] + dx * 0.8, wt[1] + 5, wt[2] + dz * 0.8, C.violet, 0.6, 80);
        ring(wt[0], wt[1] + 5, wt[2], 2.6, 12, C.violet, 0.6, 80); ring(wt[0], wt[1] + 9, wt[2], 2.6, 12, C.violet, 0.6, 80);
        seg(wt[0] - 2.6, wt[1] + 5, wt[2], wt[0] - 2.6, wt[1] + 9, wt[2], C.violet, 0.6, 80); seg(wt[0] + 2.6, wt[1] + 5, wt[2], wt[0] + 2.6, wt[1] + 9, wt[2], C.violet, 0.6, 80);
        seg(wt[0] - 2.8, wt[1] + 9, wt[2], wt[0], wt[1] + 11, wt[2], C.violet, 0.6, 80); seg(wt[0], wt[1] + 11, wt[2], wt[0] + 2.8, wt[1] + 9, wt[2], C.violet, 0.6, 80);
        text3('BROOKLYN  12:31 AM', -6, 9.6, 8.1, C.neon, 0.35, 0.8);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
