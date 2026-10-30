import { createHash, timingSafeEqual } from "crypto"
import type { HermesBriefingSource } from "@/lib/hermes-types"

/**
 * Authentification des sources de briefings.
 *
 * Deux clés de service distinctes, une par source :
 * - HERMES_BRIDGE_KEY : le pont local (source « hermes ») ;
 * - NOVA_BRIDGE_KEY : l'assistante infonuagique d'Alex (source « nova »).
 *
 * La clé est transmise dans l'en-tête `x-bridge-key` (ou l'ancien
 * `x-hermes-key`, ou `Authorization: Bearer <clé>`). La source déclarée
 * dans un payload d'ingestion doit correspondre à la clé utilisée :
 * chaque clé est comparée à temps constant, sur les empreintes SHA-256
 * des valeurs, pour ne fuiter ni le contenu ni la longueur.
 */

const KEY_ENV_BY_SOURCE: Record<HermesBriefingSource, string> = {
  hermes: "HERMES_BRIDGE_KEY",
  nova: "NOVA_BRIDGE_KEY",
}

const SOURCES: HermesBriefingSource[] = ["hermes", "nova"]

/** Longueur minimale acceptée pour une clé configurée côté serveur. */
export const SERVICE_KEY_MIN_LENGTH = 16

export const readServiceKey = (request: Request): string | null => {
  for (const header of ["x-bridge-key", "x-hermes-key"]) {
    const value = request.headers.get(header)
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }

  const auth = request.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim()
    if (token.length > 0) {
      return token
    }
  }

  return null
}

export const getConfiguredServiceKey = (source: HermesBriefingSource): string | null => {
  const value = process.env[KEY_ENV_BY_SOURCE[source]]?.trim()
  if (!value || value.length < SERVICE_KEY_MIN_LENGTH) {
    return null
  }
  return value
}

/** Vrai si au moins une des deux clés de service est configurée. */
export const isAnyServiceKeyConfigured = (): boolean =>
  SOURCES.some((source) => getConfiguredServiceKey(source) !== null)

const sha256 = (value: string) => createHash("sha256").update(value, "utf-8").digest()

/**
 * Identifie la source à laquelle appartient la clé fournie, en
 * comparant à temps constant avec chaque clé configurée.
 * Retourne null si la clé est absente ou ne correspond à aucune source.
 */
export const matchServiceKeySource = (provided: string | null): HermesBriefingSource | null => {
  if (!provided) {
    return null
  }
  const providedDigest = sha256(provided)
  for (const source of SOURCES) {
    const configured = getConfiguredServiceKey(source)
    if (configured && timingSafeEqual(providedDigest, sha256(configured))) {
      return source
    }
  }
  return null
}
