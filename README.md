# GrooveMatch

**Paste your playlists. Find your next obsession.**

GrooveMatch is a fully client-side music recommender: paste in songs from your personal playlists and it maps your taste across genres, moods and energy, then scores every track in its built-in catalog for fit - with explainable match percentages and reasons.

## Features

- **Playlist parsing** - accepts `Song - Artist` lines, bare artist names, genre names and free-text hints like `chill lofi` or `high energy workout`
- **Taste profile** - top genres, mood signature and average energy level, visualized instantly
- **Fitted recommendations** - every suggestion comes with a match score and the reasons it was picked
- **Private by design** - all analysis runs in your browser; nothing is uploaded
- **No accounts, no APIs** - a self-contained demo engine with a curated cross-genre catalog

## Tech stack

React - TypeScript - Vite - Tailwind CSS - shadcn/ui - lucide-react

## Run locally

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build -> dist/
```

## Deploy

Pushing to `main` automatically builds and deploys to GitHub Pages via the workflow in `.github/workflows/deploy.yml`. Enable it once under **Settings -> Pages -> Build and deployment -> GitHub Actions**.

## How the engine works

1. Input lines are normalized and matched against an artist/keyword/track index.
2. Each match contributes weighted genre, mood and energy signals to a taste profile.
3. Catalog tracks are scored on genre overlap, mood overlap and energy fit; the result is mapped to a 50-99% match with human-readable reasons.

`src/data/catalog.ts` holds the catalog and recognition profiles - extend it to teach GrooveMatch new music.
