import PaperCard from "./PaperCard";

export default function PaperList({ papers, loading, error, query }) {
  if (loading) {
    return (
      <div className="paper-list">
        <p className="paper-list__status">searching...</p>
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
      {papers.map((paper) => (
        <PaperCard key={paper.id} paper={paper} />
      ))}
    </div>
  );
}
