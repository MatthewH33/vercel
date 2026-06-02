const { getOdds: getOddsFromHistory, DEFAULT_ODDS } = require("./odds");
const {
  getSportConfig,
  betTypesForSport,
  isAfl,
  isSimpleAdmin,
  usesCompactMargins,
} = require("./sports");

function getOdds(type, selection, match, schoolStats, sportId) {
  if (match && schoolStats) {
    return getOddsFromHistory(type, selection, match, schoolStats, sportId);
  }
  const cfg = getSportConfig(sportId);
  if (type === "margin") {
    const bracket = selection.bracket;
    return DEFAULT_ODDS.margin[bracket] || (cfg.marginBrackets[0] === "1-2" ? 2.1 : 2.2);
  }
  if (type === "quarter_winner") return DEFAULT_ODDS.quarter;
  return DEFAULT_ODDS[type] || 2;
}

function computeWinner(homeScore, awayScore, homeSchoolId, awaySchoolId) {
  if (homeScore > awayScore) return homeSchoolId;
  if (awayScore > homeScore) return awaySchoolId;
  return null;
}

function computeMargin(homeScore, awayScore) {
  return Math.abs(homeScore - awayScore);
}

function marginWins(bet, winnerId, margin, sportId) {
  if (!winnerId || bet.selection.teamId !== winnerId) return false;
  const bracket = bet.selection.bracket;
  if (usesCompactMargins(sportId)) {
    if (bracket === "1-2") return margin >= 1 && margin <= 2;
    if (bracket === "3+") return margin >= 3;
    return false;
  }
  if (bracket === "1-39") return margin >= 1 && margin <= 39;
  if (bracket === "40+") return margin >= 40;
  return false;
}

function settleBet(bet, match, sportId) {
  const r = match.result;
  if (!r || match.status !== "final") return { status: "pending" };

  const { homeScore, awayScore, winnerId, margin, firstGoalSchoolId, quarters } = r;
  const sel = bet.selection;
  let won = false;

  switch (bet.type) {
    case "winner":
      if (sel.teamId === "draw") {
        won = winnerId === null && homeScore === awayScore;
      } else {
        won = sel.teamId === winnerId;
      }
      break;
    case "margin":
      won = marginWins(bet, winnerId, margin, sportId);
      break;
    case "line": {
      const diff = homeScore - awayScore;
      const line = match.line?.home ?? 0;
      if (sel.teamId === match.homeSchoolId) {
        won = diff + line > 0;
      } else {
        won = -(diff + line) > 0;
      }
      break;
    }
    case "first_goal_team":
      won = sel.teamId === firstGoalSchoolId;
      break;
    case "quarter_winner": {
      const q = quarters?.[sel.quarter - 1];
      won = q && q.winnerId === sel.teamId;
      break;
    }
    default:
      won = false;
  }

  const payout = won ? Math.round(bet.stake * bet.odds) : 0;
  return { status: won ? "won" : "lost", payout };
}

function validateBetPayload(body, match, sportId) {
  const types = betTypesForSport(sportId);
  const { type, selection, stake } = body;
  if (!types.includes(type)) return "Invalid bet type.";
  if (!Number.isFinite(stake) || stake < 1 || stake > 500) {
    return "Stake must be between 1 and 500 credits.";
  }
  if (!match.bettingOpen) return "Betting is closed for this match.";
  if (match.status === "final") return "This match is finished.";
  if (!selection || typeof selection !== "object") return "Invalid selection.";

  const schoolIds = [match.homeSchoolId, match.awaySchoolId];
  const cfg = getSportConfig(sportId);

  if (type === "winner") {
    if (selection.teamId === "draw") {
      if (!cfg.allowsDraw) return "Draw not available for this sport.";
      return null;
    }
    if (!schoolIds.includes(selection.teamId)) return "Pick a team in this match.";
    return null;
  }

  if (type === "first_goal_team" || type === "line") {
    if (!schoolIds.includes(selection.teamId)) return "Pick a team in this match.";
    return null;
  }

  if (type === "margin") {
    if (!schoolIds.includes(selection.teamId)) return "Pick a team in this match.";
    if (!cfg.marginBrackets.includes(selection.bracket)) return "Pick a margin bracket.";
    return null;
  }

  if (type === "quarter_winner") {
    if (![1, 2, 3, 4].includes(Number(selection.quarter))) return "Pick a quarter.";
    if (!schoolIds.includes(selection.teamId)) return "Pick a team for that quarter.";
    return null;
  }

  return null;
}

