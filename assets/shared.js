/**
 * Path handling
 * ------------------------------------------------------------------
 * On the live site every path is written from the domain root
 * ("/assets/x.js", "/rock-paper-scissors/"). That only works when
 * served over http(s). When someone opens a file directly on their
 * computer (file:///D:/.../index.html) there is no domain root, so
 * absolute paths break.
 *
 * Fix: every HTML page declares its own depth via a data attribute
 * on <body> — data-depth="0" for root pages (home, /all-games/),
 * data-depth="1" for a game page one folder deep. resolvePath()
 * uses that to build the right relative path ONLY when testing via
 * file://; on a real http(s) deployment it just returns the
 * absolute path unchanged.
 */
function isFileProtocol() {
  return window.location.protocol === "file:";
}

function pageDepth() {
  return Number(document.body?.dataset.depth || "0");
}

function resolvePath(absPath) {
  if (!isFileProtocol()) return absPath;
  const clean = absPath.replace(/^\//, "");
  const prefix = "../".repeat(pageDepth());
  if (clean === "") return pageDepth() > 0 ? prefix : "./";
  return `${prefix}${clean}`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderLayoutComponents();
  initSearch();
  initSubscribe();

  switch (document.body?.dataset.page) {
    case "home":
      initHomepageGrid();
      break;
    case "all-games":
      initAllGamesGrid();
      break;
    case "game":
      initMoreGamesStrip();
      break;
  }
});

function renderLayoutComponents() {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  if (headerEl) {
    headerEl.innerHTML = `
      <div class="container">
        <a href="${resolvePath('/')}" class="brand-link">MiniGames.website</a>
        <div class="nav-group">
          <div class="search-wrap">
            <input type="search" id="site-search" class="search-input" placeholder="Search games…" autocomplete="off" aria-label="Search games">
            <div id="search-results" class="search-results"></div>
          </div>
          <a href="${resolvePath('/all-games/')}" class="nav-link">All Games</a>
        </div>
      </div>
    `;
  }

  if (footerEl) {
    footerEl.innerHTML = `
      <div class="container">
        <div>
          <span>&copy; ${new Date().getFullYear()} MiniGames.website</span>
          <div class="footer-links">
            <a href="${resolvePath('/about/')}" class="footer-link">About</a>
            <a href="${resolvePath('/contact/')}" class="footer-link">Contact</a>
          </div>
        </div>
        <div>
          <div class="subscribe-form">
            <input type="email" id="subscribe-email" class="subscribe-input" placeholder="Your email" aria-label="Your email">
            <button type="button" id="subscribe-btn" class="subscribe-btn">Notify me</button>
          </div>
          <p class="subscribe-note">Get an email when a new game goes up.</p>
        </div>
      </div>
    `;
  }
}

let gamesCache = null;

async function fetchGames() {
  if (gamesCache) return gamesCache;
  const response = await fetch(resolvePath("/games.json"));
  if (!response.ok) throw new Error("Network response was not ok");
  const games = await response.json();
  gamesCache = Array.isArray(games) ? games : [];
  return gamesCache;
}

function gameCardHTML(game) {
  const href = resolvePath(`/${game.slug}/`);
  const thumb = resolvePath(game.thumbnail || "/assets/placeholder.jpg");
  return `
    <a href="${href}" class="game-card">
      <img class="card-thumb" src="${thumb}" alt="${game.title} screenshot" loading="lazy">
      <div class="card-body">
        <div class="card-tags">
          ${(game.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
        </div>
        <h3 class="card-title">${game.title}</h3>
        <p class="card-tagline">${game.tagline}</p>
      </div>
    </a>
  `;
}

// Homepage: splits games.json into two sections by the "section" field
// ("popular" or "new"). Add a new game to games.json and it lands in the
// right section automatically — no other file needs to change.
async function initHomepageGrid() {
  const popularContainer = document.getElementById("popular-grid");
  const newContainer = document.getElementById("new-grid");
  if (!popularContainer || !newContainer) return;

  try {
    const games = await fetchGames();

    const popular = games.filter(g => g.section === "popular");
    const newGames = games
      .filter(g => g.section === "new")
      .sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));

    popularContainer.innerHTML = popular.length
      ? popular.map(gameCardHTML).join('')
      : `<div class="empty-state">More games coming soon</div>`;

    newContainer.innerHTML = newGames.length
      ? newGames.map(gameCardHTML).join('')
      : `<div class="empty-state">More games coming soon</div>`;
  } catch (error) {
    console.error("Failed to fetch games list:", error);
    popularContainer.innerHTML = `<div class="empty-state">More games coming soon</div>`;
    newContainer.innerHTML = `<div class="empty-state">More games coming soon</div>`;
  }
}

