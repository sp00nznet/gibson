# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com), versions: SemVer.

## [Unreleased]

## [0.2.0] - 2026-10-16

### Added
- Installers for Windows (setup and portable), macOS (dmg, zip; Intel and Apple silicon) and
  Linux (AppImage, deb, tar.gz), unsigned, built by CI on every `v*` tag.
- CI on Windows, macOS and Linux: self-check, plus the quick-start script on macOS and Linux.
- `setup.sh` quick start for macOS and Linux (makes `GIBSON.command` or `GIBSON.desktop`).
- App icon, drawn by `scripts/icon.js`.
- `npm run shots` regenerates every screenshot; shot mode uses a made-up demo folder, prompt
  and user, so captures never show the real machine.
- CONTRIBUTING.md and PROVENANCE.md.
- 1 to 4 tiled panes (`Ctrl+Shift+1`..`4`, `Ctrl+Shift+T` cycles, or the right-click menu), each with its own shell.
- Framed or full-window view (`Ctrl+Shift+F` or the menu, saved as `framed`). Full window
  puts the terminal over the whole scene; lower a pane's opacity to watch it.
- Per-pane opacity (`Ctrl+Shift+O` or right-click a pane), from solid to fully see-through.
  The last choice is saved as the default for new panes (`opacity` in `config.json`).
- Right-click menu: copy, paste, panes, world picker, music, tempo mode, NYX, rain, config.

### Changed
- Config lives in a `gibson` folder for both source runs and installed builds.
- A scrolling screen drives the beat nearly as hard as typing does.
- Tempo follows sustained activity (about 12 s average, 3 BPM/s glide) instead of chasing
  every burst; it no longer keeps climbing after you stop typing.
- Held backspace and arrow keys barely count as activity (they were kicking in the harsh layers).

### Fixed
- `Ctrl+Shift` hotkeys: now caught in the main process before the page sees them; the default
  Electron menu (whose `Ctrl+Shift+R` reloaded the app) is gone.

## [0.1.0] - 2026-10-16

### Added
- Terminal: node-pty shell in xterm.js 6 (WebGL, links, Unicode 11), copy/paste, fullscreen.
- Worlds: THE GRID, NEON CITY, FILESYSTEM (your current folder as towers), DEEP SPACE,
  ORBIT, DATASTREAM; ships and data packets crossing every world.
- Soundtrack synthesized live: kick, hats, snare, offbeat bass, acid line, distorted
  palm-muted guitar, pad, dotted-8th delay, sidechain ducking. Tempo and layers follow typing.
- Modem dial-in on startup.
- NYX: canned personality, moods mapped to worlds, optional speech, optional LLM
  (Ollama, Anthropic, OpenAI-compatible).
- Cracktro furniture: copper-bar logo, sine scroller, Matrix rain bursts, CRT scanlines,
  a cigarette that burns during builds.
- `--shot` headless screenshots; `npm test` self-check; `Setup.cmd` quick start.
