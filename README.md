# Sarveshu

Sarveshu is a research paper discovery engine focused on NLP and CV.

This README explains the **actual system logic** step-by-step, from user input to ranked output.

## Core Goal

Given a query and filters, Sarveshu should:

1. Fetch papers from multiple sources.
2. Normalize everything into one common schema.
3. Enrich missing metadata (especially citations and tags).
4. Rank candidates with a hybrid model.
5. Return diverse, explainable recommendations.

## End-to-End Pipeline

### Step 1: Input Parsing and Safety Clamping

Entry points:

- Local Express routes: [backend/src/routes/papers.js](/Users/vedang/paperscout/backend/src/routes/papers.js)
- Vercel serverless routes: [api/papers/recommend.js](/Users/vedang/paperscout/api/papers/recommend.js), [api/papers/search.js](/Users/vedang/paperscout/api/papers/search.js)

Filter parsing lives in [backend/src/services/filterParser.js](/Users/vedang/paperscout/backend/src/services/filterParser.js).

What happens here:

1. Parse raw query params.
2. Clamp years so `minYear >= 2021` and `maxYear <= current year`.
3. Clamp `limit` to `[1, 100]`.
4. Normalize list filters (`venues`, `tags`, `paperTypes`, `tasks`, `datasets`) into lowercase/unique arrays.
5. Parse `hasCode` into `true | false | null`.
6. Parse model controls (`diversity`, preferred/excluded authors, seed titles, keywords).

Why this step matters:

- Prevents invalid requests from breaking later stages.
- Enforces project policy (no pre-2021 papers).
- Gives every downstream module a clean, typed filter object.

### Step 2: Query Construction

Query builder: [backend/src/services/paperSearch.js](/Users/vedang/paperscout/backend/src/services/paperSearch.js)

If user query `q` is empty, system composes a fallback query from:

- tags
- tasks
- datasets
- paperTypes
- model keywords/seed titles/preferred authors

This prevents dead requests and still allows recommendation by intent filters.

### Step 3: Parallel Source Retrieval

Candidate gathering: [backend/src/services/candidateAggregator.js](/Users/vedang/paperscout/backend/src/services/candidateAggregator.js)

Adapters:

- OpenAlex: [backend/src/adapters/openAlexAdapter.js](/Users/vedang/paperscout/backend/src/adapters/openAlexAdapter.js)
- DBLP: [backend/src/adapters/dblpAdapter.js](/Users/vedang/paperscout/backend/src/adapters/dblpAdapter.js)
- CVF workshop scraper: [backend/src/adapters/cvfWorkshopAdapter.js](/Users/vedang/paperscout/backend/src/adapters/cvfWorkshopAdapter.js)

Behavior:

1. Sources are queried in parallel.
2. Each adapter maps raw provider fields into the shared paper shape.
3. Adapter failures are isolated (`catch -> []`) so one broken source does not collapse the whole response.

### Step 4: Normalization, Typing, and Metadata Enrichment

Classifier: [backend/src/services/paperClassifier.js](/Users/vedang/paperscout/backend/src/services/paperClassifier.js)

For every raw paper:

1. Normalize text fields (`title`, `abstract`).
2. Build unified `links` array from URL/PDF/provider links.
3. Detect code links (`github.com` / `gitlab.com`) and set:
   - `hasCode`
   - `codeUrl`
4. Infer paper types (`workshop`, `conference`, `journal`, `preprint`, `survey`, `demo`, `dataset`, `benchmark`) from venue/title/source patterns.
5. Infer task labels and dataset labels by keyword pattern matching.

Tag inference from NLP/CV keywords is done via [backend/src/services/tagger.js](/Users/vedang/paperscout/backend/src/services/tagger.js), then merged into each paper.

### Step 5: Deduplication and Merge

Dedup logic: [backend/src/services/candidateAggregator.js](/Users/vedang/paperscout/backend/src/services/candidateAggregator.js)

Fingerprints are built from:

- DOI
- PDF URL
- URL
- normalized title key

When duplicates are found:

1. Keep best text fields (prefer richer abstract/title).
2. Merge authors and links uniquely.
3. Preserve strongest source signal.
4. Keep max citation count observed.

Result: one canonical record per paper instead of multiple provider copies.

### Step 6: Citation Enrichment

Citation enrichment: [backend/src/services/citationEnricher.js](/Users/vedang/paperscout/backend/src/services/citationEnricher.js)

