const { parseSearchFilters } = require("../../backend/src/services/filterParser");
const { searchPapersAcrossSources } = require("../../backend/src/services/paperSearch");

function normalizeQueryParam(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
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
