// The jukebox: a folder of the user's own music instead of the synth. Tracks play at their own
// tempo (activity does not touch them). A bass-band beat detector stands in for the synth's
// kick, so the frame glow and the worlds still pump on the beat.
// Files are served by main.js through the gibson-music: protocol, limited to the chosen folder.
// Tracker modules (.mod .xm .s3m .it ...) play through libopenmpt (wasm, in an AudioWorklet, from
// the chiptune3 package); everything else through an <audio> element. Both feed one analyser.
(function (root) {
  const url = (rel) => 'gibson-music://track/' + rel.split(/[\\/]/).map(encodeURIComponent).join('/');
  const title = (rel) => rel.split(/[\\/]/).pop().replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
  const TRACKER = /\.(mod|xm|s3m|it|mptm|stm|669|med|mtm|okt|far|ult|dbm|dmf|psm|ptm|amf|mo3|umx)$/i; // keep in step with main.js AUDIO
  const WORKLET = '../node_modules/chiptune3/chiptune3.worklet.js';
  const NOD = 'IT REALLY PHREAKS THE LLAMA'; // NYX's nod, over the session's first track for 5 s

  function Jukebox(onTrack) {
    this.onTrack = onTrack; this.tracks = []; this.order = []; this.pos = -1; this.shuffle = true;
    this.audio = new Audio(); this.audio.preload = 'auto'; this.audio.crossOrigin = 'anonymous'; // see main.js gibson-music
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('error', () => { if (this.mod || !this.audio.getAttribute('src')) return; this.skip(); }); // skip unplayable files
    this.ctx = null; this.avg = 0; this.beat = -9; this.vol = 0.55;
    this.mod = false; this.modPaused = false; this.modPos = 0; this.modTitle = ''; this.seq = 0; this.peaks = []; this.nodAt = 0;
  }
  Jukebox.isTracker = (name) => TRACKER.test(name);
  Jukebox.prototype.skip = function () { if (this.tracks.length > 1) setTimeout(() => this.next(), 300); };
  Jukebox.prototype.load = function (list) {
    this.folder = list && list.folder; this.tracks = (list && list.tracks) || []; this.pos = -1; this.reorder();
  };
  Jukebox.prototype.reorder = function () {
    this.order = this.tracks.map((_, i) => i);
    if (this.shuffle) for (let i = this.order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.order[i], this.order[j]] = [this.order[j], this.order[i]]; }
  };
  // The analyser needs a user-gesture-free AudioContext, which main.js's autoplay policy allows.
  Jukebox.prototype.wire = function () {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaElementSource(this.audio);
    this.an = this.ctx.createAnalyser(); this.an.fftSize = 512; this.an.smoothingTimeConstant = 0.15; this.bins = new Uint8Array(this.an.frequencyBinCount); // low smoothing: the default flattens kicks away
    this.gain = this.ctx.createGain(); this.gain.gain.value = this.vol;
    this.rack = new Rack(this.ctx); Rack.all.add(this.rack); // the synth panel's knobs
    src.connect(this.an); this.an.connect(this.rack.in); this.rack.out.connect(this.gain).connect(this.ctx.destination); // beat detection before the knobs and the volume
  };
  // The libopenmpt worklet, loaded the first time a module plays (1.5 MB of wasm nobody else needs).
  Jukebox.prototype.tracker = function () {
    if (this.node) return this.node;
    return (this.node = this.ctx.audioWorklet.addModule(WORKLET).then(() => {
      const n = new AudioWorkletNode(this.ctx, 'libopenmpt-processor', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      n.port.postMessage({ cmd: 'config', val: { repeatCount: 0, stereoSeparation: 60, interpolationFilter: 0 } }); // play once; Amiga hard-panning softened
      n.port.onmessage = (e) => {
        const d = e.data; if (!this.mod) return;
        if (d.cmd === 'meta') { this.live = true; this.modTitle = ((d.meta && d.meta.title) || '').trim(); if (this.modTitle && this.onTrack) this.onTrack(this.title); }
        else if (!this.live) return; // the last module's queued 'pos'/'end' still arriving
        else if (d.cmd === 'pos') this.modPos = d.pos;
        else if (d.cmd === 'end' && !this.ended) { this.ended = true; this.next(); } // the worklet repeats 'end' every block
        else if (d.cmd === 'err' && d.val === 'ptr' && !this.ended) { this.ended = true; this.skip(); } // not a module after all
      };
      n.connect(this.an);
      return n;
    }));
  };
  Jukebox.prototype.go = function (pos) {
    if (!this.tracks.length) return;
    this.pos = (pos + this.order.length) % this.order.length;
    const rel = this.tracks[this.order[this.pos]], seq = ++this.seq;
    this.wire(); this.ctx.resume();
    if (!this.nodAt) this.nodAt = performance.now();
    this.mod = TRACKER.test(rel); this.modTitle = ''; this.modPos = 0; this.modPaused = false; this.ended = false; this.live = false;
    if (this.node) this.node.then((n) => n.port.postMessage({ cmd: 'stop' }));
    if (this.mod) {
      this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
      Promise.all([fetch(url(rel)).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }), this.tracker()])
        .then(([buf, n]) => { if (seq !== this.seq) return; n.port.postMessage({ cmd: 'play', val: buf }, [buf]); if (this.modPaused) n.port.postMessage({ cmd: 'pause' }); })
        .catch((e) => { console.warn('jukebox:', rel, e.message); if (seq === this.seq) this.skip(); });
    } else { this.audio.src = url(rel); this.audio.play().catch(() => {}); }
    if (this.onTrack) this.onTrack(this.title);
  };
  Jukebox.prototype.play = function () {
    if (this.pos < 0) return this.go(0);
    if (this.mod) { this.modPaused = false; if (this.node) this.node.then((n) => n.port.postMessage({ cmd: 'unpause' })); } else this.audio.play().catch(() => {});
    if (this.ctx) this.ctx.resume();
  };
  Jukebox.prototype.pause = function () {
    if (this.mod) { this.modPaused = true; if (this.node) this.node.then((n) => n.port.postMessage({ cmd: 'pause' })); } else this.audio.pause();
  };
  Jukebox.prototype.toggle = function () { if (this.playing) this.pause(); else this.play(); };
  Jukebox.prototype.next = function () { this.go(this.pos + 1); };
  Jukebox.prototype.prev = function () {
    if (this.time <= 3) return this.go(this.pos - 1);
    if (this.mod) this.node.then((n) => n.port.postMessage({ cmd: 'setPos', val: 0 })); else this.audio.currentTime = 0;
  };
  Jukebox.prototype.setShuffle = function (on) { const cur = this.order[this.pos]; this.shuffle = on; this.reorder(); this.pos = Math.max(0, this.order.indexOf(cur)); };
  Jukebox.prototype.volume = function (v) { this.vol = Math.max(0, Math.min(1, v)); if (this.gain) this.gain.gain.value = this.vol; };
  Object.defineProperty(Jukebox.prototype, 'playing', { get() { return this.pos >= 0 && (this.mod ? !this.modPaused : !this.audio.paused); } });
  Object.defineProperty(Jukebox.prototype, 'title', { get() { return this.pos < 0 ? '' : this.modTitle || title(this.tracks[this.order[this.pos]]); } });
  Object.defineProperty(Jukebox.prototype, 'time', { get() { return this.pos < 0 ? 0 : this.mod ? this.modPos : this.audio.currentTime || 0; } }); // elapsed seconds
  // 1 on a detected beat, decaying to 0: bass energy jumping well above its running average.
  Jukebox.prototype.pulse = function () {
    if (!this.an || !this.playing) return 0;
    this.an.getByteFrequencyData(this.bins);
    // Bins are decibels squeezed into 0-255, which flattens a kick into the background; back to
    // linear magnitude first, or nothing ever stands out from the average.
    const lo = this.an.minDecibels, span = this.an.maxDecibels - lo;
    let e = 0; for (let i = 1; i < 8; i++) e += Math.pow(10, (lo + this.bins[i] / 255 * span) / 20); // roughly 40-300 Hz
    const now = this.ctx.currentTime;
    if (e > this.avg * 1.5 && now - this.beat > 0.28) this.beat = now;
    this.avg = this.avg * 0.96 + e * 0.04;
    return Math.exp(-(now - this.beat) * 7);
  };
  // out.length bars 0..1 (spectrumOf, in audio.js). Zeros when stopped.
  Jukebox.prototype.spectrum = function (out) { return this.an && this.playing ? spectrumOf(this.an, this.bins, out) : out.fill(0); };
  // The player skin, once a frame: spectrum + peak caps on el's canvas, m:ss in .lcd, kHz/kind in
  // .info, and the nod in .bar for the first few seconds of the session's first track.
  Jukebox.prototype.draw = function (el) {
    const cv = el.querySelector('canvas'), lcd = el.querySelector('.lcd'), info = el.querySelector('.info'), bar = el.querySelector('.bar');
    const t = Math.floor(this.time), s = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    if (lcd && lcd.textContent !== s) lcd.textContent = s;
    if (lcd) lcd.classList.toggle('blink', this.pos >= 0 && !this.playing);
    const i = this.ctx ? `${this.mod ? 'MOD' : 'PCM'} ${Math.round(this.ctx.sampleRate / 1000)}kHz` : '';
    if (info && info.textContent !== i) info.textContent = i;
    const b = this.nodAt && performance.now() - this.nodAt < 5000 ? NOD : 'GIBSON AMP';
    if (bar && bar.textContent !== b) bar.textContent = b;
    if (!cv) return;
    const n = 20, v = this.spectrum(this.bars || (this.bars = new Array(n).fill(0)));
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, bw = w / n;
    const grad = g.createLinearGradient(0, h, 0, 0); grad.addColorStop(0, '#39ff9c'); grad.addColorStop(0.6, '#ffe14d'); grad.addColorStop(1, '#ff2e88');
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < n; k++) {
      const y = Math.round(v[k] * h);
      this.peaks[k] = Math.max(y, (this.peaks[k] || 0) - 0.6); // caps fall slowly
      g.fillStyle = grad; g.fillRect(k * bw + 1, h - y, bw - 2, y);
      g.fillStyle = '#fff'; g.fillRect(k * bw + 1, h - Math.round(this.peaks[k]) - 1, bw - 2, 1);
    }
  };

  root.Jukebox = Jukebox;
})(this);
