# GIBSON

![GIBSON: three tabs, two panes and NYX talking back, over a neon city](docs/screenshots/tabs.png)

> *"Hack the planet!"* &nbsp;—&nbsp; a cracktro you can actually work in.

GIBSON is a real terminal dressed up as a 1997 demoscene intro. Your shell sits in the middle of
the screen while wireframe worlds roar past behind it: your own folders as a Hackers-style city,
your git history as a spiral galaxy, your live network connections as satellites, the Gibson
mainframe itself. A synthesized techno/industrial soundtrack speeds up when you work hard and
slumps when you slack off. Or point it at your own music folder and it pumps the visuals to *your*
beat.

Watching it all is **NYX**, the unseen sysop. She greets you when you dial in, needles you about
typos, gasps at `rm -rf`, gets bored when you go idle, comments on the news and your playlist,
and changes the world behind your terminal to suit her mood. Type `nyx <anything>` and she answers.
Give her a brain (a small model GIBSON downloads and runs itself, a Claude key, or your own Ollama
or llama.cpp server) and she's a proper assistant: she reads
and searches your files, edits them and runs commands to get the job done, asking before she
changes anything. Without one she has plenty to say anyway.

And the rest of 1995 is in here too: `dial 555-0199` for a BBS with a door game, `wardial` for
numbers that answer, `nfo` for a release's art with a chiptune, `scan` for some port-scan
theatre, a `#hackers` IRC lobby pinned beside your shell, tracker music in the jukebox, a keygen
window, and a Da Vinci red alert when you type `rm -rf`.

It is mostly for fun. But some of it is genuinely handy:

- **It's a proper terminal.** PowerShell, cmd, bash, zsh, each WSL distro; tabs you can rename,
  colour, drag, tear off into their own windows (or drop into another one) and save; up to four resizable panes per tab; find in scrollback; type into every
  pane at once; clickable `file:line` links that open your editor; a ping when a long command
  finishes while you're elsewhere; a paste guard; a quake-style summon key.
- **NETWATCH** draws every live TCP connection your machine has, labelled by service. A new kind
  of connection flares, and NYX will mention it.
- **PROCESS HIVE** is a honeycomb of your running programs: height is memory, heat is CPU, and a
  runaway process glows red, shakes, and gets called out.
- **NEWSWIRE** crawls your RSS feeds across LED tickers, and NYX reacts to fresh headlines.
- **GIT GALAXY** shows the repo you're in as spiral arms, one per branch; new commits ignite.

## Status

**0.10.0, alpha.** Windows is the tested platform (PowerShell via ConPTY). macOS and Linux builds
are produced and smoke-tested by CI, but nobody has lived in them yet.

| | |
|---|---|
| Real shell (node-pty), xterm.js 6 with WebGL, links, Unicode 11 | done |
| Tabs, each with 1 to 4 tiled panes; per-pane opacity; framed or full-window; hideable logo and scroller | done |
| Talk to NYX from any pane: `nyx <message>` | done |
| Twenty-eight wireframe worlds, five of them live system data or your RSS feeds | done |
| Find, text size, pane resize/zoom, broadcast input, file links, finished-command alerts, paste guard, quake key | done |
| `dial` a BBS (with a door game), `wardial`, `nfo`, `scan`, the cookie monster, the red alert | done |
| IRC lobby beside the terminal: a simulated #hackers, or a real server | done (real mode tested against a local server) |
| Tracker modules (.mod .xm .s3m .it) in the jukebox; a Winamp-style player | done |
| Shell profiles (PowerShell, PowerShell 7, cmd, WSL, Git Bash, your own); start tabs that reopen in their folders | done |
| Reactive synth soundtrack, 84 to 162 BPM, following your activity | done |
| Jukebox: your own music folder, with controls, visuals pumping on its beat | done |
| Modem dial-in on startup (DTMF, answer tone, handshake screech) | done |
| NYX via Ollama, Anthropic or any OpenAI-compatible API, or canned lines | done (Ollama tested live) |
| NYX as an assistant: reads, searches, edits files and runs commands (asks first) | done (Ollama tested live) |
| A built-in brain: Qwen3 models run inside GIBSON (node-llama-cpp), downloaded on request | done (0.6B and 1.7B tested live) |
| Cigarette that burns during builds; Matrix rain flickers | done |
| Installers for Windows, macOS, Linux (unsigned) | done, built by CI |

## Screenshots

Straight from the app, captured headless in a made-up folder (`npm run shots`), so nothing here
is anyone's real machine.

