import { api, initHeader, formatCredits, escapeHtml, fetchCurrentUser } from "./auth.js";
import { BET_LABELS, marginBracketLabel, usesCompactMargins } from "./bet-utils.js";

let currentUser = null;
let roundData = null;
let sportsCatalog = null;
let currentSport = "afl";
let currentRound = 7;
let openMatchId = null;

const fixturesList = document.getElementById("fixtures-list");
const modal = document.getElementById("match-modal");
const modalContent = document.getElementById("modal-content");
const sportPicker = document.getElementById("sport-picker");
const roundPicker = document.getElementById("round-picker");
const pageTitle = document.getElementById("page-title");
const pageLead = document.getElementById("page-lead");

function schoolImg(logo, name) {
  if (!logo) return "";
  return `<img src="/logos/${encodeURIComponent(logo)}" alt="" class="match-team-logo" />`;
}

function teamScores(result, side) {
  if (!result) return `<span class="score-line"><span class="score-pts">—</span></span>`;
  const pts = side === "home" ? result.homeScore : result.awayScore;
  const gb = side === "home" ? result.homeScoreDisplay : result.awayScoreDisplay;
  const extra = gb && gb !== String(pts) ? `<span class="score-gb">${escapeHtml(gb)}</span>` : "";
  return `<span class="score-line"><span class="score-pts">${pts}</span>${extra}</span>`;
}

function statusBadge(status) {
  if (status === "in_progress") return `<span class="badge badge-live">In Progress</span>`;
  if (status === "final") return `<span class="badge badge-final">Final</span>`;
  if (status === "upcoming") return `<span class="badge badge-upcoming">Upcoming</span>`;
  return `<span class="badge badge-upcoming">${escapeHtml(status)}</span>`;
}

function updateUrl() {
  const params = new URLSearchParams();
  params.set("sport", currentSport);
  params.set("round", String(currentRound));
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

function updatePageHeader() {
  const sport = sportsCatalog?.sports?.find((s) => s.id === currentSport);
  const name = sport?.name || "Sport";
  pageTitle.textContent = `Round ${currentRound} — ${name}`;
  if (roundData?.bettingOpen) {
    pageLead.textContent = "Tap a match to place bets on this round.";
  } else if (sport?.bettingRound) {
    pageLead.textContent = `Past round results — betting is open on ${name} Round ${sport.bettingRound}.`;
  } else {
    pageLead.textContent = "Browse past round results and match details.";
  }
}

function renderSportPicker() {
  if (!sportsCatalog) return;
  sportPicker.innerHTML = sportsCatalog.sports
    .map((s) => {
      const active = s.id === currentSport ? "picker-active" : "";
      const disabled = s.available ? "" : "disabled";
      return `<button type="button" class="picker-btn ${active}" data-sport="${s.id}" ${disabled}>${escapeHtml(s.name)}${s.available ? "" : " (soon)"}</button>`;
    })
    .join("");

  sportPicker.querySelectorAll("[data-sport]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sport = sportsCatalog.sports.find((s) => s.id === btn.dataset.sport);
      if (!sport?.available) return;
      currentSport = btn.dataset.sport;
      currentRound = sport.bettingRound || sport.currentRound;
      updateUrl();
      renderSportPicker();
      renderRoundPicker();
      loadRound();
    });
  });
}

function renderRoundPicker() {
  const sport = sportsCatalog?.sports?.find((s) => s.id === currentSport);
  if (!sport?.rounds?.length) {
    roundPicker.innerHTML = "";
    return;
  }
  roundPicker.innerHTML = sport.rounds
    .map((r) => {
      const active = r === currentRound ? "picker-active" : "";
      const isCurrent = r === sport.bettingRound ? "picker-current" : "";
      return `<button type="button" class="picker-btn ${active} ${isCurrent}" data-round="${r}">R${r}</button>`;
    })
    .join("");

  roundPicker.querySelectorAll("[data-round]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentRound = Number(btn.dataset.round);
      updateUrl();
      renderRoundPicker();
      loadRound();
    });
  });
}

