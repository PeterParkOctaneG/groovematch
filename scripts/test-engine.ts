import assert from "node:assert/strict";
import { analyze, parseLine, splitLines } from "../src/lib/engine.ts";

let assertions = 0;
function check(value: unknown, message: string): asserts value {
  assertions++;
  assert.ok(value, message);
}

function expectTrack(line: string, title: string): void {
  const parsed = parseLine(line);
  check(parsed?.matchedCatalogTrack?.title === title, `${line} -> ${title}`);
}

expectTrack("Blinding Lights - The Weeknd", "Blinding Lights");
expectTrack("The Weeknd - Blinding Lights", "Blinding Lights");
expectTrack('"Holocene","Bon Iver"', "Holocene");
expectTrack("Holocene,Bon Iver", "Holocene");
expectTrack("Juicy by The Notorious B.I.G.", "Juicy");
expectTrack("Tame Impala – The Less I Know the Better", "The Less I Know the Better");
expectTrack("Nuvole Bianche (Ludovico Einaudi)", "Nuvole Bianche");
expectTrack("Take On Me - a-ha", "Take On Me");
expectTrack("Anti-Hero - Taylor Swift", "Anti-Hero");
expectTrack("Blinding Light - The Weeknd", "Blinding Lights");
expectTrack("Mr Brightside The Killers", "Mr. Brightside");
expectTrack("The Message - Grandmaster Flash", "The Message");

check(parseLine("The Weekend")?.artistKey === "the weeknd", "common Weeknd typo/alias");
check(parseLine("Bon Iverr")?.fuzzy === true, "fuzzy artist typo");
check(parseLine("My home playlist") === null, "short title must not false-positive");
check(
  parseLine("Earth, Wind & Fire - September")?.artistKey === "earth wind and fire",
  "artist containing comma and ampersand"
);
check(
  parseLine("Tyler, The Creator - See You Again")?.artistKey === "tyler the creator",
  "artist containing comma"
);
check(
  splitLines("Track Name, Artist Name\nHolocene,Bon Iver").length === 1,
  "CSV header is skipped"
);

const unknown = analyze("my secret playlist\nnothing recognizable here");
check(unknown.recommendations.length === 0, "unknown input must not invent generic taste");
check(unknown.profile.avgEnergy === null, "unknown input has no fabricated energy");

const duplicates = analyze("Holocene - Bon Iver\nHolocene - Bon Iver");
check(duplicates.profile.recognizedCount === 1, "duplicate lines counted once");
check(duplicates.profile.totalLines === 1, "duplicate total lines counted once");

const excluded = analyze("Blinding Lights - The Weeknd");
check(
  excluded.recommendations.every((r) => r.track.title !== "Blinding Lights"),
  "input tracks are excluded from recommendations"
);

const indie = analyze(`Holocene - Bon Iver
The Night We Met - Lord Huron
Motion Sickness - Phoebe Bridgers
Electric Feel - MGMT
Breezeblocks - alt-J
Dreams - Fleetwood Mac
chill dreamy vibes`);
check(indie.profile.recognizedTracks === 6, "all six sample tracks recognized");
check(indie.profile.recognizedCount === 7, "keyword-only line is recognized as a hint");
check(indie.recommendations.length > 5, "indie sample produces recommendations");
check(
  new Set(indie.recommendations.map((r) => r.match)).size >= 4,
  "fit scores are differentiated rather than everything at 99%"
);
check(
  Math.max(...indie.recommendations.map((r) => r.match)) < 99,
  "fit scores avoid automatic 99% matches"
);
check(
  indie.recommendations.every((r) => r.reasons.length > 0),
  "every recommendation has an explanation"
);

const artistCounts = new Map<string, number>();
for (const rec of indie.recommendations) {
  artistCounts.set(rec.track.artist, (artistCounts.get(rec.track.artist) ?? 0) + 1);
}
check(
  Math.max(...artistCounts.values()) <= 2,
  "no more than two recommendations per artist"
);

const artistOnly = analyze("Bon Iver");
check(
  artistOnly.recommendations.some((r) => r.track.artist === "Bon Iver"),
  "artist-only input uses artist affinity"
);
check(
  artistOnly.recommendations.filter((r) => r.track.artist === "Bon Iver").length <= 2,
  "artist affinity does not flood the list"
);

const house = analyze("Innerbloom - RÜFÜS DU SOL");
check(
  house.recommendations.some((r) =>
    r.track.genres.some((genre) => ["electronic", "house", "deep house"].includes(genre))
  ),
  "subgenre families inform recommendations"
);

console.log(`Engine regression tests passed: ${assertions} assertions`);
console.log(
  "Indie sample fit scores:",
  indie.recommendations.map((r) => `${r.track.title} (${r.match})`).join(", ")
);
