const axios = require("axios");
const { load } = require("cheerio");
const { getCache, setCache } = require("../utils/cache");
const { normalizeWhitespace } = require("../utils/text");

const CACHE_KEY = "deadlines:verified:v2";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const MONTH_MAP = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const VERIFIED_SOURCES = [
  {
    id: "iclr-2026-conference-submission",
    shortTitle: "ICLR 2026",
    eventType: "conference",
    deadlineType: "paper submission",
    timezone: "UTC-12",
    sourceUrl: "https://iclr.cc/Conferences/2026/CallForPapers",
    extractor: extractIclrConferenceSubmission,
  },
  {
    id: "cvpr-2026-conference-submission",
    shortTitle: "CVPR 2026",
    eventType: "conference",
    deadlineType: "paper submission",
    timezone: "UTC-12",
    sourceUrl: "https://cvpr.thecvf.com/Conferences/2026/CallForPapers",
    extractor: extractCvfSubmissionAoE,
  },
  {
    id: "eccv-2026-conference-submission",
    shortTitle: "ECCV 2026",
    eventType: "conference",
    deadlineType: "paper submission",
    timezone: "UTC",
    sourceUrl: "https://eccv.ecva.net/Conferences/2026/CallForPapers",
    extractor: extractEccvSubmissionUtcVariable,
  },
  {
    id: "iclr-2026-workshop-proposal",
    shortTitle: "ICLR 2026 Workshops",
    eventType: "workshop",
    deadlineType: "proposal submission",
    timezone: "UTC-12",
    sourceUrl: "https://iclr.cc/Conferences/2026/CallForWorkshops",
    extractor: extractIclrWorkshopProposal,
  },
  {
    id: "cvpr-2026-workshop-proposal",
    shortTitle: "CVPR 2026 Workshops",
    eventType: "workshop",
    deadlineType: "proposal submission",
    timezone: "UTC-12",
    sourceUrl: "https://cvpr.thecvf.com/Conferences/2026/CallForWorkshops",
    extractor: extractCvprWorkshopProposal,
  },
  {
    id: "eccv-2026-workshop-proposal",
    shortTitle: "ECCV 2026 Workshops",
    eventType: "workshop",
    deadlineType: "proposal submission",
    timezone: "UTC-12",
    sourceUrl: "https://eccv.ecva.net/Conferences/2026/CallForWorkshops",
    extractor: extractEccvWorkshopProposal,
  },
];

function parseTimezoneOffset(timezone) {
  const value = normalizeWhitespace(timezone);
  if (!value) return "Z";
  const normalized = value.toLowerCase();
  if (normalized === "aoe") return "-12:00";

  if (normalized === "utc" || normalized === "gmt") return "Z";

  const match = value.match(/(?:UTC|GMT)\s*([+-]\d{1,2})/i);
  if (!match) return "Z";

  const hours = Number(match[1]);
  if (!Number.isFinite(hours)) return "Z";

  const sign = hours >= 0 ? "+" : "-";
  const abs = Math.abs(hours).toString().padStart(2, "0");
  return `${sign}${abs}:00`;
}

function parseDeadlineDate(deadline, timezone) {
  const normalized = normalizeWhitespace(deadline);
  if (!normalized) return null;

  const ymdLike = normalized.replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2}/.test(ymdLike)) {
    const isoLike = ymdLike.replace(" ", "T");
    const offset = parseTimezoneOffset(timezone);
    const candidate = isoLike.match(/[zZ]|[+-]\d{2}:\d{2}$/)
      ? isoLike
      : `${isoLike}${offset === "Z" ? "Z" : offset}`;

    const timestamp = Date.parse(candidate);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp);
  }

  const directTimestamp = Date.parse(normalized);
  if (!Number.isFinite(directTimestamp)) return null;
  return new Date(directTimestamp);
}

function monthNumberFromName(value) {
  const key = normalizeWhitespace(value).toLowerCase();
  return MONTH_MAP[key] || null;
}

