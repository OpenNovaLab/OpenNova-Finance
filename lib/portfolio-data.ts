// Centralized portfolio data that can be shared with AI advisor

export interface AccountItem {
  id: string
  title: string
  description?: string
  balanceCents: number
  type: "savings" | "checking" | "investment" | "debt"
}

export interface Transaction {
  id: string
  title: string
  amountCents: number
  type: "incoming" | "outgoing"
  category: string
  timestampIso: string
  status: "completed" | "pending" | "failed"
}

export interface FinancialGoal {
  id: string
  title: string
  subtitle: string
  iconStyle: string
  targetDateIso: string
  targetAmountCents?: number
  status: "pending" | "in-progress" | "completed"
  progress?: number
}

export interface StockAction {
  id: string
  symbol: string
  action: "buy" | "sell"
  shares: number
  priceCents: number
  tradeDateIso: string
  status: "executed" | "pending" | "cancelled"
}

export interface AllocationActual {
  id: string
  label: string
  actual: number
  colorClass: string
}

export interface AllocationTarget {
  id: string
  label: string
  target: number
}

export interface DiversificationItem {
  id: string
  label: string
  current: number
  target: number
  note?: string
}

export interface RebalancingAction {
  id: string
  title: string
  description: string
  status: "overweight" | "underweight" | "balanced"
  impact: string
}

export interface DiversificationGroup {
  id: string
  title: string
  description: string
  items: DiversificationItem[]
}

export interface DiversificationBreakdown {
  actions: RebalancingAction[]
  analysis: DiversificationGroup[]
}

export interface PerformanceMetric {
  id: string
  label: string
  value: string
  note?: string
}

export interface RiskMetric {
  id: string
  label: string
  value: string
  note?: string
}

export interface NetWorthHistoryPoint {
  id: string
  label: string
  value: number
}

export interface NetWorthBreakdownItem {
  id: string
  label: string
  value: number
  description?: string
  colorClass?: string
}

export interface BudgetCategory {
  id: string
  label: string
  allocation: number
  planned: number
  spent: number
  colorClass: string
}

export interface CashflowForecastPoint {
  id: string
  label: string
  income: number
  expenses: number
}

export interface AlertThreshold {
  id: string
  label: string
  description?: string
  threshold: number
  current: number
  status: "ok" | "warning" | "critical"
}

export interface PortfolioAlert {
  id: string
  title: string
  description: string
  category: "prix" | "cash buffer" | "drawdown"
  status: "actif" | "résolu" | "critique"
  updatedAtIso: string
}

export interface PlanningScenario {
  id: string
  label: string
  description: string
  rateDelta: number
  marketShock: number
  incomeDelta: number
}

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

const SHORT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const SHORT_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export const centsToDollars = (valueCents: number) => valueCents / 100
export const dollarsToCents = (valueDollars: number) => Math.round(valueDollars * 100)

export const parseCurrencyToCents = (value: string | number | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? dollarsToCents(value) : 0
  }

  if (typeof value !== "string" || value.trim() === "") {
    return 0
  }

  const normalized = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(normalized)) {
    return 0
  }
  return dollarsToCents(normalized)
}

export const formatCurrencyFromCents = (valueCents: number) => USD_FORMATTER.format(centsToDollars(valueCents))

export const formatShortDateFromIso = (valueIso: string) => {
  const parsed = new Date(valueIso)
  if (Number.isNaN(parsed.getTime())) {
    return valueIso
  }
  return SHORT_DATE_FORMATTER.format(parsed)
}

export const formatShortDateTimeFromIso = (valueIso: string) => {
  const parsed = new Date(valueIso)
  if (Number.isNaN(parsed.getTime())) {
    return valueIso
  }
  return SHORT_DATE_TIME_FORMATTER.format(parsed)
}

export const formatMonthYearFromIso = (valueIso: string) => {
  const parsed = new Date(valueIso)
  if (Number.isNaN(parsed.getTime())) {
    return valueIso
  }
  return MONTH_YEAR_FORMATTER.format(parsed)
}

