const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days
const SECRET_FILE = path.join(__dirname, "..", ".session-secret");

let cachedSecret = null;

function loadOrCreateSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  const onVercel = process.env.VERCEL === "1";
  if (onVercel) {
    throw new Error("SESSION_SECRET must be set in Vercel environment variables");
  }
  try {
    cachedSecret = fs.readFileSync(SECRET_FILE, "utf8").trim();
    if (cachedSecret) return cachedSecret;
  } catch {
    /* create below */
  }
  cachedSecret = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(SECRET_FILE, cachedSecret + "\n", { mode: 0o600 });
  } catch {
    /* read-only FS — use in-memory secret for this process only */
  }
  return cachedSecret;
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payloadB64) {
  return base64url(crypto.createHmac("sha256", loadOrCreateSecret()).update(payloadB64).digest());
}

function createSessionToken(username) {
  const payload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(fromBase64url(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.u || typeof payload.u !== "string") return null;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.u;
}

module.exports = {
  SESSION_MAX_AGE_SEC,
  createSessionToken,
  verifySessionToken,
};
