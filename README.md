# PaperScout

PaperScout is a research paper scraper and discovery platform for **workshop-heavy NLP + CV search**.

It aggregates real data from multiple sources (no mock mode), then runs a **hybrid recommendation model** over the candidates.

## Highlights

- Multi-source retrieval (OpenAlex + DBLP + CVF workshop scraping)
- Workshop-focused search for venues like ICLR / ECCV / ACCV
- Filters: year, citations, paper type, venue, tags
- Year floor enforced at **2021**
- Hybrid recommendation ranker with semantic similarity, lexical overlap, citation quality/velocity, venue priors, personalization, and MMR diversity reranking
- Paper actions in UI: open source page, open pdf, open in app (embedded view with fallback)

## Current Data Sources

- **OpenAlex API**
  broad scholarly coverage with citation metadata
- **DBLP API**
  venue/conference/workshop discovery
- **CVF Open Access scraper**
  ACCV workshop menus and paper pages

## Venue Focus

- Primary: `ICLR`, `ECCV`, `ACCV`
- Also supported in filters: `ICCV`, `CVPR`, `ACL`, `EMNLP`, `NAACL`

## 60-Second Local Setup

1. Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs at `http://localhost:5000`.

2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

`frontend/vite.config.js` proxies `/api/*` to backend.

## API

### Health

`GET /api/papers/health`

```json
{ "status": "ok" }
```

### Search

`GET /api/papers/search`

Required:
- `q`: query text

Optional:
- `minYear` (default `2021`, clamped to `>= 2021`)
- `maxYear` (default current year)
- `minCitations` (default `0`)
- `maxCitations`
- `type`: `workshop | conference | all` (default `workshop`)
- `venues`: comma-separated list, e.g. `ICLR,ECCV,ACCV`
- `tags`: comma-separated list, e.g. `cv,multimodal`
- `limit` (default `40`, max `100`)

Example request:

```bash
curl "http://localhost:5000/api/papers/search?q=vision%20language%20model&minYear=2021&minCitations=10&type=workshop&venues=ICLR,ECCV,ACCV&tags=cv,multimodal&limit=20"
```

Example response shape:

```json
{
  "query": "vision language model",
  "filters": {
    "minYear": 2021,
    "maxYear": 2026,
    "minCitations": 10,
    "maxCitations": null,
    "type": "workshop",
    "venues": ["ICLR", "ECCV", "ACCV"],
    "tags": ["cv", "multimodal"],
    "limit": 20
  },
  "total": 12,
  "results": [
    {
      "id": "openalex:...",
      "title": "Paper title",
      "authors": ["A", "B"],
      "year": 2024,
      "venue": "ACCV Workshop: ...",
      "conference": "ACCV",
      "isWorkshop": true,
      "citationCount": 24,
      "url": "https://...",
      "pdfUrl": "https://...",
      "tags": ["cv", "multimodal"]
    }
  ],
  "meta": {
    "totalBeforeFilter": 120,
    "totalAfterFilter": 12,
    "dataSources": ["OpenAlex", "DBLP", "CVF Open Access"],
    "suggestedTags": ["nlp", "cv", "multimodal"],
    "normalizedQuery": "vision language model"
  }
}
```

### Recommend

`GET /api/papers/recommend`

Required:
- one of `q` or `tags`

Optional model controls:
- `preferredAuthors` (comma-separated)
- `excludeAuthors` (comma-separated)
- `excludeTags` (comma-separated)
- `seedTitles` (comma-separated)
- `keywords` (comma-separated)
- `diversity` (`0` to `1`, default `0.25`)

Example request:

```bash
curl "http://localhost:5000/api/papers/recommend?q=vision%20language%20model&minYear=2021&type=workshop&venues=ICLR,ECCV,ACCV&tags=cv,multimodal&preferredAuthors=keiji%20yanai&diversity=0.35&limit=20"
```

## Architecture (Current)

Recommendation pipeline:

1. Parse query + filters
2. Gather candidates from adapters in parallel
3. Normalize and deduplicate records (DOI/url/pdf/title fingerprints)
4. Enrich missing citation counts (OpenAlex, cached)
5. Infer tags from title/abstract/venue
6. Apply hard filters and profile constraints
7. Compute hybrid ranking features
8. Apply diversity reranking with MMR
9. Return ranked recommendations with feature explanations

Key backend files:

- `backend/src/adapters/openAlexAdapter.js`
- `backend/src/adapters/dblpAdapter.js`
- `backend/src/adapters/cvfWorkshopAdapter.js`
- `backend/src/services/candidateAggregator.js`
- `backend/src/services/paperSearch.js`
- `backend/src/services/recommendationModel.js`
- `backend/src/services/vectorSpace.js`
- `backend/src/services/citationEnricher.js`
- `backend/src/services/filterParser.js`
- `backend/src/services/tagger.js`

## Repository Layout

```text
paperscout/
├─ frontend/                    # React + Vite client
├─ backend/                     # Express API for local dev
├─ api/papers/                  # Vercel serverless functions
└─ vercel.json                  # Vercel project config
```

## Deploy to Vercel

### Dashboard

1. Push repository to GitHub/GitLab/Bitbucket.
2. Import into Vercel.
3. Keep project root at repository root.
4. Deploy.

`vercel.json` handles:
- install command for backend + frontend
- frontend build command
- static output directory

### CLI

```bash
npm i -g vercel
cd /path/to/paperscout
vercel
vercel --prod
```

## Backend Roadmap (Production)

1. Add missing venue adapters
`openReviewAdapter` for ICLR workshops, `ecvaAdapter` for ECCV workshops, and optional ACL Anthology support.

2. Add persistence and async scraping
Use Postgres as canonical store, Redis/BullMQ for refresh jobs, and serve cached results on request path.

3. Improve resilience
Add adapter retry/backoff, rate-limit-aware throttling, and per-source circuit breakers.

4. Improve ranking and relevance
Add stronger BM25/embedding rerank, venue/workshop priors, and feedback-based tuning.

5. Add observability and tests
Add adapter metrics (`latency`, `error_rate`, `yield`), parser snapshot tests, and API contract tests.

## Environment Variables

Optional:
- `CVF_MAX_WORKSHOP_PAGES` (default `10`) controls ACCV workshop scraping breadth per query.

Future:
- source API keys for higher quota and richer metadata.

## Known Limitations

- Source coverage is currently strongest for ACCV workshop scraping.
- Some external pages block iframe embedding; `open in app` falls back to external links.
- First search can be slower because live scraping/enrichment runs on request path.
