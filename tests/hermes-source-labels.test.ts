import { describe, expect, it } from "vitest"
import {
  HERMES_BRIEFING_SOURCE_LABELS,
  hermesBriefingSourceLabel,
} from "@/lib/hermes-types"

/**
 * Les deux agents d'Alex s'appellent « Nova » : l'agent local (propulsé
 * par Hermes) et l'assistante Muse infonuagique. Les libellés
 * d'affichage verrouillés ici lèvent l'ambiguïté dans la section
 * Briefings ; les valeurs d'API restent « hermes » et « nova ».
 */
describe("libellés d'affichage des sources de briefings", () => {
  it("distingue les deux agents nommés Nova", () => {
    expect(hermesBriefingSourceLabel("nova")).toBe("Nova · Muse")
    expect(hermesBriefingSourceLabel("hermes")).toBe("Nova · Hermes (local)")
  })

  it("couvre exactement les deux sources de l'API, sans collision", () => {
    expect(Object.keys(HERMES_BRIEFING_SOURCE_LABELS).sort()).toEqual([
      "hermes",
      "nova",
    ])
    expect(HERMES_BRIEFING_SOURCE_LABELS.nova).not.toBe(
      HERMES_BRIEFING_SOURCE_LABELS.hermes
    )
  })
})
