# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com), versions: SemVer.

## [Unreleased]

## [0.9.0] - 2026-10-17

### Added
- Rename tabs: double-click a tab (or right-click > Rename tab). Saved start tabs keep their names.

## [0.8.1] - 2026-10-17

### Fixed
- WSL: one profile per distro ("Ubuntu (WSL)", `wsl.exe -d Ubuntu`), like Windows Terminal,
  instead of plain `wsl.exe`, which opens whatever the default distro is (a broken or Docker
  one drops you to root). Docker Desktop's distros are skipped.
- macOS: shells start as login shells (`-l`), so PATH from `/etc/zprofile` is there. Linux and
  macOS skip `/etc/shells` entries that are not for people (nologin, git-shell).
- The shell detection is covered by the self-check, so CI exercises it on all three systems.

## [0.8.0] - 2026-10-17

### Added
- Shell profiles. Installed shells are found on their own (Windows: PowerShell, PowerShell 7,
  Command Prompt, WSL, Git Bash; macOS/Linux: `/etc/shells`); add your own as `profiles`. The
  `▾` button next to `+` (and right-click > New tab with) opens a tab in any of them;
  right-click > Tabs > Default shell picks the default (`defaultShell`).
- Start tabs: right-click > Tabs > Open these tabs on start saves each tab's shell, folder and
  pane count (`startupTabs`); they reopen next launch.
- A close button on each tab.
- Default world: right-click > World > Start in this world (`world`), and NYX picks the world
  on/off (`nyxWorlds`).
- Cigarette on/off (`cigarette`, right-click menu). Now and then its smoke curls into a heart.
- WORLD NEWS: a wireframe Earth; each headline pops up where it happened (a keyword list of
  places) with a callout out to the side, and the globe turns to it.
- TRAFFIC MAP: your connections arcing out from home across the globe, placed by internet
  registry (offline, continent-level; nothing is looked up).
- HACK THE PLANET: the Earth, a Jolly Roger floppy in orbit and the words going round. Typing
  `hack the planet` (or a typing streak) takes you there.

### Changed
- The tab bar is always shown, so `+` and the shell picker are always there.
- A shell that quits within two seconds is not redialed in a loop; one that cannot start falls
  back to the default shell.

## [0.7.0] - 2026-10-17

### Added
- FLYING TOASTERS: wireframe toasters flapping across the screen among slices of toast (some
  burnt), a homage to the 90s screensaver. NYX's tender mood sends you there.
- `Ctrl+Shift+D` (or the menu) hides the data packets streaming in from the sides. Remembered as
  `packets`.

## [0.6.0] - 2026-10-17

### Added
- Jukebox: play a folder of your own music (mp3, ogg, opus, flac, wav, m4a, subfolders too)
  instead of the synth, at its own tempo. Player in the bottom-right corner (previous, play/pause,
  next, shuffle, volume, choose folder), on the right-click menu, and on keys: `Ctrl+Shift+J`
  synth or folder, `P` play/pause, `]` / `[` next / previous, `=` / `-` volume. A beat detector
  keeps the frame and worlds pumping on your track; NYX comments when a track starts.
- `Ctrl+Shift+L` (or the menu) hides the GIBSON logo bar. Remembered as `logo`.
- `--music <folder>` to start on the jukebox.

### Changed
- The README tells you what this thing is for (fun) and what is handy anyway.
- Screenshot runs never write to `config.json`.

## [0.5.0] - 2026-10-17

### Added
- Eight worlds: NETWATCH (live TCP connections as arcs from a globe), PROCESS HIVE (running
  programs as a honeycomb, memory as height, CPU as heat), NEWSWIRE (RSS/Atom headlines on
  ticker bands), 3D PIPES and 3D MAZE (the old screensavers), LIGHT CYCLES, BATTLEZONE (vector
  tanks, a radar scope) and THE STREET (a Snow Crash boulevard).
- NYX reacts to live data: a kind of connection not seen this session, a program hogging the
  CPU, a fresh headline.
- `news.feeds` and `news.minutes` in `config.json`.
- `Worlds.define()`: a world can live in its own file under `renderer/worlds/`.

### Changed
- Going idle shows the 3D MAZE and a long build shows 3D PIPES; NYX's playful mood rides the
  light cycles.

## [0.4.1] - 2026-10-17

### Added
- `Ctrl+Shift+S` (or the right-click menu) hides the scroller along the bottom; the terminal
  takes the space. Remembered as `scroller` in `config.json`.

## [0.4.0] - 2026-10-17

### Added
- Seven worlds: GIBSON CORE (the mainframe), BBS LOBBY (a 90s board with a download that never
  finishes), RAVE WAREHOUSE (speakers and crowd on the kick, laser fans), GIT GALAXY (the focused
  pane's repository as spiral arms, new commits ignite), ICE WALL (flares red on errors, cracks
  open on success), HIGHWAY (night drive) and DEEP SEA (sunken racks, cable kelp, data fish).
- Events have worlds of their own: boot goes to the BBS, git to the galaxy, errors to the ICE,
  `ssh` / `sudo` / dangerous commands to the core, typing streaks to the rave.
- `Worlds.signal()`: worlds can react to a command working or failing.

### Changed
- Going idle drives the HIGHWAY instead of THE GRID; NYX's moods map onto the new worlds too.

## [0.3.2] - 2026-10-17

### Fixed
- `nyx <message>` left a `^C` after the line in PowerShell. The line is now erased with
  backspaces instead of cancelled, so the prompt stays clean; the conversation shows in the
  overlay and NYX's bar.

## [0.3.1] - 2026-10-17

### Fixed
- `nyx <message>` recalled from history (Up arrow) or finished with Tab went to the shell, which
  said "not recognized". The command is now read off the screen at Enter instead of rebuilt from
  keystrokes, so history recall and tab completion count for `nyx`, for `cd` tracking and for
  NYX's comments on commands.

## [0.3.0] - 2026-10-17

### Added
- Tabs (`Ctrl+Shift+T` new, `Ctrl+Shift+X` close, `Ctrl+Tab` / `Ctrl+Shift+Tab` to move, the
  `+` button, middle-click to close). Each tab has its own 1 to 4 panes and is named after its
  folder; the tab bar shows once there are two tabs.
- `nyx <message>` in any pane talks to NYX directly. The shell line is cancelled, and the
  exchange shows over the bottom of the pane. With a model she keeps the last few exchanges as
  context; without one she answers from a small set of lines.
- `--tabs` and `--chat` for screenshots.

### Changed
- `Ctrl+Shift+T` opens a tab; it used to cycle the pane count (`Ctrl+Shift+1`..`4` still sets it).

### Fixed
- Electron could crash on exit while node-pty was still closing ConPTY shells; quitting
  now waits for them.
- The release workflow's notes step never matched the CHANGELOG heading, so v0.2.0's release
  was published by hand from the CI-built packages.

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
