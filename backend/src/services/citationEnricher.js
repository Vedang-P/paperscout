const axios = require("axios");
const { getCache, setCache } = require("../utils/cache");
const { normalizeDoi, normalizeWhitespace, tokenize } = require("../utils/text");

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function similarityByTokens(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

async function getCitationByDoi(doi) {
  const normalizedDoi = normalizeDoi(doi);
  if (!normalizedDoi) return null;
  const key = `openalex:doi:${normalizedDoi}`;
  const cached = getCache(key);
  if (cached !== null) return cached;

  try {
    const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(normalizedDoi)}`;
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "PaperScout/1.0 (research paper scraper)" },
    });
    const citationCount = Number.isFinite(response.data?.cited_by_count) ? response.data.cited_by_count : 0;
    setCache(key, citationCount, CACHE_TTL_MS);
    return citationCount;
  } catch {
    setCache(key, null, 60 * 60 * 1000);
    return null;
  }
}

async function getCitationByTitle(title) {
  const normalizedTitle = normalizeWhitespace(title);
  if (!normalizedTitle) return null;
  const key = `openalex:title:${normalizedTitle.toLowerCase()}`;
  const cached = getCache(key);
  if (cached !== null) return cached;

  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(normalizedTitle)}&per-page=3`;
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "PaperScout/1.0 (research paper scraper)" },
    });
    const candidates = Array.isArray(response.data?.results) ? response.data.results : [];
    const best = candidates
      .map((item) => ({
        score: similarityByTokens(normalizedTitle, item.display_name || item.title || ""),
        citationCount: Number.isFinite(item.cited_by_count) ? item.cited_by_count : 0,
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 0.72) {
      setCache(key, null, 60 * 60 * 1000);
      return null;
    }

    setCache(key, best.citationCount, CACHE_TTL_MS);
    return best.citationCount;
  } catch {
    setCache(key, null, 60 * 60 * 1000);
    return null;
  }
}

async function mapWithConcurrency(items, worker, concurrency = 4) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(queue.length, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function enrichCitationCounts(papers, limit = 30) {
  const targets = papers
    .filter((paper) => (paper.citationCount || 0) <= 0)
    .slice(0, Math.max(0, limit));

  await mapWithConcurrency(
    targets,
    async (paper) => {
      const byDoi = await getCitationByDoi(paper.doi);
      if (Number.isFinite(byDoi) && byDoi >= 0) {
        paper.citationCount = byDoi;
        return;
      }

      const byTitle = await getCitationByTitle(paper.title);
      if (Number.isFinite(byTitle) && byTitle >= 0) {
        paper.citationCount = byTitle;
      }
    },
    4
  );
}

module.exports = { enrichCitationCounts };
