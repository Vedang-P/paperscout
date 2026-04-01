const express = require("express");
const { getActiveDeadlines } = require("../services/deadlinesService");
const {
  normalizeQueryParam,
  parseBoolean,
  parseInteger,
} = require("../../../shared/http");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const limit = parseInteger(req.query?.limit, 12, 1, 40);
    const includeClosed = parseBoolean(req.query?.includeClosed, false);
    const eventType = String(normalizeQueryParam(req.query?.eventType) || "all");
    const data = await getActiveDeadlines({ limit, includeClosed, eventType });
    return res.json(data);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to fetch deadlines",
      details: process.env.NODE_ENV === "development" ? String(error.message || error) : undefined,
    });
  }
});

module.exports = router;
