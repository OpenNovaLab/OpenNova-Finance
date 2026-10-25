import { access, mkdir, mkdtemp, readFile, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PaperTradingStore } from "@/lib/trading-types"

const originalCwd = process.cwd()
let tempRoot = ""

const loadModule = async () => {
  vi.resetModules()
  return import("@/lib/trading-storage")
}

const dataFile = () => path.join(tempRoot, "data", "trading-paper.json")

const writeRawStore = async (raw: unknown) => {
  const dataDir = path.join(tempRoot, "data")
  await mkdir(dataDir, { recursive: true })
  await writeFile(dataFile(), typeof raw === "string" ? raw : JSON.stringify(raw), "utf-8")
}

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "opennova-trading-storage-"))
  process.chdir(tempRoot)
})

afterEach(() => {
  process.chdir(originalCwd)
})

describe("trading-storage — lecture et normalisation", () => {
  it("premier accès : crée le fichier avec le magasin d'amorce (100 000 $ papier)", async () => {
    const { readTradingStore } = await loadModule()
    const store = await readTradingStore()
    expect(store.version).toBe(1)
    expect(store.cashCents).toBe(10_000_000)
    expect(store.realizedPnlCents).toBe(0)
    expect(store.positions).toEqual([])
    expect(store.orders).toEqual([])
    expect(store.policy).toEqual({
      maxPositionPct: 35,
      maxOrderNotionalCents: 2_500_000,
      allowShort: false,
      blockedSymbols: [],
      maxOpenPositions: 12,
      maxDailyLossCents: 250_000,
      maxDrawdownPct: 18,
      killSwitchEnabled: false,
    })
    expect(store.equityHistory.length).toBeGreaterThanOrEqual(1)
    await expect(access(dataFile())).resolves.toBeUndefined()
  })

  it("JSON corrompu dans le fichier : retourne le magasin d'amorce", async () => {
    await writeRawStore("{pas-du-json")
    const { readTradingStore } = await loadModule()
    const store = await readTradingStore()
    expect(store.cashCents).toBe(10_000_000)
    expect(store.positions).toEqual([])
  })

  it("magasin malformé : les champs invalides sont assainis un par un", async () => {
    await writeRawStore({
      version: 99,
      cashCents: 5_000.7,
      realizedPnlCents: "erreur",
      policy: { maxPositionPct: 25 },
      positions: [
        { symbol: "aapl", quantity: 2, avgPriceCents: 150.4 },
        { symbol: "ZERO", quantity: 0, avgPriceCents: 100 },
        { quantity: 3, avgPriceCents: 100 },
      ],
      orders: [
        {
          id: "ord-1",
          symbol: "AAPL",
          side: "buy",
          quantity: 1,
          type: "market",
          status: "filled",
          requestedAt: "2026-02-01T10:00:00.000Z",
          executedAt: "2026-02-01T10:00:01.000Z",
          fillPriceCents: 19_000,
          notionalCents: 19_000,
        },
        { id: "ord-bidon" },
      ],
      equityHistory: [
        { at: "2026-02-01T10:00:00.000Z", equityCents: 10_000_000 },
        { at: "pas-une-date", equityCents: 5 },
      ],
      updatedAt: "2026-02-01T10:00:00.000Z",
    })

    const { readTradingStore } = await loadModule()
    const store = await readTradingStore()
    expect(store.version).toBe(1)
    expect(store.cashCents).toBe(5_001)
    expect(store.realizedPnlCents).toBe(0)
    expect(store.policy.maxPositionPct).toBe(25)
    expect(store.policy.maxOpenPositions).toBe(12)
    expect(store.positions).toEqual([{ symbol: "AAPL", quantity: 2, avgPriceCents: 150 }])
    expect(store.orders.map((o) => o.id)).toEqual(["ord-1"])
    expect(store.equityHistory).toHaveLength(1)
  })

  it("aller-retour write/read : les données valides persistent", async () => {
    const mod = await loadModule()
    const seed = await mod.readTradingStore()
    const custom: PaperTradingStore = {
      ...seed,
      cashCents: 4_200_000,
      positions: [{ symbol: "NVDA", quantity: 3, avgPriceCents: 12_345 }],
    }
    await mod.writeTradingStore(custom)
    const reread = await mod.readTradingStore()
    expect(reread.cashCents).toBe(4_200_000)
    expect(reread.positions).toEqual([{ symbol: "NVDA", quantity: 3, avgPriceCents: 12_345 }])
  })
})

