document.addEventListener("DOMContentLoaded", () => {
  renderLayoutComponents();
  
  if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
    initHomepageGrid();
  }
});

function renderLayoutComponents() {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  if (headerEl) {
    headerEl.innerHTML = `
      <div class="container">
        <a href="/" class="brand-link">MiniGames.website</a>
      </div>
    `;
  }

  if (footerEl) {
    footerEl.innerHTML = `
      <div class="container">
        <span>&copy; ${new Date().getFullYear()} MiniGames.website</span>
        <a href="/" class="footer-link">More Games</a>
      </div>
    `;
  }
}

async function initHomepageGrid() {
  const gridContainer = document.getElementById("game-grid");
  if (!gridContainer) return;

  try {
    const response = await fetch("/games.json");
    if (!response.ok) throw new Error("Network response was not ok");
    const games = await response.json();

    if (!Array.isArray(games) || games.length === 0) {
      gridContainer.innerHTML = `<div class="empty-state">More games coming soon</div>`;
      return;
    }

    gridContainer.innerHTML = games.map(game => `
      <a href="/${game.slug}/" class="game-card">
        <img class="card-thumb" src="${game.thumbnail || '/assets/placeholder.jpg'}" alt="${game.title} screenshot" loading="lazy">
        <div class="card-body">
          <div class="card-tags">
            ${game.isNew ? `<span class="tag-badge new-badge">NEW</span>` : ''}
            ${(game.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
          </div>
          <h2 class="card-title">${game.title}</h2>
          <p class="card-tagline">${game.tagline}</p>
        </div>
      </a>
    `).join('');
  } catch (error) {
    console.error("Failed to fetch games list:", error);
    gridContainer.innerHTML = `<div class="empty-state">More games coming soon</div>`;
  }
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
  
  // Set dimensions based on ratio requirement
  if (aspectRatio === "9:16") {
    canvas.width = 1080;
    canvas.height = 1920;
  } else {
    canvas.width = 1080;
    canvas.height = 1080;
  }

  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative Border
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 24;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Text Config
  ctx.textAlign = "center";

  const centerY = canvas.height / 2;

  // Title
  ctx.fillStyle = "#9ca3af";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(gameTitle.toUpperCase(), canvas.width / 2, centerY - 160);

  // Score
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 84px sans-serif";
  ctx.fillText(scoreText, canvas.width / 2, centerY);

  // Punchline / Subtext
  ctx.fillStyle = "#60a5fa";
  ctx.font = "36px sans-serif";
  ctx.fillText(subtext, canvas.width / 2, centerY + 140);

  // Branding Domain Footer
  ctx.fillStyle = "#6c757d";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("minigames.website", canvas.width / 2, canvas.height - 100);

  // Trigger File Download
  const link = document.createElement("a");
  const filename = `${gameTitle.toLowerCase().replace(/\s+/g, '-')}-${aspectRatio.replace(':', 'x')}-score.png`;
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}