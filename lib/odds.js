/**
 * Derive decimal odds from completed matches. Supports AFL and soccer (with draws).
 */

const { getSportConfig, usesCompactMargins, allowsThreeWayWinner } = require("./sports");

const BOOK_MARGIN = 0.05;
const MIN_ODDS = 1.2;
const MAX_ODDS = 6.0;
const DEFAULT_ODDS = {
  winner: 1.92,
  line: 1.91,
  first_goal_team: 1.88,
  draw: 3.2,
  margin: { "1-39": 2.2, "40+": 3.5, "1-2": 2.1, "3+": 3.4 },
  quarter: 1.95,
};
const HOME_ADVANTAGE = 0.04;

function emptySchoolStat(sportId) {
  const cfg = getSportConfig(sportId);
  const stat = {
    played: 0,
    wins: 0,
    draws: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    margins: [],
    winsTotal: 0,
  };
  if (usesCompactMargins(sportId)) {
    stat.winMargins1_2 = 0;
    stat.winMargins3 = 0;
  } else {
    stat.winMargins1_39 = 0;
    stat.winMargins40 = 0;
  }
  return stat;
}

function computeSchoolStats(sportData) {
  const sportId = sportData.id || "afl";
  const stats = new Map();

  function get(id) {
    if (!stats.has(id)) stats.set(id, emptySchoolStat(sportId));
    return stats.get(id);
  }

  for (const match of allFinalMatches(sportData)) {
    const r = match.result;
    const home = get(match.homeSchoolId);
    const away = get(match.awaySchoolId);
    const homeScore = r.homeScore;
    const awayScore = r.awayScore;
    const margin = Math.abs(homeScore - awayScore);

    home.played += 1;
    away.played += 1;
    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;
    home.margins.push(homeScore - awayScore);
    away.margins.push(awayScore - homeScore);

    if (!r.winnerId) {
      home.draws += 1;
      away.draws += 1;
    } else if (r.winnerId === match.homeSchoolId) {
      home.wins += 1;
      home.winsTotal += 1;
      if (usesCompactMargins(sportId)) {
        if (margin >= 1 && margin <= 2) home.winMargins1_2 += 1;
        if (margin >= 3) home.winMargins3 += 1;
      } else {
        if (margin >= 1 && margin <= 39) home.winMargins1_39 += 1;
        if (margin >= 40) home.winMargins40 += 1;
      }
    } else if (r.winnerId === match.awaySchoolId) {
      away.wins += 1;
      away.winsTotal += 1;
      if (usesCompactMargins(sportId)) {
        if (margin >= 1 && margin <= 2) away.winMargins1_2 += 1;
        if (margin >= 3) away.winMargins3 += 1;
      } else {
        if (margin >= 1 && margin <= 39) away.winMargins1_39 += 1;
        if (margin >= 40) away.winMargins40 += 1;
      }
    }
  }

  return stats;
}

function allFinalMatches(sportData) {
  return Object.values(sportData.rounds).flatMap((r) =>
    r.matches.filter((m) => m.status === "final" && m.result)
  );
}

function schoolStrength(schoolId, stats, sportId) {
  const s = stats.get(schoolId);
  if (!s || s.played === 0) return 1;

  const winRate = (s.wins + s.draws * 0.5) / s.played;
  const avgFor = s.pointsFor / s.played;
  const avgAgainst = s.pointsAgainst / s.played;
  const divisor = usesCompactMargins(sportId) ? 3 : 50;
  const net = (avgFor - avgAgainst) / divisor;
  return Math.max(0.35, Math.min(2.5, 0.55 + winRate * 0.9 + net * 0.35));
}

function threeWayProbabilities(homeId, awayId, stats) {
  const homeStr = schoolStrength(homeId, stats, "soccer");
  const awayStr = schoolStrength(awayId, stats, "soccer");
  const total = homeStr + awayStr + 1.15;
  let pHome = (homeStr / total) * (1 - HOME_ADVANTAGE) + HOME_ADVANTAGE * 0.5;
  let pAway = awayStr / total;
  let pDraw = 1.15 / total;
  const sum = pHome + pAway + pDraw;
  pHome /= sum;
  pAway /= sum;
  pDraw /= sum;
  pHome = Math.min(0.75, Math.max(0.1, pHome));
  pAway = Math.min(0.75, Math.max(0.1, pAway));
  pDraw = Math.min(0.45, Math.max(0.12, pDraw));
  const again = pHome + pAway + pDraw;
  return { home: pHome / again, away: pAway / again, draw: pDraw / again };
}

