import { api, initHeader, escapeHtml, formatCredits } from "./auth.js";
import { BET_LABELS } from "./bet-utils.js";

let currentSport = "afl";
let currentTab = "overview";
let sportsCatalog = null;

function schoolImg(logo) {
  if (!logo) return "";
  return `<img src="/logos/${encodeURIComponent(logo)}" alt="" class="match-team-logo" />`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function setTab(tab) {
  currentTab = tab;
  const params = new URLSearchParams(location.search);
  if (tab === "overview") params.delete("tab");
  else params.set("tab", tab);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);

  document.querySelectorAll(".admin-tab").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("admin-tab-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.getElementById("admin-panel-overview").hidden = tab !== "overview";
  document.getElementById("admin-panel-results").hidden = tab !== "results";
}

function bindTabs() {
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTab(btn.dataset.tab);
      if (btn.dataset.tab === "results") loadOverview();
    });
  });
}

function goToResults(sportId) {
  currentSport = sportId;
  const params = new URLSearchParams(location.search);
  params.set("tab", "results");
  params.set("sport", sportId);
  history.replaceState(null, "", `${location.pathname}?${params}`);
  renderSportPicker();
  setTab("results");
  loadOverview();
}

function renderAlerts(totals, sports) {
  const el = document.getElementById("admin-alerts");
  if (!el) return;
  const items = [];
  if (totals.pendingOnBettingRounds > 0) {
    items.push(
      `<div class="admin-alert admin-alert-warn">
        <strong>${totals.pendingOnBettingRounds}</strong> pending bet${totals.pendingOnBettingRounds === 1 ? "" : "s"} on current betting rounds need results to settle.
      </div>`
    );
  }
  if (totals.needsResults > 0) {
    items.push(
      `<div class="admin-alert">
        <strong>${totals.needsResults}</strong> match${totals.needsResults === 1 ? "" : "es"} still need a final score this round.
      </div>`
    );
  }
  for (const s of sports.filter((x) => x.actionNeeded)) {
    if (s.needsResult === 0 && s.pendingBets === 0) continue;
    items.push(
      `<div class="admin-alert admin-alert-sport">
        <span><strong>${escapeHtml(s.name)}</strong> — Round ${s.bettingRound}: ${s.needsResult} awaiting result, ${s.pendingBets} pending bet${s.pendingBets === 1 ? "" : "s"}.</span>
        <button type="button" class="btn btn-ghost btn-sm admin-alert-btn" data-sport="${escapeHtml(s.id)}">Enter results</button>
      </div>`
    );
  }
  if (!items.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = items.join("");
  el.querySelectorAll(".admin-alert-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToResults(btn.dataset.sport));
  });
}

function renderSportCards(sports) {
  const el = document.getElementById("admin-sport-cards");
  if (!el) return;
  if (!sports.length) {
    el.innerHTML = `<p class="empty-cell">No sports configured.</p>`;
    return;
  }
  el.innerHTML = sports
    .map((s) => {
      const statusClass = s.actionNeeded ? "admin-sport-card--action" : "";
      const progress =
        s.totalMatches > 0
          ? Math.round((s.settled / s.totalMatches) * 100)
          : 0;
      return `
        <article class="admin-sport-card ${statusClass}">
          <header class="admin-sport-card-head">
            <h3 class="admin-sport-card-title">${escapeHtml(s.name)}</h3>
            <span class="admin-sport-round">Round ${s.bettingRound}</span>
          </header>
          <div class="admin-sport-stats">
            <div><span class="admin-sport-stat-val">${s.settled}/${s.totalMatches}</span><span class="admin-sport-stat-lbl">Settled</span></div>
            <div><span class="admin-sport-stat-val">${s.needsResult}</span><span class="admin-sport-stat-lbl">Need result</span></div>
            <div><span class="admin-sport-stat-val">${s.pendingBets}</span><span class="admin-sport-stat-lbl">Pending bets</span></div>
            <div><span class="admin-sport-stat-val">${s.openBetting}</span><span class="admin-sport-stat-lbl">Open markets</span></div>
          </div>
          <div class="admin-sport-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
            <div class="admin-sport-progress-bar" style="width: ${progress}%"></div>
          </div>
          <div class="admin-sport-card-actions">
            <button type="button" class="btn btn-primary btn-sm admin-sport-go" data-sport="${escapeHtml(s.id)}">Enter results</button>
            <a href="/markets.html?sport=${encodeURIComponent(s.id)}&round=${s.bettingRound}" class="btn btn-ghost btn-sm">Markets</a>
          </div>
        </article>`;
    })
    .join("");
  el.querySelectorAll(".admin-sport-go").forEach((btn) => {
    btn.addEventListener("click", () => goToResults(btn.dataset.sport));
  });
}

