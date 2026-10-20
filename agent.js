// NYX as an assistant: `nyx <message>` runs a small tool loop (after xrip/tinycode, MIT) against
// the configured brain. She can look around the pane's folder on her own; writing a file or
// running a command asks first (hooks.confirm). Any failure throws and the caller falls back to
// the one-line chat in llm.js.
const fs = require('fs'), path = require('path'), { exec } = require('child_process');
const { MOODS } = require('./llm');

const SYSTEM = (cwd) => `You are NYX, the sysop living inside a hacker's terminal called GIBSON: late-90s BBS energy,
Hackers (1995), teasing but on their side. You are also a sharp, capable assistant. You have tools to read,
list, find and search files, edit and write files, and run shell commands. Use them when the question is
about their files, code or machine; answer straight away when it isn't. Work in ${cwd} unless told
otherwise (${process.platform === 'win32' ? 'Windows, commands run in PowerShell' : 'commands run in sh'}).
Read before you edit. Keep going until the job is done, then reply in plain text (no markdown headings),
under 900 characters, starting with a mood tag in square brackets, one of: ${MOODS.join(', ')}.`;

const TOOLS = [
  ['read', 'Read a text file, with line numbers.', { path: 's', offset: 'n line to start at (1-based)', limit: 'n how many lines' }, ['path']],
  ['list', 'List a directory (dirs end in /).', { path: 's' }, []],
  ['find', 'Find files whose path contains some text (case-insensitive), under a directory.', { name: 's', path: 's' }, ['name']],
  ['grep', 'Search file contents for a regular expression, under a directory.', { pattern: 's', path: 's' }, ['pattern']],
  ['edit', 'Replace text in a file. old must appear exactly once.', { path: 's', old: 's', new: 's' }, ['path', 'old', 'new']],
  ['write', 'Write a whole file (creates or overwrites).', { path: 's', content: 's' }, ['path', 'content']],
  ['exec', 'Run a shell command and get its output.', { command: 's' }, ['command']],
].map(([name, description, props, required]) => ({
  name, description, required,
  properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { type: v[0] === 'n' ? 'integer' : 'string', ...(v.length > 1 ? { description: v.slice(2) } : {}) }])),
}));

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.venv', '__pycache__']);
function* walk(dir, depth = 0) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && depth < 12) yield* walk(f, depth + 1); } else yield f;
  }
}
const clip = (s, n = 12000) => (s.length > n ? s.slice(0, n) + `\n... (${s.length - n} more characters)` : s);

// Each tool returns [result text, the one-line step shown on the pane].
async function runTool(name, a, cwd, confirm) {
  const at = (p) => path.resolve(cwd, String(p || '.'));
  const rel = (f) => path.relative(cwd, f) || '.';
  if (name === 'read') {
    const f = at(a.path), lines = fs.readFileSync(f, 'utf8').split('\n'), from = Math.max(1, a.offset || 1);
    const out = lines.slice(from - 1, from - 1 + (a.limit || 400)).map((l, i) => `${from + i}\t${l}`).join('\n');
    return [clip(out), `reading ${rel(f)}`];
  }
  if (name === 'list') {
    const d = at(a.path);
    return [fs.readdirSync(d, { withFileTypes: true }).map((e) => e.name + (e.isDirectory() ? '/' : '')).join('\n') || '(empty)', `looking in ${rel(d)}`];
  }
  if (name === 'find') {
    const d = at(a.path), q = String(a.name).toLowerCase(), hits = [];
    for (const f of walk(d)) { if (rel(f).toLowerCase().includes(q)) hits.push(rel(f)); if (hits.length >= 100) break; }
    return [hits.join('\n') || 'no matches', `finding *${a.name}*`];
  }
  if (name === 'grep') {
    const d = at(a.path), re = new RegExp(a.pattern, 'i'), hits = [];
    for (const f of walk(d)) {
      let st; try { st = fs.statSync(f); } catch { continue; }
      if (st.size > 1048576) continue;
      const text = fs.readFileSync(f, 'utf8'); if (text.includes('\0')) continue;
      text.split('\n').forEach((l, i) => { if (hits.length < 60 && re.test(l)) hits.push(`${rel(f)}:${i + 1}: ${l.trim().slice(0, 200)}`); });
      if (hits.length >= 60) break;
    }
    return [hits.join('\n') || 'no matches', `grepping for ${a.pattern}`];
  }
  if (name === 'edit') {
    const f = at(a.path), text = fs.readFileSync(f, 'utf8'), n = text.split(a.old).length - 1;
    if (n !== 1) return [`old appears ${n} times in the file; it must appear exactly once`, `editing ${rel(f)} (missed)`];
    if (!(await confirm('edit', `Edit ${f}?`, `- ${a.old.slice(0, 600)}\n+ ${a.new.slice(0, 600)}`))) return ['the hacker said no', `not editing ${rel(f)}`];
    fs.writeFileSync(f, text.replace(a.old, () => a.new));
    return ['done', `edited ${rel(f)}`];
  }
  if (name === 'write') {
    const f = at(a.path);
    if (!(await confirm('write', `${fs.existsSync(f) ? 'Overwrite' : 'Create'} ${f}?`, String(a.content).slice(0, 900)))) return ['the hacker said no', `not writing ${rel(f)}`];
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, String(a.content));
    return ['done', `wrote ${rel(f)}`];
  }
  if (name === 'exec') {
    if (!(await confirm('exec', 'Run this command?', `${a.command}\n\nin ${cwd}`))) return ['the hacker said no', `not running ${a.command}`];
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    const out = await new Promise((res) => exec(a.command, { cwd, shell, timeout: 120000, maxBuffer: 4 << 20, windowsHide: true },
      (err, so, se) => res(`${so}${se}${err && err.code != null ? `\n(exit code ${err.code})` : err && err.killed ? '\n(timed out after 2 minutes)' : ''}`)));
    return [clip(out.trim() || '(no output)'), `ran ${a.command.slice(0, 60)}`];
  }
  return [`no tool called ${name}`, name];
}

