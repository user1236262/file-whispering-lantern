// Server-only: talks to NASA DONKI with the private key. Never import from browser code.
import {
  dateRange,
  normalizeCmes,
  normalizeFlares,
  normalizeSeps,
  toFeed,
  type SpaceWeatherReport,
} from "./space-weather";

const DONKI_BASE = "https://api.nasa.gov/DONKI/";
const FRESH_MS = 30 * 60 * 1000; // full report: reuse for 30 minutes
const RETRY_MS = 5 * 60 * 1000; // a feed failed: try NASA again after 5 minutes
const REQUEST_TIMEOUT_MS = 12_000;

type Entry = { at: number; ttl: number; promise: Promise<SpaceWeatherReport> };
const cache = new Map<number, Entry>();

async function fetchDonki(
  endpoint: "FLR" | "CME" | "CMEAnalysis" | "SEP",
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown | null> {
  const url = new URL(endpoint, DONKI_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", apiKey);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Never log the URL: it contains the API key.
      console.warn(`[DONKI] ${endpoint} responded ${res.status}`);
      return null;
    }
    const text = await res.text();
    return text.trim() ? JSON.parse(text) : [];
  } catch (error) {
    console.warn(`[DONKI] ${endpoint} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function buildReport(days: number, apiKey: string | undefined): Promise<SpaceWeatherReport> {
  const { startDate, endDate } = dateRange(days);
  const base = { source: "NASA DONKI" as const, fetchedAt: new Date().toISOString(), days, startDate, endDate };
  if (!apiKey) {
    console.warn("[DONKI] NASA_API_SK is not set");
    return { ...base, flares: toFeed(null), cmes: toFeed(null), seps: toFeed(null) };
  }
  const range = { startDate, endDate };
  const [flr, cme, cmeAnalysis, sep] = await Promise.all([
    fetchDonki("FLR", range, apiKey),
    fetchDonki("CME", range, apiKey),
    fetchDonki("CMEAnalysis", { ...range, mostAccurateOnly: "true", speed: "0", halfAngle: "0", catalog: "ALL" }, apiKey),
    fetchDonki("SEP", range, apiKey),
  ]);
  return {
    ...base,
    flares: toFeed(flr == null ? null : normalizeFlares(flr)),
    cmes: toFeed(cme == null ? null : normalizeCmes(cme, cmeAnalysis)),
    seps: toFeed(sep == null ? null : normalizeSeps(sep)),
  };
}

const anyUnavailable = (r: SpaceWeatherReport) =>
  [r.flares, r.cmes, r.seps].some((f) => f.status === "unavailable");

export function getSpaceWeatherReport(days: number, apiKey: string | undefined) {
  const now = Date.now();
  const hit = cache.get(days);
  if (hit && now - hit.at < hit.ttl) return hit.promise;

  const entry: Entry = { at: now, ttl: FRESH_MS, promise: buildReport(days, apiKey) };
  cache.set(days, entry);
  entry.promise.then(
    (report) => {
      if (anyUnavailable(report)) entry.ttl = RETRY_MS;
    },
    () => cache.delete(days),
  );
  return entry.promise;
}
