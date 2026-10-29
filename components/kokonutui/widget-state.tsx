import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * États « vide » et « chargement » harmonisés des widgets enfants du tableau
 * de bord. Patron unique et sobre, aligné sur le langage visuel existant
 * (bordure pointillée border-border/60, texte muted) : à utiliser partout où
 * un widget affiche une liste vide ou attend ses données, plutôt que des
 * paragraphes nus ou des panneaux ad hoc.
 */
export function WidgetEmptyState({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

export function WidgetLoadingState({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
