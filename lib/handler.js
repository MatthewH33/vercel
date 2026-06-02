const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const {
  getOdds,
  settleBet,
  validateBetPayload,
  buildResultFromAdmin,
  revertMatchSettlements,
  betTypesForSport,
} = require("./betting");
const { computeSchoolStats, computeSuggestedLine, computeMatchOdds } = require("./odds");
const { getSportConfig } = require("./sports");
const { createSessionToken, verifySessionToken, SESSION_MAX_AGE_SEC } = require("./auth-sessions");
const {
  SPORT_IDS,
  loadSchools,
  readUsers,
  writeUsers,
  readBets,
  writeBets,
  readSport,
  writeSport,
} = require("./store");

const ROOT = path.join(__dirname, "..");
const STARTING_CREDITS = 1000;
const SESSION_COOKIE = "agsv_session";

function schoolById(schools, id) {
  return schools.find((s) => s.id === id);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = hashPassword(password, salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
  } catch {
    return false;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) out[key] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

function validateUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6;
}

function isAdminUser(user) {
  return Boolean(user && (user.isAdmin === true || user.username === "admin"));
}

function publicUser(user, schools) {
  const school = schoolById(schools, user.schoolId);
  return {
    username: user.username,
    schoolId: user.schoolId,
    school: school ? school.name : user.schoolId,
    logo: school ? school.logo : null,
    credits: user.credits,
    isAdmin: isAdminUser(user),
  };
}

function adminResultSummary(match) {
  const r = match.result;
  if (!r) return null;
  if (r.summary) return r.summary;
  const home = r.homeScoreDisplay ?? r.homeScore;
  const away = r.awayScoreDisplay ?? r.awayScore;
  if (home != null && away != null) return `${home}–${away}`;
  return null;
}

function findMatchEntry(sportData, matchId) {
  for (const roundKey of Object.keys(sportData.rounds)) {
    const round = sportData.rounds[roundKey];
    const idx = round.matches.findIndex((m) => m.id === matchId);
    if (idx !== -1) {
      return { roundKey, round, idx, match: round.matches[idx] };
    }
  }
  return null;
}

async function findMatchGlobally(matchId) {
  for (const sportId of SPORT_IDS) {
    const sportData = await readSport(sportId);
    if (!sportData) continue;
    const found = findMatchEntry(sportData, matchId);
    if (found) return { sportId, sportData, ...found };
  }
  return null;
}

function allMatches(sportData) {
  return Object.values(sportData.rounds).flatMap((r) => r.matches);
}

function enrichRoundResponse(sportData, roundNum, schools, user) {
  const round = sportData.rounds[String(roundNum)];
  if (!round) return null;
  const schoolStats = computeSchoolStats(sportData);
  return {
    sport: sportData.id,
    sportName: sportData.name,
    round: round.round,
    bettingOpen: round.round === sportData.bettingRound,
    betTypes: betTypesForSport(sportData.id),
    matches: round.matches.map((m) => enrichMatch(m, schools, sportData, schoolStats)),
    byes: (round.byes || []).map((b) => ({
      ...b,
      school: schoolById(schools, b.schoolId),
    })),
    isAdmin: user ? isAdminUser(user) : false,
  };
}

async function getAuthedUser(req) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) return null;
  const data = await readUsers();
  return data.users.find((u) => u.username === sessionUser) || null;
}

function enrichMatch(match, schools, sportData, schoolStats) {
  const home = schoolById(schools, match.homeSchoolId);
  const away = schoolById(schools, match.awaySchoolId);
  const sportId = sportData?.id || "afl";
  const stats = schoolStats || (sportData ? computeSchoolStats(sportData) : null);
  const line =
    match.line ||
    (stats && match.status !== "final" ? computeSuggestedLine(match, stats, sportId) : null);
  const forOdds = { ...match, line };
  const odds = stats ? computeMatchOdds(forOdds, stats, sportId) : null;
  return {
    ...match,
    line,
    odds,
    home: home ? { id: home.id, name: home.name, logo: home.logo } : { id: match.homeSchoolId, name: match.homeSchoolId },
    away: away ? { id: away.id, name: away.name, logo: away.logo } : { id: match.awaySchoolId, name: match.awaySchoolId },
  };
}

