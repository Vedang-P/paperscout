const { parseSearchFilters } = require("../../backend/src/services/filterParser");
const { searchPapersAcrossSources } = require("../../backend/src/services/paperSearch");
const { methodNotAllowed, normalizeQueryParam } = require("../../shared/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const q = normalizeQueryParam(req.query?.q);
  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Query parameter q is required." });
  }

  const filters = parseSearchFilters(req.query || {});

  try {
    const { results, meta } = await searchPapersAcrossSources(q, filters);
    return res.status(200).json({
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
};
