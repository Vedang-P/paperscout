# Sarveshu

Sarveshu is a production-oriented paper discovery engine for CV + NLP, focused on workshop/conference/journal discovery from 2021 onward.

## System Overview

Request flow:

1. Frontend sends `GET /api/papers/recommend` with query + filters.
2. Backend parses and clamps filters (`minYear`, `maxYear`, `limit`, etc.).
3. Query is typo-normalized (fuzzy correction) before retrieval/ranking.
   - Query can be empty if filters/tags/tasks/datasets drive intent.
4. Multi-source retrieval runs in parallel (OpenAlex, DBLP, arXiv, CVF workshop scraper).
5. Candidates are normalized, tagged, typed, deduplicated, and citation-enriched.
6. Hard filters are applied.
7. Hybrid ranking + MMR diversification reranks results.
8. Response includes ranked papers + explainability metadata.

## Core Pipeline

### 1) Filter Parsing

File: `backend/src/services/filterParser.js`

- Clamps years to `>= 2021` and `<= current year`.
- Clamps `limit` to `[1, 100]`.
- Parses `venues/tags/paperTypes/tasks/datasets` as unique lists.
- Caps list size and item length to prevent oversized payload abuse.
- Normalizes type scope: `workshop | conference | journal | all`.

### 2) Typo Tolerance + Query Normalization

Files:

- `backend/src/services/fuzzyQuery.js`
- `backend/src/utils/text.js`
- `backend/src/services/vectorSpace.js`

Behavior:

- Query tokens are typo-corrected using bounded Levenshtein against domain vocabulary (venues, tags, tasks, datasets, paper types, core terms).
- Retrieval query uses both original + corrected query when correction is applied.
- Lexical scoring gives partial credit for fuzzy token matches.
- Response metadata includes:
  - `meta.queryNormalization`
  - `meta.sourceQuery`

### 3) Source Retrieval

Files:

- `backend/src/adapters/openAlexAdapter.js`
- `backend/src/adapters/dblpAdapter.js`
- `backend/src/adapters/arxivAdapter.js`
- `backend/src/adapters/cvfWorkshopAdapter.js`
- `backend/src/services/candidateAggregator.js`

Behavior:

- All sources queried in parallel.
- Adapter failures are isolated (single source failure does not crash the request).
- Candidate-level cache added for hot queries to reduce provider load and improve latency.
- If providers temporarily fail, stale cached candidates are reused for the same query/filter key.

### 4) Normalization + Enrichment

Files:

- `backend/src/services/paperClassifier.js`
- `backend/src/services/tagger.js`
- `backend/src/services/citationEnricher.js`

Behavior:

- Infers `paperTypes`, `tasks`, `datasets`, `hasCode`, `codeUrl`.
- Merges tags with inferred metadata.
- Enriches missing citation counts via OpenAlex (cached).

### 5) Deduplication

File: `backend/src/services/candidateAggregator.js`

Dedup keys:

- DOI
- PDF URL
- canonical URL
- normalized title key

Merge policy preserves richer metadata and stronger source signal.

### 6) Hard Filters + Ranking

File: `backend/src/services/recommendationModel.js`

Hard filters:

- year/citation/type/venue/tags/paperTypes/tasks/datasets/hasCode
- excluded tags/authors

Scoring signals:

- semantic relevance (TF-IDF cosine)
- lexical/fuzzy token coverage
- citation strength + citation velocity
- recency
- tag/type/task/dataset match
- venue priors
- author preference
- workshop/code/meta/source quality

Then MMR reranking increases diversity.

### 7) Fallback Strategy

File: `backend/src/services/recommendationModel.js`

If strict filters over-constrain results, relaxation steps run progressively and are reported in `meta.fallback.steps`.

## Deadlines Engine

Files:

- `backend/src/services/deadlinesService.js`
- `api/deadlines.js`

Rules:

- Uses only verified official sources (no estimated deadlines).
- Ranking: open first, then closest due date.
- If open set is empty, API returns nearest verified closed deadlines with fallback metadata (`fallback.mode = closed_only`) instead of an empty panel.
- If fresh deadline fetch fails, the service can reuse stale verified cache rather than returning an empty state.

Files:

- `backend/src/services/notesStore.js`
- `api/notes.js`

Behavior:

- Per-userName scoped notes.
- Upsert-on-title behavior (same title updates existing note).
- Input normalization + size limits for title/remark/url.
- Supports Vercel KV via REST command calls (if configured); otherwise memory fallback.
- Frontend also keeps local-device fallback for resilience when API is unavailable.

## API Surface

- `GET /api/papers/health`
- `GET /api/papers/search`
- `GET /api/papers/recommend`
- `GET /api/deadlines`
- `GET/POST/DELETE /api/notes`

## Environment Variables

### Backend runtime

- `PORT` (default `5000`)
- `BODY_LIMIT` (default `256kb`)
- `CORS_ORIGIN` (optional comma-separated allowlist)


## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Production Build Checks

```bash
cd frontend && npm run build
```

## Deployment (Vercel)

- API uses `api/**/*.js` serverless handlers.
- Frontend built from `frontend/` Vite output.
- `vercel.json` sets Node runtime + max duration for API functions and baseline security headers.

## Production Hardening Included

- Request body size limit
- Optional strict CORS allowlist
- Basic security headers
- Improved API timeout/error handling on frontend client
- Query typo tolerance
- Candidate caching
- Removal of dead frontend assets and redundant API utility code paths

