export default function PaperCard({ paper }) {
  const authorList = Array.isArray(paper.authors)
    ? paper.authors.join(" · ")
    : paper.authors;

  return (
    <article className="paper-card">
      <h2 className="paper-card__title">{paper.title}</h2>
      <p className="paper-card__authors">{authorList}</p>
      <div className="paper-card__meta">
        <span className="paper-card__year">{paper.year}</span>
        <span className="paper-card__source">{paper.source}</span>
      </div>
      <p className="paper-card__abstract">{paper.abstract}</p>
      <a
        className="paper-card__link"
        href={paper.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        → view paper
      </a>
    </article>
  );
}
