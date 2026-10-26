import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  computeAutomaticHermesState,
  computeAutomaticMuseState,
  getHermesStatus,
  getMuseState,
  updateAgentStatus,
  resetAgentStatusToAuto,
} from "@/lib/hermes-status-storage"
import { GET, POST, PATCH } from "@/app/api/hermes/status/route"

describe("/api/hermes/status & hermes-status-storage (Hermes × Muse)", () => {
  beforeEach(() => {
    vi.stubEnv("HERMES_ENABLED", "true")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("computeAutomaticHermesState", () => {
    it("returns resting for weekends (e.g. Sunday afternoon)", () => {
      const sunday = new Date("2026-10-25T14:00:00.000Z")
      const result = computeAutomaticHermesState(sunday)
      expect(result.state).toBe("resting")
      expect(result.label).toBe("Au repos")
    })

    it("returns idle for weekday trading hours (e.g. Wednesday 11h00 EDT)", () => {
      const wednesdayDay = new Date("2026-10-28T15:00:00.000Z")
      const result = computeAutomaticHermesState(wednesdayDay)
      expect(result.state).toBe("idle")
      expect(result.label).toBe("En attente")
    })

    it("returns resting for weekday late night (e.g. Thursday 23h00 EDT)", () => {
      const wednesdayNight = new Date("2026-10-29T03:00:00.000Z")
      const result = computeAutomaticHermesState(wednesdayNight)
      expect(result.state).toBe("resting")
      expect(result.label).toBe("Au repos")
    })
  })

  describe("computeAutomaticMuseState", () => {
    it("returns resting for weekends", () => {
      const sunday = new Date("2026-10-25T14:00:00.000Z")
      const result = computeAutomaticMuseState(sunday)
      expect(result.state).toBe("resting")
      expect(result.label).toBe("Au repos")
      expect(result.nextRun).toBe("Lundi 08:05 EDT")
    })

    it("returns working during morning pre-market window (e.g. 08h05 EDT / 12h05 UTC)", () => {
      const wednesdayMorning = new Date("2026-10-28T12:05:00.000Z")
      const result = computeAutomaticMuseState(wednesdayMorning)
      expect(result.state).toBe("working")
      expect(result.label).toBe("Au travail")
      expect(result.detail).toContain("pré-marché")
    })

    it("returns idle during trading session (e.g. 12h00 EDT / 16h00 UTC)", () => {
      const wednesdayNoon = new Date("2026-10-28T16:00:00.000Z")
      const result = computeAutomaticMuseState(wednesdayNoon)
      expect(result.state).toBe("idle")
      expect(result.label).toBe("En attente")
      expect(result.detail).toContain("observation")
    })

    it("returns working during market close window (e.g. 16h35 EDT / 20h35 UTC)", () => {
      const wednesdayClose = new Date("2026-10-28T20:35:00.000Z")
      const result = computeAutomaticMuseState(wednesdayClose)
      expect(result.state).toBe("working")
      expect(result.label).toBe("Au travail")
      expect(result.detail).toContain("clôture")
    })

    it("returns resting after market close (e.g. 21h00 EDT / 01h00 UTC)", () => {
      const wednesdayNight = new Date("2026-10-29T01:00:00.000Z")
      const result = computeAutomaticMuseState(wednesdayNight)
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
      expect(data.hermes.state).toBe("resting")
      expect(data.muse.state).toBe("resting")
    })

    it("returns both hermes and muse states when enabled", async () => {
      const res = await GET()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.enabled).toBe(true)
      expect(data.hermes).toBeDefined()
      expect(data.muse).toBeDefined()
      expect(["working", "idle", "resting"]).toContain(data.hermes.state)
      expect(["working", "idle", "resting"]).toContain(data.muse.state)
    })
  })

  describe("POST /api/hermes/status", () => {
    it("updates Hermes status to working", async () => {
      const req = new Request("http://localhost/api/hermes/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: "hermes",
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
    })

    it("updates Muse status to working and persists independently", async () => {
      const req = new Request("http://localhost/api/hermes/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: "muse",
          state: "working",
          detail: "Rédaction d'un flash urgent sur les taux (Meta AI)",
          mode: "manual",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.muse.state).toBe("working")
      expect(data.muse.label).toBe("Au travail")
      expect(data.muse.detail).toBe("Rédaction d'un flash urgent sur les taux (Meta AI)")
    })

    it("supports reset_auto for muse", async () => {
      const req = new Request("http://localhost/api/hermes/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: "muse", action: "reset_auto" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.muse.mode).toBe("auto")
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
