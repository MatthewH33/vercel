require("dotenv").config({ override: true });

const { handleRequest } = require("../lib/handler");

function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}

function ensureApiPath(req) {
  if (req.url && req.url.startsWith("/api/")) return;
  const pathParam = req.query?.path;
  if (!pathParam) return;
  const segments = Array.isArray(pathParam) ? pathParam : [pathParam];
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
