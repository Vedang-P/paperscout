const { gatherCandidates } = require("./candidateAggregator");
const { normalizeQueryTypos } = require("./fuzzyQuery");
const { recommendPapers } = require("./recommendationModel");
const { parseRecommendationModelOptions } = require("./filterParser");
const { normalizeWhitespace } = require("../utils/text");

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
        totalBeforeFilter: 0,
        totalAfterFilter: 0,
        dataSources: ["OpenAlex", "DBLP", "CVF Open Access"],
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
  const sourceQuery = queryNormalization.usedFuzzyCorrection
    ? normalizeWhitespace(`${normalizedQuery} ${rankingQuery}`)
    : rankingQuery;

  const { candidates, sourceStats } = await gatherCandidates(sourceQuery, filters);
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
