import { api, initHeader, formatCredits, escapeHtml } from "./auth.js";
import { BET_LABELS } from "./bet-utils.js";

let allBets = [];
let activeFilter = "all";

function formatProfit(n) {
  const prefix = n > 0 ? "+" : "";
  return `${prefix}${formatCredits(n)}`;
}

function renderBetCard(b) {
  const profit =
    b.status === "won"
      ? `+${formatCredits(b.payout - b.stake)}`
      : b.status === "lost"
        ? `-${formatCredits(b.stake)}`
        : "";
  return `
    <article class="bet-history-card">
      <div class="bet-history-top">
        <h3>${escapeHtml(b.matchLabel)}</h3>
        ${b.round ? `<span class="bet-round-tag">R${b.round}</span>` : ""}
      </div>
      <p class="bet-history-type">${escapeHtml(BET_LABELS[b.type] || b.type)}</p>
      <p class="bet-history-pick">${escapeHtml(b.selectionLabel || "")}</p>
      <p class="bet-history-stake">Stake ${formatCredits(b.stake)} @ ${b.odds}${b.status === "won" ? ` → ${formatCredits(b.payout)}` : ""}</p>
      <p class="bet-status status-${b.status}">${escapeHtml(b.status)}${profit ? ` · ${profit}` : ""}</p>
      <p class="bet-history-date">${escapeHtml(new Date(b.placedAt).toLocaleString("en-AU"))}</p>
    </article>`;
}

function renderBets() {
  const list = document.getElementById("bets-history");
  const filtered =
    activeFilter === "all" ? allBets : allBets.filter((b) => b.status === activeFilter);
  if (!filtered.length) {
    list.innerHTML = `<p class="empty-cell">No ${activeFilter === "all" ? "" : activeFilter + " "}bets to show.</p>`;
    return;
  }
  list.innerHTML = filtered.map(renderBetCard).join("");
}

function applyStats(data) {
  const { user, stats } = data;
  document.getElementById("profile-username").textContent = `@${user.username}`;
  document.getElementById("profile-school").textContent = user.school;
  const meta = [];
  if (stats.memberSince) {
    meta.push(`Member since ${new Date(stats.memberSince).toLocaleDateString("en-AU")}`);
  }
  if (stats.rank) meta.push(`Leaderboard rank #${stats.rank}`);
  document.getElementById("profile-meta").textContent = meta.join(" · ");

  const rankEl = document.getElementById("profile-rank");
  if (stats.rank) {
    rankEl.hidden = false;
    rankEl.textContent = `#${stats.rank}`;
  }

  document.getElementById("stat-credits").textContent = formatCredits(user.credits);
  document.getElementById("stat-total-bets").textContent = String(stats.totalBets);
  document.getElementById("stat-win-rate").textContent =
    stats.winRate != null ? `${stats.winRate}%` : "—";
  const profitEl = document.getElementById("stat-profit");
  profitEl.textContent = formatProfit(stats.profit);
  profitEl.classList.toggle("stat-positive", stats.profit > 0);
  profitEl.classList.toggle("stat-negative", stats.profit < 0);
  document.getElementById("stat-record").textContent = `${stats.won} / ${stats.lost} / ${stats.pending}`;
  document.getElementById("stat-staked").textContent = formatCredits(stats.totalStaked);
}

async function init() {
  const user = await initHeader();
  const guest = document.getElementById("profile-guest");
  const content = document.getElementById("profile-content");

  if (!user) {
    guest.hidden = false;
    return;
  }

  try {
    const data = await api("/api/me/stats");
    guest.hidden = true;
    content.hidden = false;
    applyStats(data);
    allBets = data.bets;
    renderBets();

    document.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("filter-active"));
        btn.classList.add("filter-active");
        activeFilter = btn.dataset.filter;
        renderBets();
      });
    });
  } catch (err) {
    guest.hidden = false;
    guest.querySelector(".page-lead").textContent = err.message;
  }
}

init();
