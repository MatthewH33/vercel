require("dotenv").config({ override: true });

const { resolveMongoUri } = require("../lib/db");

module.exports = async (req, res) => {
  const checks = {
    ok: true,
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    mongodbUri: Boolean(process.env.MONGODB_URI || process.env.MONGODB_HOST),
  };
  try {
    resolveMongoUri();
  } catch {
    checks.mongodbUri = false;
    checks.ok = false;
  }
  if (!checks.sessionSecret || !checks.mongodbUri) checks.ok = false;

  res.statusCode = checks.ok ? 200 : 503;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(checks));
};
