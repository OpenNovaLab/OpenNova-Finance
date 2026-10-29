"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BarChart3,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePortfolio } from "@/lib/portfolio-context"
import {
  addAnalysisEntry,
  buildStockAnalysisContextSnapshot,
  closePosition,
  getRegistrySnapshot,
  type StockAnalysisContextSnapshot,
  type StockAnalysisEntry,
} from "@/lib/stock-analysis-registry"
import {
  analyzePortfolioStockActions,
  analyzeStock,
  analyzeStockAction,
  type StockAnalysisRequest,
  type StockAnalysisResponse,
} from "@/lib/stock-analysis-client"
import {
  runAlertEngine,
  sendNotification,
  upsertAutomaticAlertsFromRecommendations,
  type ProactiveSignal,
} from "@/lib/stock-alerts"
import { WidgetEmptyState } from "./widget-state"

interface StockAnalysisPanelProps {
  className?: string
}

interface AnalysisFormState {
  symbol: string
  currentPrice: string
  pe: string
  roe: string
  growthRate: string
  action: "buy" | "sell" | ""
  shares: string
  notes: string
}

const defaultFormState: AnalysisFormState = {
  symbol: "",
  currentPrice: "",
  pe: "",
  roe: "",
  growthRate: "",
  action: "",
  shares: "",
  notes: "",
}

const formatUsd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const severityStyle: Record<ProactiveSignal["severity"], string> = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
}

const getUncertaintyNotice = (uncertaintyMessages: string[] | undefined): string | null => {
  if (!Array.isArray(uncertaintyMessages) || uncertaintyMessages.length === 0) return null
  const first = uncertaintyMessages[0]?.trim()
  return first ? `Mode degrade: ${first}` : null
}

