/**
 * Generates data/soccer.json — run: node scripts/generate-soccer-data.js
 */
const fs = require("fs");
const path = require("path");

const SCHOOL_NAMES = {
  trinity: "Trinity Grammar School",
  pegs: "Penleigh & Essendon Grammar School (PEGS)",
  mentone: "Mentone Grammar",
  camberwell: "Camberwell Grammar School",
  marcellin: "Marcellin College",
  "yarra-valley": "Yarra Valley Grammar",
  peninsula: "Peninsula Grammar",
  ivanhoe: "Ivanhoe Grammar School",
};

function soccerResult(homeGoals, awayGoals, homeId, awayId) {
  let winnerId = null;
  let summary = "Draw";
  if (homeGoals > awayGoals) {
    winnerId = homeId;
    summary = `${SCHOOL_NAMES[homeId] || homeId} wins`;
  } else if (awayGoals > homeGoals) {
    winnerId = awayId;
    summary = `${SCHOOL_NAMES[awayId] || awayId} wins`;
  }
  const margin = Math.abs(homeGoals - awayGoals);
  if (winnerId && margin > 0) {
    summary = `${summary} (${homeGoals}–${awayGoals})`;
  } else if (homeGoals === awayGoals) {
    summary = `Draw (${homeGoals}–${awayGoals})`;
  }
  return {
    homeScore: homeGoals,
    awayScore: awayGoals,
    homeScoreDisplay: String(homeGoals),
    awayScoreDisplay: String(awayGoals),
    winnerId,
    margin,
    summary,
  };
}

function match(round, slug, home, away, fields) {
  const bettingOpen = round === 6 && fields.status === "upcoming";
  return {
    id: `sc-r${round}-${slug}`,
    homeSchoolId: home,
    awaySchoolId: away,
    competition: "Soccer - Firsts, Open B and Year level A",
    datetime: fields.datetime || "2026-01-01T12:00:00+10:00",
    displayTime: fields.displayTime,
    dayLabel: fields.dayLabel,
    venue: fields.venue,
    status: fields.status,
    bettingOpen,
    line: fields.line || null,
    result: fields.result ?? null,
  };
}

