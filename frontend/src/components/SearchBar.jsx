import { useMemo, useState } from "react";

const DEFAULT_VENUES = ["ICLR", "ECCV", "ACCV"];
const VENUE_OPTIONS = ["ICLR", "ECCV", "ACCV", "ICCV", "CVPR", "ACL", "EMNLP", "NAACL"];
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

  const mergedTagSuggestions = useMemo(() => {
    const set = new Set([...DEFAULT_TAG_SUGGESTIONS, ...(suggestedTags || [])].map((tag) => tag.toLowerCase()));
    return Array.from(set);
  }, [suggestedTags]);

  const toggleVenue = (venue) => {
    setVenues((previous) =>
      previous.includes(venue) ? previous.filter((item) => item !== venue) : [...previous, venue]
    );
  };

  const toggleTag = (tag) => {
    setTags((previous) =>
      previous.includes(tag) ? previous.filter((item) => item !== tag) : [...previous, tag]
    );
  };

  const addCustomTag = () => {
    const normalized = customTag.trim().toLowerCase();
    if (!normalized) return;
    setTags((previous) => (previous.includes(normalized) ? previous : [...previous, normalized]));
    setCustomTag("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    onSearch({
      query: query.trim(),
      filters: {
        minYear: Number(minYear) || 2021,
        maxYear: Number(maxYear) || currentYear,
        minCitations: Number(minCitations) || 0,
        maxCitations: maxCitations === "" ? undefined : Number(maxCitations),
        type,
        venues,
        tags,
        limit: Number(limit) || 40,
      },
    });
  };

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

      <div className="filters">
        <label className="filters__field">
          <span>from year</span>
          <input type="number" min="2021" max={currentYear} value={minYear} onChange={(e) => setMinYear(e.target.value)} />
        </label>
        <label className="filters__field">
          <span>to year</span>
          <input type="number" min="2021" max={currentYear} value={maxYear} onChange={(e) => setMaxYear(e.target.value)} />
        </label>
        <label className="filters__field">
          <span>min citations</span>
          <input type="number" min="0" value={minCitations} onChange={(e) => setMinCitations(e.target.value)} />
        </label>
        <label className="filters__field">
          <span>max citations</span>
          <input type="number" min="0" placeholder="optional" value={maxCitations} onChange={(e) => setMaxCitations(e.target.value)} />
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
          <span>limit</span>
          <input type="number" min="1" max="100" value={limit} onChange={(e) => setLimit(e.target.value)} />
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
    </form>
  );
}
