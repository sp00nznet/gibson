// FLYING TOASTERS: a homage to the 90s screensaver, in wireframe. Chrome toasters flap their
// way diagonally across the screen (upper right to lower left) among slices of toast, some
// golden, some burnt. Wings beat faster when you are busy; the formation keeps coming.
(function (Worlds) {
  Worlds.define('toasters', (k) => {
    const { C, rand, env, seg, setCam } = k;
    // Flyers live in screen units (nx, ny: -1..1 is the visible width/height at their depth), so
    // they cover the whole screen, margins included, whatever their distance.
    let fleet = [];
    const spawn = (scatter) => {
      const toast = Math.random() < 0.3, z = rand(30, 75), f = { toast, burnt: toast && Math.random() < 0.3, z, ph: rand(0, 6.3), spin: rand(-0.4, 0.4), s: rand(1.5, 2.1) };
      if (scatter) { f.nx = rand(-1.2, 1.3); f.ny = rand(-1.2, 1.3); }
      else if (Math.random() < 0.6) { f.nx = rand(-0.6, 1.3); f.ny = 1.3; } else { f.nx = 1.35; f.ny = rand(-0.8, 1.3); } // enter top or right
      return f;
    };
    for (let i = 0; i < 15; i++) fleet.push(spawn(true));
    const pos = (f) => [f.nx * f.z * k.W / 2 / k.F, f.ny * f.z * k.H / 2 / k.F, f.z];

    // A box from 8 corners, x/y/z half-sizes, with a slight lean.
    function block(x, y, z, hx, hy, hz, col, a, lean) {
      const P = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) P.push([x + sx * hx + sy * lean, y + sy * hy, z + sz * hz]);
      for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) seg(...P[i], ...P[j], col, a, 200);
    }
    function toaster(f, x, y, z) {
      const s = f.s, flap = Math.sin(env.t * (5 + env.level * 4) + f.ph); // -1..1
      block(x, y, z, 2.2 * s, 1.5 * s, 1.3 * s, C.ice, 0.95, 0.15 * s);               // body
      seg(x - 2.2 * s, y + 1.5 * s, z, x + 2.2 * s, y + 1.5 * s, z, C.ice, 0.6, 200); // seam
      for (const dz of [-0.45, 0.45]) {                                              // the two slots
        seg(x - 1.4 * s, y + 1.5 * s, z + dz * s, x + 1.4 * s, y + 1.5 * s, z + dz * s, C.white, 0.8, 200);
      }
      seg(x + 2.2 * s, y + 0.6 * s, z, x + 2.8 * s, y + 0.6 * s, z, C.gold, 1, 200);  // lever
      seg(x - 2.2 * s, y - 0.5 * s, z - 0.6 * s, x - 2.2 * s, y + 0.3 * s, z - 0.6 * s, C.hot, 0.8, 200); // dial
      // Wings: three feathered spars per side, root on the body's back edge, tips flapping in y.
      for (const side of [-1, 1]) {
        const rx = x - 0.4 * s, ry = y + 0.8 * s, rz = z + side * 1.3 * s;
        let prev = null;
        for (let i = 0; i < 3; i++) {
          const len = (3.8 - i * 0.8) * s, tip = [rx + i * 0.7 * s - 1.4 * s, ry + flap * len * 0.8 + 0.4 * s, rz + side * len * (1 - Math.abs(flap) * 0.35)];
          seg(rx + i * 0.7 * s, ry, rz, ...tip, C.white, 1, 200);
          if (prev) seg(...prev, ...tip, C.white, 0.7, 200); // the trailing edge joins the feathers
          prev = tip;
        }
        seg(rx, ry, rz, rx + 1.4 * s, ry, rz, C.white, 0.7, 200);
      }
    }
    function toast(f, x, y, z) {
      const s = f.s, col = f.burnt ? C.hot : C.gold, a = env.t * f.spin * 3 + f.ph;
      const ca = Math.cos(a), sa = Math.sin(a);
      // A slice: a rounded-top outline (crust) and an inner one, in the plane facing us, slowly spinning.
      const out = [[-1.3, -1.4], [1.3, -1.4], [1.3, 0.8], [1.0, 1.4], [0.4, 1.7], [-0.4, 1.7], [-1.0, 1.4], [-1.3, 0.8]];
      for (const [r, al] of [[1, 0.95], [0.78, 0.5]]) {
        for (let i = 0; i < out.length; i++) {
          const p = out[i], q = out[(i + 1) % out.length];
          seg(x + (p[0] * ca) * r * s, y + p[1] * r * s, z + p[0] * sa * r * s, x + (q[0] * ca) * r * s, y + q[1] * r * s, z + q[0] * sa * r * s, col, al, 200);
        }
      }
    }
    return {
      label: 'FLYING TOASTERS',
      update(dt) {
        const v = (0.045 + env.level * 0.045) * dt; // screen-widths per second, down and to the left
        for (const f of fleet) { const m = f.toast ? 0.85 : 1; f.nx -= v * m; f.ny -= v * m * 0.62; }
        fleet = fleet.map((f) => (f.nx < -1.4 || f.ny < -1.4 ? spawn(false) : f));
      },
      draw() {
        setCam({ x: 0, y: 0, z: 0, yaw: Math.sin(env.t * 0.05) * 0.04, pitch: 0 });
        fleet.sort((a, b) => b.z - a.z); // far ones first
        for (const f of fleet) {
          const [x, y, z] = pos(f);
          if (f.toast) toast(f, x, y, z); else toaster(f, x, y, z);
        }
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
