const { MongoClient } = require("mongodb");

let client;
let dbPromise;

function resolveMongoUri() {
  const uri = (process.env.MONGODB_URI || "").trim();
  if (uri && !uri.includes("CLUSTER_HOST") && !uri.includes("<db_")) {
    return uri;
  }
  const user = (process.env.MONGODB_USER || "").trim();
  const pass = (process.env.MONGODB_PASSWORD || "").trim();
  const host = (process.env.MONGODB_HOST || "").trim();
  if (user && pass && host) {
    const db = (process.env.MONGODB_DB || "agsv").trim();
    const app = (process.env.MONGODB_APP_NAME || "agsvfantacy").trim();
    const params = new URLSearchParams({
      retryWrites: "true",
      w: "majority",
      authSource: "admin",
      appName: app,
    });
    return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${db}?${params}`;
  }
  throw new Error(
    "Set MONGODB_URI in .env, or MONGODB_USER + MONGODB_PASSWORD + MONGODB_HOST"
  );
}

function getDbName() {
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB.trim();
  try {
    const u = new URL(resolveMongoUri().replace(/^mongodb(\+srv)?:/, "https:"));
    const name = u.pathname.replace(/^\//, "");
    if (name) return name;
  } catch {
    /* fall through */
  }
  return "agsv";
}

async function getDb() {
  const uri = resolveMongoUri();
  if (!dbPromise) {
    dbPromise = (async () => {
      client = new MongoClient(uri);
      await client.connect();
      return client.db(getDbName());
    })();
  }
  return dbPromise;
}

async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    dbPromise = null;
  }
}

module.exports = { getDb, closeDb, getDbName, resolveMongoUri };
