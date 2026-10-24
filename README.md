# 🎧 GrooveMatch

**Paste your playlists. Find your next obsession.**

GrooveMatch is a fully client-side music recommender: paste in songs from your personal playlists and it maps your taste across genres, moods and energy, then scores every track in its built-in catalog for fit — with explainable match percentages and reasons.

## Features

- 🎵 **Flexible playlist parsing** — handles `Song - Artist`, `Artist - Song`, `Song by Artist`, numbered lists, CSV/TSV exports, accents, common aliases and small typos
- 🧬 **Taste profile** — top genres, mood signature and average energy level, visualized instantly
- 💜 **Explainable, calibrated recommendations** — genre families, moods, energy, decade, artist affinity and nearest-song similarity contribute to a differentiated fit score
- 🎚️ **Built-in variety** — soft artist and genre repetition penalties keep the list from flooding with near-duplicates
- 🚫 **Honest unknown-input handling** — unrecognized playlists produce guidance instead of fabricated generic taste
- 🔒 **Private by design** — all analysis runs in your browser; nothing is uploaded
- ⚡ **No accounts, no APIs** — a self-contained demo engine with a curated cross-genre catalog

## Tech stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · lucide-react

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build → dist/
npm run test:engine  # parser + recommender regression tests (Node 24+)
```

## Deploy

Move the included `deploy-pages.yml` template into `.github/workflows/deploy.yml`, then enable **Settings → Pages → Build and deployment → GitHub Actions**. After that, pushing to `main` automatically builds and deploys the site.

## How the engine works

1. Lines are normalized for accents and punctuation, then parsed with artist/title orientation detection, CSV handling, aliases and bounded fuzzy matching.
2. Exact tracks contribute the strongest evidence; artist-only matches and free-text hints contribute less. Duplicate lines and tracks are counted once.
3. Genre families are compared with cosine similarity alongside mood, energy, decade and artist affinity. A nearest-seed comparison adds song-to-song evidence.
4. The final 0–99 fit score is not a probability. A diversity pass penalizes repeated artists and primary genres, and each result includes human-readable reasons.

`src/data/catalog.ts` holds the catalog and recognition profiles — extend it to teach GrooveMatch new music.
