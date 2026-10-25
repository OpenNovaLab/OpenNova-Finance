import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createAlert,
  createAutomaticAlert,
  deleteAlert,
  evaluateAlertCondition,
  formatAlertNotification,
  getActiveAlertsForSymbol,
  getAlertsSnapshot,
  getDefaultPreferences,
  getRecentTriggeredAlerts,
  loadAlertPreferences,
  loadAlerts,
  requestNotificationPermission,
  runAlertEngine,
  saveAlertPreferences,
  saveAlerts,
  sendNotification,
  triggerAlert,
  updateAlert,
  upsertAutomaticAlertsFromRecommendations,
  type StockAlert,
} from "@/lib/stock-alerts"
import type { StockAIRecommendation } from "@/lib/stock-analysis-engine"

const ALERTS_KEY = "stock_alerts_v2"
const LEGACY_ALERTS_KEY = "stock_alerts_v1"
const PREFS_KEY = "stock_alert_preferences_v1"

function makeMemoryStorage() {
  const map = new Map<string, string>()
  const storage = {
    length: 0,
    clear: () => map.clear(),
    key: () => null,
    removeItem: (name: string) => {
      map.delete(name)
    },
    getItem: (name: string) => (map.has(name) ? (map.get(name) as string) : null),
    setItem: (name: string, value: string) => {
      map.set(name, value)
    },
  } as Storage
  return { map, storage }
}

let memory: ReturnType<typeof makeMemoryStorage> | null = null

const installWindow = () => {
  memory = makeMemoryStorage()
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: memory.storage },
    configurable: true,
    writable: true,
  })
  return memory
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: undefined,
    configurable: true,
    writable: true,
  })
  memory = null
  vi.restoreAllMocks()
})

const makeAlert = (overrides: Partial<StockAlert> = {}): StockAlert => ({
  id: "alert-fixed-1",
  symbol: "AAPL",
  type: "price-target",
  condition: "above target",
  severity: "warning",
  isActive: true,
  createdAt: "2026-02-01T12:00:00.000Z",
  message: "AAPL alert",
  ...overrides,
})

const makeRecommendation = (
  overrides: Partial<StockAIRecommendation> = {}
): StockAIRecommendation => ({
  symbol: "NVDA",
  signal: "buy",
  confidence: 80,
  reasonTechnical: "technique",
  reasonFundamental: "fondamental",
  priceTarget: 150,
  timeframe: "short-term",
  riskScore: 40,
  potentialReturn: 12,
  ...overrides,
})

describe("stock-alerts sans stockage (serveur)", () => {
  it("loadAlerts retourne [] et les préférences par défaut sans window", () => {
    expect(loadAlerts()).toEqual([])
    expect(loadAlertPreferences()).toEqual(getDefaultPreferences())
    expect(getActiveAlertsForSymbol("AAPL")).toEqual([])
  })

  it("requestNotificationPermission retourne false sans window", async () => {
    await expect(requestNotificationPermission()).resolves.toBe(false)
  })
})

