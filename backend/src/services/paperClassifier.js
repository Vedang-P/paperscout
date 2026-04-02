const { SUGGESTED_DATASETS, SUGGESTED_TASKS, SUPPORTED_PAPER_TYPES } = require("../config/searchConfig");
const {
  inferWorkshopFlag,
  lower,
  normalizeTextContent,
  toUniqueList,
} = require("../utils/text");

const EXTRA_TASK_PATTERNS = {
  segmentation: ["segmentation", "segment anything"],
  detection: ["detection", "detector", "object detection"],
  classification: ["classification", "classifier"],
  retrieval: ["retrieval", "ranking"],
  "question answering": ["question answering", "vqa", "qa"],
  generation: ["generation", "generative", "diffusion"],
  llm: ["llm", "large language model", "gpt", "instruction tuning"],
  vlm: ["vlm", "vision-language model", "vision language model"],
  captioning: ["caption", "image caption"],
  translation: ["translation", "machine translation"],
};

const EXTRA_DATASET_PATTERNS = {
  imagenet: ["imagenet"],
  coco: ["coco", "ms coco"],
  cityscapes: ["cityscapes"],
  ade20k: ["ade20k"],
  mmlu: ["mmlu"],
  squad: ["squad"],
  librispeech: ["librispeech"],
  wikitext: ["wikitext"],
  kitti: ["kitti"],
  nuscenes: ["nuscenes", "nu scenes"],
};

function detectCodeLink(links = []) {
  for (const link of links) {
    const normalized = lower(link);
    if (normalized.includes("github.com") || normalized.includes("gitlab.com")) {
      return link;
    }
  }
  return null;
}

function inferPaperTypes(paper) {
  const text = lower(`${paper.title || ""} ${paper.venue || ""} ${paper.source || ""}`);
  const sourceVenueType = lower(paper.sourceVenueType || "");
  const types = new Set();
  const isJournal =
    sourceVenueType.includes("journal") ||
    text.includes("journal") ||
    text.includes("transactions") ||
    text.includes("j.") ||
    text.includes("vol.");
  const isConferenceVenueType =
    sourceVenueType.includes("conference") ||
    sourceVenueType.includes("proceedings");
  const looksLikePreprint =
    sourceVenueType.includes("repository") ||
    text.includes("arxiv") ||
    text.includes("preprint");
  const isWorkshop = paper.isWorkshop || inferWorkshopFlag(text);

  if (isWorkshop) {
    types.add("workshop");
  } else if (isJournal) {
    types.add("journal");
  } else if (isConferenceVenueType) {
    types.add("conference");
  } else if (looksLikePreprint) {
    types.add("preprint");
  } else {
    types.add("conference");
  }

  if (looksLikePreprint) {
    types.add("preprint");
  }
  if (!isWorkshop && !isJournal && paper.conference) {
    types.add("conference");
  }
  if (text.includes("survey") || text.includes("review")) {
    types.add("survey");
  }
  if (text.includes("demo") || text.includes("demonstration")) {
    types.add("demo");
  }
  if (text.includes("dataset") || text.includes("data set")) {
    types.add("dataset");
  }
  if (text.includes("benchmark") || text.includes("leaderboard")) {
    types.add("benchmark");
  }

  return Array.from(types).filter((type) => SUPPORTED_PAPER_TYPES.includes(type));
}

function inferTasksAndDatasets(paper) {
  const text = lower(`${paper.title || ""} ${paper.abstract || ""} ${paper.venue || ""}`);
  const tasks = [];
  const datasets = [];

  for (const task of SUGGESTED_TASKS) {
    const patterns = EXTRA_TASK_PATTERNS[task] || [task];
    if (patterns.some((pattern) => text.includes(lower(pattern)))) {
      tasks.push(task);
    }
  }

  for (const dataset of SUGGESTED_DATASETS) {
    const patterns = EXTRA_DATASET_PATTERNS[dataset] || [dataset];
    if (patterns.some((pattern) => text.includes(lower(pattern)))) {
      datasets.push(dataset);
    }
  }

  return {
    tasks: toUniqueList(tasks),
    datasets: toUniqueList(datasets),
  };
}

function classifyPaper(paper) {
  const links = toUniqueList([paper.url, paper.pdfUrl, ...(paper.links || [])].filter(Boolean));
  const codeUrl = detectCodeLink(links);
  const { tasks, datasets } = inferTasksAndDatasets(paper);
  const paperTypes = inferPaperTypes(paper);

  return {
    ...paper,
    title: normalizeTextContent(paper.title),
    abstract: normalizeTextContent(paper.abstract),
    venue: normalizeTextContent(paper.venue),
    links,
    hasCode: Boolean(codeUrl),
    codeUrl,
    paperTypes,
    tasks,
    datasets,
  };
}

module.exports = { classifyPaper };
