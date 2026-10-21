# OpenNova Finance

[![Next.js](https://img.shields.io/badge/Next.js-15.2.6-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Private-red)](#)

[![CI](https://img.shields.io/github/actions/workflow/status/OpenNovaLab/OpenNova-Finance/ci.yml?branch=main&label=CI)](https://github.com/OpenNovaLab/OpenNova-Finance/actions/workflows/ci.yml)
[![E2E](https://img.shields.io/github/actions/workflow/status/OpenNovaLab/OpenNova-Finance/e2e.yml?branch=main&label=E2E)](https://github.com/OpenNovaLab/OpenNova-Finance/actions/workflows/e2e.yml)
[![AC PASS/FAIL](https://img.shields.io/github/actions/workflow/status/OpenNovaLab/OpenNova-Finance/e2e.yml?branch=main&label=AC%20PASS%2FFAIL)](https://github.com/OpenNovaLab/OpenNova-Finance/actions/workflows/e2e.yml)

OpenNova Finance est une application de pilotage financier personnel:
- vision globale du portefeuille (comptes, transactions, objectifs, actions),
- trading paper avec garde-fous de risque institutionnels,
- intelligence boursiere autonome (RSI, MACD, fondamentaux, alertes),
- mode marche reel via Massive API (Polygon) avec fallback intelligent,
- points saillants locaux: scores, priorites et alertes calcules dans l'app, sans service externe.

##

![Screenshot OpenNova Finance Dashboard (desktop)](public/opennova-dashboard-screenshot-2026-02-17.jpg)
![Screenshot OpenNova Finance Dashboard (mobile - Points saillants)](public/opennova-dashboard-mobile-ai-2026-02-18.jpg)
![Screenshot OpenNova Finance Dashboard (mobile - Comptes)](public/opennova-dashboard-mobile-accounts-2026-02-18.jpg)

_Captures reelles du dashboard OpenNova Finance (desktop + mobile)._

## Presentation

OpenNova combine 3 couches dans une seule interface:

1. `Finance Core`
   Comptes, cashflow, objectifs, budget mensuel, planification.
2. `Intelligence locale`
   Panneau Points saillants: scores, priorites automatiques et alertes, calcules localement.
3. `Execution & Risk`
   Trading desk simule, idempotence des ordres, audit trail, kill-switch, drawdown controls.

Le tout est pense pour une experience produit complete: analyser, decider, executer, puis mesurer.

## Fonctionnalites principales

- Points saillants: panneau local (scores, priorites, alertes d'actions) calcule dans l'app, sans cle API ni appel externe
- Growth Studio: allocation cible, simulation Monte Carlo, guardrails
- Trading Desk IA:
  - execution paper (`market`/`limit`),
  - policy de risque editable,
  - statut de risque dynamique (`ok/watch/restrict/halt`),
  - idempotency des ordres via header `Idempotency-Key`,
  - audit trail dans `data/trading-audit.ndjson`
- Stock Intelligence:
  - analyse technique (RSI, MACD, SMA, Bollinger, ATR, ADX),
  - analyse fondamentale (PE, ROE, growth, FCF...),
  - registre des positions et performance,
  - alertes intelligentes et signaux proactifs,
  - test de connexion API Massive/TwelveData depuis `Settings`
- Persistance locale (`localStorage`) + sync serveur par cle (`/api/portfolio`)
- Qualite logicielle: typecheck + lint + tests + build

## Installation rapide

### Prerequis

- Node.js 20 LTS recommande
- pnpm

### 1) Installer les dependances

```bash
pnpm install
```

### 2) Configurer les variables d'environnement

Cree un fichier `.env.local` a la racine:

```bash
# Optionnel (SEO canonical)
NEXT_PUBLIC_SITE_URL=https://your-domain.example

# Optionnel (securise /api/notification-cron)
NOTIFICATION_CRON_SECRET=your_cron_secret

# Optionnel (active les donnees de marche reelles Massive/Polygon)
MASSIVE_API_KEY=your_massive_api_key
MASSIVE_LIVE_DATA=true
MASSIVE_API_BASE_URL=https://api.massive.com
MASSIVE_HTTP_TIMEOUT_MS=8000

# Optionnel (active les cotations temps reel via TwelveData)
TWELVEDATA_API_KEY=your_twelvedata_api_key
TWELVEDATA_LIVE_DATA=true
TWELVEDATA_API_BASE_URL=https://api.twelvedata.com
TWELVEDATA_HTTP_TIMEOUT_MS=8000

# Optionnel (active Convex pour real-time backend)
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_DEPLOY_KEY=<server-only-key>
```

Astuce: depuis `Settings > Donnees de marche`, l'utilisateur peut remplacer les cles Massive et TwelveData a tout moment sans modifier le code.

### 3) Lancer l'application

```bash
pnpm dev
```

Application accessible sur `http://localhost:3000` (redirection vers `/dashboard`).

## Integrations API de marche (Massive + TwelveData)

Cette section decrit clairement ce qui est integre dans OpenNova pour les donnees boursieres en temps reel.

### Ce qui est deja integre

| Integration | Role dans l'application | Configuration | Remplacement par utilisateur |
|---|---|---|---|
| `Massive (Polygon)` | Cotations/actions + contexte analyse | `.env.local` (`MASSIVE_*`) | Oui, depuis `Settings > Donnees de marche` |
| `TwelveData` | Cotations temps reel + contexte analyse | `.env.local` (`TWELVEDATA_*`) | Oui, depuis `Settings > Donnees de marche` |
| `Routage multi-provider` | Fallback automatique (`auto`) entre providers | `provider: auto/massive/twelvedata` | Oui, via select dans `Settings` |

### Interface Settings (visible pour l'utilisateur)

Dans `Settings > Donnees de marche`, l'utilisateur peut:
- choisir le provider prioritaire (`auto`, `massive`, `twelvedata`),
- remplacer la cle Massive,
- remplacer la cle TwelveData,
- cliquer sur `Tester la connexion API` pour Massive,
- cliquer sur `Tester la connexion API` pour TwelveData.

Le test de connexion affiche un statut explicite:
- `Test en cours...`
- `Connexion OK (...)`
- message d'erreur detaille (cle manquante, provider desactive, erreur upstream).

### Headers API supportes pour les donnees de marche

OpenNova accepte des overrides par requete via headers:
- `x-market-provider: auto|massive|twelvedata`
- `x-massive-api-key: <cle_massive>`
- `x-twelvedata-api-key: <cle_twelvedata>`

Ces headers sont utilises automatiquement par le client interne quand l'utilisateur configure ses cles dans `Settings`.

## Manuel d'utilisation

## Plan d'amelioration recommande

- Voir `docs/recommandations-amelioration.md` pour un plan priorise en 10 points (fiabilite providers Massive/TwelveData, durcissement trading/idempotence, sync portfolio, observabilite, qualite de test et UX explicable).

### Etape 1 - Verifier les points saillants

1. Ouvre le dashboard.
2. Va dans la section `Points saillants`, en tete de l'onglet Portefeuille.
3. Verifie que les scores, les faits saillants et les priorites s'affichent (calcul 100 % local, aucune cle API requise).
4. Bascule la langue dans `Settings` (FR/EN) et verifie que le contenu des priorites suit la langue choisie.

### Etape 2 - Configurer le Trading Desk

1. Ouvre `Trading Desk IA`.
2. Regle la policy de risque:
   - `Max position (%)`
   - `Max ordre (USD)`
   - `Max positions ouvertes`
   - `Perte max journaliere (USD)`
   - `Drawdown max (%)`
   - `Kill-switch global`
3. Sauvegarde la policy.
4. Verifie l'etat de risque (`ok/watch/restrict/halt`) et les signaux actifs.

### Etape 3 - Executer un ordre paper

1. Saisis `symbol`, `quantite`, `side`, `type`.
2. Lance l'ordre.
3. Controle:
   - resultat (`filled` ou `rejected`),
   - message de rejet explicite en cas de guardrail,
   - impact sur cash/equity/positions.

### Etape 4 - Valider les integrations API de marche

1. Ouvre `Settings`.
2. Va dans `Donnees de marche`.
3. Colle tes cles API:
   - `TwelveData`
   - `Massive (Polygon)`
4. Clique `Tester la connexion API` pour chaque provider.
5. Verifie le retour:
   - succes avec source et prix,
   - ou erreur explicite a corriger.

### Etape 5 - Exploiter Stock Intelligence

1. Ouvre `Stock Intelligence IA`.
2. Lance une analyse manuelle sur un ticker (ex: `AAPL`).
3. Observe:
   - signal (`buy/sell/hold...`),
   - confiance,
   - risk score,
   - target / stop,
   - recommandations proactives.
4. Consulte `Alertes intelligentes actions`.

## Variables d'environnement

| Variable | Requise | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Non | URL canonique SEO |
| `NOTIFICATION_CRON_SECRET` | Non | Secret de protection `/api/notification-cron` |
| `MASSIVE_API_KEY` | Non | Cle Massive (Polygon) pour donnees de marche reelles |
| `MASSIVE_LIVE_DATA` | Non | Active/desactive le mode live (`true` par defaut si cle presente) |
| `MASSIVE_API_BASE_URL` | Non | URL API Massive (defaut: `https://api.massive.com`) |
| `MASSIVE_HTTP_TIMEOUT_MS` | Non | Timeout HTTP pour appels Massive |
| `TWELVEDATA_API_KEY` | Non | Cle TwelveData pour cotations temps reel |
| `TWELVEDATA_LIVE_DATA` | Non | Active/desactive la source TwelveData |
| `TWELVEDATA_API_BASE_URL` | Non | URL API TwelveData (defaut: `https://api.twelvedata.com`) |
| `TWELVEDATA_HTTP_TIMEOUT_MS` | Non | Timeout HTTP pour appels TwelveData |

## API utiles

### Trading
- `GET /api/trading/overview`
- `GET /api/trading/orders`
- `POST /api/trading/orders`
- `GET /api/trading/policy`
- `PUT /api/trading/policy`
- `GET /api/trading/quotes?symbols=AAPL,MSFT`

Headers recommandes pour la creation d'ordre:
- `Idempotency-Key: <unique_key>`
- `X-Order-Source: ui|api|ai`

### Stock Analysis
- `POST /api/stock-analysis`
- `GET /api/stock-analysis?action=health`
- `GET /api/stock-analysis?action=sample&symbol=AAPL`

Headers marche supportes sur `POST /api/stock-analysis`:
- `x-market-provider: auto|massive|twelvedata`
- `x-massive-api-key: <cle_massive>`
- `x-twelvedata-api-key: <cle_twelvedata>`

### Market Data Connectivity (nouveau)
- `POST /api/market-data/test-connection`

Permet de verifier rapidement qu'une cle API provider fonctionne.

Exemple requete Massive:

```http
POST /api/market-data/test-connection
content-type: application/json
x-market-provider: massive
x-massive-api-key: your_massive_api_key

{
  "provider": "massive",
  "symbol": "AAPL"
}
```

Exemple requete TwelveData:

```http
POST /api/market-data/test-connection
content-type: application/json
x-market-provider: twelvedata
x-twelvedata-api-key: your_twelvedata_api_key

{
  "provider": "twelvedata",
  "symbol": "MSFT"
}
```

Reponse de succes (exemple):

```json
{
  "success": true,
  "data": {
    "provider": "twelvedata",
    "source": "twelvedata-live",
    "symbol": "MSFT",
    "currentPrice": 421.55,
    "lastUpdatedIso": "2026-02-10T21:00:00.000Z"
  }
}
```

Reponse d'erreur (exemple):

```json
{
  "success": false,
  "error": "Cle Massive manquante.",
  "provider": "massive",
  "symbol": "AAPL"
}
```

### Sync portefeuille
- `GET /api/portfolio`
- `PUT /api/portfolio`

Authentification par cle de sync:
- header `x-sync-key`
- ou `Authorization: Bearer <sync_key>`

## Donnees et persistance

- Persistance client: `localStorage` (portfolio + stock registry + alertes)
- Persistance serveur trading: `data/trading-paper.json`
- Journal d'audit trading: `data/trading-audit.ndjson`

## Qualite et verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Architecture (fichiers cles)

- `components/kokonutui/portfolio-highlights.tsx` - UI Points saillants (remplace l'ancien agent IA)
- `lib/ai-finance-intelligence.ts` - scoring global finance + priorites
- `lib/trading-risk.ts` - moteur de risque (kill-switch, drawdown, regime)
- `lib/trading-engine.ts` - execution paper + validation guardrails
- `lib/trading-storage.ts` - persistance trading + audit
- `lib/stock-analysis-engine.ts` - analyse technique/fondamentale
- `lib/stock-alerts.ts` - alertes et signaux proactifs
- `components/kokonutui/ai-trading-desk.tsx` - UI execution + policy risque
- `components/kokonutui/stock-analysis-panel.tsx` - UI analyse boursiere

## Securite

- `/api/trading/orders` supporte l'idempotence pour eviter les doubles executions.
- Si `NOTIFICATION_CRON_SECRET` est defini, `/api/notification-cron` exige:
  - `x-cron-secret: <secret>` ou
  - `Authorization: Bearer <secret>`

## Liens documentation interne

- `OPENNOVA_SYSTEM.md` - vue systeme complete
- `OPENNOVA_ARCHITECTURE.md` - schema architecture
- `OPENNOVA_QUICKSTART.md` - guide rapide

## QA

- Dashboard QA (GitHub Pages): `https://lazybaco.github.io/OpenNova-Finance/qa-dashboard/`
- Historique des runs QA: `docs/history/history.json`