describe("evaluateAlertCondition", () => {
  it("price-target : vrai quand le prix atteint la cible (sens par défaut >=)", () => {
    const alert = makeAlert({ triggerValue: 100 })
    expect(evaluateAlertCondition(alert, 100, 50, 1000, 95)).toBe(true)
    expect(evaluateAlertCondition(alert, 99.99, 50, 1000, 95)).toBe(false)
  })

  it("price-target : conditions below/under/<= inversent la comparaison", () => {
    const below = makeAlert({ condition: "below target", triggerValue: 100 })
    expect(evaluateAlertCondition(below, 90, 50, 1000, 95)).toBe(true)
    expect(evaluateAlertCondition(below, 110, 50, 1000, 95)).toBe(false)
    const lte = makeAlert({ condition: "<= 100", triggerValue: 100 })
    expect(evaluateAlertCondition(lte, 100, 50, 1000, 95)).toBe(true)
  })

  it("price-target : false si triggerValue est absent", () => {
    const alert = makeAlert({ triggerValue: undefined })
    expect(evaluateAlertCondition(alert, 500, 50, 1000, 95)).toBe(false)
  })

  it("rsi-signal : overbought et oversold utilisent le seuil de la condition", () => {
    const overbought = makeAlert({ type: "rsi-signal", condition: "RSI overbought 70" })
    expect(evaluateAlertCondition(overbought, 100, 75, 1000, 100)).toBe(true)
    expect(evaluateAlertCondition(overbought, 100, 65, 1000, 100)).toBe(false)

    const oversold = makeAlert({ type: "rsi-signal", condition: "RSI oversold 30" })
    expect(evaluateAlertCondition(oversold, 100, 25, 1000, 100)).toBe(true)
    expect(evaluateAlertCondition(oversold, 100, 40, 1000, 100)).toBe(false)
  })

  it("volatility : compare la variation absolue au seuil", () => {
    const alert = makeAlert({ type: "volatility", triggerValue: 5 })
    expect(evaluateAlertCondition(alert, 106, 50, 1000, 100)).toBe(true)
    expect(evaluateAlertCondition(alert, 103, 50, 1000, 100)).toBe(false)
    expect(evaluateAlertCondition(alert, 94, 50, 1000, 100)).toBe(true)
  })

  it("volatility : previousClose à 0 retombe sur le prix courant (variation 0)", () => {
    const alert = makeAlert({ type: "volatility", triggerValue: 5 })
    expect(evaluateAlertCondition(alert, 106, 50, 1000, 0)).toBe(false)
  })

  it("trend : up/down selon le signe, seuil de 2 %", () => {
    const up = makeAlert({ type: "trend", condition: "uptrend" })
    expect(evaluateAlertCondition(up, 103, 50, 1000, 100)).toBe(true)
    expect(evaluateAlertCondition(up, 97, 50, 1000, 100)).toBe(false)

    const down = makeAlert({ type: "trend", condition: "tendance baissiere" })
    expect(evaluateAlertCondition(down, 97, 50, 1000, 100)).toBe(true)
    expect(evaluateAlertCondition(down, 103, 50, 1000, 100)).toBe(false)
  })

  it("news : retourne isActive ; type inconnu : false", () => {
    const news = makeAlert({ type: "news", isActive: true })
    expect(evaluateAlertCondition(news, 100, 50, 1000, 100)).toBe(true)
    const inactiveNews = makeAlert({ type: "news", isActive: false })
    expect(evaluateAlertCondition(inactiveNews, 100, 50, 1000, 100)).toBe(false)

    const unknown = makeAlert({ type: "autre" as StockAlert["type"] })
    expect(evaluateAlertCondition(unknown, 100, 50, 1000, 100)).toBe(false)
  })
})

