const { gatherCandidates } = require("./candidateAggregator");
const { normalizeQueryTypos } = require("./fuzzyQuery");
const { recommendPapers } = require("./recommendationModel");
const { parseRecommendationModelOptions } = require("./filterParser");
const { lower, normalizeWhitespace, toUniqueList } = require("../utils/text");

const BASE_DATA_SOURCES = ["OpenAlex", "DBLP", "arXiv", "CVF Open Access"];
const MIN_CANDIDATE_TARGET = 18;

const QUERY_EXPANSION_RULES = [
  {
    matchAll: ["machine", "unlearning"],
    expansions: [
      "unlearning",
      "machine forgetting",
      "data deletion",
      "certified unlearning",
      "right to be forgotten",
    ],
  },
  {
    matchAll: ["federated", "unlearning"],
    expansions: [
      "federated learning unlearning",
      "client deletion",
      "federated forgetting",
    ],
  },
  {
    matchAll: ["foundation", "model", "unlearning"],
    expansions: [
      "llm unlearning",
      "model editing",
      "knowledge removal",
    ],
  },
];

function buildQueryFromInputs(query, filters, modelOptions) {
  const explicitQuery = normalizeWhitespace(query);
  if (explicitQuery) return explicitQuery;

  const fallback = [
    ...(filters.tags || []),
    ...(filters.tasks || []),
    ...(filters.datasets || []),
    ...(filters.paperTypes || []),
    ...(modelOptions.keywords || []),
    ...(modelOptions.seedTitles || []),
    ...(modelOptions.preferredAuthors || []),
  ]
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .join(" ");

  return normalizeWhitespace(fallback);
}

function dedupeNormalizedTerms(values = []) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = lower(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function queryContainsAllTerms(query, terms = []) {
  const normalized = lower(query);
  return terms.every((term) => normalized.includes(lower(term)));
}

function buildExpansionTerms(query) {
  const normalized = normalizeWhitespace(query);
  const expansions = [];

  for (const rule of QUERY_EXPANSION_RULES) {
    if (queryContainsAllTerms(normalized, rule.matchAll)) {
      expansions.push(...rule.expansions);
    }
  }

  if (queryContainsAllTerms(normalized, ["unlearning"])) {
    expansions.push("forgetting", "deletion request", "machine forgetting");
  }

  return dedupeNormalizedTerms(expansions).slice(0, 8);
}

function buildSourceQueries({ normalizedQuery, rankingQuery, filters, modelOptions }) {
  const baseTerms = dedupeNormalizedTerms([normalizedQuery, rankingQuery]);
  const expansionTerms = buildExpansionTerms(rankingQuery);
  const retrievalHints = dedupeNormalizedTerms([
    ...(filters.tags || []),
    ...(filters.tasks || []),
    ...(filters.datasets || []),
    ...(modelOptions.keywords || []),
  ]).slice(0, 4);

  const primarySourceQuery = baseTerms.join(" ");
  const broadenedSourceQuery = dedupeNormalizedTerms([
    ...baseTerms,
    ...expansionTerms,
    ...retrievalHints,
  ]).join(" ");

  return {
    primarySourceQuery,
    broadenedSourceQuery,
    expansionTerms,
  };
}

function mergePaperCandidate(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    title: incoming.title || existing.title,
    abstract:
      (incoming.abstract || "").length > (existing.abstract || "").length
        ? incoming.abstract
        : existing.abstract,
    authors: toUniqueList([...(existing.authors || []), ...(incoming.authors || [])]),
    tags: toUniqueList([...(existing.tags || []), ...(incoming.tags || [])]),
    paperTypes: toUniqueList([...(existing.paperTypes || []), ...(incoming.paperTypes || [])]),
    tasks: toUniqueList([...(existing.tasks || []), ...(incoming.tasks || [])]),
    datasets: toUniqueList([...(existing.datasets || []), ...(incoming.datasets || [])]),
    links: toUniqueList([...(existing.links || []), ...(incoming.links || [])]),
    citationCount: Math.max(existing.citationCount || 0, incoming.citationCount || 0),
    hasCode: Boolean(existing.hasCode || incoming.hasCode),
    codeUrl: incoming.codeUrl || existing.codeUrl || "",
    conference: incoming.conference || existing.conference,
    venue: incoming.venue || existing.venue,
    year: incoming.year || existing.year,
    source: existing.source === "OpenAlex" ? existing.source : incoming.source || existing.source,
  };
}

function candidateMergeKey(candidate) {
  const doiKey = lower(candidate?.doi || "");
  if (doiKey) return `doi:${doiKey}`;

  const idKey = normalizeWhitespace(candidate?.id || "");
  if (idKey) return `id:${idKey}`;

  const titleKey = lower(candidate?.title || "");
  const yearKey = Number.isFinite(candidate?.year) ? String(candidate.year) : "na";
  return `title:${titleKey}:${yearKey}`;
}