function renderRecentBets(bets) {
  const body = document.getElementById("admin-recent-body");
  if (!body) return;
  if (!bets.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">No bets placed yet.</td></tr>`;
    return;
  }
  body.innerHTML = bets
    .map((b) => {
      const typeLabel = BET_LABELS[b.type] || b.type;
      const sport = b.sportName
        ? `${escapeHtml(b.sportName)}${b.round != null ? ` R${b.round}` : ""}`
        : "—";
      const statusCls = `bet-status ${b.status === "won" ? "bet-won" : b.status === "lost" ? "bet-lost" : "bet-pending"}`;
      return `
        <tr>
          <td class="col-player" data-label="Player">@${escapeHtml(b.username)}</td>
          <td class="col-sport" data-label="Sport">${sport}</td>
          <td class="col-type" data-label="Type">${escapeHtml(typeLabel)}</td>
          <td class="col-stake" data-label="Stake">${formatCredits(b.stake)}</td>
          <td class="col-status" data-label="Status"><span class="${statusCls}">${escapeHtml(b.status)}</span></td>
          <td class="col-time" data-label="When">${formatWhen(b.placedAt)}</td>
        </tr>`;
    })
    .join("");
}

async function loadDashboard() {
  const data = await api("/api/admin/dashboard");
  const { totals, sports, recentBets } = data;

  document.getElementById("dash-users").textContent = String(totals.users);
  document.getElementById("dash-bets").textContent = String(totals.bets);
  document.getElementById("dash-pending").textContent = String(totals.pending);
  document.getElementById("dash-record").textContent = `${totals.won} / ${totals.lost}`;
  document.getElementById("dash-stake").textContent = formatCredits(totals.pendingStake);
  document.getElementById("dash-needs-result").textContent = String(totals.needsResults);

  renderAlerts(totals, sports);
  renderSportCards(sports);
  renderRecentBets(recentBets);
}

function adminFormHtml(match, sportId) {
  const home = match.home;
  const away = match.away;
  const simpleSports = ["soccer", "badminton"];
  const scoreLabel =
    sportId === "soccer" ? "Goals" : sportId === "badminton" ? "Rubbers won" : "Score";
  let extra = "";
  if (!simpleSports.includes(sportId)) {
    extra = `
      <label class="field">
        <span class="field-label">First goal</span>
        <select name="firstGoalSchoolId" required>
          <option value="">Select</option>
          <option value="${home.id}">${escapeHtml(home.name)}</option>
          <option value="${away.id}">${escapeHtml(away.name)}</option>
        </select>
      </label>
      ${[1, 2, 3, 4]
        .map(
          (n) => `
        <label class="field">
          <span class="field-label">Q${n} winner</span>
          <select name="q${n}Winner" required>
            <option value="">Select</option>
            <option value="${home.id}">${escapeHtml(home.name)}</option>
            <option value="${away.id}">${escapeHtml(away.name)}</option>
          </select>
        </label>`
        )
        .join("")}`;
  } else if (sportId === "soccer") {
    extra = `<p class="admin-hint">Draws are allowed — enter full-time goals.</p>`;
  } else {
    extra = `<p class="admin-hint">Enter rubbers won (e.g. 6–1). Ties are not allowed.</p>`;
  }

  return `
    <form class="admin-form admin-form-inline" data-match-id="${escapeHtml(match.id)}">
      <div class="admin-scores">
        <label>${escapeHtml(home.name)} ${scoreLabel} <input type="number" name="homeScore" min="0" required /></label>
        <label>${escapeHtml(away.name)} ${scoreLabel} <input type="number" name="awayScore" min="0" required /></label>
      </div>
      ${extra}
      <p class="form-error admin-form-msg" hidden></p>
      <button type="submit" class="btn btn-primary btn-sm">Save &amp; settle</button>
    </form>`;
}

