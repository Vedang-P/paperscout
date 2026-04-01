const axios = require("axios");
const { load } = require("cheerio");
const {
  inferConference,
  inferWorkshopFlag,
  normalizeDoi,
  normalizeWhitespace,
  parseYear,
  toArray,
  toUniqueList,
} = require("../utils/text");

function decodeHtml(value) {
  if (!value) return "";
  const $ = load(`<p>${value}</p>`);
  return $("p").text();
}

function parseAuthors(authorNode) {
  const list = toArray(authorNode);
  return toUniqueList(
    list.map((author) => {
      if (typeof author === "string") return decodeHtml(author);
      if (author && typeof author.text === "string") return decodeHtml(author.text);
      return "";
    })
  );
}

function mapDblpPaper(hit) {
  const info = hit?.info || {};
  const title = normalizeWhitespace(decodeHtml(info.title));
  const venue = normalizeWhitespace(decodeHtml(info.venue));
  const year = parseYear(info.year);
  const conference = inferConference(`${venue} ${title}`);
  const isWorkshop = inferWorkshopFlag(`${venue} ${title} ${info.type || ""}`);
  const doi = normalizeDoi(info.doi);

  const ees = toArray(info.ee).filter(Boolean);

  return {
    id: `dblp:${info.key || doi || title.toLowerCase()}`,
    title,
    abstract: "",
    authors: parseAuthors(info.authors?.author),
    year,
    venue,
    source: "DBLP",
    sourceType: "api",
    conference,
    isWorkshop,
    citationCount: 0,
    doi,
    url: ees[0] || info.url || "",
    pdfUrl: "",
    links: toUniqueList([...ees, info.url].filter(Boolean)),
  };
}

async function searchDblp(query, filters) {
  const size = Math.min(Math.max(filters.limit, 20), 100);
  const response = await axios.get("https://dblp.org/search/publ/api", {
    params: {
      q: query,
      h: size,
      format: "json",
    },
    timeout: 12000,
    headers: {
      "User-Agent": "PaperScout/1.0 (research paper scraper)",
    },
  });

  const hitsRaw = response.data?.result?.hits?.hit;
  const hits = Array.isArray(hitsRaw) ? hitsRaw : hitsRaw ? [hitsRaw] : [];
  return hits.map(mapDblpPaper).filter((paper) => paper.title);
}

module.exports = { searchDblp };
