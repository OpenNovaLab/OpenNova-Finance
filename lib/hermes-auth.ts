import { createHash, timingSafeEqual } from "crypto"

/**
 * Authentification du pont local Hermes.
 *
 * Le pont s'authentifie avec une clé de service dédiée, transmise dans
 * l'en-tête `x-hermes-key` ou `Authorization: Bearer <clé>`. La clé
 * attendue est lue depuis la variable d'environnement HERMES_BRIDGE_KEY
 * (jamais dans le code). La comparaison est faite à temps constant sur
 * les empreintes SHA-256 des deux valeurs, pour ne fuiter ni le contenu
 * ni la longueur de la clé.
 */

export const HERMES_BRIDGE_KEY_ENV = "HERMES_BRIDGE_KEY"

/** Longueur minimale acceptée pour la clé configurée côté serveur. */
export const HERMES_BRIDGE_KEY_MIN_LENGTH = 16

export const readHermesKey = (request: Request): string | null => {
  const fromHeader = request.headers.get("x-hermes-key")
  if (fromHeader && fromHeader.trim().length > 0) {
    return fromHeader.trim()
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

export const getConfiguredHermesKey = (): string | null => {
  const value = process.env[HERMES_BRIDGE_KEY_ENV]?.trim()
  if (!value || value.length < HERMES_BRIDGE_KEY_MIN_LENGTH) {
    return null
  }
  return value
}

export const isHermesBridgeConfigured = (): boolean => getConfiguredHermesKey() !== null

const sha256 = (value: string) => createHash("sha256").update(value, "utf-8").digest()

/** Comparaison à temps constant entre la clé fournie et la clé configurée. */
export const isValidHermesKey = (provided: string | null): boolean => {
  const configured = getConfiguredHermesKey()
  if (!configured || !provided) {
    return false
  }
  return timingSafeEqual(sha256(provided), sha256(configured))
}
