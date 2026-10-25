# Pont local Hermes → OpenNova-Finance

Phase 1 de l'intégration Hermes × OpenNova-Finance : chaque matin, avant
l'ouverture des marchés, le pont génère le **briefing quotidien** du
portefeuille avec le modèle local d'Hermes et le pousse dans la section
« Briefing Hermes » du tableau de bord.

Le pont tourne **sur le PC d'Alex** et n'initie que des connexions
sortantes : aucun port entrant n'est ouvert à la maison, et les données
du portefeuille ne transitent que vers sa propre application.

```
OpenNova-Finance (Vercel)                PC d'Alex
─────────────────────────                ─────────────────────────────
GET  /api/hermes/snapshot   ◄── lit ──   hermes_bridge.py
POST /api/hermes/briefings  ◄── pousse ─      │
                                              ├─► Ollama local (127.0.0.1:11434)
                                              │   modèle nemotron-3.5-bolt:e4b
                                              └─► prompt de briefing en français
```

En version 1, le pont appelle directement Ollama avec le même modèle que
l'agent Hermes. Quand l'agent Hermes (OpenShell) sera confirmé stable,
il pourra orchestrer le pont à la place de la tâche planifiée.

## Prérequis

- Python 3.10+ (aucune dépendance à installer : bibliothèque standard
  seulement).
- Ollama démarré sur le PC, avec le modèle installé :
  `ollama pull nemotron-3.5-bolt:e4b`
- L'application OpenNova-Finance déployée (ou en local pour les tests),
  avec la synchronisation du portefeuille activée pour que l'instantané
  serveur contienne l'état à jour. À défaut, le pont peut lire un fichier
  local (`--snapshot-file`).

## La clé de service (à faire une seule fois)

Le pont s'authentifie par une clé dédiée, `HERMES_BRIDGE_KEY` :

1. Générer une clé aléatoire (PowerShell) :
   `python -c "import secrets; print(secrets.token_hex(32))"`
2. Dans Vercel → projet OpenNova-Finance → Settings → Environment
   Variables : ajouter `HERMES_BRIDGE_KEY` (Production) avec cette
   valeur, puis redéployer.
3. Sur le PC, définir la **même** valeur (voir ci-dessous).

Ne jamais commiter la clé dans le dépôt. Pour la révoquer : changer la
valeur sur Vercel et redéployer — l'ancienne clé cesse de fonctionner
immédiatement.

## Configuration du PC (Windows)

Variables d'environnement utilisateur (Paramètres → Variables
d'environnement, ou `setx` dans un terminal) :

| Variable | Valeur | Obligatoire |
| --- | --- | --- |
| `HERMES_BRIDGE_KEY` | la clé générée ci-dessus | oui |
| `OPENNOVA_BASE_URL` | l'URL publique de l'app, ex. `https://votre-app.vercel.app` | oui en production (défaut : `http://localhost:3000`) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | non (défaut) |
| `HERMES_MODEL` | `nemotron-3.5-bolt:e4b` | non (défaut) |

## Utilisation

Test sans rien envoyer (recommandé la première fois) — génère un
briefing à partir de l'exemple fictif fourni :

```powershell
cd tools\hermes-bridge
python hermes_bridge.py --snapshot-file snapshot-example.json --dry-run
```

Exécution réelle (instantané serveur) :

```powershell
python hermes_bridge.py
```

Options utiles : `--date AAAA-MM-JJ` (republier un jour donné),
`--base-url`, `--model`.

Le pont affiche chaque étape et échoue avec un message clair si
l'application ou Ollama ne répond pas.

## Tâche planifiée Windows (briefing quotidien)

1. Ouvrir le **Planificateur de tâches** → « Créer une tâche de base ».
2. Déclencheur : **Quotidien**, lundi à vendredi à **8 h 30** (avant
   l'ouverture des marchés nord-américains).
3. Action : « Démarrer un programme »
   - Programme : `python.exe` (chemin complet si nécessaire)
   - Arguments : `C:\chemin\vers\OpenNova-Finance\tools\hermes-bridge\hermes_bridge.py`
   - Démarrer dans : `C:\chemin\vers\OpenNova-Finance\tools\hermes-bridge`
4. Cocher « Exécuter seulement
...[truncated 1517 chars]