"use client"

import { cn } from "@/lib/utils"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePortfolio } from "@/lib/portfolio-context"
import { loadSettingsSnapshot } from "@/lib/settings-store"
import { getTradingOverview } from "@/lib/trading-client"
import {
  loadStockIntelligenceContext,
  type StockIntelligenceContext,
} from "@/lib/stock-analysis-client"
import {
  buildAiFinanceIntelligenceContext,
  type AiPriorityItem,
} from "@/lib/ai-finance-intelligence"
import {
  defaultGrowthToolkitData,
  loadGrowthToolkitSnapshot,
  type GrowthToolkitData,
} from "@/lib/portfolio-growth-store"
import type { PaperTradingOverview } from "@/lib/trading-types"

interface PortfolioHighlightsProps {
  className?: string
}

type PrioritySeverity = AiPriorityItem["severity"]
type AlertSeverity = StockIntelligenceContext["alerts"]["recentTriggered"][number]["severity"]

const prioritySeverityStyle: Record<PrioritySeverity, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  medium: "border-border/60 bg-accent/50 text-foreground",
  low: "border-border/60 bg-accent/50 text-muted-foreground",
}

const priorityCardStyle: Record<PrioritySeverity, string> = {
  critical: "border-rose-200 bg-rose-50/60",
  high: "border-amber-200 bg-amber-50/60",
  medium: "border-border/60 bg-background/60",
  low: "border-border/60 bg-background/60",
}

const alertSeverityIcon: Record<AlertSeverity, ReactNode> = {
  info: <CheckCircle className="h-4 w-4 shrink-0 text-blue-600" />,
  warning: <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />,
  critical: <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />,
}

const formatUsd = (value: number) =>
  `$${Number(value.toFixed(2)).toLocaleString("en-US")}`

