"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react"
import {
  ACCOUNTS as DEFAULT_ACCOUNTS,
  ALLOCATION_ACTUAL as DEFAULT_ALLOCATION_ACTUAL,
  ALLOCATION_TARGETS as DEFAULT_ALLOCATION_TARGETS,
  ASSET_BREAKDOWN as DEFAULT_ASSET_BREAKDOWN,
  ALERTS as DEFAULT_ALERTS,
  BUDGETS as DEFAULT_BUDGETS,
  CASHFLOW_FORECAST as DEFAULT_CASHFLOW_FORECAST,
  DIVERSIFICATION_BREAKDOWN as DEFAULT_DIVERSIFICATION_BREAKDOWN,
  PERFORMANCE_METRICS as DEFAULT_PERFORMANCE_METRICS,
  RISK_METRICS as DEFAULT_RISK_METRICS,
  LIABILITY_BREAKDOWN as DEFAULT_LIABILITY_BREAKDOWN,
  NET_WORTH_HISTORY as DEFAULT_NET_WORTH_HISTORY,
  TRANSACTIONS as DEFAULT_TRANSACTIONS,
  FINANCIAL_GOALS as DEFAULT_GOALS,
  STOCK_ACTIONS as DEFAULT_STOCK_ACTIONS,
  ALERTS_THRESHOLDS as DEFAULT_ALERTS_THRESHOLDS,
  PLANNING_SCENARIOS as DEFAULT_PLANNING_SCENARIOS,
  dollarsToCents,
  formatCurrencyFromCents,
  parseCurrencyToCents,
  calculateStockActionsValueCents,
  type AllocationActual,
  type AllocationTarget,
  type NetWorthBreakdownItem,
  type NetWorthHistoryPoint,
  type PerformanceMetric,
  type RiskMetric,
  type AccountItem,
  type Transaction,
  type FinancialGoal,
  type StockAction,
  type BudgetCategory,
  type CashflowForecastPoint,
  type PortfolioAlert,
  type AlertThreshold,
  type PlanningScenario,
  type DiversificationBreakdown,
} from "./portfolio-data"
import { fetchRemotePortfolioState, pushRemotePortfolioState } from "./portfolio-sync-client"
import { loadSettingsSnapshot } from "./settings-store"
import { createUuidLike } from "./random-id"

const STORAGE_KEYS = {
  STATE: "portfolio_state_v2",
  BACKUP: "portfolio_state_backup_v2",
  PREVIOUS_STATE: "portfolio_state_v1",
  PREVIOUS_BACKUP: "portfolio_state_backup_v1",
  LEGACY_ACCOUNTS: "portfolio_accounts",
  LEGACY_TRANSACTIONS: "portfolio_transactions",
  LEGACY_GOALS: "portfolio_goals",
  LEGACY_STOCK_ACTIONS: "portfolio_stock_actions",
  LAST_SAVED: "portfolio_last_saved",
}

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined"

type PortfolioStateV2 = {
  version: 2
  accounts: AccountItem[]
  transactions: Transaction[]
  goals: FinancialGoal[]
  stockActions: StockAction[]
  lastSaved: string
}

type PortfolioStateV1 = {
  version: 1
  accounts: unknown[]
  transactions: unknown[]
  goals: unknown[]
  stockActions: unknown[]
  lastSaved: string
}

const ACCOUNT_TYPES = ["savings", "checking", "investment", "debt"] as const
const TRANSACTION_TYPES = ["incoming", "outgoing"] as const
const TRANSACTION_STATUSES = ["completed", "pending", "failed"] as const
const GOAL_STATUSES = ["pending", "in-progress", "completed"] as const
const STOCK_ACTION_TYPES = ["buy", "sell"] as const
const STOCK_ACTION_STATUSES = ["executed", "pending", "cancelled"] as const