describe("trading-storage — politique", () => {
  it("getTradingPolicy retourne la politique par défaut sur un magasin neuf", async () => {
    const { getTradingPolicy } = await loadModule()
    const policy = await getTradingPolicy()
    expect(policy.maxPositionPct).toBe(35)
    expect(policy.killSwitchEnabled).toBe(false)
  })

  it("updateTradingPolicy fusionne, normalise les symboles bloqués et persiste", async () => {
    const mod = await loadModule()
    const updated = await mod.updateTradingPolicy({
      maxPositionPct: 20,
      blockedSymbols: [" aapl ", "tsla"],
    })
    expect(updated.maxPositionPct).toBe(20)
    expect(updated.blockedSymbols).toEqual(["AAPL", "TSLA"])
    expect(updated.maxOpenPositions).toBe(12)

    const reread = await mod.getTradingPolicy()
    expect(reread.maxPositionPct).toBe(20)
    expect(reread.blockedSymbols).toEqual(["AAPL", "TSLA"])
  })

  it("updateTradingPolicy rejette une mise à jour vide ou hors bornes", async () => {
    const mod = await loadModule()
    await expect(mod.updateTradingPolicy({})).rejects.toThrow()
    await expect(mod.updateTradingPolicy({ maxPositionPct: 0 })).rejects.toThrow()
    await expect(mod.updateTradingPolicy({ maxDrawdownPct: 95 })).rejects.toThrow()
  })
})

describe("trading-storage — ordres", () => {
  it("listTradingOrders retourne [] sur un magasin neuf", async () => {
    const { listTradingOrders } = await loadModule()
    await expect(listTradingOrders()).resolves.toEqual([])
  })

  it("placeTradingOrder exécute un achat marché et met à jour caisse et position", async () => {
    const mod = await loadModule()
    const order = await mod.placeTradingOrder({ symbol: "aapl", side: "buy", quantity: 2, type: "market" })
    expect(order.symbol).toBe("AAPL")
    expect(order.status).toBe("filled")
    expect(order.fillPriceCents).toBeGreaterThan(0)
    expect(order.notionalCents).toBe((order.fillPriceCents as number) * 2)

    const store = await mod.readTradingStore()
    expect(store.orders).toHaveLength(1)
    expect(store.cashCents).toBe(10_000_000 - order.notionalCents)
    expect(store.positions).toEqual([
      { symbol: "AAPL", quantity: 2, avgPriceCents: order.fillPriceCents },
    ])

    const audit = await readFile(path.join(tempRoot, "data", "trading-audit.ndjson"), "utf-8")
    expect(audit).toContain('"type":"order-executed"')
  })

  it("placeTradingOrder est idempotent : même clé, même ordre, aucun doublon", async () => {
    const mod = await loadModule()
    const input = { symbol: "MSFT", side: "buy" as const, quantity: 1, type: "market" as const }
    const first = await mod.placeTradingOrder(input, { idempotencyKey: "cle-123" })
    const second = await mod.placeTradingOrder(input, { idempotencyKey: "cle-123" })
    expect(second.id).toBe(first.id)

    const store = await mod.readTradingStore()
    expect(store.orders).toHaveLength(1)

    const audit = await readFile(path.join(tempRoot, "data", "trading-audit.ndjson"), "utf-8")
    expect(audit).toContain('"type":"order-idempotent-replay"')
  })

  it("placeTradingOrder rejette un ordre qui dépasse le notionnel maximal, sans toucher la caisse", async () => {
    const mod = await loadModule()
    const order = await mod.placeTradingOrder({ symbol: "AAPL", side: "buy", quantity: 100_000, type: "market" })
    expect(order.status).toBe("rejected")
    expect(order.reason).toBeTruthy()

    const store = await mod.readTradingStore()
    expect(store.cashCents).toBe(10_000_000)
    expect(store.positions).toEqual([])
  })

  it("placeTradingOrder rejette une entrée invalide (symbole vide)", async () => {
    const mod = await loadModule()
    await expect(
      mod.placeTradingOrder({ symbol: "", side: "buy", quantity: 1, type: "market" })
    ).rejects.toThrow()
  })

  it("getTradingQuotes nettoie les symboles et retourne [] sans symbole valide", async () => {
    const mod = await loadModule()
    await expect(mod.getTradingQuotes([])).resolves.toEqual([])
    await expect(mod.getTradingQuotes(["  "])).resolves.toEqual([])
    const quotes = await mod.getTradingQuotes(["aapl"])
    expect(quotes).toHaveLength(1)
    expect(quotes[0].symbol).toBe("AAPL")
    expect(quotes[0].priceCents).toBeGreaterThan(0)
  })
})
