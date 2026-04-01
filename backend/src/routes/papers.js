const express = require("express");
const { parseSearchFilters } = require("../services/filterParser");
const { searchPapersAcrossSources, recommendPapersAcrossSources } = require("../services/paperSearch");
const { normalizeQueryParam } = require("../../../shared/http");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "sarveshu-api",
    time: new Date().toISOString(),
  });
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

router.get("/recommend", async (req, res) => {
  const q = normalizeQueryParam(req.query?.q);
  const filters = parseSearchFilters(req.query);
  const hasRecommendationInput =
    Boolean(q) ||
    filters.tags.length > 0 ||
    filters.tasks.length > 0 ||
    filters.datasets.length > 0 ||
    filters.paperTypes.length > 0;

  if (!hasRecommendationInput) {
    return res.status(400).json({
      error: "Provide q, tags, tasks, datasets, or paperTypes for recommendations.",
    });
  }

  try {
    const { results, meta } = await recommendPapersAcrossSources(q, filters, req.query);
    return res.json({
      query: q,
      filters,
      total: results.length,
      results,
      meta,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Recommendation providers unavailable. Please try again.",
      details: process.env.NODE_ENV === "development" ? String(error.message || error) : undefined,
    });
  }
});

module.exports = router;
