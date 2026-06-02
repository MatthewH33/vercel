import { initHeader, fetchCurrentUser, loadSchools, escapeHtml } from "./auth.js";

async function renderLogoStrip() {
  const strip = document.querySelector(".logo-strip");
  if (!strip) return;

  const schools = await loadSchools();
  strip.innerHTML = schools
    .map(
      (s) =>
        `<img src="/logos/${encodeURIComponent(s.logo)}" alt="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}" class="school-logo" />`
    )
    .join("");
}

async function initHome() {
  await renderLogoStrip();
  const user = await initHeader();
  const heroActions = document.querySelector(".hero-actions");
  const logoutBtn = document.getElementById("logout-btn");

  if (user && heroActions) {
    heroActions.innerHTML = `
      <a href="/leaderboard.html" class="btn btn-ghost">View leaderboard</a>
      <a href="#" id="home-logout" class="btn btn-ghost" role="button">Sign out</a>
    `;
    document.getElementById("home-logout")?.addEventListener("click", async (e) => {
      e.preventDefault();
      const { api } = await import("./auth.js");
      await api("/api/logout", { method: "POST" }).catch(() => {});
      window.location.reload();
    });
    if (logoutBtn) logoutBtn.hidden = false;
  } else if (logoutBtn) {
    logoutBtn.hidden = true;
  }
}

initHome();
