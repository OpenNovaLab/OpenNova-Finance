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

export const hermesBriefingMetadataSchema = z
  .object({
    source: z.string().min(1).max(80).optional(),
    modele: z.string().min(1).max(80).optional(),
    genereLe: z.string().datetime({ offset: true }).optional(),
    symboles: z.array(z.string().min(1).max(24)).max(100).optional(),
  })
  .strict()

export const hermesBriefingInputSchema = z
  .object({
    date: z
      .string()
      .regex(HERMES_BRIEFING_DATE_REGEX, "La date doit suivre le format AAAA-MM-JJ."),
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

/** Nombre maximal de briefings conservés dans l'historique. */
export const HERMES_BRIEFINGS_HISTORY_LIMIT = 30