describe("persistance des alertes (localStorage)", () => {
  it("createAlert normalise le symbole, persiste et retourne l'alerte active", () => {
    installWindow()
    const alert = createAlert(" aapl ", "price-target", "above target", "Cible atteinte", "warning", 150)
    expect(alert.symbol).toBe("AAPL")
    expect(alert.isActive).toBe(true)
    expect(alert.severity).toBe("warning")
    expect(alert.triggerValue).toBe(150)
    expect(alert.id).toMatch(/^alert-/)

    const loaded = loadAlerts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(alert.id)
  })

  it("loadAlerts trie par createdAt décroissant et normalise les entrées brutes", () => {
    const { storage } = installWindow()
    storage.setItem(
      ALERTS_KEY,
      JSON.stringify([
        { id: "old", symbol: "msft", type: "trend", severity: "info", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "new", symbol: "aapl", type: "trend", severity: "info", isActive: true, createdAt: "2026-02-01T00:00:00.000Z" },
      ])
    )
    const loaded = loadAlerts()
    expect(loaded.map((a) => a.id)).toEqual(["new", "old"])
    expect(loaded[0].symbol).toBe("AAPL")
    expect(loaded[0].message).toBe("AAPL alert")
    expect(loaded[0].condition).toBe("")
  })

  it("loadAlerts retourne [] si le JSON est corrompu ou n'est pas un tableau", () => {
    const { storage } = installWindow()
    storage.setItem(ALERTS_KEY, "{pas-du-json")
    expect(loadAlerts()).toEqual([])
    storage.setItem(ALERTS_KEY, JSON.stringify({ cle: "valeur" }))
    expect(loadAlerts()).toEqual([])
  })

  it("loadAlerts migre la clé legacy v1 vers v2 quand v2 est absente", () => {
    const { map, storage } = installWindow()
    storage.setItem(LEGACY_ALERTS_KEY, JSON.stringify([makeAlert({ id: "legacy-1" })]))
    const loaded = loadAlerts()
    expect(loaded.map((a) => a.id)).toEqual(["legacy-1"])
    expect(map.has(ALERTS_KEY)).toBe(true)
  })

  it("updateAlert met à jour et persiste ; id inconnu retourne null", () => {
    installWindow()
    saveAlerts([makeAlert()])
    const updated = updateAlert("alert-fixed-1", { severity: "critical", isActive: false })
    expect(updated?.severity).toBe("critical")
    expect(updated?.isActive).toBe(false)
    expect(loadAlerts()[0].severity).toBe("critical")
    expect(updateAlert("id-inconnu", { severity: "info" })).toBeNull()
  })

  it("deleteAlert retourne true puis false pour le même id", () => {
    installWindow()
    saveAlerts([makeAlert()])
    expect(deleteAlert("alert-fixed-1")).toBe(true)
    expect(loadAlerts()).toEqual([])
    expect(deleteAlert("alert-fixed-1")).toBe(false)
  })

  it("getActiveAlertsForSymbol filtre par symbole (insensible à la casse) et état actif", () => {
    installWindow()
    saveAlerts([
      makeAlert({ id: "1", symbol: "AAPL", isActive: true }),
      makeAlert({ id: "2", symbol: "AAPL", isActive: false }),
      makeAlert({ id: "3", symbol: "TSLA", isActive: true }),
    ])
    expect(getActiveAlertsForSymbol("aapl").map((a) => a.id)).toEqual(["1"])
  })

  it("triggerAlert horodate, enregistre la valeur et désactive l'alerte", () => {
    installWindow()
    saveAlerts([makeAlert()])
    const triggered = triggerAlert("alert-fixed-1", 123.45)
    expect(triggered?.isActive).toBe(false)
    expect(triggered?.currentValue).toBe(123.45)
    expect(triggered?.triggeredAt).toBeTruthy()
    expect(loadAlerts()[0].isActive).toBe(false)
  })

  it("getRecentTriggeredAlerts ne garde que les déclenchements dans la fenêtre", () => {
    installWindow()
    const now = Date.now()
    saveAlerts([
      makeAlert({ id: "recent", triggeredAt: new Date(now - 10 * 60_000).toISOString(), isActive: false }),
      makeAlert({ id: "ancien", triggeredAt: new Date(now - 3 * 60 * 60_000).toISOString(), isActive: false }),
      makeAlert({ id: "jamais", triggeredAt: undefined }),
    ])
    expect(getRecentTriggeredAlerts(60).map((a) => a.id)).toEqual(["recent"])
  })
})

