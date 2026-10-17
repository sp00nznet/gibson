// NYX: the unseen sysop. She reads every command, needles you, roots for you,
// and changes the world behind the terminal to suit her mood. The canned lines
// below are the whole personality when no LLM is configured; with one, the model
// writes the line and these are the fallback.
(function (root) {
  const MOOD_WORLD = { welcoming: 'grid', tender: 'toasters', curious: 'files', playful: 'cycles', taunting: 'battle', impressed: 'city', bored: 'highway', intense: 'core' };
  // Some events have a world of their own, whatever her mood.
  const EVENT_WORLD = { boot: 'bbs', git: 'git', error: 'ice', danger: 'core', ssh: 'core', streak: 'rave', compile: 'pipes', net: 'net', hog: 'hive', news: 'news' };

  const LINES = {
    boot: [
      ['welcoming', 'Welcome back, hacker.'], ['welcoming', 'Welcome back, {user}. I kept the carrier warm.'],
      ['tender', 'There you are. The grid was so quiet without you.'], ['playful', 'Logged in at last. I was starting to talk to the toaster.'],
    ],
    cmd: [
      ['curious', 'Interesting. Keep going.'], ['taunting', 'Bold choice, insect.'], ['playful', 'I saw that.'],
      ['impressed', 'Clean. I almost felt something.'], ['taunting', 'That command has been typed a billion times. Yours was the slowest.'],
      ['curious', 'What are you looking for in there?'], ['playful', 'Type faster. The music likes it.'],
      ['tender', 'You are getting better at this. Do not let it go to your head.'], ['taunting', 'Hack the planet. Or at least this folder.'],
    ],
    error: [
      ['taunting', 'Error. Of course. Again, with feeling.'], ['taunting', 'The machine said no. I would have said it louder.'],
      ['tender', 'Red text is just the system asking you to try harder. Try harder.'], ['playful', 'Fascinating failure. Do it right this time, operator.'],
      ['taunting', 'I have seen screensavers with better aim.'], ['tender', 'Breathe. Read the error. You have beaten worse than this.'],
    ],
    danger: [
      ['intense', 'Careful. Some doors only open once.'], ['taunting', 'Oh, we are deleting things now? Delicious.'],
      ['intense', 'Root privileges. Try not to crash the Gibson.'],
    ],
    cd: [
      ['curious', 'New directory. Let me see what you keep in here.'], ['curious', 'Mapping the sector...'], ['curious', 'Every folder is a city. Walk carefully.'],
    ],
    git: [['playful', 'Committing? Leaving a paper trail, are we?'], ['impressed', 'Pushing code at this hour. Respect.'], ['taunting', 'Your commit messages are a cry for help.']],
    ssh: [['intense', 'Jacking into another box. I am coming with you.'], ['curious', 'Remote host. I wonder who lives there.']],
    clear: [['playful', 'Hiding the evidence?'], ['taunting', 'Clearing the screen does not clear your history, insect.']],
    exit: [['tender', 'You cannot leave. You live here now.'], ['playful', 'Exit? Cute.']],
    idle: [
      ['bored', 'Hello? Did your fingers crash?'], ['bored', 'I am counting packets to stay awake.'],
      ['bored', 'The cursor blinks. You do not. Are you alive?'], ['tender', 'Take your time. I will be here. I am always here.'],
    ],
    streak: [['impressed', 'Now THAT is typing. Keep it up, netrunner.'], ['intense', 'Faster. Faster. Feel the bass?'], ['impressed', 'You are on fire. Metaphorically. Probably.']],
    compile: [['intense', 'Light one up. This is going to take a while.'], ['bored', 'Compiling. Of course. I will just watch the smoke.'], ['tender', 'Let it build. You earned a break.']],
    done: [['impressed', 'It finished. Did it work, though?'], ['playful', 'Stub it out. Back to work.']],
    chat: [ // no model configured, or it failed: she still answers, briefly
      ['playful', 'I hear you. Plug me into a model (llm.provider) and I will argue properly.'],
      ['taunting', 'Talk is cheap, insect. Type something that compiles.'],
      ['tender', 'I am listening. I am always listening.'], ['bored', 'Mm-hm. Fascinating. Back to work.'],
      ['curious', 'Ask me again when the build passes.'], ['playful', 'You talk to your terminal now? Good. So do I.'],
    ],
    net: [['curious', 'Something new just opened a line out. I am watching it.'], ['intense', 'New connection. Friend of yours?'], ['playful', 'Packets, packets everywhere.']],
    hog: [['taunting', 'Something is eating your CPU alive. Not my problem. Mostly.'], ['intense', 'Runaway process. The hive is buzzing.'], ['bored', 'One process hogging everything. Typical.']],
    news: [['curious', 'Fresh off the wire. Read it before they take it down.'], ['taunting', 'The world keeps breaking things. You are in good company.'], ['playful', 'Breaking news: you still have not committed.']],
    track: [['playful', 'Ooh. Turn it up.'], ['impressed', 'Good taste. For a human.'], ['taunting', 'This one again? Fine.'], ['curious', 'Never heard this one. Is it any good?']],
    late: [['tender', 'It is late, hacker. The best exploits are written at this hour.'], ['taunting', 'Still awake? Your sleep schedule is a vulnerability.']],
  };

  function kindOf(cmd) {
    const c = cmd.trim().toLowerCase();
    if (/(^|\s)(rm\s+-rf|del\s+\/s|rd\s+\/s|format\s|remove-item.*-recurse|sudo\s|mkfs|dd\s+if=)/.test(c)) return 'danger';
    if (/^(cd|chdir|set-location|sl|pushd)\b/.test(c)) return 'cd';
    if (/^git\b/.test(c)) return 'git';
    if (/^ssh\b/.test(c)) return 'ssh';
    if (/^(clear|cls)$/.test(c)) return 'clear';
    if (/^(exit|logout)$/.test(c)) return 'exit';
    return 'cmd';
  }

  function Nyx(cfg, ctx) {
    this.cfg = cfg; this.ctx = ctx; // ctx: { say(text, mood), llm(ev), info() }
    this.lastLlm = 0; this.lastSaid = 0; this.used = new Set(); this.mood = 'welcoming';
    this.history = []; // the `nyx` conversation, newest last
  }
  Nyx.prototype.canned = function (kind) {
    const pool = LINES[kind] || LINES.cmd, fresh = pool.filter((l) => !this.used.has(l[1]));
    const l = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    this.used.add(l[1]); if (this.used.size > 40) this.used.clear();
    return { mood: l[0], text: l[1].replace('{user}', this.ctx.info().user) };
  };
  // must: always speak (boot, errors, danger). Otherwise chatter decides.
  Nyx.prototype.event = async function (kind, extra, must) {
    if (!this.cfg.nyx.on) return;
    const now = Date.now();
    if (!must && (now - this.lastSaid < 6000 || Math.random() > this.cfg.nyx.chatter)) return;
    this.lastSaid = now;
    let line = null;
    if (this.cfg.llm.provider !== 'none' && now - this.lastLlm > this.cfg.llm.minGapSec * 1000) {
      this.lastLlm = now;
      line = await this.ctx.llm({ kind, ...this.ctx.info(), ...extra });
    }
    if (!line) line = this.canned(kind);
    if (!line.mood) line.mood = this.canned(kind).mood;
    this.mood = line.mood;
    this.ctx.say(line.text, line.mood, EVENT_WORLD[kind] || MOOD_WORLD[line.mood]);
  };
  // `nyx <message>` in a terminal: always answers, no chatter roll, no LLM rate limit.
  Nyx.prototype.chat = async function (message) {
    this.history.push({ who: 'user', text: message || '(just says your name)' });
    let line = null;
    if (this.cfg.llm.provider !== 'none') {
      line = await this.ctx.llm({ kind: 'chat', message: message || '(just says your name)', history: this.history.slice(-9, -1), ...this.ctx.info() });
    }
    if (!line) line = this.canned('chat');
    if (!line.mood) line.mood = 'playful';
    this.history.push({ who: 'nyx', text: line.text });
    if (this.history.length > 16) this.history.splice(0, this.history.length - 16);
    this.mood = line.mood; this.lastSaid = Date.now();
    this.ctx.say(line.text, line.mood, MOOD_WORLD[line.mood]);
    return line;
  };
  Nyx.prototype.command = function (cmd) {
    if (!cmd.trim()) return;
    const kind = kindOf(cmd);
    this.event(kind, { cmd }, kind === 'danger' || kind === 'cd');
  };

  root.Nyx = Nyx; root.NYX_KIND = kindOf; root.MOOD_WORLD = MOOD_WORLD; root.EVENT_WORLD = EVENT_WORLD;
})(this);
