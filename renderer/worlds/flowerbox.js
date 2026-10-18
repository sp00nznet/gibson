// 3D FLOWERBOX: the old OpenGL saver's cube, as a wire mesh. It tumbles on every axis while it
// morphs, cube to sphere to spiky flower and back, one colour per face. It wanders a wide figure
// eight across the screen with echoes trailing behind it; a smaller twin mirrors it on the other
// side, so one of them is usually out in a margin.
(function (Worlds) {
  Worlds.define('flowerbox', (k) => {
    const { C, env, seg, setCam } = k;
    const FOG = 260, PAL = [C.neon, C.hot, C.ice, C.gold, C.violet, C.white];
    // faces: [normal axis, sign]; the two tangent axes are the other two
    const FACES = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
    function rot(p, ax, ay, az) {
      let [x, y, z] = p, c = Math.cos(ax), s = Math.sin(ax), t;
      t = y * c - z * s; z = y * s + z * c; y = t;
      c = Math.cos(ay); s = Math.sin(ay); t = x * c + z * s; z = -x * s + z * c; x = t;
      c = Math.cos(az); s = Math.sin(az); t = x * c - y * s; y = x * s + y * c; x = t;
      return [x, y, z];
    }
    // the shape at time t: grid point (a, b) on a face -> point on the morphing surface
    function surf(f, a, b, t) {
      const p = [0, 0, 0], n = f[0]; p[n] = f[1]; p[(n + 1) % 3] = a; p[(n + 2) % 3] = b;
      const l = Math.hypot(p[0], p[1], p[2]), m = 0.5 - 0.5 * Math.cos(t * 0.45); // 0 cube .. 1 sphere
      const spike = Math.sin(t * 0.31) * 0.55 * Math.pow(Math.max(0, 1 - (a * a + b * b) / 2), 3); // face centres push out (or in)
      const r = (1 - m + m / l) * (1 + spike);
      return [p[0] * r, p[1] * r, p[2] * r];
    }
    function mesh(cx, cy, cz, size, N, t, al, hue) {
      const ax = t * 0.5, ay = t * 0.7, az = t * 0.3;
      FACES.forEach((f, fi) => {
        const col = PAL[(fi + hue) % 6], P = [];
        for (let i = 0; i <= N; i++) { const row = []; for (let j = 0; j <= N; j++) { const q = rot(surf(f, -1 + 2 * i / N, -1 + 2 * j / N, t), ax, ay, az); row.push([cx + q[0] * size, cy + q[1] * size, cz + q[2] * size]); } P.push(row); }
        for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { seg(...P[i][j], ...P[i][j + 1], col, al, FOG); seg(...P[j][i], ...P[j + 1][i], col, al, FOG); }
      });
    }
    const path = (t) => [Math.sin(t * 0.21) * 38, Math.sin(t * 0.42) * 11, 64 + Math.sin(t * 0.13) * 10];
    let tt = 0;
    return {
      label: '3D FLOWERBOX',
      update(dt) { tt += dt * (1 + env.level * 1.5 + env.warp); },
      draw() {
        setCam({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
        // a faint floor grid far below, for depth
        for (let x = -120; x <= 120; x += 12) seg(x, -30, 20, x, -30, 200, C.violet, 0.22, FOG);
        for (let z = 20 + (12 - (tt * 6) % 12); z <= 200; z += 12) seg(-120, -30, z, 120, -30, z, C.violet, 0.22, FOG);
        const hue = Math.floor(tt / 6);
        for (let e = 3; e >= 0; e--) { // echoes along the path, oldest and dimmest first
          const t = tt - e * 0.35, p = path(t);
          mesh(p[0], p[1], p[2], 13 + env.pulse * 1.5, 7, t, e ? 0.42 - e * 0.1 : 0.95, hue);
        }
        const p = path(tt);
        mesh(-p[0], -p[1] * 0.8, p[2] + 8, 7, 5, tt * 1.3 + 4, 0.75, hue + 3);
      },
    };
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
