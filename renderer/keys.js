// The keymap: every bindable action and its default keys, merged with config.json's "keys"
// ({ "newtab": "Ctrl+Alt+T", "world": null } — null unbinds; a list binds several keys).
// Keys are Electron accelerator strings, canonicalised so 'shift+ctrl+t' and 'Ctrl+Shift+T' match.
// main.js catches the hard keys before xterm sees them; the page catches the soft ones (SOFT) in
// xterm's key handler, so they reach the shell whenever the page has no use for them.
// Loaded by main.js, the page and test/check.mjs, hence the export shim at the bottom.
(function (root) {
  const DEFAULT_KEYS = {
    copy: 'Ctrl+Shift+C', paste: 'Ctrl+Shift+V', find: 'Ctrl+Shift+F', 'search:all': 'Ctrl+Shift+H', palette: 'Ctrl+Shift+Space',
    newtab: 'Ctrl+Shift+T', closetab: 'Ctrl+Shift+X', nexttab: ['Ctrl+Tab', 'Ctrl+PageDown'], prevtab: ['Ctrl+Shift+Tab', 'Ctrl+PageUp'],
    'panes:1': 'Ctrl+Shift+1', 'panes:2': 'Ctrl+Shift+2', 'panes:3': 'Ctrl+Shift+3', 'panes:4': 'Ctrl+Shift+4',
    'split:right': 'Alt+Shift+=', 'split:down': 'Alt+Shift+-', closepane: null,
    'focus:left': 'Alt+Left', 'focus:right': 'Alt+Right', 'focus:up': 'Alt+Up', 'focus:down': 'Alt+Down',
    'resize:left': 'Alt+Shift+Left', 'resize:right': 'Alt+Shift+Right', 'resize:up': 'Alt+Shift+Up', 'resize:down': 'Alt+Shift+Down',
    zoompane: 'Ctrl+Shift+Z', broadcast: 'Ctrl+Shift+A', opacity: 'Ctrl+Shift+O',
    'prompt:prev': 'Ctrl+Up', 'prompt:next': 'Ctrl+Down', 'output:copy': null, 'output:save': null, 'scrollback:clear': null,
    'font:up': ['Ctrl+=', 'Ctrl+numadd'], 'font:down': ['Ctrl+-', 'Ctrl+numsub'], 'font:reset': ['Ctrl+0', 'Ctrl+num0'],
    world: 'Ctrl+Shift+W', rain: 'Ctrl+Shift+R', nyx: 'Ctrl+Shift+N', irc: 'Ctrl+Shift+I', sysmon: 'Ctrl+Shift+G', synth: 'Ctrl+Shift+K',
    frame: 'Ctrl+Shift+U', scroller: 'Ctrl+Shift+S', logo: 'Ctrl+Shift+L', packets: 'Ctrl+Shift+D', fullscreen: 'F11',
    music: 'Ctrl+Shift+M', tempo: 'Ctrl+Shift+B', 'music:toggle': 'Ctrl+Shift+P', 'music:source': 'Ctrl+Shift+J',
    'music:next': 'Ctrl+Shift+]', 'music:prev': 'Ctrl+Shift+[', 'music:volup': 'Ctrl+Shift+=', 'music:voldown': 'Ctrl+Shift+-',
  };
  // Caught in the page, and only taken from the shell when the page acts on them.
  const SOFT = new Set(['focus:left', 'focus:right', 'focus:up', 'focus:down', 'resize:left', 'resize:right', 'resize:up', 'resize:down', 'prompt:prev', 'prompt:next']);
  // Names for actions that have no right-click menu item, for the command palette.
  const LABELS = {
    'split:right': 'Split pane right', 'split:down': 'Split pane down', closepane: 'Close pane', 'search:all': 'Search every pane',
    'focus:left': 'Focus pane left', 'focus:right': 'Focus pane right', 'focus:up': 'Focus pane above', 'focus:down': 'Focus pane below',
    'resize:left': 'Resize pane left', 'resize:right': 'Resize pane right', 'resize:up': 'Resize pane up', 'resize:down': 'Resize pane down',
    'prompt:prev': 'Previous command', 'prompt:next': 'Next command', 'output:copy': 'Copy last command output', 'output:save': 'Save pane output to a file',
    'scrollback:clear': 'Clear scrollback', nexttab: 'Next tab', prevtab: 'Previous tab', fullscreen: 'Fullscreen', palette: 'Command palette',
  };

  // Key names, as Electron accelerators spell them; anything else is uppercased (letters, F-keys).
  const NAMES = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', space: 'Space', tab: 'Tab', pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End',
    enter: 'Enter', return: 'Enter', esc: 'Esc', escape: 'Esc', backspace: 'Backspace', delete: 'Delete', insert: 'Insert', plus: '=', numadd: 'numadd', numsub: 'numsub', num0: 'num0' };
  const MODS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  // 'shift+ctrl+t' → 'Ctrl+Shift+T'. Modifiers in a fixed order; CmdOrCtrl/Control count as Ctrl.
  function norm(acc) {
    let s = String(acc), key;
    if (s.endsWith('++')) { key = '+'; s = s.slice(0, -2); } else { const i = s.lastIndexOf('+'); key = s.slice(i + 1); s = i < 0 ? '' : s.slice(0, i); } // 'Ctrl++' is the + key
    const mods = new Set(s ? s.split('+').map((m) => ({ control: 'Ctrl', ctrl: 'Ctrl', cmdorctrl: 'Ctrl', commandorcontrol: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta', command: 'Meta', super: 'Meta' }[m.trim().toLowerCase()] || m)) : []);
    const k = key === '+' ? '=' : NAMES[key.toLowerCase()] || (key.length === 1 ? key.toUpperCase() : key.replace(/^f(\d+)$/i, 'F$1'));
    return [...MODS.filter((m) => mods.has(m)), k].join('+');
  }
  // A key press (Electron input or DOM KeyboardEvent) → its canonical accelerator. Punctuation and
  // digits are read from the key's position (code), so Alt+Shift+= is '=' even though key is '+'.
  const CODES = { Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']', Backquote: '`', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
    NumpadAdd: 'numadd', NumpadSubtract: 'numsub', Numpad0: 'num0', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Space: 'Space', Tab: 'Tab',
    PageUp: 'PageUp', PageDown: 'PageDown', Home: 'Home', End: 'End', Enter: 'Enter', Escape: 'Esc', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert' };
  function fromInput(i) {
    const code = i.code || '', digit = /^Digit(\d)$/.exec(code);
    const k = CODES[code] || (digit && digit[1]) || (/^Key[A-Z]$/.test(code) && i.key && i.key.length === 1 && /[a-z]/i.test(i.key) ? i.key.toUpperCase() : null) // a letter: as typed (AZERTY too)
      || (/^Key[A-Z]$/.test(code) ? code.slice(3) : null) || (/^F\d+$/.test(i.key) ? i.key : i.key && i.key.length === 1 ? i.key.toUpperCase() : i.key);
    const has = { Ctrl: i.control ?? i.ctrlKey, Alt: i.alt ?? i.altKey, Shift: i.shift ?? i.shiftKey, Meta: i.meta ?? i.metaKey };
    return [...MODS.filter((m) => has[m]), k].join('+');
  }
  // { accelerator: action } from the defaults and the user's overrides. An override replaces all of
  // that action's default keys; a key bound by the user to one action is taken from any other.
  function keymap(overrides) {
    const user = overrides || {}, out = {};
    const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
    for (const [a, v] of Object.entries(DEFAULT_KEYS)) if (!(a in user)) for (const k of list(v)) out[norm(k)] = a;
    for (const [a, v] of Object.entries(user)) for (const k of list(v)) out[norm(k)] = a;
    return out;
  }
  // The first key bound to an action, for menus and the palette ('' when none).
  const keyOf = (map, a) => Object.keys(map).find((k) => map[k] === a) || '';

  const api = { DEFAULT_KEYS, SOFT, LABELS, norm, fromInput, keymap, keyOf };
  if (typeof module !== 'undefined') module.exports = api; else root.Keys = api;
})(this);
