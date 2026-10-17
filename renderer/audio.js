// The soundtrack, synthesized live: four-on-the-floor, offbeat bass, a 303-ish
// acid line, and KMFDM-style palm-muted guitar chugs. Tempo and layers follow
// the Activity meter, one 16th step at a time, so a tempo change lands on the grid.
// Also the modem: DTMF dial, answer tone, handshake screech.
(function (root) {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // E minor, industrial: E E G F# (bass roots, MIDI)
  const ROOTS = [28, 28, 31, 30];
  const GUITAR = ['x.xxx.x.xx.x.x..', 'x.x.xxx.x.xxx.x.', 'xxx.x.xxx.x.x.xx'];
  const ACID_SCALE = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15]; // phrygian bite

  function Techno() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.5;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.duck = c.createGain(); this.duck.connect(this.master);          // sidechained bus
    this.delay = c.createDelay(2); this.fb = c.createGain(); this.fb.gain.value = 0.38;
    const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    this.delay.connect(dl).connect(this.fb).connect(this.delay); dl.connect(this.duck);
    this.dist = c.createWaveShaper(); this.dist.curve = curve(420); this.dist.oversample = '4x';
    const cab = c.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3600;
    const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.gain.value = -6;
    this.gtrIn = c.createGain(); this.gtrIn.gain.value = 0.6;
    this.gtrIn.connect(this.dist).connect(cab).connect(mid).connect(this.duck);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.bpm = 90; this.level = 0; this.step = 0; this.next = 0; this.kicks = [];
    this.section = -1; this.on = false;
  }
  function curve(k) { const n = 2048, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; a[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return a; }

  Techno.prototype.env = function (g, t, peak, a, dcy) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  };
  Techno.prototype.osc = function (type, f, t, len, dest, detune) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + len + 0.05); return o;
  };
  Techno.prototype.noiseHit = function (t, len, type, freq, gain, q) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = c.createGain(); this.env(g, t, gain, 0.002, len);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
  };

  Techno.prototype.kick = function (t) {
    const c = this.ctx, g = c.createGain(); g.connect(this.master);
    const o = this.osc('sine', 160, t, 0.4, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    this.env(g, t, 1.0, 0.003, 0.38);
    this.duck.gain.cancelScheduledValues(t); this.duck.gain.setValueAtTime(0.25, t); this.duck.gain.linearRampToValueAtTime(1, t + 0.22);
    this.kicks.push(t); if (this.kicks.length > 8) this.kicks.shift();
  };
  Techno.prototype.bass = function (t, m, len) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + len);
    f.connect(g).connect(this.duck); this.env(g, t, 0.42, 0.004, len);
    this.osc('sawtooth', mtof(m), t, len, f); this.osc('square', mtof(m - 12), t, len, f);
  };
  Techno.prototype.acid = function (t, m, accent, len) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 17;
    const top = 300 + 2600 * accent * (0.5 + this.level * 0.5);
    f.frequency.setValueAtTime(top, t); f.frequency.exponentialRampToValueAtTime(180, t + len * 1.6);
    f.connect(g); g.connect(this.duck); g.connect(this.delay); this.env(g, t, 0.16 + accent * 0.1, 0.003, len * 1.4);
    this.osc('sawtooth', mtof(m), t, len * 1.6, f);
  };
  Techno.prototype.guitar = function (t, m, len, open) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = open ? 5200 : 1700; // palm mute = darker
    f.connect(g).connect(this.gtrIn); this.env(g, t, open ? 0.5 : 0.42, 0.003, len);
    for (const iv of [0, 7, 12]) { this.osc('sawtooth', mtof(m + iv), t, len, f, -7); this.osc('sawtooth', mtof(m + iv), t, len, f, 7); }
  };
  Techno.prototype.pad = function (t, m, len) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 700 + this.level * 900;
    f.connect(g); g.connect(this.duck); g.connect(this.delay);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + len * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + len);
    for (const iv of [0, 3, 7, 10]) for (const dt of [-9, 9]) this.osc('sawtooth', mtof(m + 24 + iv), t, len, f, dt);
  };

  Techno.prototype.newSection = function (sec) {
    const r = rng(sec * 7919 + 13);
    this.acidPat = Array.from({ length: 16 }, () => r() < 0.7 ? { n: ACID_SCALE[Math.floor(r() * ACID_SCALE.length)] + (r() < 0.2 ? 12 : 0), a: r() < 0.3 ? 1 : 0.35 } : null);
    this.gtrPat = GUITAR[sec % GUITAR.length];
  };

  Techno.prototype.play = function (t, s) {
    const L = root.layers(this.level), bar = Math.floor(s / 16), i = s % 16, root_ = ROOTS[bar % 4];
    const section = Math.floor(bar / 8);
    if (section !== this.section) { this.section = section; this.newSection(section); }
    const breakdown = bar % 32 >= 28 && this.level > 0.3; // let it breathe before the drop
    const st = 60 / this.bpm / 4;
    if (i === 0) this.pad(t, root_, st * 16);
    if (L.kick && !breakdown && i % 4 === 0) this.kick(t);
    if (L.hats && i % 4 === 2) this.noiseHit(t, 0.12, 'highpass', 7500, 0.12);
    if (L.hats && this.level > 0.5 && i % 2 === 1) this.noiseHit(t, 0.03, 'highpass', 9500, 0.05);
    if (L.snare && !breakdown && (i === 4 || i === 12)) { this.noiseHit(t, 0.18, 'bandpass', 1700, 0.35, 0.8); }
    if (L.bass && !breakdown && i % 4 === 2) this.bass(t, root_, st * 1.6);
    if (L.acid) { const n = this.acidPat[i]; if (n) this.acid(t, root_ + 24 + n.n, n.a, st); }
    if (L.guitar && !breakdown && this.gtrPat[i] === 'x') this.guitar(t, root_ + 12, i === 0 ? st * 3 : st * 0.8, i === 0);
  };

  Techno.prototype.tick = function () {
    if (!this.on) return;
    const c = this.ctx;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.15) {
      this.play(this.next, this.step);
      this.delay.delayTime.setValueAtTime(60 / this.bpm * 0.75, this.next); // dotted 8th
      this.next += 60 / this.bpm / 4; this.step++;
    }
  };
  Techno.prototype.start = function () { this.on = true; this.ctx.resume(); if (!this.timer) this.timer = setInterval(() => this.tick(), 25); };
  Techno.prototype.stop = function () { this.on = false; };
  Techno.prototype.volume = function (v) { this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); };
  // 1 on the kick, decaying to 0: the frame and the worlds pulse on it
  Techno.prototype.pulse = function () {
    const now = this.ctx.currentTime; let last = -1;
    for (const k of this.kicks) if (k <= now) last = k;
    return last < 0 ? 0 : Math.exp(-(now - last) * 7);
  };

  const DTMF = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336] };
  // Returns the seconds the whole call takes.
  Techno.prototype.dialup = function (number, vol) {
    const c = this.ctx, out = c.createGain(); out.gain.value = 0.18 * (vol == null ? 1 : vol); out.connect(c.destination);
    let t = c.currentTime + 0.1;
    const tone = (f, t0, len, type) => { const g = c.createGain(); g.gain.setValueAtTime(1, t0); g.gain.setValueAtTime(0, t0 + len); g.connect(out); this.osc(type || 'sine', f, t0, len, g); };
    tone(350, t, 0.9); tone(440, t, 0.9); t += 1.0;                     // dial tone
    for (const ch of number) { const p = DTMF[ch]; if (p) { tone(p[0], t, 0.09); tone(p[1], t, 0.09); } t += 0.13; }
    t += 0.4; tone(2100, t, 1.1); t += 1.2;                               // answer tone
    for (let k = 0; k < 14; k++) {                                        // handshake chatter
      const f = [1200, 2400, 1800, 980, 1650][k % 5];
      tone(f + Math.random() * 200, t, 0.08, 'square'); tone(f * 1.5, t + 0.04, 0.06, 'square'); t += 0.11;
    }
    const s = c.createBufferSource(); s.buffer = this.noise; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1800; nf.Q.value = 0.6;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.7, t); ng.gain.linearRampToValueAtTime(0, t + 1.4);
    s.loop = true; s.connect(nf).connect(ng).connect(out); s.start(t); s.stop(t + 1.5); t += 1.5;
    return t - c.currentTime;
  };

  root.Techno = Techno;
})(this);
