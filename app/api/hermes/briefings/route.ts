import { NextResponse } from "next/server"
import {
  isHermesBridgeConfigured,
  isValidHermesKey,
  readHermesKey,
} from "@/lib/hermes-auth"
import {
  listHermesBriefings,
  upsertHermesBriefing,
} from "@/lib/hermes-briefings-storage"
import { hermesBriefingInputSchema } from "@/lib/hermes-types"

/**
 * Briefings Hermes (phase 1 de l'intégration Hermes × OpenNova-Finance).
 *
 * POST — ingestion par le pont local (tools/hermes-bridge/), authentifiée
 * par la clé de service HERMES_BRIDGE_KEY. Le middleware exempte ce POST
 * précis de la session navigateur : la clé de service fait foi ici.
 *
 * GET — lecture pour l'interface (dernier briefing + historique récent).
 * Protégé par la session d'accès, comme les autres routes de l'UI.
 */

const HISTORY_RESPONSE_LIMIT = 10

const notConfigured = () =>
  NextResponse.json(
    {
      ok: false,
      error: "hermes_not_configured",
      message:
        "Le pont Hermes n'est pas configuré côté serveur (variable HERMES_BRIDGE_KEY absente ou trop courte).",
    },
    { status: 503 }
  )

const unauthorized = () =>
  NextResponse.json(
    {
      ok: false,
      error: "unauthorized",
      message: "Clé de service Hermes absente ou invalide.",
    },
    { status: 401 }
  )

export const POST = async (request: Request) => {
  if (!isHermesBridgeConfigured()) {
    return notConfigured()
  }
  if (!isValidHermesKey(readHermesKey(request))) {
    return unauthorized()
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Corps JSON invalide." },
      { status: 400 }
    )
  }

  const parsed = hermesBriefingInputSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        message: "Briefing invalide.",
        details: parsed.error.issues.slice(0, 3).map((issue) => issue.message),
      },
      { status: 400 }
    )
  }

  const { briefing, replaced } = await upsertHermesBriefing(parsed.data)
  return NextResponse.json({ ok: true, briefing, replaced }, { status: replaced ? 200 : 201 })
}

export const GET = async () => {
  const briefings = await listHermesBriefings(HISTORY_RESPONSE_LIMIT)
  return NextResponse.json(
    {
      ok: true,
      latest: briefings[0] ?? null,
      history: briefings,
    },
    { status: 200 }
  )
}
