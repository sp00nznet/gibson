#!/usr/bin/env bash
# GIBSON quick start for macOS and Linux. Checks Node, installs the packages, runs the
# self-check, makes a launcher. Runs exactly the steps in README "Step by step".
# Safe to rerun: done steps are skipped.
set -u
cd "$(dirname "$0")"
LOG="$PWD/setup.log"
echo "GIBSON setup $(date)" > "$LOG"
fail() { echo; echo "$1"; echo "Details are in $LOG"; exit 1; }
ask() { local a; read -r -p "$1 [y/N] " a || true; [[ ${a:-} == [yY]* ]]; }

echo; echo "  ===  G I B S O N  ===   jacking in..."; echo

if ! command -v node >/dev/null 2>&1; then
  if [[ $(uname) == Darwin ]] && command -v brew >/dev/null 2>&1; then
    echo "Node.js is not installed. GIBSON needs it to run (about 100 MB, via Homebrew)."
    ask "Install Node.js now?" || fail "Install Node.js 20 or newer from https://nodejs.org, then run ./setup.sh again."
    brew install node >>"$LOG" 2>&1 || fail "Node.js did not install."
  else
    fail "Install Node.js 20 or newer (https://nodejs.org or your package manager), then run ./setup.sh again."
  fi
fi
major=$(node -p 'process.versions.node.split(".")[0]')
(( major >= 20 )) || fail "Node.js $(node -v) is too old. Install 20 or newer, then run ./setup.sh again."
echo "Node $(node -v) found."

if [[ -d node_modules/electron/dist && -d node_modules/node-pty ]]; then
  echo "Packages already installed, skipping."
else
  if [[ $(uname) == Linux ]]; then # node-pty is compiled on Linux
    for t in make g++ python3; do
      command -v $t >/dev/null 2>&1 || fail "Missing $t, needed to build the terminal. On Debian/Ubuntu: sudo apt install build-essential python3"
    done
  fi
  echo "Installing packages (Electron and the terminal pieces, about 250 MB)..."
  npm install >>"$LOG" 2>&1 || fail "npm install failed."
fi

npm test >>"$LOG" 2>&1 || fail "The self-check failed."
echo "Self-check passed."

if command -v ollama >/dev/null 2>&1 && ! ollama list 2>/dev/null | grep -q '^llama3.2:3b'; then
  echo "Ollama is installed. NYX can use a small local model to talk (llama3.2:3b, about 2 GB)."
  if ask "Download it now?"; then ollama pull llama3.2:3b; fi
fi

if [[ $(uname) == Darwin ]]; then
  launcher=GIBSON.command
  printf '#!/bin/sh\ncd "$(dirname "$0")" && exec ./node_modules/.bin/electron .\n' > "$launcher"
else
  launcher=GIBSON.desktop
  cat > "$launcher" <<DESKTOP
[Desktop Entry]
Type=Application
Name=GIBSON
Comment=Cracktro terminal
Exec="$PWD/node_modules/.bin/electron" "$PWD"
Path=$PWD
Icon=$PWD/build/icon.png
Terminal=false
Categories=Development;System;TerminalEmulator;
DESKTOP
fi
chmod +x "$launcher"
echo; echo "Done. Double-click $launcher in this folder to jack in (or run: npm start)."; echo
