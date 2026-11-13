/* Cover art for each game, 1600x1200 (4:3). Each game gets its own art direction so thumbnails
 * never look like copies of one template. Rendered to images by tools/make-images.mjs.
 * A cover can also be a still frame from the real game (engineCover), so the thumbnail shows exactly what you play. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
function engineCover(engine, options, selector = 'canvas') {
  const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
  return {
    selector,
    html: `<!doctype html><html data-slug="cover" data-theme="light"><head><meta charset="utf-8"><style>${rd('sdk/mg.css')}
${rd(`engines/${engine}/${engine}.css`)}
html,body{width:1600px;height:1200px}</style></head><body><div id="game"></div>
<script>window.GAME_OPTIONS=${JSON.stringify(options)};</script><script>${rd('sdk/mg.js')}
${rd(`engines/${engine}/${engine}.js`)}</script></body></html>`,
  };
}

const page = (body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1600px;height:1200px;overflow:hidden}
body{font-family:Poppins,Inter,"DejaVu Sans",sans-serif}
.emoji{font-family:"Noto Color Emoji";line-height:1}
${css}</style></head><body>${body}</body></html>`;

function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* Rock Paper Scissors: comic pop sunburst */
function rps() {
  return page(`<div class="burst"></div><div class="dots"></div>
<div class="lines"></div>
<div class="hand h1 emoji">✊</div><div class="hand h2 emoji">✋</div><div class="hand h3 emoji">✌️</div>
<svg class="vs" viewBox="-200 -200 400 400"><path d="M0 -190 L46 -88 L160 -120 L100 -20 L190 40 L80 66 L96 180 L0 110 L-96 180 L-80 66 L-190 40 L-100 -20 L-160 -120 L-46 -88Z" fill="#E8481C" stroke="#fff" stroke-width="14" stroke-linejoin="round"/>
<text x="0" y="42" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="128" fill="#fff" stroke="#1C1230" stroke-width="10" paint-order="stroke" font-style="italic">VS</text></svg>`, `
body{background:#FFB21E}
.burst{position:absolute;inset:-400px;background:repeating-conic-gradient(from 0deg at 50% 50%,#FFC93D 0deg 9deg,#FF9F1C 9deg 18deg)}
.dots{position:absolute;inset:0;background:radial-gradient(circle,rgba(160,60,0,.22) 4px,transparent 5px) 0 0/26px 26px;
  -webkit-mask:radial-gradient(70% 70% at 50% 50%,transparent 45%,#000 100%);mask:radial-gradient(70% 70% at 50% 50%,transparent 45%,#000 100%)}
.hand{position:absolute;font-size:430px;filter:drop-shadow(10px 0 0 #fff) drop-shadow(-10px 0 0 #fff) drop-shadow(0 10px 0 #fff) drop-shadow(0 -10px 0 #fff) drop-shadow(0 26px 0 rgba(90,30,0,.35))}
.h1{left:120px;top:520px;transform:rotate(-14deg)}
.h2{left:560px;top:60px;transform:rotate(4deg)}
.h3{left:1010px;top:500px;transform:rotate(16deg)}
.vs{position:absolute;left:640px;top:560px;width:330px;height:330px;transform:rotate(-8deg);filter:drop-shadow(0 18px 0 rgba(90,30,0,.35))}
.lines{position:absolute;inset:0;background:
  linear-gradient(115deg,transparent 46%,rgba(255,255,255,.6) 46.3%,transparent 46.8%) ,
  linear-gradient(65deg,transparent 52%,rgba(255,255,255,.5) 52.3%,transparent 52.8%)}
`);
}

export const covers = {
  'snake': () => engineCover('snake', { cols: 12, rows: 9, showcase: true }),
  'tic-tac-toe': () => engineCover('tictactoe', { size: 3, win: 3, showcase: true }, 'body'),
  'tic-tac-toe-4x4-4-in-a-row': () => engineCover('tictactoe4', { size: 4, win: 4, showcase: true }, 'body'),
  'rock-paper-scissors': rps,
  '2048': () => engineCover('slide2048', { size: 4, showcase: true }, 'body'),
  'block-puzzle': () => engineCover('blocks', { size: 8, showcase: true }, 'body'),
  'ball-sort': () => engineCover('ballsort', { showcase: true }, 'body'),
  'memory-match': () => engineCover('memory', { showcase: true }, 'body'),
  'fruit-merge': () => engineCover('fruitmerge', { showcase: true }, 'body'),
  'endless-craft': () => engineCover('endlesscraft', { showcase: true }, 'body'),
  'typing-speed-test': () => engineCover('typing', { showcase: true }, 'body'),
  'reaction-time-test': () => engineCover('reaction', { showcase: true }, 'body'),
  'perfect-circle': () => engineCover('circle', { showcase: true }, 'body'),
  'whack-a-mole': () => engineCover('whack', { showcase: true }, 'body'),
  'flappy-bird': () => engineCover('flappy', { showcase: true }, 'body'),
  'stack': () => engineCover('stack', { showcase: true }, 'body'),
  'breakout': () => engineCover('breakout', { showcase: true }, 'body'),
  'doodle-jump': () => engineCover('doodle', { showcase: true }, 'body'),
};

/* Focal point (0..1) used to crop the square app icon from each cover. */
export const iconFocus = {
  'snake': [0.3, 0.5, 0.5],
  'tic-tac-toe': [0.5, 0.5, 0.8],
  'tic-tac-toe-4x4-4-in-a-row': [0.5, 0.5, 0.8],
  'rock-paper-scissors': [0.5, 0.5, 0.95],
  'flappy-bird': [0.4, 0.47, 0.7],
  'stack': [0.5, 0.55, 0.7],
  'breakout': [0.5, 0.45, 0.7],
  'doodle-jump': [0.5, 0.45, 0.7],
};
