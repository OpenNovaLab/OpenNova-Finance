import { NextResponse } from "next/server"
import {
  isAnyServiceKeyConfigured,
  matchServiceKeySource,
  readServiceKey,
} from "@/lib/hermes-auth"
import {
  addHermesBriefingComment,
  listHermesBriefings,
  toggleHermesBriefingReaction,
  upsertHermesBriefing,
} from "@/lib/hermes-briefings-storage"
import { isHermesEnabled } from "@/lib/hermes-config"
import { hermesBriefingInputSchema } from "@/lib/hermes-types"

/**
 * Briefings & Feed Boursier Hermes (intégration Hermes × OpenNova-Finance).
 *
 * POST — ingestion des briefings/posts par Hermes local et Nova infonuagique.
 * GET — lecture du flux boursier complet pour l'interface.
 * PATCH — réactions interactives (bullish, bearish, insightful) et commentaires.
 */

const HISTORY_RESPONSE_LIMIT = 50

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

export const PATCH = async (request: Request) => {
  if (!isHermesEnabled()) {
    return disabled()
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

  const payload = body as {
    id?: unknown
    action?: unknown
    reaction?: unknown
    comment?: unknown
  }

  if (typeof payload.id !== "string" || !payload.id) {
    return NextResponse.json(
      { ok: false, error: "missing_id", message: "Identifiant du post requis." },
      { status: 400 }
    )
  }

  if (
    payload.action === "react" &&
    (payload.reaction === "bullish" ||
      payload.reaction === "bearish" ||
      payload.reaction === "insightful")
  ) {
    const updated = await toggleHermesBriefingReaction(payload.id, payload.reaction)
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "Post introuvable." },
        { status: 404 }
      )
    }
    return NextResponse.json({ ok: true, briefing: updated })
  }

  if (
    payload.action === "comment" &&
    payload.comment &&
    typeof payload.comment === "object" &&
    "text" in payload.comment &&
    typeof (payload.comment as { text: unknown }).text === "string"
  ) {
    const commentObj = payload.comment as { author?: unknown; text: string }
    const author = typeof commentObj.author === "string" && commentObj.author.trim() ? commentObj.author.trim() : "Alex"
    const text = commentObj.text.trim()
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "empty_comment", message: "Le commentaire ne peut être vide." },
        { status: 400 }
      )
    }
    const updated = await addHermesBriefingComment(payload.id, { author, text })
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "Post introuvable." },
        { status: 404 }
      )
    }
    return NextResponse.json({ ok: true, briefing: updated })
  }

  return NextResponse.json(
    { ok: false, error: "invalid_action", message: "Action non reconnue." },
    { status: 400 }
  )
}