const isPortfolioStateV2 = (value: unknown): value is PortfolioStateV2 => {
  if (!value || typeof value !== "object") return false
  const data = value as PortfolioStateV2
  return (
    data.version === 2 &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.transactions) &&
    Array.isArray(data.goals) &&
    Array.isArray(data.stockActions) &&
    typeof data.lastSaved === "string"
  )
}

const isPortfolioStateV1 = (value: unknown): value is PortfolioStateV1 => {
  if (!value || typeof value !== "object") return false
  const data = value as PortfolioStateV1
  return (
    data.version === 1 &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.transactions) &&
    Array.isArray(data.goals) &&
    Array.isArray(data.stockActions) &&
    typeof data.lastSaved === "string"
  )
}

const loadJson = <T,>(key: string): { exists: boolean; value: T | null } => {
  if (!canUseStorage()) return { exists: false, value: null }
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) return { exists: false, value: null }
    if (stored === "undefined" || stored === "null" || stored.trim() === "") {
      return { exists: true, value: null }
    }
    return { exists: true, value: JSON.parse(stored) as T }
  } catch {
    console.warn(`Failed to load ${key} from localStorage; clearing corrupt value.`)
    try {
      window.localStorage.removeItem(key)
    } catch {}
    return { exists: true, value: null }
  }
}

const savePortfolioState = (state: PortfolioStateV2) => {
  if (!canUseStorage()) return
  try {
    const previous = window.localStorage.getItem(STORAGE_KEYS.STATE)
    if (previous) {
      window.localStorage.setItem(STORAGE_KEYS.BACKUP, previous)
    }
    window.localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state))
    window.localStorage.setItem(STORAGE_KEYS.LAST_SAVED, state.lastSaved)
  } catch (error) {
    console.error("Failed to save portfolio state to localStorage:", error)
  }
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined

const asLiteral = <T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] => {
  if (typeof value !== "string") return fallback
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback
}

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const createUuid = () => {
  return createUuidLike()
}

const createGeneratedId = (prefix: string) => `${prefix}-${createUuid()}`