function renderFixtures(data) {
  const byDay = new Map();
  for (const m of data.matches) {
    if (!byDay.has(m.dayLabel)) byDay.set(m.dayLabel, []);
    byDay.get(m.dayLabel).push(m);
  }

  let html = "";
  for (const [day, matches] of byDay) {
    html += `<section class="fixture-day"><h2 class="fixture-day-title">${escapeHtml(day)}</h2><div class="fixture-cards">`;
    for (const m of matches) {
      const summary = m.result?.summary
        ? `<p class="fixture-summary">${escapeHtml(m.result.summary)}</p>`
        : "";
      html += `
        <button type="button" class="fixture-card" data-match-id="${escapeHtml(m.id)}">
          <div class="fixture-teams fixture-teams-scored">
            <div class="fixture-team">
              ${schoolImg(m.home.logo, m.home.name)}
              <span class="team-name">${escapeHtml(m.home.name)}</span>
              ${teamScores(m.result, "home")}
            </div>
            <div class="fixture-team">
              ${schoolImg(m.away.logo, m.away.name)}
              <span class="team-name">${escapeHtml(m.away.name)}</span>
              ${teamScores(m.result, "away")}
            </div>
          </div>
          <div class="fixture-meta">
            ${statusBadge(m.status)}
            <span class="fixture-time">${escapeHtml(m.displayTime)}</span>
          </div>
          ${summary}
          <p class="fixture-venue">${escapeHtml(m.venue)}</p>
        </button>`;
    }
    html += `</div></section>`;
  }

  for (const bye of data.byes || []) {
    const name = bye.school?.name || bye.schoolId;
    const logo = bye.school?.logo;
    html += `
      <section class="fixture-day">
        <h2 class="fixture-day-title">${escapeHtml(bye.dayLabel)}</h2>
        <div class="fixture-card fixture-card-bye">
          <div class="fixture-team">${schoolImg(logo, name)}<span>${escapeHtml(name)}</span></div>
          <span class="badge badge-bye">Bye</span>
        </div>
      </section>`;
  }

  fixturesList.innerHTML = html;
  fixturesList.querySelectorAll("[data-match-id]").forEach((btn) => {
    btn.addEventListener("click", () => openMatch(btn.dataset.matchId));
  });
}

function oddsFor(match, type, teamId, bracket) {
  const o = match.odds;
  if (!o) return "—";
  if (type === "margin") return o.margin?.[teamId]?.[bracket] ?? "—";
  if (type === "quarter_winner") return o.quarter_winner?.[teamId] ?? "—";
  return o[type]?.[teamId] ?? "—";
}

function marginBracketsForSport(sportId) {
  return usesCompactMargins(sportId)
    ? [
        ["1-2", "1-2"],
        ["3+", "3+"],
      ]
    : [
        ["1-39", "1-39"],
        ["40+", "40+"],
      ];
}

function betInputsDisabled(match, signedIn) {
  return !signedIn || !match.bettingOpen || match.status === "final";
}

