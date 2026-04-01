import axios from "axios";

const API_BASE = "/api/papers";
const API_TIMEOUT_MS = 20000;

const apiClient = axios.create({
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
  },
});

function toApiError(error, fallbackMessage) {
  const responseMessage = error?.response?.data?.error;
  const detailsMessage = error?.response?.data?.details;
  const baseMessage = responseMessage || detailsMessage || error?.message || fallbackMessage;
  const normalized = String(baseMessage || fallbackMessage || "request failed")
    .replace(/^network error$/i, "network unavailable")
    .trim();
  return new Error(normalized || fallbackMessage || "request failed");
}

async function safeGet(url, options, fallbackMessage) {
  try {
    const response = await apiClient.get(url, options);
    return response.data;
  } catch (error) {
    throw toApiError(error, fallbackMessage);
  }
}

async function safePost(url, payload, fallbackMessage) {
  try {
    const response = await apiClient.post(url, payload);
    return response.data;
  } catch (error) {
    throw toApiError(error, fallbackMessage);
  }
}

async function safeDelete(url, options, fallbackMessage) {
  try {
    const response = await apiClient.delete(url, options);
    return response.data;
  } catch (error) {
    throw toApiError(error, fallbackMessage);
  }
}

export async function searchPapers({ query, filters = {} }) {
  const params = {
    minYear: filters.minYear,
    maxYear: filters.maxYear,
    minCitations: filters.minCitations,
    maxCitations: filters.maxCitations,
    type: filters.type,
    limit: filters.limit,
    hasCode: filters.hasCode,
  };

  const normalizedQuery = String(query || "").trim();
  if (normalizedQuery) {
    params.q = normalizedQuery;
  }

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

  return safeGet(
    `${API_BASE}/recommend`,
    {
      params,
    },
    "failed to fetch recommendations"
  );
}

export async function fetchDeadlines(limit = 12, eventType = "all") {
  return safeGet(
    "/api/deadlines",
    {
      params: { limit, eventType },
    },
    "failed to fetch deadlines"
  );
}

export async function fetchNotes(userName) {
  return safeGet(
    "/api/notes",
    {
      params: { userName },
    },
    "failed to load notes"
  );
}

export async function addNote(payload) {
  return safePost("/api/notes", payload, "failed to save note");
}

export async function deleteNote(id, userName) {
  return safeDelete(
    "/api/notes",
    {
      data: { id, userName },
    },
    "failed to delete note"
  );
}