function winProbability(homeId, awayId, stats, isHomeTeam, sportId) {
  if (allowsThreeWayWinner(sportId)) {
    const p = threeWayProbabilities(homeId, awayId, stats);
    return isHomeTeam ? p.home : p.away;
  }
  let pHome =
    schoolStrength(homeId, stats, sportId) /
    (schoolStrength(homeId, stats, sportId) + schoolStrength(awayId, stats, sportId));
  pHome = Math.min(0.92, Math.max(0.08, pHome + HOME_ADVANTAGE));
  return isHomeTeam ? pHome : 1 - pHome;
}

function decimalFromProb(prob) {
  const fair = 1 / Math.max(0.05, Math.min(0.95, prob));
  const withMargin = fair * (1 + BOOK_MARGIN);
  return Math.round(Math.min(MAX_ODDS, Math.max(MIN_ODDS, withMargin)) * 100) / 100;
}

function marginBracketProbs(winnerId, stats, sportId) {
  const s = stats.get(winnerId);
  if (usesCompactMargins(sportId)) {
    if (!s || s.winsTotal === 0) return { "1-2": 0.65, "3+": 0.35 };
    const p12 = s.winMargins1_2 / s.winsTotal;
    const p3 = s.winMargins3 / s.winsTotal;
    const total = p12 + p3 || 1;
    return { "1-2": p12 / total, "3+": p3 / total };
  }
  if (!s || s.winsTotal === 0) return { "1-39": 0.72, "40+": 0.28 };
  const p39 = s.winMargins1_39 / s.winsTotal;
  const p40 = s.winMargins40 / s.winsTotal;
  const total = p39 + p40 || 1;
  return { "1-39": p39 / total, "40+": p40 / total };
}

function scoringShare(teamId, oppId, stats, sportId) {
  const a = stats.get(teamId);
  const b = stats.get(oppId);
  const defaultRate = usesCompactMargins(sportId) ? 2 : 55;
  if (!a?.played && !b?.played) return 0.5;
  const rateA = a?.played ? a.pointsFor / a.played : defaultRate;
  const rateB = b?.played ? b.pointsFor / b.played : defaultRate;
  return rateA / (rateA + rateB);
}

function computeSuggestedLine(match, stats, sportId) {
  const homeStr = schoolStrength(match.homeSchoolId, stats, sportId);
  const awayStr = schoolStrength(match.awaySchoolId, stats, sportId);
  const mult = usesCompactMargins(sportId) ? 1.5 : 12;
  const diff = (homeStr - awayStr) * mult;
  const rounded = Math.round(diff * 2) / 2;
  return { home: rounded };
}

