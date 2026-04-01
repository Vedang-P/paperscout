const { methodNotAllowed } = require("../../shared/http");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  return res.status(200).json({
    status: "ok",
    service: "sarveshu-api",
    time: new Date().toISOString(),
  });
};
