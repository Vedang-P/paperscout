# PaperScout

PaperScout is a full-stack **research paper scraper and search app**.

It lets you search research papers from a clean React UI and serves results through an Express-style API.  
In the current version, search runs on a curated mock dataset (ready to be swapped with live scraping sources like arXiv, Semantic Scholar, etc.).

## Features

- Search papers by title, abstract, and author
- Lightweight API with health and search endpoints
- React + Vite frontend
- Express backend for local development
- Vercel-ready production setup with serverless API routes

## Tech Stack

- Frontend: React, Vite, Axios
- Backend: Node.js, Express
- Deployment: Vercel (static frontend + serverless API)

## Project Structure

```text
paperscout/
├─ frontend/                  # React app
├─ backend/                   # Local Express API server
│  └─ src/
│     ├─ data/mockPapers.js   # Mock paper dataset
│     ├─ services/paperSearch.js
│     └─ routes/papers.js
├─ api/                       # Vercel serverless functions
│  └─ papers/
│     ├─ health.js
│     └─ search.js
└─ vercel.json                # Vercel build/output config
```

## Run Locally

### 1. Start backend API

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`.

### 2. Start frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

The Vite dev server proxies `/api/*` to `http://localhost:5000` via `frontend/vite.config.js`.

## API Endpoints

Base path: `/api/papers`

### `GET /api/papers/health`

Health check endpoint.

Example response:

```json
{ "status": "ok" }
```

### `GET /api/papers/search?q=<query>`

Search papers by keyword.

- Required query param: `q`
- Returns HTTP `400` if `q` is missing or empty

Example:

```bash
curl "http://localhost:5000/api/papers/search?q=transformer"
```

## Deploy to Vercel

### Option A: Vercel Dashboard

1. Push repo to GitHub/GitLab/Bitbucket.
2. In Vercel, click **Add New Project** and import this repository.
3. Keep the root directory as the repository root.
4. Deploy.

`vercel.json` already configures:
- Install: `npm install --prefix frontend`
- Build: `npm run build --prefix frontend`
- Output: `frontend/dist`

Production API routes are:
- `/api/papers/health`
- `/api/papers/search?q=transformer`

### Option B: Vercel CLI

```bash
npm i -g vercel
cd /path/to/paperscout
vercel
```

Deploy to production:

```bash
vercel --prod
```

## Notes

- Current search is in **mock data mode** (`backend/src/data/mockPapers.js`).
- To make this a true live scraper, replace the mock search service with source-specific scraping/fetch logic and keep the same endpoint contracts.
