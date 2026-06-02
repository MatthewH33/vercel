require("dotenv").config({ override: true });

const { handleRequest } = require("../lib/handler");

module.exports = async (req, res) => {
  await handleRequest(req, res, { serveStatic: false });
};
