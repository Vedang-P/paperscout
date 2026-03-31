const { CURRENT_YEAR, SUGGESTED_TAGS } = require("../config/searchConfig");
const { buildIdfMaps, buildTfIdfVector, cosineSimilarity, tokenCoverageScore } = require("./vectorSpace");
const { lower, normalizeWhitespace, parseCsvParam, tokenize } = require("../utils/text");

const SOURCE_RELIABILITY = {
  OpenAlex: 1,
  "CVF Open Access": 0.92,
  DBLP: 0.86,
};

const VENUE_PRIOR = {
  ICLR: 1,
  ECCV: 0.97,
  ACCV: 0.9,
  ICCV: 0.88,
  CVPR: 0.9,
  ACL: 0.84,
  EMNLP: 0.84,
  NAACL: 0.82,
  COLING: 0.8,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function splitAuthors(value) {
  return parseCsvParam(value).map((author) => lower(author));
}

function makePaperText(paper) {
  return normalizeWhitespace(
    `${paper.title || ""} ${paper.abstract || ""} ${(paper.authors || []).join(" ")} ${paper.venue || ""} ${(paper.tags || []).join(" ")}`
  );
}

function buildProfile({ query, filters, model }) {
  const seedTitles = parseCsvParam(model.seedTitles);
  const preferredAuthors = splitAuthors(model.preferredAuthors);
  const dislikedAuthors = splitAuthors(model.excludeAuthors);
  const extraKeywords = parseCsvParam(model.keywords);
  const excludeTags = parseCsvParam(model.excludeTags).map((tag) => lower(tag));

  const profileText = [
    query,
    ...filters.tags,
    ...seedTitles,
    ...extraKeywords,
    ...preferredAuthors,
  ]
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .join(" ");

  return {
    text: profileText,
    preferredAuthors,
    dislikedAuthors,
    seedTitles,
    excludeTags,
  };
}

function applyHardFilters(candidates, query, filters, profile) {
  return candidates.filter((paper) => {
    if (!paper.title || !paper.year) return false;
    if (paper.year < filters.minYear || paper.year > filters.maxYear) return false;

    const citationCount = Number.isFinite(paper.citationCount) ? paper.citationCount : 0;
    if (citationCount < filters.minCitations) return false;
    if (filters.maxCitations !== null && citationCount > filters.maxCitations) return false;

    if (filters.type === "workshop" && !paper.isWorkshop) return false;
    if (filters.type === "conference" && paper.isWorkshop) return false;

    if (filters.venues.length > 0) {
      const conference = String(paper.conference || "").toUpperCase();
      if (!conference || !filters.venues.includes(conference)) return false;
    }

    if (filters.tags.length > 0) {
      const tags = (paper.tags || []).map((tag) => lower(tag));
      const hasAll = filters.tags.every((tag) => tags.includes(lower(tag)));
      if (!hasAll) return false;
    }

    if (profile.excludeTags.length > 0) {
      const tagSet = new Set((paper.tags || []).map((tag) => lower(tag)));
      for (const tag of profile.excludeTags) {
        if (tagSet.has(tag)) return false;
      }
    }

    if (profile.dislikedAuthors.length > 0) {
      const authorText = lower((paper.authors || []).join(" "));
      if (profile.dislikedAuthors.some((author) => authorText.includes(author))) {
        return false;
      }
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length > 0) {
      const overlap = tokenCoverageScore(makePaperText(paper), queryTokens);
      if (overlap <= 0) return false;
    }

    return true;
  });
}

function computeFeatureBounds(candidates) {
  const citationValues = candidates.map((paper) => Math.log1p(paper.citationCount || 0));
  const citationVelocityValues = candidates.map((paper) => {
    const age = Math.max(1, CURRENT_YEAR - (paper.year || CURRENT_YEAR) + 1);
    return (paper.citationCount || 0) / age;
  });
  return {
    maxCitationLog: Math.max(...citationValues, 1),
    maxCitationVelocity: Math.max(...citationVelocityValues, 1),
    minYear: Math.min(...candidates.map((paper) => paper.year || CURRENT_YEAR), CURRENT_YEAR),
  };
}

function rankCandidates(filteredCandidates, query, filters, model, fallbackIds = new Set()) {
  if (!filteredCandidates.length) return [];

  const profile = buildProfile({ query, filters, model });
  const corpusTexts = filteredCandidates.map(makePaperText);
  const idf = buildIdfMaps([...corpusTexts, profile.text]);
  const profileVector = buildTfIdfVector(profile.text, idf);
  const queryTokens = tokenize(query);
  const bounds = computeFeatureBounds(filteredCandidates);

  const scored = filteredCandidates.map((paper) => {
    const paperText = makePaperText(paper);
    const vector = buildTfIdfVector(paperText, idf);
    const semanticScore = cosineSimilarity(profileVector, vector);
    const lexicalScore = tokenCoverageScore(paperText, queryTokens);
    const citationScore = Math.log1p(paper.citationCount || 0) / bounds.maxCitationLog;
    const age = Math.max(1, CURRENT_YEAR - (paper.year || CURRENT_YEAR) + 1);
    const citationVelocity = ((paper.citationCount || 0) / age) / bounds.maxCitationVelocity;
    const recencyScore = clamp(
      ((paper.year || filters.minYear) - bounds.minYear) / Math.max(1, filters.maxYear - bounds.minYear),
      0,
      1
    );

    const paperTags = new Set((paper.tags || []).map((tag) => lower(tag)));
    const tagHitCount = filters.tags.filter((tag) => paperTags.has(lower(tag))).length;
    const tagScore = filters.tags.length > 0 ? tagHitCount / filters.tags.length : mean([
      paperTags.has("cv") ? 1 : 0,
      paperTags.has("nlp") ? 1 : 0,
      paperTags.has("multimodal") ? 1 : 0,
    ]);

    const conference = String(paper.conference || "").toUpperCase();
    const venueBase = VENUE_PRIOR[conference] || 0.55;
    const venuePreferenceBoost = filters.venues.includes(conference) ? 0.12 : 0;
    const venueScore = clamp(venueBase + venuePreferenceBoost, 0, 1);

    const authorsText = lower((paper.authors || []).join(" "));
    const authorMatchScore =
      profile.preferredAuthors.length > 0 &&
      profile.preferredAuthors.some((author) => authorsText.includes(author))
        ? 1
        : 0;

    const workshopScore = paper.isWorkshop ? 1 : 0.1;
    const metadataScore = mean([
      paper.abstract ? 1 : 0.15,
      paper.pdfUrl ? 1 : 0.25,
      paper.doi ? 1 : 0.3,
    ]);
    const sourceScore = SOURCE_RELIABILITY[paper.source] || 0.6;

    const fallbackPenalty = fallbackIds.has(paper.id) ? 0.08 : 0;

    const weightedScore =
      semanticScore * 0.29 +
      lexicalScore * 0.12 +
      citationScore * 0.14 +
      citationVelocity * 0.08 +
      recencyScore * 0.07 +
      tagScore * 0.1 +
      venueScore * 0.07 +
      authorMatchScore * 0.05 +
      workshopScore * 0.03 +
      metadataScore * 0.03 +
      sourceScore * 0.02 -
      fallbackPenalty;

    return {
      paper,
      score: weightedScore,
      vector,
      features: {
        semanticScore,
        lexicalScore,
        citationScore,
        citationVelocity,
        recencyScore,
        tagScore,
        venueScore,
        authorMatchScore,
        workshopScore,
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function rerankWithMMR(scored, limit, diversity) {
  if (!scored.length) return [];
  const selected = [];
  const available = [...scored];
  const lambda = clamp(1 - diversity, 0.35, 0.9);

  while (selected.length < limit && available.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < available.length; index += 1) {
      const candidate = available[index];
      const maxSimilarity = selected.length
        ? Math.max(...selected.map((picked) => cosineSimilarity(candidate.vector, picked.vector)))
        : 0;
      const mmrScore = lambda * candidate.score - (1 - lambda) * maxSimilarity;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = index;
      }
    }

    selected.push(available.splice(bestIndex, 1)[0]);
  }

  return selected;
}

function makeReasoningSummary(features) {
  const reasons = [];
  if (features.semanticScore > 0.3) reasons.push("high semantic relevance");
  if (features.lexicalScore > 0.5) reasons.push("strong query keyword overlap");
  if (features.citationScore > 0.5) reasons.push("strong citation profile");
  if (features.citationVelocity > 0.4) reasons.push("high citation velocity");
  if (features.tagScore > 0.4) reasons.push("good tag alignment");
  if (features.venueScore > 0.75) reasons.push("high-priority venue");
  if (features.workshopScore > 0.9) reasons.push("workshop match");
  if (reasons.length === 0) reasons.push("balanced relevance across ranking signals");
  return reasons.slice(0, 3);
}

function recommendPapers({ query, filters, candidates, sourceStats, model }) {
  const profile = buildProfile({ query, filters, model });
  let filteredCandidates = applyHardFilters(candidates, query, filters, profile);
  const fallbackIds = new Set();

  if (filters.type === "workshop" && filteredCandidates.length < Math.max(4, Math.floor(filters.limit * 0.35))) {
    const relaxedFilters = { ...filters, type: "all" };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedFilters, profile);
    const strictIds = new Set(filteredCandidates.map((paper) => paper.id));
    for (const paper of relaxedCandidates) {
      if (strictIds.has(paper.id)) continue;
      fallbackIds.add(paper.id);
      filteredCandidates.push(paper);
    }
  }

  const ranked = rankCandidates(filteredCandidates, query, filters, model, fallbackIds);
  const reranked = rerankWithMMR(ranked, filters.limit, model.diversity);

  const results = reranked.map((item, index) => ({
    ...item.paper,
    rank: index + 1,
    recommendation: {
      score: Number(item.score.toFixed(5)),
      reasons: makeReasoningSummary(item.features),
      features: Object.fromEntries(
        Object.entries(item.features).map(([key, value]) => [key, Number(value.toFixed(4))])
      ),
    },
  }));

  return {
    results,
    meta: {
      normalizedQuery: normalizeWhitespace(query),
      totalBeforeFilter: candidates.length,
      totalAfterFilter: filteredCandidates.length,
      dataSources: Object.values(SOURCE_NAME),
      sourceStats,
      model: {
        name: "paperscout-hybrid-ranker-v2",
        diversity: model.diversity,
      },
      fallback: {
        workshopFallbackUsed: fallbackIds.size > 0,
        fallbackCount: fallbackIds.size,
      },
      suggestedTags: SUGGESTED_TAGS,
    },
  };
}

const SOURCE_NAME = {
  openalex: "OpenAlex",
  dblp: "DBLP",
  cvf: "CVF Open Access",
};

module.exports = { recommendPapers };
