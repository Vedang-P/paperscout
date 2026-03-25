import axios from "axios";

const API_BASE = "/api/papers";

export async function searchPapers({ query, filters = {} }) {
  const params = {
    q: query,
    minYear: filters.minYear,
    maxYear: filters.maxYear,
    minCitations: filters.minCitations,
    maxCitations: filters.maxCitations,
    type: filters.type,
    limit: filters.limit,
  };

  if (Array.isArray(filters.venues) && filters.venues.length > 0) {
    params.venues = filters.venues.join(",");
  }

  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    params.tags = filters.tags.join(",");
  }

  const response = await axios.get(`${API_BASE}/search`, {
    params,
  });
  return response.data;
}

export async function checkHealth() {
  const response = await axios.get(`${API_BASE}/health`);
  return response.data;
}
