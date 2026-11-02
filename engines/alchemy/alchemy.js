/* Alchemy Lab engine: mix two elements on the lab table to discover new ones.
 * The recipe book is written by hand: every element has its own emoji, and the order of a pair never matters.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  /* ---------- the recipe book ---------- */
  // Name=emoji. "Name=new~old": a stand-in for newer emoji that older systems (such as Windows 10) cannot draw.
  var EMOJI = {}, OLDER = {};
  ('Water=💧|Fire=🔥|Earth=🌍|Air=💨|Steam=♨️|Mud=🟤|Lava=🟠|Energy=⚡|Mist=🌁|Dust=🧹|Puddle=💦|Heat=🌡️|Mountain=⛰️|Wind=🌬️|' +
   'Pond=🪷~⛲|Lake=🏞️|Ocean=🌊|Wave=🏄|Stone=🪨~🗿|Sand=🏖️|Metal=🔩|Glass=🫙~🔍|Volcano=🌋|Island=🏝️|' +
   'Cloud=☁️|Rain=🌧️|Lightning=🌩️|Storm=⛈️|Tornado=🌪️|Cold=🥶|Ice=🧊|Snow=❄️|Glacier=🏔️|Umbrella=☂️|Hurricane=🌀|Earthquake=📳|' +
   'Sky=🌤️|Sun=☀️|Moon=🌙|Night=🌃|Day=🌞|Star=⭐|Space=🌌|Galaxy=💫|Universe=♾️|Black Hole=🕳️|Planet=🪐|Comet=☄️|Meteor=🌠|' +
   'Eclipse=🌑|Rainbow=🌈|Light=🔆|Explosion=💥|Fireworks=🎆|Sunrise=🌄|Sunset=🌇|Time=⏳|Clock=⏰|Sunglasses=🕶️|' +
   'Clay=🏺|Brick=🧱|Wall=🚧|House=🏠|Village=🏘️|City=🏙️|Castle=🏰|School=🏫|Library=📚|' +
   'Smoke=🌫️|Charcoal=⚫|Diamond=💎|Gold=🪙~🥇|Silver=🥈|Ring=💍|Crown=👑|King=🤴|Queen=👸|' +
   'Tool=🔨|Wheel=🛞~🎡|Box=📦|Paper=📄|Book=📖|Pencil=✏️|Letter=✉️|Paint=🖌️|Art=🎨|' +
   'Life=🧬|Bacteria=🦠|Plant=🌱|Grass=🌿|Meadow=🌼|Tree=🌳|Forest=🌲|Leaf=🍃|Autumn=🍂|Flower=🌸|Sunflower=🌻|Rose=🌹|' +
   'Bouquet=💐|Garden=🌷|Desert=🏜️|Cactus=🌵|Oasis=🌴|Mushroom=🍄|Fruit=🍎|Seed=🌰|Wood=🪵~🪓|Bamboo=🎋|' +
   'Fish=🐟|Frog=🐸|Lizard=🦎|Dinosaur=🦖|Dragon=🐉|Bird=🐦|Egg=🥚|Nest=🪺~🐣|Chicken=🐔|Owl=🦉|Penguin=🐧|Duck=🦆|' +
   'Swan=🦢|Flamingo=🦩|Parrot=🦜|Peacock=🦚|Eagle=🦅|Bat=🦇|Insect=🐛|Bee=🐝|Honey=🍯|Butterfly=🦋|Ladybug=🐞|Ant=🐜|' +
   'Snail=🐌|Shell=🐚|Pearl=🦪|Turtle=🐢|Crab=🦀|Whale=🐳|Dolphin=🐬|Shark=🦈|Octopus=🐙|Coral=🪸~🐠|' +
   'Animal=🐾|Cow=🐄|Horse=🐎|Unicorn=🦄|Giraffe=🦒|Camel=🐫|Goat=🐐|Monkey=🐒|Banana=🍌|Bear=🐻|Panda=🐼|Koala=🐨|' +
   'Pig=🐷|Sheep=🐑|Wool=🧶|Rabbit=🐰|Hedgehog=🦔|Lion=🦁|Tiger=🐯|Crocodile=🐊|Snake=🐍|Spider=🕷️|Dog=🐶|Fox=🦊|' +
   'Wolf=🐺|Cat=🐱|Mouse=🐭|Human=🧑|Love=❤️|Family=👪|Home=🏡|Hut=🛖~⛺|Farmer=👩‍🌾|Tractor=🚜|Cook=👨‍🍳|' +
   'Wheat=🌾|Bread=🍞|Milk=🥛|Cheese=🧀|Tomato=🍅|Pizza=🍕|Sandwich=🥪|Hot Dog=🌭|Burger=🍔|Cake=🍰|Birthday Cake=🎂|' +
   'Cupcake=🧁|Donut=🍩|Cookie=🍪|Ice Cream=🍦|Candy=🍬|Lollipop=🍭|Chocolate=🍫|Juice=🧃|Lemon=🍋|Lemonade=🥤|Tea=🍵|' +
   'Coffee=☕|Vegetable=🥕|Salad=🥗|Soup=🍲|Corn=🌽|Popcorn=🍿|Snowman=☃️|Christmas Tree=🎄|Gift=🎁|Santa=🎅|Pumpkin=🎃|' +
   'Ghost=👻|Magic=🪄~✨|Potion=🧪|Crystal Ball=🔮|Genie=🧞|Wizard=🧙|Fairy=🧚|Mermaid=🧜|Angel=👼|' +
   'Robot=🤖|Alien=👽|UFO=🛸|Astronaut=👩‍🚀|Rocket=🚀|Satellite=🛰️|Airplane=✈️|Car=🚗|Bicycle=🚲|Train=🚂|Boat=⛵|Ship=🚢|' +
   'Engine=⚙️|Electricity=🔌|Light Bulb=💡|Brain=🧠|Computer=💻|Internet=🌐|Email=📧|Phone=📱|Television=📺|Video Game=🎮|' +
   'Movie=🎬|Telescope=🔭|Microscope=🔬|Camera=📷|Photo=🖼️|Selfie=🤳|Emoji=😀|' +
   'Sound=🔊|Voice=🗣️|Music=🎵|Song=🎶|Dance=💃|Guitar=🎸|Drum=🥁|Headphones=🎧|Microphone=🎤|' +
   'Money=💰|Bank=🏦|Shop=🏪|Toy=🪀|Teddy Bear=🧸|Ball=⚽|Kite=🪁|Balloon=🎈|Party=🎉').split('|').forEach(function (p) {
    var i = p.indexOf('='), v = p.slice(i + 1).split('~');
    EMOJI[p.slice(0, i)] = v[0]; if (v[1]) OLDER[p.slice(0, i)] = v[1];
  });
  var RECIPES = (
   // the four elements
   'Water+Fire=Steam|Water+Earth=Mud|Fire+Earth=Lava|Fire+Air=Energy|Water+Air=Mist|Earth+Air=Dust|Water+Water=Puddle|' +
   'Fire+Fire=Heat|Earth+Earth=Mountain|Air+Air=Wind|' +
   // water and rock
   'Puddle+Water=Pond|Pond+Water=Lake|Lake+Water=Ocean|Ocean+Wind=Wave|Ocean+Air=Wave|Lava+Water=Stone|Lava+Air=Stone|' +
   'Stone+Wind=Sand|Stone+Water=Sand|Stone+Fire=Metal|Stone+Heat=Metal|Sand+Fire=Glass|Sand+Heat=Glass|Lava+Mountain=Volcano|' +
   'Mountain+Fire=Volcano|Volcano+Ocean=Island|Earth+Ocean=Island|' +
   // weather
   'Steam+Air=Cloud|Mist+Air=Cloud|Mist+Wind=Cloud|Cloud+Water=Rain|Cloud+Energy=Lightning|Rain+Lightning=Storm|Cloud+Wind=Storm|' +
   'Wind+Wind=Tornado|Storm+Wind=Tornado|Mountain+Air=Cold|Mountain+Wind=Cold|Water+Cold=Ice|Rain+Cold=Snow|Cloud+Cold=Snow|' +
   'Ice+Mountain=Glacier|Snow+Mountain=Glacier|Rain+Tool=Umbrella|Storm+Ocean=Hurricane|Tornado+Ocean=Hurricane|Earth+Energy=Earthquake|' +
   // sky and space
   'Air+Cloud=Sky|Cloud+Cloud=Sky|Sky+Fire=Sun|Sky+Energy=Sun|Sky+Stone=Moon|Sky+Moon=Night|Sky+Sun=Day|Sun+Moon=Eclipse|' +
   'Night+Energy=Star|Night+Fire=Star|Night+Star=Space|Sky+Star=Space|Star+Star=Galaxy|Space+Star=Galaxy|Galaxy+Galaxy=Universe|' +
   'Space+Time=Universe|Space+Galaxy=Black Hole|Earth+Space=Planet|Stone+Space=Meteor|Ice+Space=Comet|Star+Ice=Comet|' +
   'Rain+Sun=Rainbow|Light+Rain=Rainbow|Sun+Energy=Light|Fire+Energy=Explosion|Explosion+Sky=Fireworks|Sun+Mountain=Sunrise|' +
   'Sun+City=Sunset|Day+Night=Time|Sand+Glass=Time|Time+Metal=Clock|Time+Tool=Clock|Sun+Glass=Sunglasses|' +
   // building
   'Mud+Sand=Clay|Clay+Fire=Brick|Mud+Fire=Brick|Brick+Brick=Wall|Wall+Wall=House|House+House=Village|Village+Village=City|' +
   'King+House=Castle|Wall+King=Castle|Book+House=School|Book+Book=Library|' +
   // treasure
   'Fire+Leaf=Smoke|Fire+Grass=Smoke|Fire+Wood=Charcoal|Charcoal+Volcano=Diamond|Charcoal+Earthquake=Diamond|Metal+Sun=Gold|' +
   'Metal+Rainbow=Gold|Metal+Moon=Silver|Gold+Diamond=Ring|Gold+Star=Crown|Human+Crown=King|King+Love=Queen|' +
   // tools and paper
   'Metal+Stone=Tool|Stone+Tool=Wheel|Wood+Tool=Box|Wood+Water=Paper|Tree+Tool=Wood|Paper+Paper=Book|Wood+Charcoal=Pencil|' +
   'Paper+Pencil=Letter|Rainbow+Water=Paint|Paint+Paper=Art|Human+Paint=Art|' +
   // plants
   'Lightning+Ocean=Life|Lightning+Mud=Life|Life+Water=Bacteria|Life+Mud=Bacteria|Life+Earth=Plant|Rain+Earth=Plant|Seed+Earth=Plant|' +
   'Plant+Plant=Grass|Grass+Grass=Meadow|Plant+Time=Tree|Tree+Tree=Forest|Tree+Air=Leaf|Tree+Wind=Leaf|Leaf+Cold=Autumn|' +
   'Leaf+Wind=Autumn|Plant+Sun=Flower|Flower+Sun=Sunflower|Flower+Love=Rose|Flower+Flower=Bouquet|Flower+Grass=Garden|' +
   'Flower+Meadow=Garden|Sand+Sand=Desert|Plant+Desert=Cactus|Desert+Water=Oasis|Plant+Night=Mushroom|Tree+Flower=Fruit|' +
   'Fruit+Earth=Seed|Grass+Tree=Bamboo|' +
   // animals
   'Life+Ocean=Fish|Life+Lake=Fish|Fish+Mud=Frog|Frog+Earth=Lizard|Lizard+Time=Dinosaur|Lizard+Fire=Dragon|Dinosaur+Fire=Dragon|' +
   'Lizard+Air=Bird|Lizard+Sky=Bird|Bird+Bird=Egg|Bird+Tree=Nest|Egg+Meadow=Chicken|Bird+Night=Owl|Bird+Ice=Penguin|' +
   'Bird+Cold=Penguin|Bird+Pond=Duck|Bird+Lake=Swan|Bird+Rose=Flamingo|Bird+Rainbow=Parrot|Bird+Garden=Peacock|Bird+Mountain=Eagle|' +
   'Mouse+Bird=Bat|Life+Dust=Insect|Bacteria+Earth=Insect|Insect+Flower=Bee|Bee+Flower=Honey|Insect+Rainbow=Butterfly|' +
   'Insect+Garden=Ladybug|Insect+Earth=Ant|Insect+Shell=Snail|Ocean+Stone=Shell|Shell+Sand=Pearl|Lizard+Shell=Turtle|' +
   'Fish+Shell=Crab|Fish+Ocean=Whale|Fish+Wave=Dolphin|Fish+Wolf=Shark|Ocean+Animal=Octopus|Ocean+Plant=Coral|Life+Forest=Animal|' +
   'Animal+Grass=Cow|Animal+Meadow=Horse|Horse+Rainbow=Unicorn|Horse+Tree=Giraffe|Animal+Desert=Camel|Animal+Mountain=Goat|' +
   'Animal+Tree=Monkey|Monkey+Fruit=Banana|Animal+Forest=Bear|Bear+Bamboo=Panda|Bear+Tree=Koala|Animal+Mud=Pig|Animal+Cloud=Sheep|' +
   'Sheep+Tool=Wool|Animal+Vegetable=Rabbit|Animal+Cactus=Hedgehog|Animal+King=Lion|Lion+Forest=Tiger|Lizard+Lake=Crocodile|' +
   'Lizard+Grass=Snake|Insect+Night=Spider|Human+Animal=Dog|Dog+Forest=Fox|Dog+Moon=Wolf|Animal+House=Cat|Cat+Cheese=Mouse|' +
   // people
   'Monkey+Time=Human|Clay+Life=Human|Human+Human=Love|Love+Human=Family|Family+House=Home|Wood+Grass=Hut|Human+Wood=Hut|' +
   'Human+Meadow=Farmer|Farmer+Car=Tractor|Farmer+Engine=Tractor|Human+Fire=Cook|' +
   // food
   'Farmer+Plant=Wheat|Wheat+Fire=Bread|Wheat+Heat=Bread|Cow+Human=Milk|Cow+Farmer=Milk|Milk+Time=Cheese|Fruit+Garden=Tomato|' +
   'Bread+Tomato=Pizza|Bread+Cheese=Sandwich|Dog+Bread=Hot Dog|Dog+Heat=Hot Dog|Bread+Cow=Burger|Bread+Honey=Cake|' +
   'Cake+Fire=Birthday Cake|Cake+Paper=Cupcake|Cake+Ring=Donut|Wheat+Honey=Cookie|Milk+Ice=Ice Cream|Milk+Snow=Ice Cream|' +
   'Honey+Fruit=Candy|Candy+Wood=Lollipop|Candy+Milk=Chocolate|Fruit+Water=Juice|Fruit+Sun=Lemon|Lemon+Water=Lemonade|' +
   'Leaf+Steam=Tea|Plant+Steam=Tea|Seed+Steam=Coffee|Garden+Farmer=Vegetable|Vegetable+Vegetable=Salad|Vegetable+Water=Soup|' +
   'Cook+Vegetable=Soup|Wheat+Sun=Corn|Corn+Heat=Popcorn|Corn+Fire=Popcorn|' +
   // holidays and magic
   'Snow+Human=Snowman|Snow+Snow=Snowman|Tree+Star=Christmas Tree|Tree+Snow=Christmas Tree|Box+Love=Gift|Gift+Human=Santa|' +
   'Christmas Tree+Human=Santa|Fruit+Night=Pumpkin|Human+Mist=Ghost|Rainbow+Energy=Magic|Human+Magic=Wizard|Water+Magic=Potion|' +
   'Glass+Magic=Crystal Ball|Magic+Smoke=Genie|Human+Butterfly=Fairy|Magic+Flower=Fairy|Human+Fish=Mermaid|Human+Bird=Angel|' +
   // machines
   'Metal+Human=Robot|Metal+Life=Robot|Life+Planet=Alien|Life+Space=Alien|Alien+Airplane=UFO|Alien+Rocket=UFO|Human+Space=Astronaut|' +
   'Human+Rocket=Astronaut|Airplane+Space=Rocket|Metal+Explosion=Rocket|Metal+Space=Satellite|Metal+Bird=Airplane|Metal+Wheel=Car|' +
   'Engine+Wheel=Car|Wheel+Wheel=Bicycle|Steam+Car=Train|Wood+Ocean=Boat|Wood+Lake=Boat|Boat+Metal=Ship|Boat+Engine=Ship|' +
   'Metal+Energy=Engine|Lightning+Metal=Electricity|Electricity+Glass=Light Bulb|Light+Glass=Light Bulb|Human+Electricity=Brain|' +
   'Electricity+Brain=Computer|Computer+Computer=Internet|Letter+Internet=Email|Letter+Computer=Email|Electricity+Sound=Phone|' +
   'Computer+Sound=Phone|Electricity+Box=Television|Television+Toy=Video Game|Computer+Toy=Video Game|Photo+Time=Movie|' +
   'Glass+Star=Telescope|Glass+Bacteria=Microscope|Box+Light=Camera|Camera+Paper=Photo|Phone+Human=Selfie|Phone+Love=Emoji|' +
   // sound and fun
   'Air+Wave=Sound|Sound+Human=Voice|Sound+Love=Music|Music+Bird=Song|Voice+Music=Song|Music+Human=Dance|Music+Wood=Guitar|' +
   'Sound+Wood=Drum|Music+Electricity=Headphones|Song+Electricity=Microphone|Gold+Paper=Money|Money+House=Bank|Money+Box=Shop|' +
   'Human+Box=Toy|Bear+Toy=Teddy Bear|Toy+Air=Ball|Toy+Wind=Kite|Paper+Wind=Kite|Love+Air=Balloon|Balloon+Birthday Cake=Party|' +
   'Music+Balloon=Party|Party+Music=Dance').split('|');
  var BOOK = {}, USED = {};
  function pairKey(a, b) { return a < b ? a + '+' + b : b + '+' + a; }
  RECIPES.forEach(function (r) {
    var m = r.split('='), ab = m[0].split('+');
    BOOK[pairKey(ab[0], ab[1])] = m[1]; USED[ab[0]] = USED[ab[1]] = 1;
  });
  var ALL = Object.keys(EMOJI), BASE = ['Water', 'Fire', 'Earth', 'Air'];
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

  // An emoji this device cannot draw comes out as a plain box in the text colour; colour emoji never do.
  function canDraw(e) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 28;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.font = '22px ' + EMOJI_FONT; x.textBaseline = 'top'; x.fillStyle = '#0000ff'; x.fillText(e, 2, 2);
      var d = x.getImageData(0, 0, 28, 28).data;
      for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 60 && (d[i] > 70 || d[i + 1] > 70)) return true;
      return false;
    } catch (err) { return true; }
  }
  Object.keys(OLDER).forEach(function (n) { if (!canDraw(EMOJI[n])) EMOJI[n] = OLDER[n]; });

  /* ---------- state ---------- */
  var saved = MG.store.get('found', null), found = [];
  BASE.concat(Array.isArray(saved) ? saved : []).forEach(function (n) { if (EMOJI[n] && found.indexOf(n) < 0) found.push(n); });
  var items = [], nextId = 1, selected = null, query = '', fresh = {}, kbd = false;
  var sortMode = MG.store.get('sort', 'az') === 'new' ? 'new' : 'az';

  /* ---------- DOM ---------- */
  var countEl = h('b');
  var countPill = h('span', { class: 'mg-pill al-count', title: 'Elements found' }, h('small', { text: 'Found' }), countEl);
  var hintBtn = h('button', { class: 'al-btn', type: 'button', 'aria-label': 'Hint', html: '<span aria-hidden="true">💡</span><i>Hint</i>' });
  var clearBtn = h('button', { class: 'al-btn', type: 'button', 'aria-label': 'Clear the table', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/></svg><i>Clear</i>' });
  var resetBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Start over', title: 'Start over',
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v5h5"/></svg>' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var labHint = h('p', { class: 'al-labhint' });
  var banner = h('div', { class: 'al-banner', 'aria-live': 'polite' });
  var lab = h('div', { class: 'al-lab', role: 'region', 'aria-label': 'Lab table' }, labHint, banner);
  var search = h('input', { class: 'al-search', type: 'search', placeholder: 'Search', 'aria-label': 'Search your elements', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search' });
  var sortBtn = h('button', { class: 'al-sort', type: 'button' });
  var listEl = h('div', { class: 'al-list', role: 'group', 'aria-label': 'Your elements' });
  var side = h('div', { class: 'al-side' }, h('div', { class: 'al-tools' }, search, sortBtn), listEl);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root al' },
    h('div', { class: 'mg-hud' }, countPill, h('span', { class: 'mg-spacer' }), hintBtn, clearBtn, resetBtn, soundBtn),
    h('div', { class: 'al-body' }, lab, side), overlay);
  document.getElementById('game').append(root);

  function card(name) {
    return h('span', { class: 'al-card' }, h('span', { class: 'al-emoji', 'aria-hidden': 'true', text: EMOJI[name] }), h('span', { class: 'al-name', text: name }));
  }

  /* ---------- the list of discovered elements ---------- */
  function chip(name) {
    var fin = !USED[name];
    return h('button', { class: 'al-chip' + (fresh[name] ? ' is-new' : '') + (fin ? ' is-final' : ''), type: 'button', 'data-name': name,
      title: fin ? name + ': a final element, it does not mix any further' : name, 'aria-label': name + (fin ? ', final element' : '') },
      h('span', { class: 'al-emoji', 'aria-hidden': 'true', text: EMOJI[name] }), h('span', { class: 'al-name', text: name }));
  }
  function renderList() {
    var q = query.trim().toLowerCase(), list = found.slice(), frag = document.createDocumentFragment(), n = 0;
    if (sortMode === 'az') list.sort(function (a, b) { return a < b ? -1 : 1; }); else list.reverse();
    list.forEach(function (name) { if (!q || name.toLowerCase().indexOf(q) >= 0) { frag.append(chip(name)); n++; } });
    listEl.innerHTML = '';
    if (!n) frag.append(h('p', { class: 'al-empty', text: 'Nothing here yet. Keep mixing!' }));
    listEl.append(frag);
    countEl.textContent = found.length + ' / ' + ALL.length;
    sortBtn.textContent = sortMode === 'az' ? 'A–Z' : 'Newest';
    sortBtn.setAttribute('aria-label', 'Order: ' + (sortMode === 'az' ? 'A to Z' : 'newest first') + '. Change order');
  }
  function chipFor(name) { return listEl.querySelector('[data-name="' + name + '"]'); }
  function reveal(c) { // scroll the list (only the list, never the page) so the chip is visible
    var lr = listEl.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (cr.top < lr.top) listEl.scrollTop += cr.top - lr.top - 8; else if (cr.bottom > lr.bottom) listEl.scrollTop += cr.bottom - lr.bottom + 8;
    if (cr.left < lr.left) listEl.scrollLeft += cr.left - lr.left - 8; else if (cr.right > lr.right) listEl.scrollLeft += cr.right - lr.right + 8;
  }
  function useChip(name) { if (fresh[name]) { delete fresh[name]; var c = chipFor(name); if (c) c.classList.remove('is-new'); } }
  search.addEventListener('input', function () { query = search.value; renderList(); });
  sortBtn.addEventListener('click', function () { sortMode = sortMode === 'az' ? 'new' : 'az'; MG.store.set('sort', sortMode); listEl.scrollTop = listEl.scrollLeft = 0; renderList(); MG.sfx.tap(); });

  /* ---------- items on the lab table ---------- */
  function addItem(name, x, y, anim) {
    var el = h('button', { class: 'al-item', type: 'button', 'aria-label': name + ', on the table' }, card(name));
    if (anim) el.firstChild.classList.add(anim);
    var it = { id: nextId++, name: name, x: x, y: y, el: el };
    place(it); lab.append(el); items.push(it); updateHint();
    return it;
  }
  function itemOf(el) { for (var i = 0; i < items.length; i++) if (items[i].el === el) return items[i]; return null; }
  function place(it) { it.el.style.left = it.x + '%'; it.el.style.top = it.y + '%'; }
  function removeItem(it) {
    items = items.filter(function (x) { return x !== it; }); it.el.remove();
    if (selected === it) selected = null;
    updateHint();
  }
  function select(it) { if (selected) selected.el.classList.remove('is-sel'); selected = it || null; if (selected) selected.el.classList.add('is-sel'); }
  function keepInside(it) {
    var lr = lab.getBoundingClientRect(), r = it.el.getBoundingClientRect();
    if (!lr.width || !lr.height) return;
    var hx = Math.min(50, r.width / 2 / lr.width * 100 + 1), hy = Math.min(50, r.height / 2 / lr.height * 100 + 1);
    it.x = Math.max(hx, Math.min(100 - hx, it.x)); it.y = Math.max(hy, Math.min(100 - hy, it.y)); place(it);
  }
  function freeSpot() {
    var lr = lab.getBoundingClientRect(), W = lr.width || 320, H = lr.height || 320;
    var mx = Math.min(45, 50 / W * 100), my = Math.min(45, 46 / H * 100);
    function rnd() { return [mx + Math.random() * (100 - 2 * mx), my + Math.random() * (100 - 2 * my)]; }
    for (var t = 0; t < 40; t++) {
      var p = rnd();
      if (items.every(function (it) { return Math.abs(it.x - p[0]) / 100 * W > 86 || Math.abs(it.y - p[1]) / 100 * H > 78; })) return p;
    }
    return rnd();
  }
  function itemAt(px, py, except) {
    var hit = null; // the last match is the one drawn on top
    items.forEach(function (it) {
      if (it === except) return;
      var r = it.el.getBoundingClientRect();
      if (px >= r.left - 8 && px <= r.right + 8 && py >= r.top - 8 && py <= r.bottom + 8) hit = it;
    });
    return hit;
  }
  function updateHint() {
    var first = found.length <= BASE.length;
    labHint.textContent = first ? 'Tap two elements to mix them, or drag one onto another.'
      : items.length ? '' : 'Your table is empty. Tap or drag elements from your list.';
    labHint.hidden = !labHint.textContent;
  }

  /* ---------- mixing ---------- */
  function mix(a, b) {
    var res = BOOK[pairKey(a.name, b.name)];
    if (!res) {
      [a, b].forEach(function (it) { var c = it.el.firstChild; c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope'); });
      MG.tone(190, 0.12, 'sine', 0.04, 140);
      say([{ e: '🤔' }, ' Nothing happened. Try another pair'], 'is-soft');
      save(); return;
    }
    var x = b.x, y = b.y;
    removeItem(a); removeItem(b);
    var isNew = found.indexOf(res) < 0;
    var it = addItem(res, x, y, isNew ? 'is-born' : 'is-pop');
    sparkle(it.el, isNew ? 18 : 8);
    if (isNew) {
      found.push(res); fresh[res] = 1; MG.store.set('found', found);
      say([{ e: EMOJI[res] }, ' New: ' + res + '!'], 'is-new');
      [523, 659, 784, 1047].forEach(function (f, i) { MG.tone(f, 0.14, 'triangle', 0.055, 0, i * 0.07); });
      MG.vibrate(15);
      countPill.classList.remove('is-bump'); void countPill.offsetWidth; countPill.classList.add('is-bump');
      renderList(); updateHint();
      var c = chipFor(res); if (c) reveal(c);
      if (found.length === ALL.length) setTimeout(allDone, 900);
      else if (found.length % 25 === 0) { MG.confetti(120); MG.sfx.win(); }
      MG.event('discover', { name: res, count: found.length });
    } else {
      say([{ e: EMOJI[res] }, ' ' + res], '');
      MG.tone(660, 0.1, 'triangle', 0.045); MG.tone(880, 0.1, 'sine', 0.025, 0, 0.06);
    }
    if (kbd) try { it.el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    save();
  }
  function say(parts, cls) { // parts: text, or { e: emoji, sr: true to let screen readers read the emoji }
    banner.className = 'al-banner'; banner.innerHTML = '';
    parts.forEach(function (p) { banner.append(typeof p === 'string' ? p : h('span', { class: 'al-emoji', 'aria-hidden': p.sr ? null : 'true', text: p.e })); });
    void banner.offsetWidth;
    banner.className = 'al-banner is-on' + (cls ? ' ' + cls : '');
  }
  function sparkle(el, n) {
    if (reduce) return;
    var r = el.getBoundingClientRect(), rr = root.getBoundingClientRect(), cols = ['#FFD15C', '#FF6FB5', '#5EF2C2'];
    for (var k = 0; k < n; k++) {
      var s = h('i', { class: 'al-spark', 'aria-hidden': 'true' }), a = (k / n) * 6.283 + Math.random() * 0.3, d = 44 + Math.random() * 46;
      s.style.left = (r.left - rr.left + r.width / 2) + 'px'; s.style.top = (r.top - rr.top + r.height / 2) + 'px';
      s.style.background = cols[k % 3]; s.style.color = cols[k % 3];
      s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      root.append(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 700);
    }
  }
  function hint() {
    var opts = [];
    RECIPES.forEach(function (r) {
      var m = r.split('='), ab = m[0].split('+');
      if (found.indexOf(m[1]) < 0 && found.indexOf(ab[0]) >= 0 && found.indexOf(ab[1]) >= 0) opts.push([ab[0], ab[1], m[1]]);
    });
    if (!opts.length) { say([{ e: '🏆' }, ' You have found everything!'], 'is-new'); return; }
    var p = opts[(Math.random() * opts.length) | 0], show = Math.random() < 0.5 ? p[0] : p[1];
    say([{ e: '💡' }, ' Try ', { e: EMOJI[show] }, ' ' + show + ' with something to make ', { e: EMOJI[p[2]], sr: true }], 'is-hint');
    if (query) { query = ''; search.value = ''; renderList(); }
    var c = chipFor(show);
    if (c) { c.classList.add('is-hinted'); reveal(c); setTimeout(function () { c.classList.remove('is-hinted'); }, 3200); }
    MG.tone(880, 0.08, 'sine', 0.04); MG.tone(1175, 0.1, 'sine', 0.035, 0, 0.08);
    MG.event('hint', { count: found.length });
  }

  /* ---------- dialogs ---------- */
  function dialog(emoji, title, text, buttons) {
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'al-bigemoji', 'aria-hidden': 'true', text: emoji }), h('h2', { class: 'mg-title', text: title }),
      h('p', { class: 'mg-sub', text: text }), h('div', { class: 'mg-row' }, buttons)));
    overlay.hidden = false;
    MG.focusSafe(buttons[buttons.length - 1]);
  }
  function closeOverlay() { overlay.hidden = true; overlay.innerHTML = ''; }
  function allDone() {
    MG.sfx.win(); MG.confetti(200);
    var ok = h('button', { class: 'mg-btn', type: 'button', text: 'Keep playing' });
    ok.addEventListener('click', closeOverlay);
    dialog('⚗️', 'Master alchemist!', 'You discovered all ' + ALL.length + ' elements. Every recipe in the book is yours.', [ok]);
    MG.event('win', { count: found.length });
  }
  function askReset() {
    var no = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Cancel' });
    var yes = h('button', { class: 'mg-btn', type: 'button', text: 'Start over' });
    no.addEventListener('click', closeOverlay);
    yes.addEventListener('click', function () {
      closeOverlay(); found = BASE.slice(); fresh = {}; query = ''; search.value = '';
      MG.store.set('found', found); items.slice().forEach(removeItem); select(null);
      addItem('Water', 34, 50, 'is-pop'); addItem('Fire', 66, 50, 'is-pop');
      renderList(); updateHint(); save(); MG.sfx.tap();
      say([{ e: '⚗️' }, ' A fresh start. Good luck!'], 'is-soft');
    });
    dialog('⚗️', 'Start over?', 'This forgets the ' + found.length + ' elements you have found. You keep Water, Fire, Earth and Air.', [no, yes]);
  }
  function save() {
    if (o.showcase) return;
    MG.store.set('lab', items.slice(-40).map(function (it) { return [it.name, Math.round(it.x * 10) / 10, Math.round(it.y * 10) / 10]; }));
  }

  /* ---------- pointer: drag from the list, drag on the table, tap to select and mix ---------- */
  var drag = null;
  function point(d, e) { return d.chipName ? [e.clientX, e.clientY - d.lift] : [e.clientX - d.off[0], e.clientY - d.off[1]]; }
  function mark(t) { items.forEach(function (x) { x.el.classList.toggle('is-target', x === t); }); }
  root.addEventListener('pointerdown', function (e) {
    if (!overlay.hidden || e.button > 0 || drag) return;
    var c = e.target.closest('.al-chip'), el = e.target.closest('.al-item'), it = el ? itemOf(el) : null;
    if (!c && !it) return;
    kbd = false;
    try { (c || el).setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var off = [0, 0];
    if (it) { var r = el.getBoundingClientRect(); off = [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)]; e.preventDefault(); }
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, chipName: c ? c.getAttribute('data-name') : null,
      item: it, ghost: null, off: off, lift: e.pointerType === 'touch' ? 36 : 0 };
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 8) return;
      drag.moved = true;
      if (drag.chipName) { drag.ghost = h('div', { class: 'al-item al-ghost', 'aria-hidden': 'true' }, card(drag.chipName)); root.append(drag.ghost); }
      else { drag.item.el.classList.add('is-drag'); select(null); }
    }
    var p = point(drag, e);
    if (drag.ghost) { var rr = root.getBoundingClientRect(); drag.ghost.style.left = (p[0] - rr.left) + 'px'; drag.ghost.style.top = (p[1] - rr.top) + 'px'; }
    else { var lr = lab.getBoundingClientRect(); drag.item.x = (p[0] - lr.left) / lr.width * 100; drag.item.y = (p[1] - lr.top) / lr.height * 100; place(drag.item); }
    mark(itemAt(p[0], p[1], drag.item));
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; mark(null);
    if (!d.moved) { tap(d); return; }
    var p = point(d, e), lr = lab.getBoundingClientRect();
    var inLab = p[0] >= lr.left && p[0] <= lr.right && p[1] >= lr.top && p[1] <= lr.bottom;
    if (d.ghost) {
      d.ghost.remove();
      if (!inLab) return;
      useChip(d.chipName);
      var target = itemAt(p[0], p[1], null);
      var nu = addItem(d.chipName, (p[0] - lr.left) / lr.width * 100, (p[1] - lr.top) / lr.height * 100, 'is-pop');
      MG.tone(500, 0.05, 'triangle', 0.04);
      if (target) mix(nu, target); else { keepInside(nu); save(); }
    } else {
      d.item.el.classList.remove('is-drag');
      if (!inLab) { removeItem(d.item); MG.tone(260, 0.06, 'sine', 0.03, 180); save(); return; }
      var tg = itemAt(p[0], p[1], d.item);
      if (tg) mix(d.item, tg); else { keepInside(d.item); save(); }
    }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; mark(null);
    if (d.ghost) d.ghost.remove();
    if (d.item && d.moved) { d.item.el.classList.remove('is-drag'); keepInside(d.item); save(); }
  });
  var lastTap = { id: 0, t: 0 };
  function tap(d) {
    if (d.chipName) { // a list element goes onto the table; if something is picked, they mix straight away
      useChip(d.chipName);
      var sp = freeSpot(), nu = addItem(d.chipName, sp[0], sp[1], 'is-pop');
      MG.tone(500, 0.05, 'triangle', 0.04);
      if (selected) { var s = selected; select(null); mix(nu, s); return; }
      select(nu); save(); return;
    }
    var it = d.item, now = performance.now();
    if (!it) return;
    if (lastTap.id === it.id && now - lastTap.t < 330) { // double tap: a copy of it
      lastTap = { id: 0, t: 0 }; select(null);
      var cp = addItem(it.name, it.x + 7, it.y + 6, 'is-pop'); keepInside(cp);
      MG.tone(560, 0.05, 'triangle', 0.04); save(); return;
    }
    lastTap = { id: it.id, t: now };
    if (!selected) { select(it); MG.tone(620, 0.04, 'sine', 0.03); return; }
    if (selected === it) { select(null); return; }
    var a = selected; select(null); mix(a, it);
  }
  lab.addEventListener('click', function (e) { if (e.target === lab || e.target === labHint) select(null); });

  /* ---------- keyboard: Enter or Space acts like a tap; Delete takes an element off the table ---------- */
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!overlay.hidden) closeOverlay(); else select(null); return; }
    var c = e.target.closest && e.target.closest('.al-chip'), el = e.target.closest && e.target.closest('.al-item');
    if (el && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); var gone = itemOf(el); if (gone) { removeItem(gone); save(); } return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!c && !el) return;
    e.preventDefault(); kbd = true;
    tap({ chipName: c ? c.getAttribute('data-name') : null, item: el ? itemOf(el) : null });
  });
  hintBtn.addEventListener('click', hint);
  clearBtn.addEventListener('click', function () { items.slice().forEach(removeItem); select(null); save(); MG.tone(300, 0.08, 'sine', 0.03, 200); });
  resetBtn.addEventListener('click', askReset);
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ---------- start ---------- */
  renderSound();
  if (o.showcase) { // still frame: a busy lab table moments after a volcano was discovered
    root.classList.add('is-showcase');
    found = ['Water', 'Fire', 'Earth', 'Air', 'Steam', 'Lava', 'Rainbow', 'Unicorn', 'Dragon', 'Rocket', 'Pizza', 'Butterfly',
      'Flower', 'Snowman', 'Diamond', 'Cat', 'Volcano', 'Cloud', 'Planet', 'Fairy', 'Ice Cream', 'Crown', 'Tree', 'Sun'];
    fresh = { Volcano: 1 };
    renderList(); labHint.hidden = true;
    [['Cloud', 50, 27], ['Fire', 80, 38], ['Unicorn', 80, 73], ['Dragon', 50, 86], ['Rainbow', 20, 73], ['Water', 20, 38]]
      .forEach(function (p) { addItem(p[0], p[1], p[2]); });
    addItem('Volcano', 50, 56, 'is-still');
    labHint.hidden = true;
    banner.innerHTML = ''; banner.append(h('span', { class: 'al-emoji', text: '🌋' }), ' New: Volcano!');
    banner.className = 'al-banner is-new is-still';
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  } else {
    renderList();
    var start = MG.store.get('lab', null);
    (Array.isArray(start) ? start : [['Water', 34, 50], ['Fire', 66, 50]]).forEach(function (p) {
      if (p && EMOJI[p[0]] && found.indexOf(p[0]) >= 0) addItem(p[0], +p[1] || 50, +p[2] || 50);
    });
    updateHint();
  }
  MG.ready();
})();
