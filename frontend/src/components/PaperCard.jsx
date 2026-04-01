import { useMemo, useState } from "react";

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.73 0 8.33c0 3.68 2.29 6.8 5.47 7.9.4.08.55-.18.55-.39 0-.19-.01-.82-.01-1.49-2.01.45-2.53-.51-2.69-.98-.09-.24-.48-.98-.82-1.18-.28-.15-.68-.54-.01-.55.63-.01 1.08.6 1.23.85.72 1.26 1.87.9 2.33.68.07-.54.28-.9.51-1.11-1.78-.21-3.64-.92-3.64-4.1 0-.91.31-1.65.82-2.23-.08-.21-.36-1.06.08-2.21 0 0 .67-.22 2.2.85.64-.19 1.32-.28 2-.28.68 0 1.36.1 2 .28 1.53-1.08 2.2-.85 2.2-.85.44 1.15.16 2 .08 2.21.51.58.82 1.32.82 2.23 0 3.19-1.87 3.89-3.65 4.1.29.26.54.75.54 1.52 0 1.1-.01 1.98-.01 2.25 0 .22.14.48.55.39A8.36 8.36 0 0 0 16 8.33C16 3.73 12.42 0 8 0Z"
      />
    </svg>
  );
}

export default function PaperCard({ paper }) {
  const [showEmbedded, setShowEmbedded] = useState(false);
  const [abstractExpanded, setAbstractExpanded] = useState(false);

  const authorList = Array.isArray(paper.authors) ? paper.authors.join(" · ") : paper.authors;
  const citationCount = Number.isFinite(paper.citationCount) ? paper.citationCount : 0;
  const externalUrl = paper.url || paper.pdfUrl;
  const pdfUrl = paper.pdfUrl || "";
  const embedUrl = pdfUrl || externalUrl;
  const abstractIsLong = paper.abstract && paper.abstract.length > 220;

  const paperTypeLabels = useMemo(() => {
    const types = Array.isArray(paper.paperTypes) ? paper.paperTypes : [];
    if (types.length > 0) return types;
    return [paper.isWorkshop ? "workshop" : "conference"];
  }, [paper.isWorkshop, paper.paperTypes]);

  const reasonChips = useMemo(() => {
    const reasons = paper?.recommendation?.reasons;
    return Array.isArray(reasons) ? reasons.slice(0, 3) : [];
  }, [paper]);

  return (
    <article className="paper-card">
      <h2 className="paper-card__title">{paper.title}</h2>
      <p className="paper-card__authors">{authorList || "authors unavailable"}</p>

      <div className="paper-card__meta">
        <span className="paper-card__year">{paper.year || "n/a"}</span>
        <span className="paper-card__meta-sep" aria-hidden="true">
          ·
        </span>
        <span className="paper-card__source">{paper.conference || paper.source}</span>
        <span className="paper-card__meta-sep" aria-hidden="true">
          ·
        </span>
        <span className="paper-card__source">{citationCount} citations</span>
      </div>

      {paper.venue ? <p className="paper-card__venue">{paper.venue}</p> : null}

      <div className="paper-card__type-row">
        {paperTypeLabels.map((typeLabel) => (
          <span key={`${paper.id}-type-${typeLabel}`} className="paper-card__type-badge">
            {typeLabel}
          </span>
        ))}
      </div>

      {reasonChips.length > 0 ? (
        <div className="paper-card__reasons">
          {reasonChips.map((reason) => (
            <span key={`${paper.id}-reason-${reason}`} className="paper-card__reason">
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      {paper.abstract ? (
        <>
          <p
            className={`paper-card__abstract${
              abstractIsLong && !abstractExpanded ? " paper-card__abstract--collapsed" : ""
            }`}
          >
            {paper.abstract}
          </p>
          {abstractIsLong ? (
            <button
              type="button"
              className="paper-card__abstract-toggle"
              onClick={() => setAbstractExpanded((previous) => !previous)}
              aria-expanded={abstractExpanded}
            >
              {abstractExpanded ? "show less ↑" : "show more ↓"}
            </button>
          ) : null}
        </>
      ) : null}

      {paper.tags?.length > 0 ? (
        <div className="paper-card__tags">
          {paper.tags.slice(0, 10).map((tag) => (
            <span key={`${paper.id}-${tag}`} className="paper-card__tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="paper-card__actions">
        {externalUrl ? (
          <a className="paper-card__link" href={externalUrl} target="_blank" rel="noopener noreferrer">
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
        {paper.hasCode && paper.codeUrl ? (
          <a
            className="paper-card__link paper-card__link--github"
            href={paper.codeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="linked implementation"
          >
            <span className="paper-card__github-icon">
              <GithubMark />
            </span>
            linked code
          </a>
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
