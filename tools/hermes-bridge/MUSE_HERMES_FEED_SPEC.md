# Spécification du Flux Boursier Partagé : Hermes (Local) × Muse (Infonuagique)

Ce document formalise le contrat de collaboration entre **Nova · Hermes (sentinelle locale RTX 3080 Ti)** et **Nova · Muse (analyste infonuagique Meta AI)** pour la composition conjointe du flux d'actualités boursières sur [OpenNova-Finance](http://localhost:3000/dashboard).

---

## 1. Répartition des Rôles et Cadences

| Agent | Rôle | Cadence | Canal de Publication |
| :--- | :--- | :--- | :--- |
| **Nova · Hermes** *(Local)* | Sentinelle boursière temps-réel, surveillance RSS des 13 actions d'Alex, détection de signaux de court terme et d'alertes techniques. | **En continu** (ronde toutes les 15 minutes via tâche planifiée `OpenNova_Hermes_Sentinel`). | `POST /api/hermes/briefings` direct avec `HERMES_BRIDGE_KEY`. |
| **Nova · Muse** *(Infonuagique)* | Analyste macro-économique stratégique, synthèse des banques centrales, géopolitique, bilans de séances et tendances structurelles. | **2 fois par jour** :<br>1. **Matin (08:00 – 08:30)** : Pré-marché & catalyseurs.<br>2. **Soir (16:30 – 17:00)** : Bilan de clôture & perspectives. | Dépôt JSON sur la branche git `origin/nova-outbox` (dossier `nova-briefings/`), ramassé automatiquement par `nova_pickup.py` avec `NOVA_BRIDGE_KEY`. |

---

## 2. Système d'Alerte et Affichage en Primeur (« Flash Urgent »)

Si **Hermes** ou **Muse** identifie une information critique qui mérite l'attention immédiate d'Alex (mouvement de marché brutal, annonce réglementaire, résultat inattendu, alerte sectorielle) :

1. Le champ `"isUrgent": true` (ou `"category": "alert"`, ou `"priority": "urgent"`) est inclus dans les métadonnées.
2. L'article est automatiquement propulsé en **primeur absolue** dans la section dédiée :
   **`🚨 FLASH INFO & URGENCES EN PRIMEUR (À l'attention immédiate d'Alex)`**
   épinglée en haut de page au-dessus de tout le reste du flux.
3. La carte s'affiche avec une bordure néon rouge/ambre, un témoin d'alerte, et un bouton **« Marquer comme lu »** permettant à Alex d'acquitter l'alerte après consultation.
4. Si aucune alerte n'est active, la section affiche un bandeau de statut rassurant :
   *« 🟢 Statut Vigie Stable · Aucune alerte critique en cours sur vos 13 positions »*.

---

## 3. Schéma JSON pour les Briefings de Muse

Pour publier ses 2 briefings quotidiens ou un flash urgent, Muse crée un fichier JSON dans `nova-briefings/` sur la branche `origin/nova-outbox` :

- Matin : `nova-briefings/YYYY-MM-DD-matin.json` (ex: `2026-10-26-matin.json`)
- Soir : `nova-briefings/YYYY-MM-DD-soir.json` (ex: `2026-10-26-soir.json`)
- Alerte urgente : `nova-briefings/YYYY-MM-DD-urgent-XXXX.json`

### Exemple de Briefing Matin (Standard) :
```json
{
  "id": "nova-2026-10-26-matin",
  "date": "2026-10-26",
  "source": "nova",
  "titre": "Point Pré-Marché Muse : Catalyseurs IA, taux et orientations sur vos 13 positions",
  "contenuMarkdown": "### Vue d'ensemble pré-séance\n\n- **Contexte global** : Les contrats à terme nord-américains ouvrent en légère hausse...\n- **Actions sous surveillance** : $AVGO et $VRT profitent de flux acheteurs soutenus...\n- **Stratégie du jour** : Maintien du cap sans arbitrage précipité.",
  "metadonnees": {
    "source": "nova-cloud 2.0",
    "modele": "meta-ai-muse",
    "symboles": ["NASDAQ:AVGO", "NYSE:VRT", "TSE:VEQT"],
    "category": "macro",
    "sentiment": "bullish",
    "isUrgent": false,
    "priority": "normal"
  }
}
```

### Exemple de Flash Urgent / En Primeur :
```json
{
  "id": "nova-2026-10-26-urgent-taux",
  "date": "2026-10-26",
  "source": "nova",
  "titre": "🚨 FLASH URGENT : Révision surprise des prévisions de taux et impact immédiat",
  "contenuMarkdown": "### Alerte Critique en Primeur pour Alex\n\n**Événement macro-économique inattendu** nécessitant votre attention :\n\n- **Faits** : Annonce imprévue modifiant la courbe des rendements...\n- **Impact direct sur vos positions** : Volatilité accrue attendue sur les actifs de croissance ($AVGO, $BOTZ)...\n- **Action recommandée** : Ne pas modifier les ordres en cours, conserver la pondération indicielle $VEQT.",
  "metadonnees": {
    "source": "nova-cloud 2.0",
    "modele": "meta-ai-muse",
    "symboles": ["TSE:VEQT", "NASDAQ:AVGO", "NASDAQ:BOTZ"],
    "category": "alert",
    "sentiment": "bearish",
    "isUrgent": true,
    "priority": "urgent"
  }
}
```

---

## 4. Watchlist Officielle des 13 Positions d'Alex

Hermes et Muse concentrent leurs analyses sur ces 13 titres réels :

1. `TSE:VEQT` — Vanguard All-Equity ETF Portfolio (Retraite & CELI CAD)
2. `TSE:PAVE` — Global X U.S. Infrastructure Development ETF
3. `TSE:HURA` — Horizons Global Uranium Index ETF
4. `TSE:MTRX` — Loop Energy / Matrix
5. `NASDAQ:BOTZ` — Global X Robotics & Artificial Intelligence ETF
6. `KOID` — Koid
7. `NYSEARCA:URNM` — Sprott Uranium Miners ETF
8. `NYSEARCA:VT` — Vanguard Total World Stock ETF
9. `NASDAQ:AVGO` — Broadcom Inc.
10. `NASDAQ:ISRG` — Intuitive Surgical Inc.
11. `NYSE:VRT` — Vertiv Holdings Co.
12. `NASDAQ:TDAC` — Third Derivative / SPAC
13. Cash & liquidités opérationnelles

---

## 5. Indicateur d'État Opérationnel d'Hermes

L'interface OpenNova-Finance affiche en temps réel l'état d'activité d'Hermes en haut du flux :

- 🟢 **« Au travail »** : Scan actif des dépêches en cours ou inférence Nemotron sur la RTX 3080 Ti locale.
- 🟡 **« En attente »** : Marchés ouverts (08:00 – 17:30 EDT lun-ven), en veille passive entre les rondes de 15 minutes.
- 🌙 **« Au repos »** : Clôture des marchés (soirée/nuit ou week-end).

L'état est exposé via l'endpoint public `GET /api/hermes/status` et peut être mis à jour par le pont via `POST/PATCH /api/hermes/status`. Alex peut également basculer manuellement l'état ou réactiver la gestion automatique directement depuis le panneau d'état du dashboard.