describe("préférences d'alertes", () => {
  it("valeurs par défaut exactes", () => {
    expect(getDefaultPreferences()).toEqual({
      enabledAlerts: true,
      notificationMethod: "push",
      severityThreshold: "warning",
      tradingHoursOnly: false,
      symbols: [],
      priceChangeThreshold: 5,
      volumeSurgeThreshold: 50,
      rsiThreshold: 30,
    })
  })

  it("aller-retour save/load", () => {
    installWindow()
    const prefs = { ...getDefaultPreferences(), notificationMethod: "both" as const, priceChangeThreshold: 7 }
    saveAlertPreferences(prefs)
    expect(loadAlertPreferences()).toEqual(prefs)
  })

  it("les seuils sont bornés et les valeurs invalides retombent sur les défauts", () => {
    const { storage } = installWindow()
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        enabledAlerts: "oui",
        notificationMethod: "pigeon",
        severityThreshold: "grave",
        symbols: ["aapl", " tsla "],
        priceChangeThreshold: 0,
        volumeSurgeThreshold: 0,
        rsiThreshold: 90,
      })
    )
    const prefs = loadAlertPreferences()
    expect(prefs.enabledAlerts).toBe(true)
    expect(prefs.notificationMethod).toBe("push")
    expect(prefs.severityThreshold).toBe("warning")
    expect(prefs.symbols).toEqual(["AAPL", "TSLA"])
    expect(prefs.priceChangeThreshold).toBe(0.1)
    expect(prefs.volumeSurgeThreshold).toBe(1)
    expect(prefs.rsiThreshold).toBe(45)

    storage.setItem(PREFS_KEY, JSON.stringify({ rsiThreshold: 2 }))
    expect(loadAlertPreferences().rsiThreshold).toBe(5)

    storage.setItem(PREFS_KEY, "{corrompu")
    expect(loadAlertPreferences()).toEqual(getDefaultPreferences())
  })
})

describe("formatAlertNotification", () => {
  it("format français : en-têtes, sévérité CRITIQUE et prix formaté", () => {
    const text = formatAlertNotification(makeAlert({ severity: "critical" }), 123.456)
    expect(text).toContain("Alerte AAPL")
    expect(text).toContain("Severite: CRITIQUE")
    expect(text).toContain("Prix actuel: $123.46")
  })

  it("format anglais sans prix : la ligne de prix est omise", () => {
    const text = formatAlertNotification(makeAlert({ severity: "warning" }), undefined, "en")
    expect(text).toContain("Alert AAPL")
    expect(text).toContain("Severity: WARNING")
    expect(text).not.toContain("Current Price")
  })
})

describe("alertes automatiques", () => {
  it("createAutomaticAlert : signal d'achat -> price-target info avec la cible", () => {
    installWindow()
    const alert = createAutomaticAlert("nvda", "strong-buy", 180.5, 30)
    expect(alert.type).toBe("price-target")
    expect(alert.severity).toBe("info")
    expect(alert.triggerValue).toBe(180.5)
    expect(alert.symbol).toBe("NVDA")
  })

  it("createAutomaticAlert : vente à risque élevé -> trend critical ; sinon warning", () => {
    installWindow()
    expect(createAutomaticAlert("TSLA", "sell", 100, 85).severity).toBe("critical")
    expect(createAutomaticAlert("TSLA", "strong-sell", 100, 20).severity).toBe("warning")
    const hold = createAutomaticAlert("TSLA", "hold", 100, 10)
    expect(hold.type).toBe("volatility")
    expect(hold.severity).toBe("info")
  })

  it("upsertAutomaticAlertsFromRecommendations ne duplique pas une alerte active", () => {
    installWindow()
    upsertAutomaticAlertsFromRecommendations([makeRecommendation()])
    upsertAutomaticAlertsFromRecommendations([makeRecommendation()])
    const actives = getActiveAlertsForSymbol("NVDA").filter(
      (a) => a.type === "price-target" || a.type === "trend"
    )
    expect(actives).toHaveLength(1)
  })
})

