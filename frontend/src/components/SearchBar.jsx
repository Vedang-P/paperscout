import { useEffect, useMemo, useState } from "react";

const VENUE_OPTIONS = ["ICLR", "ECCV", "ACCV", "ICCV", "CVPR", "ACL", "EMNLP", "NAACL"];
const TYPE_OPTIONS = ["workshop", "conference", "all"];
const PAPER_TYPE_OPTIONS = [
  "workshop",
  "conference",
  "journal",
  "preprint",
  "survey",
  "demo",
  "dataset",
  "benchmark",
];
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
const PRESETS_STORAGE_KEY = "sarveshu-search-presets";
const MAX_PRESETS = 20;

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

function parseStoredPresets() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uniqueLowerCase(values) {
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
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

export default function SearchBar({ onSearch, suggestedTags = [], availableFilters = null }) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState("");

  const [minYear, setMinYear] = useState(2021);
  const [maxYear, setMaxYear] = useState(currentYear);
  const [minCitations, setMinCitations] = useState(0);
  const [limit, setLimit] = useState(24);
  const [typeIndex, setTypeIndex] = useState(0);

  const [venues, setVenues] = useState(DEFAULT_VENUES);
  const [tags, setTags] = useState([]);
  const [paperTypes, setPaperTypes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [hasCodeOnly, setHasCodeOnly] = useState(false);
  const [customTag, setCustomTag] = useState("");

  const [presetName, setPresetName] = useState("");
  const [presetId, setPresetId] = useState("");
  const [savedPresets, setSavedPresets] = useState(() => parseStoredPresets());

  const mergedTagSuggestions = useMemo(() => {
    const combined = [...DEFAULT_TAG_SUGGESTIONS, ...(suggestedTags || [])];
    return uniqueLowerCase(combined);
  }, [suggestedTags]);

  const mergedPaperTypes = useMemo(() => {
    const fromMeta = uniqueLowerCase(availableFilters?.paperTypes || []);
    const fallback = uniqueLowerCase(PAPER_TYPE_OPTIONS);
    return fromMeta.length > 0 ? fromMeta : fallback;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

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
    setCustomTag("");
  };

  const buildFilters = () => {
    const normalizedMinYear = Math.min(minYear, maxYear);
    const normalizedMaxYear = Math.max(minYear, maxYear);

    return {
      minYear: normalizedMinYear,
      maxYear: normalizedMaxYear,
      minCitations,
      type: TYPE_OPTIONS[typeIndex],
      limit,
      venues,
      tags,
      paperTypes,
      tasks,
      datasets,
      hasCode: hasCodeOnly ? true : null,
    };
  };

  const runSearch = (queryText) => {
    const normalizedQuery = String(queryText || "").trim();
    if (!normalizedQuery) return;

    onSearch({
      query: normalizedQuery,
      filters: buildFilters(),
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(query);
  };

  const handleSavePreset = () => {
    const normalizedName = presetName.trim() || query.trim() || "preset";
    const preset = {
      id: createId(),
      name: normalizedName,
      query: query.trim(),
      filters: buildFilters(),
      createdAt: new Date().toISOString(),
    };

    setSavedPresets((previous) => [preset, ...previous].slice(0, MAX_PRESETS));
    setPresetId(preset.id);
    setPresetName("");
  };

  const applyPreset = () => {
    const selected = savedPresets.find((preset) => preset.id === presetId);
    if (!selected) return;

    const presetQuery = String(selected.query || "");
    const presetFilters = selected.filters || {};

    setQuery(presetQuery);
    setMinYear(Number(presetFilters.minYear) || 2021);
    setMaxYear(Number(presetFilters.maxYear) || currentYear);
    setMinCitations(Number(presetFilters.minCitations) || 0);
    setLimit(Number(presetFilters.limit) || 24);

    const presetType = String(presetFilters.type || "workshop").toLowerCase();
    const resolvedTypeIndex = Math.max(0, TYPE_OPTIONS.indexOf(presetType));
    setTypeIndex(resolvedTypeIndex);

    const presetVenues = Array.isArray(presetFilters.venues)
      ? presetFilters.venues.filter((venue) => VENUE_OPTIONS.includes(venue))
      : DEFAULT_VENUES;

    setVenues(presetVenues.length > 0 ? presetVenues : DEFAULT_VENUES);
    setTags(uniqueLowerCase(presetFilters.tags || []));
    setPaperTypes(uniqueLowerCase(presetFilters.paperTypes || []));
    setTasks(uniqueLowerCase(presetFilters.tasks || []));
    setDatasets(uniqueLowerCase(presetFilters.datasets || []));
    setHasCodeOnly(Boolean(presetFilters.hasCode));

    if (presetQuery.trim()) {
      onSearch({
        query: presetQuery.trim(),
        filters: presetFilters,
      });
    }
  };

  const deletePreset = () => {
    if (!presetId) return;
    setSavedPresets((previous) => previous.filter((preset) => preset.id !== presetId));
    setPresetId("");
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

        <div className="type-slider">
          <p className="type-slider__label">venue scope</p>
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
                onToggle={() => toggleLowerListValue(setTags, tag)}
              />
            ))}
          </div>
        </div>

        <div className="switch-group">
          <p className="switch-group__title">paper record types</p>
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
        </div>

        <div className="switch-group">
          <p className="switch-group__title">tasks</p>
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
        </div>

        <div className="switch-group">
          <p className="switch-group__title">datasets</p>
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
        </div>

        <div className="switch-group">
          <p className="switch-group__title">implementation</p>
          <div className="switch-list switch-list--single">
            <ToggleSwitch
              label="has linked code"
              checked={hasCodeOnly}
              onToggle={() => setHasCodeOnly((previous) => !previous)}
            />
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

        <div className="preset-bar">
          <div className="preset-bar__row">
            <input
              className="preset-bar__input"
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="preset name"
            />
            <button type="button" className="preset-bar__button" onClick={handleSavePreset}>
              save preset
            </button>
          </div>

          <div className="preset-bar__row">
            <select
              className="preset-bar__select"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
            >
              <option value="">select preset</option>
              {savedPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button type="button" className="preset-bar__button" onClick={applyPreset}>
              apply
            </button>
            <button type="button" className="preset-bar__button" onClick={deletePreset}>
              delete
            </button>
          </div>
        </div>
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
