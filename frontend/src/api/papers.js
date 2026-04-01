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
    hasCode: filters.hasCode,
  };

  if (Array.isArray(filters.venues) && filters.venues.length > 0) {
    params.venues = filters.venues.join(",");
  }

  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    params.tags = filters.tags.join(",");
  }

  if (Array.isArray(filters.paperTypes) && filters.paperTypes.length > 0) {
    params.paperTypes = filters.paperTypes.join(",");
  }

  if (Array.isArray(filters.tasks) && filters.tasks.length > 0) {
    params.tasks = filters.tasks.join(",");
  }

  if (Array.isArray(filters.datasets) && filters.datasets.length > 0) {
    params.datasets = filters.datasets.join(",");
  }

  const response = await axios.get(`${API_BASE}/recommend`, {
    params,
  });
  return response.data;
}

export async function checkHealth() {
  const response = await axios.get(`${API_BASE}/health`);
  return response.data;
}

export async function fetchDeadlines(limit = 12, eventType = "all") {
  const response = await axios.get("/api/deadlines", {
    params: { limit, eventType },
  });
  return response.data;
}

export async function fetchNotes(userName) {
  const response = await axios.get("/api/notes", {
    params: { userName },
  });
  return response.data;
}

export async function addNote(payload) {
  const response = await axios.post("/api/notes", payload);
  return response.data;
}

export async function deleteNote(id, userName) {
  const response = await axios.delete("/api/notes", {
    data: { id, userName },
  });
  return response.data;
}
