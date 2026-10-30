import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

interface DashboardSectionProps {
  id: string
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
}

/**
 * En-tête de section unique du tableau de bord : icône, titre et
 * description optionnelle, avec l'espacement et le décalage de
 * défilement (ancres) partagés par toutes les sections de `content.tsx`.
 */
export default function DashboardSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <section id={id} className="space-y-3 scroll-mt-24">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl border border-border/60 bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}
