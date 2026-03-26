import PaperCard from "./PaperCard";

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
        <p className="paper-list__status">no results found.</p>
      </div>
    );
  }

  return (
    <div className="paper-list">
      <p className="paper-list__count">
        {papers.length} result{papers.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
      </p>
      {filters && (
        <p className="paper-list__filters">
          {filters.type} · years {filters.minYear}–{filters.maxYear} · min citations {filters.minCitations}
        </p>
      )}
      {meta?.dataSources?.length > 0 && (
        <p className="paper-list__sources">sources: {meta.dataSources.join(" · ")}</p>
      )}
      {papers.map((paper) => (
        <PaperCard key={paper.id} paper={paper} />
      ))}
    </div>
  );
}
