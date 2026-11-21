import {
  ARTIST_PROFILES,
  CATALOG,
  KEYWORD_PROFILES,
  type ArtistProfile,
  type Track,
} from "../data/catalog.ts";

export type MatchKind = "track" | "artist" | "keywords";

/** Tunable vibe dimensions. Each track carries a 0-1 value per aspect; the
 * user's slider positions act as target intensities that re-rank candidates. */
export const ASPECTS = [
  { key: "energy", label: "Energy" },
  { key: "emo", label: "Emo" },
  { key: "indie", label: "Indie" },
  { key: "gym", label: "Gym" },
  { key: "chill", label: "Chill" },
  { key: "party", label: "Party" },
  { key: "nostalgic", label: "Nostalgic" },
] as const;

export type AspectKey = (typeof ASPECTS)[number]["key"];
export type AspectScores = Record<AspectKey, number>;
/** Slider positions: desired intensity (0-1) per aspect. Absent aspects are
 * treated as "leave my mix alone" and are excluded from re-ranking. */
export type AspectPrefs = Partial<Record<AspectKey, number>>;

export interface ParsedInput {
  raw: string;
  matchedArtist: string | null;
  matchedKeywords: string[];
  matchedCatalogTrack: Track | null;
  matchKind: MatchKind;
  fuzzy: boolean;
  artistKey: string | null;
  matchWeight: number;
}

export interface TasteProfile {
  genreWeights: { genre: string; weight: number }[];
  moodWeights: { mood: string; weight: number }[];
  avgEnergy: number | null;
  decadeWeights: { decade: string; weight: number }[];
  recognizedCount: number;
  totalLines: number;
  recognizedTracks: number;
  recognizedArtists: number;
  hintCount: number;
}

export interface Recommendation {
  track: Track;
  match: number; // Calibrated 0-99 fit score, not a probability.
  reasons: string[];
}

export interface AnalysisResult {
  profile: TasteProfile;
  recommendations: Recommendation[];
  parsed: ParsedInput[];
  unrecognized: string[];
}

interface ArtistEntry {
  key: string;
  name: string;
  normalized: string;
  profile: ArtistProfile;
}

interface ArtistMatch {
  entry: ArtistEntry;
  fuzzy: boolean;
}

interface TrackMatch {
  track: Track;
  fuzzy: boolean;
}

