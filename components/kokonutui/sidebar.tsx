"use client"

import React, { useMemo, useState } from "react"

import {
  BarChart2,
  Receipt,
  CreditCard,
  Wallet,
  Bot,
  Sparkles,
  Settings,
  HelpCircle,
  Menu,
  TrendingUp,
  CandlestickChart,
  PiggyBank,
  Target,
  Home,
  Plug,
  Bell,
  ChevronDown,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  function handleNavigation() {
    setIsMobileMenuOpen(false)
  }

  function handleHashClick(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.includes("#")) {
      handleNavigation()
      return
    }

    const [targetPath, hash] = href.split("#")
    if (targetPath && targetPath !== pathname) {
      handleNavigation()
      return
    }

    event.preventDefault()
    handleNavigation()

    if (hash) {
      window.location.hash = hash
    }
  }

  function NavItem({
    href,
    icon: Icon,
    badge,
    children,
  }: {
    href: string
    icon: LucideIcon
    badge?: string
    children: React.ReactNode
  }) {
    const isActive = pathname === href || (href.includes("#") && pathname === href.split("#")[0])
    return (
      <Link
        href={href}
        onClick={(event) => handleHashClick(event, href)}
        className={cn(
          "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
          isActive
            ? "bg-accent/70 text-foreground"
            : "text-foreground/70 hover:text-foreground hover:bg-accent/60"
        )}
      >
        <Icon className="h-4 w-4 mr-3 flex-shrink-0" />
        <span className="flex-1">{children}</span>
        {badge && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  const sections = useMemo(
    () => [
      {
        id: "overview",
        label: "Vue d'ensemble",
        items: [
          { href: "/dashboard", icon: Home, label: "Tableau de bord" },
          { href: "/dashboard#points-saillants", icon: Sparkles, label: "Points saillants" },
          { href: "/dashboard#accounts", icon: BarChart2, label: "Vue comptes" },
        ],
      },
      {
        id: "portfolio",
        label: "Portefeuille",
        items: [
          { href: "/dashboard#accounts", icon: Wallet, label: "Comptes" },
          { href: "/dashboard#transactions", icon: Receipt, label: "Transactions" },
          { href: "/dashboard#insights", icon: TrendingUp, label: "Insights", badge: "New" },
          { href: "/dashboard#stock-actions", icon: TrendingUp, label: "Ordres bourse" },
          { href: "/dashboard#trading-desk", icon: CandlestickChart, label: "Trading Desk IA" },
          { href: "/dashboard#stock-intelligence", icon: BarChart2, label: "Stock Intelligence" },
          { href: "/dashboard#stock-alerts", icon: Bell, label: "Alertes actions" },
          { href: "/dashboard#growth-studio", icon: Target, label: "Growth Studio IA" },
        ],
      },
      {
        id: "planning",
        label: "Planification",
        items: [
          { href: "/dashboard#goals", icon: Target, label: "Objectifs" },
          { href: "/dashboard#goals", icon: PiggyBank, label: "Épargne" },
          { href: "/dashboard#budget-cashflow", icon: CreditCard, label: "Budgets" },
          { href: "/dashboard#monthly-budget", icon: Wallet, label: "Budget mensuel" },
          { href: "/dashboard#smart-tools", icon: Bot, label: "Simulateur & CSV" },
          { href: "/planning/alerts-notifications", icon: Bell, label: "Alertes & notifications" },
          { href: "/dashboard#integrations", icon: Plug, label: "Intégrations" },
        ],
      },
    ],
    []
  )

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    portfolio: true,
    planning: true,
  })

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <button
        type="button"
        className="group lg:hidden fixed top-4 left-4 z-[70] p-2 rounded-xl bg-background/60 backdrop-blur-xl border border-border/60 shadow-sm transition-all duration-200 hover:shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu className="h-5 w-5 text-foreground/70 transition-transform duration-200 group-hover:scale-105" />
      </button>
      <nav
        className={`
                fixed inset-y-0 left-0 z-[70] w-64 transform transition-transform duration-200 ease-in-out
                lg:translate-x-0 lg:static lg:w-64
                bg-background/55 backdrop-blur-xl border-r border-border/60
                ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
            `}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 px-6 flex items-center border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-semibold tracking-tight fx-brand">OpenNova Finance</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-4">
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.id} className="rounded-xl border border-border/40 bg-background/40 dark:bg-slate-900/40 transition-all duration-200 hover:shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        openSections[section.id] ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>
                  {openSections[section.id] && (
                    <div className="pb-2 space-y-1">
                      {section.items.map((item) => (
                        <NavItem key={`${item.href}-${item.label}`} href={item.href} icon={item.icon} badge={item.badge}>
                          {item.label}
                        </NavItem>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-4 border-t border-border/60">
            <div className="space-y-1">
              <NavItem href="/settings" icon={Settings}>
                Paramètres
              </NavItem>
              <NavItem href="#" icon={HelpCircle}>
                Aide
              </NavItem>
            </div>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[65] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
