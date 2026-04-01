import { useState } from "react";
import "./App.css";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import PaperList from "./components/PaperList";
import { searchPapers } from "./api/papers";

function App() {
  const [query, setQuery] = useState("");
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [meta, setMeta] = useState(null);
  const [activeFilters, setActiveFilters] = useState(null);

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
    <div className="app">
      <Header />
      <SearchBar onSearch={handleSearch} suggestedTags={meta?.suggestedTags || []} />
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
      <footer className="app__footer">
        sarveshu &mdash; academic paper recommender &mdash; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default App;
