// The jukebox: a folder of the user's own music instead of the synth. Tracks play at their own
// tempo (activity does not touch them). A bass-band beat detector stands in for the synth's
// kick, so the frame glow and the worlds still pump on the beat.
// Files are served by main.js through the gibson-music: protocol, limited to the chosen folder.
(function (root) {
  const url = (rel) => 'gibson-music://track/' + rel.split(/[\\/]/).map(encodeURIComponent).join('/');
  const title = (rel) => rel.split(/[\\/]/).pop().replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');

  function Jukebox(onTrack) {
    this.onTrack = onTrack; this.tracks = []; this.order = []; this.pos = -1; this.shuffle = true;
    this.audio = new Audio(); this.audio.preload = 'auto'; this.audio.crossOrigin = 'anonymous'; // see main.js gibson-music
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('error', () => { if (this.tracks.length > 1) setTimeout(() => this.next(), 300); }); // skip unplayable files
    this.ctx = null; this.avg = 0; this.beat = -9; this.vol = 0.55;
  }
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
    src.connect(this.an); this.an.connect(this.gain).connect(this.ctx.destination); // beat detection before the volume
  };
  Jukebox.prototype.go = function (pos) {
    if (!this.tracks.length) return;
    this.pos = (pos + this.order.length) % this.order.length;
    const rel = this.tracks[this.order[this.pos]];
    this.wire(); this.audio.src = url(rel); this.audio.play().catch(() => {});
    this.ctx.resume();
    if (this.onTrack) this.onTrack(title(rel));
  };
  Jukebox.prototype.play = function () { if (this.pos < 0) this.go(0); else { this.audio.play().catch(() => {}); if (this.ctx) this.ctx.resume(); } };
  Jukebox.prototype.pause = function () { this.audio.pause(); };
  Jukebox.prototype.toggle = function () { if (this.audio.paused) this.play(); else this.pause(); };
  Jukebox.prototype.next = function () { this.go(this.pos + 1); };
  Jukebox.prototype.prev = function () { if (this.audio.currentTime > 3) this.audio.currentTime = 0; else this.go(this.pos - 1); };
  Jukebox.prototype.setShuffle = function (on) { const cur = this.order[this.pos]; this.shuffle = on; this.reorder(); this.pos = Math.max(0, this.order.indexOf(cur)); };
  Jukebox.prototype.volume = function (v) { this.vol = Math.max(0, Math.min(1, v)); if (this.gain) this.gain.gain.value = this.vol; };
  Object.defineProperty(Jukebox.prototype, 'playing', { get() { return !this.audio.paused; } });
  Object.defineProperty(Jukebox.prototype, 'title', { get() { return this.pos < 0 ? '' : title(this.tracks[this.order[this.pos]]); } });
  // 1 on a detected beat, decaying to 0: bass energy jumping well above its running average.
  Jukebox.prototype.pulse = function () {
    if (!this.an || this.audio.paused) return 0;
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

  root.Jukebox = Jukebox;
})(this);
