import { describe, expect, it } from "vitest"
import { signSession, verifySession } from "@/lib/access-session"

describe("access session", () => {
  it("signe et vérifie un token", async () => {
    const token = await signSession(
      { keyId: "abc", type: "permanent", iat: Date.now(), exp: Date.now() + 60_000 },
      "secret-test",
    )

    const payload = await verifySession(token, "secret-test")
    expect(payload?.keyId).toBe("abc")
  })

  it("rejette un token expiré", async () => {
    const token = await signSession(
      { keyId: "abc", type: "temporary", iat: Date.now() - 10_000, exp: Date.now() - 1_000 },
      "secret-test",
    )

    const payload = await verifySession(token, "secret-test")
    expect(payload).toBeNull()
  })

  it("rejette une signature falsifiée", async () => {
    const token = await signSession(
      { keyId: "abc", type: "permanent", iat: Date.now(), exp: Date.now() + 60_000 },
      "secret-test",
    )

    const [payloadB64, signature] = token.split(".")
    const forged = `${payloadB64}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`
    expect(await verifySession(forged, "secret-test")).toBeNull()
    expect(await verifySession(token, "autre-secret")).toBeNull()
  })

  it("retourne null (sans lever) pour un payload non-JSON correctement signé", async () => {
    const secret = "secret-test"
    const payloadB64 = Buffer.from("pas-du-json", "utf8").toString("base64url")
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64))
    const signature = Buffer.from(new Uint8Array(sig)).toString("base64url")

    expect(await verifySession(`${payloadB64}.${signature}`, secret)).toBeNull()
  })
})
