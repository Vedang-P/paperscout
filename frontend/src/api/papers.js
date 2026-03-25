import axios from "axios";

const API_BASE = "/api/papers";

export async function searchPapers(query) {
  const response = await axios.get(`${API_BASE}/search`, {
    params: { q: query },
  });
  return response.data;
}

export async function checkHealth() {
  const response = await axios.get(`${API_BASE}/health`);
  return response.data;
}
