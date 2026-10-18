// MILKDROP: three Winamp-visualizer presets. Each frame the last one is warped back into itself
// (zoom, spin, drift, a hue shift) and a fresh waveform is drawn on top, so shapes smear into
// tunnels and flowers. They follow the jukebox's spectrum; with the synth playing (no analyser)
// the beat pulse and your activity stand in for it.
(function (Worlds) {
  const N = 48;
  let fb = null, fg, tmp, tg; // the feedback buffer, half size: cheaper, and softer like the real thing
  function buffers(W, H) {
    const w = Math.max(2, W >> 1), h = Math.max(2, H >> 1);
    if (fb && fb.width === w && fb.height === h) return;
    fb = document.createElement('canvas'); fb.width = w; fb.height = h; fg = fb.getContext('2d');
    tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tg = tmp.getContext('2d');
  }
  const spec = new Float32Array(N);
  function spectrum(env) {
    if (env.spec && env.spec.some((v) => v > 0)) { for (let i = 0; i < N; i++) spec[i] = env.spec[Math.floor(i * env.spec.length / N)]; return spec; }
    for (let i = 0; i < N; i++) { // stand-in: bass on the beat, the rest from how busy you are
      const f = i / N, wob = 0.5 + 0.5 * Math.sin(env.t * (2 + f * 7) + i * 1.3);
      spec[i] = Math.min(1, env.pulse * (1 - f) * 1.1 + env.level * 0.5 * wob + 0.08 * wob);
    }
    return spec;
  }
  const bass = (s) => (s[0] + s[1] + s[2] + s[3]) / 4;

  // A preset: warp(t, s) -> { zoom, rot, dx, dy, hue, decay }, wave(g, w, h, t, s, hue).
  function preset(name, label, warp, wave) {
    Worlds.define(name, (k) => {
      const { env } = k;
      let hue = Math.random() * 360;
      return {
        label,
        enter() { buffers(k.W, k.H); fg.fillStyle = '#000'; fg.fillRect(0, 0, fb.width, fb.height); },
        update(dt) { hue = (hue + dt * (20 + env.level * 60)) % 360; },
        draw() {
          buffers(k.W, k.H);
          const w = fb.width, h = fb.height, s = spectrum(env), m = warp(env.t, s, env);
          tg.globalCompositeOperation = 'copy'; tg.drawImage(fb, 0, 0);
          fg.globalCompositeOperation = 'source-over'; fg.filter = 'none'; fg.globalAlpha = 1;
          fg.fillStyle = '#000'; fg.fillRect(0, 0, w, h);
          fg.save();
          fg.translate(w / 2 + m.dx * w, h / 2 + m.dy * h); fg.rotate(m.rot); fg.scale(m.zoom, m.zoom); fg.translate(-w / 2, -h / 2);
          fg.globalAlpha = m.decay; fg.filter = `hue-rotate(${m.hue}deg)`;
          fg.drawImage(tmp, 0, 0);
          fg.restore(); fg.filter = 'none'; fg.globalAlpha = 1;
          fg.globalCompositeOperation = 'lighter'; fg.lineWidth = 1.6;
          wave(fg, w, h, env.t, s, hue, env);
          k.g.drawImage(fb, 0, 0, k.W, k.H);
        },
      };
    });
  }
  const col = (hue, l, a) => `hsla(${hue % 360},100%,${l}%,${a})`;

  // TUNNEL: zooming in, a ring of spectrum spikes; on a kick everything lunges.
  preset('milkdrop', 'MILKDROP // TUNNEL',
    (t, s) => ({ zoom: 1.025 + bass(s) * 0.05, rot: 0.006 * Math.sin(t * 0.3), dx: 0.004 * Math.sin(t * 0.7), dy: 0.004 * Math.cos(t * 0.5), hue: 3, decay: 0.88 }),
    (g, w, h, t, s, hue) => {
      const r = h * (0.16 + bass(s) * 0.08);
      g.beginPath();
      for (let i = 0; i <= N * 2; i++) {
        const a = i / (N * 2) * Math.PI * 2 + t * 0.4, v = s[i % N] * h * 0.12;
        const x = w / 2 + Math.cos(a) * (r + v), y = h / 2 + Math.sin(a) * (r + v);
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.strokeStyle = col(hue, 60, 0.7); g.stroke();
      g.fillStyle = col(hue + 180, 70, 0.6 * bass(s)); g.beginPath(); g.arc(w / 2, h / 2, r * 0.3, 0, 7); g.fill();
    });

  // KALEIDOSCOPE: zooming out and turning, an oscilloscope line mirrored six ways.
  preset('kaleido', 'MILKDROP // KALEIDOSCOPE',
    (t, s) => ({ zoom: 0.975 - bass(s) * 0.02, rot: 0.02 + bass(s) * 0.03, dx: 0, dy: 0, hue: -4, decay: 0.93 }),
    (g, w, h, t, s, hue) => {
      const L = h * 0.42;
      for (let m = 0; m < 6; m++) {
        g.save(); g.translate(w / 2, h / 2); g.rotate(m * Math.PI / 3 + t * 0.15); if (m % 2) g.scale(1, -1);
        g.beginPath();
        for (let i = 0; i < N; i++) {
          const x = i / N * L, y = (Math.sin(i * 0.6 + t * 4) * 0.5 + 0.5) * s[i] * h * 0.14;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.strokeStyle = col(hue + m * 30, 60, 0.8); g.stroke(); g.restore();
      }
    });

  // STARBURST: drifting out from a wandering centre, spokes as long as each band is loud.
  preset('starburst', 'MILKDROP // STARBURST',
    (t, s) => ({ zoom: 1.04 + bass(s) * 0.06, rot: -0.01, dx: 0.01 * Math.sin(t * 0.37), dy: 0.008 * Math.sin(t * 0.29), hue: 6, decay: 0.9 }),
    (g, w, h, t, s, hue) => {
      const cx = w / 2 + Math.sin(t * 0.37) * w * 0.12, cy = h / 2 + Math.sin(t * 0.29) * h * 0.1;
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2 - t * 0.6, r0 = h * 0.03, r1 = r0 + s[i] * h * 0.3;
        g.strokeStyle = col(hue + i * 7, 55 + s[i] * 25, 0.85);
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
      }
      if (bass(s) > 0.6) { g.fillStyle = col(hue, 80, (bass(s) - 0.6) * 0.5); g.fillRect(0, 0, w, h); } // the flash on a big kick
    });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
