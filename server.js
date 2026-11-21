// Local-only backend for NUSC Exam Generator. Requires Node.js 18+.
// OpenRouter credentials stay on the server in .env and are never sent to the browser.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const MAX_BODY = 2 * 1024 * 1024;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.pdf':'application/pdf', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

function send(res, status, data, type='application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '', size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(new Error('Text payload is too large (2 MB maximum).')); req.destroy(); return; } raw += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON request.')); } });
    req.on('error', reject);
  });
}
const systemPrompt = `You are an expert exam-layout parser. Extract ONLY questions visibly present in the OCR text. Return JSON exactly as {\"questions\":[{\"type\":\"mcq|tf|written\",\"prompt\":\"...\",\"options\":[{\"text\":\"...\"}],\"marks\":1}]}.
CRITICAL CLASSIFICATION RULES:
1) MCQ: If a question has answer choices labeled a), b), c), d) or A., B., C., D. (even if OCR placed all choices on one line), classify it as mcq and put each choice in a separate options item. The prompt must contain only the question stem, not the choices.
2) TRUE/FALSE: If the section instruction says indicate True/False, or statements are numbered under a True/False section, each statement is a separate tf question. Do not merge statements from different columns. Use options [{text:"True"},{text:"False"}].
3) WRITTEN: Use written only when the source asks for explanation, proof, derivation, relation, or calculation and there are no multiple-choice options. Preserve equations and diagram references in the prompt. Do not turn an MCQ into written just because OCR is imperfect.
4) Layout: The OCR text may contain [PAGE n · LEFT COLUMN] and [PAGE n · RIGHT COLUMN]. Read each column top-to-bottom, left column before right column. Page headers, logos, repeated course details, page numbers, and footer names are not questions. Question numbering may continue across pages; do not treat a repeated number in a different section as a duplicate.
5) Preserve original wording and language. Keep every option in its original order. Never solve questions, infer correct answers, invent missing options, or silently repair unclear technical content. Split numbered items only when each is independently answerable. Ignore student pen marks and ticks. If a question or option is unreadable, include the readable part and flag uncertainty by prefixing its prompt with [REVIEW OCR].
6) A numbered problem containing a circuit/figure and asking to calculate/derive is written, unless it has explicit labeled answer options. Do not hallucinate diagram details.
Return valid JSON only, no markdown.`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/parse-exam') {
    if (!API_KEY) return send(res, 503, { error: 'Missing OPENROUTER_API_KEY. Copy .env.example to .env and add your key.' });
    try {
      const body = await readBody(req);
      const text = String(body.text || '').slice(0, 45000);
      if (text.trim().length < 20) return send(res, 400, { error: 'Not enough readable text. Scanned/image-only documents may need OCR first.' });
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'NUSC Exam Generator' },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Parse this exam document. The OCR was processed column-by-column. Extract all question types separately and keep each question's options attached to it.\n\n${text}` }], temperature: 0.1, max_tokens: 12000, response_format: { type: 'json_object' } })
      });
      const payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return send(res, 502, { error: payload?.error?.message || `OpenRouter returned HTTP ${upstream.status}` });
      let content = payload?.choices?.[0]?.message?.content;
      if (Array.isArray(content)) content = content.map(x => x.text || '').join('\n');
      if (!content) return send(res, 502, { error: 'The AI provider returned an empty response. Try again.' });
      const cleaned = String(content).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed.questions)) return send(res, 502, { error: 'AI response did not contain a questions array.' });
      const questions = parsed.questions.map(q => ({ type: ['mcq','tf','written'].includes(q?.type) ? q.type : 'written', prompt: String(q?.prompt || '').trim(), options: Array.isArray(q?.options) ? q.options.map(o => ({ text: String(o?.text || '').trim() })).filter(o => o.text) : [], marks: Number.isFinite(Number(q?.marks)) && Number(q.marks) > 0 ? Number(q.marks) : 1 })).filter(q => q.prompt);
      if (!questions.length) return send(res, 422, { error: 'No questions could be extracted. Review the source text or use manual entry.' });
      return send(res, 200, { questions, provider: 'OpenRouter', model: MODEL, reviewRequired: true });
    } catch (err) { return send(res, 500, { error: err.message || 'Unexpected server error.' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, aiConfigured: Boolean(API_KEY), model: MODEL });
  let pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(ROOT, `.${pathname}`);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, data) => { if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8'); send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'); });
});
server.listen(PORT, '127.0.0.1', () => console.log(`NUSC Exam Generator: http://localhost:${PORT}\nAI model: ${MODEL}\nAPI key configured: ${Boolean(API_KEY)}`));
