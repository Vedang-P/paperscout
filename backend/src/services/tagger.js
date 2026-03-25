const { toUniqueList } = require("../utils/text");

const TAG_PATTERNS = [
  { tag: "nlp", patterns: ["nlp", "language model", "text", "token", "transformer", "bert"] },
  { tag: "cv", patterns: ["computer vision", "vision", "image", "segmentation", "detection"] },
  { tag: "multimodal", patterns: ["multimodal", "vision-language", "cross-modal", "vlm"] },
  { tag: "environment", patterns: ["environment", "ecology", "sustainability"] },
  { tag: "climate imagery", patterns: ["climate", "weather", "satellite", "earth observation"] },
  { tag: "remote sensing", patterns: ["remote sensing", "geospatial", "satellite imagery"] },
  { tag: "medical imaging", patterns: ["medical", "radiology", "ct", "mri", "x-ray"] },
  { tag: "vision-language", patterns: ["vision language", "vision-language", "vqa", "captioning"] },
  { tag: "efficiency", patterns: ["efficient", "compression", "quantization", "distillation"] },
  { tag: "low-resource", patterns: ["low-resource", "few-shot", "zero-shot"] },
  { tag: "evaluation", patterns: ["benchmark", "evaluation", "metric"] },
  { tag: "safety", patterns: ["safety", "robust", "adversarial", "bias"] },
];

function inferTags({ title, abstract, venue, userTags = [] }) {
  const text = `${title || ""} ${abstract || ""} ${venue || ""}`.toLowerCase();
  const inferred = [];

  for (const rule of TAG_PATTERNS) {
    if (rule.patterns.some((pattern) => text.includes(pattern))) {
      inferred.push(rule.tag);
    }
  }

  return toUniqueList([...inferred, ...(userTags || []).map((tag) => String(tag).toLowerCase())]);
}

module.exports = { inferTags };
