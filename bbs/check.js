// Drives one whole BBS session through a pipe and checks it: node bbs/check.js (exit 0 = pass).
'use strict';
const { spawn } = require('child_process');
const assert = require('assert');
const path = require('path');

const fight = 'L' + 'A'.repeat(15);              // look for trouble, then mash attack; spare A's are ignored
const keys = [
  'NEW\r\n', 'Razor\r', 'Nobody\r', 'hunter2\r',   // login (\r\n counts once)
  'M', 'N', 'N', 'W', 'Zero Cool\r', 'test post\r', 'hello from check.js\r', '\r', 'Q', // messages + a post
  'F', '1\r', '\r',                               // download a file
  'C', 'hello\r', 'who are you\r', '\r',          // chat with NYX
  'D', 'S', 'F', fight, fight, fight, 'R', 'Q',   // the door
  'X?!\x1b[A\x7f',                                // junk at the main menu
  'G',                                            // goodbye
].join('');

const child = spawn(process.execPath, [path.join(__dirname, 'bbs.js'), '555-0199'], { env: { ...process.env, BBS_SEED: '42' } });
let output = '';
child.stdout.on('data', d => { output += d; });
child.stderr.on('data', d => { output += d; });
child.stdin.end(keys);
const timer = setTimeout(() => { child.kill(); console.error(output.slice(-2000)); console.error('FAIL: timed out'); process.exit(1); }, 15000);

child.on('exit', code => {
  clearTimeout(timer);
  const text = output.replace(/\x1b\[[0-9;]*m/g, '');
  try {
    assert.strictEqual(code, 0, 'exit code');
    for (const s of ['CONNECT 28800', 'THE GIBSON', 'Access granted. Welcome, Razor', 'The Plague', 'Acid Burn',
      'Message saved', 'hello from check.js', 'ZMODEM: sending GIBSON_ICE.TXT', 'cps', 'NYX has entered chat', 'NYX:',
      'LEGEND OF THE NEON DRAGON', '[WASTELAND]', 'You hit', 'Thanks for calling THE GIBSON', 'NO CARRIER'])
      assert(text.includes(s), `missing: ${s}`);
    assert(/jack out|flatlines you/.test(text), 'left the door alive or dead');
    assert(!/SYSTEM ERROR|Error:/.test(text), 'no crash');
    console.log('bbs check: ok');
  } catch (e) {
    console.error(text.slice(-3000));
    console.error('FAIL:', e.message);
    process.exit(1);
  }
});