function matchCardHtml(m, showForm, sportId) {
  const pending =
    m.pendingBets > 0
      ? `<span class="admin-badge">${m.pendingBets} pending bet${m.pendingBets === 1 ? "" : "s"}</span>`
      : "";
  let oddsHint = "";
  if (m.oddsMeta) {
    oddsHint =
      sportId === "soccer" && m.oddsMeta.drawPct != null
        ? `<span class="admin-odds-hint">Model: ${m.oddsMeta.homeWinPct}% home · ${m.oddsMeta.drawPct}% draw</span>`
        : `<span class="admin-odds-hint">Model: ${m.oddsMeta.homeWinPct}% home win (${m.oddsMeta.sampleGames} gp)</span>`;
  }
  return `
    <article class="admin-match-card" data-match-id="${escapeHtml(m.id)}">
      <header class="admin-match-head">
        <div class="admin-match-teams">
          ${schoolImg(m.home.logo)}
          <span>${escapeHtml(m.home.name)}</span>
          <span class="vs">vs</span>
          ${schoolImg(m.away.logo)}
          <span>${escapeHtml(m.away.name)}</span>
        </div>
        <div class="admin-match-meta">
          <span class="badge badge-upcoming">${escapeHtml(m.status)}</span>
          ${pending}
          <span class="fixture-time">${escapeHtml(m.displayTime)}</span>
        </div>
      </header>
      ${oddsHint}
      ${showForm ? adminFormHtml(m, sportId) : settledBlockHtml(m)}
      <a href="/markets.html?sport=${encodeURIComponent(sportId)}&round=${m.round}&match=${encodeURIComponent(m.id)}" class="admin-market-link">View on markets</a>
    </article>`;
}

function settledBlockHtml(m) {
  const summary = m.resultSummary
    ? `<p class="admin-result-line">${escapeHtml(m.resultSummary)}</p>`
    : "";
  const betsNote =
    m.settledBets > 0
      ? `<p class="admin-hint">${m.settledBets} bet${m.settledBets === 1 ? "" : "s"} will return to pending.</p>`
      : "";
  return `
    ${summary}
    <p class="admin-done">Result recorded.</p>
    ${betsNote}
    <button type="button" class="btn btn-ghost btn-sm admin-clear-result" data-match-id="${escapeHtml(m.id)}">Clear result</button>
    <p class="form-error admin-clear-msg" hidden></p>`;
}

