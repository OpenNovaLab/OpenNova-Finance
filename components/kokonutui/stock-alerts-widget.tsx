"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { AlertCircle, AlertTriangle, Bell, CheckCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  deleteAlert,
  getAlertsSnapshot,
  getRecentTriggeredAlerts,
  type StockAlert,
} from "@/lib/stock-alerts"
import { WidgetEmptyState } from "./widget-state"

interface AlertsWidgetProps {
  className?: string
  maxAlerts?: number
}

const severityIcon: Record<StockAlert["severity"], ReactNode> = {
  info: <CheckCircle className="h-4 w-4 text-blue-600" />,
  warning: <AlertCircle className="h-4 w-4 text-amber-600" />,
  critical: <AlertTriangle className="h-4 w-4 text-rose-600" />,
}

const severityStyle: Record<StockAlert["severity"], string> = {
  info: "border-blue-200 bg-blue-50/60",
  warning: "border-amber-200 bg-amber-50/60",
  critical: "border-rose-200 bg-rose-50/60",
}

export function StockAlertsWidget({ className, maxAlerts = 5 }: AlertsWidgetProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [activeCount, setActiveCount] = useState(0)

  const reload = useCallback(() => {
    const triggered = getRecentTriggeredAlerts(240)
      .sort((a, b) => new Date(b.triggeredAt ?? b.createdAt).getTime() - new Date(a.triggeredAt ?? a.createdAt).getTime())
      .slice(0, maxAlerts)
    const snapshot = getAlertsSnapshot()
    setAlerts(triggered)
    setActiveCount(snapshot.activeCount)
  }, [maxAlerts])

  useEffect(() => {
    reload()
    const intervalId = window.setInterval(reload, 20_000)
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("stock_alert")) {
        reload()
      }
    }
    const onCustomEvent = () => {
      reload()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("stock-alert", onCustomEvent)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("stock-alert", onCustomEvent)
    }
  }, [reload])

  const dismiss = (alertId: string) => {
    deleteAlert(alertId)
    reload()
  }

  const indicatorLabel = useMemo(() => {
    if (activeCount <= 0) return "Aucune alerte active"
    return `${activeCount} alerte${activeCount > 1 ? "s" : ""} active${activeCount > 1 ? "s" : ""}`
  }, [activeCount])

  return (
    <div className={cn("fx-panel p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className={cn("h-4 w-4", activeCount > 0 ? "text-amber-500" : "text-muted-foreground")} />
          <h4 className="text-sm font-semibold text-foreground">Alertes actions</h4>
        </div>
        <span className="text-xs text-muted-foreground">{indicatorLabel}</span>
      </div>

      {alerts.length === 0 ? (
        <WidgetEmptyState>Aucune alerte déclenchée récemment.</WidgetEmptyState>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "rounded-lg border p-3 text-xs transition-colors",
                severityStyle[alert.severity]
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-start gap-2 text-left"
                  onClick={() => setExpanded((current) => (current === alert.id ? null : alert.id))}
                >
                  {severityIcon[alert.severity]}
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {alert.symbol} · {alert.type}
                    </p>
                    <p className="truncate text-muted-foreground">{alert.message}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(alert.id)}
                  className="rounded border border-border/60 bg-background/70 p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss alert"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {expanded === alert.id && (
                <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-muted-foreground">
                  <p>Condition: {alert.condition || "n/a"}</p>
                  <p>Creee: {new Date(alert.createdAt).toLocaleString("fr-FR")}</p>
                  {alert.triggeredAt && <p>Declenchee: {new Date(alert.triggeredAt).toLocaleString("fr-FR")}</p>}
                  {typeof alert.currentValue === "number" && <p>Valeur: {alert.currentValue.toFixed(2)}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function useStockAlerts(onAlert?: (alert: StockAlert) => void) {
  useEffect(() => {
    if (!onAlert) return

    const listener = (event: Event) => {
      const custom = event as CustomEvent<{ alert?: StockAlert }>
      if (custom.detail?.alert) {
        onAlert(custom.detail.alert)
      }
    }
    window.addEventListener("stock-alert", listener)
    return () => {
      window.removeEventListener("stock-alert", listener)
    }
  }, [onAlert])
}
