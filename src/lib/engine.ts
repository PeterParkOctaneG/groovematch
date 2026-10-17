import { ARTIST_PROFILES, CATALOG, KEYWORD_PROFILES, type ArtistProfile, type Track } from "@/data/catalog";

export interface ParsedInput {
  raw: string;
  matchedArtist: string | null;
  matchedKeywords: string[];
  matchedCatalogTrack: Track | null;
}

export interface TasteProfile {
  genreWeights: { genre: string; weight: number }[];
  moodWeights: { mood: string; weight: number }[];
  avgEnergy: number;
  decadeWeights: { decade: string; weight: number }[];
  recognizedCount: number;
  totalLines: number;
}

export interface Recommendation {
  track: Track;
  match: number; // 50-99
  reasons: string[];
}

export interface AnalysisResult {
  profile: TasteProfile;
  recommendations: Recommendation[];
  parsed: ParsedInput[];
  unrecognized: string[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,!?;:"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a free-form playlist dump into candidate lines. */
export function splitLines(input: string): string[] {
  return input
    .split(/[\n\r•]+/)
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 1);
}

function findArtist(line: string): string | null {
  const n = normalize(line);
  // longest artist names first so "the notorious b.i.g." beats "big"
  const artists = Object.keys(ARTIST_PROFILES).sort((a, b) => b.length - a.length);
  for (const artist of artists) {
    const re = new RegExp(`(^|\\W)${artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\W)`);
    if (re.test(n)) return artist;
  }
  return null;
}

function findKeywords(line: string): string[] {
  const n = normalize(line);
  const hits: string[] = [];
  for (const kw of Object.keys(KEYWORD_PROFILES)) {
    const re = new RegExp(`(^|\\W)${kw.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}($|\\W)`);
    if (re.test(n)) hits.push(kw);
  }
  return hits;
}

function findCatalogTrack(line: string): Track | null {
  const n = normalize(line);
  for (const t of CATALOG) {
    const title = normalize(t.title);
    if (title.length > 3 && n.includes(title)) return t;
  }
  return null;
}

export function analyze(input: string): AnalysisResult {
  const lines = splitLines(input);
  const parsed: ParsedInput[] = [];
  const genreAcc = new Map<string, number>();
  const moodAcc = new Map<string, number>();
  const decadeAcc = new Map<string, number>();
  const energyVals: number[] = [];
  const userTrackKeys = new Set<string>();
  let recognized = 0;

  const bump = (map: Map<string, number>, key: string, w: number) =>
    map.set(key, (map.get(key) ?? 0) + w);

  const applyProfile = (p: ArtistProfile, w: number) => {
    p.genres.forEach((g) => bump(genreAcc, g, w));
    p.moods.forEach((m) => bump(moodAcc, m, w * 0.8));
    energyVals.push(p.energy);
  };

  for (const line of lines) {
    const artist = findArtist(line);
    const keywords = findKeywords(line);
    const catalogTrack = findCatalogTrack(line);

    if (artist) {
      applyProfile(ARTIST_PROFILES[artist], 2);
      recognized++;
    }
    keywords.forEach((k) => applyProfile(KEYWORD_PROFILES[k], 1));
    if (catalogTrack) {
      catalogTrack.genres.forEach((g) => bump(genreAcc, g, 1.5));
      catalogTrack.moods.forEach((m) => bump(moodAcc, m, 1.2));
      energyVals.push(catalogTrack.energy);
      bump(decadeAcc, `${Math.floor(catalogTrack.year / 10) * 10}s`, 1);
      userTrackKeys.add(`${catalogTrack.title}::${catalogTrack.artist}`);
      if (!artist) recognized++;
    } else if (artist) {
      // artist known but specific track unknown: still count the line
    }

    if (artist || keywords.length || catalogTrack) {
      parsed.push({ raw: line, matchedArtist: artist, matchedKeywords: keywords, matchedCatalogTrack: catalogTrack });
    }
  }

  // Fallback: if nothing recognized, seed with broad popular taste so the
  // UI still produces a useful demo instead of an empty state.
  if (genreAcc.size === 0) {
    ["pop", "rock", "hip-hop"].forEach((g) => bump(genreAcc, g, 1));
    ["happy", "energetic"].forEach((m) => bump(moodAcc, m, 0.8));
    energyVals.push(6);
  }

  const top = (map: Map<string, number>, key: string) =>
    [...map.entries()]
      .map(([k, w]) => ({ [key]: k, weight: Math.round(w * 10) / 10 }) as never)
      .sort((a: never, b: never) => (b as { weight: number }).weight - (a as { weight: number }).weight);

  const profile: TasteProfile = {
    genreWeights: top(genreAcc, "genre") as { genre: string; weight: number }[],
    moodWeights: top(moodAcc, "mood") as { mood: string; weight: number }[],
    avgEnergy: energyVals.reduce((a, b) => a + b, 0) / energyVals.length,
    decadeWeights: top(decadeAcc, "decade") as { decade: string; weight: number }[],
    recognizedCount: recognized,
    totalLines: lines.length,
  };

  // ── Scoring ──────────────────────────────────────────
  const topGenres = new Map(profile.genreWeights.slice(0, 8).map((g) => [g.genre, g.weight]));
  const topMoods = new Map(profile.moodWeights.slice(0, 8).map((m) => [m.mood, m.weight]));
  const maxGenre = Math.max(...profile.genreWeights.map((g) => g.weight), 1);

  const recs: Recommendation[] = [];
  for (const track of CATALOG) {
    if (userTrackKeys.has(`${track.title}::${track.artist}`)) continue;

    const genreHits = track.genres.filter((g) => topGenres.has(g));
    const moodHits = track.moods.filter((m) => topMoods.has(m));
    const genreScore = genreHits.reduce((s, g) => s + (topGenres.get(g) ?? 0) / maxGenre, 0) / Math.max(track.genres.length, 1);
    const moodScore = moodHits.reduce((s, m) => s + (topMoods.get(m) ?? 0) / maxGenre, 0) / Math.max(track.moods.length, 1);
    const energyFit = 1 - Math.min(Math.abs(track.energy - profile.avgEnergy) / 9, 1);

    const raw = genreScore * 55 + moodScore * 25 + energyFit * 20;
    if (raw < 8) continue;

    const reasons: string[] = [];
    if (genreHits.length) reasons.push(`Matches your ${genreHits.slice(0, 2).join(" + ")} taste`);
    if (moodHits.length) reasons.push(`Same ${moodHits.slice(0, 2).join(" / ")} mood`);
    if (energyFit > 0.85) reasons.push("Similar energy level");

    recs.push({ track, match: Math.min(99, Math.round(50 + raw)), reasons });
  }

  recs.sort((a, b) => b.match - a.match);

  const unrecognized = lines.filter((l) => !parsed.some((p) => p.raw === l)).slice(0, 8);

  return { profile, recommendations: recs.slice(0, 12), parsed, unrecognized };
}
