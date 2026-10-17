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
- **The page.** Context isolation is on, Node integration is off, and the page's only
  capabilities are the ones in `preload.js`. A Content-Security-Policy blocks remote scripts.
  Links clicked in the terminal open in your default browser, not in GIBSON.

Report a vulnerability privately through GitHub: the repository's **Security** tab, then
**Report a vulnerability**. Please do not open a public issue for it.

The installers are not code-signed yet. Download them only from this repository's Releases page.
