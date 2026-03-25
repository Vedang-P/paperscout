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

function includesQuery(haystack, query) {
  const h = lower(haystack);
  const q = lower(query);
  if (!q.length) return false;
  if (h.includes(q)) return true;
  const tokens = tokenize(q);
  if (tokens.length === 0) return false;
  return tokens.every((token) => h.includes(token));
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
  if (normalized.includes("iclr")) return "ICLR";
  if (normalized.includes("eccv")) return "ECCV";
  if (normalized.includes("accv")) return "ACCV";
  if (normalized.includes("iccv")) return "ICCV";
  if (normalized.includes("cvpr")) return "CVPR";
  if (normalized.includes("wacv")) return "WACV";
  if (normalized.includes("emnlp")) return "EMNLP";
  if (normalized.includes("naacl")) return "NAACL";
  if (normalized.includes("acl")) return "ACL";
  if (normalized.includes("coling")) return "COLING";
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
  includesQuery,
  makeAbsoluteUrl,
  parseYear,
  parseNumber,
  toUniqueList,
  inferConference,
  inferWorkshopFlag,
  normalizeDoi,
};
