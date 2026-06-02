const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { getDb } = require("./db");

const ROOT = path.join(__dirname, "..");
const USERS_FILE = path.join(ROOT, "users.json");
const SCHOOLS_FILE = path.join(ROOT, "schools.json");
const BETS_FILE = path.join(ROOT, "bets.json");
const SPORT_IDS = ["afl", "soccer", "badminton"];
const SPORT_FILES = {
  afl: path.join(ROOT, "data", "afl.json"),
  soccer: path.join(ROOT, "data", "soccer.json"),
  badminton: path.join(ROOT, "data", "badminton.json"),
};

function useMongo() {
  const uri = process.env.MONGODB_URI;
  if (uri && !uri.includes("CLUSTER_HOST") && !uri.includes("<db_")) return true;
  if (process.env.MONGODB_USER && process.env.MONGODB_PASSWORD && process.env.MONGODB_HOST) {
    return true;
  }
  if (process.env.VERCEL === "1") {
    throw new Error("MONGODB_URI must be set in Vercel environment variables");
  }
  return false;
}

let schoolsCache = null;
const sportCaches = {};

async function loadSchools() {
  if (useMongo()) {
    if (!schoolsCache) {
      const db = await getDb();
      const docs = await db.collection("schools").find({}).sort({ id: 1 }).toArray();
      schoolsCache = docs.map(({ _id, ...school }) => school);
    }
    return schoolsCache;
  }
  if (!schoolsCache) {
    const raw = await fsp.readFile(SCHOOLS_FILE, "utf8");
    schoolsCache = JSON.parse(raw);
  }
  return schoolsCache;
}

function clearSchoolsCache() {
  schoolsCache = null;
}

async function readUsers() {
  if (useMongo()) {
    const db = await getDb();
    const users = await db.collection("users").find({}).toArray();
    return {
      users: users.map(({ _id, ...user }) => user),
    };
  }
  const raw = await fsp.readFile(USERS_FILE, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.users)) data.users = [];
  return data;
}

async function writeUsers(data) {
  if (useMongo()) {
    const db = await getDb();
    const col = db.collection("users");
    const users = data.users || [];
    const usernames = users.map((u) => u.username);
    if (usernames.length) {
      await col.deleteMany({ username: { $nin: usernames } });
    } else {
      await col.deleteMany({});
    }
    for (const user of users) {
      await col.replaceOne({ username: user.username }, user, { upsert: true });
    }
    return;
  }
  await fsp.writeFile(USERS_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function readBets() {
  if (useMongo()) {
    const db = await getDb();
    const bets = await db.collection("bets").find({}).toArray();
    return {
      bets: bets.map(({ _id, ...bet }) => bet),
    };
  }
  const raw = await fsp.readFile(BETS_FILE, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.bets)) data.bets = [];
  return data;
}

async function writeBets(data) {
  if (useMongo()) {
    const db = await getDb();
    const col = db.collection("bets");
    const bets = data.bets || [];
    const ids = bets.map((b) => b.id);
    if (ids.length) {
      await col.deleteMany({ id: { $nin: ids } });
    } else {
      await col.deleteMany({});
    }
    for (const bet of bets) {
      await col.replaceOne({ id: bet.id }, bet, { upsert: true });
    }
    return;
  }
  await fsp.writeFile(BETS_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function readSport(sportId) {
  if (!SPORT_FILES[sportId]) return null;

  if (useMongo()) {
    if (!sportCaches[sportId]) {
      const db = await getDb();
      const doc = await db.collection("sports").findOne({ id: sportId });
      if (!doc) return null;
      const { _id, ...sport } = doc;
      sportCaches[sportId] = sport;
    }
    return sportCaches[sportId];
  }

  if (!sportCaches[sportId]) {
    const raw = await fsp.readFile(SPORT_FILES[sportId], "utf8");
    sportCaches[sportId] = JSON.parse(raw);
  }
  return sportCaches[sportId];
}

async function writeSport(sportId, data) {
  sportCaches[sportId] = data;
  if (useMongo()) {
    const db = await getDb();
    await db.collection("sports").replaceOne({ id: sportId }, data, { upsert: true });
    return;
  }
  await fsp.writeFile(SPORT_FILES[sportId], JSON.stringify(data, null, 2) + "\n", "utf8");
}

function storageMode() {
  return useMongo() ? "mongodb" : "files";
}

module.exports = {
  SPORT_IDS,
  loadSchools,
  clearSchoolsCache,
  readUsers,
  writeUsers,
  readBets,
  writeBets,
  readSport,
  writeSport,
  storageMode,
  useMongo,
};
