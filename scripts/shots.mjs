// Regenerates docs/screenshots/. Headless (offscreen window), so it works over RDP.
// Shot mode runs the shells in a made-up folder behind a fixed prompt (main.js, DEMO),
// so nothing in a screenshot shows the real machine.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const electron = createRequire(import.meta.url)('electron'); // the binary's path
const SHOTS = [ // the README's pictures
  ['files', 'files', 1],
  ['tiled', 'grid', 4],
  ['tabs', 'city', 2, '--tabs', '3', '--chat', 'are you real?'],
  ['net', 'net', 1],
  ['trench', 'trench', 1],
  ['outatime', 'outatime', 1, '--at', '5'],
  ['thermoptic', 'thermoptic', 1],
  ['radio', 'radio', 1],
  ['datacenter', 'datacenter', 1],
  ['sky', 'sky', 1],
  ['sneakers', 'sneakers', 1],
];
for (const [name, world, panes, ...extra] of SHOTS) {
  execFileSync(electron, ['.', '--shot', `docs/screenshots/${name}.png`, '--world', world, '--panes', String(panes), ...extra, '--at', '16'], { stdio: 'inherit' }); // an --at in extra wins: main.js reads the first
}
