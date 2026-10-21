import type { AccountItem, FinancialGoal, StockAction, Transaction } from "@/lib/portfolio-data"
import type { GrowthToolkitData } from "@/lib/portfolio-growth-store"
import type { StockIntelligenceContext } from "@/lib/stock-analysis-client"
import type { PaperTradingOverview } from "@/lib/trading-types"

type PrioritySeverity = "critical" | "high" | "medium" | "low"

export interface AiPriorityItem {
  id: string
  title: string
  reason: string
  severity: PrioritySeverity
  metricLabel: string
  metricValue: string
  nextAction: string
}

export interface AiFinanceIntelligenceContext {
  version: 1
  generatedAt: string
  scores: {
    financialHealth: number
    riskControl: number
    executionConsistency: number
  }
  metrics: {
    netWorthUsd: number
    cashUsd: number
    debtUsd: number
    monthlyIncomeUsd: number
    monthlyExpenseUsd: number
    monthlyNetUsd: number
    savingsRatePct: number
    debtToCashRatio: number
    emergencyFundMonths: number
    portfolioConcentrationPct: number
    activeTradingPositions: number
    realizedTradingPnlUsd: number
    stockAlertsActive: number
    stockAlertsCritical: number
    goalsCompletionPct: number
  }
  priorities: AiPriorityItem[]
  opportunities: string[]
  constraints: string[]
}

interface Inputs {
  locale?: AiFinanceLocale
  accounts: AccountItem[]
  transactions: Transaction[]
  goals: FinancialGoal[]
  stockActions: StockAction[]
  growthToolkit?: GrowthToolkitData | null
  tradingOverview?: PaperTradingOverview | null
  stockIntelligence?: StockIntelligenceContext | null
}

const centsToUsd = (valueCents: number) => valueCents / 100
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round2 = (value: number) => Number(value.toFixed(2))

const severityRank: Record<PrioritySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const getRecentTransactions = (transactions: Transaction[], days = 90) => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return transactions.filter((transaction) => {
    const time = new Date(transaction.timestampIso).getTime()
    return Number.isFinite(time) && time >= cutoff
  })
}

const summarizeCashAndDebt = (accounts: AccountItem[]) => {
  const cashCents = accounts
    .filter((account) => account.type === "savings" || account.type === "checking")
    .reduce((sum, account) => sum + account.balanceCents, 0)
  const debtCents = accounts
    .filter((account) => account.type === "debt")
    .reduce((sum, account) => sum + account.balanceCents, 0)

  const assetsCents = accounts
    .filter((account) => account.type !== "debt")
    .reduce((sum, account) => sum + account.balanceCents, 0)

  return {
    cashUsd: centsToUsd(cashCents),
    debtUsd: centsToUsd(debtCents),
    netWorthUsd: centsToUsd(assetsCents - debtCents),
  }
}

const summarizeCashflow = (transactions: Transaction[]) => {
  const recent = getRecentTransactions(transactions, 90)
  const source = recent.length > 0 ? recent : transactions
  const months = Math.max(1, Math.ceil((source.length > 0 ? 90 : 30) / 30))

  const income = source
    .filter((transaction) => transaction.type === "incoming")
    .reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const expense = source
    .filter((transaction) => transaction.type === "outgoing")
    .reduce((sum, transaction) => sum + transaction.amountCents, 0)

  const monthlyIncomeUsd = centsToUsd(income) / months
  const monthlyExpenseUsd = centsToUsd(expense) / months
  const monthlyNetUsd = monthlyIncomeUsd - monthlyExpenseUsd
  const savingsRatePct =
    monthlyIncomeUsd > 0 ? clamp((monthlyNetUsd / monthlyIncomeUsd) * 100, -100, 100) : 0

  return {
    monthlyIncomeUsd,
    monthlyExpenseUsd,
    monthlyNetUsd,
    savingsRatePct,
  }
}

const summarizeGoals = (goals: FinancialGoal[]) => {
  if (goals.length === 0) return 0
  const average = goals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0) / goals.length
  return clamp(average, 0, 100)
}

