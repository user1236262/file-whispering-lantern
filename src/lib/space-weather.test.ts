import { describe, expect, it } from "vitest";

import {
  clampDays,
  dateRange,
  flareSize,
  normalizeCmes,
  normalizeFlares,
  toFeed,
  MAX_ITEMS_PER_FEED,
} from "./space-weather";

describe("space weather helpers", () => {
  it("never asks NASA for more than 30 days", () => {
    expect(clampDays(90)).toBe(30);
    expect(clampDays(0)).toBe(1);
    expect(clampDays(7)).toBe(7);
  });

  it("builds a UTC date range ending today", () => {
    expect(dateRange(7, new Date("2026-11-15T06:00:00Z"))).toEqual({
      startDate: "2026-11-08",
      endDate: "2026-11-15",
    });
  });

  it("labels flare classes by size", () => {
    expect(flareSize("X1.2")).toBe("Huge");
    expect(flareSize("M5.0")).toBe("Medium");
    expect(flareSize("C3.4")).toBe("Small");
    expect(flareSize("B1.0")).toBe("Tiny");
  });

  it("joins a CME with its CMEAnalysis speed", () => {
    const cmes = normalizeCmes(
      [{ activityID: "CME-1", startTime: "2026-11-01T00:00Z" }],
      [{ associatedCMEID: "CME-1", speed: "812.0", halfAngle: "30", type: "C" }],
    );
    expect(cmes[0]?.speed).toBe(812);
    expect(cmes[0]?.halfAngle).toBe(30);
  });

  it("treats a missing NASA answer as unavailable, not as zero events", () => {
    expect(toFeed(null)).toEqual({ status: "unavailable" });
    expect(normalizeFlares("not a list")).toEqual([]);
  });

  it("caps each list at the newest records", () => {
    const many = Array.from({ length: 40 }, (_, i) => i);
    const feed = toFeed(many);
    expect(feed.status === "ok" && feed.items.length).toBe(MAX_ITEMS_PER_FEED);
    expect(feed.status === "ok" && feed.total).toBe(40);
  });
});
