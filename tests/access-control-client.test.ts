import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { validateAccessKeyWithService } from "@/lib/access-control-client"

const originalUrl = process.env.ACCESS_CONTROL_URL
const originalSecret = process.env.ACCESS_CONTROL_CLIENT_SECRET

const restoreEnv = () => {
  if (originalUrl === undefined) delete process.env.ACCESS_CONTROL_URL
  else process.env.ACCESS_CONTROL_URL = originalUrl
  if (originalSecret === undefined) delete process.env.ACCESS_CONTROL_CLIENT_SECRET
  else process.env.ACCESS_CONTROL_CLIENT_SECRET = originalSecret
}

const jsonResponse = (ok: boolean, payload: unknown) =>
  ({
    ok,
    json: async () => payload,
  }) as Response

beforeEach(() => {
  delete process.env.ACCESS_CONTROL_URL
  delete process.env.ACCESS_CONTROL_CLIENT_SECRET
})

afterEach(() => {
  vi.unstubAllGlobals()
  restoreEnv()
})

describe("validateAccessKeyWithService", () => {
  it("sans URL de service : erreur missing_access_service_url, aucun appel réseau", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(validateAccessKeyWithService("ma-cle")).resolves.toEqual({
      ok: false,
      error: "missing_access_service_url",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("appelle POST /api/validate avec la clé et le secret client (barre oblique finale retirée)", async () => {
    process.env.ACCESS_CONTROL_URL = "https://access.example/"
    process.env.ACCESS_CONTROL_CLIENT_SECRET = "secret-client"
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(true, { ok: true, keyId: "key-1", type: "permanent", expiresAt: null })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await validateAccessKeyWithService("cle-brute")
    expect(result).toEqual({ ok: true, keyId: "key-1", type: "permanent", expiresAt: null })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://access.example/api/validate")
    expect(init.method).toBe("POST")
    expect(init.cache).toBe("no-store")
    expect(init.headers).toEqual({
      "content-type": "application/json",
      "x-access-client-secret": "secret-client",
    })
    expect(init.body).toBe(JSON.stringify({ key: "cle-brute" }))
  })

  it("sans secret client configuré : l'en-tête part vide", async () => {
    process.env.ACCESS_CONTROL_URL = "https://access.example"
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(true, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await validateAccessKeyWithService("cle")
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)["x-access-client-secret"]).toBe("")
  })

  it("réponse HTTP en échec avec erreur JSON : l'erreur du service est relayée", async () => {
    process.env.ACCESS_CONTROL_URL = "https://access.example"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(false, { error: "bad_key" })))
    await expect(validateAccessKeyWithService("cle")).resolves.toEqual({
      ok: false,
      error: "bad_key",
    })
  })

  it("réponse HTTP en échec sans champ error : repli validation_failed", async () => {
    process.env.ACCESS_CONTROL_URL = "https://access.example"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(false, {})))
    await expect(validateAccessKeyWithService("cle")).resolves.toEqual({
      ok: false,
      error: "validation_failed",
    })
  })

  it("réponse HTTP en échec au corps non-JSON : repli validation_failed", async () => {
    process.env.ACCESS_CONTROL_URL = "https://access.example"
    const broken = {
      ok: false,
      json: async () => {
        throw new Error("not json")
      },
    } as unknown as Response
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(broken))
    await expect(validateAccessKeyWithService("cle")).resolves.toEqual({
      ok: false,
      error: "validation_failed",
    })
  })
})
