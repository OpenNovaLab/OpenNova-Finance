import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  upsertHermesBriefing: vi.fn(),
  listHermesBriefings: vi.fn(),
}))

vi.mock("@/lib/hermes-briefings-storage", () => ({
  upsertHermesBriefing: mocks.upsertHermesBriefing,
  listHermesBriefings: mocks.listHermesBriefings,
}))

import { GET, POST } from "@/app/api/hermes/briefings/route"

const TEST_KEY = "hermes-test-key-0123456789abcdef"

const validBriefing = {
  date: "2026-10-25",
  titre: "Briefing Hermes du 2026-10-25",
  contenuMarkdown: "# Briefing du 2026-10-25\n\n## Vue d'ensemble\n\nSynthèse factuelle.",
  metadonnees: {
    source: "hermes-bridge 1.0",
    modele: "nemotron-3.5-bolt:e4b",
    genereLe: "2026-10-25T12:30:00.000Z",
    symboles: ["EXEMPLE"],
  },
}

const storedBriefing = {
  ...validBriefing,
  id: "hermes-2026-10-25",
  recuLe: "2026-10-25T12:30:05.000Z",
}

const postBriefing = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/hermes/briefings", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

describe("/api/hermes/briefings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("HERMES_ENABLED", "true")
    vi.stubEnv("HERMES_BRIDGE_KEY", TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejette un POST sans clé de service (401)", async () => {
    const response = await postBriefing(validBriefing)
    expect(response.status).toBe(401)
    expect(mocks.upsertHermesBriefing).not.toHaveBeenCalled()
  })

  it("rejette un POST avec une mauvaise clé (401)", async () => {
    const response = await postBriefing(validBriefing, { "x-hermes-key": "mauvaise-cle-000000000" })
    expect(response.status).toBe(401)
    expect(mocks.upsertHermesBriefing).not.toHaveBeenCalled()
  })

  it("accepte la clé via Authorization: Bearer", async () => {
    mocks.upsertHermesBriefing.mockResolvedValueOnce({ briefing: storedBriefing, replaced: false })
    const response = await postBriefing(validBriefing, {
      authorization: `Bearer ${TEST_KEY}`,
    })
    expect(response.status).toBe(201)
  })

  it("retourne 503 si la clé n'est pas configurée côté serveur", async () => {
    vi.stubEnv("HERMES_BRIDGE_KEY", "")
    const response = await postBriefing(validBriefing, { "x-hermes-key": TEST_KEY })
    expect(response.status).toBe(503)
    expect(mocks.upsertHermesBriefing).not.toHaveBeenCalled()
  })

  it("rejette un corps JSON invalide (400)", async () => {
    const response = await postBriefing("{ pas du json", { "x-hermes-key": TEST_KEY })
    expect(response.status).toBe(400)
    expect(mocks.upsertHermesBriefing).not.toHaveBeenCalled()
  })

  it("rejette un payload invalide (400) : date mal formée, titre absent, champ inconnu", async () => {
    const badDate = await postBriefing(
      { ...validBriefing, date: "25/10/2026" },
      { "x-hermes-key": TEST_KEY }
    )
    expect(badDate.status).toBe(400)

    const withoutTitle: Record<string, unknown> = { ...validBriefing }
    delete withoutTitle.titre
    const missingTitle = await postBriefing(withoutTitle, { "x-hermes-key": TEST_KEY })
    expect(missingTitle.status).toBe(400)

    const unknownField = await postBriefing(
      { ...validBriefing, champInconnu: true },
      { "x-hermes-key": TEST_KEY }
    )
    expect(unknownField.status).toBe(400)

    expect(mocks.upsertHermesBriefing).not.toHaveBeenCalled()
  })

  it("ingère un briefing valide (201) puis le relit via GET", async () => {
    mocks.upsertHermesBriefing.mockResolvedValueOnce({ briefing: storedBriefing, replaced: false })
    mocks.listHermesBriefings.mockResolvedValue([storedBriefing])

    const postResponse = await postBriefing(validBriefing, { "x-hermes-key": TEST_KEY })
    expect(postResponse.status).toBe(201)
    expect(mocks.upsertHermesBriefing).toHaveBeenCalledWith(validBriefing)
    const postPayload = (await postResponse.json()) as { ok: boolean; replaced: boolean }
    expect(postPayload.ok).toBe(true)
    expect(postPayload.replaced).toBe(false)

    const getResponse = await GET()
    expect(getResponse.status).toBe(200)
    const getPayload = (await getResponse.json()) as {
      latest: typeof storedBriefing | null
      history: (typeof storedBriefing)[]
    }
    expect(getPayload.latest?.id).toBe("hermes-2026-10-25")
    expect(getPayload.history).toHaveLength(1)
  })

  it("signale un remplacement (200) quand la date existe déjà", async () => {
    mocks.upsertHermesBriefing.mockResolvedValueOnce({ briefing: storedBriefing, replaced: true })
    const response = await postBriefing(validBriefing, { "x-hermes-key": TEST_KEY })
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { replaced: boolean }
    expect(payload.replaced).toBe(true)
  })

  it("instance désactivée (hybride) : POST propre 503 hermes_disabled, GET dégradé sans erreur", async () => {
    vi.stubEnv("HERMES_ENABLED", "")

    const postResponse = await postBriefing(validBriefing, { "x-hermes-key": TEST_KEY })
    expect(postResponse.status).toBe(503)
    const postPayload = (await postResponse.json()) as { error: string }
    expect(postPayload.error).toBe("hermes_disabled")
    expect(mocks.upsertHermesBriefing).not.toHaveBeenCalled()

    const getResponse = await GET()
    expect(getResponse.status).toBe(200)
    const getPayload = (await getResponse.json()) as {
      enabled: boolean
      latest: unknown
      history: unknown[]
    }
    expect(getPayload.enabled).toBe(false)
    expect(getPayload.latest).toBeNull()
    expect(getPayload.history).toEqual([])
    expect(mocks.listHermesBriefings).not.toHaveBeenCalled()
  })

  it("GET retourne latest=null et un historique vide quand rien n'a été reçu", async () => {
    mocks.listHermesBriefings.mockResolvedValue([])
    const response = await GET()
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { latest: unknown; history: unknown[] }
    expect(payload.latest).toBeNull()
    expect(payload.history).toEqual([])
  })
})