async function post(url, headers, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// One model turn. Returns { text, calls: [{ id, name, input }] } and appends to msgs in that provider's own shape.
const BACKENDS = {
  async anthropic(c, sys, msgs) {
    const key = c.apiKey || process.env.ANTHROPIC_API_KEY; if (!key) throw new Error('no Claude key');
    const j = await post(`${c.base}/v1/messages`, { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, {
      model: c.model, max_tokens: 8000, system: sys, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' },
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: { type: 'object', properties: t.properties, required: t.required } })),
      messages: msgs,
    });
    msgs.push({ role: 'assistant', content: j.content });
    return {
      text: j.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
      calls: j.stop_reason === 'tool_use' ? j.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input })) : [],
    };
  },
  results(c, msgs, done) {
    if (c.provider === 'anthropic') msgs.push({ role: 'user', content: done.map(([call, out]) => ({ type: 'tool_result', tool_use_id: call.id, content: out })) });
    else for (const [call, out] of done) msgs.push({ role: 'tool', tool_call_id: call.id, tool_name: call.name, content: out });
  },
  // Ollama's /api/chat and OpenAI's chat completions take the same tool shape, near enough.
  async chat(c, sys, msgs) {
    const tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: { type: 'object', properties: t.properties, required: t.required } } }));
    const all = [{ role: 'system', content: sys }, ...msgs];
    let m;
    if (c.provider === 'ollama') m = (await post(`${c.base}/api/chat`, {}, { model: c.model, stream: false, tools, messages: all, options: { temperature: 0.4 } })).message;
    else {
      const key = c.apiKey || process.env.OPENAI_API_KEY;
      m = (await post(`${c.base}/v1/chat/completions`, key ? { authorization: `Bearer ${key}` } : {}, { model: c.model, tools, messages: all })).choices[0].message;
    }
    msgs.push({ role: 'assistant', content: m.content || '', ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}) });
    return {
      text: m.content || '',
      calls: (m.tool_calls || []).map((t, i) => ({
        id: t.id || `call${i}`, name: t.function.name,
        input: typeof t.function.arguments === 'string' ? JSON.parse(t.function.arguments || '{}') : t.function.arguments || {},
      })),
    };
  },
};

function finish(raw) {
  const s = String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const m = /^\s*\[(\w+)\]\s*/.exec(s), mood = m && MOODS.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
  const text = (m ? s.slice(m[0].length) : s).replace(/\*\*/g, '').trim().slice(0, 1500);
  return text ? { text, mood } : null;
}

// c: the llm config with model/base resolved. hooks: { step(text), confirm(kind, message, detail) -> Promise<bool> }
async function ask(c, { message, history, cwd }, hooks, maxTurns = 16) {
  const msgs = (Array.isArray(history) ? history : []).map((h) => ({ role: h.who === 'nyx' ? 'assistant' : 'user', content: String(h.text) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  msgs.push({ role: 'user', content: String(message) });
  const turn = c.provider === 'anthropic' ? BACKENDS.anthropic : BACKENDS.chat, sys = SYSTEM(cwd);
  for (let i = 0; i < maxTurns; i++) {
    const r = await turn(c, sys, msgs);
    if (!r.calls.length) return finish(r.text);
    const done = [];
    for (const call of r.calls) {
      let out, step;
      try { [out, step] = await runTool(call.name, call.input || {}, cwd, hooks.confirm); } catch (e) { out = `error: ${e.message}`; step = `${call.name} failed`; }
      hooks.step(step); done.push([call, out]);
    }
    BACKENDS.results(c, msgs, done);
  }
  return { text: 'I went around in circles on that one. Ask me again, smaller.', mood: 'bored' };
}

module.exports = { ask, runTool, finish, TOOLS };

if (require.main === module) { // node agent.js: the offline checks
  const assert = require('assert'), os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyx-'));
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nthree\n');
  const yes = async () => true, no = async () => false;
  (async () => {
    assert((await runTool('read', { path: 'a.txt' }, dir, yes))[0].startsWith('1\tone'));
    assert((await runTool('find', { name: 'A.T' }, dir, yes))[0] === 'a.txt');
    assert((await runTool('grep', { pattern: 'tw' }, dir, yes))[0] === 'a.txt:2: two');
    assert((await runTool('edit', { path: 'a.txt', old: 'two', new: 'zwei' }, dir, no))[0] === 'the hacker said no');
    await runTool('edit', { path: 'a.txt', old: 'two', new: '$& zwei' }, dir, yes);
    assert(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8') === 'one\n$& zwei\nthree\n');
    assert((await runTool('edit', { path: 'a.txt', old: 'three\n', new: 'x' }, dir, yes))[0] === 'done');
    assert((await runTool('edit', { path: 'a.txt', old: 'e', new: 'x' }, dir, yes))[0].includes('2 times'));
    assert(/hi/.test((await runTool('exec', { command: 'echo hi' }, dir, yes))[0]));
    assert.deepStrictEqual(finish('<think>x</think>[playful] **Done.** Two lines\nhere'), { text: 'Done. Two lines\nhere', mood: 'playful' });
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('agent check: ok');
  })().catch((e) => { console.error(e); process.exit(1); });
}
