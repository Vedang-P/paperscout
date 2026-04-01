import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import PaperList from "./components/PaperList";
import NotesPanel from "./components/NotesPanel";
import DeadlinesPanel from "./components/DeadlinesPanel";
import { fetchDeadlines, searchPapers } from "./api/papers";

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

function App() {
  const [query, setQuery] = useState("");
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [meta, setMeta] = useState(null);
  const [activeFilters, setActiveFilters] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(false);
  const [deadlinesError, setDeadlinesError] = useState(null);
  const [deadlinesUpdatedAt, setDeadlinesUpdatedAt] = useState(null);
  const [deadlineEventType, setDeadlineEventType] = useState("all");
  const [deadlinesOpenTotal, setDeadlinesOpenTotal] = useState(0);
  const [deadlinesFallbackMode, setDeadlinesFallbackMode] = useState("none");

  const loadDeadlines = useCallback(async () => {
    setDeadlinesLoading(true);
    setDeadlinesError(null);
    try {
      const data = await fetchDeadlines(12, deadlineEventType);
      setDeadlines(Array.isArray(data.deadlines) ? data.deadlines : []);
      setDeadlinesUpdatedAt(data.updatedAt || null);
      setDeadlinesOpenTotal(Number(data.openTotal) || 0);
      setDeadlinesFallbackMode(String(data?.fallback?.mode || "none"));
    } catch (err) {
      setDeadlinesError(err.message || "failed to load deadlines");
      setDeadlines([]);
      setDeadlinesOpenTotal(0);
      setDeadlinesFallbackMode("none");
    } finally {
      setDeadlinesLoading(false);
    }
  }, [deadlineEventType]);

  useEffect(() => {
    loadDeadlines();
    const intervalId = setInterval(loadDeadlines, 24 * 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [loadDeadlines]);

  const handleSearch = async ({ query: searchQuery, filters }) => {
    if (!searchQuery || !searchQuery.trim()) return;
    setQuery(searchQuery.trim());
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setActiveFilters(filters);
    try {
      const data = await searchPapers({ query: searchQuery.trim(), filters });
      setPapers(data.results || []);
      setMeta(data.meta || null);
    } catch (err) {
      const apiMessage = err?.response?.data?.error;
      setError(apiMessage || err.message || "something went wrong. is the backend running?");
      setPapers([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="app-rail app-rail--left">
        <NotesPanel />
      </aside>

      <main className="app-main">
        <Header />
        <SearchBar
          onSearch={handleSearch}
          suggestedTags={meta?.suggestedTags || []}
          availableFilters={meta?.availableFilters || null}
        />
        {hasSearched && (
          <PaperList
            papers={papers}
            loading={loading}
            error={error}
            query={query}
            meta={meta}
            filters={activeFilters}
          />
        )}
      </main>

      <aside className="app-rail app-rail--right">
        <DeadlinesPanel
          deadlines={deadlines}
          loading={deadlinesLoading}
          error={deadlinesError}
          updatedAt={deadlinesUpdatedAt}
          eventType={deadlineEventType}
          openTotal={deadlinesOpenTotal}
          fallbackMode={deadlinesFallbackMode}
          onEventTypeChange={setDeadlineEventType}
          onRefresh={loadDeadlines}
        />
      </aside>

      <footer className="app-credit">
        <span className="app-credit__text">made by vedang</span>
        <a
          className="app-credit__link"
          href="https://github.com/Vedang-P/paperscout"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="app-credit__icon">
            <GithubMark />
          </span>
          github repository
        </a>
      </footer>
    </div>
  );
}

export default App;