/** Normalize accents, punctuation and collaboration suffixes consistently on
 * both sides of a comparison. This is intentionally shared by every matcher. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:feat\.?|featuring|ft\.?)\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTIST_ALIASES: Record<string, string> = {
  weeknd: "the weeknd",
  "the weekend": "the weeknd",
  biggie: "the notorious b.i.g.",
  "biggie smalls": "the notorious b.i.g.",
  "notorious big": "the notorious b.i.g.",
  ye: "kanye west",
  "tupac shakur": "2pac",
  rhcp: "red hot chili peppers",
  "the cranberries": "the cranberries",
};

const GENRE_PARENTS: Record<string, string[]> = {
  "synth-pop": ["pop", "electronic"],
  electropop: ["pop", "electronic"],
  "dream pop": ["pop", "indie"],
  "baroque pop": ["pop", "indie"],
  "art pop": ["pop", "indie"],
  "pop rock": ["pop", "rock"],
  "soft rock": ["rock"],
  "classic rock": ["rock"],
  "hard rock": ["rock"],
  "indie rock": ["indie", "rock"],
  alternative: ["rock", "indie"],
  grunge: ["rock", "alternative"],
  "garage rock": ["indie rock"],
  britpop: ["rock", "alternative"],
  "post-punk": ["rock", "alternative"],
  "new wave": ["pop", "rock"],
  punk: ["rock"],
  "funk rock": ["funk", "rock"],
  "country rock": ["country", "rock"],
  "nu-metal": ["metal", "rock"],
  "heavy metal": ["metal"],
  "thrash metal": ["metal"],
  industrial: ["metal", "electronic"],
  rap: ["hip-hop"],
  trap: ["hip-hop"],
  "jazz rap": ["hip-hop", "jazz"],
  "old school": ["hip-hop"],
  house: ["electronic"],
  edm: ["electronic"],
  dubstep: ["electronic"],
  trance: ["electronic"],
  techno: ["electronic"],
  "progressive house": ["house", "electronic"],
  "deep house": ["house", "electronic"],
  downtempo: ["electronic", "ambient"],
  disco: ["pop", "funk"],
  "neo-soul": ["soul", "r&b"],
  "alternative r&b": ["r&b", "alternative"],
  swing: ["jazz"],
  "modal jazz": ["jazz"],
  "cool jazz": ["jazz"],
  "bossa nova": ["jazz", "latin"],
  salsa: ["latin"],
  reggaeton: ["latin"],
  neoclassical: ["classical"],
  piano: ["classical"],
  soundtrack: ["classical"],
  "singer-songwriter": ["folk", "indie"],
  americana: ["country", "folk"],
  "traditional pop": ["pop", "jazz"],
};

function splitArtistNames(artist: string): string[] {
  const explicit = Object.keys(ARTIST_PROFILES).some(
    (name) => normalizeText(name) === normalizeText(artist)
  );
  if (explicit) return [artist];
  return artist
    .split(/\s+(?:ft\.?|feat\.?|featuring|&|x)\s+|\s*,\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function derivedArtistProfile(tracks: Track[]): ArtistProfile {
  return {
    genres: [...new Set(tracks.flatMap((track) => track.genres))],
    moods: [...new Set(tracks.flatMap((track) => track.moods))],
    energy:
      tracks.reduce((sum, track) => sum + track.energy, 0) / Math.max(tracks.length, 1),
  };
}

function buildArtistIndex(): ArtistEntry[] {
  const entries = new Map<string, ArtistEntry>();

  for (const [name, profile] of Object.entries(ARTIST_PROFILES)) {
    const normalized = normalizeText(name);
    if (!entries.has(normalized)) {
      entries.set(normalized, { key: normalized, name, normalized, profile });
    }
  }

  // Artists without an editorial profile still become recognizable by deriving
  // a profile from all of their catalog tracks.
  for (const track of CATALOG) {
    for (const name of splitArtistNames(track.artist)) {
      const normalized = normalizeText(name);
      const relatedTracks = CATALOG.filter((candidate) =>
        splitArtistNames(candidate.artist).some(
          (artistName) => normalizeText(artistName) === normalized
        )
      );
      const existing = entries.get(normalized);
      if (existing) {
        // Catalog artist fields preserve display capitalization ("Bon Iver",
        // "The Weeknd") while recognition remains fully case-insensitive.
        existing.name = name;
      } else {
        entries.set(normalized, {
          key: normalized,
          name,
          normalized,
          profile: derivedArtistProfile(relatedTracks),
        });
      }
    }
  }

  for (const [alias, target] of Object.entries(ARTIST_ALIASES)) {
    const targetEntry = entries.get(normalizeText(target));
    const aliasNormalized = normalizeText(alias);
    if (targetEntry && !entries.has(aliasNormalized)) {
      entries.set(aliasNormalized, { ...targetEntry, key: targetEntry.key });
    }
  }

  return [...entries.values()].sort(
    (a, b) => b.normalized.length - a.normalized.length
  );
}

const ARTIST_INDEX = buildArtistIndex();
const ARTIST_BY_NORMALIZED = new Map(
  ARTIST_INDEX.map((entry) => [entry.normalized, entry])
);

const TITLE_INDEX = CATALOG.map((track) => ({
  track,
  normalized: normalizeText(track.title),
})).sort((a, b) => b.normalized.length - a.normalized.length);

const TRACKS_BY_TITLE = new Map<string, Track[]>();
for (const item of TITLE_INDEX) {
  const existing = TRACKS_BY_TITLE.get(item.normalized) ?? [];
  existing.push(item.track);
  TRACKS_BY_TITLE.set(item.normalized, existing);
}

const KEYWORD_INDEX = Object.entries(KEYWORD_PROFILES)
  .map(([keyword, profile]) => ({
    keyword,
    normalized: normalizeText(keyword),
    profile,
  }))
  .sort((a, b) => b.normalized.length - a.normalized.length);

function containsPhrase(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function fuzzyArtist(segment: string): ArtistMatch | null {
  const normalized = normalizeText(segment);
  if (normalized.length < 5) return null;

  let best: { entry: ArtistEntry; distance: number } | null = null;
  for (const entry of ARTIST_INDEX) {
    if (entry.normalized.length < 5 || entry.normalized[0] !== normalized[0]) continue;
    const maxLength = Math.max(entry.normalized.length, normalized.length);
    const allowed = maxLength >= 10 ? 2 : 1;
    const distance = editDistance(normalized, entry.normalized);
    if (distance > allowed || distance / maxLength > 0.25) continue;
    if (!best || distance < best.distance) best = { entry, distance };
    if (distance === 0) break;
  }
  return best ? { entry: best.entry, fuzzy: true } : null;
}

function matchArtistSegment(segment: string, allowFuzzy = true): ArtistMatch | null {
  const normalized = normalizeText(segment);
  if (!normalized) return null;
  const exact = ARTIST_BY_NORMALIZED.get(normalized);
  if (exact) return { entry: exact, fuzzy: false };
  return allowFuzzy ? fuzzyArtist(segment) : null;
}

function findArtistInText(text: string): ArtistMatch | null {
  const normalized = normalizeText(text);
  for (const entry of ARTIST_INDEX) {
    if (entry.normalized.length >= 2 && containsPhrase(normalized, entry.normalized)) {
      return { entry, fuzzy: false };
    }
  }
  return null;
}

function trackArtistKeys(track: Track): string[] {
  return splitArtistNames(track.artist).map(normalizeText);
}

function chooseTrack(candidates: Track[], artist: ArtistMatch | null): Track {
  if (artist) {
    const exact = candidates.find((track) =>
      trackArtistKeys(track).includes(artist.entry.key)
    );
    if (exact) return exact;
  }
  return candidates[0];
}

function matchTrackTitle(title: string, artist: ArtistMatch | null): TrackMatch | null {
  const normalized = normalizeText(title);
  if (!normalized) return null;
  const exact = TRACKS_BY_TITLE.get(normalized);
  if (exact) return { track: chooseTrack(exact, artist), fuzzy: false };

  if (normalized.length < 6) return null;
  let best: { track: Track; distance: number } | null = null;
  for (const item of TITLE_INDEX) {
    if (item.normalized[0] !== normalized[0]) continue;
    const maxLength = Math.max(item.normalized.length, normalized.length);
    const allowed = maxLength >= 13 ? 2 : 1;
    const distance = editDistance(normalized, item.normalized);
    if (distance > allowed || distance / maxLength > 0.2) continue;
    if (!best || distance < best.distance) best = { track: item.track, distance };
  }
  return best ? { track: best.track, fuzzy: true } : null;
}

function findTrackInText(text: string, artist: ArtistMatch | null): TrackMatch | null {
  const normalized = normalizeText(text);
  for (const item of TITLE_INDEX) {
    if (!containsPhrase(normalized, item.normalized)) continue;
    const artistMatches = artist
      ? trackArtistKeys(item.track).includes(artist.entry.key)
      : false;
    // Short/common titles such as "Home" and "Time" need artist corroboration.
    if (item.normalized.length < 5 && !artistMatches) continue;
    if (artist && !artistMatches && item.normalized.length < 8) continue;
    return { track: item.track, fuzzy: false };
  }
  return null;
}

function findKeywords(line: string): string[] {
  const normalized = normalizeText(line);
  return KEYWORD_INDEX.filter((keyword) =>
    containsPhrase(normalized, keyword.normalized)
  ).map((keyword) => keyword.keyword);
}

function isHeaderLine(line: string): boolean {
  const normalized = normalizeText(line);
  return (
    /^(track|song)( name)? (artist|artist name|artists)/.test(normalized) ||
    /^(title|name) (artist|artist name|artists)/.test(normalized) ||
    normalized === "track artist" ||
    normalized === "song artist"
  );
}

/** Split playlist dumps, numbered lists and bulleted exports into lines. */
export function splitLines(input: string): string[] {
  return input
    .split(/[\n\r]+|\s+•\s+/)
    .flatMap((line) =>
      line.includes(";") && (line.match(/;/g)?.length ?? 0) >= 1 && line.includes(" - ")
        ? line.split(/\s*;\s*/)
        : [line]
    )
    .map((line) =>
      line
        .replace(/^\s*(?:\d+\s*[.):-]|[-*•])\s+/, "")
        .replace(/^["']|["']$/g, "")
        .trim()
    )
    .filter((line) => line.length > 1 && !isHeaderLine(line));
}

function splitDelimited(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : line.includes(",") ? "," : null;
  if (!delimiter) return [];

  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields.filter(Boolean);
}

function splitPair(line: string): [string, string] | null {
  const patterns = [
    /\s+[-–—]\s+/,
    /\s+\|\s+/,
    /\s+•\s+/,
    /\s+by\s+/i,
    /\s+:\s+/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(line);
    if (match && match.index > 0) {
      return [line.slice(0, match.index).trim(), line.slice(match.index + match[0].length).trim()];
    }
  }
  return null;
}

function emptyParsed(raw: string): ParsedInput {
  return {
    raw,
    matchedArtist: null,
    matchedKeywords: findKeywords(raw),
    matchedCatalogTrack: null,
    matchKind: "keywords",
    fuzzy: false,
    artistKey: null,
    matchWeight: 0,
  };
}

export function parseLine(raw: string): ParsedInput | null {
  const result = emptyParsed(raw);
  const finish = (
    artist: ArtistMatch | null,
    track: TrackMatch | null
  ): ParsedInput | null => {
    if (!artist && !track && result.matchedKeywords.length === 0) return null;
    if (track) {
      result.matchedCatalogTrack = track.track;
      result.matchKind = "track";
      result.matchWeight = track.fuzzy ? 0.8 : 1;
      result.fuzzy = track.fuzzy || Boolean(artist?.fuzzy);
    } else if (artist) {
      result.matchKind = "artist";
      result.matchWeight = artist.fuzzy ? 0.5 : 0.7;
      result.fuzzy = artist.fuzzy;
    } else {
      result.matchWeight = 0.25;
    }
    if (artist) {
      result.matchedArtist = artist.entry.name;
      result.artistKey = artist.entry.key;
    }
    return result;
  };

  // An entire line naming only an artist should not be mistaken for CSV.
  const wholeArtist = matchArtistSegment(raw);
  if (wholeArtist) return finish(wholeArtist, null);

  const pair = splitPair(raw);
  if (pair) {
    const [left, right] = pair;
    const leftArtist = matchArtistSegment(left);
    const rightArtist = matchArtistSegment(right);
    const leftTrack = matchTrackTitle(left, rightArtist);
    const rightTrack = matchTrackTitle(right, leftArtist);

    if (rightArtist && (!leftArtist || leftTrack)) {
      return finish(rightArtist, leftTrack ?? findTrackInText(left, rightArtist));
    }
    if (leftArtist) {
      return finish(leftArtist, rightTrack ?? findTrackInText(right, leftArtist));
    }
    if (leftTrack) return finish(null, leftTrack);
    if (rightTrack) return finish(null, rightTrack);
  }

  const wholeTrack = matchTrackTitle(raw, null);
  if (wholeTrack) return finish(null, wholeTrack);

  const fields = splitDelimited(raw);
  if (fields.length >= 2) {
    const firstArtist = matchArtistSegment(fields[0]);
    const secondArtist = matchArtistSegment(fields[1]);
    if (secondArtist) {
      return finish(secondArtist, matchTrackTitle(fields[0], secondArtist));
    }
    if (firstArtist) {
      return finish(firstArtist, matchTrackTitle(fields[1], firstArtist));
    }
  }

  const embeddedArtist = findArtistInText(raw);
  const embeddedTrack = findTrackInText(raw, embeddedArtist);
  if (embeddedArtist || embeddedTrack) return finish(embeddedArtist, embeddedTrack);

  return finish(null, null);
}

function bump(map: Map<string, number>, key: string, weight: number): void {
  map.set(key, (map.get(key) ?? 0) + weight);
}

function applyProfile(
  profile: ArtistProfile,
  weight: number,
  genreAcc: Map<string, number>,
  moodAcc: Map<string, number>
): void {
  const genreWeight = weight / Math.max(profile.genres.length, 1);
  const moodWeight = weight / Math.max(profile.moods.length, 1);
  profile.genres.forEach((genre) => bump(genreAcc, genre, genreWeight));
  profile.moods.forEach((mood) => bump(moodAcc, mood, moodWeight));
}

function expandGenres(weights: Map<string, number>): Map<string, number> {
  const expanded = new Map<string, number>();
  for (const [genre, weight] of weights.entries()) {
    bump(expanded, genre, weight);
    for (const parent of GENRE_PARENTS[genre] ?? []) {
      bump(expanded, parent, weight * 0.7);
      for (const grandparent of GENRE_PARENTS[parent] ?? []) {
        bump(expanded, grandparent, weight * 0.35);
      }
    }
  }
  return expanded;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let aSquared = 0;
  let bSquared = 0;
  for (const value of a.values()) aSquared += value * value;
  for (const value of b.values()) bSquared += value * value;
  if (aSquared === 0 || bSquared === 0) return 0;
  for (const [key, value] of a.entries()) dot += value * (b.get(key) ?? 0);
  return dot / Math.sqrt(aSquared * bSquared);
}

function trackGenreVector(track: Track): Map<string, number> {
  const weights = new Map<string, number>();
  track.genres.forEach((genre) => bump(weights, genre, 1 / track.genres.length));
  return expandGenres(weights);
}

function trackMoodVector(track: Track): Map<string, number> {
  const weights = new Map<string, number>();
  track.moods.forEach((mood) => bump(weights, mood, 1 / track.moods.length));
  return weights;
}

function sortedEntries(map: Map<string, number>): { key: string; weight: number }[] {
  return [...map.entries()]
    .map(([key, weight]) => ({ key, weight: Math.round(weight * 100) / 100 }))
    .sort((a, b) => b.weight - a.weight);
}

function topDecade(decadeWeights: { decade: string; weight: number }[]): string | null {
  return decadeWeights[0]?.decade ?? null;
}

function eraFit(track: Track, favoriteDecade: string | null): number {
  if (!favoriteDecade) return 0.5;
  const favoriteYear = Number.parseInt(favoriteDecade, 10);
  const difference = Math.abs(Math.floor(track.year / 10) * 10 - favoriteYear) / 10;
  return difference === 0 ? 1 : difference === 1 ? 0.65 : difference === 2 ? 0.35 : 0.1;
}

/* ── Aspect vectors ─────────────────────────────────────────────────── */

function tagAffinity(tags: string[], table: Record<string, number>): number {
  let sum = 0;
  for (const tag of tags) sum += table[tag] ?? 0;
  return Math.min(1, sum);
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const EMO_MOODS: Record<string, number> = {
  sad: 0.55,
  melancholy: 0.55,
  emotional: 0.6,
  heartbreak: 0.55,
  bittersweet: 0.4,
  moody: 0.4,
  angsty: 0.4,
  raw: 0.35,
  dramatic: 0.3,
  poetic: 0.25,
  reflective: 0.2,
};

const EMO_GENRES: Record<string, number> = {
  "singer-songwriter": 0.3,
  folk: 0.2,
  indie: 0.15,
  "indie rock": 0.15,
  americana: 0.15,
};

const INDIE_GENRES: Record<string, number> = {
  indie: 0.6,
  "indie rock": 0.6,
  alternative: 0.45,
  "dream pop": 0.5,
  "art pop": 0.4,
  "baroque pop": 0.35,
  "garage rock": 0.4,
  britpop: 0.45,
  "post-punk": 0.45,
  psychedelic: 0.4,
  "singer-songwriter": 0.3,
  folk: 0.2,
};

const GYM_GENRES: Record<string, number> = {
  "hip-hop": 0.3,
  rap: 0.3,
  trap: 0.35,
  edm: 0.35,
  house: 0.3,
  techno: 0.3,
  dubstep: 0.3,
  "hard rock": 0.3,
  rock: 0.15,
  metal: 0.35,
  "heavy metal": 0.35,
  "nu-metal": 0.35,
  "thrash metal": 0.35,
  punk: 0.3,
  industrial: 0.3,
  "funk rock": 0.25,
};

const GYM_MOODS: Record<string, number> = {
  empowering: 0.3,
  intense: 0.35,
  anthemic: 0.3,
  confident: 0.25,
  energetic: 0.25,
  chaotic: 0.25,
  epic: 0.2,
};

const CHILL_MOODS: Record<string, number> = {
  chill: 0.6,
  peaceful: 0.55,
  dreamy: 0.45,
  hypnotic: 0.45,
  reflective: 0.3,
  cool: 0.3,
  classy: 0.2,
};

const CHILL_GENRES: Record<string, number> = {
  ambient: 0.5,
  downtempo: 0.45,
  "soft rock": 0.3,
  "neo-soul": 0.25,
  "bossa nova": 0.35,
  neoclassical: 0.25,
  classical: 0.2,
  piano: 0.2,
};

const PARTY_GENRES: Record<string, number> = {
  dance: 0.55,
  disco: 0.5,
  funk: 0.45,
  house: 0.45,
  edm: 0.45,
  eurodance: 0.5,
  trance: 0.4,
  techno: 0.4,
  reggaeton: 0.4,
  salsa: 0.35,
  reggae: 0.25,
};

const PARTY_MOODS: Record<string, number> = {
  party: 0.55,
  groovy: 0.45,
  euphoric: 0.4,
  summer: 0.35,
  happy: 0.25,
  playful: 0.2,
};

/** Derive a 0-1 value for every tunable aspect straight from catalog
 * metadata — no new data needed, and every aspect stays explainable. */
export function trackAspects(track: Track): AspectScores {
  const e = track.energy / 10;
  return {
    energy: e,
    emo: clamp01(
      0.75 * tagAffinity(track.moods, EMO_MOODS) +
        0.25 * tagAffinity(track.genres, EMO_GENRES)
    ),
    indie: tagAffinity(track.genres, INDIE_GENRES),
    gym: clamp01(0.45 * e + 0.35 * tagAffinity(track.genres, GYM_GENRES) + 0.2 * tagAffinity(track.moods, GYM_MOODS)),
    chill: clamp01(
      0.55 * tagAffinity(track.moods, CHILL_MOODS) +
        0.25 * tagAffinity(track.genres, CHILL_GENRES) +
        0.2 * (1 - e)
    ),
    party: clamp01(
      0.65 * tagAffinity(track.genres, PARTY_GENRES) +
        0.35 * tagAffinity(track.moods, PARTY_MOODS)
    ),
    nostalgic: clamp01(0.6 * clamp01((2024 - track.year) / 45) + 0.4 * tagAffinity(track.moods, { nostalgic: 0.7 })),
  };
}

/** Natural slider positions implied by a taste profile — the starting point
 * users drag away from. Purely derived from the same signals analyze() uses. */
export function defaultAspectPrefs(profile: TasteProfile): AspectPrefs {
  const totalMood = profile.moodWeights.reduce((sum, m) => sum + m.weight, 0) || 1;
  const totalGenre = profile.genreWeights.reduce((sum, g) => sum + g.weight, 0) || 1;
  const moodShare = (table: Record<string, number>): number =>
    profile.moodWeights.reduce((sum, m) => sum + (table[m.mood] ?? 0) * m.weight, 0) / totalMood;
  const genreShare = (table: Record<string, number>): number =>
    profile.genreWeights.reduce((sum, g) => sum + (table[g.genre] ?? 0) * g.weight, 0) / totalGenre;

  const energy = profile.avgEnergy === null ? 0.5 : profile.avgEnergy / 10;
  const retroShare =
    profile.decadeWeights.reduce(
      (sum, d) => sum + (Number.parseInt(d.decade, 10) < 2000 ? d.weight : 0),
      0
    ) /
      (profile.decadeWeights.reduce((sum, d) => sum + d.weight, 0) || 1);

  return {
    energy: clamp01(energy),
    emo: clamp01(moodShare(EMO_MOODS)),
    indie: clamp01(genreShare(INDIE_GENRES)),
    gym: clamp01(0.45 * energy + 0.35 * genreShare(GYM_GENRES) + 0.2 * moodShare(GYM_MOODS)),
    chill: clamp01(0.55 * moodShare(CHILL_MOODS) + 0.25 * genreShare(CHILL_GENRES) + 0.2 * (1 - energy)),
    party: clamp01(0.65 * genreShare(PARTY_GENRES) + 0.35 * moodShare(PARTY_MOODS)),
    nostalgic: clamp01(0.6 * retroShare + 0.4 * moodShare({ nostalgic: 0.7 })),
  };
}

/** How strongly the given prefs should steer ranking (0 when no sliders set). */
function aspectBlend(prefs: AspectPrefs | undefined): number {
  if (!prefs) return 0;
  const total = Object.values(prefs).reduce((sum, v) => sum + (v ?? 0), 0);
  return Math.min(0.7, total * 0.35);
}

function aspectAlignment(track: Track, prefs: AspectPrefs): { value: number; best: { key: AspectKey; closeness: number } | null } {
  const scores = trackAspects(track);
  let weighted = 0;
  let weightSum = 0;
  let best: { key: AspectKey; closeness: number } | null = null;
  let bestWeighted = 0;
  for (const { key } of ASPECTS) {
    const w = prefs[key];
    if (w === undefined || w <= 0.01) continue;
    const closeness = 1 - Math.abs(scores[key] - w);
    weighted += w * closeness;
    weightSum += w;
    if (w * closeness > bestWeighted) {
      bestWeighted = w * closeness;
      best = { key, closeness };
    }
  }
  return { value: weightSum > 0 ? weighted / weightSum : 0, best };
}

export function analyze(input: string, prefs?: AspectPrefs): AnalysisResult {
  const lines = splitLines(input);
  const parsed: ParsedInput[] = [];
  const genreAcc = new Map<string, number>();
  const moodAcc = new Map<string, number>();
  const decadeAcc = new Map<string, number>();
  const artistAcc = new Map<string, number>();
  const artistNames = new Map<string, string>();
  const userTrackKeys = new Set<string>();
  const userTracks = new Map<string, Track>();
  const seenRaw = new Set<string>();
  let energySum = 0;
  let energyWeight = 0;
  let recognizedCount = 0;
  let hintCount = 0;

  for (const line of lines) {
    const normalizedRaw = normalizeText(line);
    if (seenRaw.has(normalizedRaw)) continue;
    seenRaw.add(normalizedRaw);

    const item = parseLine(line);
    if (!item) continue;
    parsed.push(item);
    recognizedCount++;

    const { matchedCatalogTrack: track, artistKey, matchWeight } = item;
    if (track) {
      const trackKey = `${normalizeText(track.title)}::${normalizeText(track.artist)}`;
      userTrackKeys.add(trackKey);
      if (!userTracks.has(trackKey)) {
        userTracks.set(trackKey, track);
        applyProfile(track, matchWeight, genreAcc, moodAcc);
        energySum += track.energy * matchWeight;
        energyWeight += matchWeight;
        bump(decadeAcc, `${Math.floor(track.year / 10) * 10}s`, matchWeight);
        for (const key of trackArtistKeys(track)) {
          bump(artistAcc, key, matchWeight);
          const entry = ARTIST_BY_NORMALIZED.get(key);
          artistNames.set(key, entry?.name ?? splitArtistNames(track.artist)[0]);
        }
      }
    } else if (artistKey) {
      const entry = ARTIST_BY_NORMALIZED.get(artistKey);
      if (entry) {
        applyProfile(entry.profile, matchWeight, genreAcc, moodAcc);
        energySum += entry.profile.energy * matchWeight;
        energyWeight += matchWeight;
        bump(artistAcc, entry.key, matchWeight);
        artistNames.set(entry.key, entry.name);
      }
    }

    if (item.matchedKeywords.length > 0) {
      if (!track && !artistKey) hintCount++;
      // Hints are intentionally weaker than real songs and artists.
      const keywordWeight = 0.25 / Math.sqrt(item.matchedKeywords.length);
      for (const keyword of item.matchedKeywords) {
        const keywordEntry = KEYWORD_INDEX.find((candidate) => candidate.keyword === keyword);
        if (!keywordEntry) continue;
        applyProfile(keywordEntry.profile, keywordWeight, genreAcc, moodAcc);
        energySum += keywordEntry.profile.energy * keywordWeight;
        energyWeight += keywordWeight;
      }
    }
  }

  const genreWeights = sortedEntries(genreAcc).map(({ key, weight }) => ({
    genre: key,
    weight,
  }));
  const moodWeights = sortedEntries(moodAcc).map(({ key, weight }) => ({
    mood: key,
    weight,
  }));
  const decadeWeights = sortedEntries(decadeAcc).map(({ key, weight }) => ({
    decade: key,
    weight,
  }));

  const profile: TasteProfile = {
    genreWeights,
    moodWeights,
    avgEnergy: energyWeight > 0 ? energySum / energyWeight : null,
    decadeWeights,
    recognizedCount,
    totalLines: new Set(lines.map(normalizeText)).size,
    recognizedTracks: userTracks.size,
    recognizedArtists: artistAcc.size,
    hintCount,
  };

  if (genreAcc.size === 0 && moodAcc.size === 0) {
    return {
      profile,
      recommendations: [],
      parsed,
      unrecognized: lines.filter(
        (line) => !parsed.some((item) => normalizeText(item.raw) === normalizeText(line))
      ),
    };
  }

  const expandedUserGenres = expandGenres(genreAcc);
  const favoriteDecade = topDecade(decadeWeights);
  const blend = aspectBlend(prefs);
  const candidates: {
    recommendation: Recommendation;
    primaryArtist: string;
    primaryGenre: string;
  }[] = [];

  for (const track of CATALOG) {
    const trackKey = `${normalizeText(track.title)}::${normalizeText(track.artist)}`;
    if (userTrackKeys.has(trackKey)) continue;

    const genreVector = trackGenreVector(track);
    const moodVector = trackMoodVector(track);
    const genreFit = cosineSimilarity(expandedUserGenres, genreVector);
    const moodFit = cosineSimilarity(moodAcc, moodVector);
    const energyFit = profile.avgEnergy === null
      ? 0
      : Math.exp(-((track.energy - profile.avgEnergy) ** 2) / (2 * 2.2 ** 2));
    const decadeFit = eraFit(track, favoriteDecade);

    const keys = trackArtistKeys(track);
    const artistFit = keys.some((key) => artistAcc.has(key)) ? 1 : 0;

    let nearestSeed: { track: Track; similarity: number } | null = null;
    for (const seed of userTracks.values()) {
      const similarity =
        cosineSimilarity(genreVector, trackGenreVector(seed)) * 0.65 +
        cosineSimilarity(moodVector, trackMoodVector(seed)) * 0.35;
      if (!nearestSeed || similarity > nearestSeed.similarity) {
        nearestSeed = { track: seed, similarity };
      }
    }

    // Weights sum to 1. Artist affinity is a boost, not a requirement; unknown
    // era/energy weights are redistributed instead of dragging every score down.
    let genreWeight = 0.36;
    let moodWeight = 0.18;
    if (profile.avgEnergy === null) {
      genreWeight += 0.1;
      moodWeight += 0.06;
    }
    if (!favoriteDecade) {
      genreWeight += 0.06;
      moodWeight += 0.04;
    }
    // Base taste fit, used for the admission gate below. Slider blending
    // steers ranking toward the vibe the user dialed in, and aspect pull also
    // acts as a side gate — a track that strongly matches an active slider
    // (e.g. Chill maxed on a gym playlist) may enter the pool even when its
    // base taste fit is low; otherwise sliders could only re-shuffle an
    // already fixed list.
    const baseScore =
      genreFit * genreWeight +
      moodFit * moodWeight +
      energyFit * (profile.avgEnergy === null ? 0 : 0.16) +
      decadeFit * (favoriteDecade ? 0.1 : 0) +
      artistFit * 0.2;
    const aspect = prefs && blend > 0 ? aspectAlignment(track, prefs) : null;
    const aspectPull = aspect && blend > 0 ? aspect.value * blend : 0;
    const unrelated = genreFit < 0.16 && moodFit < 0.18 && artistFit === 0;

    if (baseScore + aspectPull < 0.27 || (unrelated && aspectPull < 0.18)) {
      continue;
    }

    const score =
      aspect && blend > 0
        ? baseScore * (1 - blend) + aspect.value * blend
        : baseScore;

    const reasons: string[] = [];
    if (
      aspect?.best &&
      blend > 0 &&
      (prefs?.[aspect.best.key] ?? 0) >= 0.35 &&
      aspect.best.closeness >= 0.75
    ) {
      const label = ASPECTS.find((a) => a.key === aspect.best!.key)?.label ?? aspect.best.key;
      reasons.push(`On your ${label} wavelength`);
    }
    const matchedArtistKey = keys.find((key) => artistAcc.has(key));
    if (matchedArtistKey) {
      reasons.push(`From ${artistNames.get(matchedArtistKey) ?? track.artist}, an artist in your input`);
    }
    if (
      nearestSeed &&
      nearestSeed.similarity >= 0.72 &&
      normalizeText(nearestSeed.track.artist) !== normalizeText(track.artist)
    ) {
      reasons.push(`Close to “${nearestSeed.track.title}” from your playlist`);
    }

    const genreHits = track.genres.filter((genre) => expandedUserGenres.has(genre));
    const moodHits = track.moods.filter((mood) => moodAcc.has(mood));
    if (genreHits.length > 0) {
      reasons.push(`Fits your ${genreHits.slice(0, 2).join(" + ")} taste`);
    }
    if (moodHits.length > 0) {
      reasons.push(`Shares your ${moodHits.slice(0, 2).join(" / ")} mood`);
    }
    if (profile.avgEnergy !== null && energyFit >= 0.8) {
      reasons.push(`Energy ${track.energy}/10 is close to your ${profile.avgEnergy.toFixed(1)}/10`);
    }
    if (favoriteDecade && decadeFit === 1) {
      reasons.push(`Matches your ${favoriteDecade} lean`);
    }

    candidates.push({
      recommendation: {
        track,
        match: Math.max(1, Math.min(99, Math.round(score * 100))),
        reasons: reasons.slice(0, 3),
      },
      primaryArtist: keys[0] ?? normalizeText(track.artist),
      primaryGenre: track.genres[0] ?? "other",
    });
  }

  // Maximal-marginal-relevance-style selection: repeatedly pick the best
  // remaining fit with soft penalties for artist/genre repetition.
  const pool = [...candidates];
  const selected: Recommendation[] = [];
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  while (pool.length > 0 && selected.length < 12) {
    let bestIndex = 0;
    let bestAdjustedScore = -Infinity;
    pool.forEach((candidate, index) => {
      const artistCount = artistCounts.get(candidate.primaryArtist) ?? 0;
      const genreCount = genreCounts.get(candidate.primaryGenre) ?? 0;
      const adjusted =
        candidate.recommendation.match -
        artistCount * 10 -
        genreCount * 2.5 -
        (artistCount >= 2 ? 100 : 0);
      if (adjusted > bestAdjustedScore) {
        bestAdjustedScore = adjusted;
        bestIndex = index;
      }
    });
    const [chosen] = pool.splice(bestIndex, 1);
    selected.push(chosen.recommendation);
    bump(artistCounts, chosen.primaryArtist, 1);
    bump(genreCounts, chosen.primaryGenre, 1);
  }

  const unrecognized = lines.filter(
    (line) => !parsed.some((item) => normalizeText(item.raw) === normalizeText(line))
  );

  return { profile, recommendations: selected, parsed, unrecognized };
}