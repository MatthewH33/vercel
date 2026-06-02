/**
 * Generates data/afl.json — run: node scripts/generate-afl-data.js
 */
const fs = require("fs");
const path = require("path");

function gb(goals, behinds) {
  return { goals, behinds, total: goals * 6 + behinds };
}

function result(homePts, awayPts, homeG, homeB, awayG, awayB, opts = {}) {
  const home = gb(homeG, homeB);
  const away = gb(awayG, awayB);
  let winnerId = opts.winnerId;
  let margin = Math.abs(homePts - awayPts);
  let summary = opts.summary;
  if (!summary) {
    if (homePts === awayPts) {
      winnerId = null;
      summary = "Draw";
      margin = 0;
    } else if (winnerId) {
      const name = opts.winnerName || winnerId;
      summary = `${name} won by ${margin} point${margin === 1 ? "" : "s"}`;
    }
  }
  return {
    homeScore: homePts,
    awayScore: awayPts,
    homeGoals: homeG,
    homeBehinds: homeB,
    awayGoals: awayG,
    awayBehinds: awayB,
    homeScoreDisplay: `${homeG}.${homeB}`,
    awayScoreDisplay: `${awayG}.${awayB}`,
    winnerId: winnerId || null,
    margin,
    summary,
  };
}

function match(round, slug, home, away, fields) {
  const bettingOpen = round === 7 && fields.status === "upcoming";
  return {
    id: `r${round}-${slug}`,
    homeSchoolId: home,
    awaySchoolId: away,
    datetime: fields.datetime || "2026-01-01T12:00:00+10:00",
    displayTime: fields.displayTime,
    dayLabel: fields.dayLabel,
    venue: fields.venue,
    status: fields.status,
    bettingOpen,
    line: fields.line || null,
    players: fields.players || null,
    result: fields.result ?? null,
  };
}

function bye(round, schoolId, dayLabel) {
  return { schoolId, round, dayLabel };
}

const round7Players = {
  mentone: ["J. Walsh", "T. Brooks", "L. Chen", "M. O'Brien", "H. Singh"],
  marcellin: ["C. Rossi", "D. Nguyen", "B. Taylor", "A. Patel", "F. Murphy"],
  trinity: ["E. Harrison", "G. Wilson", "N. Costa", "P. Zhang", "R. Adams"],
  "yarra-valley": ["S. Martin", "K. Lee", "V. Brown", "W. Davis", "Z. Kim"],
  assumption: ["O. Clarke", "Q. Wright", "U. Hall", "X. Green", "Y. Stone"],
  ivanhoe: ["I. Foster", "J. Reed", "K. Bell", "L. Cook", "M. Gray"],
  pegs: ["A. Scott", "B. Young", "C. King", "D. Moore", "E. Price"],
  peninsula: ["F. Ward", "G. Hunt", "H. Lane", "I. Nash", "J. Pike"],
};

