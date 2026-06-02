#!/usr/bin/env node
/**
 * One-time import of local JSON data into MongoDB Atlas.
 *
 * Usage:
 *   1. Copy .env.example to .env and set MONGODB_URI
 *   2. npm install
 *   3. npm run migrate:mongo
 */

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
  override: true,
});

const fs = require("fs");
const path = require("path");
const { getDb, closeDb, getDbName } = require("../lib/db");

const ROOT = path.join(__dirname, "..");

async function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and add your Atlas connection string.");
    process.exit(1);
  }

  const db = await getDb();
  console.log(`Connected to database: ${getDbName()}`);

  const schools = await readJson(path.join(ROOT, "schools.json"));
  const usersData = await readJson(path.join(ROOT, "users.json"));
  const betsData = await readJson(path.join(ROOT, "bets.json"));

  await db.collection("schools").deleteMany({});
  if (schools.length) {
    await db.collection("schools").insertMany(schools);
  }
  console.log(`schools: ${schools.length} documents`);

  await db.collection("users").deleteMany({});
  const users = usersData.users || [];
  if (users.length) {
    await db.collection("users").insertMany(users);
  }
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  console.log(`users: ${users.length} documents`);

  await db.collection("bets").deleteMany({});
  const bets = betsData.bets || [];
  if (bets.length) {
    await db.collection("bets").insertMany(bets);
  }
  await db.collection("bets").createIndex({ id: 1 }, { unique: true });
  await db.collection("bets").createIndex({ username: 1 });
  await db.collection("bets").createIndex({ matchId: 1 });
  console.log(`bets: ${bets.length} documents`);

  const sportIds = ["afl", "soccer", "badminton"];
  await db.collection("sports").deleteMany({});
  for (const sportId of sportIds) {
    const filePath = path.join(ROOT, "data", `${sportId}.json`);
    if (!fs.existsSync(filePath)) continue;
    const sport = await readJson(filePath);
    await db.collection("sports").insertOne(sport);
    console.log(`sports: imported ${sportId}`);
  }
  await db.collection("sports").createIndex({ id: 1 }, { unique: true });

  console.log("\nMigration complete. Start the app with MONGODB_URI set:");
  console.log("  MONGODB_URI=\"...\" npm start");
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
