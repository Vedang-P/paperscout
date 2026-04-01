import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import PaperList from "./components/PaperList";
import NotesPanel from "./components/NotesPanel";
import DeadlinesPanel from "./components/DeadlinesPanel";
import { fetchDeadlines, searchPapers } from "./api/papers";

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

  const loadDeadlines = useCallback(async () => {
    setDeadlinesLoading(true);
    setDeadlinesError(null);
    try {
      const data = await fetchDeadlines(12);
      setDeadlines(Array.isArray(data.deadlines) ? data.deadlines : []);
      setDeadlinesUpdatedAt(data.updatedAt || null);
    } catch (err) {
      setDeadlinesError(err.message || "failed to load deadlines");
      setDeadlines([]);
    } finally {
      setDeadlinesLoading(false);
    }
  }, []);

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
          onRefresh={loadDeadlines}
        />
      </aside>
    </div>
  );
}

export default App;