export const formatRelativeTimestampFromIso = (valueIso: string) => {
  const parsed = new Date(valueIso)
  if (Number.isNaN(parsed.getTime())) {
    return valueIso
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const comparedDate = new Date(parsed)
  comparedDate.setHours(0, 0, 0, 0)

  const dayDifference = Math.round((today.getTime() - comparedDate.getTime()) / 86_400_000)
  if (dayDifference === 0) {
    return `Today, ${SHORT_TIME_FORMATTER.format(parsed)}`
  }
  if (dayDifference === 1) {
    return `Yesterday, ${SHORT_TIME_FORMATTER.format(parsed)}`
  }
  return SHORT_DATE_TIME_FORMATTER.format(parsed)
}

// Positions réelles d'Alex (source : classeur « Investissement Principale », onglet Dashboard,
// relevé du 2026-10-25). Le classeur suit des positions, pas un historique de transactions :
// chaque position est donc inscrite comme un achat exécuté au prix moyen payé, daté du relevé.
// Une entrée par position et par compte (VEQT apparaît deux fois : Retraite et Disnat CELI CAD).
// Prix en cents, dans la devise du titre (CAD pour TSE:*, USD pour les titres américains).
export const STOCK_ACTIONS: StockAction[] = [
  {
    id: "1",
    symbol: "TSE:VEQT",
    action: "buy",
    shares: 1100,
    priceCents: 5523,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "2",
    symbol: "TSE:PAVE",
    action: "buy",
    shares: 81,
    priceCents: 2808,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "3",
    symbol: "TSE:HURA",
    action: "buy",
    shares: 94,
    priceCents: 5308,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "4",
    symbol: "TSE:MTRX",
    action: "buy",
    shares: 93,
    priceCents: 3508,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "5",
    symbol: "TSE:VEQT",
    action: "buy",
    shares: 281,
    priceCents: 6112,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "6",
    symbol: "NASDAQ:BOTZ",
    action: "buy",
    shares: 51,
    priceCents: 3830,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "7",
    symbol: "KOID",
    action: "buy",
    shares: 11,
    priceCents: 3887,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "8",
    symbol: "NYSEARCA:URNM",
    action: "buy",
    shares: 13,
    priceCents: 4763,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "9",
    symbol: "NYSEARCA:VT",
    action: "buy",
    shares: 77,
    priceCents: 15527,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "10",
    symbol: "NASDAQ:AVGO",
    action: "buy",
    shares: 1,
    priceCents: 34424,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "11",
    symbol: "NASDAQ:ISRG",
    action: "buy",
    shares: 1,
    priceCents: 35082,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "12",
    symbol: "NYSE:VRT",
    action: "buy",
    shares: 1,
    priceCents: 25116,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
  {
    id: "13",
    symbol: "NASDAQ:TDAC",
    action: "buy",
    shares: 3,
    priceCents: 1090,
    tradeDateIso: "2026-10-25T00:00:00.000Z",
    status: "executed",
  },
]

export const calculateStockActionsValueCents = (actions: StockAction[]): number => {
  return actions
    .filter((action) => action.status === "executed")
    .reduce((sum, action) => {
      const tradeValue = Math.round(action.shares * action.priceCents)
      return action.action === "buy" ? sum + tradeValue : sum - tradeValue
    }, 0)
}

export const TOTAL_STOCK_ACTIONS_VALUE_CENTS = calculateStockActionsValueCents(STOCK_ACTIONS)

export const DISNAT_CRI_CENTS = 7_530_052 // 75 300,52 $ CAD (titres 75 257,70 $, encaisse 42,82 $)
export const DISNAT_CELI_CAD_CENTS = 2_002_281 // 20 022,81 $ CAD (titres 19 989,71 $, encaisse 33,10 $)
export const DISNAT_CELI_USD_CENTS = 1_565_765 // 15 657,65 $ USD (titres 15 597,62 $, encaisse 60,03 $)
export const DISNAT_OTHER_CENTS = 2_628 // 26,28 $ (CAD: 5K717A3 8,49 $, 5K717Y8 6,00 $ | USD: 5K717B1 5,79 $, 5K717U7 6,00 $)
export const TOTAL_DISNAT_VALUE_CENTS =
  DISNAT_CRI_CENTS + DISNAT_CELI_CAD_CENTS + DISNAT_CELI_USD_CENTS + DISNAT_OTHER_CENTS

export const ACCOUNTS: AccountItem[] = [
  {
    id: "1",
    title: "Épargne Desjardins",
    description: "Taxes, Léa, REER & Épargne (AccèsD)",
    balanceCents: 47_904,
    type: "savings",
  },
  {
    id: "2",
    title: "Comptes Chèques Desjardins",
    description: "Personnel (Joliette) & Conjoint (AccèsD)",
    balanceCents: 87_961,
    type: "checking",
  },
  {
    id: "disnat-cri",
    title: "CRI Disnat (5K71713)",
    description: "Titres : 75 257,70 $, Encaisse : 42,82 $ (CAD)",
    balanceCents: DISNAT_CRI_CENTS,
    type: "investment",
  },
  {
    id: "disnat-celi-cad",
    title: "CELI Disnat CAD (5K717Z6)",
    description: "Titres : 19 989,71 $, Encaisse : 33,10 $ (CAD)",
    balanceCents: DISNAT_CELI_CAD_CENTS,
    type: "investment",
  },
  {
    id: "disnat-celi-usd",
    title: "CELI Disnat USD (5K717T9)",
    description: "Titres : 15 597,62 $, Encaisse : 60,03 $ (USD)",
    balanceCents: DISNAT_CELI_USD_CENTS,
    type: "investment",
  },
  {
    id: "disnat-comptant-reer",
    title: "Disnat Comptant & REER",
    description: "5K717A3 (8,49 $), 5K717Y8 (6,00 $), 5K717B1 (5,79 $ US), 5K717U7 (6,00 $ US)",
    balanceCents: DISNAT_OTHER_CENTS,
    type: "investment",
  },
  {
    id: "4",
    title: "Mastercard Odyssée & Visa",
    description: "Cartes de crédit Desjardins (AccèsD)",
    balanceCents: 259_676,
    type: "debt",
  },
]

export const TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    title: "Dividend Payment - AAPL",
    amountCents: 12_550,
    type: "incoming",
    category: "investment",
    timestampIso: "2026-03-03T14:45:00.000Z",
    status: "completed",
  },
  {
    id: "2",
    title: "Salary Deposit",
    amountCents: 450_000,
    type: "incoming",
    category: "income",
    timestampIso: "2026-03-03T09:00:00.000Z",
    status: "completed",
  },
  {
    id: "3",
    title: "Stock Purchase - NVDA",
    amountCents: 85_000,
    type: "outgoing",
    category: "investment",
    timestampIso: "2026-03-02T15:30:00.000Z",
    status: "completed",
  },
  {
    id: "4",
    title: "Amazon Purchase",
    amountCents: 15_699,
    type: "outgoing",
    category: "shopping",
    timestampIso: "2026-03-02T11:20:00.000Z",
    status: "completed",
  },
  {
    id: "5",
    title: "Electric Bill",
    amountCents: 14_250,
    type: "outgoing",
    category: "utilities",
    timestampIso: "2026-02-02T08:00:00.000Z",
    status: "completed",
  },
  {
    id: "6",
    title: "Credit Card Payment",
    amountCents: 50_000,
    type: "outgoing",
    category: "debt",
    timestampIso: "2026-02-01T08:00:00.000Z",
    status: "completed",
  },
]

