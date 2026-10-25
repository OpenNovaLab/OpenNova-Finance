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

## Hébergement hybride

L'application roule en **deux instances à partir du même code** :

- **Instance locale** (sur le PC, à côté de Hermes) : fonctions Hermes
  actives (`HERMES_ENABLED=true` et `NEXT_PUBLIC_HERMES_ENABLED=true`).
  C'est la cible principale du pont.
- **Copie Vercel** (affichage rapide) : fonctions Hermes désactivées par
  défaut. La section « Briefing Hermes » y affiche « disponible sur
  l'instance locale seulement » et les routes du pont répondent
  proprement (`hermes_disabled`, aucun détail interne).

Le pont peut pousser le briefing vers les deux instances (`--base-url`
+ `--base-url-2`). La deuxième cible n'accepte le briefing que si
Hermes y est aussi activé (variables définies sur Vercel) ; sinon elle
répond proprement « désactivé » et le pont continue — l'échec de la
copie ne bloque jamais l'instance locale.

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
| `OPENNOVA_BASE_URL` | l'instance locale de l'app (défaut : `http://localhost:3000`) | non (défaut) |
| `OPENNOVA_BASE_URL_2` | deuxième cible optionnelle, ex. l'URL Vercel `https://votre-app.vercel.app` | non |
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

## Hébergement local de l'application

Pour que le pont ait une cible sur le PC, l'application roule aussi en
local (c'est l'instance complète, avec Hermes) :

1. Récupérer le code et installer les dépendances :
   `git clone https://github.com/OpenNovaLab/OpenNova-Finance.git`,
   puis `pnpm install` dans le dossier.
2. Créer un fichier `.env.local` à la racine avec le mode local :

   ```
   HERMES_ENABLED=true
   NEXT_PUBLIC_HERMES_ENABLED=true
   HERMES_BRIDGE_KEY=<la même clé que le pont>
   ACCESS_SESSION_SECRET=<un secret que vous générez vous-même, 64 hex>
   ```

   `ACCESS_SESSION_SECRET` protège l'accès au tableau de bord : en
   local, vous le définissez vous-même. Les variables `NEXT_PUBLIC_*`
   sont figées au moment du build : les définir **avant** l'étape 3, et
   refaire le build si elles changent.
3. Construire et démarrer : `pnpm build` puis `pnpm start`
   (écoute sur http://localhost:3000 — la cible par défaut du pont).
4. Lancement durable : créer une deuxième tâche planifiée Windows
   « OpenNova-Finance local », déclencheur « À l'ouverture de session »,
   action : `pnpm start` dans le dossier de l'app (ou un petit fichier
   `.cmd` qui fait `cd` + `pnpm start`). L'application redémarre alors
   toute seule à chaque session Windows.

La copie Vercel n'a rien de tout ça à définir : sans `HERMES_ENABLED`,
les fonctions Hermes y restent désactivées proprement.

## Tâche planifiée Windows (briefing quotidien)

1. Ouvrir le **Planificateur de tâches** → « Créer une tâche de base ».
2. Déclencheur : **Quotidien**, lundi à vendredi à **8 h 30** (avant
   l'ouverture des marchés nord-américains).
3. Action : « Démarrer un programme »
   - Programme : `python.exe` (chemin complet si nécessaire)
   - Arguments : `C:\chemin\vers\OpenNova-Finance\tools\hermes-bridge\hermes_bridge.py`
   - Démarrer dans : `C:\chemin\vers\OpenNova-Finance\tools\hermes-bridge`
4. Cocher « Exécuter seulement quand l'utilisateur est connecté »
   (le pont a besoin de la session où Ollama roule).

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| L'application répond 503 « hermes_disabled » | Fonctions Hermes désactivées sur cette instance : définir `HERMES_ENABLED=true` côté serveur (c'est le comportement voulu sur la copie Vercel) |
| L'application répond 503 « hermes_not_configured » | `HERMES_BRIDGE_KEY` absente ou trop courte côté serveur (instance locale ou Vercel) |
| L'application répond 401 | La clé du PC et celle du serveur diffèrent |
| « Ollama injoignable » | Ollama n'est pas démarré sur le PC |
| « instantané vide » | Synchronisation non activée dans l'app : activer la synchro ou utiliser `--snapshot-file` |

## Sécurité

- Aucun port entrant : le pont initie toutes les connexions.
- La clé ne quitte jamais le PC et le serveur de l'application ; elle
  n'est ni dans le code ni dans le dépôt.
- Lecture et synthèse seulement : le pont ne peut déclencher aucune
  transaction. Les décisions d'achat et de vente restent à Alex.
