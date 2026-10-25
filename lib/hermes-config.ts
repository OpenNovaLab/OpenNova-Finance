/**
 * Activation de l'intégration Hermes (hébergement hybride).
 *
 * L'application roule en deux modes à partir du même code source :
 * - instance LOCALE (PC d'Alex, à côté de Hermes) : fonctions Hermes
 *   actives, avec HERMES_ENABLED=true côté serveur et
 *   NEXT_PUBLIC_HERMES_ENABLED=true côté navigateur (cette dernière doit
 *   être définie avant le build, comme toute variable NEXT_PUBLIC_*) ;
 * - copie Vercel (affichage rapide) : fonctions Hermes désactivées, les
 *   routes répondent proprement et la section du tableau de bord affiche
 *   un état « instance locale seulement ».
 *
 * Désactivé par défaut : sans variable explicite, rien n'est exposé.
 */

export const isHermesEnabled = (): boolean => process.env.HERMES_ENABLED === "true"
