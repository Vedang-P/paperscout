const {
  CURRENT_YEAR,
  DEFAULT_LIMIT,
  DEFAULT_MAX_YEAR,
  DEFAULT_MIN_CITATIONS,
  DEFAULT_MIN_YEAR,
  DEFAULT_VENUES,
  MAX_LIMIT,
  SUPPORTED_PAPER_TYPES,
} = require("../config/searchConfig");
const { parseCsvParam, parseNumber, parseYear, toUniqueList } = require("../utils/text");
const MAX_FILTER_ITEMS = 25;
const MAX_FILTER_ITEM_LENGTH = 64;

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function normalizeType(value) {
  const type = String(value || "workshop").toLowerCase();
  if (type === "all") return "all";
  if (type === "journal") return "journal";
  if (type === "conference") return "conference";
  return "workshop";
}

function clampList(values, maxItems = MAX_FILTER_ITEMS) {
  return values
    .map((item) => String(item || "").trim().slice(0, MAX_FILTER_ITEM_LENGTH))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseSearchFilters(queryParams = {}) {
  const rawMinYear = parseYear(queryParams.minYear);
  const rawMaxYear = parseYear(queryParams.maxYear);
  const rawMinCitations = parseNumber(queryParams.minCitations, DEFAULT_MIN_CITATIONS);
  const rawMaxCitations = parseNumber(queryParams.maxCitations, null);
  const rawLimit = parseNumber(queryParams.limit, DEFAULT_LIMIT);

  const minYear = clamp(
    Number.isFinite(rawMinYear) ? rawMinYear : DEFAULT_MIN_YEAR,
    DEFAULT_MIN_YEAR,
    CURRENT_YEAR
  );
  const maxYear = clamp(
    Number.isFinite(rawMaxYear) ? rawMaxYear : DEFAULT_MAX_YEAR,
    minYear,
    CURRENT_YEAR
  );
  const minCitations = Math.max(0, Math.floor(rawMinCitations));
  const maxCitations =
    rawMaxCitations === null ? null : Math.max(minCitations, Math.floor(rawMaxCitations));
  const limit = clamp(Math.floor(rawLimit), 1, MAX_LIMIT);

  const venues = clampList(toUniqueList(parseCsvParam(queryParams.venues))).map((v) =>
    v.toUpperCase()
  );
  const tags = clampList(toUniqueList(parseCsvParam(queryParams.tags))).map((tag) =>
    tag.toLowerCase()
  );
  const paperTypesRaw = clampList(toUniqueList(parseCsvParam(queryParams.paperTypes))).map((value) =>
    String(value).toLowerCase()
  );
  const paperTypes = paperTypesRaw.filter((value) => SUPPORTED_PAPER_TYPES.includes(value));
  const tasks = clampList(toUniqueList(parseCsvParam(queryParams.tasks))).map((value) =>
    String(value).toLowerCase()
  );
  const datasets = clampList(toUniqueList(parseCsvParam(queryParams.datasets))).map((value) =>
    String(value).toLowerCase()
  );

  let hasCode = null;
  const hasCodeRaw = String(queryParams.hasCode ?? "").toLowerCase().trim();
  if (hasCodeRaw === "true" || hasCodeRaw === "1" || hasCodeRaw === "yes") hasCode = true;
  if (hasCodeRaw === "false" || hasCodeRaw === "0" || hasCodeRaw === "no") hasCode = false;

  return {
    minYear,
    maxYear,
    minCitations,
    maxCitations,
    type: normalizeType(queryParams.type),
    venues: venues.length > 0 ? venues : DEFAULT_VENUES,
    tags,
    paperTypes,
    tasks,
    datasets,
    hasCode,
    limit,
  };
}

function parseRecommendationModelOptions(queryParams = {}) {
  const diversity = parseNumber(queryParams.diversity, 0.25);
  return {
    diversity: clamp(Number.isFinite(diversity) ? diversity : 0.25, 0, 1),
    preferredAuthors: toUniqueList(parseCsvParam(queryParams.preferredAuthors)),
    excludeAuthors: toUniqueList(parseCsvParam(queryParams.excludeAuthors)),
    excludeTags: toUniqueList(parseCsvParam(queryParams.excludeTags)),
    seedTitles: toUniqueList(parseCsvParam(queryParams.seedTitles)),
    keywords: toUniqueList(parseCsvParam(queryParams.keywords)),
  };
}

module.exports = { parseSearchFilters, parseRecommendationModelOptions };