function betMarketHtml(match, type, sportId, signedIn) {
  const home = match.home;
  const away = match.away;
  const line = match.line?.home ?? 0;
  const disabled = betInputsDisabled(match, signedIn) ? "disabled" : "";
  const stakeId = `stake-${type}`;
  const meta = match.odds?.meta;
  let oddsNote = "";
  if (meta && type === "winner") {
    if (sportId === "soccer" && meta.drawPct != null) {
      oddsNote = `<p class="odds-note">From season form: ${meta.homeWinPct}% home · ${meta.drawPct}% draw</p>`;
    } else {
      oddsNote = `<p class="odds-note">Odds from season form (${meta.homeWinPct}% home win chance)</p>`;
    }
  }

  let options = "";
  if (type === "winner") {
    const lineLabel = "";
    options = `
      <label class="bet-option"><input type="radio" name="winner" value="${home.id}" ${disabled} /> ${escapeHtml(home.name)} @ ${oddsFor(match, type, home.id)}</label>`;
    if (sportId === "soccer") {
      options += `
      <label class="bet-option"><input type="radio" name="winner" value="draw" ${disabled} /> Draw @ ${oddsFor(match, type, "draw")}</label>`;
    }
    options += `
      <label class="bet-option"><input type="radio" name="winner" value="${away.id}" ${disabled} /> ${escapeHtml(away.name)} @ ${oddsFor(match, type, away.id)}</label>`;
  } else if (type === "first_goal_team" || type === "line") {
    const lineLabel =
      type === "line"
        ? ` (${line > 0 ? "+" : ""}${line} / ${line > 0 ? "-" : "+"}${Math.abs(line)} away)`
        : "";
    options = `
      <label class="bet-option"><input type="radio" name="${type}" value="${home.id}" ${disabled} /> ${escapeHtml(home.name)} @ ${oddsFor(match, type, home.id)}${lineLabel}</label>
      <label class="bet-option"><input type="radio" name="${type}" value="${away.id}" ${disabled} /> ${escapeHtml(away.name)} @ ${oddsFor(match, type, away.id)}</label>`;
  } else if (type === "margin") {
    const brackets = marginBracketsForSport(sportId);
    for (const team of [home, away]) {
      options += `<p class="bet-group-label">${escapeHtml(team.name)} to win</p>`;
      for (const [key, labelKey] of brackets) {
        const label = marginBracketLabel(labelKey, sportId);
        options += `
        <label class="bet-option"><input type="radio" name="margin" value="${team.id}|${key}" ${disabled} /> ${label} @ ${oddsFor(match, "margin", team.id, key)}</label>`;
      }
    }
  } else if (type === "quarter_winner") {
    for (let q = 1; q <= 4; q++) {
      options += `
        <div class="quarter-block">
          <p class="bet-group-label">Quarter ${q}</p>
          <label class="bet-option"><input type="radio" name="q${q}" value="${home.id}" ${disabled} /> ${escapeHtml(home.name)} @ ${oddsFor(match, "quarter_winner", home.id)}</label>
          <label class="bet-option"><input type="radio" name="q${q}" value="${away.id}" ${disabled} /> ${escapeHtml(away.name)} @ ${oddsFor(match, "quarter_winner", away.id)}</label>
          <label class="field field-inline">
            <span class="field-label">Stake</span>
            <input type="number" id="stake-quarter-${q}" min="1" max="500" value="25" ${disabled} />
          </label>
          <button type="button" class="btn btn-primary btn-sm place-bet-btn" data-type="quarter_winner" data-quarter="${q}" data-match-id="${match.id}" ${disabled}>Place Q${q} bet</button>
          <p class="bet-msg" data-msg-for="quarter-${q}" hidden></p>
        </div>`;
    }
    return `
      <details class="bet-market">
        <summary>${BET_LABELS[type]}</summary>
        <div class="bet-market-body">${options}</div>
      </details>`;
  }

  return `
    <details class="bet-market" ${type === "winner" ? "open" : ""}>
      <summary>${BET_LABELS[type]}</summary>
      <div class="bet-market-body">
        ${oddsNote}
        ${options}
        <label class="field field-inline">
          <span class="field-label">Stake (credits)</span>
          <input type="number" id="${stakeId}" min="1" max="500" value="25" ${disabled} />
        </label>
        <button type="button" class="btn btn-primary btn-sm place-bet-btn" data-type="${type}" data-match-id="${match.id}" ${disabled}>
          Place bet
        </button>
        <p class="bet-msg" data-msg-for="${type}" hidden></p>
      </div>
    </details>`;
}

