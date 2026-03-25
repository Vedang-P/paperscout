# PaperScout

PaperScout is a full-stack app with:
- `frontend/`: React + Vite UI
- `backend/`: Express API for local development
- `api/`: Vercel serverless API routes used in production

## Local development

1. Start backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
2. In another terminal, start frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173)

`frontend/vite.config.js` proxies `/api/*` requests to `http://localhost:5000`.

## Deploy on Vercel (Dashboard)

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, click **Add New Project** and import this repo.
3. Keep the project root as the repository root (`paperscout`).
4. Vercel will use `vercel.json` automatically:
   - Install command: `npm install --prefix frontend`
   - Build command: `npm run build --prefix frontend`
   - Output directory: `frontend/dist`
5. Click **Deploy**.

The frontend is served as static files, and API routes are served from:
- `/api/papers/health`
- `/api/papers/search?q=transformer`

## Deploy on Vercel (CLI)

```bash
npm i -g vercel
cd /path/to/paperscout
vercel
```

For production deployment:

```bash
vercel --prod
```
