#!/usr/bin/env node
/**
 * Quick Atlas connection check (does not print your password).
 * Usage: npm run test:mongo
 */

if (process.env.MONGODB_URI) {
  console.warn(
    "Warning: MONGODB_URI is set in your shell and may override .env. Run: unset MONGODB_URI\n"
  );
}

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
  override: true,
});

const { MongoClient } = require("mongodb");
const { getDbName, resolveMongoUri } = require("../lib/db");

function describeUri(uri) {
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:/, "https:"));
    return {
      username: decodeURIComponent(u.username || "(missing)"),
      host: u.hostname,
      database: u.pathname.replace(/^\//, "") || "(default)",
    };
  } catch {
    return null;
  }
}

async function main() {
  let uri;
  try {
    uri = resolveMongoUri();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const info = describeUri(uri);
  if (info) {
    console.log("From .env:");
    console.log("  Username:", info.username);
    console.log("  Host:", info.host);
    console.log("  Database:", info.database || getDbName());
  }

  if (uri.includes("CLUSTER_HOST") || uri.includes("<db_")) {
    console.error("\nURI still has placeholders — paste the full string from Atlas Connect.");
    process.exit(1);
  }

  console.log("\nConnecting…");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    await client.db(getDbName()).command({ ping: 1 });
    console.log("OK — authentication and network access work.");
  } catch (err) {
    console.error("\nFailed:", err.message);
    if (err.code === 8000 || /auth/i.test(err.message)) {
      console.error(`
This is almost always wrong username/password in .env (not the hostname).

Fix in Atlas:
  1. Security → Database Access → find your user (exact spelling).
  2. Edit → Edit Password → set a new password.
  3. Database → Connect → Drivers → copy URI with password filled in.
  4. Replace MONGODB_URI in .env (keep /agsv before the ?).

Or use separate vars in .env (password encoded automatically):
  MONGODB_USER=your_user
  MONGODB_PASSWORD=your_new_password
  MONGODB_HOST=agsvfantacy.aigkcfe.mongodb.net
`);
    } else if (/timed out|ENOTFOUND/i.test(err.message)) {
      console.error("\nCheck Network Access in Atlas — add your current IP or 0.0.0.0/0.");
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
