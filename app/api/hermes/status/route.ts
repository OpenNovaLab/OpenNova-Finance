import { NextResponse } from "next/server"
import { isHermesEnabled } from "@/lib/hermes-config"
import {
  getHermesStatus,
  updateHermesStatus,
  resetHermesStatusToAuto,
  hermesStatusUpdateInputSchema,
  type HermesStatus,
} from "@/lib/hermes-status-storage"

export const GET = async () => {
  if (!isHermesEnabled()) {
    return NextResponse.json(
      {
        ok: true,
        enabled: false,
        status: {
          state: "resting",
          label: "Au repos",
          detail: "Disponible sur l'instance locale seulement",
          hardware: "RTX 3080 Ti (12GB) · Nemotron 3.5",
          mode: "auto",
          updatedAt: new Date().toISOString(),
        } satisfies HermesStatus,
      },
      { status: 200 }
    )
  }

  const status = await getHermesStatus()
  return NextResponse.json({ ok: true, enabled: true, status }, { status: 200 })
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

  // Action spéciale : repasser en mode automatique
  if (record.action === "reset_auto") {
    const status = await resetHermesStatusToAuto()
    return NextResponse.json({ ok: true, status }, { status: 200 })
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

  const status = await updateHermesStatus(parsed.data)
  return NextResponse.json({ ok: true, status }, { status: 200 })
}

export const PATCH = POST
