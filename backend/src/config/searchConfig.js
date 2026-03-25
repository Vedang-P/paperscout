const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_MIN_YEAR = 2021;
const DEFAULT_MAX_YEAR = CURRENT_YEAR;
const DEFAULT_MIN_CITATIONS = 0;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const DEFAULT_VENUES = ["ICLR", "ECCV", "ACCV"];
const SUPPORTED_VENUES = [
  "ICLR",
  "ECCV",
  "ACCV",
  "ICCV",
  "CVPR",
  "WACV",
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
};