describe("runAlertEngine", () => {
  it("préférences désactivées : aucun résultat", () => {
    installWindow()
    saveAlertPreferences({ ...getDefaultPreferences(), enabledAlerts: false })
    const result = runAlertEngine([{ symbol: "AAPL", currentPrice: 200, previousClose: 100, rsi: 10, volume: 1 }])
    expect(result).toEqual({ triggered: [], proactive: [] })
  })

  it("mouvement de prix : signal proactif warning, puis critical au-delà de 1,8x le seuil", () => {
    installWindow()
    const warning = runAlertEngine([{ symbol: "AAPL", currentPrice: 106, previousClose: 100, rsi: 50, volume: 1 }])
    expect(warning.proactive).toHaveLength(1)
    expect(warning.proactive[0].severity).toBe("warning")
    expect(warning.proactive[0].headline).toBe("Mouvement de prix inhabituel")

    const critical = runAlertEngine([{ symbol: "AAPL", currentPrice: 112, previousClose: 100, rsi: 50, volume: 1 }])
    expect(critical.proactive[0].severity).toBe("critical")
  })

  it("RSI extrême : signal proactif RSI en français et en anglais", () => {
    installWindow()
    const fr = runAlertEngine([{ symbol: "AAPL", currentPrice: 100, previousClose: 100, rsi: 20, volume: 1 }])
    expect(fr.proactive).toHaveLength(1)
    expect(fr.proactive[0].headline).toBe("Signal RSI detecte")

    const en = runAlertEngine([{ symbol: "AAPL", currentPrice: 100, previousClose: 100, rsi: 85, volume: 1 }], "en")
    expect(en.proactive[0].headline).toBe("RSI signal detected")
  })

  it("déclenche une alerte dont la condition est satisfaite et la désactive", () => {
    installWindow()
    createAlert("TSLA", "price-target", "above target", "Cible TSLA", "warning", 100)
    const result = runAlertEngine([{ symbol: "TSLA", currentPrice: 105, previousClose: 104, rsi: 50, volume: 1 }])
    expect(result.triggered).toHaveLength(1)
    expect(result.triggered[0].symbol).toBe("TSLA")
    expect(loadAlerts()[0].isActive).toBe(false)
  })

  it("une alerte sous le seuil de sévérité est déclenchée mais exclue des résultats", () => {
    installWindow()
    createAlert("TSLA", "price-target", "above target", "Info TSLA", "info", 100)
    const result = runAlertEngine([{ symbol: "TSLA", currentPrice: 105, previousClose: 104, rsi: 50, volume: 1 }])
    expect(result.triggered).toEqual([])
    expect(loadAlerts()[0].isActive).toBe(false)
  })

  it("cooldown : une alerte déclenchée il y a 5 minutes n'est pas redéclenchée", () => {
    installWindow()
    saveAlerts([
      makeAlert({
        id: "cool-1",
        symbol: "TSLA",
        triggerValue: 100,
        triggeredAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      }),
    ])
    const result = runAlertEngine([{ symbol: "TSLA", currentPrice: 105, previousClose: 104, rsi: 50, volume: 1 }])
    expect(result.triggered).toEqual([])
    expect(loadAlerts()[0].isActive).toBe(true)
  })
})

describe("getAlertsSnapshot et sendNotification", () => {
  it("getAlertsSnapshot compte les alertes actives par sévérité", () => {
    installWindow()
    saveAlerts([
      makeAlert({ id: "1", severity: "critical" }),
      makeAlert({ id: "2", severity: "warning" }),
      makeAlert({ id: "3", severity: "warning", isActive: false }),
    ])
    const snapshot = getAlertsSnapshot()
    expect(snapshot.activeCount).toBe(2)
    expect(snapshot.criticalCount).toBe(1)
    expect(snapshot.warningCount).toBe(1)
    expect(snapshot.active.map((a) => a.id)).toEqual(["1", "2"])
  })

  it("sendNotification par courriel simule l'envoi et retourne true", async () => {
    installWindow()
    vi.spyOn(console, "log").mockImplementation(() => {})
    await expect(sendNotification(makeAlert(), 100, "email")).resolves.toBe(true)
  })
})
