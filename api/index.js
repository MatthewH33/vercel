require("dotenv").config({ override: true });

const { handleRequest } = require("../lib/handler");

function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}

function ensureApiPath(req) {
  if (req.url && req.url.startsWith("/api/")) return;
  const rawPath = req.query?.path;
  if (!rawPath) return;
  const segments = Array.isArray(rawPath) ? rawPath : [rawPath];
  const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  req.url = `/api/${segments.join("/")}${qs}`;
}

module.exports = async (req, res) => {
  try {
    ensureApiPath(req);
    await handleRequest(req, res, { serveStatic: false });
  } catch (err) {
    console.error("API error:", err);
    if (!res.headersSent) {
      const configError = /SESSION_SECRET|MONGODB_URI/.test(err.message || "");
      sendError(res, 500, configError ? err.message : "Server error.");
    }
  }
};
