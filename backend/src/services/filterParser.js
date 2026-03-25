const {
  CURRENT_YEAR,
  DEFAULT_LIMIT,
  DEFAULT_MAX_YEAR,
  DEFAULT_MIN_CITATIONS,
  DEFAULT_MIN_YEAR,
  DEFAULT_VENUES,
  MAX_LIMIT,
} = require("../config/searchConfig");
const { parseCsvParam, parseNumber, parseYear, toUniqueList } = require("../utils/text");

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function normalizeType(value) {
  const type = String(value || "workshop").toLowerCase();
  if (type === "all") return "all";
  if (type === "conference") return "conference";
  return "workshop";
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

  const venues = toUniqueList(parseCsvParam(queryParams.venues)).map((v) => v.toUpperCase());
  const tags = toUniqueList(parseCsvParam(queryParams.tags)).map((tag) => tag.toLowerCase());

  return {
    minYear,
    maxYear,
    minCitations,
    maxCitations,
    type: normalizeType(queryParams.type),
    venues: venues.length > 0 ? venues : DEFAULT_VENUES,
    tags,
    limit,
  };
}

module.exports = { parseSearchFilters };
