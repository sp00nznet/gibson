# Architecture

Two processes, as Electron always has: **main** owns the machine, the **page** owns the show.

```
 main.js (Node)                         renderer/ (page, no Node)
 ─────────────                          ──────────────────────────
 node-pty shells ── pty:data ─────────► app.js ── xterm.js panes (1 or 4)
                 ◄─ pty:write/resize ──     │
 cd tracking     ◄─ pty:line ──────────     ├─► activity.js  keys + output → level, BPM
 fs listing      ── fs:list ──────────►     ├─► audio.js     Techno: tempo + layers from level
 llm.js          ◄─ nyx:llm ───────────     ├─► worlds.js    wireframe worlds, NYX picks one
 config.json     ── boot ─────────────►     ├─► fx.js        logo, scroller, rain, cigarette
                                            └─► nyx.js       events → line + mood → world
```

`preload.js` is the whole bridge; the page has no other way to reach the machine.

Every pane has an id; each `pty:*` message carries it, and the main process keeps one shell and
one tracked working directory per id. Tabs exist only in the page: a tab is a grid of 1 to 4
panes, hidden tabs are `display: none` (their shells keep running), and pane ids are global
across tabs so main never needs to know about tabs. The FILESYSTEM world follows the focused pane.

Hotkeys are caught in main (`before-input-event`) and sent to the page as actions, the same
actions the right-click menu sends. Catching them in the page proved unreliable.

## Activity is the spine

`renderer/activity.js` smooths keystrokes and output bytes into rates (about 2.5 s of memory)
and turns them into one number, `level`, from 0 to 1: typing or a scrolling screen, whichever is
busier. Backspace and arrow keys count a tenth of a keystroke, so a held backspace stays calm.
Everything reads it:

- **Tempo**: 84 BPM idle to 162 BPM flat out. It follows the level averaged over about 12 s and
  glides at most 3 BPM per second, so a burst of typing or one command's output barely moves it;
  sustained work does. The synth reads the BPM once per 16th step, so tempo changes land on the grid.
- **Layers**: idle is a pad and a kick; hats, bass, snare, acid line and the guitar arrive as the
  level climbs (`layers()`).
- **Visuals**: world speed, frame glow (kick pulse) and the forward lean of the terminal (warp).
- **The cigarette**: heavy output with light typing for 4 seconds is a build. It lights, burns
  for up to two minutes, and smoulders out after the output stops.
- **NYX**: idle for 75 s, a typing streak, a build starting and finishing are all events.

## NYX

`renderer/nyx.js` classifies each typed command (`danger`, `cd`, `git`, `ssh`, ...) and decides
whether to speak: errors, dangerous commands, builds and idles always; ordinary commands at the
`chatter` rate, never closer than 6 s apart. If a provider is set and `minGapSec` has passed, the
event goes to `llm.js` in the main process; anything that fails or is refused falls back to the
canned lines. Each line carries a mood, and each mood has a world (`MOOD_WORLD`).

Why the main process makes the calls: API keys never reach the page.

Why canned lines first-class: the app must be complete with no model at all, and a model that
takes 30 s to load must never stall the terminal. LLM calls are fire-and-forget.

## The typed line

At Enter, `typedLine()` in `app.js` reads the command off the screen: the cursor's row, plus any
rows it wrapped from, up to the cursor, with the prompt cut at its first `>`, `$`, `#` or `%`
followed by a space. Reading the screen rather than the keystrokes is what lets a command recalled
with Up, or finished with Tab, count: v0.3.0 rebuilt the line from keystrokes, so `nyx` recalled
from history went to the shell and failed. Text right of the cursor is ignored because PSReadLine
draws its grey predictions there.

The keystroke copy (`p.line`) is still kept as the fallback for the moment before the shell has
echoed what was typed (a fast paste-and-Enter, or the screenshot's scripted typing).

The prompt rule is a heuristic: a prompt without one of those characters falls back to the
keystrokes. A per-shell prompt hook (OSC 133) would be exact; that is the upgrade path. The main
process tracks the working directory from the `cd` lines this produces, for the FILESYSTEM world.

## Talking to NYX

`nyx <message>` is caught in `app.js` when Enter arrives on a typed line that starts with `nyx`.
The line is erased in the shell with one backspace per character rather than sent, and NYX's
answer is shown in an
overlay on the pane, not written into the terminal. Why: on Windows the shell sits behind ConPTY,
which keeps its own copy of the screen and repaints from it; text that xterm.js shows without
ConPTY knowing gets overwritten on its next redraw.

Why backspaces: Ctrl+C was the first try, and PowerShell echoes it as `^C` after the line.
Backspace (0x7f) means the same thing in PowerShell, cmd, bash and zsh, where Escape (clears
the line in PowerShell) is a meta prefix in bash and Ctrl+U does nothing in PowerShell's
Windows mode. The count comes from the untrimmed screen text, so trailing spaces go too.

A chat skips the chatter roll and the `minGapSec` rate limit, and sends the last eight turns
as real user/assistant messages (`llm.js` drops a leading assistant turn, since the Messages API
wants the user first). Replies may run to 280 characters instead of 160.

`term.input()` delivers Enter as `\n`, where a real keypress sends `\r`; the check accepts both,
which is what lets the screenshot type a real `nyx` line through the keystroke path.

## Worlds

`renderer/worlds.js` is a single perspective projector and line batcher on a 2D canvas. Lines
are batched by colour and alpha, drawn with additive blending over a partly cleared canvas, which
gives the trails. Each world is `{ label, update, draw, enter?, signal? }`. A world change
crossfades for about 0.6 s with glitch slices.

Which world shows: an event's own world if it has one (`EVENT_WORLD` in `nyx.js`: boot, git,
error, danger, ssh, streak, compile), otherwise the world for NYX's mood (`MOOD_WORLD`). The
self-check asserts every world those maps name exists.

