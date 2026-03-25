import { useState } from "react";

export default function PaperCard({ paper }) {
  const [showEmbedded, setShowEmbedded] = useState(false);

  const authorList = Array.isArray(paper.authors) ? paper.authors.join(" · ") : paper.authors;
  const citationCount = Number.isFinite(paper.citationCount) ? paper.citationCount : 0;
  const externalUrl = paper.url || paper.pdfUrl;
  const pdfUrl = paper.pdfUrl || "";
  const embedUrl = pdfUrl || externalUrl;

  return (
    <article className="paper-card">
      <h2 className="paper-card__title">{paper.title}</h2>
      <p className="paper-card__authors">{authorList || "authors unavailable"}</p>

      <div className="paper-card__meta">
        <span className="paper-card__year">{paper.year || "n/a"}</span>
        <span className="paper-card__source">{paper.conference || paper.source}</span>
        <span className="paper-card__source">{paper.isWorkshop ? "workshop" : "conference"}</span>
        <span className="paper-card__source">citations: {citationCount}</span>
      </div>

      <p className="paper-card__venue">{paper.venue || "venue unavailable"}</p>

      {paper.abstract ? <p className="paper-card__abstract">{paper.abstract}</p> : null}

      {paper.tags?.length > 0 ? (
        <div className="paper-card__tags">
          {paper.tags.map((tag) => (
            <span key={`${paper.id}-${tag}`} className="paper-card__tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="paper-card__actions">
        {externalUrl ? (
          <a
            className="paper-card__link"
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            open source page
          </a>
        ) : null}
        {pdfUrl ? (
          <a className="paper-card__link" href={pdfUrl} target="_blank" rel="noopener noreferrer">
            open pdf
          </a>
        ) : null}
        {embedUrl ? (
          <button
            type="button"
            className="paper-card__link paper-card__link--button"
            onClick={() => setShowEmbedded((previous) => !previous)}
          >
            {showEmbedded ? "hide in-app view" : "open in app"}
          </button>
        ) : null}
      </div>

      {showEmbedded && embedUrl ? (
        <div className="paper-card__embed">
          <iframe
            src={embedUrl}
            title={`Embedded paper: ${paper.title}`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <p className="paper-card__embed-note">
            If the page blocks embedding, use the external links above.
          </p>
        </div>
      ) : null}
    </article>
  );
}
