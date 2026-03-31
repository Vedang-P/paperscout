const { gatherCandidates } = require("./candidateAggregator");
const { recommendPapers } = require("./recommendationModel");
const { parseRecommendationModelOptions } = require("./filterParser");
const { normalizeWhitespace } = require("../utils/text");

function buildQueryFromInputs(query, filters, modelOptions) {
  const explicitQuery = normalizeWhitespace(query);
  if (explicitQuery) return explicitQuery;

  const fallback = [
    ...(filters.tags || []),
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
        totalBeforeFilter: 0,
        totalAfterFilter: 0,
        dataSources: ["OpenAlex", "DBLP", "CVF Open Access"],
        sourceStats: { raw: {}, merged: {} },
        model: { name: "paperscout-hybrid-ranker-v2", diversity: modelOptions.diversity },
      },
    };
  }

  const { candidates, sourceStats } = await gatherCandidates(normalizedQuery, filters);
  return recommendPapers({
    query: normalizedQuery,
    filters,
    candidates,
    sourceStats,
    model: modelOptions,
  });
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
