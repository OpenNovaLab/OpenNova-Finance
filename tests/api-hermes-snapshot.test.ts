import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  readPortfolioSyncStore: vi.fn(),
}))

vi.mock("@/lib/portfolio-sync-storage", () => ({
  readPortfolioSyncStore: mocks.readPortfolioSyncStore,
}))

import { GET } from "@/app/api/hermes/snapshot/route"

const TEST_KEY = "hermes-test-key-0123456789abcdef"

const sampleState = {
  version: 2 as const,
  accounts: [
    {
      id: "acc-1",
      title: "Principal",
      balanceCents: 123_00,
      type: "investment" as const,
    },
  ],
  transactions: [],
  goals: [],
  stockActions: [
    {
      id: "sa-1",
      symbol: "VRT",
      action: "buy" as const,
      shares: 5,
      priceCents: 20_000,
      tradeDateIso: "2026-10-01T15:00:00.000Z",
      status: "executed" as const,
    },
    {
      id: "sa-2",
      symbol: "MDA",
      action: "buy" as const,
      shares: 20,
      priceCents: 1_500,
      tradeDateIso: "2026-10-02T15:00:00.000Z",
      status: "executed" as const,
    },
    {
      id: "sa-3",
      symbol: "VRT",
      action: "buy" as const,
      shares: 2,
      priceCents: 21_000,
      tradeDateIso: "2026-10-03T15:00:00.000Z",
      status: "executed" as const,
    },
  ],
  lastSaved: "2026-10-24T17:00:00.000Z",
}

const getSnapshot = (headers: Record<string, string> = {}) =>
  GET(new Request("http://localhost/api/hermes/snapshot", { headers }))

describe("/api/hermes/snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("HERMES_BRIDGE_KEY", TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejette sans clé de service (401)", async () => {
    const response = await getSnapshot()
    expect(response.status).toBe(401)
    expect(mocks.readPortfolioSyncStore).not.toHaveBeenCalled()
  })

  it("rejette une mauvaise clé (401)", async () => {
    const response = await getSnapshot({ "x-hermes-key": "mauvaise-cle-000000000" })
    expect(response.status).toBe(401)
    expect(mocks.readPortfolioSyncStore).not.toHaveBeenCalled()
  })

  it("retourne 503 si la clé n'est pas configurée côté serveur", async () => {
    vi.stubEnv("HERMES_BRIDGE_KEY", "")
    const response = await getSnapshot({ "x-hermes-key": TEST_KEY })
    expect(response.status).toBe(503)
  })

  it("retourne hasState=false quand aucun état n'est synchronisé", async () => {
    mocks.readPortfolioSyncStore.mockResolvedValue({ users: {} })
    const response = await getSnapshot({ "x-hermes-key": TEST_KEY })
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { hasState: boolean; state: unknown }
    expect(payload.hasState).toBe(false)
    expect(payload.state).toBeNull()
  })

  it("retourne l'état synchronisé et les symboles dédupliqués (mono-utilisateur)", async () => {
    mocks.readPortfolioSyncStore.mockResolvedValue({ users: { "hash-utilisateur": sampleState } })
    const response = await getSnapshot({ "x-hermes-key": TEST_KEY })
    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      hasState: boolean
      state: typeof sampleState
      symboles: string[]
    }
    expect(payload.hasState).toBe(true)
    expect(payload.state.accounts).toHaveLength(1)
    expect(payload.symboles).toEqual(["MDA", "VRT"])
  })

  it("refuse de deviner si plusieurs utilisateurs sont présents (409)", async () => {
    mocks.readPortfolioSyncStore.mockResolvedValue({
      users: { "hash-1": sampleState, "hash-2": sampleState },
    })
    const response = await getSnapshot({ "x-hermes-key": TEST_KEY })
    expect(response.status).toBe(409)
  })
})
