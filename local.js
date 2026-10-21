// NYX's built-in brain: a small GGUF model run inside GIBSON with node-llama-cpp (MIT). Nothing
// leaves the machine. Models are downloaded on demand into userData/models, never shipped.
const path = require('path'), fs = require('fs');

const HF = 'https://huggingface.co';
const MODELS = [
  { id: 'qwen3-0.6b', name: 'Qwen3 0.6B', repo: 'unsloth/Qwen3-0.6B-GGUF', file: 'Qwen3-0.6B-Q4_K_M.gguf', gb: 0.4, ram: 2, note: 'fastest, shaky with tools' },
  { id: 'qwen3-1.7b', name: 'Qwen3 1.7B', repo: 'unsloth/Qwen3-1.7B-GGUF', file: 'Qwen3-1.7B-Q4_K_M.gguf', gb: 1.1, ram: 4, note: 'recommended' },
  { id: 'qwen3-4b', name: 'Qwen3 4B', repo: 'unsloth/Qwen3-4B-Instruct-2507-GGUF', file: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf', gb: 2.5, ram: 6, note: 'smarter, slower' },
  { id: 'qwen2.5-coder-7b', name: 'Qwen2.5-Coder 7B', repo: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF', file: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf', gb: 4.7, ram: 8, note: 'the Mantis model, wants a GPU' },
];
const DEFAULT = 'qwen3-1.7b';
const byId = (id) => MODELS.find((m) => m.id === id) || MODELS.find((m) => m.id === DEFAULT);

let dir = null; // set by init(): main hands over userData/models
const init = (d) => { dir = d; };
const fileOf = (m) => path.join(dir, m.file);
const have = (m) => !!dir && fs.existsSync(fileOf(m));
const diskGb = () => { try { return fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0) / 1e9; } catch { return 0; } };

// One download at a time. onProgress(fraction). Resolves to the file, rejects if cancelled.
let dl = null;
async function download(m, onProgress) {
  if (dl) throw new Error(`already downloading ${dl.m.name}`);
  const { createModelDownloader } = await import('node-llama-cpp');
  fs.mkdirSync(dir, { recursive: true });
  const d = await createModelDownloader({
    modelUri: `${HF}/${m.repo}/resolve/main/${m.file}`, dirPath: dir, fileName: m.file,
    onProgress: (s) => onProgress(s.totalSize ? s.downloadedSize / s.totalSize : 0),
  });
  dl = { m, d };
  try { return await d.download(); } finally { dl = null; }
}
const downloading = () => (dl ? dl.m : null);
const cancel = () => dl && dl.d.cancel();

// The loaded model, kept between questions; requests run one at a time (one context sequence).
let llama = null, loaded = null, queue = Promise.resolve();
async function load(m) {
  if (loaded && loaded.id === m.id) return loaded;
  if (!have(m)) throw new Error(`${m.name} is not downloaded`);
  const { getLlama } = await import('node-llama-cpp');
  if (loaded) { await loaded.context.dispose(); await loaded.model.dispose(); loaded = null; }
  llama = llama || await getLlama({ build: 'never', progressLogs: false }); // prebuilt binaries only: never compile on a user's machine
  const model = await llama.loadModel({ modelPath: fileOf(m) });
  const context = await model.createContext({ contextSize: { min: 4096, max: 16384 } });
  loaded = { id: m.id, model, context };
  return loaded;
}
// history: [{ role: 'user'|'assistant', content }]. functions: node-llama-cpp's { name: { description, params, handler } }.
function chat({ id, system, history, message, functions, maxTokens, think }) {
  const job = queue.then(async () => {
    const { LlamaChatSession } = await import('node-llama-cpp');
    const { context } = await load(byId(id));
    const session = new LlamaChatSession({ contextSequence: context.getSequence(), autoDisposeSequence: true });
    try {
      session.setChatHistory([{ type: 'system', text: system },
        ...(history || []).map((h) => (h.role === 'user' ? { type: 'user', text: h.content } : { type: 'model', response: [h.content] }))]);
      return await session.prompt(message, { functions, maxTokens, temperature: 0.6, budgets: { thoughtTokens: think || 0 } });
    } finally { session.dispose(); }
  });
  queue = job.catch(() => {});
  return job;
}

module.exports = { MODELS, DEFAULT, byId, init, have, diskGb, download, downloading, cancel, chat, dirOf: () => dir };