If citation data is missing/low quality, the system enriches via OpenAlex lookups (cached) for a subset of candidates.

This reduces ranking noise from missing citation metadata.

### Step 7: Hard Filtering

Hard filter phase in [backend/src/services/recommendationModel.js](/Users/vedang/paperscout/backend/src/services/recommendationModel.js) (`applyHardFilters`).

Rules include:

- year bounds
- citation bounds
- `type` (`workshop | conference | all`)
- venue whitelist
- tag matching
- paper type matching
- task matching
- dataset matching
- `hasCode` matching
- excluded tags
- disliked authors

Only papers passing all hard constraints move to scoring.

### Step 8: Hybrid Feature Scoring

Scoring happens in `rankCandidates` within [backend/src/services/recommendationModel.js](/Users/vedang/paperscout/backend/src/services/recommendationModel.js).

Feature families used:

1. Semantic relevance (TF-IDF cosine similarity)
2. Lexical overlap (token coverage)
3. Citation strength (`log1p(citations)` normalized)
4. Citation velocity (citations per age)
5. Recency score
6. Tag match score
7. Paper type score
8. Task score
9. Dataset score
10. Venue prior and preference boost
11. Preferred-author boost
12. Workshop preference signal
13. Code availability score
14. Metadata completeness score
15. Source reliability prior

All features are weighted into a final ranking score.

### Step 9: Fallback Relaxation Strategy

If strict filters produce zero/low results, system applies staged relaxations (recorded in `meta.fallback.steps`):

1. Relax tag matching mode (`all -> any`)
2. Relax workshop-only constraint to `all` when too sparse
3. Relax code filter
4. Relax paper types
5. Relax tasks
6. Relax datasets
7. Relax tags entirely
8. Widen venues
9. Relax citation threshold
10. Final global relaxation (`all_strict_filters_relaxed`) if still empty

Goal: avoid empty response when there are relevant papers available.

### Step 10: Diversity Re-Ranking (MMR)

After score sort, Maximal Marginal Relevance reranking runs (`rerankWithMMR`) to avoid near-duplicate results.

- Uses cosine similarity between paper vectors.
- Controlled by `diversity` parameter.

### Step 11: Explainable Output Assembly

Final output includes:

- ranked papers
- per-paper recommendation score
- per-paper reason chips (for example: semantic relevance, citation profile, venue, linked implementation)
- meta diagnostics:
  - `totalBeforeFilter`
  - `totalAfterFilter`
  - `sourceStats`
  - `fallback.steps`
  - `availableFilters`

This enables transparent debugging and better UI explanations.

## Auxiliary Subsystems

### Deadlines Engine

Files:

- [backend/src/services/deadlinesService.js](/Users/vedang/paperscout/backend/src/services/deadlinesService.js)
- [backend/src/routes/deadlines.js](/Users/vedang/paperscout/backend/src/routes/deadlines.js)
- [api/deadlines.js](/Users/vedang/paperscout/api/deadlines.js)

Logic:

1. Pull conference/workshop feed.
2. Normalize timezone/deadline parsing.
3. Compute `daysRemaining` and `isOpen`.
4. Rank: open first, then nearest deadline first.
5. If feed is stale, inject estimated upcoming major deadlines (explicitly marked `isEstimated`).

### Notes Store

Files:

- [backend/src/services/notesStore.js](/Users/vedang/paperscout/backend/src/services/notesStore.js)
- [backend/src/routes/notes.js](/Users/vedang/paperscout/backend/src/routes/notes.js)
- [api/notes.js](/Users/vedang/paperscout/api/notes.js)

Logic:

1. `GET /api/notes?userName=...` -> list notes.
2. `POST /api/notes` -> create note with UUID and timestamp.
3. `DELETE /api/notes` -> remove by ID.
4. Storage backend:
   - Vercel KV (if `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set)
   - in-memory fallback otherwise

## Quick Local Run

```bash
# terminal 1
cd backend
npm install
npm run dev

# terminal 2
cd frontend
npm install
npm run dev
```

## Repository Structure

```text
paperscout/
├─ frontend/                    # React client
├─ backend/                     # Express API (local runtime)
├─ api/                         # Vercel serverless functions
└─ vercel.json                  # Vercel build/runtime config
```

## Maintainer

Made by Vedang.

Repository: [https://github.com/Vedang-P/paperscout](https://github.com/Vedang-P/paperscout)
