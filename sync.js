// Settings sync through a secret GitHub gist, the way connectty does it, but with a token the user
// makes on GitHub (gist scope only) instead of an OAuth app. Secrets never leave the machine:
// the LLM key and IRC password are stripped on upload and the local ones kept on download.
const FILE = 'gibson-config.json', API = 'https://api.github.com';
const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=GIBSON%20settings%20sync';
const SECRETS = [['llm', 'apiKey'], ['irc', 'password']];

function strip(cfg) {
  const out = JSON.parse(JSON.stringify(cfg)); delete out.file;
  for (const [a, b] of SECRETS) if (out[a]) delete out[a][b];
  return out;
}
function merge(remote, local) { // the downloaded settings, with this machine's secrets put back
  const out = strip(remote);
  for (const [a, b] of SECRETS) if (local[a] && local[a][b] != null) out[a] = { ...(out[a] || {}), [b]: local[a][b] };
  return out;
}
const looksLikeToken = (s) => /^(ghp_|github_pat_|gho_)[A-Za-z0-9_]{20,}$/.test(s || '');

async function gh(token, method, url, body) {
  const r = await fetch(API + url, {
    method, body: body && JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'GIBSON', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!r.ok) throw new Error(`GitHub said ${r.status}${r.status === 401 ? ': the token is wrong or expired' : r.status === 403 || r.status === 404 ? ': the token needs the gist scope' : ''}`);
  return r.json();
}
const whoami = async (token) => (await gh(token, 'GET', '/user')).login;
async function findGist(token, id) {
  if (id) { try { return await gh(token, 'GET', `/gists/${id}`); } catch { /* deleted: look again */ } }
  for (let page = 1; page <= 5; page++) {
    const list = await gh(token, 'GET', `/gists?per_page=100&page=${page}`);
    const g = list.find((x) => x.files && x.files[FILE]); if (g) return gh(token, 'GET', `/gists/${g.id}`);
    if (list.length < 100) break;
  }
  return null;
}
async function push(token, id, cfg) { // returns the gist id
  const files = { [FILE]: { content: JSON.stringify(strip(cfg), null, 2) } }, g = await findGist(token, id);
  return (g ? await gh(token, 'PATCH', `/gists/${g.id}`, { files }) : await gh(token, 'POST', '/gists', { description: 'GIBSON settings', public: false, files })).id;
}
async function pull(token, id) { // returns { id, cfg } or null when nothing was uploaded yet
  const g = await findGist(token, id); if (!g) return null;
  const f = g.files[FILE];
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  return { id: g.id, cfg: JSON.parse(text) };
}

module.exports = { strip, merge, looksLikeToken, whoami, push, pull, TOKEN_URL };

if (require.main === module) { // node sync.js: the offline checks
  const assert = require('assert');
  const local = { file: 'x', world: 'grid', llm: { model: 'm', apiKey: 'LOCAL' }, irc: { nick: 'a', password: 'pw' } };
  const up = strip(local);
  assert(!up.file && !up.llm.apiKey && !up.irc.password && up.llm.model === 'm' && local.llm.apiKey === 'LOCAL');
  const down = merge({ world: 'city', llm: { model: 'n', apiKey: 'LEAKED' }, irc: { nick: 'b' } }, local);
  assert(down.world === 'city' && down.llm.model === 'n' && down.llm.apiKey === 'LOCAL' && down.irc.password === 'pw' && down.irc.nick === 'b');
  assert(looksLikeToken('ghp_' + 'a'.repeat(36)) && !looksLikeToken('hello') && !looksLikeToken('ghp_short'));
  console.log('sync check: ok');
}
