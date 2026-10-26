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
