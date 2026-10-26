import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  computeAutomaticHermesState,
  getHermesStatus,
  updateHermesStatus,
  resetHermesStatusToAuto,
} from "@/lib/hermes-status-storage"
import { GET, POST, PATCH } from "@/app/api/hermes/status/route"

describe("/api/hermes/status & hermes-status-storage", () => {
  beforeEach(() => {
    vi.stubEnv("HERMES_ENABLED", "true")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("computeAutomaticHermesState", () => {
    it("returns resting for weekends (e.g. Sunday afternoon)", () => {
      // 2026-10-25 is a Sunday
      const sunday = new Date("2026-10-25T14:00:00.000Z")
      const result = computeAutomaticHermesState(sunday)
      expect(result.state).toBe("resting")
      expect(result.label).toBe("Au repos")
    })

    it("returns idle for weekday trading hours (e.g. Wednesday 11h00 EDT)", () => {
      // 2026-10-28 is Wednesday, 15:00 UTC = 11:00 EDT
      const wednesdayDay = new Date("2026-10-28T15:00:00.000Z")
      const result = computeAutomaticHermesState(wednesdayDay)
      expect(result.state).toBe("idle")
      expect(result.label).toBe("En attente")
    })

    it("returns resting for weekday late night (e.g. Thursday 23h00 EDT)", () => {
      // 2026-10-29 03:00 UTC = 2026-10-28 23:00 EDT
      const wednesdayNight = new Date("2026-10-29T03:00:00.000Z")
      const result = computeAutomaticHermesState(wednesdayNight)
      expect(result.state).toBe("resting")
      expect(result.label).toBe("Au repos")
    })
  })

  describe("GET /api/hermes/status", () => {
    it("returns disabled status when HERMES_ENABLED is not true", async () => {
      vi.stubEnv("HERMES_ENABLED", "false")
      const res = await GET()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.enabled).toBe(false)
      expect(data.status.state).toBe("resting")
    })

    it("returns enabled status and valid state when HERMES_ENABLED=true", async () => {
      const res = await GET()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.enabled).toBe(true)
      expect(["working", "idle", "resting"]).toContain(data.status.state)
      expect(typeof data.status.label).toBe("string")
      expect(typeof data.status.detail).toBe("string")
    })
  })

  describe("POST /api/hermes/status", () => {
    it("updates status to working and persists", async () => {
      const req = new Request("http://localhost/api/hermes/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: "working",
          detail: "Analyse active des 13 actions (Nemotron RTX 3080 Ti)",
          mode: "manual",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.status.state).toBe("working")
      expect(data.status.label).toBe("Au travail")
      expect(data.status.detail).toBe("Analyse active des 13 actions (Nemotron RTX 3080 Ti)")
    })

    it("supports reset_auto to return to automatic schedule", async () => {
      const req = new Request("http://localhost/api/hermes/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reset_auto" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.status.mode).toBe("auto")
    })

    it("returns 400 for invalid payload", async () => {
      const req = new Request("http://localhost/api/hermes/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: "invalid_state_xyz" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toBe("invalid_payload")
    })
  })
})