function resultDetailHtml(match) {
  const r = match.result;
  if (!r) return "";
  const home = match.home;
  const away = match.away;
  let quarters = "";
  if (r.quarters?.length) {
    quarters = `<ul class="quarter-results">${r.quarters
      .map((q) => {
        const name = q.winnerId === home.id ? home.name : away.name;
        return `<li>Q${q.quarter}: ${escapeHtml(name)}</li>`;
      })
      .join("")}</ul>`;
  }
  return `
    <section class="result-detail">
      <p class="result-summary">${escapeHtml(r.summary)}</p>
      <div class="result-scoreboard">
        <div>${escapeHtml(home.name)} <strong>${r.homeScore}</strong> <span class="score-gb">(${escapeHtml(r.homeScoreDisplay || "")})</span></div>
        <div>${escapeHtml(away.name)} <strong>${r.awayScore}</strong> <span class="score-gb">(${escapeHtml(r.awayScoreDisplay || "")})</span></div>
      </div>
      ${quarters}
    </section>`;
}

function adminLinkHtml(sportId) {
  if (!currentUser?.isAdmin) return "";
  return `<p class="admin-link-prompt"><a href="/admin.html?sport=${encodeURIComponent(sportId)}">Open admin dashboard</a> to enter results and settle bets.</p>`;
}

function renderModal(data) {
  const match = data.match;
  const home = match.home;
  const away = match.away;
  const sportId = data.sport || currentSport;
  openMatchId = match.id;
  const canBet = Boolean(data.bettingOpen && match.bettingOpen);
  const signedIn = Boolean(currentUser);

  const types = data.betTypes || roundData?.betTypes || ["winner", "margin", "line"];

  const myBetsHtml =
    data.myBets?.length > 0
      ? `<section class="my-bets-on-match"><h3>Your bets on this match</h3><ul>${data.myBets
          .map(
            (b) =>
              `<li><strong>${BET_LABELS[b.type]}</strong> — ${formatCredits(b.stake)} @ ${b.odds} — <em>${b.status}</em>${b.status === "won" ? ` (+${formatCredits(b.payout)})` : ""}</li>`
          )
          .join("")}</ul></section>`
      : "";

  const sportMeta = sportsCatalog?.sports?.find((s) => s.id === sportId);
  const sportLabel = sportMeta?.name || sportId;

  const marketsHtml = canBet
    ? `<div class="bet-markets ${signedIn ? "" : "bet-markets--locked"}" aria-disabled="${signedIn ? "false" : "true"}">
        ${!signedIn ? `<p class="bet-lock-banner">Sign in to place bets. <a href="/signin.html">Sign in</a> · <a href="/register.html">Register</a></p>` : ""}
        ${types.map((t) => betMarketHtml(match, t, sportId, signedIn)).join("")}
      </div>`
    : `<p class="betting-closed">Betting is closed for this match.</p>`;

  const compLine = match.competition
    ? `<p class="fixture-comp">${escapeHtml(match.competition)}</p>`
    : "";

  modalContent.innerHTML = `
    <header class="modal-match-header">
      <p class="modal-round-label">Round ${data.round || currentRound} · ${escapeHtml(sportLabel)}</p>
      <h2 id="modal-title">${escapeHtml(home.name)} vs ${escapeHtml(away.name)}</h2>
      ${statusBadge(match.status)}
      <p class="fixture-time">${escapeHtml(match.displayTime)}</p>
      ${compLine}
      <p class="fixture-venue">${escapeHtml(match.venue)}</p>
    </header>
    ${resultDetailHtml(match)}
    ${marketsHtml}
    ${myBetsHtml}
    ${adminLinkHtml(sportId)}
  `;

  if (currentUser) {
    modalContent.querySelectorAll(".place-bet-btn").forEach((btn) => {
      btn.addEventListener("click", () => placeBet(match, btn.dataset.type, btn.dataset.quarter));
    });
  }
}

async function openMatch(id) {
  try {
    const data = await api(`/api/matches/${encodeURIComponent(id)}`);
    renderModal(data);
    modal.hidden = false;
    document.body.classList.add("modal-open");
  } catch (err) {
    alert(err.message);
  }
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  openMatchId = null;
}

