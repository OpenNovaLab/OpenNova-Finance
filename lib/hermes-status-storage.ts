import { promises as fs } from "fs"
import path from "path"
import { z } from "zod"

export const hermesOperationalStateSchema = z.enum(["working", "idle", "resting"])
export type HermesOperationalState = z.infer<typeof hermesOperationalStateSchema>

export const agentStatusSchema = z.object({
  agent: z.enum(["hermes", "muse"]),
  state: hermesOperationalStateSchema,
  label: z.string(),
  detail: z.string(),
  lastRun: z.string().optional(),
  nextRun: z.string().optional(),
  hardware: z.string(),
  model: z.string().optional(),
  mode: z.enum(["auto", "manual"]).default("auto"),
  updatedAt: z.string(),
})

export type AgentStatus = z.infer<typeof agentStatusSchema>
export type HermesStatus = AgentStatus // Alias de rétro-compatibilité

export const hermesStatusUpdateInputSchema = z.object({
  agent: z.enum(["hermes", "muse"]).optional(),
  state: hermesOperationalStateSchema.optional(),
  detail: z.string().max(300).optional(),
  lastRun: z.string().optional(),
  nextRun: z.string().optional(),
  hardware: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  mode: z.enum(["auto", "manual"]).optional(),
})

export type HermesStatusUpdateInput = z.infer<typeof hermesStatusUpdateInputSchema>

const DATA_DIR = path.join(process.cwd(), "data")
const HERMES_STATUS_PATH = path.join(DATA_DIR, "hermes-status.json")
const MUSE_STATUS_PATH = path.join(DATA_DIR, "muse-status.json")

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
  nextRun: string
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
        nextRun: "Lundi 08:00 EDT",
      }
    }

    if (timeDecimal >= 8.0 && timeDecimal <= 17.5) {
      return {
        state: "idle",
        label: HERMES_STATE_LABELS.idle,
        detail: "Marchés ouverts · Surveillance active aux 15 min",
        nextRun: "~15 min",
      }
    }

    return {
      state: "resting",
      label: HERMES_STATE_LABELS.resting,
      detail: "Marchés clôturés · Mode repos nocturne",
      nextRun: "Demain 08:00 EDT",
    }
  } catch {
    return {
      state: "idle",
      label: HERMES_STATE_LABELS.idle,
      detail: "Surveillance active des 13 actions",
      nextRun: "~15 min",
    }
  }
}

/**
 * Calcule l'état automatique de Muse selon sa cadence stratégique :
 * 2x par jour de bourse (Matin 08:05 pré-marché & Soir 16:35 clôture)
 * + vigie urgente en cas d'événement majeur.
 */
export function computeAutomaticMuseState(now: Date = new Date()): {
  state: HermesOperationalState
  label: string
  detail: string
  nextRun: string
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
        detail: "Marchés clôturés (week-end) · Prochain point pré-marché lundi 08:05 EDT",
        nextRun: "Lundi 08:05 EDT",
      }
    }

    // 1. Fenêtre pré-marché du matin : 07h45 à 08h35 EDT
    if (timeDecimal >= 7.75 && timeDecimal <= 8.58) {
      return {
        state: "working",
        label: HERMES_STATE_LABELS.working,
        detail: "Rédaction du point pré-marché (macro, taux, catalyseurs sur vos 13 actions)",
        nextRun: "En cours · Dépôt vers 08:05 EDT",
      }
    }

    // 2. Séance de bourse : 08h35 à 16h15 EDT
    if (timeDecimal > 8.58 && timeDecimal < 16.25) {
      return {
        state: "idle",
        label: HERMES_STATE_LABELS.idle,
        detail: "En observation de la séance · Veille macroéconomique active",
        nextRun: "Aujourd'hui 16:35 EDT (Clôture)",
      }
    }

    // 3. Fenêtre de clôture : 16h15 à 17h05 EDT
    if (timeDecimal >= 16.25 && timeDecimal <= 17.08) {
      return {
        state: "working",
        label: HERMES_STATE_LABELS.working,
        detail: "Rédaction du bilan de clôture (synthèse de séance sur vos 13 actions)",
        nextRun: "En cours · Dépôt vers 16:35 EDT",
      }
    }

    // 4. Hors séance / Nuit
    return {
      state: "resting",
      label: HERMES_STATE_LABELS.resting,
      detail: "Séance clôturée · Mode repos nocturne",
      nextRun: "Demain 08:05 EDT (Pré-marché)",
    }
  } catch {
    return {
      state: "resting",
      label: HERMES_STATE_LABELS.resting,
      detail: "Analyste stratégique en veille",
      nextRun: "08:05 EDT",
    }
  }
}

