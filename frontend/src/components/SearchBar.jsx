import { useMemo, useState } from "react";

const VENUE_OPTIONS = ["ICLR", "ECCV", "ACCV", "ICCV", "CVPR", "ACL", "EMNLP", "NAACL"];
const DEFAULT_VENUES = [...VENUE_OPTIONS];
const DEFAULT_TAG_SUGGESTIONS = [
  "nlp",
  "cv",
  "multimodal",
  "environment",
  "climate imagery",
  "remote sensing",
  "medical imaging",
  "vision-language",
  "efficiency",
  "low-resource",
  "evaluation",
  "safety",
];

export default function SearchBar({ onSearch, suggestedTags = [] }) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState("");
  const [minYear, setMinYear] = useState(2021);
  const [maxYear, setMaxYear] = useState(currentYear);
  const [minCitations, setMinCitations] = useState(0);
  const [maxCitations, setMaxCitations] = useState("");
  const [type, setType] = useState("workshop");
  const [limit, setLimit] = useState(40);
  const [venues, setVenues] = useState(DEFAULT_VENUES);
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const mergedTagSuggestions = useMemo(() => {
    const set = new Set([...DEFAULT_TAG_SUGGESTIONS, ...(suggestedTags || [])].map((tag) => tag.toLowerCase()));
    return Array.from(set);
  }, [suggestedTags]);

  const toggleVenue = (venue) => {
    setVenues((prev) => prev.includes(venue) ? prev.filter((v) => v !== venue) : [...prev, venue]);
  };

  const toggleTag = (tag) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    const normalized = customTag.trim().toLowerCase();
    if (!normalized) return;
    setTags((prev) => prev.includes(normalized) ? prev : [...prev, normalized]);
    setCustomTag("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    onSearch({
      query: query.trim(),
      filters: {
        minYear: Math.min(Number(minYear), Number(maxYear)),
        maxYear: Math.max(Number(minYear), Number(maxYear)),
        minCitations: Number(minCitations) || 0,
        maxCitations: maxCitations === "" ? undefined : Number(maxCitations),
        type,
        venues,
        tags,
        limit: Number(limit) || 40,
      },
    });
  };

  const filterSummary = `${minYear}–${maxYear} · citations ≥ ${minCitations} · limit ${limit} · ${type}`;

  return (
    <form className="search-shell" onSubmit={handleSubmit}>
      <div className="search-bar">
        <input
          className="search-bar__input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search workshop papers, topics, methods, authors..."
          autoFocus
          autoComplete="off"
          spellCheck="false"
        />
        <button className="search-bar__button" type="submit">
          search
        </button>
      </div>

      <div className="filters-section">
        <button
          type="button"
          className="filters-toggle"
          onClick={() => setFiltersOpen((prev) => !prev)}
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? "▾" : "▸"} filters
        </button>

        {!filtersOpen && <p className="filters-summary">{filterSummary}</p>}

        <div className={`filters-body ${filtersOpen ? "filters-body--open" : "filters-body--closed"}`}>
          <div className="filters">
            <label className="filters__field">
              <div className="filters__label-row">
                <span>from year</span>
                <span className="filters__label-value">{minYear}</span>
              </div>
              <input
                type="range"
                min="2000"
                max={currentYear}
                value={minYear}
                onChange={(e) => setMinYear(Number(e.target.value))}
              />
            </label>

            <label className="filters__field">
              <div className="filters__label-row">
                <span>to year</span>
                <span className="filters__label-value">{maxYear}</span>
              </div>
              <input
                type="range"
                min="2000"
                max={currentYear}
                value={maxYear}
                onChange={(e) => setMaxYear(Number(e.target.value))}
              />
            </label>

            <label className="filters__field">
              <span>type</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="workshop">workshop</option>
                <option value="conference">conference</option>
                <option value="all">all</option>
              </select>
            </label>

            <label className="filters__field">
              <div className="filters__label-row">
                <span>min citations</span>
                <span className="filters__label-value">{minCitations}</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="5"
                value={minCitations}
                onChange={(e) => setMinCitations(Number(e.target.value))}
              />
            </label>

            <label className="filters__field">
              <span>max citations</span>
              <input
                type="number"
                min="0"
                placeholder="optional"
                value={maxCitations}
                onChange={(e) => setMaxCitations(e.target.value)}
              />
            </label>

            <label className="filters__field">
              <div className="filters__label-row">
                <span>limit</span>
                <span className="filters__label-value">{limit}</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="chip-group">
            <p className="chip-group__label">venues</p>
            <div className="chip-group__items">
              {VENUE_OPTIONS.map((venue) => (
                <button
                  type="button"
                  key={venue}
                  className={`chip ${venues.includes(venue) ? "chip--active" : ""}`}
                  onClick={() => toggleVenue(venue)}
                >
                  {venue}
                </button>
              ))}
            </div>
          </div>

          <div className="chip-group">
            <p className="chip-group__label">tags</p>
            <div className="chip-group__items">
              {mergedTagSuggestions.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={`chip ${tags.includes(tag) ? "chip--active" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="custom-tag">
            <input
              className="custom-tag__input"
              type="text"
              value={customTag}
              onChange={(event) => setCustomTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="add custom tag"
            />
            <button type="button" className="custom-tag__button" onClick={addCustomTag}>
              add tag
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
