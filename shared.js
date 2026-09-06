document.addEventListener("DOMContentLoaded", () => {
  renderLayoutComponents();
  initSearch();

  const path = window.location.pathname;
  if (path === "/" || path === "/index.html") {
    initHomepageGrid();
  } else if (path === "/all-games/" || path === "/all-games/index.html") {
    initAllGamesGrid();
  } else {
    initMoreGamesStrip();
  }
});

function renderLayoutComponents() {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  if (headerEl) {
    headerEl.innerHTML = `
      <div class="container">
        <a href="/" class="brand-link">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"/>
            </svg>
          </span>
          MiniGames.website
        </a>
        <div class="nav-group">
          <div class="search-wrap">
            <input type="search" id="site-search" class="search-input" placeholder="Search games…" autocomplete="off" aria-label="Search games">
            <div id="search-results" class="search-results"></div>
          </div>
          <a href="/all-games/" class="nav-link">All Games</a>
        </div>
      </div>
    `;
  }

  if (footerEl) {
    footerEl.innerHTML = `
      <div class="container">
        <span>&copy; ${new Date().getFullYear()} MiniGames.website</span>
        <a href="/all-games/" class="footer-link">All Games</a>
      </div>
    `;
  }
}

let gamesCache = null;

async function fetchGames() {
  if (gamesCache) return gamesCache;
  const response = await fetch("/games.json");
  if (!response.ok) throw new Error("Network response was not ok");
  const games = await response.json();
  gamesCache = Array.isArray(games) ? games : [];
  return gamesCache;
}

function gameCardHTML(game) {
  return `
    <a href="/${game.slug}/" class="game-card">
      <img class="card-thumb" src="${game.thumbnail || '/assets/placeholder.jpg'}" alt="${game.title} screenshot" loading="lazy">
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

  const currentSlug = window.location.pathname.split("/").filter(Boolean)[0] || "";

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
              <a href="/${g.slug}/" class="search-result-item">
                <img class="search-result-thumb" src="${g.thumbnail || '/assets/placeholder.jpg'}" alt="" loading="lazy">
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

  ctx.fillStyle = "#16141F";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#6C4FF6";
  ctx.lineWidth = 24;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  const centerY = canvas.height / 2;

  ctx.fillStyle = "#9ca3af";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(gameTitle.toUpperCase(), canvas.width / 2, centerY - 160);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 84px sans-serif";
  ctx.fillText(scoreText, canvas.width / 2, centerY);

  ctx.fillStyle = "#2FD1BE";
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
