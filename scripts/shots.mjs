// Regenerates docs/screenshots/. Headless (offscreen window), so it works over RDP.
// Shot mode runs the shells in a made-up folder behind a fixed prompt (main.js, DEMO),
// so nothing in a screenshot shows the real machine.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const electron = createRequire(import.meta.url)('electron'); // the binary's path
const SHOTS = [
  ['files', 'files', 1], ['battle', 'battle', 1], ['city', 'city', 1], ['tunnel', 'tunnel', 1],
  ['tiled', 'grid', 4], ['unframed', 'planet', 2, '--unframed'],
  ['tabs', 'city', 2, '--tabs', '3', '--chat', 'are you real?'],
  ['core', 'core', 1], ['bbs', 'bbs', 1], ['ice', 'ice', 1],
  ['net', 'net', 1], ['news', 'news', 1], ['cycles', 'cycles', 1], ['battlezone', 'battlezone', 1], ['toasters', 'toasters', 1],
  ['keygen', 'keygen', 1], ['garbage', 'garbage', 1], ['towers', 'towers', 1],
  ['irc', 'city', 1, '--irc'], ['dial', 'grid', 1, '--cmd', 'dial 555-0199'],
  ['newsglobe', 'newsglobe', 1], ['traffic', 'traffic', 1], ['hack', 'hack', 1],
  ['milkdrop', 'milkdrop', 1], ['kaleido', 'kaleido', 1], ['starburst', 'starburst', 1], ['ruins', 'ruins', 1], ['cyberpunk', 'cyberpunk', 1], ['skyline', 'skyline', 1],
  ['mystify', 'mystify', 1], ['fringe', 'fringe', 1], ['attractor', 'attractor', 1], ['helix', 'helix', 1], ['flowerbox', 'flowerbox', 1], ['nocturne', 'nocturne', 1], ['life', 'life', 1], ['deathmatch', 'deathmatch', 1],
];
for (const [name, world, panes, ...extra] of SHOTS) {
  execFileSync(electron, ['.', '--shot', `docs/screenshots/${name}.png`, '--world', world, '--panes', String(panes), '--at', '16', ...extra], { stdio: 'inherit' });
}