const summarizeConcentration = (
  stockActions: StockAction[],
  stockIntelligence?: StockIntelligenceContext | null
) => {
  const fromRegistry = stockIntelligence?.registry.activePositions ?? []
  if (fromRegistry.length > 0) {
    const values = fromRegistry.map((position) => Math.abs(position.entryPrice * position.shares))
    const total = values.reduce((sum, value) => sum + value, 0)
    if (total > 0) {
      const max = Math.max(...values)
      return clamp((max / total) * 100, 0, 100)
    }
  }

  const executed = stockActions.filter((action) => action.status === "executed")
  const bySymbol = new Map<string, number>()
  for (const action of executed) {
    const value = action.shares * centsToUsd(action.priceCents)
    bySymbol.set(action.symbol, (bySymbol.get(action.symbol) ?? 0) + Math.abs(value))
  }
  const values = Array.from(bySymbol.values())
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return 0
  return clamp((Math.max(...values) / total) * 100, 0, 100)
}

const scoreFinancialHealth = (
  emergencyFundMonths: number,
  savingsRatePct: number,
  debtToCashRatio: number,
  goalsCompletionPct: number
) => {
  let score = 55
  score += clamp((emergencyFundMonths - 3) * 7, -25, 25)
  score += clamp((savingsRatePct - 10) * 0.9, -20, 20)
  score -= clamp((debtToCashRatio - 0.7) * 20, -5, 25)
  score += clamp((goalsCompletionPct - 50) * 0.3, -10, 10)
  return clamp(score, 0, 100)
}

const scoreRiskControl = (
  concentrationPct: number,
  growthToolkit?: GrowthToolkitData | null,
  tradingOverview?: PaperTradingOverview | null,
  stockIntelligence?: StockIntelligenceContext | null
) => {
  let score = 62
  score -= clamp((concentrationPct - 20) * 1.1, 0, 30)

  if (growthToolkit) {
    score -= clamp((growthToolkit.maxDrawdownPct - 20) * 0.6, 0, 20)
    score += clamp((growthToolkit.emergencyFundMonths - 4) * 1.6, -10, 12)
  }

  if (tradingOverview) {
    score += clamp((35 - tradingOverview.policy.maxPositionPct) * 0.5, -10, 12)
    score += tradingOverview.policy.allowShort ? -6 : 4
    score -= clamp((tradingOverview.risk.drawdownPct - tradingOverview.policy.maxDrawdownPct * 0.6) * 0.8, 0, 20)
    score -= clamp((tradingOverview.risk.rejectedOrders24h - 3) * 2.5, 0, 15)
    if (tradingOverview.policy.killSwitchEnabled) {
      score -= 25
    }
    if (tradingOverview.risk.level === "halt") {
      score -= 20
    } else if (tradingOverview.risk.level === "restrict") {
      score -= 10
    }
  }

  if (stockIntelligence) {
    score -= stockIntelligence.alerts.criticalCount * 8
    score -= stockIntelligence.alerts.warningCount * 3
  }

  return clamp(score, 0, 100)
}

const scoreExecutionConsistency = (
  stockIntelligence?: StockIntelligenceContext | null,
  tradingOverview?: PaperTradingOverview | null
) => {
  let score = 50
  if (stockIntelligence) {
    const { winRate, totalTrades, avgReturnClosed } = stockIntelligence.registry.stats
    score += clamp((winRate - 50) * 0.5, -20, 20)
    score += clamp(totalTrades * 0.6, 0, 18)
    score += clamp(avgReturnClosed * 1.2, -15, 15)
  }

  if (tradingOverview) {
    const realized = centsToUsd(tradingOverview.account.realizedPnlCents)
    score += clamp(realized / 400, -15, 15)
  }

  return clamp(score, 0, 100)
}

const formatPercent = (value: number) => `${round2(value).toFixed(2)}%`
const formatUsd = (value: number) => `$${round2(value).toLocaleString("en-US")}`

const appendPriority = (
  list: AiPriorityItem[],
  item: AiPriorityItem
) => {
  const duplicate = list.find((entry) => entry.id === item.id)
  if (!duplicate) {
    list.push(item)
  }
}

export type AiFinanceLocale = "fr" | "en"

const priorityText: Record<
  AiFinanceLocale,
  Record<string, { title: string; reason: string; metricLabel: string; nextAction: string }>
