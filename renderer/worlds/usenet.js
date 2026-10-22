// USENET: the newsgroup hierarchy as a great tree hanging in the dark: comp, alt, rec, sci and the
// rest, each group a leaf, posts flowing out along the branches as they propagate (more when you're
// busy). The camera drifts round it and settles on one group at a time. In the margins, a newsreader:
// the group list with unread counts (left), the selected group's threads (right) and an article
// scrolling past (bottom left). Type a command and it searches the spool for a word from it.
(function (Worlds) {
  Worlds.define('usenet', (k) => {
    const { C, rand, pick, env, seg, setCam, lookAt, text3, ring } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 200;
    const TREE = {
      comp: ['lang.c', 'os.linux', 'sys.amiga', 'security.misc', 'ai', 'os.minix'], alt: ['2600', 'hackers', 'cyberpunk', 'folklore.urban', 'tv.x-files', 'fan.bofh'],
      rec: ['arts.sf.written', 'games.roguelike', 'music.industrial', 'humor', 'arts.anime'], sci: ['space', 'crypt', 'physics'],
      talk: ['bizarre', 'origins'], misc: ['forsale', 'misc'], news: ['announce.newusers', 'admin.net-abuse'], soc: ['culture.japan', 'history'],
    };
    const NICKS = ['zerocool@phreak.example', 'acidburn@ellingson.example', 'plague@gibson.example', 'cereal@modem.example', 'nikon@photo.example', 'joey@newbie.example', 'phantom@2600.example', 'root@sysop.example'];
    const SUBJ = ['Linux vs. everything (was Re: kernel 0.99)', 'FAQ: read this before posting', 'MAKE MONEY FAST!!!', 'Best editor? (was Re: vi vs emacs)', 'Is the Gibson really unhackable?', 'Help! modem hangs at 14.4k', 'ANNOUNCE: new fractal viewer',
      'Re: Re: Re: the great bandwidth debate', 'ISO: back issues', 'Spoilers inside', 'Why does my compile take all night?', 'Netiquette for newbies', 'Trip report: con this weekend', 'WTB: 3.5" floppies, bulk', 'Who still reads this group?', 'My shell account got nuked'];
    const BODY = ['> I think you will find the opposite is true.', '> > Has anyone actually tried this?', 'Works fine here. Check your init string.', 'Please read the FAQ before posting.', 'This has been discussed to death.', 'Followups set to alt.flame.', '-- ', 'Hack the planet.', 'Me too!', 'Path: news.gibson!uunet!not-for-mail', 'Lines: 42', 'I have been lurking for years and finally have to say something.', 'ObOnTopic: the answer is 42.', '<plonk>'];

    // the tree: top-level branches round the root, groups round their branch
    const nodes = [], edges = [], groups = [];
    const root = { name: '', p: [0, 0, 0] }, tops = Object.keys(TREE);
    tops.forEach((t, i) => {
      const a = i / tops.length * Math.PI * 2, tp = { name: t, p: [Math.cos(a) * 16, Math.sin(a * 2) * 4, Math.sin(a) * 16] };
      nodes.push(tp); edges.push([root, tp]);
      TREE[t].forEach((g, j) => {
        const b = a + (j - (TREE[t].length - 1) / 2) * 0.16, h = (j % 2 ? 1 : -1) * (2 + j);
        const gp = { name: t + '.' + g, p: [Math.cos(b) * 34, tp.p[1] + h, Math.sin(b) * 34], unread: (rand(0, 400) | 0), leaf: true };
        nodes.push(gp); edges.push([tp, gp]); groups.push(gp);
      });
    });
    let posts = [], sel = pick(groups), selT = 0, cursor = 0, threads = [], article = [], scroll = 0, search = null, lastCmd = 0, yaw = 0;
    const thread = () => { const s = pick(SUBJ); const n = 1 + (rand(0, 5) | 0); return Array.from({ length: n }, (_, d) => ({ d: Math.min(d, 3), s: (d ? 'Re: ' : '') + s, from: pick(NICKS).split('@')[0] })); };
    function select(g) {
      sel = g; selT = 0; threads = [].concat(...Array.from({ length: 5 }, thread)).slice(0, 14);
      const t = pick(threads);
      article = [`From: ${pick(NICKS)}`, `Newsgroups: ${g.name}`, `Subject: ${t.s}`, `Message-ID: <${(Math.random() * 1e9) | 0}@gibson.example>`, '', ...Array.from({ length: 14 }, () => pick(BODY))];
      scroll = 0; cursor = groups.indexOf(g);
    }
    select(sel);

    return {
      label: 'USENET',
      update(dt) {
        selT += dt; scroll += dt * (1.2 + env.level * 3);
        if (selT > 14) select(pick(groups));
        if (Math.random() < dt * (3 + env.level * 25) && posts.length < 120) { const e = pick(edges.filter((x) => x[1].leaf)); posts.push({ e, f: 0, up: Math.random() < 0.5 }); }
        for (const p of posts) p.f += dt * 0.5;
        posts = posts.filter((p) => { if (p.f >= 1) { p.e[1].unread++; return false; } return true; });
        // a command: search the spool for its longest word
        const c = env.cmd;
        if (c && c.at !== lastCmd) {
          lastCmd = c.at;
          const w = (c.text.match(/[A-Za-z0-9_.-]{3,}/g) || []).sort((a, b) => b.length - a.length)[0];
          if (w) {
            const hits = groups.filter(() => Math.random() < 0.3).slice(0, 4);
            search = { w, t: 0, hits: hits.map((g) => `${g.name}: Re: ${w} ${pick(['help', 'question', 'is broken', 'FAQ', 'considered harmful', 'rocks'])}`) };
            if (hits[0]) select(hits[0]);
          }
        }
        if (search) { search.t += dt; if (search.t > 9) search = null; }
        yaw += dt * 0.05;
      },
      draw() {
        const t = env.t, f = Math.min(1, selT / 3), a = yaw;
        const cam = { x: Math.sin(a) * 62, y: 12 + Math.sin(t * 0.1) * 5, z: Math.cos(a) * 62 };
        setCam(lookAt(cam, sel.p[0] * f * 0.6, sel.p[1] * f * 0.6, sel.p[2] * f * 0.6));
        ring(0, 0, 0, 1.5 + env.pulse * 0.6, 16, C.gold, 0.9, FOG);
        for (const [p, q] of edges) seg(...p.p, ...q.p, q.leaf ? C.violet : C.ice, q.leaf ? 0.45 : 0.7, FOG);
        for (const n of nodes) {
          const on = n === sel;
          ring(...n.p, on ? 1 + env.pulse * 0.5 : n.leaf ? 0.4 : 0.8, 10, on ? C.gold : n.leaf ? C.neon : C.ice, on ? 1 : 0.7, FOG);
          text3(n.leaf ? n.name.split('.').slice(1).join('.') : n.name, n.p[0] + 0.8, n.p[1] + 0.6, n.p[2], on ? C.gold : n.leaf ? C.neon : C.white, n.leaf ? 0.7 : 1.3, on ? 1 : 0.6);
        }
        for (const p of posts) { // a post travelling out to its group
          const [A, B] = p.e, x = A.p[0] + (B.p[0] - A.p[0]) * p.f, y = A.p[1] + (B.p[1] - A.p[1]) * p.f, z = A.p[2] + (B.p[2] - A.p[2]) * p.f;
          seg(x, y - 0.3, z, x, y + 0.3, z, C.hot, 1, FOG); seg(x - 0.3, y, z, x + 0.3, y, z, C.hot, 1, FOG);
        }
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080), lh = 15 * s, x0 = 20 * s, right = W - 20 * s;
      const txt = (str, x, y, col, al) => { g.fillStyle = `rgba(${col},${al == null ? 0.85 : al})`; g.fillText(str, x, y); };
      // the group list, cursor on the selected group
      g.font = `bold ${14 * s | 0}px ${MONO}`; txt('NEWSGROUPS  ::  news.gibson', x0, 32 * s, C.gold);
      g.font = `${11 * s | 0}px ${MONO}`;
      const first = Math.max(0, Math.min(groups.length - 22, cursor - 10));
      for (let i = first; i < Math.min(groups.length, first + 22); i++) {
        const y = 54 * s + (i - first) * lh, on = i === cursor, gr = groups[i];
        if (on) { g.fillStyle = `rgba(${C.gold},0.25)`; g.fillRect(x0 - 4 * s, y - 11 * s, 270 * s, lh); }
        txt(`${on ? '>' : ' '} ${String(gr.unread).padStart(4)}  ${gr.name}`.slice(0, 38), x0, y, on ? C.gold : C.neon, on ? 1 : 0.7);
      }
      // the threads in the selected group, as a reply tree
      g.font = `bold ${14 * s | 0}px ${MONO}`; const head = sel.name; txt(head, right - g.measureText(head).width, 32 * s, C.gold);
      g.font = `${11 * s | 0}px ${MONO}`;
      threads.forEach((th, i) => {
        const line = `${'  '.repeat(th.d)}${th.d ? '`-> ' : '+ '}${th.s}`.slice(0, 40), by = th.from.padStart(8).slice(0, 8);
        const y = 54 * s + i * lh, hit = search && th.s.toLowerCase().includes(search.w.toLowerCase());
        txt(line, right - 300 * s, y, hit ? C.hot : th.d ? C.ice : C.white, 0.8); txt(by, right - g.measureText(by).width, y, C.violet, 0.7);
      });
      // the article, scrolling
      const ay = H - 230 * s, rows = 11;
      g.save(); g.beginPath(); g.rect(x0 - 4 * s, ay - 12 * s, 290 * s, rows * lh + 6 * s); g.clip();
      const off = Math.floor(scroll) % (article.length + 4); // a line at a time, like a pager: smooth scrolling smears on the fading canvas
      for (let i = 0; i < rows + 1; i++) {
        const n = off + i, l = article[n % (article.length + 4)] || '', y = ay + i * lh;
        txt(l.slice(0, 40), x0, y, n % (article.length + 4) < 4 ? C.gold : l.startsWith('>') ? C.violet : C.white, 0.8);
      }
      g.restore();
      // a search running
      if (search) {
        g.font = `bold ${13 * s | 0}px ${MONO}`; txt(`/${search.w}`, right - 300 * s, H - 150 * s, C.hot, 1);
        g.font = `${11 * s | 0}px ${MONO}`;
        const shown = Math.min(search.hits.length, Math.floor(search.t * 2));
        txt(shown ? `${shown} article${shown > 1 ? 's' : ''} found` : 'searching the spool...', right - 300 * s, H - 132 * s, C.ice, 0.8);
        for (let i = 0; i < shown; i++) txt(search.hits[i].slice(0, 46), right - 300 * s, H - (114 - i * 16) * s, C.neon, 0.85);
      } else {
        g.font = `${11 * s | 0}px ${MONO}`; txt(`${posts.length} articles propagating  ::  ${groups.reduce((n, x) => n + x.unread, 0)} unread`, right - 300 * s, H - 30 * s, C.ice, 0.7);
      }
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