export const FINANCIAL_GOALS: FinancialGoal[] = [
  {
    id: "1",
    title: "Emergency Fund",
    subtitle: "3 months of expenses saved",
    iconStyle: "savings",
    targetDateIso: "2026-12-01T00:00:00.000Z",
    targetAmountCents: 1_500_000,
    status: "in-progress",
    progress: 65,
  },
  {
    id: "2",
    title: "Stock Portfolio",
    subtitle: "Tech sector investment plan",
    iconStyle: "investment",
    targetDateIso: "2026-06-01T00:00:00.000Z",
    targetAmountCents: 5_000_000,
    status: "pending",
    progress: 30,
  },
  {
    id: "3",
    title: "Debt Repayment",
    subtitle: "Credit card payoff plan",
    iconStyle: "debt",
    targetDateIso: "2027-03-01T00:00:00.000Z",
    targetAmountCents: 2_500_000,
    status: "in-progress",
    progress: 45,
  },
]

export const ALLOCATION_ACTUAL: AllocationActual[] = [
  {
    id: "equities",
    label: "Actions",
    actual: 48,
    colorClass: "bg-emerald-500",
  },
  {
    id: "bonds",
    label: "Obligations",
    actual: 24,
    colorClass: "bg-blue-500",
  },
  {
    id: "cash",
    label: "Cash",
    actual: 12,
    colorClass: "bg-amber-500",
  },
  {
    id: "crypto",
    label: "Crypto",
    actual: 8,
    colorClass: "bg-purple-500",
  },
  {
    id: "real-estate",
    label: "Immobilier",
    actual: 8,
    colorClass: "bg-rose-500",
  },
]

