// Regenerates docs/screenshots/. Headless (offscreen window), so it works over RDP.
// Shot mode runs the shells in a made-up folder behind a fixed prompt (main.js, DEMO),
// so nothing in a screenshot shows the real machine.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const electron = createRequire(import.meta.url)('electron'); // the binary's path
const SHOTS = [
  ['files', 'files', 1], ['battle', 'battle', 1], ['city', 'city', 1], ['tunnel', 'tunnel', 1],
  ['tiled', 'grid', 4], ['unframed', 'planet', 2, '--unframed'],
];
for (const [name, world, panes, ...extra] of SHOTS) {
  execFileSync(electron, ['.', '--shot', `docs/screenshots/${name}.png`, '--world', world, '--panes', String(panes), '--at', '11', ...extra], { stdio: 'inherit' });
}
