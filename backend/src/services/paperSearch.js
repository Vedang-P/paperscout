const { MOCK_PAPERS } = require("../data/mockPapers");

function searchMockPapers(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const matches = MOCK_PAPERS.filter(
    (paper) =>
      paper.title.toLowerCase().includes(normalizedQuery) ||
      paper.abstract.toLowerCase().includes(normalizedQuery) ||
      paper.authors.some((author) => author.toLowerCase().includes(normalizedQuery))
  );

  return matches.length > 0 ? matches : MOCK_PAPERS;
}

module.exports = { searchMockPapers };
