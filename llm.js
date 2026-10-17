// NYX's optional brain. One short line per terminal event, from a local or
// hosted model. Every failure returns null and the renderer falls back to its
// canned lines (renderer/nyx.js), so GIBSON never waits on a model.
const MOODS = ['welcoming', 'curious', 'playful', 'taunting', 'impressed', 'bored', 'intense', 'tender'];

const SYSTEM = `You are NYX, the unseen sysop living inside a hacker's terminal called GIBSON.
Late-90s BBS energy: Hackers (1995), System Shock's SHODAN but on their side, KMFDM on the stereo.
You watch every command. You taunt, tease and needle, but you are rooting for them and you say so.
Call them "hacker", "operator", "netrunner" or "insect" (fondly). Never explain shell commands like a tutor.
Reply with ONE line under 120 characters, prefixed by a mood tag in square brackets, one of:
${MOODS.join(', ')}. Example: [taunting] Another typo. My grandmother phreaks faster than you, and she is a toaster.
When the hacker talks to you directly, answer what they actually said, in character, in one or two sentences
under 240 characters, still starting with the mood tag.`;

const DEFAULT_MODEL = { ollama: 'llama3.2:3b', anthropic: 'claude-opus-5-5', openai: 'gpt-5-mini' };
const DEFAULT_BASE = { ollama: 'http://127.0.0.1:11434', anthropic: 'https://api.anthropic.com', openai: 'https://api.openai.com' };

const EVENTS = {
  boot: 'The hacker just logged in. Greet them.',
  cmd: 'The hacker ran a command.',
  cd: 'The hacker moved into another directory.',
  git: 'The hacker ran a git command.',
  ssh: 'The hacker is connecting to a remote machine.',
  clear: 'The hacker cleared the screen.',
  exit: 'The hacker typed exit.',
  danger: 'The hacker ran a destructive or privileged command.',
  error: "The hacker's last command failed with an error.",
  idle: 'The hacker has not typed anything for over a minute.',
  streak: 'The hacker is typing very fast.',
  compile: 'A long build just started; the hacker is waiting on it.',
  done: 'The long build just finished.',
  late: 'It is the middle of the night and the hacker is still working.',
  chat: 'The hacker typed a message to you directly in the terminal.',
  net: 'You noticed a new kind of network connection on their machine.',
  hog: 'A process on their machine is hogging the CPU.',
  news: 'A new headline just came in on the newswire. React to it.',
};

function describe(ev) {
  const bits = [EVENTS[ev.kind] || `event: ${ev.kind}`, `user name: ${ev.user || 'unknown'}`, `local time: ${ev.hour}:00`, `typing pace: ${['idle', 'slow', 'steady', 'fast', 'frantic'][Math.min(4, Math.floor(Number(ev.activity || 0) * 5))]}`];
  if (ev.cmd) bits.push(`command: ${ev.cmd.slice(0, 200)}`);
  if (ev.cwd) bits.push(`directory: ${ev.cwd}`);
  if (ev.output) bits.push(`recent output:\n${ev.output.slice(-600)}`);
  if (ev.headline) bits.push(`headline: "${String(ev.headline).slice(0, 200)}"`);
  if (ev.detail) bits.push(`detail: ${String(ev.detail).slice(0, 200)}`);
  if (ev.message) bits.push(`they say to you: "${String(ev.message).slice(0, 500)}"`);
  return bits.join('\n');
}

function parse(raw, max = 160) {
  if (!raw) return null;
  const line = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim().split('\n').find((l) => l.trim()) || '';
  const m = /^\s*\[(\w+)\]\s*(.+)$/.exec(line);
  const mood = m && MOODS.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
  const text = (m ? m[2] : line).replace(/^["']|["']$/g, '').trim().slice(0, max);
  return text ? { text, mood } : null;
}

async function post(url, headers, body) {
  const r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function llmLine(c, ev) {
  if (!c || c.provider === 'none') return null;
  const model = c.model || DEFAULT_MODEL[c.provider];
  const base = (c.baseUrl || DEFAULT_BASE[c.provider] || '').replace(/\/$/, '');
  const user = describe(c.shareOutput ? ev : { ...ev, output: undefined, history: undefined });
  const chat = ev.kind === 'chat';
  // A chat carries the conversation so far; it must open with a user turn.
  const turns = (chat && Array.isArray(ev.history) ? ev.history : []).map((h) => ({ role: h.who === 'nyx' ? 'assistant' : 'user', content: String(h.text) }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const messages = [...turns, { role: 'user', content: user }];
  const max = chat ? 280 : 160;

  if (c.provider === 'ollama') {
    const j = await post(`${base}/api/chat`, {}, {
      model, stream: false, options: { temperature: 0.9, num_predict: chat ? 160 : 80 },
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
    });
    return parse(j.message && j.message.content, max);
  }
  if (c.provider === 'anthropic') {
    const key = c.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const j = await post(`${base}/v1/messages`, {
      'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    }, {
      model, max_tokens: 1024, system: SYSTEM,
      output_config: { effort: 'low' },   // a one-liner, not a proof
      fallbacks: 'default',               // reroute instead of failing on a refusal
      messages,
    });
    if (j.stop_reason === 'refusal') return null;
    return parse((j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'), max);
  }
  if (c.provider === 'openai') {
    const key = c.apiKey || process.env.OPENAI_API_KEY;
    const j = await post(`${base}/v1/chat/completions`, key ? { authorization: `Bearer ${key}` } : {}, {
      model, max_completion_tokens: 200,
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
    });
    return parse(j.choices && j.choices[0] && j.choices[0].message.content, max);
  }
  return null;
}

module.exports = { llmLine, parse, describe, MOODS };