Worlds in their own files (`renderer/worlds/*.js`) register with `Worlds.define(name, kit =>
world)`; `kit` is the projector, the line batcher, the colours and `env`. Each file also loads
under Node (`require('../worlds.js')`) so the self-check can see every world.

Five worlds read real data, passed in through `env` by `app.js`:

- FILESYSTEM: `fs:list` for the focused pane's folder.
- GIT GALAXY: `git:log` in `main.js` runs `git log --all --topo-order -n 150` in the focused
  pane's folder (null if it is not a repository or git is missing; the world then draws a
  made-up history). `gitLanes()` gives each commit a lane the way `git log --graph` does: a
  commit takes the lane that was waiting for it, its first parent inherits the lane, other
  parents get free lanes. Each lane is a spiral arm; radius and angle both grow with the square
  root of a commit's age, which spaces commits evenly along the arm. The log is re-read on focus,
  `cd`, and 1.2 s after any `git` command, and commits not seen before ignite.

- NETWATCH, PROCESS HIVE, NEWSWIRE: `sysinfo.js` in the main process. Connections come from
  `netstat -no` (Windows), `netstat -anv -p tcp` (macOS) or `ss -tnH` (Linux); established,
  non-loopback peers only. Programs come from `Get-Process` (Windows, CPU seconds, so the
  percentage is the change between polls) or `ps -axo comm=,%cpu=,rss=`, grouped by name, top
  48 by memory. Both are polled every 3 s while their world shows and every 20-30 s otherwise,
  so NYX can still react. Feeds are RSS or Atom parsed with a few regular expressions (a title
  list does not need an XML library), fetched by main and pushed to the page.
  The parsers are separate from the commands and the self-check feeds them sample output from
  each platform.

NEWSWIRE wipes each ticker band to black before drawing its text: text that moves across the
world's fading trails otherwise smears into an unreadable double image.

`Worlds.signal(kind)` passes events to any world with a `signal` handler. `app.js` sends
`error` when a command's output looks like an error and `ok` 1.5 s after a command that did not;
ICE WALL flares on the first and cracks open on the second.

## The jukebox

`renderer/jukebox.js` plays a folder of the user's music instead of the synth. Three things that
took finding out:

- **Serving the files.** The page is `file://` with a strict CSP, so `main.js` registers a
  `gibson-music:` protocol (privileged before `ready`: `standard`, `secure`, `stream` so `<audio>`
  can seek, `corsEnabled`) that serves audio files from inside the chosen folder only.
- **WebAudio heard silence.** The beat detector routes the `<audio>` element through an
  analyser. Media from another origin is "tainted" and a `MediaElementSource` outputs zeros for
  it, which also silenced playback. The fix is `crossOrigin = 'anonymous'` on the element and an
  `access-control-allow-origin` header on every protocol response.
- **Finding the beat.** The analyser's bins are decibels mapped to 0-255; on that scale a kick
  and the steady bass under it differ by only a few steps, so "well above the running average"
  never triggered. The detector converts the 40-300 Hz bins back to linear magnitude, sets the
  analyser's smoothing to 0.15 (the default 0.8 smears kicks together), and calls a beat when
  energy jumps 1.5x over its running average, at most every 0.28 s. On a 140 BPM test loop it
  finds 2-3 beats a second. Volume is a gain node *after* the analyser, so detection works at
  any volume, including the silent screenshot runs.

## Headless screenshots

`--shot file.png` makes an offscreen window, runs the app with fake typing, and saves a capture.
Two things that took a while:

- An offscreen window is still clamped to the size of the current display. Over a narrow RDP
  session that gave 902 px wide captures. `win.setContentSize(1920, 1080)` after creation fixes
  it.
- The world must be pinned (`--world`) or NYX's greeting changes it mid-capture.
- Shot mode must not show the machine it runs on. `main.js` (`DEMO`, `demoHome`, `demoShell`)
  creates a made-up folder under the temp directory, starts every shell there with a fixed
  prompt (`PS C:\GIBSON>`, or `hacker@gibson:~$` for bash) and no profile, reports the folder
  to the page as `C:\GIBSON`, and names the user `hacker@gibson`. The FILESYSTEM world draws the
  folder path, which is how the first capture leaked a home directory. The demo commands avoid
  `Get-ChildItem`'s "Directory:" header for the same reason.

## Packaging

`npm run dist` runs electron-builder with the `build` block in `package.json`. Two settings
matter:

- `asarUnpack: node_modules/node-pty/**`. node-pty starts helper executables (OpenConsole,
  winpty-agent, spawn-helper) by path, and a process cannot be launched from inside an asar
  archive. node-pty rewrites `app.asar` to `app.asar.unpacked` in those paths itself.
- `npmRebuild: false`. node-pty 1.x is N-API, so the binary built for Node (on Linux) or
  shipped prebuilt (Windows, macOS) loads in Electron unchanged; rebuilding against Electron's
  headers only adds a toolchain requirement.

`app.setPath('userData', .../gibson)` keeps one config folder: a packaged build's app name is
`GIBSON` (the `productName`), which would otherwise give it a second folder on macOS and Linux.

Releases come from `.github/workflows/release.yml` on a `v*` tag: each OS builds its own
packages (macOS builds both x64 and arm64), and a final job publishes them with that version's
CHANGELOG section as the notes. Nothing is signed.
