# MiniGames.website

Static site for https://minigames.website, deployed on Cloudflare Pages.

- `npm run build` builds the site into `dist/` (Cloudflare Pages output directory).
- `npm run images` renders cover art (tiles, social cards, Pinterest pins) and the game logos + site thumbnail (`public/`).
- `npm run check` builds, then runs gameplay, console-error and Core Web Vitals checks in headless Chromium.
- `worker.js` is the site Worker: it serves `dist/` as before and adds `GET /api/craft?a=&b=` (AI crafting results for Endless Craft, via Groq). It needs the `GROQ_API_KEY` secret set in the Cloudflare dashboard; without it the endpoint returns 503 and the site works exactly as before.

## Adding a game
1. `engines/<engine>/<engine>.js` + `.css`: the game, built on the shared SDK in `sdk/` (scores, sound, pause, ad breaks).
2. `games/<slug>/meta.json`: title, SEO title, description, categories, controls and the page sections written for this game.
3. Cover art in `tools/covers.mjs` (every game gets its own art direction), then `npm run images`.
4. `npm run check`, review the thumbnail sheet in `review/`, then commit.
