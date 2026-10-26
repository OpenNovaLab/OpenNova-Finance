import { afterEach, describe, expect, it, vi } from "vitest"
import {
  formatCurrencyFromCents,
  formatMonthYearFromIso,
  formatRelativeTimestampFromIso,
  parseCurrencyToCents,
  PORTFOLIO_SNAPSHOT,
  STOCK_ACTIONS,
} from "@/lib/portfolio-data"

describe("portfolio-data utilities", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("parses formatted currency strings into cents", () => {
    expect(parseCurrencyToCents("$1,234.56")).toBe(123_456)
    expect(parseCurrencyToCents("2500")).toBe(250_000)
    expect(parseCurrencyToCents("invalid")).toBe(0)
  })

  it("formats cents into USD currency string", () => {
    expect(formatCurrencyFromCents(123_456)).toBe("$1,234.56")
  })

  it("formats month-year labels from ISO date", () => {
    expect(formatMonthYearFromIso("2026-06-01T00:00:00.000Z")).toBe("Jun 2026")
  })

  it("formats relative timestamps for today and yesterday", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-03T12:00:00.000Z"))

    expect(formatRelativeTimestampFromIso("2026-03-03T09:15:00.000Z")).toMatch(/^Today,/)
    expect(formatRelativeTimestampFromIso("2026-03-02T09:15:00.000Z")).toMatch(/^Yesterday,/)
  })
})

describe("portfolio snapshot (relevé réel, classeur « Investissement Principale »)", () => {
  it("exposes the 2026-10-26 consolidated snapshot in CAD", () => {
    expect(PORTFOLIO_SNAPSHOT.asOfIso).toBe("2026-10-26T00:00:00.000Z")
    expect(PORTFOLIO_SNAPSHOT.currency).toBe("CAD")
    expect(PORTFOLIO_SNAPSHOT.totalCents).toBe(11_579_045)
  })

  it("breaks the total down by account and sums back to the total", () => {
    expect(PORTFOLIO_SNAPSHOT.accounts).toEqual([
      { id: "retraite", label: "Retraite", balanceCents: 7_361_463 },
      { id: "celi-cad", label: "Disnat CELI CAD", balanceCents: 2_018_409 },
      { id: "celi-usd", label: "Disnat CELI USD", balanceCents: 2_199_173 },
    ])
    const sum = PORTFOLIO_SNAPSHOT.accounts.reduce((acc, account) => acc + account.balanceCents, 0)
    expect(sum).toBe(PORTFOLIO_SNAPSHOT.totalCents)
  })

  it("keeps one executed stock action per real position and account", () => {
    expect(STOCK_ACTIONS).toHaveLength(13)
    expect(STOCK_ACTIONS.every((action) => action.status === "executed")).toBe(true)
    // VEQT est détenu dans deux comptes distincts (Retraite et Disnat CELI CAD).
    expect(STOCK_ACTIONS.filter((action) => action.symbol === "TSE:VEQT")).toHaveLength(2)
  })
})
