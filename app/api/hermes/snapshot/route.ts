import { NextResponse } from "next/server"
import {
  isHermesBridgeConfigured,
  isValidHermesKey,
  readHermesKey,
} from "@/lib/hermes-auth"
import { readPortfolioSyncStore } from "@/lib/portfolio-sync-storage"

/**
 * Instantané portefeuille en lecture seule, pour le pont local Hermes.
 *
 * Source : l'état synchronisé côté serveur (lib/portfolio-sync-storage),
 * c'est-à-dire l'état que le navigateur pousse via /api/portfolio quand la
 * synchronisation est activée. Les positions détaillées et la watchlist
 * vivent dans le navigateur (localStorage) : elles n'apparaissent ici que
 * si la synchronisation est active.
 *
 * Hypothèse documentée : application mono-utilisateur. Si le magasin de
 * synchronisation contient plus d'un utilisateur, l'instantané refuse de
 * deviner (409) plutôt que d'exposer les données du mauvais compte.
 * Authentification : clé de service HERMES_BRIDGE_KEY, comme l'ingestion.
 */

export const GET = async (request: Request) => {
  if (!isHermesBridgeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "hermes_not_configured",
        message:
          "Le pont Hermes n'est pas configuré côté serveur (variable HERMES_BRIDGE_KEY absente ou trop courte).",
      },
      { status: 503 }
    )
  }
  if (!isValidHermesKey(readHermesKey(request))) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Clé de service Hermes absente ou invalide.",
      },
      { status: 401 }
    )
  }

  const store = await readPortfolioSyncStore()
  const states = Object.values(store.users)
  const generatedAt = new Date().toISOString()

  if (states.length === 0) {
    return NextResponse.json(
      { ok: true, generatedAt, hasState: false, state: null, symboles: [] },
      { status: 200 }
    )
  }

  if (states.length > 1) {
    return NextResponse.json(
      {
        ok: false,
        error: "ambiguous_store",
        message:
          "Plusieurs états synchronisés présents : instantané impossible sans désignation explicite de l'utilisateur.",
      },
      { status: 409 }
    )
  }

  const state = states[0]
  const symboles = [...new Set(state.stockActions.map((action) => action.symbol))].sort()

  return NextResponse.json(
    { ok: true, generatedAt, hasState: true, state, symboles },
    { status: 200 }
  )
}