> = {
  en: {
    "emergency-fund-gap": {
      title: "Build emergency buffer",
      reason: "Current liquidity buffer is below the 3-month baseline.",
      metricLabel: "Emergency Fund",
      nextAction:
        "Increase monthly savings allocation until at least 3 months of expenses are covered.",
    },
    "debt-pressure": {
      title: "Reduce debt pressure",
      reason: "Debt exceeds available cash buffer.",
      metricLabel: "Debt/Cash Ratio",
      nextAction: "Prioritize high-interest debt repayment and pause non-essential risk taking.",
    },
    "savings-rate": {
      title: "Lift savings rate",
      reason: "Savings rate is below target execution threshold.",
      metricLabel: "Savings Rate",
      nextAction: "Reduce discretionary spend or increase recurring contributions by 5-10%.",
    },
    "concentration-risk": {
      title: "Reduce concentration risk",
      reason: "Largest position dominates portfolio exposure.",
      metricLabel: "Top Position Weight",
      nextAction: "Trim overweight position and rebalance into diversified assets.",
    },
    "critical-alerts": {
      title: "Resolve critical market alerts",
      reason: "Critical alerts require immediate review.",
      metricLabel: "Critical Alerts",
      nextAction: "Review impacted symbols and update stop-loss/position sizing now.",
    },
    "execution-sample": {
      title: "Build execution sample size",
      reason: "Decision quality metrics are still based on limited trade history.",
      metricLabel: "Tracked Trades",
      nextAction: "Track and review every position lifecycle to improve signal calibration.",
    },
  },
  fr: {
    "emergency-fund-gap": {
      title: "Constituer un fonds d'urgence",
      reason: "Le coussin de liquidités actuel est sous le seuil de référence de 3 mois.",
      metricLabel: "Fonds d'urgence",
      nextAction: "Augmenter l'épargne mensuelle jusqu'à couvrir au moins 3 mois de dépenses.",
    },
    "debt-pressure": {
      title: "Réduire la pression de la dette",
      reason: "La dette dépasse le coussin de liquidités disponible.",
      metricLabel: "Ratio dette/liquidités",
      nextAction:
        "Prioriser le remboursement des dettes à taux élevé et suspendre les prises de risque non essentielles.",
    },
    "savings-rate": {
      title: "Augmenter le taux d'épargne",
      reason: "Le taux d'épargne est sous le seuil d'exécution visé.",
      metricLabel: "Taux d'épargne",
      nextAction:
        "Réduire les dépenses discrétionnaires ou augmenter les contributions récurrentes de 5 à 10 %.",
    },
    "concentration-risk": {
      title: "Réduire le risque de concentration",
      reason: "La plus grande position domine l'exposition du portefeuille.",
      metricLabel: "Poids de la position principale",
      nextAction: "Réduire la position en surpoids et rééquilibrer vers des actifs diversifiés.",
    },
    "critical-alerts": {
      title: "Traiter les alertes de marché critiques",
      reason: "Les alertes critiques exigent une revue immédiate.",
      metricLabel: "Alertes critiques",
      nextAction:
        "Passer en revue les symboles touchés et mettre à jour les stop-loss et la taille des positions dès maintenant.",
    },
    "execution-sample": {
      title: "Étoffer l'échantillon d'exécution",
      reason:
        "Les indicateurs de qualité des décisions reposent encore sur un historique de transactions limité.",
      metricLabel: "Transactions suivies",
      nextAction:
        "Suivre et revoir le cycle de vie de chaque position pour améliorer la calibration des signaux.",
    },
  },
}

const buildPriorities = (
  metrics: AiFinanceIntelligenceContext["metrics"],
  stockIntelligence?: StockIntelligenceContext | null,
  locale: AiFinanceLocale = "en"
) => {
  const priorities: AiPriorityItem[] = []
  const text = priorityText[locale]
  const monthsUnit = locale === "fr" ? "mois" : "months"

  if (metrics.emergencyFundMonths < 3) {
    appendPriority(priorities, {
      id: "emergency-fund-gap",
      ...text["emergency-fund-gap"],
      severity: "critical",
      metricValue: `${round2(metrics.emergencyFundMonths)} ${monthsUnit}`,
    })
  }

  if (metrics.debtToCashRatio > 1) {
    appendPriority(priorities, {
      id: "debt-pressure",
      ...text["debt-pressure"],
      severity: "high",
      metricValue: round2(metrics.debtToCashRatio).toString(),
    })
  }

  if (metrics.savingsRatePct < 10) {
    appendPriority(priorities, {
      id: "savings-rate",
      ...text["savings-rate"],
      severity: "high",
      metricValue: formatPercent(metrics.savingsRatePct),
    })
  }

  if (metrics.portfolioConcentrationPct > 30) {
    appendPriority(priorities, {
      id: "concentration-risk",
      ...text["concentration-risk"],
      severity: "high",
      metricValue: formatPercent(metrics.portfolioConcentrationPct),
    })
  }

  if (metrics.stockAlertsCritical > 0) {
    appendPriority(priorities, {
      id: "critical-alerts",
      ...text["critical-alerts"],
      severity: "critical",
      metricValue: String(metrics.stockAlertsCritical),
    })
  }

  if (stockIntelligence && stockIntelligence.registry.stats.totalTrades < 5) {
    appendPriority(priorities, {
      id: "execution-sample",
      ...text["execution-sample"],
      severity: "medium",
      metricValue: String(stockIntelligence.registry.stats.totalTrades),
    })
  }

  return priorities
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, 6)
}

