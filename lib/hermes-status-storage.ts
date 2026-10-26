import { promises as fs } from "fs"
import path from "path"
import { z } from "zod"

export const hermesOperationalStateSchema = z.enum(["working", "idle", "resting"])
export type HermesOperationalState = z.infer<typeof hermesOperationalStateSchema>

export const hermesStatusSchema = z.object({
  state: hermesOperationalStateSchema,
  label: z.string(),
  detail: z.string(),
  lastRun: z.string().optional(),
  nextRun: z.string().optional(),
  hardware: z.string().default("RTX 3080 Ti (12GB) · Nemotron 3.5"),
  mode: z.enum(["auto", "manual"]).default("auto"),
  updatedAt: z.string(),
})

export type HermesStatus = z.infer<typeof hermesStatusSchema>

export const hermesStatusUpdateInputSchema = z.object({
  state: hermesOperationalStateSchema.optional(),
  detail: z.string().max(300).optional(),
  lastRun: z.string().optional(),
  nextRun: z.string().optional(),
  hardware: z.string().max(100).optional(),
  mode: z.enum(["auto", "manual"]).optional(),
})

export type HermesStatusUpdateInput = z.infer<typeof hermesStatusUpdateInputSchema>

const DATA_DIR = path.join(process.cwd(), "data")
const STATUS_PATH = path.join(DATA_DIR, "hermes-status.json")

export const HERMES_STATE_LABELS: Record<HermesOperationalState, string> = {
  working: "Au travail",
  idle: "En attente",
  resting: "Au repos",
}

/**
 * Calcule l'état automatique d'Hermes selon l'heure de Montréal (EDT/EST)
 * et les heures d'ouverture des marchés (08:00 à 17:30 lun-ven).
 */
export function computeAutomaticHermesState(now: Date = new Date()): {
  state: HermesOperationalState
  label: string
  detail: string
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon"
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12", 10)
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10)
    const timeDecimal = hour + minute / 60

    const isWeekend = weekday === "Sat" || weekday === "Sun"
    if (isWeekend) {
      return {
        state: "resting",
        label: HERMES_STATE_LABELS.resting,
        detail: "Marchés clôturés (week-end) · En veille passive",
      }
    }

    if (timeDecimal >= 8.0 && timeDecimal <= 17.5) {
      return {
        state: "idle",
        label: HERMES_STATE_LABELS.idle,
        detail: "Marchés ouverts · Surveillance active aux 15 min",
      }
    }

    return {
      state: "resting",
      label: HERMES_STATE_LABELS.resting,
      detail: "Marchés clôturés · Mode repos nocturne",
    }
  } catch {
    return {
      state: "idle",
      label: HERMES_STATE_LABELS.idle,
      detail: "Surveillance active des 13 actions",
    }
  }
}

/**
 * Lit l'état d'Hermes en combinant le fichier de persistance et la logique horaire.
 */
export async function getHermesStatus(): Promise<HermesStatus> {
  const auto = computeAutomaticHermesState()
  let stored: Partial<HermesStatus> | null = null

  try {
    const raw = await fs.readFile(STATUS_PATH, "utf-8")
    stored = JSON.parse(raw) as Partial<HermesStatus>
  } catch {
    stored = null
  }

  const now = new Date()

  // 1. Mode manuel forcé
  if (stored?.mode === "manual" && stored.state) {
    return {
      state: stored.state,
      label: HERMES_STATE_LABELS[stored.state] ?? stored.state,
      detail: stored.detail ?? (stored.state === "working" ? "Analyse forcée en cours" : "Mode manuel actif"),
      lastRun: stored.lastRun,
      nextRun: stored.nextRun ?? "~15 min",
      hardware: stored.hardware ?? "RTX 3080 Ti (12GB) · Nemotron 3.5",
      mode: "manual",
      updatedAt: stored.updatedAt ?? now.toISOString(),
    }
  }

  // 2. Scan actif récent (moins de 5 minutes)
  if (stored?.state === "working" && stored.updatedAt) {
    const diffMs = now.getTime() - new Date(stored.updatedAt).getTime()
    if (diffMs < 5 * 60 * 1000) {
      return {
        state: "working",
        label: HERMES_STATE_LABELS.working,
        detail: stored.detail || "Analyse active en cours sur RTX 3080 Ti (13 actions)",
        lastRun: stored.lastRun || stored.updatedAt,
        nextRun: stored.nextRun ?? "En cours",
        hardware: stored.hardware ?? "RTX 3080 Ti (12GB) · Nemotron 3.5",
        mode: "auto",
        updatedAt: stored.updatedAt,
      }
    }
  }

  // 3. État automatique selon marché
  return {
    state: auto.state,
    label: auto.label,
    detail: stored?.detail && stored?.mode !== "manual" ? stored.detail : auto.detail,
    lastRun: stored?.lastRun,
    nextRun: stored?.nextRun ?? (auto.state === "resting" ? "Demain 08:00 EDT" : "~15 min"),
    hardware: stored?.hardware ?? "RTX 3080 Ti (12GB) · Nemotron 3.5",
    mode: "auto",
    updatedAt: stored?.updatedAt ?? now.toISOString(),
  }
}

/**
 * Met à jour l'état d'Hermes et persiste dans data/hermes-status.json
 */
export async function updateHermesStatus(input: HermesStatusUpdateInput): Promise<HermesStatus> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const current = await getHermesStatus()

  const nextState = input.state ?? current.state
  const nextMode = input.mode ?? (input.state ? "manual" : current.mode)

  const updated: HermesStatus = {
    state: nextState,
    label: HERMES_STATE_LABELS[nextState] ?? nextState,
    detail: input.detail ?? (nextState === "working" ? "Analyse active sur RTX 3080 Ti" : current.detail),
    lastRun: input.lastRun ?? current.lastRun,
    nextRun: input.nextRun ?? current.nextRun,
    hardware: input.hardware ?? current.hardware,
    mode: nextMode,
    updatedAt: new Date().toISOString(),
  }

  await fs.writeFile(STATUS_PATH, JSON.stringify(updated, null, 2), "utf-8")
  return updated
}

/**
 * Réinitialise le mode manuel pour repasser en mode automatique
 */
export async function resetHermesStatusToAuto(): Promise<HermesStatus> {
  const auto = computeAutomaticHermesState()
  const current = await getHermesStatus()

  const updated: HermesStatus = {
    state: auto.state,
    label: auto.label,
    detail: auto.detail,
    lastRun: current.lastRun,
    nextRun: auto.state === "resting" ? "Demain 08:00 EDT" : "~15 min",
    hardware: current.hardware,
    mode: "auto",
    updatedAt: new Date().toISOString(),
  }

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(STATUS_PATH, JSON.stringify(updated, null, 2), "utf-8")
  return updated
}
