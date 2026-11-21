import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CloudRain,
  Dumbbell,
  Guitar,
  History,
  PartyPopper,
  RotateCcw,
  SlidersHorizontal,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ASPECTS, type AspectKey, type AspectPrefs } from "@/lib/engine";

const ASPECT_META: Record<
  AspectKey,
  { icon: LucideIcon; gradient: string; glow: string }
> = {
  energy: { icon: Zap, gradient: "from-amber-400 to-orange-500", glow: "shadow-amber-500/40" },
  emo: { icon: CloudRain, gradient: "from-sky-400 to-blue-600", glow: "shadow-sky-500/40" },
  indie: { icon: Guitar, gradient: "from-violet-400 to-purple-600", glow: "shadow-violet-500/40" },
  gym: { icon: Dumbbell, gradient: "from-rose-400 to-red-600", glow: "shadow-rose-500/40" },
  chill: { icon: Waves, gradient: "from-cyan-400 to-teal-500", glow: "shadow-cyan-500/40" },
  party: { icon: PartyPopper, gradient: "from-pink-400 to-fuchsia-600", glow: "shadow-pink-500/40" },
  nostalgic: { icon: History, gradient: "from-yellow-400 to-amber-600", glow: "shadow-yellow-500/40" },
};

function AspectBar({
  icon: Icon,
  label,
  value,
  natural,
  gradient,
  glow,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  natural: number;
  gradient: string;
  glow: string;
  onChange: (value: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const valueFrom = (clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return value;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onChange(valueFrom(event.clientX));
  };
  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) onChange(valueFrom(event.clientX));
  };
  const endDrag = () => setDragging(false);

  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
          <Icon className="h-4 w-4 text-slate-400" />
          {label}
        </span>
        <span
          className={`text-xs tabular-nums transition-colors ${
            dragging ? "text-white" : "text-slate-500"
          }`}
        >
          {Math.round(value * 100)}%
        </span>
      </div>
      <div
        ref={barRef}
        role="slider"
        aria-label={`${label} intensity`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${label} ${Math.round(value * 100)}%`}
        tabIndex={0}
        className="group relative h-7 cursor-ew-resize touch-none rounded-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-fuchsia-500/50"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.05;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(Math.min(1, value + step));
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(Math.max(0, value - step));
          }
        }}
      >
        {/* track */}
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/10" />
        {/* natural-taste marker */}
        <div
          className="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30"
          style={{ left: `${natural * 100}%` }}
          title="Where your playlist naturally sits"
        />
        {/* fill */}
        <div
          className={`absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-r ${gradient} transition-[width] duration-75 ${
            dragging ? "" : "group-hover:brightness-110"
          }`}
          style={{ width: `${value * 100}%` }}
        />
        {/* handle */}
        <div
          className={`absolute top-1/2 h-4.5 w-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ${glow} transition-transform ${
            dragging ? "scale-125" : "group-hover:scale-110"
          }`}
          style={{ left: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function AspectMixer({
  prefs,
  natural,
  active,
  onChange,
  onReset,
}: {
  /** Current slider positions; before the first drag this mirrors `natural`. */
  prefs: AspectPrefs;
  /** Profile-derived natural positions, shown as the marker on each bar. */
  natural: AspectPrefs;
  active: boolean;
  onChange: (key: AspectKey, value: number) => void;
  onReset: () => void;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <SlidersHorizontal className="h-5 w-5 text-fuchsia-400" /> Tune the mix
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Drag a bar to re-rank your recommendations — push <span className="text-slate-300">Gym</span> up
            for a workout, <span className="text-slate-300">Emo</span> up for a late-night spiral.
            <span className="ml-1 text-slate-600">The white tick marks where your playlist naturally sits.</span>
          </p>
        </div>
        {active && (
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:text-slate-200"
            onClick={onReset}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Back to my natural mix
          </Button>
        )}
      </div>
      <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">
            Vibe intensity{active ? " — tuned" : " — matching your taste"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASPECTS.map(({ key, label }) => {
            const meta = ASPECT_META[key];
            return (
              <AspectBar
                key={key}
                icon={meta.icon}
                label={label}
                value={prefs[key] ?? 0}
                natural={natural[key] ?? 0.5}
                gradient={meta.gradient}
                glow={meta.glow}
                onChange={(value) => onChange(key, value)}
              />
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
