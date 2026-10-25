import { access, mkdir, mkdtemp, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PortfolioSyncState } from "@/lib/portfolio-sync-types"

const originalCwd = process.cwd()
let tempRoot = ""

const loadModule = async () => {
  vi.resetModules()
  return import("@/lib/portfolio-sync-storage")
}

const makeState = (overrides: Partial<PortfolioSyncState> = {}): PortfolioSyncState => ({
  version: 2,
  accounts: [
    { id: "acc-1", title: "Compte chèque", balanceCents: 12_500, type: "checking" },
  ],
  transactions: [
    {
      id: "tx-1",
      title: "Paie",
      amountCents: 250_000,
      type: "incoming",
      category: "salaire",
      timestampIso: "2026-02-01T10:00:00.000Z",
      status: "completed",
    },
  ],
  goals: [],
  stockActions: [
    {
      id: "sa-1",
      symbol: "AAPL",
      action: "buy",
      shares: 2,
      priceCents: 19_000,
      tradeDateIso: "2026-02-01T10:00:00.000Z",
      status: "executed",
    },
  ],
  lastSaved: "2026-02-01T10:05:00.000Z",
  ...overrides,
})

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "opennova-portfolio-sync-"))
  process.chdir(tempRoot)
})

afterEach(() => {
  process.chdir(originalCwd)
})

describe("portfolio-sync-storage", () => {
  it("hashSyncKey produit le SHA-256 hexadécimal de la clé", async () => {
    const { hashSyncKey } = await loadModule()
    // Vecteur connu : sha256("test")
    expect(hashSyncKey("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    )
    expect(hashSyncKey("autre-cle")).not.toBe(hashSyncKey("test"))
    expect(hashSyncKey("test")).toBe(hashSyncKey("test"))
  })

  it("readPortfolioSyncStore crée le fichier et retourne un magasin vide au premier accès", async () => {
    const { readPortfolioSyncStore } = await loadModule()
    const store = await readPortfolioSyncStore()
    expect(store).toEqual({ users: {} })
    await expect(access(path.join(tempRoot, "data", "portfolio-sync.json"))).resolves.toBeUndefined()
  })

  it("readPortfolioSyncStore retourne un magasin vide si le JSON est invalide", async () => {
    const dataDir = path.join(tempRoot, "data")
    await mkdir(dataDir, { recursive: true })
    await writeFile(path.join(dataDir, "portfolio-sync.json"), "{json-invalide", "utf-8")

    const { readPortfolioSyncStore } = await loadModule()
    await expect(readPortfolioSyncStore()).resolves.toEqual({ users: {} })
  })

  it("readPortfolioSyncStore écarte les états utilisateur qui échouent la validation", async () => {
    const dataDir = path.join(tempRoot, "data")
    await mkdir(dataDir, { recursive: true })
    const valid = makeState()
    await writeFile(
      path.join(dataDir, "portfolio-sync.json"),
      JSON.stringify({
        users: {
          "user-valide": valid,
          "user-invalide": { version: 1, comptes: "nimporte quoi" },
        },
      }),
      "utf-8"
    )

    const { readPortfolioSyncStore } = await loadModule()
    const store = await readPortfolioSyncStore()
    expect(Object.keys(store.users)).toEqual(["user-valide"])
    expect(store.users["user-valide"]).toEqual(valid)
  })

  it("aller-retour set/get : l'état est rangé sous le haché de la clé, jamais en clair", async () => {
    const { getUserPortfolioState, setUserPortfolioState, readPortfolioSyncStore, hashSyncKey } =
      await loadModule()

    await expect(getUserPortfolioState("cle-inconnue")).resolves.toBeNull()

    const state = makeState()
    const returned = await setUserPortfolioState("ma-cle-secrete", state)
    expect(returned).toEqual(state)
    await expect(getUserPortfolioState("ma-cle-secrete")).resolves.toEqual(state)

    const store = await readPortfolioSyncStore()
    expect(Object.keys(store.users)).toEqual([hashSyncKey("ma-cle-secrete")])
  })

  it("deux clés distinctes restent isolées l'une de l'autre", async () => {
    const { getUserPortfolioState, setUserPortfolioState } = await loadModule()
    const stateA = makeState({ lastSaved: "2026-02-01T10:05:00.000Z" })
    const stateB = makeState({ lastSaved: "2026-03-01T09:00:00.000Z" })
    await setUserPortfolioState("cle-a", stateA)
    await setUserPortfolioState("cle-b", stateB)
    await expect(getUserPortfolioState("cle-a")).resolves.toEqual(stateA)
    await expect(getUserPortfolioState("cle-b")).resolves.toEqual(stateB)
  })

  it("setUserPortfolioState rejette un état invalide (version 1)", async () => {
    const { setUserPortfolioState } = await loadModule()
    const invalid = { ...makeState(), version: 1 } as unknown as PortfolioSyncState
    await expect(setUserPortfolioState("cle", invalid)).rejects.toThrow()
  })

  it("writePortfolioSyncStore normalise : les états invalides sont abandonnés à l'écriture", async () => {
    const { writePortfolioSyncStore, readPortfolioSyncStore } = await loadModule()
    const mixed = {
      users: {
        bon: makeState(),
        mauvais: { version: 99 },
      },
    } as unknown as Parameters<typeof writePortfolioSyncStore>[0]
    await writePortfolioSyncStore(mixed)
    const store = await readPortfolioSyncStore()
    expect(Object.keys(store.users)).toEqual(["bon"])
  })
})
