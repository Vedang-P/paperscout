const { tokenize } = require("../utils/text");

function buildTermFrequency(text) {
  const tf = new Map();
  for (const token of tokenize(text)) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

function buildIdfMaps(documents) {
  const docCount = Math.max(documents.length, 1);
  const df = new Map();

  for (const document of documents) {
    const seen = new Set(tokenize(document));
    for (const token of seen) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  const idf = new Map();
  for (const [token, count] of df.entries()) {
    idf.set(token, Math.log(1 + docCount / (1 + count)));
  }
  return idf;
}

function buildTfIdfVector(text, idf) {
  const tf = buildTermFrequency(text);
  const vector = new Map();
  let normSquared = 0;

  for (const [token, count] of tf.entries()) {
    const weight = count * (idf.get(token) || 0);
    if (weight <= 0) continue;
    vector.set(token, weight);
    normSquared += weight * weight;
  }

  return {
    values: vector,
    norm: Math.sqrt(normSquared),
  };
}

function cosineSimilarity(left, right) {
  if (!left || !right || left.norm === 0 || right.norm === 0) return 0;
  const [small, large] =
    left.values.size <= right.values.size ? [left.values, right.values] : [right.values, left.values];

  let dot = 0;
  for (const [token, value] of small.entries()) {
    dot += value * (large.get(token) || 0);
  }

  return dot / (left.norm * right.norm);
}

function tokenCoverageScore(targetText, queryTokens) {
  if (!queryTokens || queryTokens.length === 0) return 0;
  const haystackTokens = new Set(tokenize(targetText));
  let hit = 0;
  for (const token of queryTokens) {
    if (haystackTokens.has(token)) hit += 1;
  }
  return hit / queryTokens.length;
}

module.exports = {
  buildIdfMaps,
  buildTfIdfVector,
  cosineSimilarity,
  tokenCoverageScore,
};
