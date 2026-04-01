const axios = require("axios");
const YAML = require("yaml");
const { getCache, setCache } = require("../utils/cache");
const { lower, normalizeWhitespace } = require("../utils/text");

const FEED_URLS = [
  "https://raw.githubusercontent.com/paperswithcode/ai-deadlines/gh-pages/_data/conferences.yml",
];
const CACHE_KEY = "deadlines:feed:v1";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const PRIORITY_TITLES = new Set([
  "CVPR",
  "ICCV",
  "ECCV",
  "WACV",
  "ICLR",
  "ICML",
  "NEURIPS",
  "AAAI",
  "IJCAI",
  "ACL",
  "EMNLP",
  "NAACL",
  "COLING",
  "KDD",
  "WWW",
  "SIGIR",
  "ICRA",
  "IROS",
  "RSS",
  "CORL",
]);

const ESTIMATED_TEMPLATES = [
  { id: "iclr", title: "ICLR", eventType: "conference", month: 10, day: 1, timezone: "UTC-12", link: "https://iclr.cc", hindex: 280 },
  { id: "cvpr", title: "CVPR", eventType: "conference", month: 11, day: 15, timezone: "UTC-12", link: "https://cvpr.thecvf.com", hindex: 300 },
  { id: "iccv", title: "ICCV", eventType: "conference", month: 3, day: 15, timezone: "UTC-12", link: "https://iccv.thecvf.com", hindex: 250 },
  { id: "eccv", title: "ECCV", eventType: "conference", month: 3, day: 8, timezone: "UTC-12", link: "https://eccv.ecva.net", hindex: 230 },
  { id: "accv", title: "ACCV", eventType: "conference", month: 7, day: 10, timezone: "UTC-12", link: "https://accv2024.org", hindex: 140 },
  { id: "acl", title: "ACL", eventType: "conference", month: 2, day: 15, timezone: "UTC-12", link: "https://www.aclweb.org", hindex: 220 },
  { id: "emnlp", title: "EMNLP", eventType: "conference", month: 6, day: 15, timezone: "UTC-12", link: "https://2025.emnlp.org", hindex: 210 },
  { id: "naacl", title: "NAACL", eventType: "conference", month: 10, day: 15, timezone: "UTC-12", link: "https://naacl.org", hindex: 180 },
  { id: "coling", title: "COLING", eventType: "conference", month: 1, day: 20, timezone: "UTC-12", link: "https://coling2025.org", hindex: 160 },
  { id: "iclr-workshops", title: "ICLR Workshops", eventType: "workshop", month: 11, day: 20, timezone: "UTC-12", link: "https://iclr.cc", hindex: 160 },
  { id: "cvpr-workshops", title: "CVPR Workshops", eventType: "workshop", month: 12, day: 10, timezone: "UTC-12", link: "https://cvpr.thecvf.com", hindex: 165 },
  { id: "eccv-workshops", title: "ECCV Workshops", eventType: "workshop", month: 5, day: 20, timezone: "UTC-12", link: "https://eccv.ecva.net", hindex: 150 },
];

function parseTimezoneOffset(timezone) {
  const value = normalizeWhitespace(timezone);
  if (!value) return "Z";
  const normalized = value.toLowerCase();
  if (normalized === "aoe") return "-12:00";
  const match = value.match(/(?:UTC|GMT)\s*([+-]\d{1,2})/i);
  if (!match) return "Z";
  const hours = Number(match[1]);
  if (!Number.isFinite(hours)) return "Z";
  const sign = hours >= 0 ? "+" : "-";
  const abs = Math.abs(hours).toString().padStart(2, "0");
  return `${sign}${abs}:00`;
}

function parseDeadlineDate(deadline, timezone) {
  if (!deadline) return null;
  const normalized = normalizeWhitespace(deadline).replace(" ", "T");
  const offset = parseTimezoneOffset(timezone);
  const candidate = normalized.match(/[zZ]|[+-]\d{2}:\d{2}$/)
    ? normalized
    : `${normalized}${offset === "Z" ? "Z" : offset}`;
  const timestamp = Date.parse(candidate);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp);
}

function inferEventType(item) {
  const explicit = lower(item.eventType || "");
  if (explicit === "workshop" || explicit === "conference") return explicit;
  const text = lower(`${item.title || ""} ${item.note || ""}`);
  if (text.includes("workshop")) return "workshop";
  return "conference";
}

function isFamous(item) {
  const title = String(item.title || "").toUpperCase();
  const baseTitle = title.split(" ")[0];
  const hindex = Number(item.hindex || 0);
  return PRIORITY_TITLES.has(title) || PRIORITY_TITLES.has(baseTitle) || hindex >= 80;
}

