const axios = require("axios");
const { load } = require("cheerio");
const { getCache, setCache } = require("../utils/cache");
const {
  includesQuery,
  makeAbsoluteUrl,
  normalizeWhitespace,
  parseYear,
  toUniqueList,
} = require("../utils/text");

const CVF_BASE_URL = "https://openaccess.thecvf.com";
const MENU_OTHER_URL = `${CVF_BASE_URL}/menu_other.html`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "PaperScout/1.0 (research paper scraper)",
    },
  });
  return response.data || "";
}

async function mapWithConcurrency(items, worker, concurrency = 4) {
  const pending = [...items];
  const output = [];

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (pending.length > 0) {
      const item = pending.shift();
      if (!item) continue;
      try {
        const value = await worker(item);
        output.push(value);
      } catch {
        output.push(null);
      }
    }
  });

  await Promise.all(runners);
  return output.filter(Boolean);
}

async function getAccvWorkshopMenus(filters) {
  const key = `cvf:accv:menus:${filters.minYear}:${filters.maxYear}`;
  const cached = getCache(key);
  if (cached) return cached;

  const html = await fetchHtml(MENU_OTHER_URL);
  const $ = load(html);
  const links = new Set();

  $("a[href*='ACCV'][href*='_workshops/menu']").each((_, anchor) => {
    const href = normalizeWhitespace($(anchor).attr("href"));
    const absoluteUrl = makeAbsoluteUrl(CVF_BASE_URL, href);
    if (!absoluteUrl) return;
    const match = absoluteUrl.match(/ACCV(\d{4})_workshops\/menu/);
    const year = parseYear(match?.[1]);
    if (!year || year < filters.minYear || year > filters.maxYear) return;
    links.add(absoluteUrl);
  });

  const menus = Array.from(links);
  setCache(key, menus, CACHE_TTL_MS);
  return menus;
}

async function getWorkshopPages(menuUrl) {
  const key = `cvf:menu:${menuUrl}`;
  const cached = getCache(key);
  if (cached) return cached;

  const html = await fetchHtml(menuUrl);
  const $ = load(html);
  const links = new Set();

  $("a[href*='_workshops/']").each((_, anchor) => {
    const href = normalizeWhitespace($(anchor).attr("href"));
    if (!href || href.endsWith("/menu")) return;
    const absoluteUrl = makeAbsoluteUrl(CVF_BASE_URL, href);
    if (!absoluteUrl) return;
    links.add(absoluteUrl);
  });

  const workshops = Array.from(links);
  setCache(key, workshops, CACHE_TTL_MS);
  return workshops;
}

function parsePaperEntries(workshopUrl, html, query) {
  const $ = load(html);
  const workshopTitle = normalizeWhitespace($("#content h3").first().text());
  const yearMatch = workshopUrl.match(/ACCV(\d{4})_workshops/);
  const year = parseYear(yearMatch?.[1]);
  const papers = [];

  $("dt.ptitle").each((_, dt) => {
    const titleAnchor = $(dt).find("a").first();
    const title = normalizeWhitespace(titleAnchor.text());
    if (!title) return;

    const authorsBlock = $(dt).next("dd");
    const linksBlock = authorsBlock.next("dd");

    const authors = toUniqueList(
      authorsBlock
        .find("input[name='query_author']")
        .map((__, input) => normalizeWhitespace($(input).attr("value")))
        .get()
    );

    const links = linksBlock.find("a");
    const pdfUrl = makeAbsoluteUrl(
      CVF_BASE_URL,
      normalizeWhitespace(
        links
          .filter((__, a) => normalizeWhitespace($(a).text()).toLowerCase() === "pdf")
          .first()
          .attr("href")
      )
    );

    const externalUrl = makeAbsoluteUrl(CVF_BASE_URL, normalizeWhitespace(titleAnchor.attr("href")));
    const arxivUrl = makeAbsoluteUrl(
      CVF_BASE_URL,
      normalizeWhitespace(
        links
          .filter((__, a) => normalizeWhitespace($(a).text()).toLowerCase() === "arxiv")
          .first()
          .attr("href")
      )
    );

    const searchText = `${title} ${authors.join(" ")}`;
    if (!includesQuery(searchText, query)) return;

    papers.push({
      id: `cvf:${(externalUrl || pdfUrl || title).toLowerCase()}`,
      title,
      abstract: "",
      authors,
      year,
      venue: `ACCV Workshop: ${workshopTitle || "Workshop"}`,
      source: "CVF Open Access",
      sourceType: "scraper",
      conference: "ACCV",
      isWorkshop: true,
      citationCount: 0,
      doi: null,
      url: externalUrl || arxivUrl || pdfUrl || "",
      pdfUrl: pdfUrl || "",
    });
  });

  return papers;
}

async function fetchWorkshopPapers(workshopUrl, query) {
  const cacheKey = `cvf:workshop:${workshopUrl}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return parsePaperEntries(workshopUrl, cached, query);
  }

  const html = await fetchHtml(workshopUrl);
  setCache(cacheKey, html, CACHE_TTL_MS);
  return parsePaperEntries(workshopUrl, html, query);
}

async function searchCvfWorkshops(query, filters) {
  const menus = await getAccvWorkshopMenus(filters);
  const workshopPagesNested = await mapWithConcurrency(menus, getWorkshopPages, 3);
  const workshopPages = toUniqueList(workshopPagesNested.flat());

  const maxWorkshopPages = Number.parseInt(process.env.CVF_MAX_WORKSHOP_PAGES || "10", 10);
  const selectedWorkshopPages = workshopPages.slice(0, Number.isFinite(maxWorkshopPages) ? maxWorkshopPages : 10);

  const results = await mapWithConcurrency(
    selectedWorkshopPages,
    async (workshopUrl) => fetchWorkshopPapers(workshopUrl, query),
    3
  );

  return results.flat();
}

module.exports = { searchCvfWorkshops };
