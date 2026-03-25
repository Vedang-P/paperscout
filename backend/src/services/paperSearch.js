const { searchCvfWorkshops } = require("../adapters/cvfWorkshopAdapter");
const { searchDblp } = require("../adapters/dblpAdapter");
const { searchOpenAlex } = require("../adapters/openAlexAdapter");
const { SUGGESTED_TAGS } = require("../config/searchConfig");
const { enrichCitationCounts } = require("./citationEnricher");
const { inferTags } = require("./tagger");
const { includesQuery, lower, normalizeDoi, normalizeWhitespace, tokenize, toUniqueList } = require("../utils/text");

function makeDedupKey(paper) {
  if (paper.doi) return `doi:${normalizeDoi(paper.doi)}`;
  if (paper.pdfUrl) return `pdf:${lower(paper.pdfUrl)}`;
  if (paper.url) return `url:${lower(paper.url)}`;
  return `title:${lower(paper.title)}`;
}

function mergePapers(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    title: incoming.title || existing.title,
    abstract: incoming.abstract || existing.abstract,
    authors: toUniqueList([...(existing.authors || []), ...(incoming.authors || [])]),
    year: incoming.year || existing.year,
    venue: incoming.venue || existing.venue,
    source: existing.source === "OpenAlex" ? existing.source : incoming.source || existing.source,
    sourceType: incoming.sourceType || existing.sourceType,
    conference: incoming.conference || existing.conference,
    isWorkshop: incoming.isWorkshop || existing.isWorkshop,
    citationCount: Math.max(existing.citationCount || 0, incoming.citationCount || 0),
    doi: incoming.doi || existing.doi,
    url: incoming.url || existing.url,
    pdfUrl: incoming.pdfUrl || existing.pdfUrl,
  };
}

function dedupePapers(papers) {
  const index = new Map();
  const titleIndex = new Map();

  for (const paper of papers) {
    const key = makeDedupKey(paper);
    const titleKey = `title:${lower(paper.title)}`;
    const matchedKey = index.has(key) ? key : titleIndex.get(titleKey);

    if (!matchedKey) {
      index.set(key, paper);
      titleIndex.set(titleKey, key);
      continue;
    }

    const merged = mergePapers(index.get(matchedKey), paper);
    index.set(matchedKey, merged);
    titleIndex.set(titleKey, matchedKey);
  }

  return Array.from(index.values());
}

function applyFilters(papers, query, filters) {
  return papers.filter((paper) => {
    if (!paper.title) return false;
    if (!paper.year || paper.year < filters.minYear || paper.year > filters.maxYear) return false;

    const citationCount = Number.isFinite(paper.citationCount) ? paper.citationCount : 0;
    if (citationCount < filters.minCitations) return false;
    if (filters.maxCitations !== null && citationCount > filters.maxCitations) return false;

    if (filters.type === "workshop" && !paper.isWorkshop) return false;
    if (filters.type === "conference" && paper.isWorkshop) return false;

    if (filters.venues.length > 0) {
      const conference = (paper.conference || "").toUpperCase();
      if (!filters.venues.includes(conference)) return false;
    }

    if (!includesQuery(`${paper.title} ${paper.abstract} ${(paper.authors || []).join(" ")} ${paper.venue}`, query)) {
      return false;
    }

    if (filters.tags.length > 0) {
      const tags = (paper.tags || []).map((tag) => tag.toLowerCase());
      const hasEveryTag = filters.tags.every((tag) => tags.includes(tag));
      if (!hasEveryTag) return false;
    }

    return true;
  });
}

function computeScore(paper, query) {
  const tokens = tokenize(query);
  const searchableText = lower(
    `${paper.title} ${paper.abstract} ${(paper.authors || []).join(" ")} ${paper.venue} ${(paper.tags || []).join(" ")}`
  );

  let relevanceScore = 0;
  for (const token of tokens) {
    if (searchableText.includes(token)) relevanceScore += 1;
  }

  const citationScore = Math.log10((paper.citationCount || 0) + 1);
  const recencyScore = (paper.year || 2021) - 2020;
  const workshopBoost = paper.isWorkshop ? 1.25 : 0.2;
  const venueBoost = ["ICLR", "ECCV", "ACCV"].includes((paper.conference || "").toUpperCase()) ? 0.9 : 0.2;

  return relevanceScore * 2 + citationScore * 1.2 + recencyScore * 0.3 + workshopBoost + venueBoost;
}

function enrichWithTags(papers, userTags) {
  return papers.map((paper) => ({
    ...paper,
    tags: inferTags({
      title: paper.title,
      abstract: paper.abstract,
      venue: paper.venue,
      userTags,
    }),
  }));
}

async function searchPapersAcrossSources(query, filters) {
  const tasks = [
    searchOpenAlex(query, filters).catch(() => []),
    searchDblp(query, filters).catch(() => []),
    searchCvfWorkshops(query, filters).catch(() => []),
  ];

  const [openAlexResults, dblpResults, cvfResults] = await Promise.all(tasks);
  const aggregated = [...openAlexResults, ...dblpResults, ...cvfResults];
  const tagged = enrichWithTags(aggregated, filters.tags);
  const deduped = dedupePapers(tagged);
  await enrichCitationCounts(deduped, filters.minCitations > 0 ? 40 : 20);
  const filtered = applyFilters(deduped, query, filters);
  const sorted = filtered
    .map((paper) => ({ ...paper, score: computeScore(paper, query) }))
    .sort((a, b) => b.score - a.score || (b.citationCount || 0) - (a.citationCount || 0) || (b.year || 0) - (a.year || 0))
    .slice(0, filters.limit)
    .map((paper) => {
      const { score, ...rest } = paper;
      return rest;
    });

  return {
    results: sorted,
    meta: {
      totalBeforeFilter: deduped.length,
      totalAfterFilter: filtered.length,
      dataSources: ["OpenAlex", "DBLP", "CVF Open Access"],
      suggestedTags: SUGGESTED_TAGS,
      normalizedQuery: normalizeWhitespace(query),
    },
  };
}

module.exports = { searchPapersAcrossSources };
