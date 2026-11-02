#!/usr/bin/env node
/* Game logos (emblem + wordmark) and the site-wide thumbnail.
 *   art/logos/<slug>-emblem.png, art/logos/<slug>-wordmark.png   (1024px sources, transparent)
 *   public/<slug>/logo.webp (256px emblem), public/<slug>/icon-96.webp
 *   public/og-default.jpg (1200x630), public/og-square.jpg (1200x1200)
 *   review/logos.png (approval sheet)
 * Usage: node tools/logos.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const load = n => { for (const c of [n, '/opt/npm-tools/node_modules/' + n]) { try { return req(c); } catch { /* next */ } } throw new Error('missing ' + n); };
const sharp = load('sharp');
const { chromium } = load('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'art', 'logos');
fs.mkdirSync(OUT, { recursive: true });
const dataUri = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;

const BASE_CSS = `*{box-sizing:border-box}html,body{margin:0;background:transparent}body{font-family:Poppins,"DejaVu Sans",sans-serif}.emoji{font-family:"Noto Color Emoji";line-height:1}`;

/* ------------------------------------------------------------ emblems (1024x1024, rounded-square app icons) */
// Snake: a realistic snake forms the letter S on a mossy forest-floor tile, next to an egg.
const snakeEmblem = `<canvas id="c" width="1024" height="1024"></canvas><script>
const c=document.getElementById('c'),x=c.getContext('2d');let seed=7;const R=()=>(seed=(seed*16807)%2147483647)/2147483647;
function rr(r){x.beginPath();x.roundRect(24,24,976,976,r)}
x.save();rr(230);x.clip();
let g=x.createRadialGradient(470,430,60,512,512,720);g.addColorStop(0,'#7FD15A');g.addColorStop(.55,'#3F9C35');g.addColorStop(1,'#16461C');x.fillStyle=g;x.fillRect(0,0,1024,1024);
for(let i=0;i<3400;i++){const px=R()*1024,py=R()*1024,l=8+R()*22,a=-Math.PI/2+(R()-.5)*1.1;x.globalAlpha=.12+R()*.3;x.strokeStyle=R()<.55?'#24581C':'#B9EC7A';x.lineWidth=2+R()*2.5;x.lineCap='round';x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+Math.cos(a)*l*.5+(R()-.5)*6,py+Math.sin(a)*l*.5,px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}
x.globalAlpha=1;
// centre line of the S (cubic beziers), head first
const segs=[[[730,250],[620,120],[290,130],[280,330]],[[280,330],[272,520],[760,470],[756,660]],[[756,660],[748,880],[360,900],[236,780]]];
function bez(s,t){const[a,b,cc,d]=s,u=1-t;return[u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*cc[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*cc[1]+t*t*t*d[1]]}
let raw=[];segs.forEach((s,k)=>{for(let i=k?1:0;i<=120;i++)raw.push(bez(s,i/120))});
// resample evenly, add a gentle slither wave
let pts=[raw[0]];let acc=0;for(let i=1;i<raw.length;i++){const p=pts[pts.length-1],q=raw[i];const d=Math.hypot(q[0]-p[0],q[1]-p[1]);acc+=d;if(acc>=5){pts.push(q);acc=0}}
const N=pts.length;const T=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(N-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return[(b[0]-a[0])/l,(b[1]-a[1])/l]});
const L=N;function W(i){const u=i/L;let w=92;if(u<.06)w*=.86;w*=.92+.12*Math.sin(Math.PI*Math.min(1,u*1.1));if(u>.78)w*=Math.max(.16,1-(u-.78)/.22*.84);return w}
function outline(scale,shift){x.beginPath();for(let i=0;i<N;i++){const h=W(i)*scale/2,o=shift?W(i)*shift:0;x.lineTo(pts[i][0]-T[i][1]*(h+o),pts[i][1]+T[i][0]*(h+o))}for(let i=N-1;i>=0;i--){const h=W(i)*scale/2,o=shift?W(i)*shift:0;x.lineTo(pts[i][0]+T[i][1]*(h-o),pts[i][1]-T[i][0]*(h-o))}x.closePath()}
x.save();x.translate(14,24);x.fillStyle='rgba(8,30,6,.42)';x.filter='blur(6px)';outline(1);x.fill();x.restore();x.filter='none';
x.fillStyle='#173A0E';outline(1.08);x.fill();
x.fillStyle='#4C9A28';outline(1);x.fill();
x.fillStyle='rgba(10,30,4,.25)';outline(1,.1);x.fill();
// saddle markings + pale flecks
for(let i=40;i<N-10;i+=17){const p=pts[i],t=T[i],w=W(i);x.save();x.translate(p[0],p[1]);x.rotate(Math.atan2(t[1],t[0]));x.fillStyle='rgba(28,64,14,.62)';x.beginPath();x.ellipse(0,0,22,w*.42,0,0,7);x.fill();x.fillStyle='rgba(214,244,140,.6)';x.beginPath();x.ellipse(38,w*.3,7,w*.08,0,0,7);x.fill();x.beginPath();x.ellipse(38,-w*.3,7,w*.08,0,0,7);x.fill();x.restore()}
[[.78,.12],[.56,.14],[.34,.16]].forEach(b=>{x.fillStyle='rgba(196,240,112,'+b[1]+')';outline(b[0],-.08);x.fill()});
// scales: tiny arcs along the body
x.strokeStyle='rgba(14,40,6,.35)';x.lineWidth=2;for(let i=8;i<N-6;i+=3){const p=pts[i],t=T[i],w=W(i);for(let k=-2;k<=2;k++){const ox=p[0]-t[1]*k*w*.18,oy=p[1]+t[0]*k*w*.18;x.beginPath();x.arc(ox,oy,5,Math.atan2(t[1],t[0])-1.2,Math.atan2(t[1],t[0])+1.2);x.stroke()}}
x.strokeStyle='rgba(230,252,180,.35)';x.lineWidth=5;x.lineCap='round';x.beginPath();for(let i=6;i<N*.82;i++){const w=W(i)*.16;x.lineTo(pts[i][0]+T[i][1]*w,pts[i][1]-T[i][0]*w)}x.stroke();
// head at the start of the line, facing away from the body
const hp=pts[0],ht=T[0],ang=Math.atan2(-ht[1],-ht[0]);x.save();x.translate(hp[0],hp[1]);x.rotate(ang);const s=1.7;
function head(g){x.beginPath();x.moveTo(-40*s,-44*s*g);x.bezierCurveTo(10*s,-64*s*g,58*s,-50*s*g,76*s,-8*s*g);x.quadraticCurveTo(84*s,0,76*s,8*s*g);x.bezierCurveTo(58*s,50*s*g,10*s,64*s*g,-40*s,44*s*g);x.closePath()}
x.strokeStyle='#D21F45';x.lineWidth=7;x.lineCap='round';x.beginPath();x.moveTo(78*s,0);x.lineTo(112*s,0);x.moveTo(110*s,0);x.lineTo(130*s,-12*s);x.moveTo(110*s,0);x.lineTo(130*s,12*s);x.stroke();
x.fillStyle='#173A0E';head(1.07);x.fill();let hg=x.createRadialGradient(14*s,-18*s,0,10*s,0,80*s);hg.addColorStop(0,'#86CC48');hg.addColorStop(1,'#3B7A1F');x.fillStyle=hg;head(1);x.fill();
x.strokeStyle='rgba(34,80,18,.75)';x.lineWidth=5;x.beginPath();x.moveTo(-26*s,-15*s);x.quadraticCurveTo(14*s,-25*s,42*s,-15*s);x.moveTo(-26*s,15*s);x.quadraticCurveTo(14*s,25*s,42*s,15*s);x.stroke();
x.fillStyle='rgba(15,30,8,.85)';x.beginPath();x.ellipse(66*s,-9*s,4*s,2.5*s,.3,0,7);x.fill();x.beginPath();x.ellipse(66*s,9*s,4*s,2.5*s,-.3,0,7);x.fill();
[-1,1].forEach(sd=>{const ex=30*s,ey=34*s*sd,er=13*s;x.fillStyle='#132A0B';x.beginPath();x.arc(ex,ey,er*1.22,0,7);x.fill();let ig=x.createRadialGradient(ex-er*.3,ey-er*.3,0,ex,ey,er);ig.addColorStop(0,'#FFF0A0');ig.addColorStop(.6,'#F2B630');ig.addColorStop(1,'#B9741A');x.fillStyle=ig;x.beginPath();x.arc(ex,ey,er,0,7);x.fill();x.fillStyle='#0B0D08';x.beginPath();x.ellipse(ex+er*.1,ey,er*.22,er*.82,0,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(ex-er*.35,ey-er*.38*sd,er*.22,0,7);x.fill()});
x.restore();
// egg in a straw nest
x.save();x.translate(838,420);x.lineCap='round';for(let i=0;i<14;i++){const a0=R()*6.28;x.strokeStyle=R()<.5?'#A57A3E':'#7A5428';x.lineWidth=7;x.beginPath();x.ellipse(0,52,88,30,0,a0,a0+1+R());x.stroke()}
x.rotate(.28);x.fillStyle='rgba(10,20,5,.3)';x.beginPath();x.ellipse(8,64,62,18,0,0,7);x.fill();
const rx=58,ry=76;let eg=x.createRadialGradient(-24,-34,0,0,0,96);eg.addColorStop(0,'#FFFFFF');eg.addColorStop(.5,'#F3E9D6');eg.addColorStop(1,'#C9B38C');x.fillStyle=eg;
x.beginPath();x.moveTo(0,-ry);x.bezierCurveTo(rx*.62,-ry,rx,-ry*.18,rx,ry*.22);x.bezierCurveTo(rx,ry*.72,rx*.56,ry,0,ry);x.bezierCurveTo(-rx*.56,ry,-rx,ry*.72,-rx,ry*.22);x.bezierCurveTo(-rx,-ry*.18,-rx*.62,-ry,0,-ry);x.fill();
x.fillStyle='rgba(120,82,40,.55)';for(let k=0;k<12;k++){x.beginPath();x.ellipse((R()-.5)*rx*1.3,(R()-.35)*ry*1.2,3+R()*4,2+R()*3,R()*3,0,7);x.fill()}
x.fillStyle='rgba(255,255,255,.75)';x.beginPath();x.ellipse(-22,-34,12,9,-.5,0,7);x.fill();x.restore();
// glossy top light + vignette
g=x.createLinearGradient(0,0,0,560);g.addColorStop(0,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,1024,560);
g=x.createRadialGradient(512,512,380,512,512,760);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,20,0,.5)');x.fillStyle=g;x.fillRect(0,0,1024,1024);
x.restore();
x.lineWidth=10;x.strokeStyle='rgba(255,255,255,.28)';rr(230);x.stroke();
document.documentElement.dataset.ready=1;</script>`;

// Tic Tac Toe: a carved wooden tile with a glossy X and O and an engraved grid.
const pieceDefs = `<linearGradient id="gx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9A78"/><stop offset=".5" stop-color="#EA4A1F"/><stop offset="1" stop-color="#A82A0A"/></linearGradient>
<linearGradient id="go" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A3C6FF"/><stop offset=".5" stop-color="#3270FF"/><stop offset="1" stop-color="#173FB4"/></linearGradient>
<filter id="wood"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.07" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0.32  0 0 0 0 0.16  0 0 0 0 0.04  0 0 0 0.75 -0.05"/></filter>
<filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="10" dy="22" stdDeviation="14" flood-color="#3A1A06" flood-opacity=".5"/></filter>
<linearGradient id="wb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0AA6C"/><stop offset=".55" stop-color="#B0703A"/><stop offset="1" stop-color="#7E4820"/></linearGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="tile"><rect x="24" y="24" width="976" height="976" rx="230"/></clipPath>`;
const tttEmblem = `<svg width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${pieceDefs}</defs>
<g clip-path="url(#tile)"><rect width="1024" height="1024" fill="url(#wb)"/><rect width="1024" height="1024" filter="url(#wood)"/>
<g stroke-linecap="round" fill="none"><g stroke="#4A2410" stroke-opacity=".55" stroke-width="22"><path d="M380 150V874M644 150V874M150 380H874M150 644H874"/></g><g stroke="#F6D2A2" stroke-opacity=".35" stroke-width="6" transform="translate(5 9)"><path d="M380 150V874M644 150V874M150 380H874M150 644H874"/></g></g>
<g filter="url(#ds)" transform="translate(372 392) rotate(-8)"><g fill="none" stroke-linecap="round"><path d="M-170 -170 170 170M170 -170 -170 170" stroke="#7E1C06" stroke-width="128"/><path d="M-170 -170 170 170M170 -170 -170 170" stroke="url(#gx)" stroke-width="100"/><path d="M-150 -168 -20 -38M150 -168 90 -108" stroke="#fff" stroke-opacity=".6" stroke-width="22"/></g></g>
<g filter="url(#ds)" transform="translate(690 668)"><g fill="none"><circle r="160" stroke="#11308C" stroke-width="122"/><circle r="160" stroke="url(#go)" stroke-width="96"/><path d="M-128 -60 A140 140 0 0 1 -40 -150" stroke="#fff" stroke-opacity=".6" stroke-width="22" stroke-linecap="round"/></g></g>
<g fill="#FFF3C4"><path d="M842 196l14 38 38 14-38 14-14 38-14-38-38-14 38-14Z"/><path d="M196 812l10 26 26 10-26 10-10 26-10-26-26-10 26-10Z" opacity=".85"/></g>
<rect width="1024" height="560" fill="url(#gloss)"/></g>
<rect x="24" y="24" width="976" height="976" rx="230" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="10"/></svg>`;

// Rock Paper Scissors: comic sunburst with sticker hands around a VS starburst.
const rpsEmblem = `<div class="t"><div class="burst"></div><div class="dots"></div>
<div class="h emoji a">✊</div><div class="h emoji b">✋</div><div class="h emoji c">✌️</div>
<svg class="vs" viewBox="-200 -200 400 400"><path d="M0 -190 L46 -88 L160 -120 L100 -20 L190 40 L80 66 L96 180 L0 110 L-96 180 L-80 66 L-190 40 L-100 -20 L-160 -120 L-46 -88Z" fill="#E8481C" stroke="#fff" stroke-width="16" stroke-linejoin="round"/><text x="0" y="44" text-anchor="middle" font-family="Poppins" font-weight="700" font-style="italic" font-size="132" fill="#fff" stroke="#2A1030" stroke-width="12" paint-order="stroke">VS</text></svg>
<div class="gloss"></div></div><style>
.t{position:relative;width:976px;height:976px;margin:24px;border-radius:230px;overflow:hidden;background:#FFB21E;box-shadow:inset 0 0 0 10px rgba(255,255,255,.3)}
.burst{position:absolute;inset:-300px;background:repeating-conic-gradient(from 0deg at 50% 50%,#FFD04A 0deg 10deg,#FF9B1C 10deg 20deg)}
.dots{position:absolute;inset:0;background:radial-gradient(circle,rgba(150,50,0,.25) 5px,transparent 6px) 0 0/30px 30px;-webkit-mask:radial-gradient(70% 70% at 50% 50%,transparent 50%,#000 100%)}
.h{position:absolute;font-size:330px;filter:drop-shadow(12px 0 0 #fff) drop-shadow(-12px 0 0 #fff) drop-shadow(0 12px 0 #fff) drop-shadow(0 -12px 0 #fff) drop-shadow(0 26px 0 rgba(110,40,0,.35))}
.a{left:70px;top:470px;transform:rotate(-16deg)}.b{left:330px;top:60px;transform:rotate(6deg)}.c{left:590px;top:460px;transform:rotate(16deg)}
.vs{position:absolute;left:378px;top:430px;width:230px;height:230px;transform:rotate(-8deg);filter:drop-shadow(0 14px 0 rgba(110,40,0,.35))}
.gloss{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,0) 55%)}</style>`;

/* ------------------------------------------------------------ wordmarks (title lettering per game) */
function wordmark({ text, fill, outline, depth, size = 210, italic = false, tilt = 0, letters, lines }) {
  if (lines) { // stacked title: several centred lines, same treatment
    const ys = lines.map((_, i) => 210 + i * size * 0.98 - (lines.length - 1) * size * 0.3);
    const lay = (y, t) => Array.from({ length: 12 }, (_, i) => `<text class="w" x="512" y="${y + i * 1.6}" fill="${depth}" stroke="${depth}">${t}</text>`).join('');
    return `<svg width="1024" height="420" viewBox="0 0 1024 420"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">${fill.map((c, i) => `<stop offset="${i / (fill.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>
<filter id="sh" x="-20%" y="-30%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#000" flood-opacity=".28"/></filter></defs>
<style>.w{font-family:Poppins;font-weight:700;font-size:${size}px;text-anchor:middle;letter-spacing:-3px;stroke-width:30px;stroke-linejoin:round;paint-order:stroke;${italic ? 'font-style:italic;' : ''}}</style>
<g transform="rotate(${tilt} 512 210)" filter="url(#sh)">${lines.map((t, i) => lay(ys[i], t) + `<text class="w" x="512" y="${ys[i]}" fill="url(#f)" stroke="${outline}">${t}</text><text class="w" x="512" y="${ys[i]}" fill="none" stroke="#fff" stroke-opacity=".35" style="stroke-width:4px" transform="translate(-3 -4)">${t}</text>`).join('')}</g></svg>`;
  }
  const layers = Array.from({ length: 12 }, (_, i) => `<text class="w" x="512" y="${300 + i * 1.6}" fill="${depth}" stroke="${depth}">${text}</text>`).join('');
  const body = letters
    ? letters.map((l, i) => `<tspan fill="${l[1]}">${l[0]}</tspan>`).join('')
    : text;
  return `<svg width="1024" height="420" viewBox="0 0 1024 420"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">${fill.map((c, i) => `<stop offset="${i / (fill.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>
<filter id="sh" x="-20%" y="-30%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#000" flood-opacity=".28"/></filter></defs>
<style>.w{font-family:Poppins;font-weight:700;font-size:${size}px;text-anchor:middle;letter-spacing:-4px;stroke-width:34px;stroke-linejoin:round;paint-order:stroke;${italic ? 'font-style:italic;' : ''}}</style>
<g transform="rotate(${tilt} 512 240)" filter="url(#sh)">${layers}
<text class="w" x="512" y="300" fill="${letters ? '#fff' : 'url(#f)'}" stroke="${outline}">${body}</text>
<text class="w" x="512" y="300" fill="none" stroke="#fff" stroke-opacity=".35" style="stroke-width:5px" transform="translate(-3 -5)">${text}</text></g></svg>`;
}
const wordmarks = {
  'snake': wordmark({ text: 'Snake', fill: ['#D9FF7A', '#7DD43A', '#2F8F24'], outline: '#123A0C', depth: '#0B2607', tilt: -4 }),
  'tic-tac-toe': wordmark({ text: 'Tic Tac Toe', size: 168, fill: ['#fff', '#fff'], outline: '#3A1D08', depth: '#2A1405', letters: [['Tic ', '#FF6A3D'], ['Tac ', '#4F86FF'], ['Toe', '#FFC93A']] }),
  'rock-paper-scissors': wordmark({ lines: ['Rock Paper', 'Scissors!'], size: 150, fill: ['#FFF3A0', '#FFC22E', '#FF8A1F'], outline: '#2A1030', depth: '#1A0820', italic: true, tilt: -3 }),
};
const emblems = { 'snake': snakeEmblem, 'tic-tac-toe': tttEmblem, 'rock-paper-scissors': rpsEmblem };

/* ------------------------------------------------------------ render */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
async function render(html, w, h, transparent = true) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${html}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  return page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}
const logos = {};
for (const slug of Object.keys(emblems)) {
  const em = await render(emblems[slug], 1024, 1024);
  const wm = await render(wordmarks[slug], 1024, 420);
  fs.writeFileSync(path.join(OUT, slug + '-emblem.png'), em);
  fs.writeFileSync(path.join(OUT, slug + '-wordmark.png'), wm);
  const dir = path.join(ROOT, 'public', slug); fs.mkdirSync(dir, { recursive: true });
  await sharp(em).resize(256, 256).webp({ quality: 86 }).toFile(path.join(dir, 'logo.webp'));
  await sharp(em).resize(96, 96).webp({ quality: 86 }).toFile(path.join(dir, 'icon-96.webp'));
  logos[slug] = { em, wm };
  console.log('logo:', slug);
}

/* ------------------------------------------------------------ site thumbnail */
const brand = `<svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7A45"/><stop offset="1" stop-color="#D93A10"/></linearGradient><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#bg)"/><rect x="6.5" y="6.5" width="8.5" height="8.5" rx="2.6" fill="#fff"/><rect x="17" y="6.5" width="8.5" height="8.5" rx="2.6" fill="#fff" fill-opacity=".6"/><rect x="6.5" y="17" width="8.5" height="8.5" rx="2.6" fill="#fff" fill-opacity=".6"/><path d="M18.4 18.2v6.6a.9.9 0 0 0 1.35.78l5.5-3.3a.9.9 0 0 0 0-1.56l-5.5-3.3a.9.9 0 0 0-1.35.78Z" fill="#FFC22E"/><rect width="32" height="16" rx="9" fill="url(#gl)"/></svg>`;
const order = ['snake', 'tic-tac-toe', 'rock-paper-scissors'];
const names = { 'snake': 'Snake', 'tic-tac-toe': 'Tic Tac Toe', 'rock-paper-scissors': 'Rock Paper Scissors' };
const thumbCss = `
.s{position:relative;overflow:hidden;color:#fff;background:radial-gradient(70% 90% at 82% 30%,#3A2A7A 0%,rgba(58,42,122,0) 60%),radial-gradient(60% 80% at 15% 100%,#7A2A10 0%,rgba(122,42,16,0) 60%),#141629}
.s:before{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.07) 1.5px,transparent 2.2px) 0 0/26px 26px}
.mark{filter:drop-shadow(0 14px 22px rgba(0,0,0,.45))}
.word{font-weight:700;letter-spacing:-2px;line-height:1}.word span{color:#FFB08F;font-weight:500;letter-spacing:-1px}
.tag{color:rgba(255,255,255,.82);font-weight:500}
.pill{display:inline-block;background:#FFC22E;color:#2B1D00;font-weight:700;border-radius:999px}
.cards{position:absolute;display:flex}
.card{display:flex;flex-direction:column;align-items:center;gap:12px}
.card img{filter:drop-shadow(0 18px 24px rgba(0,0,0,.5));display:block}
.card b{font-weight:700;color:#fff;text-align:center;line-height:1.1}`;
function cards(sz, gap, label) {
  return order.map((s, i) => `<div class="card" style="transform:translateY(${i === 1 ? -sz * 0.12 : 0}px) rotate(${[-6, 0, 6][i]}deg)"><img src="${dataUri(logos[s].em)}" width="${sz}" height="${sz}"><b style="font-size:${label}px;max-width:${sz + 30}px">${names[s]}</b></div>`).join('');
}
const og = await render(`<div class="s" style="width:1200px;height:630px">
<div style="position:absolute;left:70px;top:64px;display:flex;align-items:center;gap:24px">
  <div class="mark" style="width:108px;height:108px;flex:0 0 auto">${brand}</div><div class="word" style="font-size:80px">MiniGames<span>.website</span></div></div>
<div style="position:absolute;left:72px;top:236px;width:520px">
  <div class="tag" style="font-size:34px;line-height:1.3">Free mini games you can play instantly, on any phone or computer.</div>
  <div style="margin-top:34px"><span class="pill" style="font-size:26px;padding:14px 28px">Play free \u00b7 no download</span></div>
</div>
<div class="cards" style="right:48px;top:250px;gap:20px">${cards(150, 20, 20)}</div></div><style>${thumbCss}</style>`, 1200, 630, false);
await sharp(og).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(ROOT, 'public', 'og-default.jpg'));
const sq = await render(`<div class="s" style="width:1200px;height:1200px">
<div style="position:absolute;left:0;right:0;top:120px;display:flex;flex-direction:column;align-items:center;text-align:center">
  <div class="mark" style="width:170px;height:170px">${brand}</div>
  <div class="word" style="font-size:104px;margin-top:34px">MiniGames<span>.website</span></div>
  <div class="tag" style="font-size:40px;margin-top:22px">Free mini games · play instantly</div>
</div>
<div class="cards" style="left:0;right:0;top:600px;justify-content:center;gap:40px">${cards(250, 40, 30)}</div></div><style>${thumbCss}</style>`, 1200, 1200, false);
await sharp(sq).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(ROOT, 'public', 'og-square.jpg'));

/* ------------------------------------------------------------ approval sheet */
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
const sheet = await render(`<div style="width:1600px;height:1500px;background:#EEF0F6;color:#171A2B;padding:44px 56px;font-family:Poppins">
<h1 style="margin:0 0 4px;font-size:34px">Game logos and site thumbnail</h1><p style="margin:0 0 26px;color:#5A6079;font-size:19px">Each game gets an emblem (app icon) and title lettering. The site thumbnail leads with the MiniGames brand and shows game logos as examples.</p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:28px">${order.map(s => `<div style="background:#fff;border-radius:22px;padding:22px;display:grid;justify-items:center;gap:6px;box-shadow:0 10px 30px -18px rgba(0,0,0,.4)"><img src="${dataUri(logos[s].em)}" width="300" height="300"><img src="${dataUri(logos[s].wm)}" width="420"></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:28px;margin-top:30px;align-items:start">
<div><img src="${dataUri(og)}" style="width:100%;border-radius:16px;box-shadow:0 14px 34px -16px rgba(0,0,0,.5)"><p style="color:#5A6079;font-size:16px;margin:10px 0 0">Site thumbnail 1200×630 (Facebook, WhatsApp, X, Google Discover)</p></div>
<div><img src="${dataUri(sq)}" style="width:100%;border-radius:16px;box-shadow:0 14px 34px -16px rgba(0,0,0,.5)"><p style="color:#5A6079;font-size:16px;margin:10px 0 0">Square 1200×1200 (Instagram, Facebook posts)</p></div></div></div>`, 1600, 1500, false);
fs.writeFileSync(path.join(ROOT, 'review', 'logos.png'), sheet);
await browser.close();
console.log('done: public/og-default.jpg, public/og-square.jpg, review/logos.png');