const rounds = {
  1: {
    round: 1,
    matches: [
      match(1, "trinity-pegs", "trinity", "pegs", {
        displayTime: "5:45pm, Thu, 1 May 26",
        dayLabel: "Thursday, 1 May 2026",
        venue: "Home of the Matildas - Pitch 5 (Turf), La Trobe Sports Park, Plenty Rd, Bundoora VIC 3086",
        status: "final",
        result: soccerResult(0, 5, "trinity", "pegs"),
      }),
      match(1, "mentone-camberwell", "mentone", "camberwell", {
        displayTime: "5:45pm, Thu, 1 May 26",
        dayLabel: "Thursday, 1 May 2026",
        venue: "Home of the Matildas - Pitch 2 (Syn), La Trobe Sports Park, Plenty Rd, Bundoora VIC 3086",
        status: "final",
        result: soccerResult(1, 1, "mentone", "camberwell"),
      }),
      match(1, "marcellin-yarra", "marcellin", "yarra-valley", {
        displayTime: "5:45pm, Thu, 1 May 26",
        dayLabel: "Thursday, 1 May 2026",
        venue: "Home of the Matildas - Pitch 3 (Syn), La Trobe Sports Park, Plenty Rd, Bundoora VIC 3086",
        status: "final",
        result: soccerResult(2, 0, "marcellin", "yarra-valley"),
      }),
      match(1, "peninsula-ivanhoe", "peninsula", "ivanhoe", {
        displayTime: "5:45pm, Thu, 1 May 26",
        dayLabel: "Thursday, 1 May 2026",
        venue: "Home of the Matildas - Pitch 4 (Syn), La Trobe Sports Park, Plenty Rd, Bundoora VIC 3086",
        status: "final",
        result: soccerResult(1, 2, "peninsula", "ivanhoe"),
      }),
    ],
    byes: [],
  },
  2: {
    round: 2,
    matches: [
      match(2, "ivanhoe-trinity", "ivanhoe", "trinity", {
        displayTime: "2:30pm, Fri, 8 May 26",
        dayLabel: "Friday, 8 May 2026",
        venue: "La Trobe Sports Park, Plenty Rd, Bundoora VIC 3086",
        status: "final",
        result: soccerResult(2, 1, "ivanhoe", "trinity"),
      }),
      match(2, "peninsula-mentone", "peninsula", "mentone", {
        displayTime: "4:00pm, Fri, 8 May 26",
        dayLabel: "Friday, 8 May 2026",
        venue: "PEN - Brennan Oval, 20 Wooralla Dr, Mount Eliza VIC 3930",
        status: "final",
        result: soccerResult(2, 2, "peninsula", "mentone"),
      }),
      match(2, "camberwell-yarra", "camberwell", "yarra-valley", {
        displayTime: "10:00am, Sat, 9 May 26",
        dayLabel: "Saturday, 9 May 2026",
        venue: "CAMB - Keith Anderson Oval, 55 Mont Albert Rd, Canterbury VIC 3126",
        status: "final",
        result: soccerResult(5, 0, "camberwell", "yarra-valley"),
      }),
      match(2, "pegs-marcellin", "pegs", "marcellin", {
        displayTime: "10:30am, Sat, 9 May 26",
        dayLabel: "Saturday, 9 May 2026",
        venue: "PEGS Keilor Park - Pitch 1, 127 Wright Rd, Keilor Park",
        status: "final",
        result: soccerResult(4, 2, "pegs", "marcellin"),
      }),
    ],
    byes: [],
  },
  3: {
    round: 3,
    matches: [
      match(3, "ivanhoe-camberwell", "ivanhoe", "camberwell", {
        displayTime: "2:30pm, Fri, 15 May 26",
        dayLabel: "Friday, 15 May 2026",
        venue: "Veneto Club, 191 Bulleen Rd, Bulleen VIC 3105",
        status: "final",
        result: soccerResult(3, 0, "ivanhoe", "camberwell"),
      }),
      match(3, "trinity-peninsula", "trinity", "peninsula", {
        displayTime: "5:00pm, Fri, 15 May 26",
        dayLabel: "Friday, 15 May 2026",
        venue: "TRIN - Hudson Oval, 162-168 Bulleen Rd, Bulleen VIC 3105",
        status: "final",
        result: soccerResult(3, 1, "trinity", "peninsula"),
      }),
      match(3, "mentone-marcellin", "mentone", "marcellin", {
        displayTime: "9:30am, Sat, 16 May 26",
        dayLabel: "Saturday, 16 May 2026",
        venue: "MENT - Campus Oval, 63 Venice St, Mentone VIC 3194",
        status: "final",
        result: soccerResult(1, 1, "mentone", "marcellin"),
      }),
      match(3, "yarra-pegs", "yarra-valley", "pegs", {
        displayTime: "10:00am, Sat, 16 May 26",
        dayLabel: "Saturday, 16 May 2026",
        venue: "YVG - Pitch 1, Kalinda Rd, Ringwood VIC 3134",
        status: "final",
        result: soccerResult(0, 6, "yarra-valley", "pegs"),
      }),
    ],
    byes: [],
  },
  4: {
    round: 4,
    matches: [
      match(4, "marcellin-trinity", "marcellin", "trinity", {
        displayTime: "5:00pm, Fri, 22 May 26",
        dayLabel: "Friday, 22 May 2026",
        venue: "MARC - Gartner Fields - Pitch 1, 160 Bulleen Rd, Bulleen VIC 3105",
        status: "final",
        result: soccerResult(2, 2, "marcellin", "trinity"),
      }),
      match(4, "camberwell-peninsula", "camberwell", "peninsula", {
        displayTime: "10:00am, Sat, 23 May 26",
        dayLabel: "Saturday, 23 May 2026",
        venue: "CAMB - Keith Anderson Oval, 55 Mont Albert Rd, Canterbury VIC 3126",
        status: "final",
        result: soccerResult(4, 2, "camberwell", "peninsula"),
      }),
      match(4, "yarra-ivanhoe", "yarra-valley", "ivanhoe", {
        displayTime: "10:00am, Sat, 23 May 26",
        dayLabel: "Saturday, 23 May 2026",
        venue: "YVG - Pitch 1, Kalinda Rd, Ringwood VIC 3134",
        status: "final",
        result: soccerResult(2, 7, "yarra-valley", "ivanhoe"),
      }),
      match(4, "pegs-mentone", "pegs", "mentone", {
        displayTime: "10:30am, Sat, 23 May 26",
        dayLabel: "Saturday, 23 May 2026",
        venue: "PEGS Keilor Park - Pitch 1, 127 Wright Rd, Keilor Park",
        status: "final",
        result: soccerResult(3, 1, "pegs", "mentone"),
      }),
    ],
    byes: [],
  },
  5: {
    round: 5,
    matches: [
      match(5, "ivanhoe-pegs", "ivanhoe", "pegs", {
        displayTime: "2:30pm, Fri, 29 May 26",
        dayLabel: "Friday, 29 May 2026",
        venue: "Veneto Club, 191 Bulleen Rd, Bulleen VIC 3105",
        status: "final",
        result: soccerResult(4, 2, "ivanhoe", "pegs"),
      }),
      match(5, "camberwell-marcellin", "camberwell", "marcellin", {
        displayTime: "3:00pm, Fri, 29 May 26",
        dayLabel: "Friday, 29 May 2026",
        venue: "CAMB - Keith Anderson Oval, 55 Mont Albert Rd, Canterbury VIC 3126",
        status: "final",
        result: soccerResult(3, 1, "camberwell", "marcellin"),
      }),
      match(5, "peninsula-yarra", "peninsula", "yarra-valley", {
        displayTime: "9:30am, Sat, 30 May 26",
        dayLabel: "Saturday, 30 May 2026",
        venue: "PEN - Brennan Oval, 20 Wooralla Dr, Mount Eliza VIC 3930",
        status: "final",
        result: soccerResult(2, 0, "peninsula", "yarra-valley"),
      }),
      match(5, "trinity-mentone", "trinity", "mentone", {
        displayTime: "10:00am, Sat, 30 May 26",
        dayLabel: "Saturday, 30 May 2026",
        venue: "TRIN - Price 1 (Bulleen), 162-168 Bulleen Rd, Bulleen VIC 3105",
        status: "final",
        result: soccerResult(6, 3, "trinity", "mentone"),
      }),
    ],
    byes: [],
  },
  6: {
    round: 6,
    matches: [
      match(6, "mentone-ivanhoe", "mentone", "ivanhoe", {
        displayTime: "3:00pm, Fri, 12 Jun 26",
        dayLabel: "Friday, 12 June 2026",
        venue: "MENT - Campus Oval, 63 Venice St, Mentone VIC 3194",
        status: "upcoming",
        line: { home: 0.5 },
      }),
      match(6, "marcellin-peninsula", "marcellin", "peninsula", {
        displayTime: "4:30pm, Fri, 12 Jun 26",
        dayLabel: "Friday, 12 June 2026",
        venue: "MARC - Gartner Fields - Pitch 1, 160 Bulleen Rd, Bulleen VIC 3105",
        status: "upcoming",
        line: { home: -0.5 },
      }),
      match(6, "trinity-yarra", "trinity", "yarra-valley", {
        displayTime: "10:00am, Sat, 13 Jun 26",
        dayLabel: "Saturday, 13 June 2026",
        venue: "TRIN - Price 1 (Bulleen), 162-168 Bulleen Rd, Bulleen VIC 3105",
        status: "upcoming",
        line: { home: -1.5 },
      }),
      match(6, "pegs-camberwell", "pegs", "camberwell", {
        displayTime: "10:30am, Sat, 13 Jun 26",
        dayLabel: "Saturday, 13 June 2026",
        venue: "PEGS Keilor Park - Pitch 1, 127 Wright Rd, Keilor Park",
        status: "upcoming",
        line: { home: -0.5 },
      }),
    ],
    byes: [],
  },
  7: {
    round: 7,
    matches: [
      match(7, "ivanhoe-marcellin", "ivanhoe", "marcellin", {
        displayTime: "2:30pm, Fri, 17 Jul 26",
        dayLabel: "Friday, 17 July 2026",
        venue: "La Trobe Sports Park, Plenty Rd, Bundoora VIC 3086",
        status: "upcoming",
        bettingOpen: false,
        line: { home: -1.5 },
      }),
      match(7, "camberwell-trinity", "camberwell", "trinity", {
        displayTime: "3:00pm, Fri, 17 Jul 26",
        dayLabel: "Friday, 17 July 2026",
        venue: "CAMB - Keith Anderson Oval, 55 Mont Albert Rd, Canterbury VIC 3126",
        status: "upcoming",
        bettingOpen: false,
        line: { home: 0.5 },
      }),
      match(7, "yarra-mentone", "yarra-valley", "mentone", {
        displayTime: "10:00am, Sat, 18 Jul 26",
        dayLabel: "Saturday, 18 July 2026",
        venue: "YVG - Pitch 1, Kalinda Rd, Ringwood VIC 3134",
        status: "upcoming",
        bettingOpen: false,
        line: { home: 1.5 },
      }),
      match(7, "pegs-peninsula", "pegs", "peninsula", {
        displayTime: "10:00am, Sat, 18 Jul 26",
        dayLabel: "Saturday, 18 July 2026",
        venue: "PEGS Keilor Park - Pitch 1, 127 Wright Rd, Keilor Park",
        status: "upcoming",
        bettingOpen: false,
        line: { home: -1.5 },
      }),
    ],
    byes: [],
  },
};

const data = {
  id: "soccer",
  name: "Soccer",
  label: "Football / Soccer — Firsts",
  currentRound: 6,
  bettingRound: 6,
  rounds,
};

const out = path.join(__dirname, "..", "data", "soccer.json");
fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("Wrote", out);
