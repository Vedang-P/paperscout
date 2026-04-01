const axios = require("axios");
const { load } = require("cheerio");
const {
  inferConference,
  inferWorkshopFlag,
  normalizeDoi,
  normalizeWhitespace,
  toUniqueList,
} = require("../utils/text");

function parseYearFromDate(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  const year = Number.parseInt(normalized.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function mapArxivEntry($, entryNode, filters) {
  const $entry = $(entryNode);
  const id = normalizeWhitespace($entry.find("id").first().text());
  const title = normalizeWhitespace($entry.find("title").first().text());
  const abstract = normalizeWhitespace($entry.find("summary").first().text());
  const published = normalizeWhitespace(
    $entry.find("published").first().text() || $entry.find("updated").first().text()
  );
  const year = parseYearFromDate(published);

  if (!title || !year || year < filters.minYear || year > filters.maxYear) {
    return null;
  }

  const comment = normalizeWhitespace(
    $entry.find("arxiv\\:comment, comment").first().text()
  );
  const journalRef = normalizeWhitespace(
    $entry.find("arxiv\\:journal_ref, journal_ref").first().text()
  );
  const doiRaw = normalizeWhitespace($entry.find("arxiv\\:doi, doi").first().text());
  const doi = normalizeDoi(doiRaw);

  const contextText = `${title} ${abstract} ${comment} ${journalRef}`;
  const conference = inferConference(contextText);
  const isWorkshop = inferWorkshopFlag(contextText);

  const authors = toUniqueList(
    $entry
      .find("author > name")
      .map((_, node) => normalizeWhitespace($(node).text()))
      .get()
  );

  const links = [];
  let pdfUrl = "";
  let externalUrl = id;

  $entry.find("link").each((_, linkNode) => {
    const href = normalizeWhitespace($entry.find(linkNode).attr("href"));
    if (!href) return;
    links.push(href);

    const type = normalizeWhitespace($entry.find(linkNode).attr("type")).toLowerCase();
    const titleAttr = normalizeWhitespace($entry.find(linkNode).attr("title")).toLowerCase();
    const rel = normalizeWhitespace($entry.find(linkNode).attr("rel")).toLowerCase();

    if (!pdfUrl && (titleAttr === "pdf" || type === "application/pdf" || href.includes("/pdf/"))) {
      pdfUrl = href;
    }

    if (
      rel === "alternate" &&
      !href.includes("/pdf/") &&
      (type === "text/html" || type === "")
    ) {
      externalUrl = href;
    }
  });

  const sourceVenueType = conference ? "conference" : "repository";
  const venue = conference ? `${conference} (arXiv metadata)` : journalRef || "arXiv";

  return {
    id: `arxiv:${id || title.toLowerCase()}`,
    title,
    abstract,
    authors,
    year,
    venue,
    sourceVenueType,
    source: "arXiv",
    sourceType: "api",
    conference,
    isWorkshop,
    citationCount: 0,
    doi,
    url: externalUrl || id || "",
    pdfUrl: pdfUrl || "",
    links: toUniqueList([externalUrl, pdfUrl, id, ...links].filter(Boolean)),
  };
}

async function searchArxiv(query, filters) {
  const maxResults = Math.min(Math.max(filters.limit * 4, 80), 220);
  const response = await axios.get("https://export.arxiv.org/api/query", {
    params: {
      search_query: `all:${query}`,
      start: 0,
      max_results: maxResults,
      sortBy: "relevance",
      sortOrder: "descending",
    },
    timeout: 15000,
    headers: {
      "User-Agent": "PaperScout/1.0 (research paper scraper)",
    },
  });

  const xml = String(response.data || "");
  const $ = load(xml, { xmlMode: true });
  const entries = $("feed > entry").toArray();

  return entries
    .map((entry) => mapArxivEntry($, entry, filters))
    .filter(Boolean);
}

module.exports = { searchArxiv };