function computeMatchOdds(match, stats, sportId) {
  const homeId = match.homeSchoolId;
  const awayId = match.awaySchoolId;
  const cfg = getSportConfig(sportId);

  if (allowsThreeWayWinner(sportId)) {
    const { home: pHome, away: pAway, draw: pDraw } = threeWayProbabilities(homeId, awayId, stats);
    const homeMargin = marginBracketProbs(homeId, stats, sportId);
    const awayMargin = marginBracketProbs(awayId, stats, sportId);
    const line = match.line?.home ?? computeSuggestedLine(match, stats, sportId).home;
    const lineHomeCover = estimateLineCoverProb(match, stats, true, line, sportId);
    const lineAwayCover = 1 - lineHomeCover;

    return {
      winner: {
        [homeId]: decimalFromProb(pHome),
        draw: decimalFromProb(pDraw),
        [awayId]: decimalFromProb(pAway),
      },
      line: {
        [homeId]: decimalFromProb(lineHomeCover),
        [awayId]: decimalFromProb(lineAwayCover),
      },
      margin: {
        [homeId]: {
          "1-2": decimalFromProb(pHome * homeMargin["1-2"]),
          "3+": decimalFromProb(pHome * homeMargin["3+"]),
        },
        [awayId]: {
          "1-2": decimalFromProb(pAway * awayMargin["1-2"]),
          "3+": decimalFromProb(pAway * awayMargin["3+"]),
        },
      },
      meta: {
        homeWinPct: Math.round(pHome * 100),
        drawPct: Math.round(pDraw * 100),
        sampleGames: stats.get(homeId)?.played || 0,
      },
    };
  }

  const pHomeWin = winProbability(homeId, awayId, stats, true, sportId);
  const pAwayWin = 1 - pHomeWin;
  const homeMargin = marginBracketProbs(homeId, stats, sportId);
  const awayMargin = marginBracketProbs(awayId, stats, sportId);
  const line = match.line?.home ?? computeSuggestedLine(match, stats, sportId).home;
  const lineHomeCover = estimateLineCoverProb(match, stats, true, line, sportId);
  const lineAwayCover = 1 - lineHomeCover;
  const pHomeFirst = scoringShare(homeId, awayId, stats, sportId);
  const quarterHome = 0.5 + (pHomeWin - 0.5) * 0.35;
  const quarterAway = 1 - quarterHome;

  return {
    winner: {
      [homeId]: decimalFromProb(pHomeWin),
      [awayId]: decimalFromProb(pAwayWin),
    },
    line: {
      [homeId]: decimalFromProb(lineHomeCover),
      [awayId]: decimalFromProb(lineAwayCover),
    },
    first_goal_team: {
      [homeId]: decimalFromProb(pHomeFirst),
      [awayId]: decimalFromProb(1 - pHomeFirst),
    },
    margin: {
      [homeId]: {
        "1-39": decimalFromProb(pHomeWin * homeMargin["1-39"]),
        "40+": decimalFromProb(pHomeWin * homeMargin["40+"]),
      },
      [awayId]: {
        "1-39": decimalFromProb(pAwayWin * awayMargin["1-39"]),
        "40+": decimalFromProb(pAwayWin * awayMargin["40+"]),
      },
    },
    quarter_winner: {
      [homeId]: decimalFromProb(quarterHome),
      [awayId]: decimalFromProb(quarterAway),
    },
    meta: {
      homeWinPct: Math.round(pHomeWin * 100),
      sampleGames: stats.get(homeId)?.played || 0,
    },
  };
}

function estimateLineCoverProb(match, stats, homeCovers, line, sportId) {
  const homeStr = schoolStrength(match.homeSchoolId, stats, sportId);
  const awayStr = schoolStrength(match.awaySchoolId, stats, sportId);
  const scale = usesCompactMargins(sportId) ? 1.8 : 14;
  const adv = usesCompactMargins(sportId) ? HOME_ADVANTAGE * 3 : HOME_ADVANTAGE * 20;
  const expectedMargin = (homeStr - awayStr) * scale + adv;
  const coverMargin = expectedMargin + line;
  const divisor = usesCompactMargins(sportId) ? 1.2 : 8;
  const prob = 1 / (1 + Math.exp(-coverMargin / divisor));
  return homeCovers ? prob : 1 - prob;
}

function getOdds(type, selection, match, stats, sportId) {
  const computed = stats ? computeMatchOdds(match, stats, sportId) : null;
  const fallback = (v) => v ?? DEFAULT_ODDS[type] ?? 2;

  if (!computed) {
    if (type === "margin") return DEFAULT_ODDS.margin[selection.bracket] || 2.2;
    if (type === "quarter_winner") return DEFAULT_ODDS.quarter;
    if (type === "winner" && selection.teamId === "draw") return DEFAULT_ODDS.draw;
    return DEFAULT_ODDS[type] || 2;
  }

  switch (type) {
    case "winner":
    case "line":
    case "first_goal_team":
      return computed[type][selection.teamId] ?? fallback(DEFAULT_ODDS[type]);
    case "margin": {
      const team = computed.margin[selection.teamId];
      return team?.[selection.bracket] ?? DEFAULT_ODDS.margin[selection.bracket];
    }
    case "quarter_winner":
      return computed.quarter_winner[selection.teamId] ?? DEFAULT_ODDS.quarter;
    default:
      return 2;
  }
}

module.exports = {
  DEFAULT_ODDS,
  computeSchoolStats,
  computeMatchOdds,
  computeSuggestedLine,
  getOdds,
  allFinalMatches,
};