const opportunityText: Record<
  AiFinanceLocale,
  {
    strongLiquidity: string
    strongGoals: string
    winRate: (rate: string) => string
    monthlySurplus: (amount: string) => string
  }
> = {
  en: {
    strongLiquidity:
      "Liquidity and savings profile allows progressive allocation into long-term growth buckets.",
    strongGoals:
      "Goal execution is strong; can transition to optimization and tax-efficiency phase.",
    winRate: (rate) =>
      `Current win rate (${rate}%) supports scaling only if risk limits stay constant.`,
    monthlySurplus: (amount) =>
      `Monthly surplus ${amount} can be routed to debt reduction + automated investing cadence.`,
  },
  fr: {
    strongLiquidity:
      "Le profil de liquidités et d'épargne permet une allocation progressive vers des placements de croissance à long terme.",
    strongGoals:
      "L'exécution des objectifs est solide ; possibilité de passer à la phase d'optimisation et d'efficacité fiscale.",
    winRate: (rate) =>
      `Le taux de réussite actuel (${rate} %) ne justifie une augmentation d'échelle que si les limites de risque restent inchangées.`,
    monthlySurplus: (amount) =>
      `Le surplus mensuel de ${amount} peut être dirigé vers la réduction de la dette et une cadence d'investissement automatisée.`,
  },
}

const buildOpportunities = (
  metrics: AiFinanceIntelligenceContext["metrics"],
  stockIntelligence?: StockIntelligenceContext | null,
  locale: AiFinanceLocale = "en"
) => {
  const opportunities: string[] = []
  const text = opportunityText[locale]

  if (metrics.emergencyFundMonths >= 6 && metrics.savingsRatePct >= 15) {
    opportunities.push(text.strongLiquidity)
  }

  if (metrics.goalsCompletionPct >= 60) {
    opportunities.push(text.strongGoals)
  }

  if (stockIntelligence && stockIntelligence.registry.stats.winRate >= 60) {
    opportunities.push(
      text.winRate(stockIntelligence.registry.stats.winRate.toFixed(1))
    )
  }

  if (metrics.monthlyNetUsd > 0) {
    opportunities.push(text.monthlySurplus(formatUsd(metrics.monthlyNetUsd)))
  }

  return opportunities.slice(0, 5)
}

const buildConstraints = (
  growthToolkit?: GrowthToolkitData | null,
  tradingOverview?: PaperTradingOverview | null,
  stockIntelligence?: StockIntelligenceContext | null
) => {
  const constraints: string[] = []

  if (growthToolkit) {
    constraints.push(
      `Risk profile ${growthToolkit.riskProfile}, max drawdown tolerance ${formatPercent(growthToolkit.maxDrawdownPct)}.`
    )
    constraints.push(
      `Rebalance threshold ${formatPercent(growthToolkit.rebalanceThresholdPct)} with horizon ${growthToolkit.horizonYears} years.`
    )
  }

  if (tradingOverview) {
    constraints.push(
      `Trading policy: max position ${formatPercent(tradingOverview.policy.maxPositionPct)}, max order ${formatUsd(
        centsToUsd(tradingOverview.policy.maxOrderNotionalCents)
      )}, max open positions ${tradingOverview.policy.maxOpenPositions}, max daily loss ${formatUsd(
        centsToUsd(tradingOverview.policy.maxDailyLossCents)
      )}, max drawdown ${formatPercent(tradingOverview.policy.maxDrawdownPct)}, short ${tradingOverview.policy.allowShort ? "enabled" : "disabled"}, kill-switch ${tradingOverview.policy.killSwitchEnabled ? "enabled" : "disabled"}.`
    )
    if (tradingOverview.policy.blockedSymbols.length > 0) {
      constraints.push(
        `Blocked symbols: ${tradingOverview.policy.blockedSymbols.slice(0, 8).join(", ")}.`
      )
    }
    constraints.push(
      `Current risk regime ${tradingOverview.risk.level.toUpperCase()} (drawdown ${formatPercent(
        tradingOverview.risk.drawdownPct
      )}, rejected orders 24h ${tradingOverview.risk.rejectedOrders24h}).`
    )
  }

  if (stockIntelligence && stockIntelligence.alerts.activeCount > 0) {
    constraints.push(
      `${stockIntelligence.alerts.activeCount} active stock alerts must be considered before any position increase.`
    )
  }

  return constraints.slice(0, 6)
}

