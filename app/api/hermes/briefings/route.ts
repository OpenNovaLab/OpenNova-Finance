import { NextResponse } from "next/server"
import {
  isAnyServiceKeyConfigured,
  matchServiceKeySource,
  readServiceKey,
} from "@/lib/hermes-auth"
import {
  listHermesBriefings,
  upsertHermesBriefing,
} from "@/lib/hermes-briefings-storage"
import { isHermesEnabled } from "@/lib/hermes-config"
import { hermesBriefingInputSchema } from "@/lib/hermes-types"

/**
 * Briefings Hermes (phase 1 de l'intégration Hermes × OpenNova-Finance).
 *
 * POST — ingestion des briefings, par deux sources possibles : le pont
 * local (source « hermes », clé HERMES_BRIDGE_KEY) et l'assistante
 * infonuagique Nova (source « nova », clé NOVA_BRIDGE_KEY). La source
 * déclarée dans le payload doit correspondre à la clé utilisée, sinon
 * 403. Le middleware exempte ce POST précis de la session navigateur :
 * la clé de service fait foi ici.
 *
 * GET — lecture pour l'interface (dernier briefing + historique récent).
 * Protégé par la session d'accès, comme les autres routes de l'UI.
 */

const HISTORY_RESPONSE_LIMIT = 10

const disabled = () =>
  NextResponse.json(
    {
      ok: false,
      error: "hermes_disabled",
      message:
        "Les fonctions Hermes sont désactivées sur cette instance (disponibles sur l'instance locale seulement).",
    },
    { status: 503 }
  )

const notConfigured = () =>
  NextResponse.json(
    {
      ok: false,
      error: "hermes_not_configured",
      message:
        "Aucune clé de service n'est configurée côté serveur (HERMES_BRIDGE_KEY / NOVA_BRIDGE_KEY absentes ou trop courtes).",
    },
    { status: 503 }
  )

const unauthorized = () =>
  NextResponse.json(
    {
      ok: false,
      error: "unauthorized",
      message: "Clé de service absente ou invalide.",
    },
    { status: 401 }
  )

const sourceMismatch = () =>
  NextResponse.json(
    {
      ok: false,
      error: "source_mismatch",
      message: "La source déclarée ne correspond pas à la clé de service utilisée.",
    },
    { status: 403 }
  )

export const POST = async (request: Request) => {
  if (!isHermesEnabled()) {
    return disabled()
  }
  if (!isAnyServiceKeyConfigured()) {
    return notConfigured()
  }
  const keySource = matchServiceKeySource(readServiceKey(request))
  if (!keySource) {
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

  if (parsed.data.source !== keySource) {
    return sourceMismatch()
  }

  const { briefing, replaced } = await upsertHermesBriefing(parsed.data)
  return NextResponse.json({ ok: true, briefing, replaced }, { status: replaced ? 200 : 201 })
}

export const GET = async () => {
  if (!isHermesEnabled()) {
    // Dégradation propre : l'interface affiche l'état « instance locale
    // seulement » au lieu d'une erreur.
    return NextResponse.json(
      { ok: true, enabled: false, latest: null, history: [] },
      { status: 200 }
    )
  }
  const briefings = await listHermesBriefings(HISTORY_RESPONSE_LIMIT)
  return NextResponse.json(
    {
      ok: true,
      enabled: true,
      latest: briefings[0] ?? null,
      history: briefings,
    },
    { status: 200 }
  )
}