async function placeBet(match, type, quarterNum) {
  const msgKey = type === "quarter_winner" ? `quarter-${quarterNum}` : type;
  const msg = modalContent.querySelector(`[data-msg-for="${msgKey}"]`);
  if (msg) msg.hidden = true;

  let selection = null;
  if (type === "winner" || type === "first_goal_team" || type === "line") {
    const el = modalContent.querySelector(`input[name="${type}"]:checked`);
    if (!el) {
      msg.textContent = "Select an option.";
      msg.hidden = false;
      return;
    }
    selection = { teamId: el.value };
  } else if (type === "margin") {
    const el = modalContent.querySelector('input[name="margin"]:checked');
    if (!el) {
      msg.textContent = "Select margin bracket.";
      msg.hidden = false;
      return;
    }
    const [teamId, bracket] = el.value.split("|");
    selection = { teamId, bracket };
  } else if (type === "quarter_winner") {
    const q = Number(quarterNum);
    const el = modalContent.querySelector(`input[name="q${q}"]:checked`);
    if (!el) {
      msg.textContent = `Select quarter ${q} winner.`;
      msg.hidden = false;
      return;
    }
    selection = { quarter: q, teamId: el.value };
  }

  const stakeEl =
    type === "quarter_winner"
      ? modalContent.querySelector(`#stake-quarter-${quarterNum}`)
      : modalContent.querySelector(`#stake-${type}`);
  const stake = Number(stakeEl?.value);
  try {
    const { user } = await api("/api/bets", {
      method: "POST",
      body: JSON.stringify({ matchId: match.id, type, selection, stake }),
    });
    currentUser = user;
    document.getElementById("credits-display").textContent = formatCredits(user.credits);
    msg.textContent = "Bet placed!";
    msg.className = "bet-msg bet-msg-ok";
    msg.hidden = false;
    const refreshed = await api(`/api/matches/${encodeURIComponent(match.id)}`);
    renderModal(refreshed);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "bet-msg bet-msg-err";
    msg.hidden = false;
  }
}

async function loadRound() {
  roundData = await api(`/api/sports/${currentSport}/rounds/${currentRound}`);
  updatePageHeader();
  renderFixtures(roundData);
}

async function loadMyBets() {
  const guest = document.getElementById("my-bets-guest");
  const list = document.getElementById("my-bets-list");
  if (!currentUser) {
    guest.hidden = false;
    list.innerHTML = "";
    return;
  }
  guest.hidden = true;
  try {
    const { bets } = await api("/api/bets/mine");
    if (!bets.length) {
      list.innerHTML = `<p class="empty-cell">No bets yet. Head to fixtures and pick a match.</p>`;
      return;
    }
    list.innerHTML = bets
      .map(
        (b) => `
      <article class="my-bet-card">
        <h3>${escapeHtml(b.matchLabel)}</h3>
        <p>${BET_LABELS[b.type] || b.type} · Stake ${formatCredits(b.stake)} @ ${b.odds}</p>
        <p class="bet-status status-${b.status}">${escapeHtml(b.status)}${b.status === "won" ? ` · Won ${formatCredits(b.payout)}` : ""}</p>
      </article>`
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<p class="empty-cell">${escapeHtml(err.message)}</p>`;
  }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-fixtures").hidden = tab !== "fixtures";
    document.getElementById("tab-my-bets").hidden = tab !== "my-bets";
    if (tab === "my-bets") loadMyBets();
  });
});

modal.querySelectorAll("[data-close]").forEach((el) => {
  el.addEventListener("click", closeModal);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

async function init() {
  currentUser = await initHeader();
  const params = new URLSearchParams(location.search);
  sportsCatalog = await api("/api/sports");
  const paramSport = params.get("sport");
  const available = sportsCatalog.sports.filter((s) => s.available);
  const defaultSport = available.find((s) => s.id === "afl") || available[0];
  currentSport =
    paramSport && available.some((s) => s.id === paramSport) ? paramSport : defaultSport?.id || "afl";
  const sportMeta = available.find((s) => s.id === currentSport) || defaultSport;
  currentRound = Number(params.get("round")) || sportMeta?.bettingRound || sportMeta?.currentRound || 1;
  renderSportPicker();
  renderRoundPicker();
  await loadRound();
  const matchId = params.get("match");
  if (matchId) openMatch(matchId);
}

init();
