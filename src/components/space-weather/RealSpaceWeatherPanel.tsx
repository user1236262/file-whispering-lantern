import { useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, RefreshCw, Satellite } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getRealSpaceWeather } from "@/lib/space-weather.functions";
import {
  cmeSpeedLabel,
  flareSize,
  type CmeRecord,
  type Feed,
  type FlareRecord,
  type RangeDays,
  type SepRecord,
  type SpaceWeatherReport,
} from "@/lib/space-weather";

function formatUtc(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

const sizeStyles: Record<ReturnType<typeof flareSize>, string> = {
  Tiny: "bg-muted text-muted-foreground",
  Small: "bg-accent/20 text-accent",
  Medium: "bg-primary/20 text-primary",
  Huge: "bg-destructive/25 text-destructive",
  Unknown: "bg-muted text-muted-foreground",
};

function NasaLink({ href, label = "See NASA record" }: { href: string | null; label?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-bold text-accent underline-offset-2 hover:underline"
    >
      {label} <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function RecordCard({ children }: { children: React.ReactNode }) {
  return <li className="rounded-xl border border-border bg-card p-3 text-sm text-card-foreground">{children}</li>;
}

function FeedBody<T>({
  feed,
  empty,
  render,
}: {
  feed: Feed<T>;
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  if (feed.status === "unavailable") {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        NASA isn't answering for this list right now. Try again later — your game keeps its own space weather.
      </p>
    );
  }
  if (feed.items.length === 0) {
    return <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {feed.total} recorded{feed.total > feed.items.length ? ` · showing newest ${feed.items.length}` : ""}
      </p>
      <ul className="space-y-2">{feed.items.map(render)}</ul>
    </>
  );
}

function Explainer({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">{children}</p>;
}

function FlareItem(f: FlareRecord) {
  const size = flareSize(f.classType);
  return (
    <RecordCard key={f.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base">Class {f.classType}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", sizeStyles[size])}>{size}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Started {formatUtc(f.beginTime)}</p>
      {f.peakTime && <p className="text-xs text-muted-foreground">Brightest {formatUtc(f.peakTime)}</p>}
      {(f.sourceLocation || f.activeRegion) && (
        <p className="text-xs text-muted-foreground">
          {f.sourceLocation && `Spot on Sun: ${f.sourceLocation}`}
          {f.sourceLocation && f.activeRegion ? " · " : ""}
          {f.activeRegion && `Region ${f.activeRegion}`}
        </p>
      )}
      <div className="mt-2">
        <NasaLink href={f.link} />
      </div>
    </RecordCard>
  );
}

function CmeItem(c: CmeRecord) {
  const speed = cmeSpeedLabel(c.speed);
  return (
    <RecordCard key={c.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base">Solar storm cloud</span>
        {speed && (
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">{speed}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Left the Sun {formatUtc(c.startTime)}</p>
      {c.speed != null && (
        <p className="text-xs text-muted-foreground">
          Speed {Math.round(c.speed).toLocaleString("en-GB")} km/s
          {c.halfAngle != null ? ` · Width ${Math.round(c.halfAngle * 2)}°` : ""}
          {c.analysisType ? ` · Type ${c.analysisType}` : ""}
        </p>
      )}
      {c.note && <p className="mt-1 text-xs leading-relaxed">{c.note}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        <NasaLink href={c.link} />
        <NasaLink href={c.analysisLink} label="See analysis" />
      </div>
    </RecordCard>
  );
}

function SepItem(s: SepRecord) {
  return (
    <RecordCard key={s.id}>
      <span className="font-display text-base">Particle storm</span>
      <p className="mt-1 text-xs text-muted-foreground">Detected {formatUtc(s.eventTime)}</p>
      {s.instruments.length > 0 && (
        <p className="text-xs text-muted-foreground">Seen by {s.instruments.join(", ")}</p>
      )}
      <div className="mt-2">
        <NasaLink href={s.link} />
      </div>
    </RecordCard>
  );
}

function ReportView({ report }: { report: SpaceWeatherReport }) {
  return (
    <Tabs defaultValue="flares" className="flex flex-col gap-3">
      <TabsList className="grid h-auto w-full grid-cols-3 bg-muted">
        <TabsTrigger value="flares" className="py-1.5 text-xs">☀️ Flares</TabsTrigger>
        <TabsTrigger value="cmes" className="py-1.5 text-xs">💨 Storms</TabsTrigger>
        <TabsTrigger value="seps" className="py-1.5 text-xs">⚡ Particles</TabsTrigger>
      </TabsList>
      <TabsContent value="flares" className="mt-0 space-y-3">
        <Explainer>
          <b>Solar flares</b> are sudden flashes of light and energy from the Sun. Scientists sort them by size:
          A, B and C are small, M is medium and X is the biggest.
        </Explainer>
        <FeedBody feed={report.flares} empty="No solar flares were recorded in these days." render={FlareItem} />
      </TabsContent>
      <TabsContent value="cmes" className="mt-0 space-y-3">
        <Explainer>
          <b>Coronal mass ejections (CMEs)</b> are giant clouds of the Sun's gas blasted into space. NASA scientists
          measure how fast and how wide they are.
        </Explainer>
        <FeedBody feed={report.cmes} empty="No solar storm clouds were recorded in these days." render={CmeItem} />
      </TabsContent>
      <TabsContent value="seps" className="mt-0 space-y-3">
        <Explainer>
          <b>Solar energetic particles (SEPs)</b> are tiny bits of the Sun moving super fast. Astronauts shelter from
          them because they carry radiation.
        </Explainer>
        <FeedBody feed={report.seps} empty="No particle storms were recorded in these days." render={SepItem} />
      </TabsContent>
    </Tabs>
  );
}

export function RealSpaceWeatherPanel({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<RangeDays>(7);
  const fetchReport = useServerFn(getRealSpaceWeather);

  const query = useQuery({
    ...queryOptions({
      queryKey: ["real-space-weather", days],
      queryFn: () => fetchReport({ data: { days } }),
      staleTime: 10 * 60 * 1000,
    }),
    enabled: open,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Real Space Weather from NASA"
        className="fixed right-2 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl border-2 border-border bg-card/90 px-2 py-2 text-card-foreground shadow-lg backdrop-blur transition hover:scale-105 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Satellite className="h-5 w-5 text-accent" aria-hidden />
        <span className="font-display text-[10px] leading-none tracking-wide">NASA</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden border-border bg-background p-0 text-foreground sm:max-w-md"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed?.();
          }}
        >
          <SheetHeader className="space-y-2 border-b border-border p-4 pr-10 text-left">
            <span className="w-fit rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
              Real NASA data
            </span>
            <SheetTitle className="font-display text-2xl text-foreground">🛰️ Real Space Weather</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Real events recorded by NASA's DONKI space weather database. Most were spotted from near Earth — not
              every one reaches Mars, and they don't change your game.
            </SheetDescription>
            <div className="flex items-center gap-2 pt-1">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold transition",
                    days === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-card-foreground hover:border-accent",
                  )}
                >
                  Last {d} days
                </button>
              ))}
              <button
                type="button"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                aria-label="Check NASA again"
                className="ml-auto rounded-full border border-border bg-card p-1.5 text-card-foreground transition hover:border-accent disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} aria-hidden />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {query.isPending ? (
              <div className="space-y-2" aria-live="polite">
                <p className="text-sm text-muted-foreground">Contacting NASA…</p>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : query.isError ? (
              <div className="space-y-3 rounded-xl border border-dashed border-border p-4 text-sm">
                <p>We couldn't reach NASA right now. Your game keeps running its own space weather.</p>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  Try again
                </button>
              </div>
            ) : (
              <ReportView report={query.data} />
            )}
          </div>

          {query.data && (
            <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              {query.data.startDate} to {query.data.endDate} · Updated {formatUtc(query.data.fetchedAt)} · Source:
              NASA DONKI (CCMC)
            </footer>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