| | |
|---|---|
| ![Your folder as a wireframe city](docs/screenshots/files.png) **FILESYSTEM**: the folder you `cd` into, as towers | ![The Gibson mainframe](docs/screenshots/core.png) **GIBSON CORE**: where `ssh`, `sudo` and `rm -rf` take you |
| ![Live connections as satellites](docs/screenshots/net.png) **NETWATCH**: your live TCP connections | ![Headlines on LED tickers](docs/screenshots/news.png) **NEWSWIRE**: your RSS feeds, crawling |
| ![A 90s BBS](docs/screenshots/bbs.png) **BBS LOBBY**: the board you dial into at boot | ![Black ICE](docs/screenshots/ice.png) **ICE WALL**: red on an error, cracks open on success |
| ![Light cycles](docs/screenshots/cycles.png) **LIGHT CYCLES**: six riders, one arena | ![Battlezone](docs/screenshots/battlezone.png) **BATTLEZONE**: vector tanks and a radar sweep |
| ![Four panes, four opacities](docs/screenshots/tiled.png) **Four panes**, each at its own opacity | ![Full window](docs/screenshots/unframed.png) **Full window**: no frame, the planet behind your panes |
| ![Space battle](docs/screenshots/battle.png) **DEEP SPACE**: fleets trading lasers | ![Data tunnel](docs/screenshots/tunnel.png) **DATASTREAM**: down the wire |
| ![Flying toasters](docs/screenshots/toasters.png) **FLYING TOASTERS**: and toast, some of it burnt | ![Hack the planet](docs/screenshots/hack.png) **HACK THE PLANET**: the Earth, a Jolly Roger floppy, the words going round |
| ![World news on a globe](docs/screenshots/newsglobe.png) **WORLD NEWS**: headlines pop up where they happened | ![Your traffic on a globe](docs/screenshots/traffic.png) **TRAFFIC MAP**: your connections arcing out from home |
| ![A keygen](docs/screenshots/keygen.png) **KEYGEN**: serials, greetz, copper bars; when a build finishes | ![The garbage file](docs/screenshots/garbage.png) **THE GARBAGE FILE**: hunted through the Gibson's tree |
| ![Dialing a BBS](docs/screenshots/dial.png) **`dial 555-0199`**: a BBS in a tab, with a door game | ![The IRC lobby](docs/screenshots/irc.png) **IRC lobby**: #hackers beside your shell (`Ctrl+Shift+I`) |
| ![Gibson towers](docs/screenshots/towers.png) **GIBSON TOWERS**: flying the glass canyons | ![Milkdrop tunnel](docs/screenshots/milkdrop.png) **MILKDROP**: tunnel, kaleidoscope and starburst presets that follow your music |
| ![Megacity 2049](docs/screenshots/cyberpunk.png) **MEGACITY 2049**: a spinner through neon, rain and holograms | ![Ground zero](docs/screenshots/ruins.png) **GROUND ZERO**: the city after the bombs, a Geiger counter ticking |
| ![Manhattan 1995](docs/screenshots/skyline.png) **MANHATTAN 1995**: the skyline from a Brooklyn rooftop | ![Kaleidoscope](docs/screenshots/kaleido.png) **MILKDROP // KALEIDOSCOPE** |
| ![Mystify](docs/screenshots/mystify.png) **MYSTIFY**: two polygons and their echoes, bouncing | ![Lunatic Fringe](docs/screenshots/fringe.png) **LUNATIC FRINGE**: a vector shooter that plays itself |
| ![Strange attractor](docs/screenshots/attractor.png) **STRANGE ATTRACTOR**: Lorenz, Aizawa, Thomas, Halvorsen, as glowing filaments | ![DNA helix](docs/screenshots/helix.png) **DNA HELIX**: base pairs, and the Gibson's genome in hex |
| ![3D Flowerbox](docs/screenshots/flowerbox.png) **3D FLOWERBOX**: cube to sphere to flower, with echoes | ![Nocturne](docs/screenshots/nocturne.png) **NOCTURNE**: eyes in the dark, watching your terminal |
| ![Game of Life](docs/screenshots/life.png) **GAME OF LIFE**: Conway on a plane, the old cells rising | ![Deathmatch](docs/screenshots/deathmatch.png) **DEATHMATCH**: a wireframe arena shooter that plays itself behind you |
| ![Endless road](docs/screenshots/endless.png) **ENDLESS ROAD**: anti-grav racing on a road that morphs from one equation into the next | ![Anti-grav race](docs/screenshots/antigrav.png) **ANTI-GRAV RACE**: three laps on an equation against seven rivals |
| ![Vector tube](docs/screenshots/tube.png) **VECTOR TUBE**: a claw on the rim of a tube, flippers climbing up it | ![Trench run](docs/screenshots/trench.png) **TRENCH RUN**: down the trench, turrets firing, then the exhaust port |
| ![Free trader](docs/screenshots/trader.png) **FREE TRADER**: pirates, docking, hyperspace, trading between systems | ![Rock field](docs/screenshots/rocks.png) **ROCK FIELD**: asteroids in 3D, splitting as they're shot |
| ![Lunar lander](docs/screenshots/lander.png) **LUNAR LANDER**: an autopilot that usually lands | ![Stunt track](docs/screenshots/stunt.png) **STUNT TRACK**: a raised track with jumps, a rival and a crane |
| ![Outatime](docs/screenshots/outatime.png) **OUTATIME**: a DeLorean builds to 88 mph as you type, folds its wheels and flies off, leaving fire trails | ![Starfighter](docs/screenshots/starfighter.png) **STARFIGHTER**: the Gunstar holds the Frontier against Ko-Dan waves; every 20 kills, the Death Blossom |
| ![Wopr](docs/screenshots/wopr.png) **WOPR**: the war room runs every scenario, faster and faster, until it learns | ![Spinner](docs/screenshots/spinner.png) **SPINNER**: a police flyer in the rain between arcologies and burning refinery stacks |
| ![Navigator](docs/screenshots/navigator.png) **NAVIGATOR**: a chrome teardrop ship skimming the sea and hills | ![Explorers](docs/screenshots/explorers.png) **EXPLORERS**: a homemade bubble ship from a backyard to the stars |
| ![Blipvert](docs/screenshots/headroom.png) **BLIPVERT**: a stuttering TV host in a spinning room of grids | ![Arrakis](docs/screenshots/arrakis.png) **ARRAKIS**: dunes, an ornithopter, wormsign, then the worm |
| ![Motion Tracker](docs/screenshots/tracker.png) **MOTION TRACKER**: a corridor, a pinging tracker, sentry guns counting down | ![The Real](docs/screenshots/real.png) **THE REAL**: a battered hovercraft through ruined tunnels and the scorched surface, sentinels and the EMP |
| ![Neo-Tokyo](docs/screenshots/akira.png) **NEO-TOKYO**: a red bike and its tail-light trail down a ruined highway | ![Thermoptic](docs/screenshots/thermoptic.png) **THERMOPTIC**: the rooftop dive, cloaking as she falls |
| ![Cyberbrain](docs/screenshots/cyberbrain.png) **CYBERBRAIN**: a ghost-hack dive through barriers to a brain of nodes | ![Spider Tank](docs/screenshots/spidertank.png) **SPIDER TANK**: a museum hall, a tree of life, columns going to pieces |
| ![Missile Circus](docs/screenshots/macross.png) **MISSILE CIRCUS**: volleys of corkscrewing missiles round a transforming jet | ![Valkyrie](docs/screenshots/valkyrie.png) **VALKYRIE**: a fighter turning into GERWALK and battroid on a turntable |
| ![Bebop](docs/screenshots/bebop.png) **BEBOP**: a red fighter through asteroids and hyperspace gates, swinging on the beat | ![Angel Attack](docs/screenshots/eva.png) **ANGEL ATTACK**: an angel over a sinking city, hex warnings and a sync-ratio meter |
| ![Hardsuit](docs/screenshots/hardsuit.png) **HARDSUIT**: four armoured skaters against a rogue android on the freeway | ![Police Labor](docs/screenshots/labor.png) **POLICE LABOR**: a patrol robot walks the harbour at dawn |
| ![Colony](docs/screenshots/gundam.png) **COLONY**: a mobile-suit duel under a turning space colony | ![The Wired](docs/screenshots/wired.png) **THE WIRED**: humming power lines, a dark room of towers, PRESENT DAY |
| ![Wave Motion](docs/screenshots/yamato.png) **WAVE MOTION**: a space battleship charges its bow gun, and fires | ![On Air](docs/screenshots/radio.png) **ON AIR**: a late-night radio booth riding whatever's playing |
| ![Switchboard](docs/screenshots/switchboard.png) **SWITCHBOARD**: a 1940s exchange: lamps, cords, NUMBER, PLEASE? | ![Telegraph](docs/screenshots/telegraph.png) **TELEGRAPH**: the key taps out your commands in Morse onto ticker tape |
| ![Mission Control](docs/screenshots/mission.png) **MISSION CONTROL**: a countdown that runs during your builds, then liftoff | ![Pneumatic Post](docs/screenshots/pneumatic.png) **PNEUMATIC POST**: a capsule down the tubes for every network connection |
| ![Mainframe](docs/screenshots/mainframe.png) **MAINFRAME**: tape drives and lamp panels keeping pace with your CPU | ![Video Store](docs/screenshots/videostore.png) **VIDEO STORE**: aisles of tapes and a window of TVs, late at night |
| ![Arcade](docs/screenshots/arcade.png) **ARCADE**: cabinets in attract mode at closing time | ![Pirate Radio](docs/screenshots/pirateradio.png) **PIRATE RADIO**: a broadcast ship rolling on the night sea |
| ![Numbers Station](docs/screenshots/numbers.png) **NUMBERS STATION**: a shortwave set reading out five-digit groups | ![Night Sky](docs/screenshots/sky.png) **NIGHT SKY**: the stars, planets and Moon over you right now (your time zone's best guess) |
| ![Data Center](docs/screenshots/datacenter.png) **DATA CENTER**: an endless cold aisle of blinking racks | ![Usenet](docs/screenshots/usenet.png) **USENET**: the newsgroup tree, a newsreader in the margins, searching for your words |
| ![Defrag](docs/screenshots/defrag.png) **DEFRAG**: a disk optimizer packing clusters, faster while you build | ![Seti](docs/screenshots/seti.png) **SETI**: a radio-search waterfall hunting for a candidate signal |
| ![Sneakers](docs/screenshots/sneakers.png) **SNEAKERS**: letters resolve, then fly into the anagram: TOO MANY SECRETS | ![Demoparty](docs/screenshots/demoparty.png) **DEMOPARTY**: plasma, rotozoomer, copper bars and vector balls, with greets |
| ![Ansi Gallery](docs/screenshots/ansi.png) **ANSI GALLERY**: block-art logos and .NFOs drawn at modem speed | ![War Dialer](docs/screenshots/wardialer.png) **WAR DIALER**: a board of 555 numbers dialed one by one, hunting carriers |
| ![Y2K](docs/screenshots/y2k.png) **Y2K**: the countdown to 2000, then 01-JAN-1900, then the patch | ![Messenger](docs/screenshots/messenger.png) **MESSENGER**: a buddy list, doors opening, chat windows floating by |
| ![Homepage](docs/screenshots/geocities.png) **HOMEPAGE**: a 1998 homepage: under construction, hit counter, webring | ![Hacker Con](docs/screenshots/defcon.png) **HACKER CON**: a dark con floor, blinking badges, the wall of sheep, CTF scores |

Also in the box: THE GRID, NEON CITY, ORBIT, RAVE WAREHOUSE, GIT GALAXY, HIGHWAY, DEEP SEA,
PROCESS HIVE, 3D PIPES, 3D MAZE and THE STREET.

## Getting Started

### Quick start

**Easiest:** grab the build for your system from
[Releases](https://github.com/sp00nznet/gibson/releases/latest):

| System | File |
|---|---|
| Windows | `GIBSON-<version>-win-x64-setup.exe` (installer) or `-portable.exe` (no install) |
| macOS | `GIBSON-<version>-mac-arm64.dmg` (Apple silicon) or `-mac-x64.dmg` (Intel) |
| Linux | `GIBSON-<version>-linux-x86_64.AppImage`, or the `.deb` / `.tar.gz` |

The builds are not code-signed. Windows SmartScreen will say "Windows protected your PC": click
**More info**, then **Run anyway**. macOS will say the app "cannot be opened": right-click it,
choose **Open**, then **Open** again (or run `xattr -cr /Applications/GIBSON.app`). On Linux,
`chmod +x` the AppImage first.

**From the source:** download this repository as a zip and unpack it, then:

1. Windows: double-click **`Setup.cmd`**. macOS / Linux: run **`./setup.sh`**.
   It checks for Node.js (and offers to install it), installs the packages, runs the
   self-check, offers NYX's local model if you have Ollama, and makes a launcher.
2. Double-click **`GIBSON.lnk`** (Windows), **`GIBSON.command`** (macOS) or
   **`GIBSON.desktop`** (Linux). Listen to the modem dial in, or press any key to skip it.

If something fails, the script says what to do next and the details are in `setup.log`.

### Step by step

Prerequisites: Node.js 20 or newer (tested on 22 and 24). On Linux, node-pty is compiled during
install, so you also need `make`, `g++` and `python3` (`sudo apt install build-essential
python3`). Optional: [Ollama](https://ollama.com) for NYX's local brain.

1. Install packages (Electron is about 250 MB):
   ```
   npm install
   ```
2. Run the self-check:
   ```
   npm test
   ```
   Expected output:
   ```
   > gibson@0.7.0 test
   > node test/check.mjs

   check: all passed
   ```
3. Optional, give NYX a local model:
   ```
   ollama pull llama3.2:3b
   ```
4. Jack in:
   ```
   npm start
   ```

Trip-ups:

- **Windows:** after installing Node, open a **new** terminal so `npm` is on the PATH.
- **Linux, `npm start` says "The SUID sandbox helper binary was found, but is not configured
  correctly":** Electron's sandbox helper needs root ownership when run from `node_modules`:
  `sudo chown root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755
  node_modules/electron/dist/chrome-sandbox`. The AppImage does not need this.
- **NYX never says anything new:** check `ollama list`, then
  `curl http://127.0.0.1:11434/api/chat -d "{\"model\":\"llama3.2:3b\",\"messages\":[]}"`.
  A model can be listed but missing its files on disk, which returns
  `model "..." not found, try pulling it first` (pull it again).

## Usage

Everything below is also on the **right-click menu**.

**Terminal**

| Key | Does |
|---|---|
| `nyx <message>` | type it (or recall it with Up) in any pane and press Enter: NYX answers; the shell never runs it. With a brain she works in that pane's folder: `nyx why does npm test fail?` |
| `Ctrl+Shift+T` / `Ctrl+Shift+X` | new tab / close tab (or the `+` button, and the `x` on each tab or a middle-click) |
| `▾` next to `+` | new tab with another shell: PowerShell, PowerShell 7, cmd, WSL, Git Bash, whatever is installed |
| double-click a tab | rename it (Enter keeps it, Esc backs out, empty goes back to the folder name); also right-click > Rename tab |
| drag a tab | move it; drop it outside the window and it opens in a window of its own, shells still running. Right-click > Tab colour to colour it |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | next / previous tab (also `Ctrl+PageDown` / `Ctrl+PageUp`) |
| `Ctrl+Shift+1`..`4` | that many panes in this tab, opening in the focused pane's folder. Drag the gaps to resize; right-click > Panes > Even out |
| `Ctrl+Shift+Z` | zoom the focused pane to fill the tab, and back |
| `Ctrl+Shift+A` | type into every pane in this tab at once (gold borders while it's on) |
| `Ctrl+Shift+F` | find in scrollback: Enter next, Shift+Enter previous, Esc closes |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | text bigger / smaller / reset (or Ctrl+mouse wheel); remembered |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | copy / paste. More than one line asks first (right-click to turn that off) |
| click a `file:line` | opens it in your editor at that line (VS Code if it's installed, or `editor` in the settings) |
| `Alt+`` ` | from anywhere: summon GIBSON, or send it away (`quake` in the settings) |

A command that runs longer than 10 seconds while you're in another tab or another app pops a
notification when it finishes, and its tab gets a dot.

**Hacker commands** (typed at your prompt; the shell never sees them)

| Command | Does |
|---|---|
| `dial 555-0199` | the modem sings and a BBS answers in a new tab: message bases, 0-day file areas, who's online, chat with the sysop, and a door game, LEGEND OF THE NEON DRAGON. Odd numbers get a different board |
| `wardial 555` | a war dialer ringing through a block of numbers; when one answers with a carrier, NYX tells you which to `dial` |
| `nfo readme.nfo` | shows a release's .nfo in proper CP437 block art, scrolling, with a chiptune. Esc closes |
| `scan gibson.ellingson.net` | port-scan theatre. Nothing is actually scanned |
| `cookie` | the cookie monster. Feed it. (It may also turn up on its own after a long break; `eggs: false` stops that) |
| `hack the planet` | where you'd expect |

`rm -rf`, `Remove-Item -Recurse`, `format` and friends get the Da Vinci red alert. It's
see-through and never stops you typing. `hackerCommands: false` hands all of these back to your
shell.

**The look**

| Key | Does |
|---|---|
| `Ctrl+Shift+O` | this pane's opacity, 100% down to 0% (the world shows through) |
| `Ctrl+Shift+U` | framed (centred, glowing border) or full window |
| `Ctrl+Shift+L` | hide or show the GIBSON logo bar |
| `Ctrl+Shift+S` | hide or show the scroller along the bottom |
| `Ctrl+Shift+D` | hide or show the data packets streaming in from the sides |
| `Ctrl+Shift+W` | next world (the right-click menu picks any) |
| `Ctrl+Shift+R` | Matrix rain, now |
| `Ctrl+Shift+N` | NYX on/off (right-click > NYX > Speaks 1337, for the elite) |
| `Ctrl+Shift+I` | the IRC lobby beside your terminal |
| `F11` | fullscreen |

**Extras**, each a checkbox on the right-click menu:

- **Look > Hollywood hacking**: every command gets the movie treatment: hex spinning, BYPASSING FIREWALL..., then ACCESS GRANTED (or DENIED when it fails).
- **Look > CRT mode**: heavier scanlines, a curved dark edge, glowing phosphor and flicker.
- **Look > Blue screen on errors**: a failed command flashes a fake blue screen over its pane (at most every 20 s).
- **Look > Window style: classic**: grey bevelled frames and a title bar on every pane.
- **Look > BIOS boot screen**: a 90s power-on self test at startup, with your real CPU, memory and drives.
- **Music > Keyboard sounds**: a clacky mechanical keyboard, Enter and Space included.
- **NYX > Message chimes** (on by default): little chimes when NYX speaks, a command fails or news comes in.

**Music**

| Key | Does |
|---|---|
| `Ctrl+Shift+M` | music on/off |
| `Ctrl+Shift+J` | switch between the synth and your music folder (asks for a folder the first time) |
| `Ctrl+Shift+P` | play / pause |
| `Ctrl+Shift+]` / `Ctrl+Shift+[` | next / previous track |
| `Ctrl+Shift+=` / `Ctrl+Shift+-` | volume up / down |
| `Ctrl+Shift+B` | synth tempo: follows your activity, or locked at `music.bpm` |
| `Ctrl+Shift+G` | the system monitor: CPU and network graph, memory, free space on each disk, network in/out, top processes |
| `Ctrl+Shift+K` | the synth panel: filter, resonance, low cut, drive and echo on whatever is playing; for the synth, style, layers, key and next song; for your music, tape speed |

The **synth** follows your activity averaged over about 12 seconds (typing, and output scrolling
past), so a burst barely moves it and a long session drives it up. Every 64 bars it starts a new
song in a new key and style: industrial, outrun, electro, EBM, italo, halftime or breakbeat.
Every world dances to whatever is playing (right-click > Music > Worlds dance to the music). The **jukebox** plays a folder
of your own music (mp3, ogg, opus, flac, wav, m4a, and tracker modules: .mod .xm .s3m .it and
friends; subfolders too) at its normal speed, shuffled or in order, in a little Winamp-style
player in the bottom-right corner with a spectrum analyser. GIBSON listens for the bass in
whatever is playing, so the frame and the worlds still pump on the beat, and NYX has opinions
about your taste.

**Worlds** change with NYX's mood and with what you do:

| World | When |
|---|---|
| BBS LOBBY | you log in |
| FILESYSTEM | you `cd` (towers are the folder's real entries) |
| GIT GALAXY | any `git` command (your repo's last 150 commits; new ones ignite) |
| ICE WALL | an error (it cracks open when the next command works) |
| GIBSON CORE, THE GARBAGE FILE, GROUND ZERO | `ssh`, `sudo`, `rm -rf` and friends, or NYX feeling intense |
| RAVE WAREHOUSE, HACK THE PLANET, GIBSON TOWERS, MEGACITY 2049, DEATHMATCH, ENDLESS ROAD, ANTI-GRAV RACE, VECTOR TUBE, TRENCH RUN | a typing streak (or type `hack the planet`) |
| MILKDROP (tunnel, kaleidoscope, starburst) | a new track starts in the jukebox |
| 3D PIPES, DNA HELIX | a long build (the screensaver while you wait) |
| KEYGEN | the build finishes |
| 3D MAZE, MANHATTAN 1995, MYSTIFY, 3D FLOWERBOX, GAME OF LIFE, NOCTURNE, LUNAR LANDER, FREE TRADER | you go idle (the screensaver kicks in) |
| NETWATCH, TRAFFIC MAP | a kind of connection you haven't made this session |
| PROCESS HIVE | a program hogging the CPU |
| NEWSWIRE, WORLD NEWS | a fresh headline on your feeds |
| LIGHT CYCLES, LUNATIC FRINGE, ROCK FIELD, STUNT TRACK | NYX feeling playful |
| NOCTURNE, DEATHMATCH | NYX feeling taunting |
| STRANGE ATTRACTOR | NYX feeling impressed |
| HIGHWAY, NEON CITY, DEEP SPACE, THE GRID | NYX's other moods |
| FLYING TOASTERS | NYX feeling tender, or the menu |
| DATASTREAM, ORBIT, DEEP SEA, THE STREET, BATTLEZONE | the menu or `Ctrl+Shift+W` |

Want one world and no surprises? Right-click > World (sorted into Cyberspace, Cities, Arcade, Visualizers...) > **Start in this world** makes the current
one your default, and unticking **NYX picks the world** stops her moving you anywhere.

The TRAFFIC MAP places addresses by which internet registry owns their block (Americas, Europe,
Asia-Pacific, Latin America, Africa), not by geoip: nothing is looked up or sent anywhere, and it
is continent-level at best. Home is guessed from your clock's time zone.

**Settings** live in `config.json`, created on first run. The view choices (opacity, frame, logo,
scroller, packets, cigarette, start world, default shell, start tabs) and the music choices are
remembered for you; everything else you edit by hand
("Open config.json" on the right-click menu), then restart.

| System | Path |
|---|---|
| Windows | `%APPDATA%\gibson\config.json` |
| macOS | `~/Library/Application Support/gibson/config.json` |
| Linux | `~/.config/gibson/config.json` |

**Sync settings between machines** through a secret gist on your GitHub (right-click >
Settings > Sync settings to GitHub):

1. **Make a token on GitHub** opens GitHub's new-token page with only the `gist` scope ticked.
   Generate it and copy it.
2. **Copy it, then click here to use it** reads the token from the clipboard, checks it with
   GitHub, then clears the clipboard. The token is kept encrypted by your OS, never in config.json.
3. **Upload settings** on the machine you like, **Download settings** on the others.

Your LLM API key and IRC password are never uploaded; a download keeps the ones already on that
machine. **Forget the token** deletes it here; revoke it on GitHub too when you're done.

```json
{
  "defaultShell": "PowerShell",
  "profiles": [{ "name": "recomp", "shell": "wsl.exe", "args": [], "cwd": "G:\recomp" }],
  "startupTabs": [{ "profile": "PowerShell", "cwd": "F:\projects", "panes": 1 }, { "profile": "WSL", "cwd": "G:\recomp", "panes": 2 }],
  "world": "",
  "nyxWorlds": true,
  "cigarette": true,
  "fontSize": 15,
  "splitHere": true,
  "pasteGuard": true,
  "notifyAfterSec": 10,
  "editor": "",
  "quake": { "key": "Alt+`", "dock": false },
  "hackerCommands": true,
  "eggs": true,
  "irc": { "mode": "fake", "server": "irc.libera.chat", "port": 6697, "tls": true, "nick": "", "channels": ["#gibson"], "password": "" },
  "ircOpen": false,
  "boot": true,
  "framed": true,
  "logo": true,
  "scroller": true,
  "packets": true,
  "opacity": 0.86,
  "music": { "on": true, "source": "synth", "folder": "", "shuffle": true, "mode": "reactive", "bpm": 128, "volume": 0.55 },
  "news":  { "feeds": ["https://hnrss.org/frontpage", "https://www.theregister.com/security/headlines.atom"], "minutes": 15 },
  "nyx":   { "on": true, "voice": false, "chatter": 0.35 },
  "llm":   { "provider": "local", "models": {}, "urls": {}, "apiKey": "", "shareOutput": false, "minGapSec": 20 }
}
```

- **Shells.** GIBSON finds the installed ones (Windows: PowerShell, PowerShell 7, Command Prompt,
  Git Bash, and each WSL distro by name, Docker Desktop's skipped; elsewhere: `$SHELL` and
  everything in `/etc/shells`, as login shells on macOS). Pick the default with right-click >
  Tab > Default shell (saved as `defaultShell`), or open a tab in any of them from the `▾`
  button. `profiles` adds your own (`name`, `shell`, `args`, optional starting `cwd`); one with the
  same name as a found shell replaces it. The old `shell` / `shellArgs` settings still work as the
  default when `defaultShell` is blank.
- **Start tabs.** Set your tabs up (shell, folder, panes), then right-click > Tab > **Open these
  tabs on start**. Next launch they come back in the same shells, folders and names. Or write
  `startupTabs` by hand. "Forget the start tabs" goes back to one default tab.
- `world`: the world to start in (blank: NYX decides). `nyxWorlds: false` keeps you there.
- `cigarette`: the one that burns while you compile (also on the right-click menu).
- `splitHere`: new panes and tabs open in the focused pane's folder. `false`: your home folder.
- `editor`: what opens a clicked `file:line`, with `{file}`, `{line}`, `{col}`, e.g.
  `"subl {file}:{line}"` or `"notepad++ -n{line} {file}"`. Blank: VS Code (`code -g`) when it's on
  your PATH, else the system's handler. Programs and scripts are never run from a click; without
  an editor they're shown in their folder.
- `notifyAfterSec`: how long a command must run before its finish is worth a notification (0: never).
- `quake.key`: the global summon key, in Electron's accelerator format (`"Alt+`"`,
  `"Control+Alt+G"`...). `""` turns it off. `quake.dock: true` drops GIBSON down from the top of
  the screen like a console.
- `irc.mode`: `fake` (a simulated #hackers: the movie's cast, NYX as op, reacting to what you do),
  `real` (connects to `server` as `nick` and joins `channels`; nothing else about you is sent), or
  `off`. Switch it from the right-click menu (IRC lobby); that re-reads this section, so change
  `server`/`nick`/`channels` here, then pick Real IRC again. The panel only dials when you open it.
  Slash commands work: `/me /nick /join /part /msg /topic`.
- `music.source`: `synth` or `folder` (the jukebox, playing `music.folder`).
- `news.feeds`: any RSS or Atom URLs, fetched every `news.minutes`. `[]` turns the newswire off
  (nothing is fetched).
- `nyx.chatter`: 0 to 1, how often she comments on ordinary commands. Errors, dangerous
  commands, builds and long idles always get a line. `nyx.voice` reads her lines aloud.
- `llm.provider` (or right-click > NYX > Brain): `local` (the default: a model GIBSON runs itself.
  Right-click > NYX > **Built-in model** lists them with their size and asks before downloading:
  Qwen3 0.6B 0.4 GB, Qwen3 1.7B 1.1 GB (recommended), Qwen3 4B 2.5 GB, Qwen2.5-Coder 7B 4.7 GB.
  They live in a `models` folder beside `config.json`; the same menu deletes them. A GPU is used
  through Vulkan when there is one), `anthropic` (`claude-opus-5-5`; paste a key with right-click >
  NYX > API key, or set `ANTHROPIC_API_KEY`), `ollama` (default `llama3.2:3b`; right-click > NYX >
  Ollama > **Server address...** points her at another machine and lists its models), `openai` (key from `OPENAI_API_KEY`; set `baseUrl` for LM Studio,
  vLLM or any OpenAI-compatible server, or right-click > NYX > llama.cpp / LM Studio / OpenAI >
  **Server address...**; start llama.cpp's `llama-server` with `--jinja` so she can use tools), or `none` for canned lines only.
- `llm.shareOutput`: also send the last bit of terminal output. Off by default. What NYX sees and
  what leaves your machine is spelled out in [SECURITY.md](SECURITY.md).

**Command line**

```
npm start -- --music "D:\Music\Industrial"     play that folder from the start
npx electron . --shot out.png --world battle --panes 2 --unframed --at 8
```

`--shot` renders offscreen and saves a PNG (works over RDP; no window opens). `--world` is one of
`grid`, `city`, `files`, `battle`, `planet`, `tunnel`, `core`, `bbs`, `rave`, `git`, `ice`,
`highway`, `sea`, `pipes`, `maze`, `cycles`, `battlezone`, `street`, `net`, `hive`, `news`, `toasters`, `newsglobe`, `traffic`, `hack`;
`--tabs 3` opens three tabs and `--chat "are you real?"` types `nyx are you real?` into the first
pane. Shot mode uses a made-up folder, user, connections, programs and headlines, so a capture
never shows your machine. `npm run shots` regenerates everything in `docs/screenshots/`.

How the pieces fit: [docs/architecture.md](docs/architecture.md).

## Building from source

`npm install && npm start` runs the source directly; there is no compile step. To make the
installers for the system you are on:

```
npm run dist
```

Output lands in `dist/` (Windows: setup and portable `.exe`; macOS: `.dmg` and `.zip`; Linux:
AppImage, `.deb`, `.tar.gz`). Releases are built by CI, not by hand: pushing a `v*` tag runs
[`.github/workflows/release.yml`](.github/workflows/release.yml), which builds on all three
systems and publishes a GitHub Release with the notes from [CHANGELOG.md](CHANGELOG.md).

New worlds are one file each in `renderer/worlds/` (see `Worlds.define` in
[docs/architecture.md](docs/architecture.md)). The icon is drawn by `scripts/icon.js`
(`npm run icon`). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE). The soundtrack, the visuals and the icon are generated in code; the
repository contains no third-party assets ([PROVENANCE.md](PROVENANCE.md)). Installers bundle
Electron, xterm.js and node-pty under their own MIT licences. Your music stays yours: GIBSON
plays it from your disk and never copies or uploads it.
