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

  const handleSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await searchPapers(searchQuery);
      setPapers(data.results || []);
    } catch (err) {
      setError(err.message || "something went wrong. is the backend running?");
      setPapers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Header />
      <SearchBar onSearch={handleSearch} />
      {hasSearched && (
        <PaperList
          papers={papers}
          loading={loading}
          error={error}
          query={query}
        />
      )}
      <footer className="app__footer">
        paperscout &mdash; mock data mode &mdash; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default App;