export function StockAnalysisPanel({ className }: StockAnalysisPanelProps) {
  const { stockActions } = usePortfolio()
  const [context, setContext] = useState<StockAnalysisContextSnapshot>(buildStockAnalysisContextSnapshot())
  const [proactiveSignals, setProactiveSignals] = useState<ProactiveSignal[]>([])
  const [lastSummary, setLastSummary] = useState<string>("")
  const [formState, setFormState] = useState<AnalysisFormState>(defaultFormState)
  const [closingPrices, setClosingPrices] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAutoRunning, setIsAutoRunning] = useState(false)

  const refreshContext = useCallback(() => {
    setContext(buildStockAnalysisContextSnapshot())
  }, [])

  useEffect(() => {
    refreshContext()
    const intervalId = window.setInterval(refreshContext, 5_000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshContext])

  const persistAnalysisResult = useCallback(
    (result: StockAnalysisResponse, fallbackAction?: { symbol: string; action: "buy" | "sell"; shares: number; notes?: string }) => {
      if (!result.success || !result.data) return

      const responseAction = fallbackAction
      const uncertaintyNotice = getUncertaintyNotice(result.data.uncertaintyMessages)
      const summaryWithNotice = uncertaintyNotice
        ? `${result.data.summary}\n\n⚠️ ${uncertaintyNotice}`
        : result.data.summary

      if (!responseAction) {
        setLastSummary(summaryWithNotice)
        return
      }

      const action = {
        id: `analysis-source-${responseAction.symbol}-${Date.now()}`,
        symbol: responseAction.symbol,
        action: responseAction.action,
        shares: responseAction.shares,
        priceCents: Math.round(result.data.report.prices.current * 100),
        tradeDateIso: new Date().toISOString(),
        status: "executed" as const,
      }
      addAnalysisEntry(action, result.data.report, result.data.recommendation, responseAction.notes)
      setLastSummary(summaryWithNotice)
    },
    []
  )

  const runAutonomousScan = useCallback(async () => {
    setIsAutoRunning(true)
    setStatus("Scan autonome en cours...")
    try {
      const executedActions = stockActions.filter((action) => action.status === "executed")
      const existing = getRegistrySnapshot().entries

      for (const action of executedActions) {
        const alreadyTracked = existing.some((entry) => entry.action.id === action.id)
        if (alreadyTracked) continue
        const result = await analyzeStockAction(action, `Auto-scan linked to trade ${action.id}`)
        if (result.success && result.data) {
          addAnalysisEntry(action, result.data.report, result.data.recommendation, `Auto-linked trade ${action.id}`)
        }
      }

      const refreshed = await analyzePortfolioStockActions(executedActions)
      const recommendations = refreshed
        .filter((result): result is StockAnalysisResponse & { data: NonNullable<StockAnalysisResponse["data"]> } => Boolean(result.success && result.data))
        .map((result) => result.data.recommendation)

      if (recommendations.length > 0) {
        upsertAutomaticAlertsFromRecommendations(recommendations)
      }

      const marketSnapshots = refreshed
        .filter((result): result is StockAnalysisResponse & { data: NonNullable<StockAnalysisResponse["data"]> } => Boolean(result.success && result.data))
        .map((result) => ({
          symbol: result.data.report.symbol,
          currentPrice: result.data.report.prices.current,
          previousClose: result.data.report.prices.current * 0.985,
          rsi: result.data.report.technical.rsi14,
          volume: result.data.report.prices.avgVolume,
        }))

      const engineOutput = runAlertEngine(marketSnapshots, "fr")
      for (const triggered of engineOutput.triggered) {
        await sendNotification(triggered, triggered.currentValue, "push")
      }

      const proactiveFromAnalysis = refreshed
        .flatMap((result) => result.data?.proactiveSignals ?? [])
        .slice(0, 12)

      const firstUncertaintyNotice = refreshed
        .map((result) => getUncertaintyNotice(result.data?.uncertaintyMessages))
        .find((notice): notice is string => Boolean(notice))

      const merged = [...proactiveFromAnalysis, ...engineOutput.proactive]
      const deduped = Array.from(new Map(merged.map((signal) => [`${signal.symbol}-${signal.headline}`, signal])).values())
      setProactiveSignals(deduped.slice(0, 12))
      refreshContext()
      setStatus(
        firstUncertaintyNotice
          ? `Scan termine (${executedActions.length} trade(s) executes inspectes). ${firstUncertaintyNotice}`
          : `Scan termine (${executedActions.length} trade(s) executes inspectes).`
      )
    } catch (error) {
      console.error("Autonomous scan failed:", error)
      setStatus("Echec du scan autonome.")
    } finally {
      setIsAutoRunning(false)
    }
  }, [refreshContext, stockActions])

  useEffect(() => {
    void runAutonomousScan()
    const intervalId = window.setInterval(() => {
      void runAutonomousScan()
    }, 45_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [runAutonomousScan])

  const handleSubmitManualAnalysis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const symbol = formState.symbol.trim().toUpperCase()
    if (!symbol) {
      setStatus("Le symbole est obligatoire.")
      return
    }

    const payload: StockAnalysisRequest = {
      symbol,
      currentPrice: toNumber(formState.currentPrice),
      pe: toNumber(formState.pe),
      roe: toNumber(formState.roe),
      growthRate: toNumber(formState.growthRate),
      action: formState.action || undefined,
      shares: toNumber(formState.shares),
      notes: formState.notes.trim() || undefined,
    }

    if (payload.action && (!payload.shares || payload.shares <= 0)) {
      setStatus("Le nombre de titres est requis pour une entree/sortie.")
      return
    }

    setIsSubmitting(true)
    setStatus("Analyse manuelle en cours...")
    try {
      const result = await analyzeStock(payload)
      if (!result.success || !result.data) {
        setStatus(result.error ?? "Analyse impossible.")
        return
      }
      const resultData = result.data

      persistAnalysisResult(
        result,
        payload.action && payload.shares
          ? { symbol, action: payload.action, shares: payload.shares, notes: payload.notes }
          : undefined
      )
      setProactiveSignals((current) => [...resultData.proactiveSignals, ...current].slice(0, 12))
      setFormState(defaultFormState)
      refreshContext()
      const uncertaintyNotice = getUncertaintyNotice(resultData.uncertaintyMessages)
      setStatus(uncertaintyNotice ? `Analyse enregistree. ${uncertaintyNotice}` : "Analyse enregistree.")
    } catch (error) {
      console.error(error)
      setStatus("Echec pendant l'analyse manuelle.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeOpenPosition = (entry: StockAnalysisEntry) => {
    const raw = closingPrices[entry.id]
    const exit = toNumber(raw)
    if (!exit || exit <= 0) {
      setStatus("Renseigner un prix de cloture valide.")
      return
    }

    const updated = closePosition(entry.id, exit, new Date().toISOString(), "Closed from stock analysis panel")
    if (!updated) {
      setStatus("Position introuvable.")
      return
    }

    setClosingPrices((current) => ({ ...current, [entry.id]: "" }))
    refreshContext()
    setStatus(`Position ${entry.action.symbol} cloturee.`)
  }

  const registrySnapshot = getRegistrySnapshot()
  const activeEntries = registrySnapshot.entries.filter((entry) => entry.status === "active")
  const closedEntries = registrySnapshot.entries.filter((entry) => entry.status === "closed").slice(0, 10)

  return (
    <div className={cn("space-y-4", className)}>
      <div className="fx-panel p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Autonomous Stock Intelligence</p>
            <h3 className="text-base font-semibold text-foreground">Analyse technique + fondamentale continue</h3>
            <p className="text-xs text-muted-foreground">
              RSI, MACD, registre des trades, alertes conditionnelles et recommandations proactives.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runAutonomousScan()}
            disabled={isAutoRunning}
            className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isAutoRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Scanner maintenant
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-xs">
          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <p className="text-muted-foreground">Capital investi</p>
            <p className="font-semibold text-foreground">{formatUsd(context.stats.totalInvested)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <p className="text-muted-foreground">PnL realise</p>
            <p className={cn("font-semibold", context.stats.totalRealizedGainLoss >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatUsd(context.stats.totalRealizedGainLoss)} ({context.stats.totalRealizedReturnPct.toFixed(2)}%)
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <p className="text-muted-foreground">Win rate</p>
            <p className="font-semibold text-foreground">{context.stats.winRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <p className="text-muted-foreground">Positions actives</p>
            <p className="font-semibold text-foreground">{context.stats.activePositions}</p>
          </div>
        </div>

        <form onSubmit={handleSubmitManualAnalysis} className="grid gap-2 rounded-lg border border-border/60 bg-background/60 p-3 md:grid-cols-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            Symbole
            <input
              type="text"
              value={formState.symbol}
              onChange={(event) => setFormState((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="AAPL"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Prix actuel
            <input
              type="number"
              min="0"
              step="0.01"
              value={formState.currentPrice}
              onChange={(event) => setFormState((current) => ({ ...current, currentPrice: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="190.50"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            P/E
            <input
              type="number"
              min="0"
              step="0.1"
              value={formState.pe}
              onChange={(event) => setFormState((current) => ({ ...current, pe: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="22"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            ROE %
            <input
              type="number"
              step="0.1"
              value={formState.roe}
              onChange={(event) => setFormState((current) => ({ ...current, roe: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="18"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Croissance %
            <input
              type="number"
              step="0.1"
              value={formState.growthRate}
              onChange={(event) => setFormState((current) => ({ ...current, growthRate: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="12"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Sens
            <select
              value={formState.action}
              onChange={(event) => setFormState((current) => ({ ...current, action: event.target.value as AnalysisFormState["action"] }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Analyse seule</option>
              <option value="buy">Entree (BUY)</option>
              <option value="sell">Sortie (SELL)</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Quantite
            <input
              type="number"
              min="0"
              step="0.01"
              value={formState.shares}
              onChange={(event) => setFormState((current) => ({ ...current, shares: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="10"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground md:col-span-2">
            Notes
            <input
              type="text"
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Setup momentum, horizon 3-6 mois"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 self-end rounded-md border border-border/60 bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Analyse..." : "Analyser"}
          </button>
        </form>

        {status && <p className="text-xs text-muted-foreground">{status}</p>}
        {lastSummary && <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">{lastSummary}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="fx-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Positions actives</h4>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          {activeEntries.length === 0 ? (
            <WidgetEmptyState>Aucune position active.</WidgetEmptyState>
          ) : (
            <div className="space-y-2">
              {activeEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border/60 bg-background/60 p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {entry.action.symbol} {entry.action.action.toUpperCase()} {entry.action.shares}
                      </p>
                      <p className="text-muted-foreground">
                        Entree {formatUsd(entry.action.priceCents / 100)} | Signal {entry.recommendation.signal.toUpperCase()} ({entry.recommendation.confidence.toFixed(0)}%)
                      </p>
                      <p className="text-muted-foreground">
                        Cible {formatUsd(entry.recommendation.priceTarget)} | Stop {entry.recommendation.stopLoss ? formatUsd(entry.recommendation.stopLoss) : "n/a"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={closingPrices[entry.id] ?? ""}
                        onChange={(event) => setClosingPrices((current) => ({ ...current, [entry.id]: event.target.value }))}
                        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
                        placeholder="Sortie"
                      />
                      <button
                        type="button"
                        onClick={() => closeOpenPosition(entry)}
                        className="h-8 rounded-md border border-border/60 bg-accent px-2 text-xs text-foreground hover:bg-accent/80"
                      >
                        Cloturer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Positions fermees recentes</p>
            {closedEntries.length === 0 ? (
              <WidgetEmptyState>Aucune position fermée.</WidgetEmptyState>
            ) : (
              closedEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border/60 bg-background/60 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{entry.action.symbol}</p>
                    <p className={cn((entry.realizedGainLoss ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {(entry.realizedGainLoss ?? 0) >= 0 ? <TrendingUp className="inline-block h-3 w-3" /> : <TrendingDown className="inline-block h-3 w-3" />}{" "}
                      {formatUsd(entry.realizedGainLoss ?? 0)}
                    </p>
                  </div>
                  <p className="text-muted-foreground">
                    {entry.realizedGainLossPercent?.toFixed(2)}% | sortie {entry.exitPrice ? formatUsd(entry.exitPrice) : "n/a"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="fx-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Recommandations proactives</h4>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          {proactiveSignals.length === 0 ? (
            <WidgetEmptyState>Aucun signal proactif pour le moment.</WidgetEmptyState>
          ) : (
            <div className="space-y-2">
              {proactiveSignals.map((signal, index) => (
                <div
                  key={`${signal.symbol}-${signal.headline}-${index}`}
                  className={cn("rounded-lg border p-2 text-xs", severityStyle[signal.severity])}
                >
                  <p className="font-semibold">
                    {signal.symbol} · {signal.headline}
                  </p>
                  <p>{signal.recommendation}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs">
            <p className="mb-2 flex items-center gap-2 font-semibold text-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-primary" />
              Couverture fonctionnelle
            </p>
            <p className="text-muted-foreground">
              Analyse autonome RSI/MACD/fondamentaux, registre complet des trades, alertes conditionnelles, recommandations proactives,
              gestion entree/sortie/cloture et contexte complet envoye a l&apos;agent IA.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
