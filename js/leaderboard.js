import { api, formatCredits, escapeHtml, initHeader } from "./auth.js";

const playersBody = document.getElementById("players-body");
const schoolsBody = document.getElementById("schools-body");

function schoolLogoCell(logo, school) {
  const img = logo
    ? `<img src="/logos/${escapeHtml(logo)}" alt="" class="table-logo" width="28" height="28" />`
    : "";
  return `<span class="school-cell">${img}<span>${escapeHtml(school)}</span></span>`;
}

function renderPlayers(players) {
  if (!players.length) {
    playersBody.innerHTML = `<tr><td colspan="4" class="empty-cell">No players yet. <a href="/register.html">Create the first account</a>.</td></tr>`;
    return;
  }
  playersBody.innerHTML = players
    .map(
      (p) => `
    <tr>
      <td class="col-rank" data-label="#">${p.rank}</td>
      <td class="col-player" data-label="Player">${escapeHtml(p.username)}</td>
      <td class="col-school" data-label="School">${schoolLogoCell(p.logo, p.school)}</td>
      <td class="col-credits" data-label="Credits">${formatCredits(p.credits)}</td>
    </tr>`
    )
    .join("");
}

function renderSchools(schools) {
  if (!schools.length) {
    schoolsBody.innerHTML = `<tr><td colspan="4" class="empty-cell">No school data yet.</td></tr>`;
    return;
  }
  schoolsBody.innerHTML = schools
    .map(
      (s, i) => `
    <tr>
      <td class="col-rank" data-label="#">${i + 1}</td>
      <td class="col-school" data-label="School">${schoolLogoCell(s.logo, s.school)}</td>
      <td data-label="Players">${s.playerCount}</td>
      <td class="col-credits" data-label="Total credits">${formatCredits(s.totalCredits)}</td>
    </tr>`
    )
    .join("");
}

async function loadLeaderboard() {
  const { players, schools } = await api("/api/leaderboard");
  renderPlayers(players);
  renderSchools(schools);
}

async function init() {
  await initHeader();

  try {
    await loadLeaderboard();
  } catch {
    playersBody.innerHTML = `<tr><td colspan="4" class="empty-cell">Could not load leaderboard.</td></tr>`;
    schoolsBody.innerHTML = `<tr><td colspan="4" class="empty-cell">Could not load school standings.</td></tr>`;
  }
}

init();
