// Cracktro furniture: the copper-bar logo, the sine scroller, Matrix rain that
// flickers in now and then, and the cigarette that burns while you compile.
(function (root) {
  let logo, lg, sc, sg, rain, rg, smoke, smg, src;
  const off = document.createElement('canvas'), og = off.getContext('2d');
  let scrollX = 0, cols = [], smokeP = [], cig = { lit: false, burn: 0, glow: 0, life: 0, ash: 0 };
  let t = 0, last = 0;

  function fit(c) { const r = c.getBoundingClientRect(); if (c.width !== (r.width | 0) || c.height !== (r.height | 0)) { c.width = r.width | 0; c.height = r.height | 0; } }

  function drawLogo(e) {
    fit(logo); const W = logo.width, H = logo.height; if (!W) return;
    lg.clearRect(0, 0, W, H);
    // raster bars behind everything
    for (let i = 0; i < 7; i++) {
      const y = H / 2 + Math.sin(t * 1.7 + i * 0.6) * H * 0.38, hue = (i * 40 + t * 30) % 360;
      const gr = lg.createLinearGradient(0, y - 4, 0, y + 4);
      gr.addColorStop(0, 'transparent'); gr.addColorStop(0.5, `hsla(${hue},100%,60%,0.35)`); gr.addColorStop(1, 'transparent');
      lg.fillStyle = gr; lg.fillRect(0, y - 4, W, 8);
    }
    // the title, filled with copper bars, letters bouncing on the kick
    off.width = W; off.height = H;
    const word = 'GIBSON', size = Math.min(46, H * 0.8);
    og.font = `900 ${size}px 'Arial Black', Impact, sans-serif`; og.textBaseline = 'middle';
    const x0 = 18, gap = size * 0.18; let x = x0;
    og.fillStyle = '#fff';
    for (let i = 0; i < word.length; i++) { og.fillText(word[i], x, H / 2 + Math.sin(t * 4 + i * 0.8) * 3 - e.pulse * 5 * ((i % 2) ? 1 : -1)); x += og.measureText(word[i]).width + gap; }
    og.globalCompositeOperation = 'source-atop';
    for (let y = 0; y < H; y += 2) { const h = (y * 4 + t * 120) % 360; og.fillStyle = `hsl(${(h + 160) % 360},100%,${55 + Math.sin(y * 0.3 + t * 6) * 15}%)`; og.fillRect(0, y, W, 2); }
    og.globalCompositeOperation = 'source-over';
    lg.shadowColor = '#ff2e88'; lg.shadowBlur = 10 + e.pulse * 18; lg.drawImage(off, 0, 0); lg.shadowBlur = 0;
    lg.font = "11px 'Cascadia Mono', Consolas, monospace"; lg.fillStyle = 'rgba(54,214,255,0.85)';
    const tag = '// CRACKED BY NYX  ::  TRAINED +∞  ::  1997-2026';
    if (x + 14 + lg.measureText(tag).width < W - 230) lg.fillText(tag, x + 14, H / 2 + 4);
  }

  function drawScroller(e) {
    fit(sc); const W = sc.width, H = sc.height; if (!W) return;
    sg.clearRect(0, 0, W, H);
    const msg = e.scroll; sg.font = "bold 18px 'Cascadia Mono', Consolas, monospace"; sg.textBaseline = 'middle';
    const cw = 13, total = msg.length * cw;
    scrollX = (scrollX + (90 + e.level * 260) * e.dt) % (total + W);
    for (let i = 0; i < msg.length; i++) {
      const x = W - scrollX + i * cw; if (x < -cw || x > W) continue;
      const y = H / 2 + Math.sin(x * 0.018 + t * 3) * (H * 0.28);
      sg.fillStyle = `hsl(${(x * 0.4 + t * 60) % 360},100%,65%)`; sg.fillText(msg[i], x, y);
    }
  }

  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ABCDEF<>/\\#$%';
  function drawRain() {
    if (!rain.classList.contains('on')) return;
    fit(rain); const W = rain.width, H = rain.height, fs = 16;
    const n = Math.ceil(W / fs); if (cols.length !== n) cols = Array.from({ length: n }, () => Math.random() * H / fs);
    rg.fillStyle = 'rgba(0,0,0,0.12)'; rg.fillRect(0, 0, W, H);
    rg.font = `${fs}px monospace`;
    for (let i = 0; i < n; i++) {
      const y = cols[i] * fs; rg.fillStyle = Math.random() < 0.05 ? '#d8ffe8' : '#39ff9c';
      rg.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * fs, y);
      cols[i] = y > H && Math.random() > 0.96 ? 0 : cols[i] + 1;
    }
  }

  // ponytail: the cigarette is drawn, not sprited. A pixel-art sheet would look
  // better; this keeps the repo asset-free.
  function drawSmoke(e) {
    fit(smoke); const W = smoke.width, H = smoke.height; smg.clearRect(0, 0, W, H);
    if (e.smoking && !cig.lit) { cig = { lit: true, burn: 0, glow: 1, life: 1, ash: 0 }; }
    if (!cig.lit) return;
    cig.burn = Math.min(1, cig.burn + e.dt / (e.smoking ? 120 : 400));
    cig.life = e.smoking ? 1 : Math.max(0, cig.life - e.dt / 25);
    if (cig.burn >= 1 || cig.life <= 0) { cig.lit = false; return; }
    const x = W - 210, y = H - 46, len = 120 * (1 - cig.burn) + 26;
    smg.globalAlpha = Math.min(1, cig.life * 3);
    // ashtray
    smg.strokeStyle = 'rgba(54,214,255,0.7)'; smg.lineWidth = 1.2;
    smg.beginPath(); smg.ellipse(x + 60, y + 14, 90, 18, 0, 0, Math.PI * 2); smg.stroke();
    smg.beginPath(); smg.ellipse(x + 60, y + 14, 70, 11, 0, 0, Math.PI * 2); smg.stroke();
    // filter, paper, ash, ember
    smg.fillStyle = '#c8803a'; smg.fillRect(x - 6, y - 2, 26, 9);
    smg.fillStyle = '#eee'; smg.fillRect(x + 20, y - 2, len - 26, 9);
    const tip = x + len - 6; cig.ash = Math.min(14, cig.ash + e.dt * 0.6);
    smg.fillStyle = '#777'; smg.fillRect(tip, y - 2, cig.ash, 9);
    if (cig.ash >= 14 && Math.random() < 0.004) cig.ash = 0; // tap
    const glow = 0.6 + Math.sin(t * 2.3) * 0.2 + e.pulse * 0.3;
    smg.fillStyle = `rgba(255,${80 + glow * 60},20,${glow})`; smg.shadowColor = '#ff5a14'; smg.shadowBlur = 14 * glow;
    smg.fillRect(tip + cig.ash, y - 2, 4, 9); smg.shadowBlur = 0;
    if (Math.random() < 0.5) smokeP.push({ x: tip + cig.ash + 2, y: y - 2, r: 2, a: 0.35, s: Math.random() * 6 });
    for (const p of smokeP) {
      p.y -= 22 * e.dt; p.r += 7 * e.dt; p.a -= 0.07 * e.dt; p.x += Math.sin(t * 1.3 + p.s + p.y * 0.04) * 18 * e.dt;
      smg.fillStyle = `rgba(190,200,210,${Math.max(0, p.a) * cig.life})`; smg.beginPath(); smg.arc(p.x, p.y, p.r, 0, Math.PI * 2); smg.fill();
    }
    smokeP = smokeP.filter((p) => p.a > 0 && p.y > -40);
    smg.globalAlpha = 1;
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; t += dt;
    const e = { ...src(), dt };
    drawLogo(e); drawScroller(e); drawRain(); drawSmoke(e);
    requestAnimationFrame(frame);
  }

  root.Fx = {
    start(els, source) {
      ({ logo, scroller: sc, rain, smoke } = els); src = source;
      lg = logo.getContext('2d'); sg = sc.getContext('2d'); rg = rain.getContext('2d'); smg = smoke.getContext('2d');
      requestAnimationFrame(frame);
    },
    rain(sec) { rain.classList.add('on'); clearTimeout(this._r); this._r = setTimeout(() => rain.classList.remove('on'), sec * 1000); },
    smoking: () => cig.lit,
  };
})(this);
