function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function lower(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function parseCsvParam(value) {
  const raw = toArray(value)
    .flatMap((item) => String(item || "").split(","))
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function tokenize(value) {
  return lower(value)
    .split(/[^a-z0-9+.-]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function boundedLevenshtein(left, right, maxDistance = 2) {
  const a = String(left || "");
  const b = String(right || "");
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = new Array(b.length + 1);
  let current = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
      if (current[j] < rowMin) rowMin = current[j];
    }

    if (rowMin > maxDistance) return maxDistance + 1;

    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

function maxTypoDistance(token) {
  const size = String(token || "").length;
  if (size <= 4) return 1;
  if (size <= 7) return 2;
  return 2;
}

function fuzzyTokenMatch(queryToken, candidateToken) {
  const q = String(queryToken || "").toLowerCase();
  const c = String(candidateToken || "").toLowerCase();
  if (!q || !c) return false;
  if (q === c) return true;
  if (q.length < 3 || c.length < 3) return false;
  if (Math.abs(q.length - c.length) > 2) return false;
  if (q[0] !== c[0] && Math.min(q.length, c.length) >= 5) return false;

  const maxDistance = Math.min(maxTypoDistance(q), maxTypoDistance(c));
  return boundedLevenshtein(q, c, maxDistance) <= maxDistance;
}

function hasFuzzyTokenMatch(token, candidateTokens = []) {
  const normalizedToken = String(token || "").toLowerCase();
  if (!normalizedToken) return false;
  for (const candidate of candidateTokens) {
    const normalizedCandidate = String(candidate || "").toLowerCase();
    if (!normalizedCandidate) continue;
    if (fuzzyTokenMatch(normalizedToken, normalizedCandidate)) return true;

    const subTokens = normalizedCandidate.split(/[+.-]+/g).filter(Boolean);
    for (const subToken of subTokens) {
      if (fuzzyTokenMatch(normalizedToken, subToken)) return true;
    }
  }
  return false;
}

function includesQuery(haystack, query) {
  const h = lower(haystack);
  const q = lower(query);
  if (!q.length) return false;
  if (h.includes(q)) return true;
  const tokens = tokenize(q);
  if (tokens.length === 0) return false;
  const haystackTokens = tokenize(h);
  return tokens.every(
    (token) => h.includes(token) || hasFuzzyTokenMatch(token, haystackTokens)
  );
}

function makeAbsoluteUrl(baseUrl, maybeRelativeUrl) {
  if (!maybeRelativeUrl) return null;
  try {
    return new URL(maybeRelativeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseYear(value) {
  const year = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(year)) return null;
  return year;
}

function parseNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
}

function toUniqueList(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function inferConference(text) {
  const normalized = lower(text);

  if (
    normalized.includes("iclr") ||
    normalized.includes("international conference on learning representations")
  ) {
    return "ICLR";
  }

  if (
    normalized.includes("eccv") ||
    normalized.includes("european conference on computer vision")
  ) {
    return "ECCV";
  }

  if (
    normalized.includes("accv") ||
    normalized.includes("asian conference on computer vision")
  ) {
    return "ACCV";
  }

  if (
    normalized.includes("iccv") ||
    normalized.includes("international conference on computer vision")
  ) {
    return "ICCV";
  }

  if (
    normalized.includes("cvpr") ||
    normalized.includes("conference on computer vision and pattern recognition")
  ) {
    return "CVPR";
  }

  if (
    normalized.includes("wacv") ||
    normalized.includes("winter conference on applications of computer vision")
  ) {
    return "WACV";
  }

  if (
    normalized.includes("neurips") ||
    normalized.includes("nips") ||
    normalized.includes("neural information processing systems")
  ) {
    return "NEURIPS";
  }

  if (
    normalized.includes("icml") ||
    normalized.includes("international conference on machine learning")
  ) {
    return "ICML";
  }

  if (
    normalized.includes("aaai") ||
    normalized.includes("aaai conference on artificial intelligence")
  ) {
    return "AAAI";
  }

  if (
    normalized.includes("ijcai") ||
    normalized.includes("international joint conference on artificial intelligence")
  ) {
    return "IJCAI";
  }

  if (
    normalized.includes("www conference") ||
    normalized.includes("the web conference") ||
    normalized.includes("world wide web conference")
  ) {
    return "WWW";
  }

  if (
    normalized.includes("sigkdd") ||
    normalized.includes("kdd conference") ||
    normalized.includes("knowledge discovery and data mining")
  ) {
    return "KDD";
  }

  if (
    normalized.includes("emnlp") ||
    normalized.includes("conference on empirical methods in natural language processing")
  ) {
    return "EMNLP";
  }

  if (
    normalized.includes("naacl") ||
    normalized.includes("north american chapter of the association for computational linguistics")
  ) {
    return "NAACL";
  }

  if (
    normalized.includes(" acl ") ||
    normalized.startsWith("acl ") ||
    normalized.endsWith(" acl") ||
    normalized.includes("annual meeting of the association for computational linguistics") ||
    normalized.includes("association for computational linguistics annual meeting")
  ) {
    return "ACL";
  }

  if (
    normalized.includes("coling") ||
    normalized.includes("international conference on computational linguistics")
  ) {
    return "COLING";
  }

  return null;
}

function inferWorkshopFlag(text) {
  const normalized = lower(text);
  return (
    normalized.includes("workshop") ||
    normalized.includes("workshops") ||
    normalized.includes("ws ")
  );
}

function normalizeDoi(doiOrUrl) {
  const value = lower(doiOrUrl);
  if (!value) return null;
  return value.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
}

module.exports = {
  normalizeWhitespace,
  lower,
  toArray,
  parseCsvParam,
  tokenize,
  boundedLevenshtein,
  fuzzyTokenMatch,
  hasFuzzyTokenMatch,
  includesQuery,
  makeAbsoluteUrl,
  parseYear,
  parseNumber,
  toUniqueList,
  inferConference,
  inferWorkshopFlag,
  normalizeDoi,
};