function buildSimpleResult(body, match, sportId) {
  const cfg = getSportConfig(sportId);
  const homeScore = Number(body.homeScore);
  const awayScore = Number(body.awayScore);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore < 0 || awayScore < 0) {
    return { error: `Enter valid ${cfg.scoreUnit} counts.` };
  }
  const winnerId = computeWinner(homeScore, awayScore, match.homeSchoolId, match.awaySchoolId);
  if (!winnerId && homeScore === awayScore && !cfg.allowsDraw) {
    return { error: "Rubber counts cannot be tied for this sport." };
  }
  let summary = "Draw";
  if (winnerId === match.homeSchoolId) summary = `${match.home?.name || "Home"} wins`;
  else if (winnerId === match.awaySchoolId) summary = `${match.away?.name || "Away"} wins`;
  summary = `${summary} (${homeScore}–${awayScore} ${cfg.scoreUnit})`;

  return {
    result: {
      homeScore,
      awayScore,
      homeScoreDisplay: String(homeScore),
      awayScoreDisplay: String(awayScore),
      winnerId,
      margin: computeMargin(homeScore, awayScore),
      summary,
    },
  };
}

function buildAflResult(body, match) {
  const homeScore = Number(body.homeScore);
  const awayScore = Number(body.awayScore);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore < 0 || awayScore < 0) {
    return { error: "Enter valid scores." };
  }
  const winnerId = computeWinner(homeScore, awayScore, match.homeSchoolId, match.awaySchoolId);
  if (!winnerId && homeScore === awayScore) {
    return { error: "Scores cannot be tied for AFL result entry." };
  }

  const schoolIds = [match.homeSchoolId, match.awaySchoolId];
  if (!schoolIds.includes(body.firstGoalSchoolId)) {
    return { error: "Select which school kicked the first goal." };
  }
  const quarters = [];
  for (let i = 1; i <= 4; i++) {
    const key = `q${i}Winner`;
    const winner = body[key];
    if (!schoolIds.includes(winner)) {
      return { error: `Select winner for quarter ${i}.` };
    }
    quarters.push({ quarter: i, winnerId: winner });
  }

  return {
    result: {
      homeScore,
      awayScore,
      winnerId,
      margin: computeMargin(homeScore, awayScore),
      firstGoalSchoolId: body.firstGoalSchoolId,
      quarters,
    },
  };
}

function buildResultFromAdmin(body, match, sportId) {
  if (isSimpleAdmin(sportId)) return buildSimpleResult(body, match, sportId);
  return buildAflResult(body, match);
}

function revertMatchSettlements(betsData, usersData, matchId) {
  let reverted = 0;
  for (const bet of betsData.bets) {
    if (bet.matchId !== matchId) continue;
    if (bet.status !== "won" && bet.status !== "lost") continue;
    if (bet.status === "won") {
      const u = usersData.users.find((x) => x.username === bet.username);
      if (u) u.credits -= bet.payout || 0;
    }
    bet.status = "pending";
    bet.payout = 0;
    delete bet.settledAt;
    reverted += 1;
  }
  return reverted;
}

module.exports = {
  betTypesForSport,
  getOdds,
  settleBet,
  validateBetPayload,
  buildResultFromAdmin,
  revertMatchSettlements,
  computeWinner,
};
