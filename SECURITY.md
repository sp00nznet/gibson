# Security

GIBSON runs a real shell and can send terminal activity to a language model. What leaves the
machine, and where keys live:

- **What NYX sends.** Each event sends the kind of event, the hour, your typing speed, your
  username, the current directory and the command you typed. The last ~600 characters of
  terminal *output* are sent only when `llm.shareOutput` is `true` (default `false`). The
  default provider is a local Ollama, so by default nothing leaves the machine.
- **Commands can contain secrets.** A command like `curl -H "Authorization: ..."` is sent as
  typed when a hosted provider (Anthropic, OpenAI) is configured. Use `ollama` or `none` if
  that matters to you.
- **API keys.** Prefer the `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` environment variables. A key
  put in `config.json` (see the README for its path on each system) is stored in plain text. Keys stay in
  the main process; the page never receives them (`main.js` strips `apiKey` before handing
  the config over).
- **NETWATCH, TRAFFIC MAP and PROCESS HIVE** run `netstat` / `ss` and `ps` / `Get-Process` locally. Addresses
  and program names are drawn on your screen and go nowhere else, except that NYX is told the
  *service* of a new kind of connection ("https", "ssh", never the address) and the name of a
  program hogging the CPU. With a hosted model, those words leave the machine.
  The TRAFFIC MAP places addresses with a built-in table of address blocks; no geoip service
  is asked. Its "home" is a guess from your time zone, drawn on screen only.
- **NEWSWIRE** fetches the RSS/Atom URLs in `news.feeds` every `news.minutes` (default: Hacker
  News and The Register's security feed). Those requests carry nothing about you beyond what
  any feed reader sends. `"feeds": []` stops them. Headlines are passed to NYX.
- **The jukebox** plays files from the folder you choose, through a `gibson-music:` protocol that
  serves audio files from inside that folder only (no `file://` access for the page). Nothing is
  copied or uploaded. NYX is told the file name of the track that starts.
- **IRC lobby.** The default is a simulated channel: nothing leaves the machine except, with an
  LLM configured, what you type to NYX there (as with `nyx <message>`). Real mode connects only
  when `irc.mode` is `"real"`, only once you open the panel, and sends only the nick you chose (a
  made-up `gibsonNNN` if blank) and what you type. The password is kept in the main process.
- **Clickable file paths** open only files that exist under the pane's folder. Programs and scripts
  are never run from a click: they are shown in their folder unless you set an `editor`.
- **`dial`, `wardial`, `scan`** are local theatre: no modem, no network, no scan. The BBS is a
  program shipped with GIBSON (`bbs/`), run on pipes.
- **The quake key** is a global shortcut registered with the OS while GIBSON runs.
- **Shell profiles and start tabs** are read from and written to `config.json` only; the shells
  are whatever programs you name there, run as you.
- **Screenshots** (`--shot`) never show the machine they run on: a made-up folder, user,
  connections, programs and headlines.
- **The page.** Context isolation is on, Node integration is off, and the page's only
  capabilities are the ones in `preload.js`. A Content-Security-Policy blocks remote scripts.
  Links clicked in the terminal open in your default browser, not in GIBSON.

Report a vulnerability privately through GitHub: the repository's **Security** tab, then
**Report a vulnerability**. Please do not open a public issue for it.

The installers are not code-signed yet. Download them only from this repository's Releases page.
