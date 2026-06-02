export const BET_LABELS = {
  winner: "Match winner",
  margin: "Winning margin",
  line: "Line (handicap)",
  first_goal_team: "First goal — team",
  quarter_winner: "Quarter winner",
};

export function marginBracketLabel(bracket, sportId) {
  if (sportId === "soccer") {
    if (bracket === "1-2") return "1–2 goals";
    if (bracket === "3+") return "3+ goals";
  }
  if (sportId === "badminton") {
    if (bracket === "1-2") return "1–2 rubbers";
    if (bracket === "3+") return "3+ rubbers";
  }
  if (bracket === "40+") return "40+ pts";
  return "1–39 pts";
}

export function usesCompactMargins(sportId) {
  return sportId === "soccer" || sportId === "badminton";
}

export function statusClass(status) {
  return `status-${status}`;
}