function normalizeEvent(item, now) {
  const deadlineDate =
    item.deadlineDate instanceof Date
      ? item.deadlineDate
      : parseDeadlineDate(item.deadline, item.timezone);
  if (!deadlineDate) return null;
  const deltaMs = deadlineDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(deltaMs / (24 * 60 * 60 * 1000));
  const isOpen = daysRemaining >= 0;
  const eventType = inferEventType(item);
  const hindex = Number(item.hindex || 0);
  const title = normalizeWhitespace(`${item.title || ""} ${item.year || ""}`.trim());

  return {
    id: item.id || lower(title).replace(/[^a-z0-9]+/g, "-"),
    title,
    shortTitle: normalizeWhitespace(item.title || ""),
    eventType,
    isOpen,
    daysRemaining,
    deadline: deadlineDate.toISOString(),
    timezone: item.timezone || "UTC",
    place: normalizeWhitespace(item.place || ""),
    date: normalizeWhitespace(item.date || ""),
    link: item.link || "",
    hindex,
    isEstimated: Boolean(item.isEstimated),
    priorityScore:
      (isOpen ? 100000 : 0) +
      Math.max(0, 365 - Math.max(0, daysRemaining)) * 10 +
      hindex +
      (isFamous(item) ? 200 : 0),
  };
}

function sortEvents(a, b) {
  if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
  if (a.isOpen && b.isOpen && a.daysRemaining !== b.daysRemaining) {
    return a.daysRemaining - b.daysRemaining;
  }
  if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
  return a.title.localeCompare(b.title);
}

async function loadDeadlinesFeed() {
  const cached = getCache(CACHE_KEY);
  if (cached) return cached;

  let items = [];
  for (const url of FEED_URLS) {
    try {
      const response = await axios.get(url, {
        timeout: 12000,
        headers: {
          "User-Agent": "sarveshu/1.0 (deadlines aggregator)",
        },
      });
      const parsed = YAML.parse(String(response.data || ""));
      const normalized = Array.isArray(parsed) ? parsed : [];
      if (normalized.length > 0) {
        items = normalized;
        break;
      }
    } catch {
      // Try next source.
    }
  }

  setCache(CACHE_KEY, items, CACHE_TTL_MS);
  return items;
}

function formatDatePart(value) {
  return String(value).padStart(2, "0");
}

function buildEstimatedItems(now) {
  const currentYear = now.getUTCFullYear();
  const years = [currentYear, currentYear + 1];
  const items = [];

  for (const submissionYear of years) {
    for (const template of ESTIMATED_TEMPLATES) {
      items.push({
        id: `${template.id}-${submissionYear + 1}`,
        title: template.title,
        year: submissionYear + 1,
        link: template.link,
        deadline: `${submissionYear}-${formatDatePart(template.month)}-${formatDatePart(template.day)} 23:59:59`,
        timezone: template.timezone,
        place: "",
        date: "",
        hindex: template.hindex,
        note: "Estimated date; verify on official website",
        isEstimated: true,
        eventType: template.eventType,
      });
    }
  }

  return items;
}

function dedupeById(events) {
  const map = new Map();
  for (const event of events) {
    if (!map.has(event.id)) {
      map.set(event.id, event);
      continue;
    }
    const existing = map.get(event.id);
    if (existing && existing.isEstimated && !event.isEstimated) {
      map.set(event.id, event);
    }
  }
  return Array.from(map.values());
}

async function getActiveDeadlines({ limit = 12, includeClosed = false } = {}) {
  const now = new Date();
  const feedItems = await loadDeadlinesFeed();
  const fromFeed = feedItems
    .map((item) => normalizeEvent(item, now))
    .filter(Boolean);

  const feedOpen = fromFeed.filter((item) => item.isOpen && item.daysRemaining >= -7);
  const shouldUseEstimatedFallback = feedOpen.length < 4;

  const estimated = shouldUseEstimatedFallback
    ? buildEstimatedItems(now)
        .map((item) => normalizeEvent(item, now))
        .filter(Boolean)
    : [];

  const normalized = dedupeById([...fromFeed, ...estimated])
    .filter(Boolean)
    .filter((item) => includeClosed || item.isOpen)
    .filter((item) => item.daysRemaining >= -7)
    .sort(sortEvents)
    .slice(0, Math.max(1, Math.min(Number(limit) || 12, 40)));

  return {
    updatedAt: now.toISOString(),
    total: normalized.length,
    deadlines: normalized,
  };
}

module.exports = { getActiveDeadlines };
