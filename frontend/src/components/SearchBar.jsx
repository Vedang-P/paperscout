import { useMemo, useState } from "react";

const VENUE_OPTIONS = ["ICLR", "ECCV", "ACCV", "ICCV", "CVPR", "ACL", "EMNLP", "NAACL"];
const TYPE_OPTIONS = ["workshop", "conference", "all"];
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

function ToggleSwitch({ checked, label, onToggle }) {
  return (
    <label className="switch-item">
      <span className="switch-item__label">{label}</span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="switch__slider" />
      </span>
    </label>
  );
}

export default function SearchBar({ onSearch, suggestedTags = [] }) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState("");

  const [minYear, setMinYear] = useState(2021);
  const [maxYear, setMaxYear] = useState(currentYear);
  const [minCitations, setMinCitations] = useState(0);
  const [limit, setLimit] = useState(24);
  const [typeIndex, setTypeIndex] = useState(0);

  const [venues, setVenues] = useState(DEFAULT_VENUES);
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState("");

  const mergedTagSuggestions = useMemo(() => {
    const combined = [...DEFAULT_TAG_SUGGESTIONS, ...(suggestedTags || [])].map((tag) =>
      String(tag).toLowerCase()
    );
    return Array.from(new Set(combined));
  }, [suggestedTags]);

  const toggleVenue = (venue) => {
    setVenues((previous) =>
      previous.includes(venue)
        ? previous.filter((value) => value !== venue)
        : [...previous, venue]
    );
  };

  const toggleTag = (tag) => {
    setTags((previous) =>
      previous.includes(tag)
        ? previous.filter((value) => value !== tag)
        : [...previous, tag]
    );
  };

  const addCustomTag = () => {
    const normalized = customTag.trim().toLowerCase();
    if (!normalized) return;
    setTags((previous) =>
      previous.includes(normalized) ? previous : [...previous, normalized]
    );
    setCustomTag("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    const normalizedMinYear = Math.min(minYear, maxYear);
    const normalizedMaxYear = Math.max(minYear, maxYear);

    onSearch({
      query: query.trim(),
      filters: {
        minYear: normalizedMinYear,
        maxYear: normalizedMaxYear,
        minCitations,
        type: TYPE_OPTIONS[typeIndex],
        limit,
        venues,
        tags,
      },
    });
  };

  return (
    <form className="search-shell" onSubmit={handleSubmit}>
      <div className="search-input-wrap">
        <input
          className="search-bar__input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search papers, methods, datasets, authors..."
          autoComplete="off"
          spellCheck="false"
          autoFocus
        />
        <button type="submit" className="search-bar__button">
          query
        </button>
      </div>

      <section className="filters-panel">
        <div className="slider-grid">
          <label className="slider-field">
            <div className="slider-field__meta">
              <span>from year</span>
              <strong>{minYear}</strong>
            </div>
            <input
              type="range"
              min="2021"
              max={currentYear}
              value={minYear}
              onChange={(event) => setMinYear(Number(event.target.value))}
            />
          </label>

          <label className="slider-field">
            <div className="slider-field__meta">
              <span>to year</span>
              <strong>{maxYear}</strong>
            </div>
            <input
              type="range"
              min="2021"
              max={currentYear}
              value={maxYear}
              onChange={(event) => setMaxYear(Number(event.target.value))}
            />
          </label>

          <label className="slider-field">
            <div className="slider-field__meta">
              <span>min citations</span>
              <strong>{minCitations}</strong>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="5"
              value={minCitations}
              onChange={(event) => setMinCitations(Number(event.target.value))}
            />
          </label>

          <label className="slider-field">
            <div className="slider-field__meta">
              <span>result limit</span>
              <strong>{limit}</strong>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="1"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="type-slider">
          <p className="type-slider__label">paper type</p>
          <input
            type="range"
            min="0"
            max={TYPE_OPTIONS.length - 1}
            step="1"
            value={typeIndex}
            onChange={(event) => setTypeIndex(Number(event.target.value))}
          />
          <div className="type-slider__ticks">
            {TYPE_OPTIONS.map((option, index) => (
              <span
                key={option}
                className={
                  index === typeIndex
                    ? "type-slider__tick type-slider__tick--active"
                    : "type-slider__tick"
                }
              >
                {option}
              </span>
            ))}
          </div>
        </div>

        <div className="switch-group">
          <p className="switch-group__title">venues</p>
          <div className="switch-list">
            {VENUE_OPTIONS.map((venue) => (
              <ToggleSwitch
                key={venue}
                label={venue}
                checked={venues.includes(venue)}
                onToggle={() => toggleVenue(venue)}
              />
            ))}
          </div>
        </div>

        <div className="switch-group">
          <p className="switch-group__title">topic tags</p>
          <div className="switch-list">
            {mergedTagSuggestions.map((tag) => (
              <ToggleSwitch
                key={tag}
                label={tag}
                checked={tags.includes(tag)}
                onToggle={() => toggleTag(tag)}
              />
            ))}
          </div>
        </div>

        <div className="custom-tag">
          <input
            className="custom-tag__input"
            type="text"
            value={customTag}
            onChange={(event) => setCustomTag(event.target.value)}
            placeholder="add custom tag"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomTag();
              }
            }}
          />
          <button type="button" className="custom-tag__button" onClick={addCustomTag}>
            add
          </button>
        </div>
      </section>
    </form>
  );
}
