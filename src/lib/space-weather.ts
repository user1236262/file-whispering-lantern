// Shared, browser-safe types and pure helpers for the Real Space Weather panel.
// Everything here describes REAL NASA DONKI records; nothing here feeds game state.

export type FlareRecord = {
  id: string;
  beginTime: string;
  peakTime: string | null;
  classType: string;
  sourceLocation: string | null;
  activeRegion: number | null;
  link: string | null;
};

export type CmeRecord = {
  id: string;
  startTime: string;
  note: string | null;
  sourceLocation: string | null;
  speed: number | null;
  halfAngle: number | null;
  analysisType: string | null;
  analysisLink: string | null;
  link: string | null;
};

export type SepRecord = {
  id: string;
  eventTime: string;
  instruments: string[];
  link: string | null;
};

export type Feed<T> = { status: "ok"; items: T[]; total: number } | { status: "unavailable" };

export type SpaceWeatherReport = {
  source: "NASA DONKI";
  fetchedAt: string;
  days: number;
  startDate: string;
  endDate: string;
  flares: Feed<FlareRecord>;
  cmes: Feed<CmeRecord>;
  seps: Feed<SepRecord>;
};

export const ALLOWED_RANGES = [7, 30] as const;
export type RangeDays = (typeof ALLOWED_RANGES)[number];
export const MAX_ITEMS_PER_FEED = 25;

/** NASA SEP rejects ranges over 60 days; the panel never asks for more than 30. */
export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 7;
  return Math.min(30, Math.max(1, Math.round(days)));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateRange(days: number, now: Date = new Date()) {
  const safe = clampDays(days);
  const start = new Date(now.getTime() - safe * 24 * 60 * 60 * 1000);
  return { startDate: toIsoDate(start), endDate: toIsoDate(now) };
}

export type FlareSize = "Tiny" | "Small" | "Medium" | "Huge" | "Unknown";

export function flareSize(classType: string | null | undefined): FlareSize {
  const letter = (classType ?? "").trim().charAt(0).toUpperCase();
  if (letter === "A" || letter === "B") return "Tiny";
  if (letter === "C") return "Small";
  if (letter === "M") return "Medium";
  if (letter === "X") return "Huge";
  return "Unknown";
}

export function cmeSpeedLabel(speed: number | null): string | null {
  if (speed == null) return null;
  if (speed < 500) return "Slow";
  if (speed < 1000) return "Fast";
  return "Very fast";
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const asRecords = (raw: unknown): Record<string, unknown>[] =>
  Array.isArray(raw) ? raw.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];

const newestFirst = <T>(items: T[], time: (t: T) => string) =>
  [...items].sort((a, b) => Date.parse(time(b)) - Date.parse(time(a)));

export function normalizeFlares(raw: unknown): FlareRecord[] {
  const items = asRecords(raw).flatMap((r) => {
    const id = str(r.flrID);
    const beginTime = str(r.beginTime);
    if (!id || !beginTime) return [];
    return [
      {
        id,
        beginTime,
        peakTime: str(r.peakTime),
        classType: str(r.classType) ?? "?",
        sourceLocation: str(r.sourceLocation),
        activeRegion: num(r.activeRegionNum),
        link: str(r.link),
      },
    ];
  });
  return newestFirst(items, (f) => f.beginTime);
}

type Analysis = { speed: number | null; halfAngle: number | null; type: string | null; link: string | null };

function pickAnalysis(r: Record<string, unknown>): Analysis {
  return { speed: num(r.speed), halfAngle: num(r.halfAngle), type: str(r.type), link: str(r.link) };
}

/** Joins CME records with their most accurate CMEAnalysis (from the CMEAnalysis feed, else embedded). */
export function normalizeCmes(rawCmes: unknown, rawAnalyses: unknown): CmeRecord[] {
  const byCme = new Map<string, Analysis>();
  for (const a of asRecords(rawAnalyses)) {
    const cmeId = str(a.associatedCMEID);
    if (cmeId && !byCme.has(cmeId)) byCme.set(cmeId, pickAnalysis(a));
  }
  const items = asRecords(rawCmes).flatMap((r) => {
    const id = str(r.activityID);
    const startTime = str(r.startTime);
    if (!id || !startTime) return [];
    const embedded = asRecords(r.cmeAnalyses);
    const embeddedBest = embedded.find((a) => a.isMostAccurate === true) ?? embedded[0];
    const analysis = byCme.get(id) ?? (embeddedBest ? pickAnalysis(embeddedBest) : null);
    const note = str(r.note);
    return [
      {
        id,
        startTime,
        note: note && note.length > 220 ? `${note.slice(0, 217)}…` : note,
        sourceLocation: str(r.sourceLocation),
        speed: analysis?.speed ?? null,
        halfAngle: analysis?.halfAngle ?? null,
        analysisType: analysis?.type ?? null,
        analysisLink: analysis?.link ?? null,
        link: str(r.link),
      },
    ];
  });
  return newestFirst(items, (c) => c.startTime);
}

export function normalizeSeps(raw: unknown): SepRecord[] {
  const items = asRecords(raw).flatMap((r) => {
    const id = str(r.sepID);
    const eventTime = str(r.eventTime);
    if (!id || !eventTime) return [];
    const instruments = asRecords(r.instruments)
      .map((i) => str(i.displayName))
      .filter((n): n is string => !!n);
    return [{ id, eventTime, instruments, link: str(r.link) }];
  });
  return newestFirst(items, (s) => s.eventTime);
}

export function toFeed<T>(items: T[] | null): Feed<T> {
  if (items == null) return { status: "unavailable" };
  return { status: "ok", items: items.slice(0, MAX_ITEMS_PER_FEED), total: items.length };
}
