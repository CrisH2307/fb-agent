// src/components/SearchPanel.js
// Facebook Marketplace search — only renders when the local server is connected + logged in.

import React, { useState } from "react";

const SERVER_URL = "http://localhost:3001";

export default function SearchPanel({ onLoad }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setError(null);
    try {
      const res = await fetch(
        `${SERVER_URL}/search?q=${encodeURIComponent(query.trim())}`,
        { signal: AbortSignal.timeout(25000) }
      );
      const data = await res.json();
      if (data.error && !data.results?.length) {
        setError(data.error);
      } else {
        setResults(data.results || []);
        if (!data.results?.length) setError("No results found.");
      }
    } catch (err) {
      setError("Search failed — is the server running?");
    } finally {
      setSearching(false);
    }
  };

  const handleCardClick = async (url) => {
    setLoadingUrl(url);
    setError(null);
    try {
      const res = await fetch(
        `${SERVER_URL}/post?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(25000) }
      );
      const data = await res.json();
      if (data.text) {
        // Build a rich text blob the agent can parse
        const lines = [];
        if (data.posterName) lines.push(`Posted by: ${data.posterName}`);
        if (data.price) lines.push(`Price: ${data.price}`);
        if (data.location) lines.push(`Location: ${data.location}`);
        lines.push("", data.text);
        // Pass text, post URL, and poster name so App can track them for messaging
        onLoad(lines.join("\n").trim(), url, data.posterName || "");
      } else {
        setError(data.error || "Could not load post content.");
      }
    } catch {
      setError("Failed to load post — try again.");
    } finally {
      setLoadingUrl(null);
    }
  };

  return (
    <div className="search-panel">
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          className="search-input"
          type="text"
          placeholder="Search Facebook Marketplace…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="search-btn"
          type="submit"
          disabled={searching || !query.trim()}
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {error && <div className="search-error">⚠️ {error}</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button
              key={i}
              className={`search-result-card ${loadingUrl === r.url ? "search-result-card-loading" : ""}`}
              onClick={() => handleCardClick(r.url)}
              disabled={loadingUrl !== null}
              type="button"
            >
              {r.imageUrl && (
                <img
                  className="search-result-img"
                  src={r.imageUrl}
                  alt=""
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )}
              <div className="search-result-info">
                <span className="search-result-title">{r.title}</span>
                <span className="search-result-meta">
                  {[r.price, r.location].filter(Boolean).join(" · ")}
                </span>
              </div>
              {loadingUrl === r.url && <span className="search-result-spinner">…</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
