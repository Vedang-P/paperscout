const { getActiveDeadlines } = require("../backend/src/services/deadlinesService");
const {
  methodNotAllowed,
  parseBoolean,
  parseInteger,
  normalizeQueryParam,
} = require("../shared/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  try {
    const limit = parseInteger(req.query?.limit, 12, 1, 40);
    const includeClosed = parseBoolean(req.query?.includeClosed, false);
    const eventType = String(normalizeQueryParam(req.query?.eventType) || "all");
    const data = await getActiveDeadlines({ limit, includeClosed, eventType });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to fetch deadlines",
      details:
        process.env.NODE_ENV === "development"
          ? String(error.message || error)
          : undefined,
    });
  }
};
