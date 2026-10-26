import { afterEach, describe, expect, it, vi } from "vitest"
import {
  calculateStockActionsValueCents,
  formatCurrencyFromCents,
  formatMonthYearFromIso,
  formatRelativeTimestampFromIso,
  parseCurrencyToCents,
  TOTAL_STOCK_ACTIONS_VALUE_CENTS,
  TOTAL_DISNAT_VALUE_CENTS,
  DISNAT_CRI_CENTS,
  STOCK_ACTIONS,
  ACCOUNTS,
  type StockAction,
  type AccountItem,
} from "@/lib/portfolio-data"
import { syncAccountsWithStockActions } from "@/lib/portfolio-context"

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

  it("calculates total executed stock actions value correctly", () => {
    const testActions: StockAction[] = [
      {
        id: "1",
        symbol: "TEST",
        action: "buy",
        shares: 10,
        priceCents: 1000,
        tradeDateIso: "2026-10-25T00:00:00.000Z",
        status: "executed",
      },
      {
        id: "2",
        symbol: "TEST",
        action: "sell",
        shares: 2,
        priceCents: 1000,
        tradeDateIso: "2026-10-25T00:00:00.000Z",
        status: "executed",
      },
      {
        id: "3",
        symbol: "TEST",
        action: "buy",
        shares: 5,
        priceCents: 1000,
        tradeDateIso: "2026-10-25T00:00:00.000Z",
        status: "pending",
      },
    ]

    // 10*1000 - 2*1000 = 8000
    expect(calculateStockActionsValueCents(testActions)).toBe(8000)
  })

  it("sets default investment account balances equal to real Disnat accounts", () => {
    expect(TOTAL_STOCK_ACTIONS_VALUE_CENTS).toBe(calculateStockActionsValueCents(STOCK_ACTIONS))
    expect(TOTAL_STOCK_ACTIONS_VALUE_CENTS).toBe(10_438_893)

    const totalInvestmentCents = ACCOUNTS.filter((a) => a.type === "investment").reduce(
      (sum, a) => sum + a.balanceCents,
      0
    )
    expect(totalInvestmentCents).toBe(TOTAL_DISNAT_VALUE_CENTS)
    expect(TOTAL_DISNAT_VALUE_CENTS).toBe(11_100_726)

    const cri = ACCOUNTS.find((a) => a.id === "disnat-cri")
    expect(cri?.balanceCents).toBe(DISNAT_CRI_CENTS)
    expect(cri?.balanceCents).toBe(7_530_052)
  })

  it("synchronizes investment account balance with stock actions in portfolio context", () => {
    const sampleAccounts: AccountItem[] = [
      { id: "1", title: "Checking", balanceCents: 100_000, type: "checking" },
      { id: "3", title: "Investment Portfolio", balanceCents: 1_523_080, type: "investment" },
    ]

    const updated = syncAccountsWithStockActions(sampleAccounts, STOCK_ACTIONS)
    expect(updated[1].balanceCents).toBe(10_438_893)
    expect(updated[0].balanceCents).toBe(100_000)
  })
})

describe("stock actions (positions réelles, classeur « Investissement Principale »)", () => {
  it("keeps one executed position per holding and account (13 positions)", () => {
    expect(STOCK_ACTIONS).toHaveLength(13)
    expect(STOCK_ACTIONS.every((action) => action.status === "executed")).toBe(true)
    // VEQT est détenu dans deux comptes distincts (Retraite et Disnat CELI CAD).
    expect(STOCK_ACTIONS.filter((action) => action.symbol === "TSE:VEQT")).toHaveLength(2)
  })

  it("matches the quantities and average prices verified in the workbook on 2026-10-26", () => {
    const byId = new Map(STOCK_ACTIONS.map((action) => [action.id, action]))
    // [id, symbole, quantité, prix moyen en cents] — onglet Dashboard du classeur.
    const expected: Array<[string, string, number, number]> = [
      ["1", "TSE:VEQT", 1100, 5523],
      ["2", "TSE:PAVE", 81, 2808],
      ["3", "TSE:HURA", 94, 5308],
      ["4", "TSE:MTRX", 93, 3508],
      ["5", "TSE:VEQT", 281, 6112],
      ["6", "NASDAQ:BOTZ", 51, 3830],
      ["7", "KOID", 11, 3887],
      ["8", "NYSEARCA:URNM", 13, 4763],
      ["9", "NYSEARCA:VT", 77, 15527],
      ["10", "NASDAQ:AVGO", 1, 34424],
      ["11", "NASDAQ:ISRG", 1, 35082],
      ["12", "NYSE:VRT", 1, 25116],
      ["13", "NASDAQ:TDAC", 3, 1090],
    ]
    for (const [id, symbol, shares, priceCents] of expected) {
      const action = byId.get(id)
      expect(action?.symbol).toBe(symbol)
      expect(action?.shares).toBe(shares)
      expect(action?.priceCents).toBe(priceCents)
    }
  })
})
