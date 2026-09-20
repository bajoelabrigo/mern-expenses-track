import { describe, it, expect } from "vitest";
import { dayLabel, isScheduled, toISODate } from "../lib/periods";

const dias = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe("fechas", () => {
  it("lo programado es lo que tiene fecha posterior a hoy", () => {
    expect(isScheduled(dias(1))).toBe(true);
    expect(isScheduled(dias(30))).toBe(true);
    //! Hoy no está programado, aunque sea más tarde
    expect(isScheduled(new Date())).toBe(false);
    expect(isScheduled(dias(-1))).toBe(false);
  });

  it("agrupa los días por su nombre", () => {
    expect(dayLabel(new Date())).toBe("Hoy");
    expect(dayLabel(dias(-1))).toBe("Ayer");
    expect(toISODate(new Date("2026-03-05T12:00:00"))).toBe("2026-03-05");
  });
});