// /all-games/ page: every game in one flat, alphabetically sorted grid.
async function initAllGamesGrid() {
  const container = document.getElementById("all-games-grid");
  if (!container) return;

  try {
    const games = await fetchGames();
    const sorted = [...games].sort((a, b) => a.title.localeCompare(b.title));

    container.innerHTML = sorted.length
      ? sorted.map(gameCardHTML).join('')
      : `<div class="empty-state">More games coming soon</div>`;
  } catch (error) {
    console.error("Failed to fetch games list:", error);
    container.innerHTML = `<div class="empty-state">More games coming soon</div>`;
  }
}

// Individual game pages: auto-fills the "More Games" strip. Prefers other
// games that share a tag with the current one (e.g. give every version of
// Rock Paper Scissors the shared tag "rock-paper-scissors" so they always
// link to each other), then fills any remaining slots at random.
async function initMoreGamesStrip() {
  const container = document.getElementById("more-games-grid");
  if (!container) return;

  const currentSlug = document.body?.dataset.slug || "";

  try {
    const games = await fetchGames();
    const current = games.find(g => g.slug === currentSlug);
    const others = games.filter(g => g.slug !== currentSlug);

    let related = [];
    if (current && current.tags && current.tags.length) {
      related = others.filter(g => (g.tags || []).some(tag => current.tags.includes(tag)));
    }

    const rest = others.filter(g => !related.includes(g)).sort(() => Math.random() - 0.5);
    const picks = related.concat(rest).slice(0, 3);

    container.innerHTML = picks.map(gameCardHTML).join('');
  } catch (error) {
    console.error("Failed to fetch games list:", error);
  }
}

// Header search: filters games.json live as the person types (title or
// tags), shows up to 6 matches in a dropdown. Works the same on every page
// since the header is shared.
// Footer "Notify me" button: the site has no backend to store emails, so
// this opens the visitor's own email app with a message pre-addressed to
// the site owner, asking to be added to updates. Replace [your-email]
// below with the real inbox that should receive these.
function initSubscribe() {
  const btn = document.getElementById("subscribe-btn");
  const input = document.getElementById("subscribe-email");
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    const email = input.value.trim();
    if (!email || !email.includes("@")) {
      input.focus();
      return;
    }
    const subject = encodeURIComponent("Notify me about new games");
    const body = encodeURIComponent(`Please add this email to the updates list: ${email}`);
    window.location.href = `mailto:[your-email]@minigames.website?subject=${subject}&body=${body}`;
  });
}

function initSearch() {
  const input = document.getElementById("site-search");
  const resultsBox = document.getElementById("search-results");
  if (!input || !resultsBox) return;

  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim().toLowerCase();

    if (!query) {
      resultsBox.classList.remove("is-open");
      resultsBox.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const games = await fetchGames();
        const matches = games
          .filter(g =>
            g.title.toLowerCase().includes(query) ||
            (g.tags || []).some(tag => tag.toLowerCase().includes(query))
          )
          .slice(0, 6);

        resultsBox.innerHTML = matches.length
          ? matches.map(g => `
              <a href="${resolvePath(`/${g.slug}/`)}" class="search-result-item">
                <img class="search-result-thumb" src="${resolvePath(g.thumbnail || '/assets/placeholder.jpg')}" alt="" loading="lazy">
                <span>${g.title}</span>
              </a>
            `).join('')
          : `<div class="search-empty">No games found</div>`;

        resultsBox.classList.add("is-open");
      } catch (error) {
        console.error("Search failed:", error);
      }
    }, 150);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) {
      resultsBox.classList.remove("is-open");
    }
  });
}

/**
 * Shared Helper: Canvas-based Share Card Generator (Supports 9:16 and 1:1)
 * @param {Object} options
 * @param {string} options.gameTitle - Name of the game.
 * @param {string} options.scoreText - Main score / achievement text.
 * @param {string} [options.subtext] - Funny punchline or extra info.
 * @param {'9:16'|'1:1'} [options.aspectRatio='1:1'] - Image aspect ratio.
 */
function generateResultCard({ gameTitle, scoreText, subtext = "Played on minigames.website", aspectRatio = "1:1" }) {
  const canvas = document.createElement("canvas");

  if (aspectRatio === "9:16") {
    canvas.width = 1080;
    canvas.height = 1920;
  } else {
    canvas.width = 1080;
    canvas.height = 1080;
  }

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#17202a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#7657e8";
  ctx.lineWidth = 24;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  const centerY = canvas.height / 2;

  ctx.fillStyle = "#9ca3af";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(gameTitle.toUpperCase(), canvas.width / 2, centerY - 160);

  ctx.fillStyle = "#fffefa";
  ctx.font = "900 84px sans-serif";
  ctx.fillText(scoreText, canvas.width / 2, centerY);

  ctx.fillStyle = "#62d7d2";
  ctx.font = "36px sans-serif";
  ctx.fillText(subtext, canvas.width / 2, centerY + 140);

  ctx.fillStyle = "#9691a3";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("minigames.website", canvas.width / 2, canvas.height - 100);

  const link = document.createElement("a");
  const filename = `${gameTitle.toLowerCase().replace(/\s+/g, '-')}-${aspectRatio.replace(':', 'x')}-score.png`;
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