export const ALLOCATION_TARGETS: AllocationTarget[] = [
  {
    id: "equities",
    label: "Actions",
    target: 50,
  },
  {
    id: "bonds",
    label: "Obligations",
    target: 25,
  },
  {
    id: "cash",
    label: "Cash",
    target: 10,
  },
  {
    id: "crypto",
    label: "Crypto",
    target: 5,
  },
  {
    id: "real-estate",
    label: "Immobilier",
    target: 10,
  },
]

export const DIVERSIFICATION_BREAKDOWN: DiversificationBreakdown = {
  actions: [
    {
      id: "trim-tech",
      title: "Réduire la surpondération Tech",
      description: "Vendre 3% d'ETF growth US pour revenir à la cible.",
      status: "overweight",
      impact: "-3% actions growth",
    },
    {
      id: "boost-europe",
      title: "Renforcer l'Europe",
      description: "Acheter des ETF Europe large cap pour couvrir le déficit régional.",
      status: "underweight",
      impact: "+4% zone euro",
    },
    {
      id: "rebalance-cash",
      title: "Reconstituer le coussin de liquidité",
      description: "Allouer 2% en cash pour améliorer la flexibilité.",
      status: "underweight",
      impact: "+2% cash",
    },
  ],
  analysis: [
    {
      id: "sectors",
      title: "Secteurs",
      description: "Répartition par secteurs d'activité.",
      items: [
        { id: "tech", label: "Technologie", current: 32, target: 25, note: "Surpondéré" },
        { id: "health", label: "Santé", current: 12, target: 15, note: "À renforcer" },
        { id: "industrials", label: "Industrie", current: 10, target: 12, note: "À renforcer" },
        { id: "consumer", label: "Consommation", current: 18, target: 18, note: "Aligné" },
      ],
    },
    {
      id: "regions",
      title: "Zones",
      description: "Exposition géographique globale.",
      items: [
        { id: "north-america", label: "Amérique du Nord", current: 58, target: 50, note: "Surpondéré" },
        { id: "europe", label: "Europe", current: 22, target: 26, note: "À renforcer" },
        { id: "asia", label: "Asie-Pacifique", current: 14, target: 18, note: "À renforcer" },
        { id: "emerging", label: "Émergents", current: 6, target: 6, note: "Aligné" },
      ],
    },
    {
      id: "currencies",
      title: "Devises",
      description: "Répartition des expositions par devise.",
      items: [
        { id: "usd", label: "USD", current: 62, target: 55, note: "Surpondéré" },
        { id: "eur", label: "EUR", current: 24, target: 28, note: "À renforcer" },
        { id: "gbp", label: "GBP", current: 6, target: 7, note: "Légèrement bas" },
        { id: "jpy", label: "JPY", current: 4, target: 5, note: "À renforcer" },
      ],
    },
  ],
}

export const PERFORMANCE_METRICS: PerformanceMetric[] = [
  {
    id: "ytd",
    label: "YTD",
    value: "+8.4%",
    note: "vs bench +1.2%",
  },
  {
    id: "one-year",
    label: "1Y",
    value: "+14.6%",
    note: "vs bench +2.4%",
  },
  {
    id: "five-year",
    label: "5Y",
    value: "+42.3%",
    note: "annualisé 7.3%",
  },
  {
    id: "annualized",
    label: "Annualisée",
    value: "7.3%",
    note: "sur 5 ans",
  },
  {
    id: "benchmark",
    label: "Vs Benchmark",
    value: "+1.8%",
    note: "allocation cible",
  },
]

