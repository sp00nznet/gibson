// Draws build/icon.png (1024x1024), which electron-builder turns into the .ico, .icns and
// Linux icons, plus build/icon.ico (256 px) for the Setup.cmd shortcut. Run: npx electron scripts/icon.js. Offscreen, so it works over RDP.
// Synthwave sun over a neon grid, a chrome "G" in front: the cracktro look at 16 px too.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const draw = () => {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const R = 190, rr = () => { g.beginPath(); g.roundRect(40, 40, S - 80, S - 80, R); };
  rr(); const bg = g.createLinearGradient(0, 40, 0, S - 40);
  bg.addColorStop(0, '#16002a'); bg.addColorStop(0.55, '#3a0030'); bg.addColorStop(0.56, '#05000a'); bg.addColorStop(1, '#000');
  g.fillStyle = bg; g.fill(); g.save(); rr(); g.clip();
  const H = 575; // horizon
  // sun with the classic stripes cut out of its lower half
  const sun = g.createLinearGradient(0, 230, 0, H);
  sun.addColorStop(0, '#ffe66b'); sun.addColorStop(0.5, '#ff8a3d'); sun.addColorStop(1, '#ff2e88');
  g.save(); g.beginPath(); g.arc(512, H, 300, Math.PI, 0); g.fillStyle = sun; g.shadowColor = '#ff2e88'; g.shadowBlur = 60; g.fill(); g.restore();
  g.fillStyle = '#2a0024';
  for (let i = 0; i < 6; i++) { const y = H - 150 + i * 26; g.fillRect(150, y, 724, 6 + i * 3); }
  // perspective grid
  g.strokeStyle = '#ff2e88'; g.lineWidth = 5; g.shadowColor = '#ff2e88'; g.shadowBlur = 18;
  for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(512 + i * 18, H); g.lineTo(512 + i * 150, S); g.stroke(); }
  for (let k = 0; k < 9; k++) { const y = H + Math.pow(k / 8, 2.1) * (S - H); g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  g.beginPath(); g.moveTo(0, H); g.lineTo(S, H); g.strokeStyle = '#36d6ff'; g.lineWidth = 6; g.stroke();
  // chrome G
  g.font = '900 660px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const chrome = g.createLinearGradient(0, 300, 0, 860);
  chrome.addColorStop(0, '#ffffff'); chrome.addColorStop(0.42, '#9fe9ff'); chrome.addColorStop(0.5, '#1d3b6e');
  chrome.addColorStop(0.53, '#ff7ab8'); chrome.addColorStop(1, '#fff1c2');
  g.shadowColor = '#000'; g.shadowBlur = 40; g.fillStyle = chrome; g.fillText('G', 512, 840);
  g.shadowColor = '#39ff9c'; g.shadowBlur = 24; g.lineWidth = 14; g.strokeStyle = '#39ff9c'; g.strokeText('G', 512, 840);
  g.restore();
  // neon rim
  rr(); g.lineWidth = 12; g.strokeStyle = '#39ff9c'; g.shadowColor = '#39ff9c'; g.shadowBlur = 30; g.stroke();
  const small = document.createElement('canvas'); small.width = small.height = 256;
  small.getContext('2d').drawImage(cv, 0, 0, 256, 256);
  return [cv.toDataURL('image/png'), small.toDataURL('image/png')];
};

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  const [big, small] = (await w.webContents.executeJavaScript(`(${draw})()`)).map((u) => Buffer.from(u.split(',')[1], 'base64'));
  const dir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'icon.png'), big);
  // .ico holding one 256 px PNG (Vista and later read PNG entries): header, one entry, data
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);                 // type icon, 1 image
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);               // width/height 0 = 256; planes, bpp
  head.writeUInt32LE(small.length, 14); head.writeUInt32LE(22, 18);    // size, offset
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([head, small]));
  console.log('icon:', dir);
  app.exit(0);
});
