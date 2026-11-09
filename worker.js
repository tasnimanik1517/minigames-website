// minigames-website worker: serves the static site from ASSETS, plus one tiny
// API route — GET /api/craft?a=<name>&b=<name> -> { "name": "...", "emoji": "..." }
// Results come from Groq (needs the GROQ_API_KEY secret); without it the route
// answers 503 {"error":"unconfigured"} and the site behaves exactly as before.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const SYSTEM_PROMPT =
  'You are the crafting engine of a family-friendly element-combining game. ' +
  'Given two element names, invent the single most plausible or fun result of combining them. ' +
  'Reply ONLY with a JSON object {"name": "...", "emoji": "..."}. ' +
  'The name must be 1-3 words in Title Case: a thing, creature, concept, place or phenomenon. ' +
  'Never a sentence, never the word "Nothing", and do not just repeat an input unless that is truly apt (Water + Water = Puddle is fine). ' +
  'The emoji must be exactly one emoji that best represents the result.';

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
  });
}

// Element names: 1-40 chars after trim, no control chars or markup characters.
function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s.length < 1 || s.length > 40) return null;
  if (/[\u0000-\u001f\u007f<>"`\\]/.test(s)) return null;
  return s;
}

// Pull the first {...} JSON object out of a model reply and validate it.
function parseResult(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(m[0]); } catch (e) { return null; }
  if (!obj || typeof obj.name !== 'string' || typeof obj.emoji !== 'string') return null;
  const name = obj.name.replace(/[<>"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name || name.length < 1) return null;
  // Emoji: first grapheme-ish cluster, and it must contain no letters or digits.
  const emoji = Array.from(obj.emoji.trim())[0] || '';
  if (!emoji || emoji.length > 8 || /[\p{L}\p{N}]/u.test(emoji)) return null;
  return { name: name, emoji: emoji };
}

async function craft(url, env, ctx) {
  const a = cleanName(url.searchParams.get('a'));
  const b = cleanName(url.searchParams.get('b'));
  if (!a || !b) return json({ error: 'bad_input' }, 400);

  const cache = caches.default;
  const hit = await cache.match(url.toString());
  if (hit) return hit;

  if (!env.GROQ_API_KEY) return json({ error: 'unconfigured' }, 503);

  // gpt-oss is a reasoning model: without reasoning_effort "low" it can spend
  // the whole token budget on hidden reasoning and return empty content, so
  // keep the effort low and the budget comfortably above it. One retry covers
  // transient upstream errors and the occasional empty reply.
  async function askGroq() {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.GROQ_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 400,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: a + ' + ' + b },
        ],
      }),
    });
    if (!res.ok) throw new Error('upstream ' + res.status); // covers Groq 429 and other upstream errors
    const data = await res.json();
    return parseResult(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
  }

  let out = null;
  let failure = 'bad_result';
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    try {
      out = await askGroq();
      failure = 'bad_result';
    } catch (e) {
      failure = 'busy';
    }
  }
  if (!out) return json({ error: failure }, failure === 'busy' ? 503 : 502);

  // A pair's result never changes: cache forever at the edge and in browsers.
  const response = json(out, 200, { 'Cache-Control': 'public, max-age=31536000, immutable' });
  ctx.waitUntil(cache.put(url.toString(), response.clone()));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/craft') {
      if (request.method !== 'GET') return json({ error: 'bad_input' }, 400);
      return craft(url, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