const rounds = {
  1: {
    round: 1,
    matches: [
      match(1, "trinity-mentone", "trinity", "mentone", {
        displayTime: "05:00 PM, Thu, 23 Apr 26",
        dayLabel: "Thursday, 23 April 2026",
        venue: "Trinity Grammar School, Kew / Hudson Oval",
        status: "final",
        result: result(81, 53, 11, 15, 8, 5, { winnerId: "trinity", winnerName: "Trinity Grammar School" }),
      }),
      match(1, "marcellin-peninsula", "marcellin", "peninsula", {
        displayTime: "05:30 PM, Thu, 23 Apr 26",
        dayLabel: "Thursday, 23 April 2026",
        venue: "Marcellin College / Marcellin College 1",
        status: "final",
        result: result(69, 49, 9, 15, 7, 7, { winnerId: "marcellin", winnerName: "Marcellin College" }),
      }),
      match(1, "yarra-pegs", "yarra-valley", "pegs", {
        displayTime: "02:30 PM, Fri, 24 Apr 26",
        dayLabel: "Friday, 24 April 2026",
        venue: "Yarra Valley Grammar / Patterson Oval",
        status: "final",
        result: result(77, 72, 12, 5, 11, 6, { winnerId: "yarra-valley", winnerName: "Yarra Valley Grammar" }),
      }),
      match(1, "camberwell-assumption", "camberwell", "assumption", {
        displayTime: "02:30 PM, Fri, 24 Apr 26",
        dayLabel: "Friday, 24 April 2026",
        venue: "Gordon Barnard Reserve / Gordon Barnard Reserve 1",
        status: "final",
        result: result(44, 53, 6, 8, 8, 5, { winnerId: "assumption", winnerName: "Assumption College" }),
      }),
    ],
    byes: [bye(1, "ivanhoe", "Friday, 24 April 2026")],
  },
  2: {
    round: 2,
    matches: [
      match(2, "peninsula-yarra", "peninsula", "yarra-valley", {
        displayTime: "02:30 PM, Fri, 01 May 26",
        dayLabel: "Friday, 01 May 2026",
        venue: "Harry MacDonald Oval / Harry MacDonald Oval 1",
        status: "final",
        result: result(78, 60, 12, 6, 8, 12, { winnerId: "peninsula", winnerName: "Peninsula Grammar" }),
      }),
      match(2, "pegs-camberwell", "pegs", "camberwell", {
        displayTime: "02:30 PM, Fri, 01 May 26",
        dayLabel: "Friday, 01 May 2026",
        venue: "Penleigh & Essendon Grammar School – Campus / Shann Oval",
        status: "final",
        result: result(110, 54, 17, 8, 7, 12, { winnerId: "pegs", winnerName: "Penleigh & Essendon Grammar School (PEGS)" }),
      }),
      match(2, "ivanhoe-marcellin", "ivanhoe", "marcellin", {
        displayTime: "02:30 PM, Fri, 01 May 26",
        dayLabel: "Friday, 01 May 2026",
        venue: "Chelsworth Park / Chelsworth Park 1",
        status: "final",
        result: result(62, 44, 9, 8, 6, 8, { winnerId: "ivanhoe", winnerName: "Ivanhoe Grammar School" }),
      }),
      match(2, "assumption-trinity", "assumption", "trinity", {
        displayTime: "10:00 AM, Sat, 02 May 26",
        dayLabel: "Saturday, 02 May 2026",
        venue: "Assumption College / Carroll Oval",
        status: "final",
        result: result(50, 80, 7, 8, 11, 14, { winnerId: "trinity", winnerName: "Trinity Grammar School" }),
      }),
    ],
    byes: [bye(2, "mentone", "Saturday, 02 May 2026")],
  },
  3: {
    round: 3,
    matches: [
      match(3, "camberwell-peninsula", "camberwell", "peninsula", {
        displayTime: "02:30 PM, Fri, 08 May 26",
        dayLabel: "Friday, 08 May 2026",
        venue: "Gordon Barnard Reserve / Gordon Barnard Reserve 1",
        status: "final",
        result: result(80, 58, 12, 8, 8, 10, { winnerId: "camberwell", winnerName: "Camberwell Grammar School" }),
      }),
      match(3, "trinity-pegs", "trinity", "pegs", {
        displayTime: "05:00 PM, Fri, 08 May 26",
        dayLabel: "Friday, 08 May 2026",
        venue: "Trinity Grammar School, Kew / Hudson Oval",
        status: "final",
        result: result(89, 53, 13, 11, 8, 5, { winnerId: "trinity", winnerName: "Trinity Grammar School" }),
      }),
      match(3, "mentone-assumption", "mentone", "assumption", {
        displayTime: "06:00 PM, Fri, 08 May 26",
        dayLabel: "Friday, 08 May 2026",
        venue: "Mentone Grammar School Keysborough Playing Fields / Mentone Grammar School Keysborough 1",
        status: "final",
        result: result(46, 64, 7, 4, 8, 16, { winnerId: "assumption", winnerName: "Assumption College" }),
      }),
      match(3, "yarra-ivanhoe", "yarra-valley", "ivanhoe", {
        displayTime: "10:30 AM, Sat, 09 May 26",
        dayLabel: "Saturday, 09 May 2026",
        venue: "Yarra Valley Grammar / Patterson Oval",
        status: "final",
        result: result(57, 50, 8, 9, 7, 8, { winnerId: "yarra-valley", winnerName: "Yarra Valley Grammar" }),
      }),
    ],
    byes: [bye(3, "marcellin", "Saturday, 09 May 2026")],
  },
  4: {
    round: 4,
    matches: [
      match(4, "pegs-mentone", "pegs", "mentone", {
        displayTime: "02:30 PM, Fri, 15 May 26",
        dayLabel: "Friday, 15 May 2026",
        venue: "Penleigh & Essendon Grammar School – Campus / Shann Oval",
        status: "in_progress",
        result: result(85, 54, 12, 13, 7, 12, { summary: "In Progress" }),
      }),
      match(4, "ivanhoe-camberwell", "ivanhoe", "camberwell", {
        displayTime: "02:30 PM, Fri, 15 May 26",
        dayLabel: "Friday, 15 May 2026",
        venue: "Chelsworth Park / Chelsworth Park 1",
        status: "final",
        result: result(94, 40, 14, 10, 6, 4, { winnerId: "ivanhoe", winnerName: "Ivanhoe Grammar School" }),
      }),
      match(4, "marcellin-yarra", "marcellin", "yarra-valley", {
        displayTime: "05:00 PM, Fri, 15 May 26",
        dayLabel: "Friday, 15 May 2026",
        venue: "Marcellin College / Marcellin College 1",
        status: "final",
        result: result(58, 36, 8, 10, 5, 6, { winnerId: "marcellin", winnerName: "Marcellin College" }),
      }),
      match(4, "peninsula-trinity", "peninsula", "trinity", {
        displayTime: "10:30 AM, Sat, 16 May 26",
        dayLabel: "Saturday, 16 May 2026",
        venue: "Harry MacDonald Oval / Harry MacDonald Oval 1",
        status: "final",
        result: result(51, 51, 6, 15, 7, 9, { summary: "Draw" }),
      }),
    ],
    byes: [bye(4, "assumption", "Saturday, 16 May 2026")],
  },
  5: {
    round: 5,
    matches: [
      match(5, "trinity-ivanhoe", "trinity", "ivanhoe", {
        displayTime: "05:00 PM, Fri, 22 May 26",
        dayLabel: "Friday, 22 May 2026",
        venue: "Trinity Grammar School, Kew / Hudson Oval",
        status: "final",
        result: result(50, 49, 7, 8, 7, 7, { winnerId: "trinity", winnerName: "Trinity Grammar School" }),
      }),
      match(5, "mentone-peninsula", "mentone", "peninsula", {
        displayTime: "05:00 PM, Fri, 22 May 26",
        dayLabel: "Friday, 22 May 2026",
        venue: "Mentone Grammar School Keysborough Playing Fields / Mentone Grammar School Keysborough 2",
        status: "final",
        result: result(70, 73, 10, 10, 11, 7, { winnerId: "peninsula", winnerName: "Peninsula Grammar" }),
      }),
      match(5, "assumption-pegs", "assumption", "pegs", {
        displayTime: "10:00 AM, Sat, 23 May 26",
        dayLabel: "Saturday, 23 May 2026",
        venue: "Assumption College / Carroll Oval",
        status: "final",
        result: result(70, 34, 9, 16, 4, 10, { winnerId: "assumption", winnerName: "Assumption College" }),
      }),
      match(5, "camberwell-marcellin", "camberwell", "marcellin", {
        displayTime: "10:00 AM, Sat, 23 May 26",
        dayLabel: "Saturday, 23 May 2026",
        venue: "Gordon Barnard Reserve / Gordon Barnard Reserve 1",
        status: "final",
        result: result(21, 103, 3, 3, 15, 13, { winnerId: "marcellin", winnerName: "Marcellin College" }),
      }),
    ],
    byes: [bye(5, "yarra-valley", "Saturday, 23 May 2026")],
  },
  6: {
    round: 6,
    matches: [
      match(6, "ivanhoe-mentone", "ivanhoe", "mentone", {
        displayTime: "02:30 PM, Fri, 29 May 26",
        dayLabel: "Friday, 29 May 2026",
        venue: "Chelsworth Park / Chelsworth Park 1",
        status: "in_progress",
        result: result(0, 0, 0, 0, 0, 0, { summary: "In Progress" }),
      }),
      match(6, "marcellin-trinity", "marcellin", "trinity", {
        displayTime: "05:00 PM, Fri, 29 May 26",
        dayLabel: "Friday, 29 May 2026",
        venue: "Marcellin College / Marcellin College 1",
        status: "final",
        result: result(67, 63, 10, 7, 9, 9, { winnerId: "marcellin", winnerName: "Marcellin College" }),
      }),
      match(6, "yarra-camberwell", "yarra-valley", "camberwell", {
        displayTime: "10:30 AM, Sat, 30 May 26",
        dayLabel: "Saturday, 30 May 2026",
        venue: "Yarra Valley Grammar / Patterson Oval",
        status: "final",
        result: result(64, 64, 9, 10, 9, 10, { summary: "Draw" }),
      }),
      match(6, "peninsula-assumption", "peninsula", "assumption", {
        displayTime: "10:30 AM, Sat, 30 May 26",
        dayLabel: "Saturday, 30 May 2026",
        venue: "Harry MacDonald Oval / Harry MacDonald Oval 1",
        status: "final",
        result: result(90, 66, 13, 12, 9, 12, { winnerId: "peninsula", winnerName: "Peninsula Grammar" }),
      }),
    ],
    byes: [bye(6, "pegs", "Saturday, 30 May 2026")],
  },
  7: {
    round: 7,
    matches: [
      match(7, "mentone-marcellin", "mentone", "marcellin", {
        datetime: "2026-06-12T17:00:00+10:00",
        displayTime: "05:00 PM, Fri, 12 Jun 26",
        dayLabel: "Friday, 12 June 2026",
        venue: "Mentone Grammar School Keysborough Playing Fields / Mentone Grammar School Keysborough 2",
        status: "upcoming",
        line: { home: -8.5 },
        players: { mentone: round7Players.mentone, marcellin: round7Players.marcellin },
      }),
      match(7, "trinity-yarra", "trinity", "yarra-valley", {
        datetime: "2026-06-12T17:00:00+10:00",
        displayTime: "05:00 PM, Fri, 12 Jun 26",
        dayLabel: "Friday, 12 June 2026",
        venue: "Trinity Grammar School, Kew / Hudson Oval",
        status: "upcoming",
        line: { home: -5.5 },
        players: { trinity: round7Players.trinity, "yarra-valley": round7Players["yarra-valley"] },
      }),
      match(7, "assumption-ivanhoe", "assumption", "ivanhoe", {
        datetime: "2026-06-13T10:00:00+10:00",
        displayTime: "10:00 AM, Sat, 13 Jun 26",
        dayLabel: "Saturday, 13 June 2026",
        venue: "Assumption College / Carroll Oval",
        status: "upcoming",
        line: { home: -3.5 },
        players: { assumption: round7Players.assumption, ivanhoe: round7Players.ivanhoe },
      }),
      match(7, "pegs-peninsula", "pegs", "peninsula", {
        datetime: "2026-06-13T10:30:00+10:00",
        displayTime: "10:30 AM, Sat, 13 Jun 26",
        dayLabel: "Saturday, 13 June 2026",
        venue: "Penleigh & Essendon Grammar School – Campus / Shann Oval",
        status: "upcoming",
        line: { home: -10.5 },
        players: { pegs: round7Players.pegs, peninsula: round7Players.peninsula },
      }),
    ],
    byes: [bye(7, "camberwell", "Saturday, 13 June 2026")],
  },
};

const afl = {
  id: "afl",
  name: "AFL",
  label: "Australian Rules Football",
  currentRound: 7,
  bettingRound: 7,
  rounds,
};

const out = path.join(__dirname, "..", "data", "afl.json");
fs.writeFileSync(out, JSON.stringify(afl, null, 2) + "\n");
console.log("Wrote", out);