export function buildAiFinanceIntelligenceContext(inputs: Inputs): AiFinanceIntelligenceContext {
  const cashDebt = summarizeCashAndDebt(inputs.accounts)
  const cashflow = summarizeCashflow(inputs.transactions)
  const goalsCompletionPct = summarizeGoals(inputs.goals)

  const tradingCashUsd = inputs.tradingOverview ? centsToUsd(inputs.tradingOverview.account.cashCents) : 0
  const tradingRealizedPnlUsd = inputs.tradingOverview
    ? centsToUsd(inputs.tradingOverview.account.realizedPnlCents)
    : 0

  const cashUsd = cashDebt.cashUsd + tradingCashUsd
  const debtToCashRatio = cashUsd > 0 ? cashDebt.debtUsd / cashUsd : cashDebt.debtUsd > 0 ? 10 : 0
  const emergencyFundMonths =
    cashflow.monthlyExpenseUsd > 0 ? cashUsd / cashflow.monthlyExpenseUsd : cashUsd > 0 ? 12 : 0
  const concentrationPct = summarizeConcentration(inputs.stockActions, inputs.stockIntelligence)
  const alertsSnapshot = inputs.stockIntelligence?.alerts

  const metrics: AiFinanceIntelligenceContext["metrics"] = {
    netWorthUsd: round2(cashDebt.netWorthUsd + tradingRealizedPnlUsd),
    cashUsd: round2(cashUsd),
    debtUsd: round2(cashDebt.debtUsd),
    monthlyIncomeUsd: round2(cashflow.monthlyIncomeUsd),
    monthlyExpenseUsd: round2(cashflow.monthlyExpenseUsd),
    monthlyNetUsd: round2(cashflow.monthlyNetUsd),
    savingsRatePct: round2(cashflow.savingsRatePct),
    debtToCashRatio: round2(debtToCashRatio),
    emergencyFundMonths: round2(emergencyFundMonths),
    portfolioConcentrationPct: round2(concentrationPct),
    activeTradingPositions: inputs.tradingOverview?.positions.length ?? 0,
    realizedTradingPnlUsd: round2(tradingRealizedPnlUsd),
    stockAlertsActive: alertsSnapshot?.activeCount ?? 0,
    stockAlertsCritical: alertsSnapshot?.criticalCount ?? 0,
    goalsCompletionPct: round2(goalsCompletionPct),
  }

  const scores = {
    financialHealth: round2(
      scoreFinancialHealth(
        metrics.emergencyFundMonths,
        metrics.savingsRatePct,
        metrics.debtToCashRatio,
        metrics.goalsCompletionPct
      )
    ),
    riskControl: round2(
      scoreRiskControl(
        metrics.portfolioConcentrationPct,
        inputs.growthToolkit,
        inputs.tradingOverview,
        inputs.stockIntelligence
      )
    ),
    executionConsistency: round2(
      scoreExecutionConsistency(inputs.stockIntelligence, inputs.tradingOverview)
    ),
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    scores,
    metrics,
    priorities: buildPriorities(metrics, inputs.stockIntelligence, inputs.locale ?? "en"),
    opportunities: buildOpportunities(metrics, inputs.stockIntelligence, inputs.locale ?? "en"),
    constraints: buildConstraints(inputs.growthToolkit, inputs.tradingOverview, inputs.stockIntelligence),
  }
}
