// The only doorway between the page and the machine. Keep it this small.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gibson', {
  boot: () => ipcRenderer.invoke('boot'),
  open: (id, opts) => ipcRenderer.send('pty:open', id, opts),
  close: (id) => ipcRenderer.send('pty:close', id),
  write: (id, d) => ipcRenderer.send('pty:write', id, d),
  resize: (id, c, r) => ipcRenderer.send('pty:resize', id, c, r),
  line: (id, l) => ipcRenderer.send('pty:line', id, l),
  onData: (fn) => ipcRenderer.on('pty:data', (_e, id, d) => fn(id, d)),
  listDir: (id) => ipcRenderer.invoke('fs:list', id),
  gitLog: (id) => ipcRenderer.invoke('git:log', id),
  net: () => ipcRenderer.invoke('sys:net'),
  procs: () => ipcRenderer.invoke('sys:procs'),
  onNews: (fn) => ipcRenderer.on('news', (_e, items) => fn(items)),
  onHotkey: (fn) => ipcRenderer.on('hotkey', (_e, a) => fn(a)),
  menu: (state) => ipcRenderer.send('menu', state),
  shellMenu: () => ipcRenderer.send('menu:shells'),
  saveTabs: (list) => ipcRenderer.send('tabs:save', list),
  musicList: () => ipcRenderer.invoke('music:list'),
  musicPick: () => ipcRenderer.invoke('music:pick'),
  save: (key, v) => ipcRenderer.send('cfg:save', key, v),
  llm: (ev) => ipcRenderer.invoke('nyx:llm', ev),
  fullscreen: () => ipcRenderer.send('win:fullscreen'),
});
