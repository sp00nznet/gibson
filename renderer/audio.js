// The soundtrack, synthesized live: a setlist of styles (industrial, outrun, electro, EBM, italo,
// halftime, breakbeat), each with its own drums, bass, lead and chords, in a new key per song.
// Tempo and layers follow the Activity meter, one 16th step at a time, so a tempo change lands on the grid.
// Also the modem: DTMF dial, answer tone, handshake screech.
(function (root) {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Songs. Every 64 bars the synth picks a new style and key; tempo and layers still follow your hands.
  // prog: [semitones from the key, 'm'inor | 'M'ajor] per bar. Patterns are 16 steps.
  // bass: x root, o octave up, 5 fifth. lead: acid (scale riff), arp (chord tones), stab (sparse square).
  const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15], MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15], PENTA = [0, 3, 5, 7, 10, 12, 15];
  const FOUR = 'x...x...x...x...', BACK = '....x.......x...', OFF = '..x...x...x...x.';
  const STYLES = [
    { name: 'INDUSTRIAL', prog: [[0, 'm'], [0, 'm'], [3, 'M'], [2, 'm']], kick: FOUR, snare: BACK, hat: OFF, bass: OFF, bassLen: 1.6, lead: 'acid', scale: PHRYGIAN,
      guitar: ['x.xxx.x.xx.x.x..', 'x.x.xxx.x.xxx.x.', 'xxx.x.xxx.x.x.xx'] },
    { name: 'OUTRUN', prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], kick: FOUR, snare: BACK, gated: true, hat: OFF, bass: 'x.o.x.o.x.o.x.o.', bassLen: 0.9, lead: 'arp', scale: MINOR },
    { name: 'ELECTRO', prog: [[0, 'm'], [0, 'm'], [-2, 'M'], [-4, 'M']], kick: 'x.....x...x.....', snare: BACK, hat: 'x.x.x.x.x.x.x.x.', bass: 'x.....x...x..x..', bassLen: 1.2, lead: 'stab', scale: PENTA },
    { name: 'EBM', prog: [[0, 'm'], [0, 'm'], [0, 'm'], [-2, 'M']], kick: FOUR, snare: BACK, hat: OFF, bass: '.xxx.xxx.xxx.xxx', bassLen: 0.7, lead: 'acid', scale: MINOR,
      guitar: ['x...x...x...x.x.'] },
    { name: 'ITALO', prog: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-5, 'M']], kick: FOUR, snare: BACK, hat: OFF, bass: 'xoxoxoxoxoxoxoxo', bassLen: 0.5, lead: 'arp', scale: MINOR },
    { name: 'HALFTIME', prog: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']], kick: 'x.........x.....', snare: '........x.......', gated: true, hat: OFF, bass: 'x.......x..x....', bassLen: 3, lead: 'stab', scale: MINOR },
    { name: 'BREAKBEAT', prog: [[0, 'm'], [0, 'm'], [3, 'M'], [5, 'm']], kick: 'x.x.......xx....', snare: '....x..x.x..x..x', hat: 'x.x.x.x.x.x.x.x.', bass: 'x..x..x...x..x..', bassLen: 1.2, lead: 'acid', scale: PHRYGIAN },
  ];

  // The rack: the synth panel's knobs, between a source and the speakers. The synth and the jukebox
  // each get one; both read the same settings, FX, so the panel twists whichever is playing.
  const FX = { cut: 1, res: 0, low: 0, drive: 0, echo: 0 };
  function Rack(c) {
    this.c = c; this.in = c.createGain(); this.out = c.createGain();
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass';
    this.hp = c.createBiquadFilter(); this.hp.type = 'highpass';
    this.sh = c.createWaveShaper(); this.dry = c.createGain(); this.wet = c.createGain();
    this.dl = c.createDelay(2); this.dl.delayTime.value = 0.33; this.fb = c.createGain(); this.send = c.createGain();
    this.in.connect(this.hp).connect(this.lp);
    this.lp.connect(this.dry).connect(this.out); this.lp.connect(this.sh).connect(this.wet).connect(this.out);
    this.lp.connect(this.send).connect(this.dl).connect(this.fb).connect(this.dl); this.dl.connect(this.out);
    this.set();
  }
  Rack.prototype.set = function () {
    const t = this.c.currentTime, k = (p, v) => p.setTargetAtTime(v, t, 0.03);
    k(this.lp.frequency, 80 * Math.pow(18000 / 80, FX.cut)); k(this.lp.Q, FX.res * 18);
    k(this.hp.frequency, 20 * Math.pow(100, FX.low));
    if (this.drv !== FX.drive) { this.drv = FX.drive; this.sh.curve = curve(1 + FX.drive * 200); }
    k(this.dry.gain, 1 - FX.drive * 0.7); k(this.wet.gain, FX.drive * 0.5);
    k(this.send.gain, FX.echo * 0.6); k(this.fb.gain, FX.echo * 0.6);
  };
  Rack.all = new Set();
  // out (an array) filled with out.length bars 0..1, log-spaced from ~90 Hz to ~16 kHz. Used by the
  // synth and the jukebox, so the worlds hear either one.
  function spectrumOf(an, bins, out) {
    an.getByteFrequencyData(bins);
    const n = out.length, top = Math.min(bins.length, 180);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.pow(top, i / n)), b = Math.max(a + 1, Math.floor(Math.pow(top, (i + 1) / n)));
      let m = 0; for (let j = a; j < b; j++) m = Math.max(m, bins[j]);
      out[i] = m / 255;
    }
    return out;
  }
  Rack.update = () => { for (const r of Rack.all) r.set(); };

  function Techno() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.5;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.rack = new Rack(c); Rack.all.add(this.rack);
    this.master.connect(this.rack.in); this.rack.out.connect(comp).connect(c.destination);
    this.an = c.createAnalyser(); this.an.fftSize = 512; this.an.smoothingTimeConstant = 0.15; this.bins = new Uint8Array(this.an.frequencyBinCount); comp.connect(this.an); // what the worlds hear
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
    this.section = -1; this.on = false; this.song = -1;
    this.lock = null; this.mute = new Set(); this.shift = 0; this.allIn = false; // the synth panel's controls
    this.seed = Math.floor(Math.random() * 1e6); // a different setlist each session
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
  Techno.prototype.acid = function (t, m, accent, len, wave, q) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = q || 17;
    const top = 300 + 2600 * accent * (0.5 + this.level * 0.5);
    f.frequency.setValueAtTime(top, t); f.frequency.exponentialRampToValueAtTime(180, t + len * 1.6);
    f.connect(g); g.connect(this.duck); g.connect(this.delay); this.env(g, t, 0.16 + accent * 0.1, 0.003, len * 1.4);
    this.osc(wave || 'sawtooth', mtof(m), t, len * 1.6, f);
  };
  Techno.prototype.guitar = function (t, m, len, open) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = open ? 5200 : 1700; // palm mute = darker
    f.connect(g).connect(this.gtrIn); this.env(g, t, open ? 0.5 : 0.42, 0.003, len);
    for (const iv of [0, 7, 12]) { this.osc('sawtooth', mtof(m + iv), t, len, f, -7); this.osc('sawtooth', mtof(m + iv), t, len, f, 7); }
  };
  Techno.prototype.pad = function (t, m, len, chord) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 700 + this.level * 900;
    f.connect(g); g.connect(this.duck); g.connect(this.delay);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + len * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + len);
    for (const iv of chord || [0, 3, 7, 10]) for (const dt of [-9, 9]) this.osc('sawtooth', mtof(m + 24 + iv), t, len, f, dt);
  };

  Techno.prototype.newSong = function (song) {
    const r = rng(this.seed + song * 31337);
    let i = Math.floor(r() * STYLES.length); if (this.style && STYLES[i] === this.style) i = (i + 1) % STYLES.length; // never twice running
    this.style = this.lock || STYLES[i]; this.styleName = this.style.name;
    this.key = 25 + Math.floor(r() * 7); // C#1..G1
    this.section = -1; // fresh patterns for the new style
  };
  // the panel's NEXT: a new song now, without waiting out the 64 bars
  Techno.prototype.skip = function () { this.seed = Math.floor(Math.random() * 1e6); this.song = -1; };
  Techno.prototype.setStyle = function (name) { this.lock = STYLES.find((x) => x.name === name) || null; this.skip(); };
  Techno.STYLES = STYLES.map((x) => x.name);
  Techno.prototype.newSection = function (sec) {
    const r = rng(this.seed + sec * 7919 + 13), S = this.style;
    const dense = S.lead === 'stab' ? 0.3 : 0.7;
    this.acidPat = Array.from({ length: 16 }, () => r() < dense ? { n: S.scale[Math.floor(r() * S.scale.length)] + (r() < 0.2 ? 12 : 0), a: r() < 0.3 ? 1 : 0.35 } : null);
    const shape = Math.floor(r() * 3); // arp: up, up-down, scattered
    this.arpPat = Array.from({ length: 16 }, (_, k) => shape === 0 ? k % 4 : shape === 1 ? [0, 1, 2, 3, 2, 1][k % 6] : Math.floor(r() * 4));
    this.gtrPat = S.guitar ? S.guitar[sec % S.guitar.length] : null;
  };

  Techno.prototype.play = function (t, s) {
    const L = root.layers(this.allIn ? 1 : this.level), bar = Math.floor(s / 16), i = s % 16;
    for (const m of this.mute) L[m] = false;
    const song = Math.floor(bar / 64), section = Math.floor(bar / 8);
    if (song !== this.song) { this.song = song; this.newSong(song); }
    if (section !== this.section) { this.section = section; this.newSection(section); }
    const S = this.style, [deg, q] = S.prog[bar % S.prog.length];
    let root_ = this.key + this.shift + deg; while (root_ < 24) root_ += 12; while (root_ > 35) root_ -= 12; // keep the bass audible
    const chord = q === 'M' ? [0, 4, 7, 11] : [0, 3, 7, 10];
    const breakdown = bar % 32 >= 28 && this.level > 0.3; // let it breathe before the drop
    const st = 60 / this.bpm / 4;
    if (L.pad && i === 0) this.pad(t, root_, st * 16, chord);
    if (L.kick && !breakdown && S.kick[i] === 'x') this.kick(t);
    if (L.hats && S.hat[i] === 'x') this.noiseHit(t, 0.12, 'highpass', 7500, 0.12);
    if (L.hats && this.level > 0.5 && i % 2 === 1) this.noiseHit(t, 0.03, 'highpass', 9500, 0.05);
    if (L.snare && !breakdown && S.snare[i] === 'x') this.noiseHit(t, S.gated ? 0.32 : 0.18, 'bandpass', S.gated ? 1300 : 1700, S.gated ? 0.45 : 0.35, 0.8);
    const b = S.bass[i];
    if (L.bass && !breakdown && b !== '.') this.bass(t, root_ + (b === 'o' ? 12 : b === '5' ? 7 : 0), st * S.bassLen);
    if (L.acid) {
      if (S.lead === 'arp') this.acid(t, root_ + 36 + [0, chord[1], 7, 12][this.arpPat[i]], 0.5, st * 0.8, 'square', 5);
      else { const n = this.acidPat[i]; if (n) this.acid(t, root_ + 24 + n.n, n.a, st, S.lead === 'stab' ? 'square' : 'sawtooth', S.lead === 'stab' ? 6 : 17); }
    }
    if (L.guitar && !breakdown && this.gtrPat && this.gtrPat[i] === 'x') this.guitar(t, root_ + 12, i === 0 ? st * 3 : st * 0.8, i === 0);
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
  Techno.prototype.spectrum = function (out) { return this.on ? spectrumOf(this.an, this.bins, out) : out.fill(0); };
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

  // Little sounds outside the soundtrack: keyboard clicks and NYX's chimes. Their own context, so
  // they play with the music off. vol() is read per sound (the music volume; 0 when muted).
  function Sfx(vol) { this.vol = vol; this.ctx = null; }
  Sfx.prototype.wake = function () {
    if (this.ctx) return this.ctx;
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.noise = c.createBuffer(1, c.sampleRate / 4, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return c;
  };
  Sfx.prototype.blip = function (type, f, t, len, gain, f2) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + len + 0.02);
  };
  // A mechanical key: a filtered tick and a small thump, the pitch a little different each time.
  // Enter and Space are the big keys: lower and longer.
  Sfx.prototype.key = function (kind) {
    const v = this.vol(); if (!v) return;
    const c = this.wake(), t = c.currentTime, r = 0.88 + Math.random() * 0.24;
    const [bp, thump, len] = kind === 'enter' ? [2000 * r, 105, 0.07] : kind === 'space' ? [1400 * r, 85, 0.06] : [3800 * r, 180 * r, 0.03];
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = 1.3;
    g.gain.setValueAtTime(0.45 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(c.destination); s.start(t, Math.random() * 0.2); s.stop(t + len + 0.02);
    this.blip('sine', thump, t, len * 1.6, 0.3 * v, thump * 0.6);
  };
  // NYX's chimes, original little tunes: 'say' a falling two-tone bell, 'error' a sour drop, 'news' a rising run.
  const CHIMES = { say: [[1046.5, 0], [784, 0.12]], error: [[659.3, 0], [466.2, 0.14]], news: [[523.3, 0], [659.3, 0.07], [784, 0.14], [1046.5, 0.21]] };
  Sfx.prototype.chime = function (kind) {
    const v = this.vol(); if (!v) return;
    const c = this.wake(), t = c.currentTime + 0.01;
    for (const [f, dt] of CHIMES[kind]) this.blip(kind === 'error' ? 'square' : 'triangle', f, t + dt, kind === 'say' ? 0.5 : 0.22, (kind === 'error' ? 0.05 : 0.11) * v);
  };

  root.Techno = Techno; root.Sfx = Sfx; root.Rack = Rack; root.FX = FX; root.spectrumOf = spectrumOf;
})(this);
