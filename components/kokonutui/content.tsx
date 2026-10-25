"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Target,
  CreditCard,
  Wallet,
  Sparkles,
  Bot,
  CandlestickChart,
  ShieldAlert,
  TrendingUp,
  PieChart,
  PiggyBank,
  ClipboardList,
  RefreshCcw,
  Plug,
} from "lucide-react"
import List01 from "./list-01"
import List02 from "./list-02"
import List03 from "./list-03"
import List04 from "./list-04"
import PortfolioHighlights from "./portfolio-highlights"
import HermesBriefing from "./hermes-briefing"
import InsightsPanel from "./insights-panel"
import PerformanceAllocation from "./performance-allocation"
import Rebalancing from "./rebalancing"
import BudgetCashflow from "./budget-cashflow"
import MonthlyBudgetPlanner from "./monthly-budget-planner"
import PlanningScenarios from "./planning-scenarios"
import Integrations from "./integrations"
import SmartFinanceTools from "./smart-finance-tools"
import PortfolioGrowthStudio from "./portfolio-growth-studio"
import AiTradingDesk from "./ai-trading-desk"
import { StockAnalysisPanel } from "./stock-analysis-panel"
import { StockAlertsWidget } from "./stock-alerts-widget"
import { PortfolioProvider } from "@/lib/portfolio-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Content() {
  const sectionToTab = useMemo(
    () => ({
      "points-saillants": "portfolio",
      accounts: "portfolio",
      transactions: "portfolio",
      "performance-allocation": "portfolio",
      insights: "portfolio",
      "stock-actions": "portfolio",
      rebalancing: "portfolio",
      "growth-studio": "portfolio",
      "trading-desk": "portfolio",
      "stock-intelligence": "portfolio",
      "stock-alerts": "portfolio",
      "budget-cashflow": "budget",
      "monthly-budget": "budget",
      "planning-scenarios": "budget",
      "smart-tools": "budget",
      goals: "budget",
      integrations: "integrations",
    }),
    []
  )

  const [tabValue, setTabValue] = useState("portfolio")
  const [pendingHash, setPendingHash] = useState<string | null>(null)

  useEffect(() => {
    const syncTabWithHash = () => {
      const hash = window.location.hash.replace("#", "")
      if (!hash) {
        return
      }
      const nextTab = sectionToTab[hash as keyof typeof sectionToTab]
      if (nextTab) {
        setTabValue(nextTab)
        setPendingHash(hash)
      }
    }

    syncTabWithHash()
    window.addEventListener("hashchange", syncTabWithHash)
    return () => {
      window.removeEventListener("hashchange", syncTabWithHash)
    }
  }, [sectionToTab])

  useEffect(() => {
    if (!pendingHash) {
      return
    }

    const scrollToTarget = () => {
      const target = document.getElementById(pendingHash)
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" })
        setPendingHash(null)
        return true
      }
      return false
    }

    if (scrollToTarget()) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      scrollToTarget()
    }, 100)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pendingHash, tabValue])

  return (
    <PortfolioProvider>
      <Tabs value={tabValue} onValueChange={setTabValue} className="space-y-6">
        <TabsList className="flex h-auto flex-nowrap justify-start gap-2 overflow-x-auto whitespace-nowrap bg-transparent p-0">
          <TabsTrigger value="portfolio">Portefeuille</TabsTrigger>
          <TabsTrigger value="budget">Budget &amp; Planification</TabsTrigger>
          <TabsTrigger value="integrations">Intégrations</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-8">
          <section id="points-saillants" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Points saillants
                </h2>
                <p className="text-xs text-muted-foreground">
                  Alertes et priorités calculées localement, à partir de vos données.
                </p>
              </div>
            </div>
            <PortfolioHighlights className="w-full" />
          </section>

          <section id="briefing-hermes" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Briefings
                </h2>
                <p className="text-xs text-muted-foreground">
                  Synthèses quotidiennes — Hermes en local, Nova en infonuagique.
                </p>
              </div>
            </div>
            <HermesBriefing className="w-full" />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section id="accounts" className="space-y-3 scroll-mt-24">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Comptes</h2>
                  <p className="text-xs text-muted-foreground">Aperçu rapide des soldes</p>
                </div>
              </div>
              <List01 className="h-full w-full" />
            </section>

            <section id="transactions" className="space-y-3 scroll-mt-24">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Transactions récentes
                  </h2>
                  <p className="text-xs text-muted-foreground">Flux en temps réel des mouvements</p>
                </div>
              </div>
              <List02 className="h-full w-full" />
            </section>

            <section id="performance-allocation" className="space-y-3 scroll-mt-24">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                  <PieChart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Performance & allocation
                  </h2>
                  <p className="text-xs text-muted-foreground">Comparaison vs objectifs</p>
                </div>
              </div>
              <PerformanceAllocation className="h-full w-full" />
            </section>
          </div>

          <section id="insights" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Insights & alertes
              </h2>
            </div>
            <InsightsPanel className="w-full" />
          </section>

          <section id="stock-actions" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Actions de marché
              </h2>
            </div>
            <List04 className="h-full w-full" />
          </section>

          <section id="rebalancing" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <RefreshCcw className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Rééquilibrage
              </h2>
            </div>
            <Rebalancing className="w-full" />
          </section>

          <section id="growth-studio" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Growth Studio IA
              </h2>
            </div>
            <PortfolioGrowthStudio className="w-full" />
          </section>

          <section id="trading-desk" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <CandlestickChart className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Trading Desk IA
              </h2>
            </div>
            <AiTradingDesk className="w-full" />
          </section>

          <section id="stock-intelligence" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Stock Intelligence IA
              </h2>
            </div>
            <StockAnalysisPanel className="w-full" />
          </section>

          <section id="stock-alerts" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <ShieldAlert className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Alertes intelligentes actions
              </h2>
            </div>
            <StockAlertsWidget className="w-full" maxAlerts={6} />
          </section>
        </TabsContent>

        <TabsContent value="budget" className="space-y-8">
          <section id="budget-cashflow" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <PiggyBank className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Budget & Cashflow
              </h2>
            </div>
            <BudgetCashflow className="w-full" />
          </section>

          <section id="monthly-budget" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <PiggyBank className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Budget mensuel par catégorie
              </h2>
            </div>
            <MonthlyBudgetPlanner className="w-full" />
          </section>

          <section id="planning-scenarios" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <ClipboardList className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Scénarios de planification
              </h2>
            </div>
            <PlanningScenarios className="w-full" />
          </section>

          <section id="smart-tools" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <ClipboardList className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Alertes intelligentes & simulateur
              </h2>
            </div>
            <SmartFinanceTools className="w-full" />
          </section>

          <section id="goals" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Objectifs financiers
              </h2>
            </div>
            <List03 />
          </section>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-8">
          <section id="integrations" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <Plug className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Intégrations & synchronisation
              </h2>
            </div>
            <Integrations />
          </section>
        </TabsContent>
      </Tabs>
    </PortfolioProvider>
  )
}
