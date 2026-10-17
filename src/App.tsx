import { useMemo, useState } from "react";
import {
  Music2,
  Sparkles,
  ListMusic,
  Flame,
  Waves,
  Disc3,
  CircleHelp,
  RotateCcw,
  Heart,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { analyze, type AnalysisResult } from "@/lib/engine";

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "Indie Chill",
    text: `Holocene - Bon Iver
The Night We Met - Lord Huron
Motion Sickness - Phoebe Bridgers
Electric Feel - MGMT
Breezeblocks - alt-J
Dreams - Fleetwood Mac
chill dreamy vibes`,
  },
  {
    label: "Gym Hype",
    text: `Lose Yourself - Eminem
Stronger - Kanye West
Sicko Mode - Travis Scott
Seven Nation Army - The White Stripes
Levels - Avicii
Enter Sandman - Metallica
high energy workout`,
  },
  {
    label: "90s Throwback",
    text: `Smells Like Teen Spirit - Nirvana
Juicy - The Notorious B.I.G.
Zombie - The Cranberries
No Diggity - Blackstreet
Creep - Radiohead
nostalgic 90s`,
  },
  {
    label: "Focus Flow",
    text: `Clair de Lune - Claude Debussy
Weightless - Marconi Union
Nuvole Bianche - Ludovico Einaudi
An Ending (Ascent) - Brian Eno
Take Five - Dave Brubeck
study focus peaceful`,
  },
];

const PLACEHOLDER = `Paste your playlists here — one song per line, like:

Blinding Lights - The Weeknd
Mr. Brightside - The Killers
Redbone - Childish Gambino
…

Artists, genres and hints like "workout" or "chill lofi" work too.`;

function energyLabel(e: number): string {
  if (e <= 2.5) return "Mellow";
  if (e <= 5) return "Laid-back";
  if (e <= 7.5) return "Upbeat";
  return "High-Octane";
}