export const RISK_METRICS: RiskMetric[] = [
  {
    id: "volatility",
    label: "Volatilité",
    value: "11.4%",
    note: "12 mois glissants",
  },
  {
    id: "max-drawdown",
    label: "Drawdown max",
    value: "-9.2%",
    note: "depuis 3 ans",
  },
  {
    id: "sharpe",
    label: "Ratio de Sharpe",
    value: "0.86",
    note: "RF 2.1%",
  },
]

export const ASSET_BREAKDOWN: NetWorthBreakdownItem[] = [
  {
    id: "cash",
    label: "Cash",
    description: "Comptes courants & épargne",
    value: 12450,
    colorClass: "bg-emerald-500",
  },
  {
    id: "investments",
    label: "Investissements",
    description: "ETF, actions, obligations",
    value: 38400,
    colorClass: "bg-blue-500",
  },
  {
    id: "real-estate",
    label: "Immobilier",
    description: "Résidence principale",
    value: 185000,
    colorClass: "bg-purple-500",
  },
  {
    id: "other-assets",
    label: "Autres",
    description: "Véhicules, participations",
    value: 12500,
    colorClass: "bg-amber-500",
  },
]

export const LIABILITY_BREAKDOWN: NetWorthBreakdownItem[] = [
  {
    id: "mortgage",
    label: "Crédits",
    description: "Crédit immobilier",
    value: 142000,
    colorClass: "bg-rose-500",
  },
  {
    id: "credit-cards",
    label: "Cartes",
    description: "Cartes de crédit",
    value: 5200,
    colorClass: "bg-orange-500",
  },
  {
    id: "loans",
    label: "Prêts",
    description: "Prêt auto & personnel",
    value: 9800,
    colorClass: "bg-red-500",
  },
]

export const NET_WORTH_HISTORY: NetWorthHistoryPoint[] = [
  { id: "jan", label: "Jan", value: 82000 },
  { id: "feb", label: "Fév", value: 84500 },
  { id: "mar", label: "Mar", value: 87250 },
  { id: "apr", label: "Avr", value: 90500 },
  { id: "may", label: "Mai", value: 93200 },
  { id: "jun", label: "Juin", value: 96800 },
  { id: "jul", label: "Juil", value: 100400 },
  { id: "aug", label: "Août", value: 103250 },
  { id: "sep", label: "Sep", value: 108900 },
  { id: "oct", label: "Oct", value: 112600 },
  { id: "nov", label: "Nov", value: 116300 },
  { id: "dec", label: "Déc", value: 120150 },
]

export const BUDGETS: BudgetCategory[] = [
  {
    id: "essentials",
    label: "Essentiels",
    allocation: 50,
    planned: 3200,
    spent: 2980,
    colorClass: "bg-emerald-500",
  },
  {
    id: "lifestyle",
    label: "Style de vie",
    allocation: 30,
    planned: 1900,
    spent: 2140,
    colorClass: "bg-amber-500",
  },
  {
    id: "savings",
    label: "Épargne",
    allocation: 20,
    planned: 1300,
    spent: 980,
    colorClass: "bg-blue-500",
  },
]

export const CASHFLOW_FORECAST: CashflowForecastPoint[] = [
  { id: "apr", label: "Avr", income: 5200, expenses: 4020 },
  { id: "may", label: "Mai", income: 5300, expenses: 4175 },
  { id: "jun", label: "Juin", income: 5400, expenses: 4280 },
  { id: "jul", label: "Juil", income: 5250, expenses: 4410 },
  { id: "aug", label: "Août", income: 5500, expenses: 4525 },
  { id: "sep", label: "Sep", income: 5600, expenses: 4380 },
]

export const ALERTS_THRESHOLDS: AlertThreshold[] = [
  {
    id: "dining",
    label: "Restaurants & sorties",
    description: "Seuil mensuel",
    threshold: 650,
    current: 720,
    status: "critical",
  },
  {
    id: "subscriptions",
    label: "Abonnements",
    description: "Seuil mensuel",
    threshold: 120,
    current: 95,
    status: "ok",
  },
  {
    id: "shopping",
    label: "Shopping",
    description: "Seuil mensuel",
    threshold: 500,
    current: 460,
    status: "warning",
  },
]