function buildDateString({ year, month, day, time = "23:59:59" }) {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d} ${time}`;
}

function htmlToText(html) {
  const $ = load(html || "");
  return normalizeWhitespace($.text().replace(/\s+/g, " "));
}

function extractIclrConferenceSubmission({ html, timezone }) {
  const text = htmlToText(html);
  const yearMatch = text.match(/ICLR\s+2026/i);
  if (!yearMatch) return null;

  const submissionMatch = text.match(
    /Submission date:\s*11:59pm,\s*([A-Za-z]{3,9})\s+(\d{1,2})/i
  );
  if (!submissionMatch) return null;

  const month = monthNumberFromName(submissionMatch[1]);
  const day = Number(submissionMatch[2]);
  if (!month || !Number.isFinite(day)) return null;

  const conferenceYear = 2026;
  const submissionYear = month >= 7 ? conferenceYear - 1 : conferenceYear;
  const deadline = buildDateString({ year: submissionYear, month, day, time: "23:59:59" });
  return parseDeadlineDate(deadline, timezone);
}

function extractCvfSubmissionAoE({ html, timezone }) {
  const text = htmlToText(html);
  let match = text.match(/Paper Submission Deadline\*?:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\s*AOE/i);
  if (!match) {
    match = text.match(
      /Paper Submission Deadline\*?:[\s\S]{0,500}?([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\s*AOE/i
    );
  }
  if (!match) return null;

  return parseMonthDayYearDate(normalizeWhitespace(match[1]), timezone, "23:59:59");
}

function extractEccvSubmissionUtcVariable({ html, timezone }) {
  const match = String(html || "").match(/var\s+submissiondeadline\s*=\s*"([^"]+)"/i);
  if (!match) return null;

  const raw = normalizeWhitespace(match[1]).replace(/\s+UTC$/i, "");
  return parseDeadlineDate(raw, timezone);
}

function extractIclrWorkshopProposal({ html, timezone }) {
  const text = htmlToText(html);
  const match = text.match(
    /Workshop Application Deadline\s*:\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}),?\s*11\.?59pm\s*AoE/i
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = monthNumberFromName(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !month || !Number.isFinite(year)) return null;

  const deadline = buildDateString({ year, month, day, time: "23:59:59" });
  return parseDeadlineDate(deadline, timezone);
}

function extractCvprWorkshopProposal({ html, timezone }) {
  const text = htmlToText(html);
  const match = text.match(/Proposal Deadline:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\s*AOE/i);
  if (!match) return null;

  return parseMonthDayYearDate(normalizeWhitespace(match[1]), timezone, "23:59:59");
}

function extractEccvWorkshopProposal({ html, timezone }) {
  const text = htmlToText(html);
  const match = text.match(
    /Proposal submission deadline:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\s*AOE/i
  );
  if (!match) return null;

  return parseMonthDayYearDate(normalizeWhitespace(match[1]), timezone, "23:59:59");
}

function parseMonthDayYearDate(value, timezone, time = "23:59:59") {
  const match = normalizeWhitespace(value).match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return null;

  const month = monthNumberFromName(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;

  const deadline = buildDateString({ year, month, day, time });
  return parseDeadlineDate(deadline, timezone);
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "sarveshu/1.0 (verified deadlines)",
    },
  });
  return String(response.data || "");
}

function normalizeVerifiedEvent(source, deadlineDate, now) {
  if (!(deadlineDate instanceof Date) || Number.isNaN(deadlineDate.getTime())) return null;

  const deltaMs = deadlineDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(deltaMs / (24 * 60 * 60 * 1000));
  const isOpen = daysRemaining >= 0;

  return {
    id: source.id,
    title: `${source.shortTitle} ${source.deadlineType}`,
    shortTitle: source.shortTitle,
    eventType: source.eventType,
    deadlineType: source.deadlineType,
    isOpen,
    daysRemaining,
    deadline: deadlineDate.toISOString(),
    timezone: source.timezone,
    link: source.sourceUrl,
    sourceUrl: source.sourceUrl,
    verification: {
      status: "verified",
      method: "parsed_from_official_page",
      verifiedAt: now.toISOString(),
    },
  };
}

function sortEvents(a, b) {
  if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
  if (a.isOpen && b.isOpen && a.daysRemaining !== b.daysRemaining) {
    return a.daysRemaining - b.daysRemaining;
  }
  if (!a.isOpen && !b.isOpen && a.daysRemaining !== b.daysRemaining) {
    return b.daysRemaining - a.daysRemaining;
  }
  return a.title.localeCompare(b.title);
}

async function loadVerifiedDeadlines() {
  const cached = getCache(CACHE_KEY);
  if (cached) return cached;

  const now = new Date();
  const events = [];

  await Promise.all(
    VERIFIED_SOURCES.map(async (source) => {
      try {
        const html = await fetchHtml(source.sourceUrl);
        const deadlineDate = source.extractor({ html, timezone: source.timezone });
        const normalized = normalizeVerifiedEvent(source, deadlineDate, now);
        if (normalized) events.push(normalized);
      } catch {
        // Skip unavailable sources rather than returning unverified values.
      }
    })
  );

  setCache(CACHE_KEY, events, CACHE_TTL_MS);
  return events;
}

function parseEventTypes(eventType) {
  const normalized = normalizeWhitespace(eventType).toLowerCase();
  if (!normalized || normalized === "all") return ["conference", "workshop"];

  const parts = normalized
    .split(",")
    .map((item) => normalizeWhitespace(item).toLowerCase())
    .filter((item) => item === "conference" || item === "workshop");

  return parts.length > 0 ? Array.from(new Set(parts)) : ["conference", "workshop"];
}

async function getActiveDeadlines({ limit = 12, includeClosed = false, eventType = "all" } = {}) {
  const now = new Date();
  const eventTypes = parseEventTypes(eventType);
  const verified = await loadVerifiedDeadlines();
  const scoped = verified.filter((item) => eventTypes.includes(item.eventType)).sort(sortEvents);
  const openDeadlines = scoped.filter((item) => item.isOpen);
  const closedDeadlines = scoped.filter((item) => !item.isOpen);

  let fallbackMode = "none";
  let selected = includeClosed ? scoped : openDeadlines;
  if (!includeClosed && selected.length === 0 && closedDeadlines.length > 0) {
    fallbackMode = "closed_only";
    selected = closedDeadlines;
  }

  const deadlines = selected.slice(0, Math.max(1, Math.min(Number(limit) || 12, 40)));

  return {
    updatedAt: now.toISOString(),
    total: deadlines.length,
    openTotal: openDeadlines.length,
    verifiedTotal: scoped.length,
    filters: {
      eventType: eventTypes,
      includeClosed: Boolean(includeClosed),
    },
    fallback: {
      mode: fallbackMode,
      reason:
        fallbackMode === "closed_only"
          ? "no_open_verified_deadlines"
          : null,
    },
    deadlines,
  };
}

module.exports = { getActiveDeadlines };