export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const run = () => {
    if (!input.trim()) return;
    setResult(analyze(input));
    requestAnimationFrame(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const genreMax = useMemo(
    () => Math.max(...(result?.profile.genreWeights.map((g) => g.weight) ?? [1]), 1),
    [result]
  );

  return (
    <div className="min-h-screen bg-[#0b0714] text-slate-100 selection:bg-fuchsia-500/40">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-indigo-600/15 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* header */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/30">
              <Music2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">GrooveMatch</span>
          </div>
          <Badge variant="outline" className="border-white/15 text-slate-400">
            <Radio className="mr-1.5 h-3 w-3" /> runs 100% in your browser
          </Badge>
        </header>

        {/* hero */}
        <section className="py-14 text-center sm:py-20">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-1.5 text-sm text-fuchsia-300">
            <Sparkles className="h-4 w-4" /> Playlist-powered music discovery
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Paste your playlists.{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
              Find your next obsession.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
            GrooveMatch reads the songs you already love, maps your taste across genres, moods and
            energy — then scores every track in its catalog for fit.
          </p>
        </section>

        {/* input */}
        <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-200">
              <ListMusic className="h-5 w-5 text-fuchsia-400" />
              Your playlists
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PLACEHOLDER}
              className="min-h-[190px] resize-y border-white/10 bg-black/30 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus-visible:ring-fuchsia-500/50"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-500">Try a sample:</span>
              {SAMPLES.map((s) => (
                <Button
                  key={s.label}
                  size="sm"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-slate-300 hover:bg-fuchsia-500/15 hover:text-fuchsia-200"
                  onClick={() => setInput(s.text)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                onClick={run}
                disabled={!input.trim()}
                className="bg-gradient-to-r from-fuchsia-500 to-violet-600 px-6 font-semibold text-white shadow-lg shadow-fuchsia-600/30 hover:from-fuchsia-400 hover:to-violet-500 disabled:opacity-40"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze my taste
              </Button>
              {result && (
                <Button
                  variant="ghost"
                  className="text-slate-400 hover:text-slate-200"
                  onClick={() => {
                    setInput("");
                    setResult(null);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Start over
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* results */}
        {result && (
          <div id="results" className="mt-12 space-y-8 scroll-mt-8">
            {/* taste profile */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <Disc3 className="h-5 w-5 text-fuchsia-400" /> Your taste profile
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Top genres</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.profile.genreWeights.slice(0, 6).map((g) => (
                      <div key={g.genre}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="capitalize text-slate-300">{g.genre}</span>
                          <span className="text-slate-500">
                            {Math.round((g.weight / genreMax) * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={(g.weight / genreMax) * 100}
                          className="h-1.5 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-fuchsia-500 [&>div]:to-violet-500"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Mood signature</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap content-start gap-2">
                    {result.profile.moodWeights.slice(0, 10).map((m) => (
                      <Badge
                        key={m.mood}
                        className="border-fuchsia-500/30 bg-fuchsia-500/10 capitalize text-fuchsia-200 hover:bg-fuchsia-500/20"
                      >
                        {m.mood}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Energy level</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-3">
                      <span className="text-4xl font-extrabold text-fuchsia-300">
                        {result.profile.avgEnergy.toFixed(1)}
                      </span>
                      <span className="pb-1 text-sm text-slate-500">/ 10</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
                      {result.profile.avgEnergy > 6 ? (
                        <Flame className="h-4 w-4" />
                      ) : (
                        <Waves className="h-4 w-4" />
                      )}
                      {energyLabel(result.profile.avgEnergy)}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Recognized {result.profile.recognizedCount} of {result.profile.totalLines}{" "}
                      lines in your input.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* recommendations */}
            <section>
              <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
                <Heart className="h-5 w-5 text-pink-400" /> Fitted for you
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                {result.recommendations.length} tracks scored against your profile
              </p>
              {result.recommendations.length === 0 ? (
                <Card className="border-white/10 bg-white/[0.04] p-8 text-center text-slate-400">
                  No close matches — try adding more songs or artists to your input.
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.recommendations.map((r) => (
                    <Card
                      key={`${r.track.title}-${r.track.artist}`}
                      className="group border-white/10 bg-white/[0.04] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-fuchsia-500/40 hover:bg-white/[0.07]"
                    >
                      <CardContent className="p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/25 to-violet-600/25 text-fuchsia-300">
                            <Music2 className="h-5 w-5" />
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-extrabold leading-none text-fuchsia-300">
                              {r.match}
                              <span className="text-sm font-semibold text-fuchsia-500/70">%</span>
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">
                              match
                            </div>
                          </div>
                        </div>
                        <h3 className="font-semibold leading-snug text-slate-100">{r.track.title}</h3>
                        <p className="mb-3 text-sm text-slate-400">
                          {r.track.artist} · {r.track.year}
                        </p>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {r.track.genres.slice(0, 3).map((g) => (
                            <Badge
                              key={g}
                              variant="outline"
                              className="border-white/15 px-1.5 py-0 text-[10px] capitalize text-slate-400"
                            >
                              {g}
                            </Badge>
                          ))}
                        </div>
                        <ul className="space-y-1">
                          {r.reasons.map((reason) => (
                            <li key={reason} className="flex items-start gap-1.5 text-xs text-slate-500">
                              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-fuchsia-500/70" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* unrecognized hint */}
            {result.unrecognized.length > 0 && (
              <Card className="border-amber-500/20 bg-amber-500/[0.06]">
                <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-200/80">
                  <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    Some lines weren't recognized and were skipped:{" "}
                    <span className="text-amber-100/60">
                      {result.unrecognized.slice(0, 4).join(" · ")}
                      {result.unrecognized.length > 4 ? " …" : ""}
                    </span>
                    . Tip: use the format <code className="rounded bg-black/40 px-1">Song - Artist</code>.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <footer className="mt-20 border-t border-white/5 pt-6 text-center text-xs text-slate-600">
          GrooveMatch — a demo recommendation engine. All analysis happens locally; nothing is
          uploaded.
        </footer>
      </div>
    </div>
  );
}
