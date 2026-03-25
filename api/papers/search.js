const { searchMockPapers } = require("../../backend/src/services/paperSearch");

function normalizeQueryParam(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const q = normalizeQueryParam(req.query?.q);
  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Query parameter q is required." });
  }

  const results = searchMockPapers(q);
  return res.status(200).json({ query: q, results });
};
