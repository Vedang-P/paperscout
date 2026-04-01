const {
  SUGGESTED_DATASETS,
  SUGGESTED_TAGS,
  SUGGESTED_TASKS,
  SUPPORTED_PAPER_TYPES,
  SUPPORTED_VENUES,
} = require("../config/searchConfig");
const { boundedLevenshtein, normalizeWhitespace, tokenize } = require("../utils/text");

const CORE_QUERY_TERMS = [
  "paper",
  "papers",
  "workshop",
  "conference",
  "journal",
  "dataset",
  "benchmark",
  "transformer",
  "diffusion",
  "attention",
  "vision",
  "language",
  "multimodal",
  "image",
  "text",
  "retrieval",
  "segmentation",
  "classification",
  "detection",
  "generation",
  "captioning",
  "translation",
];

function toTokenVocabulary(items) {
  const tokens = new Set();
  for (const item of items) {
    const normalizedTokens = tokenize(item);
    for (const token of normalizedTokens) {
      if (token.length >= 3) {
        tokens.add(token);
      }

      const splitTokens = token.split(/[+.-]+/g).filter(Boolean);
      for (const splitToken of splitTokens) {
        if (splitToken.length >= 3) {
          tokens.add(splitToken);
        }
      }
    }
  }
  return tokens;
}

function maxCorrectionDistance(token) {
  const length = String(token || "").length;
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 2;
}

function shouldTryCorrection(token, vocabularySet) {
  if (!token || token.length < 4) return false;
  if (/\d/.test(token)) return false;
  if (vocabularySet.has(token)) return false;
  return true;
}

function findBestTokenCorrection(token, vocabularySet) {
  if (!shouldTryCorrection(token, vocabularySet)) return null;

  const maxDistance = maxCorrectionDistance(token);
  let bestCandidate = null;
  let bestDistance = maxDistance + 1;

  for (const candidate of vocabularySet) {
    if (Math.abs(candidate.length - token.length) > maxDistance) continue;
    if (candidate[0] !== token[0] && token.length >= 5) continue;

    const distance = boundedLevenshtein(token, candidate, maxDistance);
    if (distance > maxDistance) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
      continue;
    }
    if (distance === bestDistance && bestCandidate && candidate.length < bestCandidate.length) {
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) return null;
  if (bestDistance / Math.max(1, token.length) > 0.35) return null;

  return { token: bestCandidate, distance: bestDistance };
}

function buildVocabulary(extraTerms = []) {
  return toTokenVocabulary([
    ...SUPPORTED_VENUES,
    ...SUPPORTED_PAPER_TYPES,
    ...SUGGESTED_TAGS,
    ...SUGGESTED_TASKS,
    ...SUGGESTED_DATASETS,
    ...CORE_QUERY_TERMS,
    ...(Array.isArray(extraTerms) ? extraTerms : []),
  ]);
}

function normalizeQueryTypos(query, extraTerms = []) {
  const originalQuery = normalizeWhitespace(query);
  const tokens = tokenize(originalQuery);
  if (tokens.length === 0) {
    return {
      originalQuery,
      correctedQuery: originalQuery,
      corrections: [],
      usedFuzzyCorrection: false,
    };
  }

  const vocabulary = buildVocabulary(extraTerms);
  const corrections = [];
  const correctedTokens = tokens.map((token) => {
    const best = findBestTokenCorrection(token, vocabulary);
    if (!best || best.token === token) return token;
    corrections.push({ from: token, to: best.token, distance: best.distance });
    return best.token;
  });

  const correctedQuery = normalizeWhitespace(correctedTokens.join(" "));

  return {
    originalQuery,
    correctedQuery,
    corrections,
    usedFuzzyCorrection: correctedQuery !== originalQuery && corrections.length > 0,
  };
}

module.exports = { normalizeQueryTypos };
