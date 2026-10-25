# Boîte de sortie — briefings Nova · Muse

Cette branche (`nova-outbox`) est la **boîte de sortie** de Nova · Muse,
l'assistante infonuagique d'Alex. Elle y dépose ses briefings sous forme de
fichiers JSON, et le pont local d'Alex vient les chercher : c'est le
**modèle par tirage**.

## Pourquoi un tirage plutôt qu'une poussée directe

Nova · Muse ne peut pas appeler directement l'instance locale
d'OpenNova-Finance avec sa clé de service : la substitution d'identifiants
de sa plateforme ne couvre pas la route Tailscale qui mène au PC (constaté
le 25 octobre 2026). Le dépôt sert donc d'intermédiaire de confiance :

```
Nova · Muse                          PC d'Alex
─────────────                          ─────────────────────────────
dépose un fichier JSON ──► branche     nova_pickup.py (tâche planifiée)
dans nova-briefings/      nova-outbox      │ lit les nouveaux fichiers
                                           ▼
                              POST /api/hermes/briefings
                              (instance locale, clé NOVA_BRIDGE_KEY)
```

La `NOVA_BRIDGE_KEY` ne quitte jamais le PC : seul le script de ramassage
local la connaît. Nova, de son côté, n'a besoin d'aucune clé pour déposer
un fichier.

## Format des dépôts

- **Un fichier JSON par briefing**, nommé par la date du briefing :
  `AAAA-MM-JJ.json` (ex. `2026-10-25.json`).
- Le contenu du fichier est **exactement** le corps accepté par
  `POST /api/hermes/briefings` :

  ```json
  {
    "date": "AAAA-MM-JJ",
    "source": "nova",
    "titre": "Titre du briefing",
    "contenuMarkdown": "# …",
    "metadonnees": {"source": "Nova · Muse", "modele": "muse-v1", "genereLe": "…"}
  }
  ```

  Le champ `source` vaut toujours `"nova"` : l'application vérifie que la
  source déclarée correspond à la clé utilisée, et le tableau de bord
  affiche ces briefings sous le badge « Nova · Muse ».
- **Nova ne supprime jamais un fichier déposé** : la boîte garde
  l'historique complet des briefings envoyés.

## Ramassage (côté PC)

Le script `tools/hermes-bridge/nova_pickup.py` (sur `main`, voir la
section « Ramassage des briefings Nova · Muse » de
`tools/hermes-bridge/README.md`) :

1. récupère cette branche (`git fetch origin nova-outbox`) ;
2. compare l'empreinte SHA-256 de chaque fichier à son état local pour ne
   traiter que les nouveaux briefings ou ceux qui ont changé ;
3. publie chaque briefing sur l'instance locale.

La republication est **sans danger** : l'application garantit l'unicité
par date + source — un premier envoi répond `201` (créé), un renvoi du
même briefing répond `200` (remplacé, contenu identique ou corrigé). Un
fichier déjà publié dont le contenu change est donc simplement republié.
