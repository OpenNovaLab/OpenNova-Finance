"use client"

import { cn } from "@/lib/utils"
import {
  Bot,
  Cpu,
  Cloud,
  MessageSquare,
  Send,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Tag,
  Filter,
  Sparkles,
  Radio,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { loadSettingsSnapshot } from "@/lib/settings-store"

interface HermesBriefingProps {
  className?: string
}

export interface CommentItem {
  id: string
  author: string
  text: string
  date: string
}

export interface BriefingItem {
  id: string
  date: string
  source: "hermes" | "nova"
  titre: string
  contenuMarkdown: string
  recuLe: string
  metadonnees?: {
    source?: string
    modele?: string
    genereLe?: string
    symboles?: string[]
    category?: "news" | "earnings" | "macro" | "analysis" | "alert"
    sentiment?: "bullish" | "bearish" | "neutral"
    isUrgent?: boolean
    priority?: "normal" | "urgent" | "breaking"
    urlSource?: string
    reactions?: Record<string, number>
    comments?: CommentItem[]
  }
}

interface BriefingsResponse {
  ok: boolean
  enabled?: boolean
  latest: BriefingItem | null
  history: BriefingItem[]
}

const HERMES_UI_ENABLED = process.env.NEXT_PUBLIC_HERMES_ENABLED === "true"

/** Rendu inline du gras **texte** */
function renderInline(text: string): ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    )
  )
}