/**
 * Lit l'état d'Hermes en combinant le fichier de persistance et la logique horaire.
 */
export async function getHermesStatus(): Promise<AgentStatus> {
  const auto = computeAutomaticHermesState()
  let stored: Partial<AgentStatus> | null = null

  try {
    const raw = await fs.readFile(HERMES_STATUS_PATH, "utf-8")
    stored = JSON.parse(raw) as Partial<AgentStatus>
  } catch {
    stored = null
  }

  const now = new Date()

  // 1. Mode manuel forcé
  if (stored?.mode === "manual" && stored.state) {
    return {
      agent: "hermes",
      state: stored.state,
      label: HERMES_STATE_LABELS[stored.state] ?? stored.state,
      detail: stored.detail ?? (stored.state === "working" ? "Analyse forcée en cours" : "Mode manuel actif"),
      lastRun: stored.lastRun,
      nextRun: stored.nextRun ?? "~15 min",
      hardware: stored.hardware ?? "RTX 3080 Ti (12GB) · Nemotron 3.5",
      model: "Nemotron 3.5",
      mode: "manual",
      updatedAt: stored.updatedAt ?? now.toISOString(),
    }
  }

  // 2. Scan actif récent (moins de 5 minutes)
  if (stored?.state === "working" && stored.updatedAt) {
    const diffMs = now.getTime() - new Date(stored.updatedAt).getTime()
    if (diffMs < 5 * 60 * 1000) {
      return {
        agent: "hermes",
        state: "working",
        label: HERMES_STATE_LABELS.working,
        detail: stored.detail || "Analyse active en cours sur RTX 3080 Ti (13 actions)",
        lastRun: stored.lastRun || stored.updatedAt,
        nextRun: stored.nextRun ?? "En cours",
        hardware: stored.hardware ?? "RTX 3080 Ti (12GB) · Nemotron 3.5",
        model: "Nemotron 3.5",
        mode: "auto",
        updatedAt: stored.updatedAt,
      }
    }
  }

  // 3. État automatique selon marché
  return {
    agent: "hermes",
    state: auto.state,
    label: auto.label,
    detail: stored?.detail && stored?.mode !== "manual" ? stored.detail : auto.detail,
    lastRun: stored?.lastRun,
    nextRun: stored?.nextRun ?? (auto.state === "resting" ? auto.nextRun : "~15 min"),
    hardware: stored?.hardware ?? "RTX 3080 Ti (12GB) · Nemotron 3.5",
    model: "Nemotron 3.5",
    mode: "auto",
    updatedAt: stored?.updatedAt ?? now.toISOString(),
  }
}

/**
 * Lit l'état de Muse en combinant la persistance locale et son calendrier stratégique.
 */