export const ALERTS: PortfolioAlert[] = [
  {
    id: "price-alert",
    title: "Prix cible atteint sur NVIDIA",
    description: "NVDA a franchi le seuil de 15% de hausse sur 30 jours.",
    category: "prix",
    status: "actif",
    updatedAtIso: "2026-03-03T11:50:00.000Z",
  },
  {
    id: "cash-buffer",
    title: "Cash buffer sous le minimum",
    description: "Le coussin de liquidités est à 18% (objectif 25%).",
    category: "cash buffer",
    status: "critique",
    updatedAtIso: "2026-03-03T10:48:00.000Z",
  },
  {
    id: "drawdown-alert",
    title: "Drawdown global stabilisé",
    description: "Le drawdown repasse sous -6% après rééquilibrage.",
    category: "drawdown",
    status: "résolu",
    updatedAtIso: "2026-03-02T17:40:00.000Z",
  },
]

export const PLANNING_SCENARIOS: PlanningScenario[] = [
  {
    id: "base",
    label: "Base",
    description: "Hypothèse centrale avec croissance stable.",
    rateDelta: 0,
    marketShock: 0,
    incomeDelta: 0,
  },
  {
    id: "rate-down",
    label: "Taux bas",
    description: "Rendements plus faibles sur la durée.",
    rateDelta: -1.5,
    marketShock: 0,
    incomeDelta: 0,
  },
  {
    id: "market-dip",
    label: "Marché baissier",
    description: "Choc initial suivi d'une reprise lente.",
    rateDelta: -1,
    marketShock: -0.18,
    incomeDelta: 0,
  },
  {
    id: "income-loss",
    label: "Perte de revenu",
    description: "Baisse du revenu et de la capacité d'épargne.",
    rateDelta: -0.5,
    marketShock: 0,
    incomeDelta: -0.25,
  },
]

export const TOTAL_BALANCE_CENTS = ACCOUNTS.reduce((sum, account) => {
  if (account.type === "debt") {
    return sum - account.balanceCents
  }
  return sum + account.balanceCents
}, 0)

export const TOTAL_BALANCE = formatCurrencyFromCents(TOTAL_BALANCE_CENTS)

// Helper function to get portfolio summary for AI
export function getPortfolioSummary() {
  const totalSavingsCents = ACCOUNTS.filter((a) => a.type === "savings").reduce(
    (sum, a) => sum + a.balanceCents,
    0
  )

  const totalInvestmentsCents = ACCOUNTS.filter((a) => a.type === "investment").reduce(
    (sum, a) => sum + a.balanceCents,
    0
  )

  const totalDebtCents = ACCOUNTS.filter((a) => a.type === "debt").reduce(
    (sum, a) => sum + a.balanceCents,
    0
  )

  const totalCheckingCents = ACCOUNTS.filter((a) => a.type === "checking").reduce(
    (sum, a) => sum + a.balanceCents,
    0
  )

  const recentIncomeCents = TRANSACTIONS.filter((t) => t.type === "incoming").reduce(
    (sum, t) => sum + t.amountCents,
    0
  )

  const recentExpensesCents = TRANSACTIONS.filter((t) => t.type === "outgoing").reduce(
    (sum, t) => sum + t.amountCents,
    0
  )

  const totalSavings = centsToDollars(totalSavingsCents)
  const totalInvestments = centsToDollars(totalInvestmentsCents)
  const totalDebt = centsToDollars(totalDebtCents)
  const totalChecking = centsToDollars(totalCheckingCents)
  const recentIncome = centsToDollars(recentIncomeCents)
  const recentExpenses = centsToDollars(recentExpensesCents)

  return {
    totalBalance: TOTAL_BALANCE,
    accounts: ACCOUNTS,
    transactions: TRANSACTIONS,
    financialGoals: FINANCIAL_GOALS,
    diversificationBreakdown: DIVERSIFICATION_BREAKDOWN,
    summary: {
      totalSavings,
      totalInvestments,
      totalDebt,
      totalChecking,
      recentIncome,
      recentExpenses,
      netWorth: totalSavings + totalInvestments + totalChecking - totalDebt,
    }
  }
}
