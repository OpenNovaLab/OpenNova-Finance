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

Le pont s'authentifie par une clé dédiée, `HERMES_BRIDGE_KEY`. Cette
clé ne peut publier que des briefings de source « hermes » : l'autre
source, « nova », appartient à Nova · Muse, l'assistante infonuagique d'Alex, et
s'authentifie avec sa propre clé (`NOVA_BRIDGE_KEY`, côté serveur
seulement — rien à configurer sur le PC pour elle) :

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

## Ramassage des briefings Nova · Muse

Les briefings de la deuxième source, « Nova · Muse » (l'assistante
infonuagique d'Alex : macro, nouvelles, point hebdomadaire), arrivent par
un **modèle par tirage**, décidé le 25 octobre 2026. Nova ne peut pas
publier directement sur l'instance locale : la substitution
d'identifiants de sa plateforme ne couvre pas la route Tailscale. Elle
dépose donc ses briefings en fichiers JSON (un par date,
`AAAA-MM-JJ.json`) dans le dossier `nova-briefings/` de la branche
**`nova-outbox`** du dépôt — voir `nova-briefings/README.md` sur cette
branche. Le script `nova_pickup.py` les ramasse et les publie ici.

```powershell
cd tools\hermes-bridge
python nova_pickup.py --dry-run   # première fois : liste et valide, ne publie rien
python nova_pickup.py             # ramassage réel
```

À chaque passage, le script :

1. récupère la branche (`git fetch origin nova-outbox`) ;
2. compare l'empreinte SHA-256 de chaque fichier à son état local
   (`.nova-pickup-state.json`, ignoré par git) et ne traite que les
   nouveaux briefings ou ceux dont le contenu a changé ;
3. valide chaque fichier (JSON, `source` = `"nova"`, champs requis) ;
4. le publie par `POST /api/hermes/briefings` sur l'instance locale,
   authentifié par `NOVA_BRIDGE_KEY`. La republication est sans danger :
   unicité par date + source côté application (201 = créé, 200 =
   remplacé). Un fichier en échec est signalé, les autres continuent, et
   le code de sortie est non nul si au moins un échec survient.

Configuration :

| Variable | Valeur | Obligatoire |
| --- | --- | --- |
| `NOVA_BRIDGE_KEY` | la clé « nova » de l'instance locale (même valeur que dans son `.env.local`) | oui (sauf `--dry-run`) |
| `OPENNOVA_BASE_URL` | l'instance locale (défaut : `http://localhost:3000`) | non (défaut) |

Options utiles : `--repo <clone>` (défaut : la racine du clone où vit le
script), `--state <fichier>` (défaut :
`tools\hermes-bridge\.nova-pickup-state.json`).

Tâche planifiée Windows (ramassage automatique) : créer une tâche de
base « Ramassage briefings Nova », déclencheur **quotidien** avec
répétition **toutes les 30 minutes**, action « Démarrer un programme »
(`python.exe`, arguments :
`C:\chemin\vers\OpenNova-Finance\tools\hermes-bridge\nova_pickup.py`,
démarrer dans le dossier du clone). La variable `NOVA_BRIDGE_KEY` doit
être définie dans l'environnement de la tâche (variable utilisateur
Windows, par exemple) : le script la lit, ne l'affiche jamais et ne la
journalise pas.

Sécurité : **la clé reste sur le PC** — elle n'est connue que de
l'instance locale et de ce script. Le ramassage ne fait que des lectures
git sur la branche `nova-outbox` et des POST vers l'instance locale ;
aucun port entrant, aucune donnée du portefeuille ne sort du PC.

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| L'application répond 503 « hermes_disabled » | Fonctions Hermes désactivées sur cette instance : définir `HERMES_ENABLED=true` côté serveur (c'est le comportement voulu sur la copie Vercel) |
| L'application répond 503 « hermes_not_configured » | `HERMES_BRIDGE_KEY` absente ou trop courte côté serveur (instance locale ou Vercel) |
| L'application répond 401 | La clé du PC et celle du serveur diffèrent |
| « Ollama injoignable » | Ollama n'est pas démarré sur le PC |
| « instantané vide » | Synchronisation non activée dans l'app : activer la synchro ou utiliser `--snapshot-file` |

## Sentinelle Boursière Continue (`hermes_market_sentinel.py`)

L'agent Sentinelle Hermes assure une veille boursière continue sur les 13 positions d'Alex :
`AVGO`, `ISRG`, `VRT`, `BOTZ`, `URNM`, `HURA`, `VEQT`, `VT`, `PAVE`, `MTRX`, `KOID`, `TDAC`.

Il transforme la section « Briefings » en un **flux social boursier interactif** (style Facebook / Threads) :
- Scrutateur d'actualités financières temps-réel (Google News & Yahoo Finance).
- Synthèse d'impact financier (catégorie, sentiment haussier/baissier/neutre, points clés).
- Publication de chaque actualité sous forme de post indépendant sur `POST /api/hermes/briefings`.
- Réactions interactives (🚀 Haussier, 📉 Baissier, 🧠 Pertinent) et prise de notes / commentaires de trading directement sous chaque carte.

Commandes de la sentinelle :
```powershell
# Injection des analyses initiales riches (seed)
python tools\hermes-bridge\hermes_market_sentinel.py --seed

# Ronde de surveillance unique
python tools\hermes-bridge\hermes_market_sentinel.py --once

# Veille permanente en arrière-plan (toutes les 15 minutes)
python tools\hermes-bridge\hermes_market_sentinel.py --daemon --interval 900
```

Une tâche planifiée Windows `OpenNova_Hermes_Sentinel` est enregistrée pour exécuter la ronde toutes les 15 minutes en arrière-plan.

## Sécurité

- Aucun port entrant : le pont initie toutes les connexions.
- La clé ne quitte jamais le PC et le serveur de l'application ; elle
  n'est ni dans le code ni dans le dépôt.
- Lecture et synthèse seulement : le pont ne peut déclencher aucune
  transaction. Les décisions d'achat et de vente restent à Alex.