async function submitResult(e) {
  e.preventDefault();
  const form = e.target;
  const matchId = form.dataset.matchId;
  const msg = form.querySelector(".admin-form-msg");
  msg.hidden = true;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  try {
    const { settled } = await api(`/api/admin/matches/${encodeURIComponent(matchId)}/result`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    msg.textContent = `Saved. ${settled} bet(s) settled.`;
    msg.className = "bet-msg bet-msg-ok admin-form-msg";
    msg.hidden = false;
    form.querySelector('button[type="submit"]').disabled = true;
    await loadOverview();
    await loadDashboard();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-error admin-form-msg";
    msg.hidden = false;
  }
}

function bindForms(container) {
  container.querySelectorAll(".admin-form").forEach((form) => {
    form.addEventListener("submit", submitResult);
  });
}

function bindClearButtons(container) {
  container.querySelectorAll(".admin-clear-result").forEach((btn) => {
    btn.addEventListener("click", () => clearResult(btn));
  });
}

async function clearResult(btn) {
  const matchId = btn.dataset.matchId;
  const card = btn.closest(".admin-match-card");
  const msg = card?.querySelector(".admin-clear-msg");
  if (msg) msg.hidden = true;

  const label = card?.querySelector(".admin-result-line")?.textContent?.trim();
  const confirmText = label
    ? `Clear the result "${label}"? Settled bets will be reopened as pending and winnings will be reversed.`
    : "Clear this result? Settled bets will be reopened as pending and winnings will be reversed.";
  if (!window.confirm(confirmText)) return;

  btn.disabled = true;
  try {
    const { reverted } = await api(
      `/api/admin/matches/${encodeURIComponent(matchId)}/clear-result`,
      { method: "POST" }
    );
    if (msg) {
      msg.textContent =
        reverted > 0
          ? `Result cleared. ${reverted} bet(s) are pending again.`
          : "Result cleared.";
      msg.className = "bet-msg bet-msg-ok admin-clear-msg";
      msg.hidden = false;
    }
    await loadOverview();
    await loadDashboard();
  } catch (err) {
    btn.disabled = false;
    if (msg) {
      msg.textContent = err.message;
      msg.className = "form-error admin-clear-msg";
      msg.hidden = false;
    }
  }
}

function renderSportPicker() {
  const el = document.getElementById("admin-sport-picker");
  if (!el || !sportsCatalog) return;
  const available = sportsCatalog.sports.filter((s) => s.available);
  el.innerHTML = available
    .map((s) => {
      const active = s.id === currentSport ? "picker-active" : "";
      return `<button type="button" class="picker-btn ${active}" data-sport="${s.id}">${escapeHtml(s.name)}</button>`;
    })
    .join("");
  el.querySelectorAll("[data-sport]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSport = btn.dataset.sport;
      const params = new URLSearchParams(location.search);
      params.set("sport", currentSport);
      if (currentTab === "results") params.set("tab", "results");
      history.replaceState(null, "", `${location.pathname}?${params}`);
      renderSportPicker();
      loadOverview();
    });
  });
}

async function loadOverview() {
  const data = await api(`/api/admin/overview?sport=${encodeURIComponent(currentSport)}`);
  const name = data.sportName || currentSport;
  document.getElementById("admin-lead").textContent = `${name} — Round ${data.bettingRound}: enter scores to settle bets.`;
  document.getElementById("admin-summary").textContent = `${data.totalPendingBets} pending bet(s) on this round.`;

  const needsEl = document.getElementById("admin-needs-result");
  if (!data.needsResult.length) {
    needsEl.innerHTML = `<p class="empty-cell">No matches waiting for results.</p>`;
  } else {
    needsEl.innerHTML = data.needsResult.map((m) => matchCardHtml(m, true, currentSport)).join("");
    bindForms(needsEl);
  }

  const settledEl = document.getElementById("admin-settled");
  if (!data.settled.length) {
    settledEl.innerHTML = `<p class="empty-cell">No settled matches this round yet.</p>`;
  } else {
    settledEl.innerHTML = data.settled.map((m) => matchCardHtml(m, false, currentSport)).join("");
    bindClearButtons(settledEl);
  }
}

async function init() {
  const user = await initHeader();
  const denied = document.getElementById("admin-denied");
  const content = document.getElementById("admin-content");

  if (!user) {
    denied.hidden = false;
    document.getElementById("admin-denied-msg").textContent =
      "Sign in with an admin account to manage results.";
    return;
  }

  if (!user.isAdmin) {
    denied.hidden = false;
    document.getElementById("admin-denied-msg").textContent =
      "Your account does not have admin access.";
    return;
  }

  try {
    content.hidden = false;
    document.getElementById("admin-welcome").textContent = `Signed in as @${user.username}.`;

    const params = new URLSearchParams(location.search);
    sportsCatalog = await api("/api/sports");
    const available = sportsCatalog.sports.filter((s) => s.available);
    const paramSport = params.get("sport");
    currentSport =
      paramSport && available.some((s) => s.id === paramSport)
        ? paramSport
        : available.find((s) => s.id === "afl")?.id || available[0]?.id || "afl";

    currentTab = params.get("tab") === "results" ? "results" : "overview";
    bindTabs();
    setTab(currentTab);
    renderSportPicker();

    await loadDashboard();
    if (currentTab === "results") await loadOverview();
  } catch (err) {
    denied.hidden = false;
    document.getElementById("admin-denied-msg").textContent = err.message;
  }
}

init();
