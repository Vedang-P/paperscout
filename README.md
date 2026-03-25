# PaperScout

PaperScout is a research paper scraper and discovery app focused on workshop-heavy NLP/CV search.

It now runs on real multi-source retrieval (no mock dataset), with filters for:
- year (minimum year is fixed to 2021)
- citations
- venue/conference
- paper type (workshop/conference/all)
- tags (suggested + custom)

---

## What It Searches

Current integrated sources:
- **OpenAlex API** (broad scholarly metadata + citation counts)
- **DBLP API** (conference/workshop metadata discovery)
- **CVF Open Access scraper** (ACCV workshop pages and paper listings)

Primary venue focus:
- ICLR
- ECCV
- ACCV

Additional venue options are available (ICCV, CVPR, ACL, EMNLP, NAACL).

---

## Project Structure

```text
paperscout/
├─ frontend/                       # React + Vite UI
│  └─ src/
│     ├─ components/
│     │  ├─ SearchBar.jsx          # Query + filters + tags
│     │  ├─ PaperList.jsx
│     │  └─ PaperCard.jsx          # open source page / open pdf / open in app
│     └─ api/papers.js             # API client
│
├─ backend/
│  └─ src/
│     ├─ adapters/
│     │  ├─ openAlexAdapter.js
│     │  ├─ dblpAdapter.js
│     │  └─ cvfWorkshopAdapter.js
│     ├─ services/
│     │  ├─ paperSearch.js         # Orchestrator: aggregate + dedupe + filter + rank
│     │  ├─ filterParser.js
│     │  ├─ citationEnricher.js
│     │  └─ tagger.js
│     ├─ config/searchConfig.js
│     ├─ utils/
│     │  ├─ text.js
│     │  └─ cache.js
│     └─ routes/papers.js
│
├─ api/papers/                     # Vercel serverless API
│  ├─ health.js
│  └─ search.js
└─ vercel.json
```

---

## Local Development

### 1. Start backend

```bash
cd backend
npm install
npm run dev
```

Backend: `http://localhost:5000`

### 2. Start frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Vite proxies `/api/*` to `http://localhost:5000`.

---

## API

### `GET /api/papers/health`

Response:

```json
{ "status": "ok" }
```

### `GET /api/papers/search`

Required:
- `q`: query string

Optional:
- `minYear` (default `2021`, cannot go below 2021)
- `maxYear` (default current year)
- `minCitations` (default `0`)
- `maxCitations`
- `type`: `workshop | conference | all` (default `workshop`)
- `venues`: comma-separated list (`ICLR,ECCV,ACCV`)
- `tags`: comma-separated tags
- `limit` (default `40`, max `100`)

Example:

```bash
curl "http://localhost:5000/api/papers/search?q=vision%20language%20model&minYear=2021&minCitations=10&type=workshop&venues=ICLR,ECCV,ACCV&tags=cv,multimodal"
```

---

## Deploy on Vercel

### Dashboard

1. Push repo to GitHub/GitLab/Bitbucket.
2. Import project in Vercel.
3. Keep root directory as repo root.
4. Deploy.

`vercel.json` already configures:
- install command for both `frontend` and `backend`
- frontend build command
- frontend static output directory

### CLI

```bash
npm i -g vercel
cd /path/to/paperscout
vercel
vercel --prod
```

---

## Backend Implementation Guide (What You Need To Do Next)

The current backend is a strong MVP. To make it production-grade:

1. Add more source adapters
- `backend/src/adapters/openReviewAdapter.js` for ICLR workshop coverage from OpenReview endpoints.
- `backend/src/adapters/ecvaAdapter.js` for ECCV workshop pages.
- Optional: ACL Anthology workshop adapter for NLP-heavy retrieval.

2. Add persistence layer
- Introduce Postgres tables for `papers`, `venues`, `tags`, `search_cache`.
- Store normalized paper records with a canonical ID (DOI > arXiv > title hash).

3. Move scraping off request path
- Add a queue worker (BullMQ/Redis or a cron worker).
- API request should read mostly from cache/database and trigger async refresh.

4. Add robust rate-limit handling
- Exponential backoff and retry budget per source.
- Circuit-breaker behavior per adapter.

5. Improve ranking
- Blend text relevance + citations + recency + workshop boost + venue focus.
- Add learned re-ranking later (optional).

6. Add observability
- Structured logs per adapter (`latency`, `hit_count`, `errors`).
- Metrics dashboard for source health and result quality.

7. Add testing
- Unit tests for parsers/normalizers/tagger.
- Adapter snapshot tests for scraper HTML parsing.
- Contract tests for `/api/papers/search`.

---

## Environment Variables

Optional:
- `CVF_MAX_WORKSHOP_PAGES` (default `10`) to control workshop scraping breadth.

Future:
- API keys for premium sources and higher request limits.