export async function getMuseState(): Promise<AgentStatus> {
  const auto = computeAutomaticMuseState()
  let stored: Partial<AgentStatus> | null = null

  try {
    const raw = await fs.readFile(MUSE_STATUS_PATH, "utf-8")
    stored = JSON.parse(raw) as Partial<AgentStatus>
  } catch {
    stored = null
  }

  const now = new Date()

  // 1. Mode manuel forcé
  if (stored?.mode === "manual" && stored.state) {
    return {
      agent: "muse",
      state: stored.state,
      label: HERMES_STATE_LABELS[stored.state] ?? stored.state,
      detail: stored.detail ?? (stored.state === "working" ? "Synthèse stratégique forcée en cours" : "Mode manuel actif"),
      lastRun: stored.lastRun,
      nextRun: stored.nextRun ?? auto.nextRun,
      hardware: stored.hardware ?? "Serveurs Infonuagiques Meta AI",
      model: stored.model ?? "Meta AI · Llama 3.3",
      mode: "manual",
      updatedAt: stored.updatedAt ?? now.toISOString(),
    }
  }

  // 2. Publication ou rédaction récente (moins de 20 minutes)
  if (stored?.state === "working" && stored.updatedAt) {
    const diffMs = now.getTime() - new Date(stored.updatedAt).getTime()
    if (diffMs < 20 * 60 * 1000) {
      return {
        agent: "muse",
        state: "working",
        label: HERMES_STATE_LABELS.working,
        detail: stored.detail || "Rédaction stratégique en cours (Meta AI)",
        lastRun: stored.lastRun || stored.updatedAt,
        nextRun: stored.nextRun ?? "En cours",
        hardware: stored.hardware ?? "Serveurs Infonuagiques Meta AI",
        model: stored.model ?? "Meta AI · Llama 3.3",
        mode: "auto",
        updatedAt: stored.updatedAt,
      }
    }
  }

  // 3. État automatique selon le calendrier stratégique
  return {
    agent: "muse",
    state: auto.state,
    label: auto.label,
    detail: stored?.detail && stored?.mode !== "manual" ? stored.detail : auto.detail,
    lastRun: stored?.lastRun,
    nextRun: stored?.nextRun ?? auto.nextRun,
    hardware: stored?.hardware ?? "Serveurs Infonuagiques Meta AI",
    model: stored?.model ?? "Meta AI · Llama 3.3",
    mode: "auto",
    updatedAt: stored?.updatedAt ?? now.toISOString(),
  }
}

/**
 * Met à jour l'état d'un agent (hermes ou muse) et persiste dans son fichier dédié.
 */
export async function updateAgentStatus(
  agent: "hermes" | "muse",
  input: HermesStatusUpdateInput
): Promise<AgentStatus> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const isMuse = agent === "muse"
  const current = isMuse ? await getMuseState() : await getHermesStatus()
  const filePath = isMuse ? MUSE_STATUS_PATH : HERMES_STATUS_PATH

  const nextState = input.state ?? current.state
  const nextMode = input.mode ?? (input.state ? "manual" : current.mode)

  const updated: AgentStatus = {
    agent,
    state: nextState,
    label: HERMES_STATE_LABELS[nextState] ?? nextState,
    detail:
      input.detail ??
      (nextState === "working"
        ? isMuse
          ? "Rédaction stratégique en cours (Meta AI)"
          : "Analyse active sur RTX 3080 Ti"
        : current.detail),
    lastRun: input.lastRun ?? current.lastRun,
    nextRun: input.nextRun ?? current.nextRun,
    hardware: input.hardware ?? current.hardware,
    model: input.model ?? current.model,
    mode: nextMode,
    updatedAt: new Date().toISOString(),
  }

  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8")
  return updated
}

/** Wrapper Hermes pour rétro-compatibilité */
export async function updateHermesStatus(input: HermesStatusUpdateInput): Promise<AgentStatus> {
  return updateAgentStatus("hermes", input)
}

/** Wrapper Muse */
export async function updateMuseState(input: HermesStatusUpdateInput): Promise<AgentStatus> {
  return updateAgentStatus("muse", input)
}

/**
 * Réinitialise le mode d'un agent au mode automatique.
 */
export async function resetAgentStatusToAuto(agent: "hermes" | "muse"): Promise<AgentStatus> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const isMuse = agent === "muse"
  const auto = isMuse ? computeAutomaticMuseState() : computeAutomaticHermesState()
  const current = isMuse ? await getMuseState() : await getHermesStatus()
  const filePath = isMuse ? MUSE_STATUS_PATH : HERMES_STATUS_PATH

  const updated: AgentStatus = {
    agent,
    state: auto.state,
    label: auto.label,
    detail: auto.detail,
    lastRun: current.lastRun,
    nextRun: auto.nextRun,
    hardware: current.hardware,
    model: current.model,
    mode: "auto",
    updatedAt: new Date().toISOString(),
  }

  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8")
  return updated
}

/** Wrapper Hermes pour rétro-compatibilité */
export async function resetHermesStatusToAuto(): Promise<AgentStatus> {
  return resetAgentStatusToAuto("hermes")
}

/** Wrapper Muse */
export async function resetMuseStateToAuto(): Promise<AgentStatus> {
  return resetAgentStatusToAuto("muse")
}
