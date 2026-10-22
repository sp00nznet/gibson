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
  ['mystify', 'mystify', 1], ['fringe', 'fringe', 1], ['attractor', 'attractor', 1], ['helix', 'helix', 1], ['flowerbox', 'flowerbox', 1], ['nocturne', 'nocturne', 1], ['life', 'life', 1], ['deathmatch', 'deathmatch', 1], ['endless', 'endless', 1], ['antigrav', 'antigrav', 1], ['tube', 'tube', 1], ['trench', 'trench', 1], ['trader', 'trader', 1], ['rocks', 'rocks', 1], ['lander', 'lander', 1], ['stunt', 'stunt', 1], ['outatime', 'outatime', 1, '--at', '5'], ['starfighter', 'starfighter', 1], ['wopr', 'wopr', 1], ['spinner', 'spinner', 1], ['navigator', 'navigator', 1], ['explorers', 'explorers', 1], ['headroom', 'headroom', 1], ['arrakis', 'arrakis', 1], ['tracker', 'tracker', 1], ['akira', 'akira', 1], ['thermoptic', 'thermoptic', 1], ['cyberbrain', 'cyberbrain', 1], ['spidertank', 'spidertank', 1], ['macross', 'macross', 1], ['radio', 'radio', 1], ['switchboard', 'switchboard', 1], ['telegraph', 'telegraph', 1], ['mission', 'mission', 1], ['pneumatic', 'pneumatic', 1], ['mainframe', 'mainframe', 1], ['videostore', 'videostore', 1], ['arcade', 'arcade', 1], ['pirateradio', 'pirateradio', 1], ['numbers', 'numbers', 1], ['bebop', 'bebop', 1], ['eva', 'eva', 1], ['hardsuit', 'hardsuit', 1], ['labor', 'labor', 1], ['gundam', 'gundam', 1], ['wired', 'wired', 1], ['yamato', 'yamato', 1], ['valkyrie', 'valkyrie', 1], ['real', 'real', 1], ['datacenter', 'datacenter', 1], ['usenet', 'usenet', 1], ['sky', 'sky', 1], ['defrag', 'defrag', 1], ['seti', 'seti', 1], ['sneakers', 'sneakers', 1], ['demoparty', 'demoparty', 1], ['ansi', 'ansi', 1], ['wardialer', 'wardialer', 1], ['y2k', 'y2k', 1], ['messenger', 'messenger', 1], ['geocities', 'geocities', 1], ['defcon', 'defcon', 1],
];
for (const [name, world, panes, ...extra] of SHOTS) {
  execFileSync(electron, ['.', '--shot', `docs/screenshots/${name}.png`, '--world', world, '--panes', String(panes), ...extra, '--at', '16'], { stdio: 'inherit' }); // an --at in extra wins: main.js reads the first
}