/** Rendu Markdown sécurisé et léger pour les cartes de feed */
function MarkdownContent({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  const lines = content.split(/\r?\n/)
  let paragraph: string[] = []
  let list: string[] = []

  const flushParagraph = (key: string) => {
    if (paragraph.length > 0) {
      blocks.push(
        <p key={key} className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
          {renderInline(paragraph.join(" "))}
        </p>
      )
      paragraph = []
    }
  }
  const flushList = (key: string) => {
    if (list.length > 0) {
      blocks.push(
        <ul key={key} className="list-disc space-y-1 pl-4 sm:pl-5">
          {list.map((item, index) => (
            <li key={index} className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      list = []
    }
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    const key = `b-${index}`
    if (line.length === 0) {
      flushParagraph(`${key}-p`)
      flushList(`${key}-l`)
      return
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushParagraph(`${key}-p`)
      flushList(`${key}-l`)
      blocks.push(
        <h4 key={key} className="pt-1.5 text-xs sm:text-sm font-semibold tracking-tight text-foreground">
          {renderInline(heading[2])}
        </h4>
      )
      return
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    if (bullet) {
      flushParagraph(`${key}-p`)
      list.push(bullet[1])
      return
    }
    flushList(`${key}-l`)
    paragraph.push(line)
  })
  flushParagraph("end-p")
  flushList("end-l")

  return <div className="space-y-2">{blocks}</div>
}

/** Formate une date relative (ex: "Il y a 15 min", "Aujourd'hui à 14:30") */
function formatRelativeTime(isoDate: string, locale: "fr" | "en"): string {
  try {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.round(diffMs / (60 * 1000))
    const diffHours = Math.round(diffMs / (3600 * 1000))

    if (diffMin < 2) return locale === "en" ? "Just now" : "À l'instant"
    if (diffMin < 60)
      return locale === "en" ? `${diffMin}m ago` : `Il y a ${diffMin} min`
    if (diffHours < 24)
      return locale === "en" ? `${diffHours}h ago` : `Il y a ${diffHours} h`

    return date.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoDate
  }
}

export default function HermesBriefing({ className }: HermesBriefingProps) {
  const [uiLocale, setUiLocale] = useState<"fr" | "en">("fr")
  const [data, setData] = useState<BriefingsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeFilterSymbol, setActiveFilterSymbol] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const syncLocale = () => {
      const snapshot = loadSettingsSnapshot()
      setUiLocale(snapshot.language === "en" ? "en" : "fr")
    }
    syncLocale()
    const intervalId = window.setInterval(syncLocale, 2_500)
    return () => window.clearInterval(intervalId)
  }, [])

  const loadBriefings = async () => {
    if (!HERMES_UI_ENABLED) return
    setLoading(true)
    try {
      const response = await fetch("/api/hermes/briefings", { cache: "no-store" })
      if (!response.ok) throw new Error("load_failed")
      const payload = (await response.json()) as BriefingsResponse
      setData(payload)
    } catch {
      setData((prev) => prev ?? { ok: false, latest: null, history: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBriefings()
    const intervalId = window.setInterval(() => {
      void loadBriefings()
    }, 45_000)
    return () => window.clearInterval(intervalId)
  }, [])

  // Liste de tous les briefings uniques (latest + history)
  const allBriefings = useMemo(() => {
    if (!data) return []
    const map = new Map<string, BriefingItem>()
    if (data.latest) map.set(data.latest.id, data.latest)
    for (const item of data.history) {
      if (!map.has(item.id)) map.set(item.id, item)
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.recuLe).getTime() - new Date(a.recuLe).getTime()
    )
  }, [data])

  // Extraction des dépêches urgentes / primeurs
  const urgentBriefings = useMemo(() => {
    return allBriefings.filter(
      (b) =>
        b.metadonnees?.isUrgent === true ||
        b.metadonnees?.category === "alert" ||
        b.metadonnees?.priority === "urgent" ||
        b.metadonnees?.priority === "breaking"
    )
  }, [allBriefings])

  // Extraction de tous les symboles uniques pour la barre de filtres
  const availableSymbols = useMemo(() => {
    const symbols = new Set<string>()
    for (const b of allBriefings) {
      b.metadonnees?.symboles?.forEach((s) => symbols.add(s.replace(/^(NASDAQ|NYSE|BATS|TSE|NYSEARCA):/, "")))
    }
    return Array.from(symbols).sort()
  }, [allBriefings])

  // Filtrage du flux standard
  const filteredBriefings = useMemo(() => {
    return allBriefings.filter((b) => {
      if (activeCategory !== "all") {
        if (b.metadonnees?.category !== activeCategory) return false
      }
      if (activeFilterSymbol) {
        const matches = b.metadonnees?.symboles?.some((s) =>
          s.toUpperCase().includes(activeFilterSymbol.toUpperCase())
        )
        const matchesTitle = b.titre.toUpperCase().includes(activeFilterSymbol.toUpperCase())
        if (!matches && !matchesTitle) return false
      }
      return true
    })
  }, [allBriefings, activeCategory, activeFilterSymbol])

  // Gestion des réactions interactives (Bullish, Bearish, Insightful)
  const handleReaction = async (
    briefingId: string,
    reaction: "bullish" | "bearish" | "insightful"
  ) => {
    setData((prev) => {
      if (!prev) return prev
      const updateList = (list: BriefingItem[]) =>
        list.map((item) => {
          if (item.id !== briefingId) return item
          const currentReactions = { ...(item.metadonnees?.reactions ?? {}) }
          currentReactions[reaction] = (currentReactions[reaction] ?? 0) + 1
          return {
            ...item,
            metadonnees: {
              ...item.metadonnees,
              reactions: currentReactions,
            },
          }
        })
      return {
        ...prev,
        latest: prev.latest?.id === briefingId ? updateList([prev.latest])[0] : prev.latest,
        history: updateList(prev.history),
      }
    })

    try {
      await fetch("/api/hermes/briefings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: briefingId, action: "react", reaction }),
      })
    } catch {
      // Ignoré
    }
  }

  // Acquitter / marquer comme lue une alerte urgente
  const handleDismissUrgent = async (briefingId: string) => {
    setData((prev) => {
      if (!prev) return prev
      const updateList = (list: BriefingItem[]) =>
        list.map((item) => {
          if (item.id !== briefingId) return item
          return {
            ...item,
            metadonnees: {
              ...item.metadonnees,
              isUrgent: false,
              priority: "normal" as const,
            },
          }
        })
      return {
        ...prev,
        latest: prev.latest?.id === briefingId ? updateList([prev.latest])[0] : prev.latest,
        history: updateList(prev.history),
      }
    })

    try {
      await fetch("/api/hermes/briefings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: briefingId, action: "set_urgent", isUrgent: false }),
      })
    } catch {
      // Ignoré
    }
  }

  // Ajout d'une note de trading ou commentaire
  const handleAddComment = async (briefingId: string) => {
    const text = (commentInputs[briefingId] ?? "").trim()
    if (!text) return

    setSubmittingComment((prev) => ({ ...prev, [briefingId]: true }))
    try {
      const response = await fetch("/api/hermes/briefings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: briefingId,
          action: "comment",
          comment: { author: "Alex", text },
        }),
      })

      if (response.ok) {
        const json = (await response.json()) as { ok: boolean; briefing: BriefingItem }
        if (json.ok && json.briefing) {
          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              latest: prev.latest?.id === briefingId ? json.briefing : prev.latest,
              history: prev.history.map((it) => (it.id === briefingId ? json.briefing : it)),
            }
          })
          setCommentInputs((prev) => ({ ...prev, [briefingId]: "" }))
        }
      }
    } catch {
      // Ignoré
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [briefingId]: false }))
    }
  }

  const toggleComments = (briefingId: string) => {
    setExpandedComments((prev) => ({ ...prev, [briefingId]: !prev[briefingId] }))
  }

  const copy =
    uiLocale === "en"
      ? {
          title: "Stock Market Feed & Dual Intelligence",
          subtitle: "Coordinated surveillance by Hermes Sentinel (continuous) & Nova Muse (2x daily)",
          liveSentinel: "Hermes Sentinel (continuous) × Nova Muse (2x/day)",
          urgentSectionTitle: "FLASH & BREAKING ALERTS IN PRIMEUR",
          urgentSectionSubtitle: "Immediate attention required on your 13 stock holdings",
          noUrgentActive: "All Clear · No critical market alerts active across your 13 positions",
          acknowledgeUrgent: "Dismiss Alert",
          filterAllCategories: "All Posts",
          filterNews: "News",
          filterEarnings: "Earnings",
          filterMacro: "Macro",
          filterAnalysis: "Analysis",
          filterAlerts: "Alerts",
          allTickers: "All Tickers",
          bullish: "Bullish",
          bearish: "Bearish",
          neutral: "Neutral",
          insightful: "Insightful",
          notes: "Notes",
          addNotePlaceholder: "Add a trading note or personal thought…",
          postNote: "Post Note",
          emptyFeed: "No feed posts received yet. Sentinel is scanning your 13 stock holdings…",
          refresh: "Refresh feed",
          externalSource: "Source link",
        }
      : {
          title: "Flux Boursier & Vigie Commune",
          subtitle: "Surveillance coordonnée par Hermes Sentinel (en continu) & Nova Muse (2x par jour)",
          liveSentinel: "Hermes Sentinel (en continu) × Nova Muse (2x/jour)",
          urgentSectionTitle: "FLASH INFO & URGENCES EN PRIMEUR",
          urgentSectionSubtitle: "Attention immédiate requise sur vos 13 positions boursières",
          noUrgentActive: "Statut Vigie Stable · Aucune alerte critique en cours sur vos 13 positions",
          acknowledgeUrgent: "Marquer comme lu",
          filterAllCategories: "Tous les flux",
          filterNews: "Actualités",
          filterEarnings: "Résultats",
          filterMacro: "Macro",
          filterAnalysis: "Analyses",
          filterAlerts: "Alertes",
          allTickers: "Tous les titres",
          bullish: "Haussier",
          bearish: "Baissier",
          neutral: "Neutre",
          insightful: "Pertinent",
          notes: "Notes & Avis",
          addNotePlaceholder: "Ajouter une note de trading ou réflexion personnelle…",
          postNote: "Publier",
          emptyFeed: "Aucun post dans le flux. Hermes scrute les nouvelles sur vos 13 actions…",
          refresh: "Actualiser le flux",
          externalSource: "Source originale",
        }

  if (!HERMES_UI_ENABLED || data?.enabled === false) {
    return (
      <div className={cn("w-full fx-panel p-4 flex items-center gap-3", className)}>
        <Bot className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          {uiLocale === "en"
            ? "Briefings & Social Feed are available on the local instance only (on Alex's PC)."
            : "Le flux boursier est disponible sur l'instance locale seulement (sur le PC d'Alex)."}
        </p>
      </div>
    )
  }

  // Composant interne pour rendre une carte de post
  const renderCard = (briefing: BriefingItem, isUrgentSpotlight: boolean = false) => {
    const isHermes = briefing.source === "hermes"
    const category = briefing.metadonnees?.category ?? "analysis"
    const sentiment = briefing.metadonnees?.sentiment ?? "neutral"
    const isUrgent =
      briefing.metadonnees?.isUrgent === true ||
      briefing.metadonnees?.category === "alert" ||
      briefing.metadonnees?.priority === "urgent" ||
      briefing.metadonnees?.priority === "breaking"
    const reactions = briefing.metadonnees?.reactions ?? {}
    const comments = briefing.metadonnees?.comments ?? []
    const isCommentsOpen = Boolean(expandedComments[briefing.id])

    return (
      <article
        key={briefing.id}
        className={cn(
          "fx-panel rounded-2xl border backdrop-blur-md shadow-xs transition-all overflow-hidden",
          isUrgentSpotlight
            ? "border-rose-500/80 bg-gradient-to-br from-rose-950/40 via-card to-card/90 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/30"
            : isUrgent
            ? "border-rose-500/60 bg-card/85 shadow-xs"
            : "border-border/70 bg-card/75 hover:border-border/90"
        )}
      >
        {/* Bandeau d'en-tête Urgent si applicable */}
        {isUrgent && (
          <div className="bg-gradient-to-r from-rose-600/30 via-amber-500/20 to-transparent px-4 py-1.5 border-b border-rose-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-rose-300 font-bold tracking-wide">
              <Zap className="h-3.5 w-3.5 text-rose-400 animate-bounce" />
              <span className="text-[11px] uppercase">⚡ Alerte en Primeur — Action immédiate requise</span>
            </div>
            {isUrgentSpotlight && (
              <button
                type="button"
                onClick={() => void handleDismissUrgent(briefing.id)}
                className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 hover:bg-rose-500/40 px-2 py-0.5 text-[10px] font-semibold text-rose-200 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>{copy.acknowledgeUrgent}</span>
              </button>
            )}
          </div>
        )}

        {/* En-tête de la carte Sociale (Auteur, Avatar, Date, Badges) */}
        <div className="p-4 sm:p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            {/* Auteur */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "relative flex items-center justify-center h-10 w-10 rounded-2xl border shadow-inner",
                  isHermes
                    ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 via-background to-teal-500/10 text-emerald-400"
                    : "border-purple-500/30 bg-gradient-to-br from-purple-500/20 via-background to-indigo-500/10 text-purple-400"
                )}
              >
                {isHermes ? <Cpu className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                    isHermes ? "bg-emerald-500" : "bg-purple-500"
                  )}
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-sm font-bold tracking-tight text-foreground">
                    {isHermes ? "Hermes Sentinel" : "Nova Muse"}
                  </h4>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      isHermes
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    )}
                  >
                    {isHermes ? "Local · En continu (RTX 3080 Ti)" : "Infonuagique · Point 2x/jour (Meta AI)"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(briefing.recuLe, uiLocale)} ·{" "}
                  <span className="font-mono">{briefing.date}</span>
                  {briefing.metadonnees?.modele
                    ? ` · ${briefing.metadonnees.modele.split(":")[0]}`
                    : ""}
                </p>
              </div>
            </div>

            {/* Badges Sentiment & Catégorie */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
              {sentiment === "bullish" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  {copy.bullish}
                </span>
              )}
              {sentiment === "bearish" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                  <TrendingDown className="h-3 w-3" />
                  {copy.bearish}
                </span>
              )}
              {sentiment === "neutral" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Minus className="h-3 w-3" />
                  {copy.neutral}
                </span>
              )}
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                  isUrgent
                    ? "border-rose-500/50 bg-rose-500/20 text-rose-300 font-bold"
                    : "border-border/70 bg-accent/40 text-muted-foreground"
                )}
              >
                {category}
              </span>
            </div>
          </div>

          {/* Titre du Post */}
          <div className="mt-3">
            <h3 className="text-base font-bold tracking-tight text-foreground hover:text-primary transition-colors">
              {briefing.titre}
            </h3>
          </div>

          {/* Badges Symboles / Actions mentionnées */}
          {briefing.metadonnees?.symboles && briefing.metadonnees.symboles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {briefing.metadonnees.symboles.map((sym) => {
                const cleanSym = sym.replace(/^(NASDAQ|NYSE|BATS|TSE|NYSEARCA):/, "")
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() =>
                      setActiveFilterSymbol((prev) => (prev === cleanSym ? null : cleanSym))
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold font-mono transition-colors",
                      isUrgent
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                        : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/15"
                    )}
                  >
                    <span>${cleanSym}</span>
                  </button>
                )
              })}
              {briefing.metadonnees.urlSource && (
                <a
                  href={briefing.metadonnees.urlSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  <span>{copy.externalSource}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Corps Markdown */}
        <div className="px-4 sm:px-5 py-2">
          <MarkdownContent content={briefing.contenuMarkdown} />
        </div>

        {/* Barre d'Engagement Social Facebook-style (Réactions & Commentaires) */}
        <div className="mt-2 border-t border-border/50 bg-background/40 px-4 sm:px-5 py-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Réaction Bullish */}
              <button
                type="button"
                onClick={() => void handleReaction(briefing.id, "bullish")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 active:scale-95"
              >
                <span className="text-sm">🚀</span>
                <span className="font-semibold text-emerald-400">
                  {reactions.bullish ?? 0}
                </span>
                <span className="hidden sm:inline text-muted-foreground text-[11px]">
                  {copy.bullish}
                </span>
              </button>

              {/* Réaction Bearish */}
              <button
                type="button"
                onClick={() => void handleReaction(briefing.id, "bearish")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95"
              >
                <span className="text-sm">📉</span>
                <span className="font-semibold text-rose-400">
                  {reactions.bearish ?? 0}
                </span>
                <span className="hidden sm:inline text-muted-foreground text-[11px]">
                  {copy.bearish}
                </span>
              </button>

              {/* Réaction Pertinent */}
              <button
                type="button"
                onClick={() => void handleReaction(briefing.id, "insightful")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 active:scale-95"
              >
                <span className="text-sm">🧠</span>
                <span className="font-semibold text-amber-400">
                  {reactions.insightful ?? 0}
                </span>
                <span className="hidden sm:inline text-muted-foreground text-[11px]">
                  {copy.insightful}
                </span>
              </button>
            </div>

            {/* Bouton Commentaires / Notes */}
            <button
              type="button"
              onClick={() => toggleComments(briefing.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                isCommentsOpen
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-accent/40"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{copy.notes}</span>
              <span className="rounded-full bg-accent px-1.5 py-0.2 text-[10px] font-bold">
                {comments.length}
              </span>
              {isCommentsOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>

          {/* Section Déroulante des Commentaires & Notes */}
          {isCommentsOpen && (
            <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
              {comments.length > 0 ? (
                <div className="space-y-2">
                  {comments.map((comm) => (
                    <div
                      key={comm.id}
                      className="rounded-xl border border-border/50 bg-background/60 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-[11px]">
                          {comm.author}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(comm.date, uiLocale)}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{comm.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  Aucune note enregistrée. Soyez le premier à commenter !
                </p>
              )}

              {/* Zone d'ajout d'une note */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={commentInputs[briefing.id] ?? ""}
                  onChange={(e) =>
                    setCommentInputs((prev) => ({
                      ...prev,
                      [briefing.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void handleAddComment(briefing.id)
                    }
                  }}
                  placeholder={copy.addNotePlaceholder}
                  className="flex-1 rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => void handleAddComment(briefing.id)}
                  disabled={
                    !(commentInputs[briefing.id] ?? "").trim() ||
                    Boolean(submittingComment[briefing.id])
                  }
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="h-3 w-3" />
                  <span>{copy.postNote}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className={cn("w-full flex flex-col space-y-4", className)}>
      {/* Barre d'en-tête du Feed avec statut Sentinel & Muse */}
      <div className="fx-panel p-4 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  {copy.title}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <Radio className="h-2.5 w-2.5 animate-pulse text-emerald-400" />
                  {copy.liveSentinel}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{copy.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => void loadBriefings()}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-accent/60",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-primary")} />
              <span className="hidden sm:inline">{copy.refresh}</span>
            </button>
          </div>
        </div>

        {/* Barre de filtres par Catégorie et par Ticker */}
        <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-col gap-2.5">
          {/* Onglets Catégorie */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Catégorie:
            </span>
            {[
              { id: "all", label: copy.filterAllCategories },
              { id: "news", label: `📰 ${copy.filterNews}` },
              { id: "earnings", label: `📈 ${copy.filterEarnings}` },
              { id: "macro", label: `🌐 ${copy.filterMacro}` },
              { id: "analysis", label: `📊 ${copy.filterAnalysis}` },
              { id: "alert", label: `🚨 ${copy.filterAlerts}` },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all shrink-0",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Filtre par Titre / Action */}
          {availableSymbols.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Titres:
              </span>
              <button
                type="button"
                onClick={() => setActiveFilterSymbol(null)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all shrink-0",
                  activeFilterSymbol === null
                    ? "bg-accent text-accent-foreground border border-border/80"
                    : "border border-border/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {copy.allTickers}
              </button>
              {availableSymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() =>
                    setActiveFilterSymbol((prev) => (prev === sym ? null : sym))
                  }
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold transition-all shrink-0 uppercase font-mono",
                    activeFilterSymbol === sym
                      ? "bg-primary/20 text-primary border border-primary/40 shadow-xs"
                      : "border border-border/50 bg-background/30 text-muted-foreground hover:text-foreground hover:border-primary/30"
                  )}
                >
                  ${sym}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION DÉDIÉE : FLASH INFO & URGENCES EN PRIMEUR (Breaking News) */}
      {urgentBriefings.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-rose-500/50 bg-gradient-to-br from-rose-950/20 via-background to-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-rose-500/30 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {copy.urgentSectionTitle}
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                    {urgentBriefings.length}
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {copy.urgentSectionSubtitle}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
              ⚡ Priorité Absolue
            </span>
          </div>

          <div className="space-y-3">
            {urgentBriefings.map((briefing) => renderCard(briefing, true))}
          </div>
        </section>
      ) : (
        <div className="fx-panel p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-foreground font-medium">
              {copy.noUrgentActive}
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold hidden sm:inline">
            Surveillance 24/7 active
          </span>
        </div>
      )}

      {/* LISTE DES CARTES DU FLUX STANDARD */}
      {loading && allBriefings.length === 0 ? (
        <div className="fx-panel p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span>Chargement du flux boursier…</span>
        </div>
      ) : filteredBriefings.length === 0 ? (
        <div className="fx-panel p-8 text-center rounded-2xl border border-dashed border-border/80 bg-card/30">
          <Bot className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium text-foreground">
            {activeFilterSymbol || activeCategory !== "all"
              ? "Aucune actualité ne correspond aux filtres sélectionnés."
              : copy.emptyFeed}
          </p>
          {(activeFilterSymbol || activeCategory !== "all") && (
            <button
              type="button"
              onClick={() => {
                setActiveFilterSymbol(null)
                setActiveCategory("all")
              }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBriefings.map((briefing) => renderCard(briefing, false))}
        </div>
      )}
    </div>
  )
}
