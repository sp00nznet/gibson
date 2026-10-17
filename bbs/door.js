// LEGEND OF THE NEON DRAGON: a pocket forest-fight door for the GIBSON BBS.
// Fight in the Wasteland, buy gear, beat your master to level up, then take on the ICE dragon.
// ponytail: state lives in memory for the session; add a ~/.gibson-bbs.json save when someone wants to keep their knight.
'use strict';

const TURNS = 25;
const EXP = [0, 50, 200, 500, 1000];            // exp needed to challenge the master at levels 1-4
const WEAPONS = [['Bare Knuckles', 0, 0], ['Sharpened Floppy', 3, 100], ['Tone Dialer', 7, 400], ['Shock Glove', 12, 1000], ['Monofilament Whip', 18, 2500], ['Plasma Katana', 26, 6000]];
const ARMOUR = [['T-Shirt', 0, 0], ['Leather Jacket', 2, 100], ['Faraday Vest', 5, 400], ['Kevlar Trenchcoat', 9, 1000], ['Mirrorshade Plate', 14, 2500], ['Ghost Suit', 20, 6000]];
const MONSTERS = [, ['Script Kiddie', 'Feral Packet', 'Rogue Spam Bot'], ['Virus-Laden Floppy', 'Phreak Box Golem', 'Dial-Tone Wraith'],
  ['Rabid Firewall', 'Trojan Centaur', 'Corporate Narc'], ['Black ICE Hound', 'Daemon of Port 31337', 'Secret Service Cyborg'],
  ['Mainframe Lich', 'Worm Hydra', 'Rootkit Shade']];
const MASTERS = [, ['Halcyon the Modem Monk', 22, 5], ['Mistress Kilobaud', 55, 10], ['Old Man Telnet', 110, 16], ['The Ghost in the Switch', 190, 22]];
const DRAGON = ['KRAKEN-9, the ICE Dragon of the Gibson', 130, 26];

const players = {};                              // per handle, this session only

