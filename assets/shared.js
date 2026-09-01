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
      <a href="/games/${game.slug}/" class="game-card">
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
 * Generates a PNG result card using HTML Canvas and triggers a download.
 * @param {Object} options - Share parameters.
 * @param {string} options.gameTitle - Name of the game.
 * @param {string} options.scoreText - Score or outcome to highlight.
 * @param {string} [options.subtext] - Optional detail (e.g. "Time: 42s").
 */
function generateResultCard({ gameTitle, scoreText, subtext = "Played on minigames.website" }) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 315;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border Highlight
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Text Config
  ctx.textAlign = "center";

  // Game Title
  ctx.fillStyle = "#9ca3af";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(gameTitle.toUpperCase(), canvas.width / 2, 70);

  // Score
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 48px sans-serif";
  ctx.fillText(scoreText, canvas.width / 2, 160);

  // Subtext / Domain
  ctx.fillStyle = "#60a5fa";
  ctx.font = "18px sans-serif";
  ctx.fillText(subtext, canvas.width / 2, 240);

  // Trigger Download
  const link = document.createElement("a");
  link.download = `${gameTitle.toLowerCase().replace(/\s+/g, '-')}-score.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}