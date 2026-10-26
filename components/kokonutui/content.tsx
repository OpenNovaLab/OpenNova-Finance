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
import DashboardSection from "./dashboard-section"
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
          <DashboardSection
            id="points-saillants"
            icon={Sparkles}
            title="Points saillants"
            description="Alertes et priorités calculées localement, à partir de vos données."
          >
            <PortfolioHighlights className="w-full" />
          </DashboardSection>

          <DashboardSection
            id="briefing-hermes"
            icon={Bot}
            title="Briefings"
            description="Synthèses quotidiennes — Nova · Hermes (local) et Nova · Muse."
          >
            <HermesBriefing className="w-full" />
          </DashboardSection>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DashboardSection
              id="accounts"
              icon={Wallet}
              title="Comptes"
              description="Aperçu rapide des soldes"
            >
              <List01 className="h-full w-full" />
            </DashboardSection>

            <DashboardSection
              id="transactions"
              icon={CreditCard}
              title="Transactions récentes"
              description="Flux en temps réel des mouvements"
            >
              <List02 className="h-full w-full" />
            </DashboardSection>

            <DashboardSection
              id="performance-allocation"
              icon={PieChart}
              title="Performance & allocation"
              description="Comparaison vs objectifs"
            >
              <PerformanceAllocation className="h-full w-full" />
            </DashboardSection>
          </div>

          <DashboardSection id="insights" icon={TrendingUp} title="Insights & alertes">
            <InsightsPanel className="w-full" />
          </DashboardSection>

          <DashboardSection id="stock-actions" icon={TrendingUp} title="Actions de marché">
            <List04 className="h-full w-full" />
          </DashboardSection>

          <DashboardSection id="rebalancing" icon={RefreshCcw} title="Rééquilibrage">
            <Rebalancing className="w-full" />
          </DashboardSection>

          <DashboardSection id="growth-studio" icon={Target} title="Growth Studio IA">
            <PortfolioGrowthStudio className="w-full" />
          </DashboardSection>

          <DashboardSection id="trading-desk" icon={CandlestickChart} title="Trading Desk IA">
            <AiTradingDesk className="w-full" />
          </DashboardSection>

          <DashboardSection id="stock-intelligence" icon={TrendingUp} title="Stock Intelligence IA">
            <StockAnalysisPanel className="w-full" />
          </DashboardSection>

          <DashboardSection
            id="stock-alerts"
            icon={ShieldAlert}
            title="Alertes intelligentes actions"
          >
            <StockAlertsWidget className="w-full" maxAlerts={6} />
          </DashboardSection>
        </TabsContent>

        <TabsContent value="budget" className="space-y-8">
          <DashboardSection id="budget-cashflow" icon={PiggyBank} title="Budget & Cashflow">
            <BudgetCashflow className="w-full" />
          </DashboardSection>

          <DashboardSection
            id="monthly-budget"
            icon={PiggyBank}
            title="Budget mensuel par catégorie"
          >
            <MonthlyBudgetPlanner className="w-full" />
          </DashboardSection>

          <DashboardSection
            id="planning-scenarios"
            icon={ClipboardList}
            title="Scénarios de planification"
          >
            <PlanningScenarios className="w-full" />
          </DashboardSection>

          <DashboardSection
            id="smart-tools"
            icon={ClipboardList}
            title="Alertes intelligentes & simulateur"
          >
            <SmartFinanceTools className="w-full" />
          </DashboardSection>

          <DashboardSection id="goals" icon={Target} title="Objectifs financiers">
            <List03 />
          </DashboardSection>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-8">
          <DashboardSection
            id="integrations"
            icon={Plug}
            title="Intégrations & synchronisation"
          >
            <Integrations />
          </DashboardSection>
        </TabsContent>
      </Tabs>
    </PortfolioProvider>
  )
}
