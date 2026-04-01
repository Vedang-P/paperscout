import PaperCard from "./PaperCard";

function downloadText(filename, text, mimeType = "text/plain") {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function csvEscape(value) {
  const text = String(value || "");
  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function toCsv(papers) {
  const headers = [
    "rank",
    "title",
    "authors",
    "year",
    "venue",
    "conference",
    "paper_types",
    "tags",
    "citations",
    "url",
    "pdf_url",
    "code_url",
    "reasons",
  ];

  const rows = papers.map((paper) => [
    paper.rank || "",
    paper.title || "",
    Array.isArray(paper.authors) ? paper.authors.join("; ") : "",
    paper.year || "",
    paper.venue || "",
    paper.conference || paper.source || "",
    Array.isArray(paper.paperTypes) ? paper.paperTypes.join("; ") : "",
    Array.isArray(paper.tags) ? paper.tags.join("; ") : "",
    Number.isFinite(paper.citationCount) ? paper.citationCount : 0,
    paper.url || "",
    paper.pdfUrl || "",
    paper.codeUrl || "",
    Array.isArray(paper?.recommendation?.reasons) ? paper.recommendation.reasons.join("; ") : "",
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function bibtexEscape(value) {
  return String(value || "").replace(/[{}]/g, "");
}

function toBibtex(papers) {
  return papers
    .map((paper, index) => {
      const year = paper.year || "2026";
      const firstAuthor = Array.isArray(paper.authors) && paper.authors[0] ? paper.authors[0] : "paper";
      const key = `${firstAuthor.split(" ")[0].toLowerCase()}${year}${index + 1}`.replace(/[^a-z0-9]/g, "");
      const authors = Array.isArray(paper.authors) ? paper.authors.join(" and ") : "";
      const url = paper.url || paper.pdfUrl || "";

      return [
        `@inproceedings{${key},`,
        `  title = {${bibtexEscape(paper.title)}},`,
        authors ? `  author = {${bibtexEscape(authors)}},` : null,
        `  year = {${bibtexEscape(year)}},`,
        paper.venue ? `  booktitle = {${bibtexEscape(paper.venue)}},` : null,
        url ? `  url = {${bibtexEscape(url)}},` : null,
        paper.doi ? `  doi = {${bibtexEscape(paper.doi)}},` : null,
        `}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function toReadingList(papers, query) {
  const lines = [`# Sarveshu Reading List`, "", `Query: ${query}`, "", `Total papers: ${papers.length}`, ""];

  for (const paper of papers) {
    const link = paper.url || paper.pdfUrl || "";
    const venue = paper.venue || paper.conference || paper.source || "";
    lines.push(`- ${paper.title} (${paper.year || "n/a"})`);
    lines.push(`  - Venue: ${venue}`);
    lines.push(`  - Citations: ${Number.isFinite(paper.citationCount) ? paper.citationCount : 0}`);
    if (link) lines.push(`  - Link: ${link}`);
    if (paper.codeUrl) lines.push(`  - Code: ${paper.codeUrl}`);
    if (paper?.recommendation?.reasons?.length) {
      lines.push(`  - Why: ${paper.recommendation.reasons.join("; ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export default function PaperList({ papers, loading, error, query, meta, filters }) {
  if (loading) {
    return (
      <div className="paper-list">
        <div className="loading-dots" role="status" aria-label="searching">
          <span className="loading-dots__dot" />
          <span className="loading-dots__dot" />
          <span className="loading-dots__dot" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="paper-list">
        <p className="paper-list__status">{error}</p>
      </div>
    );
  }

  if (!papers || papers.length === 0) {
    return (
      <div className="paper-list">
        <p className="paper-list__status">
          no results found. try relaxing paper type/task/dataset filters or disabling linked-code-only.
        </p>
      </div>
    );
  }

  return (
    <div className="paper-list">
      <div className="paper-list__top">
        <div>
          <p className="paper-list__count">
            {papers.length} result{papers.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>
          {filters ? (
            <p className="paper-list__filters">
              {filters.type} · years {filters.minYear}–{filters.maxYear} · min citations {filters.minCitations}
            </p>
          ) : null}
          {meta?.dataSources?.length > 0 ? (
            <p className="paper-list__sources">sources: {meta.dataSources.join(" · ")}</p>
          ) : null}
          {meta?.fallback?.steps?.length > 0 ? (
            <p className="paper-list__sources">fallback used: {meta.fallback.steps.join(" · ")}</p>
          ) : null}
        </div>

        <div className="paper-list__exports">
          <button
            type="button"
            onClick={() => downloadText("sarveshu-results.csv", toCsv(papers), "text/csv")}
          >
            export csv
          </button>
          <button
            type="button"
            onClick={() => downloadText("sarveshu-results.bib", toBibtex(papers), "text/plain")}
          >
            export bibtex
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(
                "sarveshu-reading-list.md",
                toReadingList(papers, query),
                "text/markdown"
              )
            }
          >
            reading list
          </button>
        </div>
      </div>

      {filters?.paperTypes?.length > 0 ? (
        <p className="paper-list__sources">paper types: {filters.paperTypes.join(" · ")}</p>
      ) : null}
      {filters?.tasks?.length > 0 ? (
        <p className="paper-list__sources">tasks: {filters.tasks.join(" · ")}</p>
      ) : null}
      {filters?.datasets?.length > 0 ? (
        <p className="paper-list__sources">datasets: {filters.datasets.join(" · ")}</p>
      ) : null}
      {filters?.hasCode ? <p className="paper-list__sources">filter: has linked code</p> : null}

      {papers.map((paper) => (
        <PaperCard key={paper.id} paper={paper} />
      ))}
    </div>
  );
}
