const { searchCvfWorkshops } = require("../adapters/cvfWorkshopAdapter");
const { searchDblp } = require("../adapters/dblpAdapter");
const { searchOpenAlex } = require("../adapters/openAlexAdapter");
const { searchArxiv } = require("../adapters/arxivAdapter");
const { getCache, getStaleCache, setCache } = require("../utils/cache");
const { enrichCitationCounts } = require("./citationEnricher");
const { classifyPaper } = require("./paperClassifier");
const { inferTags } = require("./tagger");
const { lower, normalizeDoi, toUniqueList } = require("../utils/text");

const SOURCE_NAME = {
  openalex: "OpenAlex",
  dblp: "DBLP",
  arxiv: "arXiv",
  cvf: "CVF Open Access",
};
const CANDIDATE_CACHE_TTL_MS = 5 * 60 * 1000;

function makeTitleKey(title) {
  return lower(title).replace(/[^a-z0-9]/g, "");
}

function makeDedupKeys(paper) {
  const keys = [];
  const doi = normalizeDoi(paper.doi);
  if (doi) keys.push(`doi:${doi}`);
  if (paper.pdfUrl) keys.push(`pdf:${lower(paper.pdfUrl)}`);
  if (paper.url) keys.push(`url:${lower(paper.url)}`);
  if (paper.title) keys.push(`title:${makeTitleKey(paper.title)}`);
  return keys.length ? keys : [`fallback:${Math.random()}`];
}

function mergePaper(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    title: incoming.title || existing.title,
    abstract:
      (incoming.abstract || "").length > (existing.abstract || "").length
        ? incoming.abstract
        : existing.abstract,
    authors: toUniqueList([...(existing.authors || []), ...(incoming.authors || [])]),
    year: incoming.year || existing.year,
    venue: incoming.venue || existing.venue,
    source: existing.source === "OpenAlex" ? existing.source : incoming.source || existing.source,
    sourceType: incoming.sourceType || existing.sourceType,
    conference: incoming.conference || existing.conference,
    isWorkshop: Boolean(existing.isWorkshop || incoming.isWorkshop),
    citationCount: Math.max(existing.citationCount || 0, incoming.citationCount || 0),
    doi: incoming.doi || existing.doi,
    url: incoming.url || existing.url,
    pdfUrl: incoming.pdfUrl || existing.pdfUrl,
    links: toUniqueList([...(existing.links || []), ...(incoming.links || [])]),
  };
}

function dedupePapers(papers) {
  const index = new Map();
  const alias = new Map();

  for (const paper of papers) {
    const keys = makeDedupKeys(paper);
    let canonicalKey = null;
    for (const key of keys) {
      if (index.has(key)) {
        canonicalKey = key;
        break;
      }
      if (alias.has(key)) {
        canonicalKey = alias.get(key);
        break;
      }
    }

    if (!canonicalKey) {
      canonicalKey = keys[0];
      index.set(canonicalKey, paper);
    } else {
      const merged = mergePaper(index.get(canonicalKey), paper);
      index.set(canonicalKey, merged);
    }

    for (const key of keys) {
      alias.set(key, canonicalKey);
    }
  }

  return Array.from(index.values());
}

function makeSourceStats(rawResults, mergedResults) {
  const fromSource = (name) => mergedResults.filter((paper) => paper.source === name).length;
  return {
    raw: rawResults,
    merged: {
      openalex: fromSource(SOURCE_NAME.openalex),
      dblp: fromSource(SOURCE_NAME.dblp),
      arxiv: fromSource(SOURCE_NAME.arxiv),
      cvf: fromSource(SOURCE_NAME.cvf),
      total: mergedResults.length,
    },
  };
}

async function gatherCandidates(query, filters) {
  const cacheKey = `candidates:v1:${lower(query)}:${JSON.stringify({
    minYear: filters.minYear,
    maxYear: filters.maxYear,
    minCitations: filters.minCitations,
    limit: filters.limit,
    type: filters.type,
    venues: [...(filters.venues || [])].sort(),
    hasCode: filters.hasCode,
  })}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const staleCached = getStaleCache(cacheKey);

  const sourceTasks = {
    openalex: () => searchOpenAlex(query, filters),
    dblp: () => searchDblp(query, filters),
    arxiv: () => searchArxiv(query, filters),
    cvf: () => searchCvfWorkshops(query, filters),
  };

  if (!filters.venues.includes("ACCV") && filters.type === "conference") {
    sourceTasks.cvf = async () => [];
  }

  const [openalex, dblp, arxiv, cvf] = await Promise.all([
    sourceTasks.openalex().catch(() => []),
    sourceTasks.dblp().catch(() => []),
    sourceTasks.arxiv().catch(() => []),
    sourceTasks.cvf().catch(() => []),
  ]);

  const raw = {
    openalex: openalex.length,
    dblp: dblp.length,
    arxiv: arxiv.length,
    cvf: cvf.length,
  };

  const tagged = [...openalex, ...dblp, ...arxiv, ...cvf]
    .map((paper) =>
      classifyPaper({
        ...paper,
        tags: inferTags({
          title: paper.title,
          abstract: paper.abstract,
          venue: paper.venue,
        }),
      })
    )
    .map((paper) => ({
      ...paper,
      tags: toUniqueList([...(paper.tags || []), ...(paper.paperTypes || [])]),
    }));

  const deduped = dedupePapers(tagged);
  await enrichCitationCounts(deduped, filters.minCitations > 0 ? 60 : 24);

  if (deduped.length === 0 && staleCached) {
    return staleCached;
  }

  const payload = {
    candidates: deduped,
    sourceStats: makeSourceStats(raw, deduped),
  };
  setCache(
    cacheKey,
    payload,
    deduped.length > 0 ? CANDIDATE_CACHE_TTL_MS : 60 * 1000
  );
  return payload;
}

module.exports = { gatherCandidates };
