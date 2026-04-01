const {
  parseSearchFilters,
} = require("../../backend/src/services/filterParser");
const {
  recommendPapersAcrossSources,
} = require("../../backend/src/services/paperSearch");
const { methodNotAllowed, normalizeQueryParam } = require("../../shared/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const q = normalizeQueryParam(req.query?.q);
  const filters = parseSearchFilters(req.query || {});
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
    const { results, meta } = await recommendPapersAcrossSources(
      q,
      filters,
      req.query || {}
    );
    return res.status(200).json({
      query: q,
      filters,
      total: results.length,
      results,
      meta,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Recommendation providers unavailable. Please try again.",
      details:
        process.env.NODE_ENV === "development"
          ? String(error.message || error)
          : undefined,
    });
  }
};
