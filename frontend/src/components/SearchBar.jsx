import { useMemo, useState } from "react";

const VENUE_OPTIONS = [
  "ICLR",
  "ECCV",
  "ACCV",
  "ICCV",
  "CVPR",
  "WACV",
  "NEURIPS",
  "ICML",
  "AAAI",
  "IJCAI",
  "WWW",
  "KDD",
  "ACL",
  "EMNLP",
  "NAACL",
  "COLING",
];
const TYPE_OPTIONS = ["workshop", "conference", "journal"];
const PAPER_TYPE_OPTIONS = [
  "preprint",
  "survey",
  "demo",
  "dataset",
  "benchmark",
];
const SLIDER_TYPE_SET = new Set(TYPE_OPTIONS);
const TASK_OPTIONS = [
  "segmentation",
  "detection",
  "classification",
  "retrieval",
  "question answering",
  "generation",
  "llm",
  "vlm",
  "captioning",
  "translation",
];
const DATASET_OPTIONS = [
  "imagenet",
  "coco",
  "cityscapes",
  "ade20k",
  "mmlu",
  "squad",
  "librispeech",
  "wikitext",
  "kitti",
  "nuscenes",
];
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

function uniqueLowerCase(values) {
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

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

function CollapsibleFilterSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="filter-section">
      <button
        type="button"
        className="filter-section__toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="filter-section__title">{title}</span>
        <span
          className={
            isOpen
              ? "filter-section__chevron filter-section__chevron--open"
              : "filter-section__chevron"
          }
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {isOpen ? <div className="filter-section__body">{children}</div> : null}
    </section>
  );
}

