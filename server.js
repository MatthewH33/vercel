require("dotenv").config({ override: true });

const http = require("http");
const { handleRequest } = require("./lib/handler");
const { storageMode } = require("./lib/store");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  handleRequest(req, res, { serveStatic: true });
});

server.listen(PORT, () => {
  console.log(`AGSV Fantasy running at http://localhost:${PORT}`);
  console.log(`Storage: ${storageMode()}${storageMode() === "mongodb" ? " (Atlas)" : " (local JSON files)"}`);
});
