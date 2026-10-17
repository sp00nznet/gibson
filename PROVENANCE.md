# Provenance

Every asset GIBSON shows or plays, and where it comes from.

| Asset | Source | Licence |
|---|---|---|
| Soundtrack and modem sounds | Synthesized at runtime by `renderer/audio.js` (WebAudio oscillators and noise) | MIT, this repository |
| Worlds, logo, scroller, rain, cigarette | Drawn at runtime by `renderer/worlds.js` and `renderer/fx.js` (Canvas 2D) | MIT, this repository |
| App icon (`build/icon.png`, `build/icon.ico`) | Drawn by `scripts/icon.js` (Canvas 2D), regenerate with `npm run icon` | MIT, this repository |
| Screenshots (`docs/screenshots/`) | Captured from the app by `npm run shots`, in a made-up demo folder | MIT, this repository |
| NYX's canned lines | Written for this project (`renderer/nyx.js`) | MIT, this repository |

No third-party audio, image or font files are in the repository. The terminal font is the
system's (Cascadia Mono, Consolas or the platform monospace).
