import { z } from "zod"

/**
 * Types et schémas de validation pour l'intégration Hermes (phase 1).
 *
 * Un « briefing » est une synthèse quotidienne en français produite par
 * l'agent local Hermes (via le pont local, dossier tools/hermes-bridge/)
 * et poussée dans l'application. Lecture et synthèse seulement : aucune
 * fonctionnalité de transaction n'existe dans ce périmètre.
 */

export const HERMES_BRIEFING_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Source d'un briefing : « hermes » (agent local d'Alex, via le pont
 * local) ou « nova » (l'assistante infonuagique d'Alex : macro,
 * résultats, point hebdomadaire). Chaque source s'authentifie avec sa
 * propre clé de service et ne peut publier que sous son nom.
 */
export const hermesBriefingSourceSchema = z.enum(["hermes", "nova"])
export type HermesBriefingSource = z.infer<typeof hermesBriefingSourceSchema>

/**
 * Libellés d'affichage des sources dans l'interface. Les deux agents
 * d'Alex s'appellent « Nova » : son agent local (propulsé par Hermes)
 * et son assistante Muse infonuagique. Ces libellés lèvent
 * l'ambiguïté ; les valeurs d'API restent « hermes » et « nova ».
 */
export const HERMES_BRIEFING_SOURCE_LABELS: Record<HermesBriefingSource, string> = {
  hermes: "Nova · Hermes (local)",
  nova: "Nova · Muse",
}

export function hermesBriefingSourceLabel(source: HermesBriefingSource): string {
  return HERMES_BRIEFING_SOURCE_LABELS[source]
}

export const hermesBriefingMetadataSchema = z
  .object({
    source: z.string().min(1).max(80).optional(),
    modele: z.string().min(1).max(80).optional(),
    genereLe: z.string().datetime({ offset: true }).optional(),
    symboles: z.array(z.string().min(1).max(24)).max(100).optional(),
    category: z.enum(["news", "earnings", "macro", "analysis", "alert"]).optional(),
    sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
    urlSource: z.string().max(500).optional(),
    reactions: z.record(z.string(), z.number()).optional(),
    comments: z
      .array(
        z.object({
          id: z.string(),
          author: z.string(),
          text: z.string().max(1000),
          date: z.string(),
        })
      )
      .max(100)
      .optional(),
  })
  .strict()

export const hermesBriefingInputSchema = z
  .object({
    id: z.string().min(1).max(120).optional(),
    date: z
      .string()
      .regex(HERMES_BRIEFING_DATE_REGEX, "La date doit suivre le format AAAA-MM-JJ."),
    source: hermesBriefingSourceSchema,
    titre: z.string().min(1).max(200),
    contenuMarkdown: z.string().min(1).max(50_000),
    metadonnees: hermesBriefingMetadataSchema.optional(),
  })
  .strict()

export type HermesBriefingInput = z.infer<typeof hermesBriefingInputSchema>

export const hermesBriefingSchema = hermesBriefingInputSchema.extend({
  id: z.string().min(1).max(120),
  recuLe: z.string().datetime({ offset: true }),
})

export type HermesBriefing = z.infer<typeof hermesBriefingSchema>

export const hermesBriefingStoreSchema = z.object({
  briefings: z.array(hermesBriefingSchema).max(500),
})

export type HermesBriefingStore = z.infer<typeof hermesBriefingStoreSchema>

/** Nombre maximal de briefings conservés dans l'historique du feed. */
export const HERMES_BRIEFINGS_HISTORY_LIMIT = 100