function formatBetSelection(bet, match, schools) {
  const home = schoolById(schools, match?.homeSchoolId);
  const away = schoolById(schools, match?.awaySchoolId);
  const teamName = (id) => {
    if (id === match?.homeSchoolId) return home?.name || id;
    if (id === match?.awaySchoolId) return away?.name || id;
    return id;
  };
  const sel = bet.selection;
  switch (bet.type) {
    case "winner":
      if (sel.teamId === "draw") return "Draw";
      return teamName(sel.teamId);
    case "line":
    case "first_goal_team":
      return teamName(sel.teamId);
    case "margin": {
      const cfg = getSportConfig(match?.sportId);
      const unit = cfg.scoreUnit;
      if (sel.bracket === "40+") return `${teamName(sel.teamId)} by 40+ ${unit}`;
      if (sel.bracket === "3+") return `${teamName(sel.teamId)} by 3+ ${unit}`;
      if (sel.bracket === "1-2") return `${teamName(sel.teamId)} by 1–2 ${unit}`;
      return `${teamName(sel.teamId)} by 1–39 ${unit}`;
    }
    case "quarter_winner":
      return `Q${sel.quarter} — ${teamName(sel.teamId)}`;
    default:
      return bet.type;
  }
}

async function enrichUserBets(bets, schools) {
  const sportDataList = await Promise.all(SPORT_IDS.map((id) => readSport(id)));
  const matchIndex = new Map();
  for (const sportData of sportDataList) {
    if (!sportData) continue;
    for (const m of allMatches(sportData)) {
      matchIndex.set(m.id, { match: m, sportData });
    }
  }

  return bets
    .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
    .map((b) => {
      const entry = matchIndex.get(b.matchId);
      const match = entry?.match;
      const sportData = entry?.sportData;
      const home = match ? schoolById(schools, match.homeSchoolId) : null;
      const away = match ? schoolById(schools, match.awaySchoolId) : null;
      const matchWithSport = match ? { ...match, sportId: sportData?.id } : null;
      return {
        ...b,
        sport: sportData?.id || null,
        matchLabel: match
          ? `${home?.name || "?"} vs ${away?.name || "?"}`
          : b.matchId,
        selectionLabel: matchWithSport ? formatBetSelection(b, matchWithSport, schools) : "",
        round: sportData
          ? Object.values(sportData.rounds).find((r) => r.matches.some((m) => m.id === b.matchId))?.round
          : null,
      };
    });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function buildMatchSportIndex() {
  const index = new Map();
  for (const sportId of SPORT_IDS) {
    const sportData = await readSport(sportId);
    if (!sportData) continue;
    for (const round of Object.values(sportData.rounds)) {
      for (const m of round.matches) {
        index.set(m.id, {
          sportId,
          sportName: sportData.name,
          round: round.round,
        });
      }
    }
  }
  return index;
}

async function buildAdminSportSummary(sportId, betsData) {
  const sportData = await readSport(sportId);
  if (!sportData) return null;
  const bettingRound = sportData.rounds[String(sportData.bettingRound)];
  const roundMatches = bettingRound?.matches || [];
  const matchIds = new Set(roundMatches.map((m) => m.id));
  let pendingBets = 0;
  for (const bet of betsData.bets) {
    if (bet.status === "pending" && matchIds.has(bet.matchId)) pendingBets += 1;
  }
  const needsResult = roundMatches.filter((m) => m.status !== "final").length;
  const settled = roundMatches.filter((m) => m.status === "final").length;
  return {
    id: sportData.id,
    name: sportData.name,
    bettingRound: sportData.bettingRound,
    totalMatches: roundMatches.length,
    needsResult,
    settled,
    pendingBets,
    openBetting: roundMatches.filter((m) => m.bettingOpen).length,
    actionNeeded: needsResult > 0 || pendingBets > 0,
  };
}

async function clearAdminMatchResult(global) {
  const { sportId, sportData, match, roundKey, round } = global;
  if (round.round !== sportData.bettingRound) {
    return {
      error: "You can only clear results for matches in the current betting round.",
      status: 400,
    };
  }
  if (match.status !== "final") {
    return { error: "This match does not have a final result to clear.", status: 400 };
  }

  const updated = {
    ...match,
    status: "upcoming",
    bettingOpen: true,
    result: null,
  };
  sportData.rounds[roundKey].matches[global.idx] = updated;
  await writeSport(sportId, sportData);

  const betsData = await readBets();
  const usersData = await readUsers();
  const reverted = revertMatchSettlements(betsData, usersData, match.id);
  await writeBets(betsData);
  await writeUsers(usersData);

  const schools = await loadSchools();
  const schoolStats = computeSchoolStats(sportData);
  return {
    status: 200,
    body: {
      match: enrichMatch(updated, schools, sportData, schoolStats),
      reverted,
    },
  };
}

async function serveStaticFiles(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath);
    if (
      ext === ".json" &&
      (base === "users.json" || base === "bets.json" || filePath.includes(`${path.sep}data${path.sep}`))
    ) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const data = await fsp.readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

async function handleRequest(req, res, options = {}) {
  const serveStatic = options.serveStatic !== false;
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (!serveStatic && !pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    });
    res.end();
    return;
  }

  try {
    if (pathname === "/api/schools" && req.method === "GET") {
      const schools = await loadSchools();
      sendJson(res, 200, { schools });
      return;
    }

    if (pathname === "/api/register" && req.method === "POST") {
      const body = await readBody(req);
      const { username, password, schoolId } = body;
      const schools = await loadSchools();

      if (!validateUsername(username)) {
        sendJson(res, 400, { error: "Username must be 3–20 characters (letters, numbers, underscore)." });
        return;
      }
      if (!validatePassword(password)) {
        sendJson(res, 400, { error: "Password must be at least 6 characters." });
        return;
      }
      if (!schoolById(schools, schoolId)) {
        sendJson(res, 400, { error: "Please select a valid school." });
        return;
      }

      const data = await readUsers();
      const taken = data.users.some((u) => u.username.toLowerCase() === username.toLowerCase());
      if (taken) {
        sendJson(res, 409, { error: "Username already taken." });
        return;
      }

      const user = {
        username,
        passwordHash: createPasswordHash(password),
        schoolId,
        credits: STARTING_CREDITS,
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      await writeUsers(data);

      const token = createSessionToken(username);
      setSessionCookie(res, token);
      sendJson(res, 201, { user: publicUser(user, schools) });
      return;
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const { username, password } = body;
      const schools = await loadSchools();

      if (!username || !password) {
        sendJson(res, 400, { error: "Username and password are required." });
        return;
      }

      const data = await readUsers();
      const user = data.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
      if (!user || !verifyPassword(password, user.passwordHash)) {
        sendJson(res, 401, { error: "Invalid username or password." });
        return;
      }

      const token = createSessionToken(user.username);
      setSessionCookie(res, token);
      sendJson(res, 200, { user: publicUser(user, schools) });
      return;
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      clearSessionCookie(res);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/me" && req.method === "GET") {
      const sessionUser = getSessionUser(req);
      if (!sessionUser) {
        sendJson(res, 401, { error: "Not signed in." });
        return;
      }
      const schools = await loadSchools();
      const data = await readUsers();
      const user = data.users.find((u) => u.username === sessionUser);
      if (!user) {
        sendJson(res, 401, { error: "Not signed in." });
        return;
      }
      sendJson(res, 200, { user: publicUser(user, schools) });
      return;
    }

    if (pathname === "/api/leaderboard" && req.method === "GET") {
      const schools = await loadSchools();
      const data = await readUsers();
      const players = [...data.users]
        .sort((a, b) => b.credits - a.credits || a.username.localeCompare(b.username))
        .map((user, index) => ({
          rank: index + 1,
          ...publicUser(user, schools),
        }));

      const schoolTotalsMap = new Map();
      for (const user of data.users) {
        const school = schoolById(schools, user.schoolId);
        const key = user.schoolId;
        const entry = schoolTotalsMap.get(key) || {
          schoolId: key,
          school: school ? school.name : key,
          logo: school ? school.logo : null,
          totalCredits: 0,
          playerCount: 0,
        };
        entry.totalCredits += user.credits;
        entry.playerCount += 1;
        schoolTotalsMap.set(key, entry);
      }

      const schoolsLeaderboard = [...schoolTotalsMap.values()].sort(
        (a, b) => b.totalCredits - a.totalCredits || a.school.localeCompare(b.school)
      );

      sendJson(res, 200, { players, schools: schoolsLeaderboard });
      return;
    }

    if (pathname === "/api/sports" && req.method === "GET") {
      const sports = [];
      for (const sportId of SPORT_IDS) {
        const data = await readSport(sportId);
        if (!data) continue;
        const roundNumbers = Object.keys(data.rounds)
          .map(Number)
          .sort((a, b) => a - b);
        sports.push({
          id: data.id,
          name: data.name,
          label: data.label,
          available: true,
          currentRound: data.currentRound,
          bettingRound: data.bettingRound,
          rounds: roundNumbers,
        });
      }
      sports.push({ id: "cricket", name: "Cricket", label: "Coming soon", available: false, rounds: [] });
      sendJson(res, 200, { sports });
      return;
    }

    const sportRound = pathname.match(/^\/api\/sports\/([^/]+)\/rounds\/(\d+)$/);
    if (sportRound && req.method === "GET") {
      const [, sportId, roundNum] = sportRound;
      const sportData = await readSport(sportId);
      if (!sportData) {
        sendJson(res, 404, { error: "Sport not available yet." });
        return;
      }
      const schools = await loadSchools();
      const user = await getAuthedUser(req);
      const payload = enrichRoundResponse(sportData, roundNum, schools, user);
      if (!payload) {
        sendJson(res, 404, { error: "Round not found." });
        return;
      }
      sendJson(res, 200, payload);
      return;
    }

    if (pathname === "/api/matches/round/7" && req.method === "GET") {
      const schools = await loadSchools();
      const afl = await readSport("afl");
      const user = await getAuthedUser(req);
      sendJson(res, 200, enrichRoundResponse(afl, 7, schools, user));
      return;
    }

    const matchDetail = pathname.match(/^\/api\/matches\/([^/]+)$/);
    if (matchDetail && req.method === "GET") {
      const schools = await loadSchools();
      const global = await findMatchGlobally(matchDetail[1]);
      if (!global) {
        sendJson(res, 404, { error: "Match not found." });
        return;
      }
      const { sportId, sportData, match } = global;
      const user = await getAuthedUser(req);
      const betsData = await readBets();
      const schoolStats = computeSchoolStats(sportData);
      const myBets = user
        ? betsData.bets.filter((b) => b.username === user.username && b.matchId === match.id)
        : [];
      sendJson(res, 200, {
        match: enrichMatch(match, schools, sportData, schoolStats),
        round: global.round.round,
        sport: sportId,
        betTypes: betTypesForSport(sportId),
        bettingOpen: Boolean(match.bettingOpen),
        myBets,
        isAdmin: user ? isAdminUser(user) : false,
      });
      return;
    }

    if (pathname === "/api/bets" && req.method === "POST") {
      const user = await getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Sign in to place bets." });
        return;
      }
      const body = await readBody(req);
      const global = await findMatchGlobally(body.matchId);
      if (!global) {
        sendJson(res, 404, { error: "Match not found." });
        return;
      }
      const { sportId, sportData, match } = global;
      const err = validateBetPayload(body, match, sportId);
      if (err) {
        sendJson(res, 400, { error: err });
        return;
      }
      if (user.credits < body.stake) {
        sendJson(res, 400, { error: "Not enough credits." });
        return;
      }

      const schoolStats = computeSchoolStats(sportData);
      const odds = getOdds(body.type, body.selection, match, schoolStats, sportId);
      const usersData = await readUsers();
      const u = usersData.users.find((x) => x.username === user.username);
      u.credits -= body.stake;
      await writeUsers(usersData);

      const betsData = await readBets();
      const bet = {
        id: crypto.randomBytes(8).toString("hex"),
        username: user.username,
        matchId: match.id,
        type: body.type,
        selection: body.selection,
        stake: body.stake,
        odds,
        status: "pending",
        payout: 0,
        placedAt: new Date().toISOString(),
      };
      betsData.bets.push(bet);
      await writeBets(betsData);

      const schools = await loadSchools();
      sendJson(res, 201, { bet, user: publicUser(u, schools) });
      return;
    }

    if (pathname === "/api/bets/mine" && req.method === "GET") {
      const user = await getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Sign in to view bets." });
        return;
      }
      const betsData = await readBets();
      const schools = await loadSchools();
      const mine = await enrichUserBets(
        betsData.bets.filter((b) => b.username === user.username),
        schools
      );
      sendJson(res, 200, { bets: mine });
      return;
    }

    if (pathname === "/api/me/stats" && req.method === "GET") {
      const user = await getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Sign in to view your profile." });
        return;
      }
      const schools = await loadSchools();
      const betsData = await readBets();
      const mine = betsData.bets.filter((b) => b.username === user.username);
      const won = mine.filter((b) => b.status === "won");
      const lost = mine.filter((b) => b.status === "lost");
      const pending = mine.filter((b) => b.status === "pending");
      const settled = [...won, ...lost];
      const totalStaked = mine.reduce((sum, b) => sum + b.stake, 0);
      const settledStaked = settled.reduce((sum, b) => sum + b.stake, 0);
      const totalReturned = won.reduce((sum, b) => sum + b.payout, 0);
      const profit = totalReturned - settledStaked;
      const rankData = await readUsers();
      const sorted = [...rankData.users].sort(
        (a, b) => b.credits - a.credits || a.username.localeCompare(b.username)
      );
      const rank = sorted.findIndex((u) => u.username === user.username) + 1;

      sendJson(res, 200, {
        user: publicUser(user, schools),
        stats: {
          totalBets: mine.length,
          won: won.length,
          lost: lost.length,
          pending: pending.length,
          winRate: settled.length ? Math.round((won.length / settled.length) * 100) : null,
          totalStaked,
          totalReturned,
          profit,
          rank: rank || null,
          memberSince: user.createdAt || null,
        },
        bets: await enrichUserBets(mine, schools),
      });
      return;
    }

    if (pathname === "/api/admin/dashboard" && req.method === "GET") {
      const user = await getAuthedUser(req);
      if (!user || !isAdminUser(user)) {
        sendJson(res, 403, { error: "Admin access only." });
        return;
      }

      const usersData = await readUsers();
      const betsData = await readBets();
      const bets = betsData.bets;
      const pending = bets.filter((b) => b.status === "pending");
      const won = bets.filter((b) => b.status === "won");
      const lost = bets.filter((b) => b.status === "lost");

      const matchIndex = await buildMatchSportIndex();
      const sports = [];
      for (const sportId of SPORT_IDS) {
        const summary = await buildAdminSportSummary(sportId, betsData);
        if (summary) sports.push(summary);
      }

      const recentBets = [...bets]
        .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
        .slice(0, 12)
        .map((bet) => {
          const loc = matchIndex.get(bet.matchId);
          return {
            id: bet.id,
            username: bet.username,
            matchId: bet.matchId,
            type: bet.type,
            stake: bet.stake,
            odds: bet.odds,
            status: bet.status,
            payout: bet.payout || 0,
            placedAt: bet.placedAt,
            sportId: loc?.sportId || null,
            sportName: loc?.sportName || null,
            round: loc?.round ?? null,
          };
        });

      const needsResultsTotal = sports.reduce((n, s) => n + s.needsResult, 0);
      const pendingOnBettingRounds = sports.reduce((n, s) => n + s.pendingBets, 0);

      sendJson(res, 200, {
        totals: {
          users: usersData.users.length,
          bets: bets.length,
          pending: pending.length,
          won: won.length,
          lost: lost.length,
          pendingStake: pending.reduce((sum, b) => sum + b.stake, 0),
          needsResults: needsResultsTotal,
          pendingOnBettingRounds,
        },
        sports,
        recentBets,
      });
      return;
    }

    if (pathname === "/api/admin/overview" && req.method === "GET") {
      const user = await getAuthedUser(req);
      if (!user || !isAdminUser(user)) {
        sendJson(res, 403, { error: "Admin access only." });
        return;
      }
      const url = new URL(req.url, `http://${req.headers.host}`);
      const sportId = url.searchParams.get("sport") || "afl";
      const sportData = await readSport(sportId);
      if (!sportData) {
        sendJson(res, 404, { error: "Sport not found." });
        return;
      }
      const schools = await loadSchools();
      const betsData = await readBets();
      const schoolStats = computeSchoolStats(sportData);
      const bettingRound = sportData.rounds[String(sportData.bettingRound)];
      const roundMatches = bettingRound ? bettingRound.matches : [];
      const pendingByMatch = new Map();
      for (const bet of betsData.bets) {
        if (bet.status !== "pending") continue;
        pendingByMatch.set(bet.matchId, (pendingByMatch.get(bet.matchId) || 0) + 1);
      }

      const matches = roundMatches.map((m) => {
        const enriched = enrichMatch(m, schools, sportData, schoolStats);
        return {
          id: m.id,
          round: bettingRound.round,
          status: m.status,
          bettingOpen: m.bettingOpen,
          displayTime: m.displayTime,
          home: enriched.home,
          away: enriched.away,
          hasResult: Boolean(m.result),
          resultSummary: adminResultSummary(m),
          pendingBets: pendingByMatch.get(m.id) || 0,
          settledBets: betsData.bets.filter(
            (b) => b.matchId === m.id && (b.status === "won" || b.status === "lost")
          ).length,
          oddsMeta: enriched.odds?.meta,
        };
      });

      const needsResult = matches.filter((m) => m.status !== "final");
      const settled = matches.filter((m) => m.status === "final");

      sendJson(res, 200, {
        sport: sportData.id,
        sportName: sportData.name,
        bettingRound: sportData.bettingRound,
        needsResult,
        settled,
        totalPendingBets: [...pendingByMatch.values()].reduce((a, b) => a + b, 0),
      });
      return;
    }

    const adminClear = pathname.match(/^\/api\/admin\/matches\/([^/]+)\/clear-result$/);
    const adminResult = pathname.match(/^\/api\/admin\/matches\/([^/]+)\/result$/);

    if (adminClear && req.method === "POST") {
      const user = await getAuthedUser(req);
      if (!user || !isAdminUser(user)) {
        sendJson(res, 403, { error: "Admin access only." });
        return;
      }
      const global = await findMatchGlobally(adminClear[1]);
      if (!global) {
        sendJson(res, 404, { error: "Match not found." });
        return;
      }
      const outcome = await clearAdminMatchResult(global);
      if (outcome.error) {
        sendJson(res, outcome.status, { error: outcome.error });
        return;
      }
      sendJson(res, 200, outcome.body);
      return;
    }

    if (adminResult && req.method === "DELETE") {
      const user = await getAuthedUser(req);
      if (!user || !isAdminUser(user)) {
        sendJson(res, 403, { error: "Admin access only." });
        return;
      }
      const global = await findMatchGlobally(adminResult[1]);
      if (!global) {
        sendJson(res, 404, { error: "Match not found." });
        return;
      }
      const outcome = await clearAdminMatchResult(global);
      if (outcome.error) {
        sendJson(res, outcome.status, { error: outcome.error });
        return;
      }
      sendJson(res, 200, outcome.body);
      return;
    }

    if (adminResult && req.method === "POST") {
      const user = await getAuthedUser(req);
      if (!user || !isAdminUser(user)) {
        sendJson(res, 403, { error: "Admin access only." });
        return;
      }
      const body = await readBody(req);
      const global = await findMatchGlobally(adminResult[1]);
      if (!global) {
        sendJson(res, 404, { error: "Match not found." });
        return;
      }
      const { sportId, sportData, match } = global;
      const schools = await loadSchools();
      const home = schoolById(schools, match.homeSchoolId);
      const away = schoolById(schools, match.awaySchoolId);
      const matchForAdmin = {
        ...match,
        home: home ? { name: home.name } : null,
        away: away ? { name: away.name } : null,
      };
      const built = buildResultFromAdmin(body, matchForAdmin, sportId);
      if (built.error) {
        sendJson(res, 400, { error: built.error });
        return;
      }

      const updated = {
        ...match,
        status: "final",
        bettingOpen: false,
        result: built.result,
      };
      sportData.rounds[global.roundKey].matches[global.idx] = updated;
      await writeSport(sportId, sportData);

      const betsData = await readBets();
      const usersData = await readUsers();
      let settled = 0;

      for (const bet of betsData.bets) {
        if (bet.matchId !== match.id || bet.status !== "pending") continue;
        const outcome = settleBet(bet, updated, sportId);
        bet.status = outcome.status;
        bet.payout = outcome.payout;
        bet.settledAt = new Date().toISOString();
        if (outcome.status === "won") {
          const u = usersData.users.find((x) => x.username === bet.username);
          if (u) u.credits += outcome.payout;
        }
        settled += 1;
      }

      await writeBets(betsData);
      await writeUsers(usersData);

      const schoolStats = computeSchoolStats(sportData);
      sendJson(res, 200, {
        match: enrichMatch(updated, schools, sportData, schoolStats),
        settled,
      });
      return;
    }

    if (serveStatic && (pathname === "/" || pathname === "")) {
      await serveStaticFiles(req, res, "/index.html");
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (serveStatic) {
      await serveStaticFiles(req, res, pathname);
    } else {
      sendJson(res, 404, { error: "Not found" });
    }
  } catch (err) {
    console.error(err);
    if (err instanceof SyntaxError) {
      sendJson(res, 400, { error: "Invalid JSON body." });
      return;
    }
    sendJson(res, 500, { error: "Server error." });
  }
}

module.exports = { handleRequest };
