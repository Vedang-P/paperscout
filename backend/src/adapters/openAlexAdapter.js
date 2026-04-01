const axios = require("axios");
const {
  inferConference,
  inferWorkshopFlag,
  makeAbsoluteUrl,
  normalizeDoi,
  normalizeWhitespace,
  toUniqueList,
} = require("../utils/text");

function abstractFromInvertedIndex(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return "";
  let maxPosition = -1;
  for (const positions of Object.values(invertedIndex)) {
    for (const position of positions) {
      if (position > maxPosition) maxPosition = position;
    }
  }
  if (maxPosition < 0) return "";
  const words = new Array(maxPosition + 1);
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      words[position] = word;
    }
  }
  return normalizeWhitespace(words.filter(Boolean).join(" "));
}

function mapOpenAlexPaper(work) {
  const title = normalizeWhitespace(work.display_name || work.title);
  const abstract =
    typeof work.abstract === "string"
      ? normalizeWhitespace(work.abstract)
      : abstractFromInvertedIndex(work.abstract_inverted_index);
  const authors = toUniqueList(
    (work.authorships || [])
      .map((authorship) => authorship?.author?.display_name)
      .filter(Boolean)
  );
  const venue = normalizeWhitespace(work.primary_location?.source?.display_name || "");
  const sourceVenueType = normalizeWhitespace(work.primary_location?.source?.type || "");
  const conference = inferConference(`${venue} ${title}`);
  const isWorkshop = inferWorkshopFlag(`${venue} ${title}`);

  const doiUrl = work.doi ? `https://doi.org/${normalizeDoi(work.doi)}` : null;
  const sourceUrl =
    makeAbsoluteUrl("https://openalex.org", work.primary_location?.landing_page_url) ||
    makeAbsoluteUrl("https://openalex.org", doiUrl) ||
    makeAbsoluteUrl("https://openalex.org", work.id);
  const pdfUrl = makeAbsoluteUrl("https://openalex.org", work.primary_location?.pdf_url);
  const links = toUniqueList(
    [
      sourceUrl,
      pdfUrl,
      work.primary_location?.landing_page_url,
      ...(Array.isArray(work.locations)
        ? work.locations.flatMap((location) => [location?.landing_page_url, location?.pdf_url])
        : []),
    ].filter(Boolean)
  );

  return {
    id: `openalex:${work.id || normalizeDoi(work.doi) || title.toLowerCase()}`,
    title,
    abstract,
    authors,
    year: work.publication_year || null,
    venue,
    sourceVenueType,
    source: "OpenAlex",
    sourceType: "api",
    conference,
    isWorkshop,
    citationCount: Number.isFinite(work.cited_by_count) ? work.cited_by_count : 0,
    doi: normalizeDoi(work.doi),
    url: sourceUrl,
    pdfUrl,
    links,
  };
}

async function searchOpenAlex(query, filters) {
  const perPage = Math.min(Math.max(filters.limit * 3, 60), 200);
  const pageCountRaw = Number.parseInt(process.env.OPENALEX_PAGE_COUNT || "2", 10);
  const pageCount = Math.min(3, Math.max(1, Number.isFinite(pageCountRaw) ? pageCountRaw : 2));
  const filter = `from_publication_date:${filters.minYear}-01-01,to_publication_date:${filters.maxYear}-12-31`;
  const requests = Array.from({ length: pageCount }, (_, index) =>
    axios
      .get("https://api.openalex.org/works", {
        params: {
          search: query,
          "per-page": perPage,
          page: index + 1,
          filter,
          sort: "relevance_score:desc",
        },
        timeout: 12000,
        headers: {
          "User-Agent": "PaperScout/1.0 (research paper scraper)",
        },
      })
      .catch(() => null)
  );

  const responses = await Promise.all(requests);
  const works = responses.flatMap((response) =>
    Array.isArray(response?.data?.results) ? response.data.results : []
  );

  return works.map(mapOpenAlexPaper).filter((paper) => paper.title);
}

module.exports = { searchOpenAlex };