const parseLegacyRelativeDateTime = (value: string): string | null => {
  const match = value.match(/^(today|yesterday),\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (!match) return null

  const [, dayLabel, rawHour, rawMinute, meridiem] = match
  const hour = Number.parseInt(rawHour, 10)
  const minute = Number.parseInt(rawMinute, 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

  const date = new Date()
  if (dayLabel.toLowerCase() === "yesterday") {
    date.setDate(date.getDate() - 1)
  }

  let normalizedHour = hour % 12
  if (meridiem.toLowerCase() === "pm") {
    normalizedHour += 12
  }

  date.setHours(normalizedHour, minute, 0, 0)
  return date.toISOString()
}

const parseMonthYearToIso = (value: string): string | null => {
  const cleaned = value.replace(/^Target:\s*/i, "").trim()
  const match = cleaned.match(/^([A-Za-z]{3,9})\s+(\d{4})$/)
  if (!match) return null

  const [, monthRaw, yearRaw] = match
  const year = Number.parseInt(yearRaw, 10)
  const monthDate = new Date(`${monthRaw} 1, ${yearRaw}`)
  if (!Number.isFinite(year) || Number.isNaN(monthDate.getTime())) return null

  const utcDate = new Date(Date.UTC(year, monthDate.getUTCMonth(), 1, 0, 0, 0))
  return utcDate.toISOString()
}

const parseDateToIso = (value: unknown, fallbackIso: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    return fallbackIso
  }

  const relative = parseLegacyRelativeDateTime(value.trim())
  if (relative) {
    return relative
  }

  const monthYear = parseMonthYearToIso(value)
  if (monthYear) {
    return monthYear
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIso
  }
  return parsed.toISOString()
}

const normalizeAccounts = (raw: unknown): AccountItem[] | null => {
  if (!Array.isArray(raw)) return null
  return raw.map((entry, index) => {
    const fallback = DEFAULT_ACCOUNTS[index] ?? DEFAULT_ACCOUNTS[0]
    if (!entry || typeof entry !== "object") {
      return { ...fallback, id: createGeneratedId("account") }
    }

    const account = entry as Partial<
      AccountItem & {
        balance?: string
      }
    >

    const normalizedBalanceCents = asFiniteNumber(account.balanceCents)
    const hasBalanceCents = normalizedBalanceCents !== undefined
    const hasLegacyBalance = typeof account.balance === "string"
    const balanceCents = hasBalanceCents
      ? Math.round(normalizedBalanceCents)
      : hasLegacyBalance
        ? parseCurrencyToCents(account.balance)
        : fallback.balanceCents

    return {
      id: asString(account.id) ?? createGeneratedId("account"),
      title: asString(account.title) ?? fallback.title,
      description: typeof account.description === "string" ? account.description : fallback.description,
      balanceCents,
      type: asLiteral(account.type, ACCOUNT_TYPES, fallback.type),
    }
  })
}

const normalizeTransactions = (raw: unknown): Transaction[] | null => {
  if (!Array.isArray(raw)) return null
  return raw.map((entry, index) => {
    const fallback = DEFAULT_TRANSACTIONS[index] ?? DEFAULT_TRANSACTIONS[0]
    if (!entry || typeof entry !== "object") {
      return { ...fallback, id: createGeneratedId("transaction") }
    }

    const transaction = entry as Partial<
      Transaction & {
        amount?: string
        timestamp?: string
      }
    >

    const normalizedAmountCents = asFiniteNumber(transaction.amountCents)
    const hasAmountCents = normalizedAmountCents !== undefined
    const hasLegacyAmount = typeof transaction.amount === "string"
    const amountCents = hasAmountCents
      ? Math.round(normalizedAmountCents)
      : hasLegacyAmount
        ? parseCurrencyToCents(transaction.amount)
        : fallback.amountCents

    const timestampIso = parseDateToIso(
      transaction.timestampIso ?? transaction.timestamp,
      fallback.timestampIso
    )

    return {
      id: asString(transaction.id) ?? createGeneratedId("transaction"),
      title: asString(transaction.title) ?? fallback.title,
      amountCents,
      type: asLiteral(transaction.type, TRANSACTION_TYPES, fallback.type),
      category: asString(transaction.category) ?? fallback.category,
      timestampIso,
      status: asLiteral(transaction.status, TRANSACTION_STATUSES, fallback.status),
    }
  })
}

const normalizeGoals = (raw: unknown): FinancialGoal[] | null => {
  if (!Array.isArray(raw)) return null
  return raw.map((entry, index) => {
    const fallback = DEFAULT_GOALS[index] ?? DEFAULT_GOALS[0]
    if (!entry || typeof entry !== "object") {
      return { ...fallback, id: createGeneratedId("goal") }
    }

    const goal = entry as Partial<
      FinancialGoal & {
        date?: string
        amount?: string
      }
    >

    const normalizedTargetAmountCents = asFiniteNumber(goal.targetAmountCents)
    const hasTargetAmountCents = normalizedTargetAmountCents !== undefined
    const hasLegacyTargetAmount = typeof goal.amount === "string"
    const targetAmountCents = hasTargetAmountCents
      ? Math.round(normalizedTargetAmountCents)
      : hasLegacyTargetAmount
        ? parseCurrencyToCents(goal.amount)
        : fallback.targetAmountCents

    const targetDateIso = parseDateToIso(goal.targetDateIso ?? goal.date, fallback.targetDateIso)
    const progressCandidate = asFiniteNumber(goal.progress)
    const progress = progressCandidate === undefined ? fallback.progress : Math.max(0, Math.min(100, progressCandidate))

    return {
      id: asString(goal.id) ?? createGeneratedId("goal"),
      title: asString(goal.title) ?? fallback.title,
      subtitle: asString(goal.subtitle) ?? fallback.subtitle,
      iconStyle: asString(goal.iconStyle) ?? fallback.iconStyle,
      targetDateIso,
      targetAmountCents,
      status: asLiteral(goal.status, GOAL_STATUSES, fallback.status),
      progress,
    }
  })
}

const normalizeStockActions = (raw: unknown): StockAction[] | null => {
  if (!Array.isArray(raw)) return null
  return raw.map((entry, index) => {
    const fallback = DEFAULT_STOCK_ACTIONS[index] ?? DEFAULT_STOCK_ACTIONS[0]
    if (!entry || typeof entry !== "object") {
      return { ...fallback, id: createGeneratedId("stock-action") }
    }

    const action = entry as Partial<
      StockAction & {
        price?: string
        tradeDate?: string
      }
    >

    const normalizedPriceCents = asFiniteNumber(action.priceCents)
    const hasPriceCents = normalizedPriceCents !== undefined
    const hasLegacyPrice = typeof action.price === "string"
    const priceCents = hasPriceCents
      ? Math.round(normalizedPriceCents)
      : hasLegacyPrice
        ? parseCurrencyToCents(action.price)
        : fallback.priceCents

    const sharesValue = asFiniteNumber(action.shares) ?? fallback.shares
    const tradeDateIso = parseDateToIso(action.tradeDateIso ?? action.tradeDate, fallback.tradeDateIso)

    return {
      id: asString(action.id) ?? createGeneratedId("stock-action"),
      symbol: (asString(action.symbol) ?? fallback.symbol).toUpperCase(),
      action: asLiteral(action.action, STOCK_ACTION_TYPES, fallback.action),
      shares: sharesValue,
      priceCents,
      tradeDateIso,
      status: asLiteral(action.status, STOCK_ACTION_STATUSES, fallback.status),
    }
  })
}

const normalizeLastSaved = (value: unknown): string => {
  if (typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }
  return new Date().toISOString()
}

const isLegacyDemoStockActions = (actions: unknown): boolean => {
  if (!Array.isArray(actions) || actions.length !== 3) return false
  const symbols = actions
    .map((item) =>
      item && typeof item === "object" && "symbol" in item && typeof item.symbol === "string"
        ? item.symbol.toUpperCase()
        : ""
    )
    .sort()
    .join(",")
  return symbols === "AAPL,MSFT,TSLA"
}

export const isLegacyDemoAccounts = (accounts: AccountItem[]): boolean => {
  if (!Array.isArray(accounts)) return false
  const hasDemoAccounts = accounts.some(
    (a) =>
      a.title === "Main Savings" ||
      (a.title === "Checking Account" && a.balanceCents === 285_000) ||
      (a.title === "Investment Portfolio" && a.balanceCents === 1_523_080 && accounts.length === 5) ||
      (a.title === "Savings Account" && a.balanceCents === 300_000) ||
      (a.id === "1" && a.balanceCents === 845_945)
  )
  if (hasDemoAccounts) return true

  if (accounts.length === 5 && !accounts.some((a) => a.id.startsWith("disnat-"))) {
    const ids = accounts.map((a) => a.id).sort().join(",")
    if (ids === "1,2,3,4,5") return true
  }

  return false
}

export const syncAccountsWithStockActions = (
  accounts: AccountItem[],
  stockActions: StockAction[]
): AccountItem[] => {
  const baseAccounts = isLegacyDemoAccounts(accounts) ? DEFAULT_ACCOUNTS : accounts
  const stockValueCents = calculateStockActionsValueCents(stockActions)

  const targetIndex = baseAccounts.findIndex(
    (acc) => acc.id === "3" || acc.title === "Investment Portfolio"
  )

  if (targetIndex === -1) {
    return baseAccounts
  }

  const targetAccount = baseAccounts[targetIndex]
  if (targetAccount.balanceCents === stockValueCents && baseAccounts === accounts) {
    return accounts
  }

  const nextAccounts = [...baseAccounts]
  nextAccounts[targetIndex] = {
    ...targetAccount,
    balanceCents: stockValueCents,
  }
  return nextAccounts
}

const migrateToV2 = (input: {
  accounts: unknown
  transactions: unknown
  goals: unknown
  stockActions: unknown
  lastSaved: unknown
}): PortfolioStateV2 => {
  const stockActions = isLegacyDemoStockActions(input.stockActions)
    ? DEFAULT_STOCK_ACTIONS
    : normalizeStockActions(input.stockActions) ?? DEFAULT_STOCK_ACTIONS
  const rawAccounts = normalizeAccounts(input.accounts) ?? DEFAULT_ACCOUNTS
  const accountsToUse = isLegacyDemoAccounts(rawAccounts) ? DEFAULT_ACCOUNTS : rawAccounts
  const accounts = syncAccountsWithStockActions(accountsToUse, stockActions)

  return {
    version: 2,
    accounts,
    transactions: normalizeTransactions(input.transactions) ?? DEFAULT_TRANSACTIONS,
    goals: normalizeGoals(input.goals) ?? DEFAULT_GOALS,
    stockActions,
    lastSaved: normalizeLastSaved(input.lastSaved),
  }
}

const loadPortfolioState = (): PortfolioStateV2 | null => {
  const stored = loadJson<PortfolioStateV2>(STORAGE_KEYS.STATE)
  if (stored.exists && stored.value && isPortfolioStateV2(stored.value)) {
    if (isLegacyDemoStockActions(stored.value.stockActions)) {
      stored.value.stockActions = DEFAULT_STOCK_ACTIONS
    }
    if (isLegacyDemoAccounts(stored.value.accounts)) {
      stored.value.accounts = DEFAULT_ACCOUNTS
    }
    stored.value.accounts = syncAccountsWithStockActions(
      stored.value.accounts,
      stored.value.stockActions
    )
    return stored.value
  }

  const backup = loadJson<PortfolioStateV2>(STORAGE_KEYS.BACKUP)
  if (backup.exists && backup.value && isPortfolioStateV2(backup.value)) {
    if (isLegacyDemoStockActions(backup.value.stockActions)) {
      backup.value.stockActions = DEFAULT_STOCK_ACTIONS
    }
    if (isLegacyDemoAccounts(backup.value.accounts)) {
      backup.value.accounts = DEFAULT_ACCOUNTS
    }
    backup.value.accounts = syncAccountsWithStockActions(
      backup.value.accounts,
      backup.value.stockActions
    )
    return backup.value
  }

  const previousState = loadJson<PortfolioStateV1>(STORAGE_KEYS.PREVIOUS_STATE)
  if (previousState.exists && previousState.value && isPortfolioStateV1(previousState.value)) {
    return migrateToV2(previousState.value)
  }

  const previousBackup = loadJson<PortfolioStateV1>(STORAGE_KEYS.PREVIOUS_BACKUP)
  if (previousBackup.exists && previousBackup.value && isPortfolioStateV1(previousBackup.value)) {
    return migrateToV2(previousBackup.value)
  }

  const legacyAccounts = loadJson<unknown>(STORAGE_KEYS.LEGACY_ACCOUNTS)
  const legacyTransactions = loadJson<unknown>(STORAGE_KEYS.LEGACY_TRANSACTIONS)
  const legacyGoals = loadJson<unknown>(STORAGE_KEYS.LEGACY_GOALS)
  const legacyStockActions = loadJson<unknown>(STORAGE_KEYS.LEGACY_STOCK_ACTIONS)
  const legacyLastSaved = loadJson<string>(STORAGE_KEYS.LAST_SAVED)

  if (
    legacyAccounts.exists ||
    legacyTransactions.exists ||
    legacyGoals.exists ||
    legacyStockActions.exists
  ) {
    return migrateToV2({
      accounts: legacyAccounts.value,
      transactions: legacyTransactions.value,
      goals: legacyGoals.value,
      stockActions: legacyStockActions.value,
      lastSaved: legacyLastSaved.value,
    })
  }

  return null
}

interface PortfolioContextType {
  accounts: AccountItem[]
  addAccount: (account: Omit<AccountItem, "id">) => void
  updateAccount: (id: string, account: Partial<AccountItem>) => void
  deleteAccount: (id: string) => void
  adjustAccountBalance: (id: string, amount: number, type: "deposit" | "withdraw") => void
  transferBetweenAccounts: (fromId: string, toId: string, amount: number) => void

  transactions: Transaction[]
  addTransaction: (transaction: Omit<Transaction, "id">) => void
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void

  goals: FinancialGoal[]
  addGoal: (goal: Omit<FinancialGoal, "id">) => void
  updateGoal: (id: string, goal: Partial<FinancialGoal>) => void
  deleteGoal: (id: string) => void

  stockActions: StockAction[]
  addStockAction: (action: Omit<StockAction, "id">) => void
  updateStockAction: (id: string, action: Partial<StockAction>) => void
  deleteStockAction: (id: string) => void

  allocationActual: AllocationActual[]
  allocationTargets: AllocationTarget[]
  diversificationBreakdown: DiversificationBreakdown
  performanceMetrics: PerformanceMetric[]
  riskMetrics: RiskMetric[]
  netWorthHistory: NetWorthHistoryPoint[]
  assetBreakdown: NetWorthBreakdownItem[]
  liabilityBreakdown: NetWorthBreakdownItem[]
  budgets: BudgetCategory[]
  cashflowForecast: CashflowForecastPoint[]
  alerts: PortfolioAlert[]
  alertsThresholds: AlertThreshold[]
  planningScenarios: PlanningScenario[]

  totalBalance: string
  lastSaved: string | null
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined)

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<AccountItem[]>(() =>
    syncAccountsWithStockActions(DEFAULT_ACCOUNTS, DEFAULT_STOCK_ACTIONS)
  )
  const [transactions, setTransactions] = useState<Transaction[]>(DEFAULT_TRANSACTIONS)
  const [goals, setGoals] = useState<FinancialGoal[]>(DEFAULT_GOALS)
  const [stockActions, setStockActions] = useState<StockAction[]>(DEFAULT_STOCK_ACTIONS)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [syncAuto, setSyncAuto] = useState(true)
  const [syncKey, setSyncKey] = useState("")
  const [syncBootstrappedKey, setSyncBootstrappedKey] = useState<string | null>(null)

  useEffect(() => {
    const stored = loadPortfolioState()
    if (stored) {
      const validAccounts = isLegacyDemoAccounts(stored.accounts ?? [])
        ? DEFAULT_ACCOUNTS
        : stored.accounts ?? DEFAULT_ACCOUNTS
      setAccounts(
        syncAccountsWithStockActions(
          validAccounts,
          stored.stockActions ?? DEFAULT_STOCK_ACTIONS
        )
      )
      setTransactions(stored.transactions ?? DEFAULT_TRANSACTIONS)
      setGoals(stored.goals ?? DEFAULT_GOALS)
      setStockActions(stored.stockActions ?? DEFAULT_STOCK_ACTIONS)
      setLastSaved(stored.lastSaved ?? new Date().toISOString())
      setIsHydrated(true)
      return
    }
    setAccounts(syncAccountsWithStockActions(DEFAULT_ACCOUNTS, DEFAULT_STOCK_ACTIONS))
    setLastSaved(canUseStorage() ? window.localStorage.getItem(STORAGE_KEYS.LAST_SAVED) : null)
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    setAccounts((prevAccounts) => syncAccountsWithStockActions(prevAccounts, stockActions))
  }, [isHydrated, stockActions])

  useEffect(() => {
    if (!isHydrated) return
    const savedAt = new Date().toISOString()
    const state: PortfolioStateV2 = {
      version: 2,
      accounts,
      transactions,
      goals,
      stockActions,
      lastSaved: savedAt,
    }
    savePortfolioState(state)
    setLastSaved(savedAt)
  }, [accounts, transactions, goals, stockActions, isHydrated])

  useEffect(() => {
    const readSyncSettings = () => {
      const settings = loadSettingsSnapshot()
      setSyncEnabled(Boolean(settings.sync.enabled))
      setSyncAuto(Boolean(settings.sync.autoSync))
      setSyncKey(settings.sync.key.trim())
    }

    readSyncSettings()
    const intervalId = window.setInterval(readSyncSettings, 2_500)
    const onStorage = () => {
      readSyncSettings()
    }

    window.addEventListener("storage", onStorage)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  useEffect(() => {
    if (!isHydrated || !syncEnabled || syncKey.length < 16 || syncBootstrappedKey === syncKey) {
      return
    }

    let isCancelled = false
    const syncInitialState = async () => {
      const localState: PortfolioStateV2 = {
        version: 2,
        accounts,
        transactions,
        goals,
        stockActions,
        lastSaved: lastSaved ?? new Date().toISOString(),
      }

      try {
        const remoteState = await fetchRemotePortfolioState(syncKey)
        if (isCancelled) return

        if (!remoteState) {
          await pushRemotePortfolioState(syncKey, localState)
          if (!isCancelled) {
            setSyncBootstrappedKey(syncKey)
          }
          return
        }

        const remoteSavedAt = new Date(remoteState.lastSaved).getTime()
        const localSavedAt = new Date(localState.lastSaved).getTime()

        if (Number.isFinite(remoteSavedAt) && remoteSavedAt > localSavedAt) {
          setAccounts(syncAccountsWithStockActions(remoteState.accounts, remoteState.stockActions))
          setTransactions(remoteState.transactions)
          setGoals(remoteState.goals)
          setStockActions(remoteState.stockActions)
          setLastSaved(remoteState.lastSaved)
        } else {
          await pushRemotePortfolioState(syncKey, localState)
        }

        if (!isCancelled) {
          setSyncBootstrappedKey(syncKey)
        }
      } catch (error) {
        console.warn("Unable to initialize portfolio synchronization:", error)
      }
    }

    void syncInitialState()
    return () => {
      isCancelled = true
    }
  }, [
    isHydrated,
    syncEnabled,
    syncKey,
    syncBootstrappedKey,
    accounts,
    transactions,
    goals,
    stockActions,
    lastSaved,
  ])

  useEffect(() => {
    if (
      !isHydrated ||
      !syncEnabled ||
      !syncAuto ||
      syncKey.length < 16 ||
      syncBootstrappedKey !== syncKey
    ) {
      return
    }

    const state: PortfolioStateV2 = {
      version: 2,
      accounts,
      transactions,
      goals,
      stockActions,
      lastSaved: lastSaved ?? new Date().toISOString(),
    }

    void pushRemotePortfolioState(syncKey, state).catch((error) => {
      console.warn("Unable to sync portfolio state:", error)
    })
  }, [
    isHydrated,
    syncEnabled,
    syncAuto,
    syncKey,
    syncBootstrappedKey,
    accounts,
    transactions,
    goals,
    stockActions,
    lastSaved,
  ])

  const addAccount = useCallback((account: Omit<AccountItem, "id">) => {
    const newAccount: AccountItem = {
      ...account,
      id: createGeneratedId("account"),
    }
    setAccounts((prev) => [...prev, newAccount])
  }, [])

  const updateAccount = useCallback((id: string, updates: Partial<AccountItem>) => {
    setAccounts((prev) =>
      prev.map((account) => (account.id === id ? { ...account, ...updates } : account))
    )
  }, [])

  const deleteAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((account) => account.id !== id))
  }, [])

  const adjustAccountBalance = useCallback(
    (id: string, amount: number, type: "deposit" | "withdraw") => {
      const deltaCents = dollarsToCents(amount)
      setAccounts((prev) =>
        prev.map((account) => {
          if (account.id !== id) return account
          const next = type === "deposit" ? account.balanceCents + deltaCents : account.balanceCents - deltaCents
          return { ...account, balanceCents: next }
        })
      )
    },
    []
  )

  const transferBetweenAccounts = useCallback((fromId: string, toId: string, amount: number) => {
    const deltaCents = dollarsToCents(amount)
    setAccounts((prev) =>
      prev.map((account) => {
        if (account.id !== fromId && account.id !== toId) return account
        const next = account.id === fromId ? account.balanceCents - deltaCents : account.balanceCents + deltaCents
        return { ...account, balanceCents: next }
      })
    )
  }, [])

  const addTransaction = useCallback((transaction: Omit<Transaction, "id">) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: createGeneratedId("transaction"),
    }
    setTransactions((prev) => [newTransaction, ...prev])
  }, [])

  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((transaction) =>
        transaction.id === id ? { ...transaction, ...updates } : transaction
      )
    )
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((transaction) => transaction.id !== id))
  }, [])

  const addGoal = useCallback((goal: Omit<FinancialGoal, "id">) => {
    const newGoal: FinancialGoal = {
      ...goal,
      id: createGeneratedId("goal"),
    }
    setGoals((prev) => [...prev, newGoal])
  }, [])

  const updateGoal = useCallback((id: string, updates: Partial<FinancialGoal>) => {
    setGoals((prev) =>
      prev.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal))
    )
  }, [])

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((goal) => goal.id !== id))
  }, [])

  const addStockAction = useCallback((action: Omit<StockAction, "id">) => {
    const newAction: StockAction = {
      ...action,
      id: createGeneratedId("stock-action"),
    }
    setStockActions((prev) => [newAction, ...prev])
  }, [])

  const updateStockAction = useCallback((id: string, updates: Partial<StockAction>) => {
    setStockActions((prev) =>
      prev.map((action) => (action.id === id ? { ...action, ...updates } : action))
    )
  }, [])

  const deleteStockAction = useCallback((id: string) => {
    setStockActions((prev) => prev.filter((action) => action.id !== id))
  }, [])

  const totalBalance = useMemo(() => {
    const totalCents = accounts.reduce((sum, account) => {
      if (account.type === "debt") {
        return sum - account.balanceCents
      }
      return sum + account.balanceCents
    }, 0)
    return formatCurrencyFromCents(totalCents)
  }, [accounts])

  const value = useMemo(
    () => ({
      accounts,
      addAccount,
      updateAccount,
      deleteAccount,
      adjustAccountBalance,
      transferBetweenAccounts,
      transactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      goals,
      addGoal,
      updateGoal,
      deleteGoal,
      stockActions,
      addStockAction,
      updateStockAction,
      deleteStockAction,
      allocationActual: DEFAULT_ALLOCATION_ACTUAL,
      allocationTargets: DEFAULT_ALLOCATION_TARGETS,
      diversificationBreakdown: DEFAULT_DIVERSIFICATION_BREAKDOWN,
      performanceMetrics: DEFAULT_PERFORMANCE_METRICS,
      riskMetrics: DEFAULT_RISK_METRICS,
      netWorthHistory: DEFAULT_NET_WORTH_HISTORY,
      assetBreakdown: DEFAULT_ASSET_BREAKDOWN,
      liabilityBreakdown: DEFAULT_LIABILITY_BREAKDOWN,
      budgets: DEFAULT_BUDGETS,
      cashflowForecast: DEFAULT_CASHFLOW_FORECAST,
      alerts: DEFAULT_ALERTS,
      alertsThresholds: DEFAULT_ALERTS_THRESHOLDS,
      planningScenarios: DEFAULT_PLANNING_SCENARIOS,
      totalBalance,
      lastSaved,
    }),
    [
      accounts,
      addAccount,
      updateAccount,
      deleteAccount,
      adjustAccountBalance,
      transferBetweenAccounts,
      transactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      goals,
      addGoal,
      updateGoal,
      deleteGoal,
      stockActions,
      addStockAction,
      updateStockAction,
      deleteStockAction,
      totalBalance,
      lastSaved,
    ]
  )

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio() {
  const context = useContext(PortfolioContext)
  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider")
  }
  return context
}