export default function PortfolioHighlights({ className }: PortfolioHighlightsProps) {
  const [uiLocale, setUiLocale] = useState<"fr" | "en">("fr")
  const [growthToolkit, setGrowthToolkit] = useState<GrowthToolkitData>(defaultGrowthToolkitData)
  const [tradingOverview, setTradingOverview] = useState<PaperTradingOverview | null>(null)
  const [stockIntelligence, setStockIntelligence] = useState<StockIntelligenceContext>(() =>
    loadStockIntelligenceContext("fr")
  )
  const { accounts, transactions, goals, stockActions } = usePortfolio()

  const intelligence = useMemo(
    () =>
      buildAiFinanceIntelligenceContext({
        accounts,
        transactions,
        goals,
        stockActions,
        growthToolkit,
        tradingOverview,
        stockIntelligence,
      }),
    [accounts, goals, growthToolkit, stockActions, stockIntelligence, tradingOverview, transactions]
  )

  useEffect(() => {
    const syncLocale = () => {
      const snapshot = loadSettingsSnapshot()
      setUiLocale(snapshot.language === "en" ? "en" : "fr")
    }

    syncLocale()
    const intervalId = window.setInterval(syncLocale, 2_500)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const syncToolkit = () => {
      setGrowthToolkit(loadGrowthToolkitSnapshot())
    }

    syncToolkit()
    const intervalId = window.setInterval(syncToolkit, 2_500)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let active = true
    const syncTrading = async () => {
      try {
        const overview = await getTradingOverview()
        if (active) {
          setTradingOverview(overview)
        }
      } catch {
        if (active) {
          setTradingOverview(null)
        }
      }
    }

    void syncTrading()
    const intervalId = window.setInterval(() => {
      void syncTrading()
    }, 10_000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const syncStockIntelligence = () => {
      setStockIntelligence(loadStockIntelligenceContext(uiLocale))
    }

    syncStockIntelligence()
    const intervalId = window.setInterval(syncStockIntelligence, 5_000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [uiLocale, stockActions])

  const copy =
    uiLocale === "en"
      ? {
          health: "Financial health",
          risk: "Risk control",
          execution: "Execution",
          netWorth: "Net worth",
          goals: "Goals (avg.)",
          activeAlerts: "Active alerts",
          monthlyNet: "Monthly net flow",
          prioritiesTitle: "Priorities",
          alertsTitle: "Recent stock alerts",
          opportunitiesTitle: "Opportunities",
          nextStep: "Next step",
          noPriorities: "No priorities detected right now.",
          noAlerts: "No alerts triggered recently.",
          severity: {
            critical: "Critical",
            high: "High",
            medium: "Medium",
            low: "Low",
          } as Record<PrioritySeverity, string>,
          alertSeverity: {
            info: "Info",
            warning: "Warning",
            critical: "Critical",
          } as Record<AlertSeverity, string>,
        }
      : {
          health: "Santé financière",
          risk: "Contrôle du risque",
          execution: "Exécution",
          netWorth: "Valeur nette",
          goals: "Objectifs (moy.)",
          activeAlerts: "Alertes actives",
          monthlyNet: "Flux mensuel net",
          prioritiesTitle: "Priorités",
          alertsTitle: "Alertes d'actions récentes",
          opportunitiesTitle: "Opportunités",
          nextStep: "Prochaine étape",
          noPriorities: "Aucune priorité détectée pour le moment.",
          noAlerts: "Aucune alerte déclenchée récemment.",
          severity: {
            critical: "Critique",
            high: "Élevée",
            medium: "Moyenne",
            low: "Faible",
          } as Record<PrioritySeverity, string>,
          alertSeverity: {
            info: "Info",
            warning: "Avertissement",
            critical: "Critique",
          } as Record<AlertSeverity, string>,
        }

  const { metrics, scores, priorities, opportunities } = intelligence
  const recentAlerts = stockIntelligence.alerts.recentTriggered.slice(0, 5)
  const dateLocale = uiLocale === "en" ? "en-US" : "fr-FR"

  const facts = [
    { label: copy.netWorth, value: formatUsd(metrics.netWorthUsd) },
    { label: copy.goals, value: `${metrics.goalsCompletionPct.toFixed(0)}%` },
    { label: copy.activeAlerts, value: String(metrics.stockAlertsActive) },
    { label: copy.monthlyNet, value: formatUsd(metrics.monthlyNetUsd) },
  ]

  const scoreCards = [
    { label: copy.health, value: scores.financialHealth },
    { label: copy.risk, value: scores.riskControl },
    { label: copy.execution, value: scores.executionConsistency },
  ]

  return (
    <div className={cn("w-full", "fx-panel", "flex flex-col", className)}>
      <div className="space-y-4 p-4">
        {/* Scores */}
        <div className="grid grid-cols-3 gap-2">
          {scoreCards.map((score) => (
            <div
              key={score.label}
              className="rounded-md border border-border/60 bg-background/60 p-2"
            >
              <p className="text-xs text-muted-foreground">{score.label}</p>
              <p className="text-sm font-semibold text-foreground">
                {score.value.toFixed(0)}/100
              </p>
            </div>
          ))}
        </div>

        {/* Faits saillants */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-md border border-border/60 bg-background/60 p-2"
            >
              <p className="text-xs text-muted-foreground">{fact.label}</p>
              <p className="text-sm font-semibold text-foreground">{fact.value}</p>
            </div>
          ))}
        </div>

        {/* Priorités */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-tight text-foreground">
            {copy.prioritiesTitle}
          </h3>
          {priorities.length === 0 ? (
            <p className="text-xs text-muted-foreground">{copy.noPriorities}</p>
          ) : (
            <div className="space-y-2">
              {priorities.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border p-3",
                    priorityCardStyle[item.severity]
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                        prioritySeverityStyle[item.severity]
                      )}
                    >
                      {copy.severity[item.severity]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.metricLabel} : {item.metricValue}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                  <p className="mt-1 text-xs text-foreground">
                    <span className="font-medium">{copy.nextStep} : </span>
                    {item.nextAction}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertes d'actions récentes */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-tight text-foreground">
            {copy.alertsTitle}
          </h3>
          {recentAlerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">{copy.noAlerts}</p>
          ) : (
            <ul className="space-y-2">
              {recentAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3"
                >
                  {alertSeverityIcon[alert.severity]}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{alert.symbol}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        ({copy.alertSeverity[alert.severity]})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    {alert.triggeredAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(alert.triggeredAt).toLocaleString(dateLocale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Opportunités */}
        {opportunities.length > 0 ? (
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              {copy.opportunitiesTitle}
            </h3>
            <ul className="space-y-1">
              {opportunities.map((opportunity) => (
                <li
                  key={opportunity}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{opportunity}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