module.exports.play = async function play(io, handle) {
  const { out, hot, line, c, roll, rnd, pick, box, sleep } = io;
  const p = players[handle] ||= { level: 1, hp: 20, maxhp: 20, str: 5, def: 1, gold: 50, exp: 0, w: 0, a: 0, turns: TURNS, dead: false, won: false };
  const say = (s, col = 252) => out(c(col, s) + '\n');

  out('\n' + box('LEGEND OF THE NEON DRAGON', [c(219, 'The city glows. The Wasteland hums. Something vast'), c(219, 'and cold is coiled around the Gibson. It is hungry.')], 54, 201));
  if (p.dead) { say('You are flatlined for today. NYX is laughing. Come back tomorrow.', 196); return io.anykey(); }
  if (p.won) { say('The dragon is dust. The city sings your handle. Go outside.', 46); return io.anykey(); }

  // One fight. Returns 'win', 'run' or 'dead' (masters only knock you out).
  async function fight(name, hp, atk, canRun) {
    say(`\n** ${name} attacks! (${hp} HP)`, 196);
    for (;;) {
      out(`${c(46, `HP ${p.hp}/${p.maxhp}`)}  ${c(196, `${name}: ${hp}`)}  `);
      const k = await hot(c(226, canRun ? '[A]ttack [R]un > ' : '[A]ttack > '), canRun ? 'AR' : 'A');
      if (k === 'R') {
        if (rnd() < 0.6) { say('You slip away into the static.'); return 'run'; }
        say("You can't shake it!");
      } else {
        const hit = p.str + WEAPONS[p.w][1], d = roll(hit >> 1, hit);
        hp -= d;
        say(`You hit ${name} for ${d}.`, 51);
        if (hp <= 0) return 'win';
      }
      const md = Math.max(0, roll(atk >> 1, atk) - ((p.def + ARMOUR[p.a][1]) >> 1));
      p.hp -= md;
      say(md ? `${name} hits you for ${md}.` : `${name} misses.`, md ? 208 : 240);
      if (p.hp <= 0) return 'dead';
    }
  }

  async function forest() {
    for (;;) {
      const dragon = p.level >= 5;
      const k = await hot(c(46, `\n[WASTELAND] turns ${p.turns}  HP ${p.hp}/${p.maxhp}  `) + c(226, `[L]ook for trouble ${dragon ? '[D]ragon ' : ''}[R]eturn > `), dragon ? 'LDR' : 'LR');
      if (k === 'R') return;
      if (k === 'D') {
        const r = await fight(DRAGON[0], DRAGON[1], DRAGON[2], false);
        if (r === 'dead') { p.dead = true; say('\nThe ICE closes over you. Your handle is wiped from every board.', 196); return io.anykey(); }
        p.won = true;
        out('\n' + box('YOU CRACKED THE GIBSON', [c(46, 'KRAKEN-9 shatters into a billion packets.'), c(46, `${handle} is a LEGEND. Hack the planet.`)], 50, 46));
        return io.anykey();
      }
      if (p.turns <= 0) { say('You are too wired to fight. Come back tomorrow.', 240); continue; }
      p.turns--;
      if (rnd() < 0.12) { const g = roll(5, 20) * p.level; p.gold += g; say(`You find ${g} gold in a dead payphone.`, 226); continue; }
      const m = pick(MONSTERS[p.level]);
      const r = await fight(m, roll(6, 12) * p.level, 3 * p.level + 1, true);
      if (r === 'dead') { p.dead = true; p.gold = 0; say(`\nThe ${m} flatlines you. Your gold is gone. Come back tomorrow.`, 196); return io.anykey(); }
      if (r === 'win') {
        const g = roll(15, 35) * p.level * p.level, e = roll(10, 18) * p.level * p.level;
        p.gold += g; p.exp += e;
        say(`You derez the ${m}! +${g} gold, +${e} exp.`, 46);
      }
    }
  }

  async function healer() {
    const cost = (p.maxhp - p.hp) * p.level;
    if (!cost) return say('The street medic shrugs. "You look fine, kid."');
    const heal = Math.min(p.maxhp - p.hp, Math.floor(p.gold / p.level));
    if (!heal) return say(`"${cost} gold or get out." You have ${p.gold}.`);
    if (await hot(c(226, `Patch ${heal} HP for ${heal * p.level} gold? [Y/N] `), 'YN') === 'Y') { p.hp += heal; p.gold -= heal * p.level; say('Duct tape and stimulants. Good as new.', 46); }
  }

  async function shop(list, slot, title) {
    out('\n' + box(title, list.map(([n, v, g], i) => `${c(231, i)} ${n.padEnd(20)} ${c(51, ('+' + v).padEnd(4))} ${c(226, g + ' gold')}`), 48, 33));
    out(c(240, `You have ${p.gold} gold and the ${list[p[slot]][0]}. Buy # (Enter to leave): `));
    const it = list[parseInt(await line(2), 10)];
    if (!it) return;
    if (it[2] > p.gold) return say('"Come back when you can afford it."', 208);
    p.gold -= it[2]; p[slot] = list.indexOf(it);
    say(`You gear up with the ${it[0]}.`, 46);
  }

  async function master() {
    const [name, hp, atk] = MASTERS[p.level] || [];
    if (!name) return say('No master is left to teach you. Only the dragon remains, deep in the Wasteland.', 219);
    if (p.exp < EXP[p.level]) return say(`${name} looks you over. "Come back with ${EXP[p.level]} exp. You have ${p.exp}."`);
    if (await fight(name, hp, atk, false) === 'win') {
      p.level++; p.maxhp += 15; p.str += 4; p.def += 2; p.hp = p.maxhp;
      say(`\n${name} bows. "You are ready." You are now level ${p.level}!`, 46);
    } else { p.hp = 1; say(`\n${name} knocks you flat. "Not yet, insect."`, 208); }
  }

  for (;;) {
    out(c(201, `\n[NIGHT CITY] L${p.level} ${handle}  HP ${p.hp}/${p.maxhp}  gold ${p.gold}  exp ${p.exp}\n`));
    const k = await hot(c(226, '[F]orest [H]ealer [W]eapons [A]rmour [M]aster [S]tats [Q]uit > '), 'FHWAMSQ');
    if (k === 'Q') return say('You jack out of the door.', 240);
    if (k === 'F') { await forest(); if (p.dead || p.won) return; }
    if (k === 'H') await healer();
    if (k === 'W') await shop(WEAPONS, 'w', 'WEAPONS');
    if (k === 'A') await shop(ARMOUR, 'a', 'ARMOUR');
    if (k === 'M') await master();
    if (k === 'S') say(`Level ${p.level}  Str ${p.str}  Def ${p.def}  ${WEAPONS[p.w][0]} / ${ARMOUR[p.a][0]}  Fights left ${p.turns}`, 51);
    await sleep(100);
  }
};