export default function SearchBar({ onSearch, suggestedTags = [], availableFilters = null }) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState("");

  const [minYear, setMinYear] = useState(2021);
  const [maxYear, setMaxYear] = useState(currentYear);
  const [minCitations, setMinCitations] = useState(0);
  const [limit, setLimit] = useState(40);
  const [typeIndex, setTypeIndex] = useState(1);

  const [venues, setVenues] = useState(DEFAULT_VENUES);
  const [tags, setTags] = useState([]);
  const [paperTypes, setPaperTypes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [hasCodeOnly, setHasCodeOnly] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const [customTags, setCustomTags] = useState([]);
  const [openSections, setOpenSections] = useState({
    typeScope: true,
    venues: true,
    topicTags: true,
    paperTypes: false,
    tasks: false,
    datasets: false,
    implementation: false,
    customTags: false,
  });

  const mergedTagSuggestions = useMemo(() => {
    const combined = [...DEFAULT_TAG_SUGGESTIONS, ...(suggestedTags || []), ...customTags];
    return uniqueLowerCase(combined);
  }, [suggestedTags, customTags]);

  const mergedPaperTypes = useMemo(() => {
    const fromMeta = uniqueLowerCase(availableFilters?.paperTypes || []);
    const fallback = uniqueLowerCase(PAPER_TYPE_OPTIONS);
    const source = fromMeta.length > 0 ? fromMeta : fallback;
    return source.filter((paperType) => !SLIDER_TYPE_SET.has(paperType));
  }, [availableFilters]);

  const mergedTasks = useMemo(() => {
    const fromMeta = uniqueLowerCase(availableFilters?.tasks || []);
    const fallback = uniqueLowerCase(TASK_OPTIONS);
    return fromMeta.length > 0 ? fromMeta : fallback;
  }, [availableFilters]);

  const mergedDatasets = useMemo(() => {
    const fromMeta = uniqueLowerCase(availableFilters?.datasets || []);
    const fallback = uniqueLowerCase(DATASET_OPTIONS);
    return fromMeta.length > 0 ? fromMeta : fallback;
  }, [availableFilters]);

  const toggleVenue = (venue) => {
    setVenues((previous) =>
      previous.includes(venue)
        ? previous.filter((value) => value !== venue)
        : [...previous, venue]
    );
  };

  const toggleLowerListValue = (setter, value) => {
    const normalized = String(value || "").trim().toLowerCase();
    setter((previous) =>
      previous.includes(normalized)
        ? previous.filter((item) => item !== normalized)
        : [...previous, normalized]
    );
  };

  const addCustomTag = () => {
    const normalized = customTag.trim().toLowerCase();
    if (!normalized) return;
    setTags((previous) =>
      previous.includes(normalized) ? previous : [...previous, normalized]
    );
    setCustomTags((previous) =>
      previous.includes(normalized) ? previous : [...previous, normalized]
    );
    setCustomTag("");
  };

  const removeCustomTag = (tagToRemove) => {
    const normalized = String(tagToRemove || "").trim().toLowerCase();
    if (!normalized) return;
    setCustomTags((previous) => previous.filter((tag) => tag !== normalized));
    setTags((previous) => previous.filter((tag) => tag !== normalized));
  };

  const toggleSection = (sectionKey) => {
    setOpenSections((previous) => ({
      ...previous,
      [sectionKey]: !previous[sectionKey],
    }));
  };

  const buildFilters = () => {
    const normalizedMinYear = Math.min(minYear, maxYear);
    const normalizedMaxYear = Math.max(minYear, maxYear);
    const additionalPaperTypes = paperTypes.filter(
      (paperType) => !SLIDER_TYPE_SET.has(String(paperType || "").toLowerCase())
    );

    return {
      minYear: normalizedMinYear,
      maxYear: normalizedMaxYear,
      minCitations,
      type: TYPE_OPTIONS[typeIndex],
      limit,
      venues: venues.length === VENUE_OPTIONS.length ? [] : venues,
      tags,
      paperTypes: additionalPaperTypes,
      tasks,
      datasets,
      hasCode: hasCodeOnly ? true : null,
    };
  };

  const runSearch = (queryText) => {
    const normalizedQuery = String(queryText || "").trim();
    const filters = buildFilters();
    const hasRecommendationInput =
      Boolean(normalizedQuery) ||
      filters.tags.length > 0 ||
      filters.tasks.length > 0 ||
      filters.datasets.length > 0 ||
      filters.paperTypes.length > 0;
    if (!hasRecommendationInput) return;

    onSearch({
      query: normalizedQuery,
      filters,
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(query);
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
              max="1200"
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

        <CollapsibleFilterSection
          title="paper type scope"
          isOpen={openSections.typeScope}
          onToggle={() => toggleSection("typeScope")}
        >
          <div className="type-slider">
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
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          title="venues"
          isOpen={openSections.venues}
          onToggle={() => toggleSection("venues")}
        >
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
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          title="topic tags"
          isOpen={openSections.topicTags}
          onToggle={() => toggleSection("topicTags")}
        >
          <div className="switch-list">
            {mergedTagSuggestions.map((tag) => (
              <ToggleSwitch
                key={tag}
                label={tag}
                checked={tags.includes(tag)}
                onToggle={() => toggleLowerListValue(setTags, tag)}
              />
            ))}
          </div>
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          title="additional paper types"
          isOpen={openSections.paperTypes}
          onToggle={() => toggleSection("paperTypes")}
        >
          <div className="switch-list">
            {mergedPaperTypes.map((paperType) => (
              <ToggleSwitch
                key={paperType}
                label={paperType}
                checked={paperTypes.includes(paperType)}
                onToggle={() => toggleLowerListValue(setPaperTypes, paperType)}
              />
            ))}
          </div>
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          title="tasks"
          isOpen={openSections.tasks}
          onToggle={() => toggleSection("tasks")}
        >
          <div className="switch-list">
            {mergedTasks.map((task) => (
              <ToggleSwitch
                key={task}
                label={task}
                checked={tasks.includes(task)}
                onToggle={() => toggleLowerListValue(setTasks, task)}
              />
            ))}
          </div>
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          title="datasets"
          isOpen={openSections.datasets}
          onToggle={() => toggleSection("datasets")}
        >
          <div className="switch-list">
            {mergedDatasets.map((dataset) => (
              <ToggleSwitch
                key={dataset}
                label={dataset}
                checked={datasets.includes(dataset)}
                onToggle={() => toggleLowerListValue(setDatasets, dataset)}
              />
            ))}
          </div>
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          title="implementation"
          isOpen={openSections.implementation}
          onToggle={() => toggleSection("implementation")}
        >
          <div className="switch-list switch-list--single">
            <ToggleSwitch
              label="has linked code"
              checked={hasCodeOnly}
              onToggle={() => setHasCodeOnly((previous) => !previous)}
            />
          </div>
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          title="custom tags"
          isOpen={openSections.customTags}
          onToggle={() => toggleSection("customTags")}
        >
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

          {customTags.length > 0 ? (
            <div className="custom-tags-added">
              <p className="switch-group__title">custom tags added</p>
              <div className="custom-tags-added__list">
                {customTags.map((tag) => (
                  <span key={`custom-tag-${tag}`} className="custom-tags-added__item">
                    <span>{tag}</span>
                    <button
                      type="button"
                      className="custom-tags-added__remove"
                      onClick={() => removeCustomTag(tag)}
                      aria-label={`remove custom tag ${tag}`}
                      title={`remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </CollapsibleFilterSection>

      </section>

      <div className="search-shell__actions">
        <button
          type="button"
          className="search-bar__button search-bar__button--secondary"
          onClick={() => runSearch(query)}
        >
          run search
        </button>
      </div>
    </form>
  );
}
