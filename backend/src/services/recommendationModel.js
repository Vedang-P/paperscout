const {
  CURRENT_YEAR,
  SUGGESTED_TAGS,
  SUPPORTED_VENUES,
  SUPPORTED_PAPER_TYPES,
  SUGGESTED_TASKS,
  SUGGESTED_DATASETS,
} = require("../config/searchConfig");
const { buildIdfMaps, buildTfIdfVector, cosineSimilarity, tokenCoverageScore } = require("./vectorSpace");
const { lower, normalizeWhitespace, parseCsvParam, tokenize } = require("../utils/text");

const SOURCE_RELIABILITY = {
  OpenAlex: 1,
  arXiv: 0.84,
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

function applyHardFilters(candidates, query, filters, profile, options = {}) {
  const tagMatchMode = options.tagMatchMode || "all";
  return candidates.filter((paper) => {
    if (!paper.title || !paper.year) return false;
    if (paper.year < filters.minYear || paper.year > filters.maxYear) return false;

    const citationCount = Number.isFinite(paper.citationCount) ? paper.citationCount : 0;
    if (citationCount < filters.minCitations) return false;
    if (filters.maxCitations !== null && citationCount > filters.maxCitations) return false;

    const paperTypes = new Set((paper.paperTypes || []).map((type) => lower(type)));
    if (filters.type === "workshop" && !paperTypes.has("workshop")) return false;
    if (filters.type === "conference" && !paperTypes.has("conference")) return false;
    if (filters.type === "journal" && !paperTypes.has("journal")) return false;

    if (filters.venues.length > 0) {
      const conference = String(paper.conference || "").toUpperCase();
      if (!conference || !filters.venues.includes(conference)) return false;
    }

    if (filters.tags.length > 0) {
      const tags = (paper.tags || []).map((tag) => lower(tag));
      const hitCount = filters.tags.filter((tag) => tags.includes(lower(tag))).length;
      const matches =
        tagMatchMode === "any" ? hitCount > 0 : hitCount === filters.tags.length;
      if (!matches) return false;
    }

    if (filters.paperTypes.length > 0) {
      const hasType = filters.paperTypes.some((type) => paperTypes.has(lower(type)));
      if (!hasType) return false;
    }

    if (filters.tasks.length > 0) {
      const paperTasks = new Set((paper.tasks || []).map((task) => lower(task)));
      const hasTask = filters.tasks.some((task) => paperTasks.has(lower(task)));
      if (!hasTask) return false;
    }

    if (filters.datasets.length > 0) {
      const paperDatasets = new Set((paper.datasets || []).map((dataset) => lower(dataset)));
      const hasDataset = filters.datasets.some((dataset) =>
        paperDatasets.has(lower(dataset))
      );
      if (!hasDataset) return false;
    }

    if (filters.hasCode === true && !paper.hasCode) return false;
    if (filters.hasCode === false && paper.hasCode) return false;

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

    const paperTypes = new Set((paper.paperTypes || []).map((type) => lower(type)));
    const paperTypeHitCount = filters.paperTypes.filter((type) => paperTypes.has(lower(type))).length;
    const paperTypeScore =
      filters.paperTypes.length > 0
        ? paperTypeHitCount / filters.paperTypes.length
        : mean([
            paperTypes.has("workshop") ? 1 : 0,
            paperTypes.has("conference") ? 1 : 0,
            paperTypes.has("journal") ? 1 : 0,
          ]);

    const paperTasks = new Set((paper.tasks || []).map((task) => lower(task)));
    const taskHitCount = filters.tasks.filter((task) => paperTasks.has(lower(task))).length;
    const taskScore = filters.tasks.length > 0 ? taskHitCount / filters.tasks.length : 0;

    const paperDatasets = new Set((paper.datasets || []).map((dataset) => lower(dataset)));
    const datasetHitCount = filters.datasets.filter((dataset) =>
      paperDatasets.has(lower(dataset))
    ).length;
    const datasetScore =
      filters.datasets.length > 0 ? datasetHitCount / filters.datasets.length : 0;

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
    const codeScore = paper.hasCode ? 1 : 0;
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
      paperTypeScore * 0.03 +
      taskScore * 0.03 +
      datasetScore * 0.03 +
      venueScore * 0.07 +
      authorMatchScore * 0.05 +
      workshopScore * 0.03 +
      codeScore * 0.06 +
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
        paperTypeScore,
        taskScore,
        datasetScore,
        venueScore,
        authorMatchScore,
        workshopScore,
        codeScore,
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
  if (features.paperTypeScore > 0.6) reasons.push("paper type alignment");
  if (features.taskScore > 0.6) reasons.push("task-level match");
  if (features.datasetScore > 0.6) reasons.push("dataset-level match");
  if (features.venueScore > 0.75) reasons.push("high-priority venue");
  if (features.workshopScore > 0.9) reasons.push("workshop match");
  if (features.codeScore > 0.9) reasons.push("linked public implementation");
  if (reasons.length === 0) reasons.push("balanced relevance across ranking signals");
  return reasons.slice(0, 3);
}

function mergeById(basePapers, newPapers) {
  const map = new Map(basePapers.map((paper) => [paper.id, paper]));
  for (const paper of newPapers) {
    if (!map.has(paper.id)) {
      map.set(paper.id, paper);
    }
  }
  return Array.from(map.values());
}

function markNewFallbackIds(existing, merged, fallbackIds) {
  const existingIds = new Set(existing.map((paper) => paper.id));
  for (const paper of merged) {
    if (!existingIds.has(paper.id)) fallbackIds.add(paper.id);
  }
}

function recommendPapers({ query, filters, candidates, sourceStats, model }) {
  const profile = buildProfile({ query, filters, model });
  let filteredCandidates = applyHardFilters(candidates, query, filters, profile);
  const fallbackIds = new Set();
  const fallbackSteps = [];
  const lowResultThreshold = Math.max(10, Math.floor(filters.limit * 0.4));

  if (filteredCandidates.length === 0 && filters.tags.length > 0) {
    const relaxedByTagMode = applyHardFilters(
      candidates,
      query,
      filters,
      profile,
      { tagMatchMode: "any" }
    );
    if (relaxedByTagMode.length > 0) {
      filteredCandidates = relaxedByTagMode;
      fallbackSteps.push("tag_match_relaxed_to_any");
    }
  }

  if (filters.type !== "all" && filteredCandidates.length < Math.max(4, Math.floor(filters.limit * 0.35))) {
    const relaxedType = { ...filters, type: "all" };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedType, profile);
    const merged = mergeById(filteredCandidates, relaxedCandidates);
    markNewFallbackIds(filteredCandidates, merged, fallbackIds);
    if (merged.length > filteredCandidates.length) {
      fallbackSteps.push("type_relaxed_to_all");
      filteredCandidates = merged;
    }
  }

  if (filters.venues.length > 0 && filteredCandidates.length < lowResultThreshold) {
    const relaxedVenueFilter = { ...filters, venues: [], type: "all" };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedVenueFilter, profile);
    const merged = mergeById(filteredCandidates, relaxedCandidates);
    markNewFallbackIds(filteredCandidates, merged, fallbackIds);
    if (merged.length > filteredCandidates.length) {
      fallbackSteps.push("venue_filter_relaxed");
      filteredCandidates = merged;
    }
  }

  if (filteredCandidates.length === 0 && filters.hasCode === true) {
    const relaxedCode = { ...filters, hasCode: null };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedCode, profile);
    if (relaxedCandidates.length > 0) {
      filteredCandidates = relaxedCandidates;
      fallbackSteps.push("code_filter_relaxed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
    }
  }

  if (filteredCandidates.length === 0 && filters.paperTypes.length > 0) {
    const relaxedPaperTypes = { ...filters, paperTypes: [] };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedPaperTypes, profile);
    if (relaxedCandidates.length > 0) {
      filteredCandidates = relaxedCandidates;
      fallbackSteps.push("paper_types_relaxed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
    }
  }

  if (filteredCandidates.length === 0 && filters.tasks.length > 0) {
    const relaxedTasks = { ...filters, tasks: [] };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedTasks, profile);
    if (relaxedCandidates.length > 0) {
      filteredCandidates = relaxedCandidates;
      fallbackSteps.push("tasks_relaxed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
    }
  }

  if (filteredCandidates.length === 0 && filters.datasets.length > 0) {
    const relaxedDatasets = { ...filters, datasets: [] };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedDatasets, profile);
    if (relaxedCandidates.length > 0) {
      filteredCandidates = relaxedCandidates;
      fallbackSteps.push("datasets_relaxed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
    }
  }

  if (filteredCandidates.length === 0 && filters.tags.length > 0) {
    const relaxedTags = { ...filters, tags: [] };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedTags, profile);
    if (relaxedCandidates.length > 0) {
      filteredCandidates = relaxedCandidates;
      fallbackSteps.push("tags_removed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
    }
  }

  if (filteredCandidates.length === 0 && filters.venues.length > 0) {
    const widenedVenues = { ...filters, venues: [], type: "all", tags: [] };
    const widenedCandidates = applyHardFilters(candidates, query, widenedVenues, profile);
    if (widenedCandidates.length > 0) {
      filteredCandidates = widenedCandidates;
      fallbackSteps.push("venue_filter_removed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
    }
  }

  if (filteredCandidates.length === 0 && filters.minCitations > 0) {
    const relaxedCitations = {
      ...filters,
      minCitations: 0,
      type: "all",
      venues: SUPPORTED_VENUES,
      tags: [],
    };
    const relaxedCandidates = applyHardFilters(candidates, query, relaxedCitations, profile);
    if (relaxedCandidates.length > 0) {
      filteredCandidates = relaxedCandidates;
      fallbackSteps.push("min_citations_relaxed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
    }
  }

  if (filteredCandidates.length === 0 && candidates.length > 0) {
    const fullyRelaxed = {
      ...filters,
      minCitations: 0,
      maxCitations: null,
      type: "all",
      venues: SUPPORTED_VENUES,
      tags: [],
      paperTypes: [],
      tasks: [],
      datasets: [],
      hasCode: null,
    };
    const relaxedCandidates = applyHardFilters(candidates, query, fullyRelaxed, profile);
    if (relaxedCandidates.length > 0) {
      filteredCandidates = relaxedCandidates;
      fallbackSteps.push("all_strict_filters_relaxed");
      for (const paper of filteredCandidates) fallbackIds.add(paper.id);
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
        name: "sarveshu-hybrid-ranker-v3",
        diversity: model.diversity,
      },
      fallback: {
        workshopFallbackUsed: fallbackIds.size > 0,
        fallbackCount: fallbackIds.size,
        steps: fallbackSteps,
      },
      availableFilters: {
        paperTypes: SUPPORTED_PAPER_TYPES,
        tasks: SUGGESTED_TASKS,
        datasets: SUGGESTED_DATASETS,
      },
      suggestedTags: SUGGESTED_TAGS,
    },
  };
}

const SOURCE_NAME = {
  openalex: "OpenAlex",
  dblp: "DBLP",
  arxiv: "arXiv",
  cvf: "CVF Open Access",
};

module.exports = { recommendPapers };
