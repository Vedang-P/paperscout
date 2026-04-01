const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_MIN_YEAR = 2021;
const DEFAULT_MAX_YEAR = CURRENT_YEAR;
const DEFAULT_MIN_CITATIONS = 0;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const DEFAULT_VENUES = [];
const SUPPORTED_VENUES = [
  "ICLR",
  "ECCV",
  "ACCV",
  "ICCV",
  "CVPR",
  "WACV",
  "NEURIPS",
  "ICML",
  "AAAI",
  "IJCAI",
  "WWW",
  "KDD",
  "ACL",
  "EMNLP",
  "NAACL",
  "COLING",
];

const SUGGESTED_TAGS = [
  "nlp",
  "cv",
  "multimodal",
  "environment",
  "climate imagery",
  "remote sensing",
  "medical imaging",
  "vision-language",
  "efficiency",
  "low-resource",
  "evaluation",
  "safety",
];

const SUPPORTED_PAPER_TYPES = [
  "workshop",
  "conference",
  "journal",
  "preprint",
  "survey",
  "demo",
  "dataset",
  "benchmark",
];

const SUGGESTED_TASKS = [
  "segmentation",
  "detection",
  "classification",
  "retrieval",
  "question answering",
  "generation",
  "llm",
  "vlm",
  "captioning",
  "translation",
];

const SUGGESTED_DATASETS = [
  "imagenet",
  "coco",
  "cityscapes",
  "ade20k",
  "mmlu",
  "squad",
  "librispeech",
  "wikitext",
  "kitti",
  "nuscenes",
];

module.exports = {
  CURRENT_YEAR,
  DEFAULT_MIN_YEAR,
  DEFAULT_MAX_YEAR,
  DEFAULT_MIN_CITATIONS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  DEFAULT_VENUES,
  SUPPORTED_VENUES,
  SUGGESTED_TAGS,
  SUPPORTED_PAPER_TYPES,
  SUGGESTED_TASKS,
  SUGGESTED_DATASETS,
};