function mergeCandidateLists(primary = [], secondary = []) {
  const merged = new Map();

  for (const candidate of [...primary, ...secondary]) {
    const key = candidateMergeKey(candidate);
    if (!merged.has(key)) {
      merged.set(key, candidate);
      continue;
    }
    merged.set(key, mergePaperCandidate(merged.get(key), candidate));
  }

  return Array.from(merged.values());
}

function countMergedSources(candidates = []) {
  const stats = { openalex: 0, dblp: 0, arxiv: 0, cvf: 0, total: 0 };
  for (const candidate of candidates) {
    if (candidate?.source === "OpenAlex") stats.openalex += 1;
    if (candidate?.source === "DBLP") stats.dblp += 1;
    if (candidate?.source === "arXiv") stats.arxiv += 1;
    if (candidate?.source === "CVF Open Access") stats.cvf += 1;
  }
  stats.total = candidates.length;
  return stats;
}

function mergeSourceStats(primaryStats, secondaryStats, mergedCandidates) {
  const rawPrimary = primaryStats?.raw || {};
  const rawSecondary = secondaryStats?.raw || {};
  return {
    raw: {
      openalex: (rawPrimary.openalex || 0) + (rawSecondary.openalex || 0),
      dblp: (rawPrimary.dblp || 0) + (rawSecondary.dblp || 0),
      arxiv: (rawPrimary.arxiv || 0) + (rawSecondary.arxiv || 0),
      cvf: (rawPrimary.cvf || 0) + (rawSecondary.cvf || 0),
    },
    merged: countMergedSources(mergedCandidates),
  };
}

async function runRecommendationPipeline({ query, filters, modelOptions }) {
  const normalizedQuery = buildQueryFromInputs(query, filters, modelOptions);
  if (!normalizedQuery) {
    return {
      results: [],
      meta: {
        normalizedQuery: "",
        sourceQuery: "",
        queryNormalization: {
          originalQuery: "",
          correctedQuery: "",
          corrections: [],
          usedFuzzyCorrection: false,
        },
        retrieval: {
          candidateTarget: MIN_CANDIDATE_TARGET,
          initialCandidates: 0,
          finalCandidates: 0,
          usedBroadenedQuery: false,
          expansionTerms: [],
        },
        totalBeforeFilter: 0,
        totalAfterFilter: 0,
        dataSources: BASE_DATA_SOURCES,
        sourceStats: { raw: {}, merged: {} },
        model: { name: "sarveshu-hybrid-ranker-v3", diversity: modelOptions.diversity },
      },
    };
  }

  const queryNormalization = normalizeQueryTypos(normalizedQuery, [
    ...(filters.tags || []),
    ...(filters.tasks || []),
    ...(filters.datasets || []),
    ...(filters.paperTypes || []),
    ...(filters.venues || []),
    ...(modelOptions.keywords || []),
  ]);

  const rankingQuery = queryNormalization.correctedQuery || normalizedQuery;
  const { primarySourceQuery, broadenedSourceQuery, expansionTerms } = buildSourceQueries({
    normalizedQuery,
    rankingQuery,
    filters,
    modelOptions,
  });

  const candidateTarget = Math.max(MIN_CANDIDATE_TARGET, Math.min(60, filters.limit * 2));
  const primaryPayload = await gatherCandidates(primarySourceQuery, filters);
  let candidates = primaryPayload.candidates || [];
  let sourceStats = primaryPayload.sourceStats || { raw: {}, merged: {} };
  let usedBroadenedQuery = false;
  let sourceQuery = primarySourceQuery;

  if (
    candidates.length < candidateTarget &&
    broadenedSourceQuery &&
    broadenedSourceQuery !== primarySourceQuery
  ) {
    const broadenedPayload = await gatherCandidates(broadenedSourceQuery, filters);
    const mergedCandidates = mergeCandidateLists(candidates, broadenedPayload.candidates || []);
    if (mergedCandidates.length > candidates.length) {
      candidates = mergedCandidates;
      sourceStats = mergeSourceStats(
        primaryPayload.sourceStats,
        broadenedPayload.sourceStats,
        mergedCandidates
      );
      usedBroadenedQuery = true;
      sourceQuery = broadenedSourceQuery;
    }
  }

  const output = recommendPapers({
    query: rankingQuery,
    filters,
    candidates,
    sourceStats,
    model: modelOptions,
  });

  return {
    ...output,
    meta: {
      ...output.meta,
      sourceQuery,
      queryNormalization,
      retrieval: {
        candidateTarget,
        initialCandidates: primaryPayload.candidates?.length || 0,
        finalCandidates: candidates.length,
        usedBroadenedQuery,
        expansionTerms,
      },
    },
  };
}

async function searchPapersAcrossSources(query, filters) {
  const modelOptions = parseRecommendationModelOptions({});
  return runRecommendationPipeline({ query, filters, modelOptions });
}

async function recommendPapersAcrossSources(query, filters, queryParams) {
  const modelOptions = parseRecommendationModelOptions(queryParams || {});
  return runRecommendationPipeline({ query, filters, modelOptions });
}

module.exports = {
  searchPapersAcrossSources,
  recommendPapersAcrossSources,
};
