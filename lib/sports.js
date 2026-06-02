const SPORTS = {
  afl: {
    id: "afl",
    betTypes: ["winner", "margin", "line", "first_goal_team", "quarter_winner"],
    marginBrackets: ["1-39", "40+"],
    allowsDraw: false,
    threeWayWinner: false,
    simpleAdmin: false,
    scoreUnit: "points",
    adminScoreLabel: "Score",
  },
  soccer: {
    id: "soccer",
    betTypes: ["winner", "margin", "line"],
    marginBrackets: ["1-2", "3+"],
    allowsDraw: true,
    threeWayWinner: true,
    simpleAdmin: true,
    scoreUnit: "goals",
    adminScoreLabel: "Goals",
  },
  badminton: {
    id: "badminton",
    betTypes: ["winner", "margin", "line"],
    marginBrackets: ["1-2", "3+"],
    allowsDraw: false,
    threeWayWinner: false,
    simpleAdmin: true,
    scoreUnit: "rubbers",
    adminScoreLabel: "Rubbers won",
  },
};

const TEAM_SPORT_BET_TYPES = ["winner", "margin", "line"];

function getSportConfig(sportId) {
  return SPORTS[sportId] || SPORTS.afl;
}

function betTypesForSport(sportId) {
  return getSportConfig(sportId).betTypes;
}

function isAfl(sportId) {
  return sportId === "afl";
}

function isSoccer(sportId) {
  return sportId === "soccer";
}

function isSimpleAdmin(sportId) {
  return getSportConfig(sportId).simpleAdmin;
}

function usesCompactMargins(sportId) {
  return getSportConfig(sportId).marginBrackets[0] === "1-2";
}

function allowsThreeWayWinner(sportId) {
  return getSportConfig(sportId).threeWayWinner;
}

module.exports = {
  SPORTS,
  TEAM_SPORT_BET_TYPES,
  getSportConfig,
  betTypesForSport,
  isAfl,
  isSoccer,
  isSimpleAdmin,
  usesCompactMargins,
  allowsThreeWayWinner,
};
