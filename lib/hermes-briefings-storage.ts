import { promises as fs } from "fs"
import path from "path"
import {
  HERMES_BRIEFINGS_HISTORY_LIMIT,
  hermesBriefingInputSchema,
  hermesBriefingSchema,
  hermesBriefingStoreSchema,
  type HermesBriefing,
  type HermesBriefingInput,
  type HermesBriefingStore,
} from "@/lib/hermes-types"

/**
 * Stockage des briefings Hermes, selon le même patron que
 * lib/portfolio-sync-storage.ts et lib/notification-storage.ts :
 * un fichier JSON sous data/ (ignoré par git), normalisé à la lecture.
 *
 * Historique borné : au plus HERMES_BRIEFINGS_HISTORY_LIMIT briefings,
 * un seul par date (une republication le même jour remplace le précédent,
 * ce qui rend les réessais du pont idempotents).
 */

const DATA_DIR = path.join(process.cwd(), "data")
const DATA_PATH = path.join(DATA_DIR, "hermes-briefings.json")

const emptyStore: HermesBriefingStore = { briefings: [] }

const ensureStoreFile = async () => {
  try {
    await fs.access(DATA_PATH)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(DATA_PATH, JSON.stringify(emptyStore, null, 2), "utf-8")
  }
}

const byDateDesc = (a: HermesBriefing, b: HermesBriefing) =>
  b.date.localeCompare(a.date) || b.recuLe.localeCompare(a.recuLe)

const normalizeStore = (value: unknown): HermesBriefingStore => {
  const parsed = hermesBriefingStoreSchema.safeParse(value)
  if (!parsed.success) {
    return emptyStore
  }
  const briefings = [...parsed.data.briefings].sort(byDateDesc)
  return { briefings: briefings.slice(0, HERMES_BRIEFINGS_HISTORY_LIMIT) }
}

export const readHermesBriefingStore = async (): Promise<HermesBriefingStore> => {
  await ensureStoreFile()
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8")
    return normalizeStore(JSON.parse(raw))
  } catch {
    return emptyStore
  }
}

export const writeHermesBriefingStore = async (store: HermesBriefingStore): Promise<void> => {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const normalized = normalizeStore(store)
  await fs.writeFile(DATA_PATH, JSON.stringify(normalized, null, 2), "utf-8")
}

export type UpsertHermesBriefingResult = {
  briefing: HermesBriefing
  replaced: boolean
}

/** Insère un briefing, ou remplace celui de la même date s'il existe. */
export const upsertHermesBriefing = async (
  input: HermesBriefingInput
): Promise<UpsertHermesBriefingResult> => {
  const parsedInput = hermesBriefingInputSchema.parse(input)
  const store = await readHermesBriefingStore()

  const existing = store.briefings.find((briefing) => briefing.date === parsedInput.date)
  const briefing = hermesBriefingSchema.parse({
    ...parsedInput,
    id: existing?.id ?? `hermes-${parsedInput.date}`,
    recuLe: new Date().toISOString(),
  })

  const others = store.briefings.filter((item) => item.date !== parsedInput.date)
  await writeHermesBriefingStore({ briefings: [briefing, ...others] })

  return { briefing, replaced: Boolean(existing) }
}

/** Dernier briefing reçu (date la plus récente), ou null si aucun. */
export const getLatestHermesBriefing = async (): Promise<HermesBriefing | null> => {
  const store = await readHermesBriefingStore()
  return store.briefings[0] ?? null
}

/** Historique récent, du plus récent au plus ancien. */
export const listHermesBriefings = async (
  limit: number = HERMES_BRIEFINGS_HISTORY_LIMIT
): Promise<HermesBriefing[]> => {
  const store = await readHermesBriefingStore()
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : HERMES_BRIEFINGS_HISTORY_LIMIT
  return store.briefings.slice(0, Math.min(safeLimit, HERMES_BRIEFINGS_HISTORY_LIMIT))
}
