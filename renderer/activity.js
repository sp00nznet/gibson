// How busy is the operator? Keystrokes and shell output are smoothed into rates;
// everything else (tempo, warp, layers, the cigarette, NYX's boredom) reads them.
// Loaded by the page and by test/check.mjs, hence the export shim at the bottom.
(function (root) {
  const SLOW_BPM = 84, FAST_BPM = 162, GLIDE = 3; // BPM/sec: tempo drifts, never lurches
  const TEMPO_MEMORY = 12; // sec: tempo follows sustained work, not a burst or one command's output

  function Activity() {
    this.keys = 0;      // keystrokes/sec, smoothed
    this.out = 0;       // output KB/sec, smoothed
    this.idle = 0;      // seconds since last keystroke
    this.busyOut = 0;   // seconds of heavy output with light typing (a compile)
    this.bpm = SLOW_BPM;
    this.mood = 0;      // level averaged over TEMPO_MEMORY; the tempo reads this
  }
  // weight < 1 for edit keys: a held backspace autorepeats ~30/s and shouldn't read as a frenzy
  Activity.prototype.key = function (weight) { this.keys += weight == null ? 1 : weight; this.idle = 0; };
  Activity.prototype.output = function (bytes) { this.out += bytes / 1024; };
  Activity.prototype.tick = function (dt) {
    const k = Math.exp(-dt / 2.5);               // ~2.5 s memory
    this.keys *= k; this.out *= k; this.idle += dt;
    this.mood += (this.level() - this.mood) * (1 - Math.exp(-dt / TEMPO_MEMORY));
    const compiling = this.out > 1.5 && this.keys < 1.5;
    this.busyOut = compiling ? this.busyOut + dt : Math.max(0, this.busyOut - dt * 3);
  };
  // 0..1. Typing or a moving screen, whichever is busier. keys holds roughly rate*2.5 after smoothing; ~8 keys/s reads as flat out.
  Activity.prototype.level = function () {
    const typing = 1 - Math.exp(-this.keys / 12);
    const output = 1 - Math.exp(-this.out / 8);  // the screen scrolling drives the beat too
    return Math.min(1, Math.max(typing, output * 0.9));
  };
  Activity.prototype.targetBpm = function (music) {
    if (music && music.mode === 'fixed') return music.bpm;
    return SLOW_BPM + (FAST_BPM - SLOW_BPM) * this.mood;
  };
  Activity.prototype.glide = function (dt, music) {
    const t = this.targetBpm(music), d = t - this.bpm, step = GLIDE * dt;
    this.bpm += Math.abs(d) < step ? d : Math.sign(d) * step;
    return this.bpm;
  };
  // Which instrument layers play: idle is a pad and a heartbeat, flat out is everything.
  function layers(level) {
    return {
      kick: level > 0.06, hats: level > 0.18, bass: level > 0.12,
      acid: level > 0.42, guitar: level > 0.62, snare: level > 0.3, pad: true,
    };
  }
  const api = { Activity, layers, SLOW_BPM, FAST_BPM };
  if (typeof module !== 'undefined') module.exports = api; else Object.assign(root, api);
})(this);
