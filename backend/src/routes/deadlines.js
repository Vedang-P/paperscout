const express = require("express");
const { getActiveDeadlines } = require("../services/deadlinesService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 12);
    const includeClosed = String(req.query?.includeClosed || "").toLowerCase() === "true";
    const eventType = String(req.query?.eventType || "all");
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
