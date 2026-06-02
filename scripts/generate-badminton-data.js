/**
 * Generates data/badminton.json — run: node scripts/generate-badminton-data.js
 */
const fs = require("fs");
const path = require("path");

const SCHOOL_NAMES = {
  camberwell: "Camberwell Grammar School",
  "yarra-valley": "Yarra Valley Grammar",
  trinity: "Trinity Grammar School",
  pegs: "Penleigh & Essendon Grammar School (PEGS)",
};

function parseScoreString(str) {
  const [home, away] = str.split(" - ").map((s) => s.trim());
  const parseSide = (side) => {
    const [rubbers, sets, points] = side.split("/").map(Number);
    return { rubbers, sets, points };
  };
  return { home: parseSide(home), away: parseSide(away) };
}

function badmintonResult(scoreStr, homeId, awayId) {
  const { home, away } = parseScoreString(scoreStr);
  let winnerId = null;
  let summary = "Draw";
  if (home.rubbers > away.rubbers) {
    winnerId = homeId;
    summary = `${SCHOOL_NAMES[homeId] || homeId} wins`;
  } else if (away.rubbers > home.rubbers) {
    winnerId = awayId;
    summary = `${SCHOOL_NAMES[awayId] || awayId} wins`;
  }
  const margin = Math.abs(home.rubbers - away.rubbers);
  const display = `${home.rubbers}/${home.sets}/${home.points} – ${away.rubbers}/${away.sets}/${away.points}`;
  if (winnerId) summary = `${summary} (${display})`;

  return {
    homeScore: home.rubbers,
    awayScore: away.rubbers,
    homeScoreDisplay: `${home.rubbers}/${home.sets}/${home.points}`,
    awayScoreDisplay: `${away.rubbers}/${away.sets}/${away.points}`,
    homeRubbers: home.rubbers,
    homeSets: home.sets,
    homePoints: home.points,
    awayRubbers: away.rubbers,
    awaySets: away.sets,
    awayPoints: away.points,
    winnerId,
    margin,
    summary,
  };
}

function match(round, slug, home, away, fields) {
  const bettingOpen = round === 5 && fields.status === "upcoming";
  return {
    id: `bd-r${round}-${slug}`,
    homeSchoolId: home,
    awaySchoolId: away,
    competition: "Badminton Firsts / Open B",
    datetime: fields.datetime || "2026-01-01T08:00:00+10:00",
    displayTime: fields.displayTime,
    dayLabel: fields.dayLabel,
    venue: fields.venue,
    status: fields.status,
    bettingOpen,
    line: fields.line || null,
    result: fields.result ?? null,
  };
}

const venue =
  "Court 6, Court 7 (Melbourne Badminton Centre), 6-16 Joseph St, Blackburn North VIC 3130";

const rounds = {
  1: {
    round: 1,
    matches: [
      match(1, "camberwell-yarra", "camberwell", "yarra-valley", {
        displayTime: "8:15am, Sat, 9 May 26",
        dayLabel: "Saturday, 9 May 2026",
        venue,
        status: "final",
        result: badmintonResult("6/0/230 - 0/0/112", "camberwell", "yarra-valley"),
      }),
      match(1, "trinity-pegs", "trinity", "pegs", {
        displayTime: "9:50am, Sat, 9 May 26",
        dayLabel: "Saturday, 9 May 2026",
        venue,
        status: "final",
        result: badmintonResult("6/10/230 - 0/0/73", "trinity", "pegs"),
      }),
    ],
    byes: [],
  },
  2: {
    round: 2,
    matches: [
      match(2, "trinity-camberwell", "trinity", "camberwell", {
        displayTime: "8:15am, Sat, 16 May 26",
        dayLabel: "Saturday, 16 May 2026",
        venue,
        status: "final",
        result: badmintonResult("1/2/171 - 5/9/239", "trinity", "camberwell"),
      }),
      match(2, "yarra-pegs", "yarra-valley", "pegs", {
        displayTime: "9:50am, Sat, 16 May 26",
        dayLabel: "Saturday, 16 May 2026",
        venue,
        status: "final",
        result: badmintonResult("6/10/230 - 0/0/58", "yarra-valley", "pegs"),
      }),
    ],
    byes: [],
  },
  3: {
    round: 3,
    matches: [
      match(3, "pegs-camberwell", "pegs", "camberwell", {
        displayTime: "8:15am, Sat, 23 May 26",
        dayLabel: "Saturday, 23 May 2026",
        venue,
        status: "final",
        result: badmintonResult("1/2/118 - 5/8/208", "pegs", "camberwell"),
      }),
      match(3, "yarra-trinity", "yarra-valley", "trinity", {
        displayTime: "9:50am, Sat, 23 May 26",
        dayLabel: "Saturday, 23 May 2026",
        venue,
        status: "final",
        result: badmintonResult("2/5/201 - 4/6/212", "yarra-valley", "trinity"),
      }),
    ],
    byes: [],
  },
  4: {
    round: 4,
    matches: [
      match(4, "yarra-camberwell", "yarra-valley", "camberwell", {
        displayTime: "8:15am, Sat, 30 May 26",
        dayLabel: "Saturday, 30 May 2026",
        venue,
        status: "final",
        result: badmintonResult("1/3/201 - 5/8/228", "yarra-valley", "camberwell"),
      }),
      match(4, "pegs-trinity", "pegs", "trinity", {
        displayTime: "9:50am, Sat, 30 May 26",
        dayLabel: "Saturday, 30 May 2026",
        venue,
        status: "final",
        result: badmintonResult("1/2/121 - 5/8/207", "pegs", "trinity"),
      }),
    ],
    byes: [],
  },
  5: {
    round: 5,
    matches: [
      match(5, "camberwell-trinity", "camberwell", "trinity", {
        displayTime: "8:15am, Sat, 13 Jun 26",
        dayLabel: "Saturday, 13 June 2026",
        venue,
        status: "upcoming",
        line: { home: -0.5 },
      }),
      match(5, "pegs-yarra", "pegs", "yarra-valley", {
        displayTime: "9:50am, Sat, 13 Jun 26",
        dayLabel: "Saturday, 13 June 2026",
        venue,
        status: "upcoming",
        line: { home: 0.5 },
      }),
    ],
    byes: [],
  },
  6: {
    round: 6,
    matches: [
      match(6, "camberwell-pegs", "camberwell", "pegs", {
        displayTime: "8:15am, Sat, 18 Jul 26",
        dayLabel: "Saturday, 18 July 2026",
        venue,
        status: "upcoming",
        bettingOpen: false,
        line: { home: -1.5 },
      }),
      match(6, "trinity-yarra", "trinity", "yarra-valley", {
        displayTime: "9:50am, Sat, 18 Jul 26",
        dayLabel: "Saturday, 18 July 2026",
        venue,
        status: "upcoming",
        bettingOpen: false,
        line: { home: -0.5 },
      }),
    ],
    byes: [],
  },
};

const data = {
  id: "badminton",
  name: "Badminton",
  label: "Badminton — Firsts / Open B",
  currentRound: 5,
  bettingRound: 5,
  rounds,
};

const out = path.join(__dirname, "..", "data", "badminton.json");
fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("Wrote", out);
