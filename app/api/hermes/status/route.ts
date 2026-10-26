import { NextResponse } from "next/server"
import { isHermesEnabled } from "@/lib/hermes-config"
import {
  getHermesStatus,
  getMuseState,
  updateAgentStatus,
  resetAgentStatusToAuto,
  hermesStatusUpdateInputSchema,
  type AgentStatus,
} from "@/lib/hermes-status-storage"

export const GET = async () => {
  if (!isHermesEnabled()) {
    const disabledStatus = (agent: "hermes" | "muse"): AgentStatus => ({
      agent,
      state: "resting",
      label: "Au repos",
      detail: "Disponible sur l'instance locale seulement",
      hardware: agent === "hermes" ? "RTX 3080 Ti (12GB) · Nemotron 3.5" : "Serveurs Meta AI",
      model: agent === "hermes" ? "Nemotron 3.5" : "Meta AI · Llama 3.3",
      mode: "auto",
      updatedAt: new Date().toISOString(),
    })
    const hermes = disabledStatus("hermes")
    const muse = disabledStatus("muse")
    return NextResponse.json(
      {
        ok: true,
        enabled: false,
        status: hermes,
        hermes,
        muse,
      },
      { status: 200 }
    )
  }

  const [hermes, muse] = await Promise.all([getHermesStatus(), getMuseState()])
  return NextResponse.json(
    {
      ok: true,
      enabled: true,
      status: hermes,
      hermes,
      muse,
    },
    { status: 200 }
  )
}

export const POST = async (request: Request) => {
  if (!isHermesEnabled()) {
    return NextResponse.json(
      { ok: false, error: "hermes_disabled", message: "Fonctionnalité désactivée sur cette instance." },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Corps JSON invalide." },
      { status: 400 }
    )
  }

  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const targetAgent: "hermes" | "muse" = record.agent === "muse" ? "muse" : "hermes"

  // Action spéciale : repasser en mode automatique
  if (record.action === "reset_auto") {
    if (record.agent === "all") {
      const [hermes, muse] = await Promise.all([
        resetAgentStatusToAuto("hermes"),
        resetAgentStatusToAuto("muse"),
      ])
      return NextResponse.json({ ok: true, status: hermes, hermes, muse }, { status: 200 })
    }
    const updated = await resetAgentStatusToAuto(targetAgent)
    return NextResponse.json({ ok: true, status: updated, [targetAgent]: updated }, { status: 200 })
  }

  const parsed = hermesStatusUpdateInputSchema.safeParse(record)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        message: "Données de statut invalides.",
        details: parsed.error.issues.map((i) => i.message),
      },
      { status: 400 }
    )
  }

  const updated = await updateAgentStatus(targetAgent, parsed.data)
  return NextResponse.json({ ok: true, status: updated, [targetAgent]: updated }, { status: 200 })
}

export const PATCH = POST
