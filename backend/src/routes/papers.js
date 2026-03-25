const express = require("express");
const { parseSearchFilters } = require("../services/filterParser");
const { searchPapersAcrossSources } = require("../services/paperSearch");

const router = express.Router();

function normalizeQueryParam(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.get("/search", async (req, res) => {
  const q = normalizeQueryParam(req.query?.q);

  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Query parameter q is required." });
  }

  const filters = parseSearchFilters(req.query);

  try {
    const { results, meta } = await searchPapersAcrossSources(q, filters);
    return res.json({
      query: q,
      filters,
      total: results.length,
      results,
      meta,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Search providers unavailable. Please try again.",
      details: process.env.NODE_ENV === "development" ? String(error.message || error) : undefined,
    });
  }
});

module.exports = router;
