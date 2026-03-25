const express = require("express");
const { searchMockPapers } = require("../services/paperSearch");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.get("/search", (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Query parameter q is required." });
  }

  const results = searchMockPapers(q);
  return res.json({ query: q, results });
});

module.exports = router;
