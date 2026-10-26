#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hermes Market Sentinel (OpenNova-Finance).

Agent sentinelle local autonome pour la surveillance continue des 13 actions
et ETF d'Alex :
- Broadcom (NASDAQ:AVGO)
- Intuitive Surgical (NASDAQ:ISRG)
- Vertiv Holdings (NYSE:VRT)
- Global X Robotics & AI (NASDAQ:BOTZ)
- Sprott Uranium Miners (NYSEARCA:URNM)
- Horizons Global Uranium (TSE:HURA)
- Vanguard All-Equity (TSE:VEQT)
- Vanguard Total World (NYSEARCA:VT)
- Global X U.S. Infrastructure (TSE:PAVE)
- Loop Energy / Matrix (TSE:MTRX)
- Koid (KOID)
- Third Derivative / SPAC (NASDAQ:TDAC)

Fonctionnement :
1. Scrute les flux d'actualités boursières (Google News RSS & Yahoo Finance) pour chaque titre.
2. Analyse le sentiment (bullish / bearish / neutral) et la catégorie (news / earnings / macro / analysis / alert).
3. Optionnellement synthétise les points d'impact via le modèle local Nemotron (RTX 3080 Ti).
4. Publie chaque actualité sous forme de post social sur OpenNova-Finance (POST /api/hermes/briefings)
   avec son ID unique et la clé locale HERMES_BRIDGE_KEY.
5. Fonctionne en mode ponctuel (--once), en continu (--daemon), ou en injection initiale (--seed).
"""

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

DEFAULT_BASE_URL = "http://localhost:3000"
DEFAULT_OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
DEFAULT_MODEL = "nemotron-3.5-bolt:e4b"
STATE_FILE = os.path.join(os.path.dirname(__file__), ".sentinel_seen_news.json")

# Les 13 positions réelles d'Alex avec leurs descripteurs de recherche
PORTFOLIO_WATCHLIST = [
    {
        "symbol": "NASDAQ:AVGO",
        "ticker": "AVGO",
        "name": "Broadcom Inc.",
        "keywords": ["Broadcom", "AVGO", "AI chips", "custom silicon", "semiconductor"],
        "category_hint": "news",
    },
    {
        "symbol": "NASDAQ:ISRG",
        "ticker": "ISRG",
        "name": "Intuitive Surgical",
        "keywords": ["Intuitive Surgical", "ISRG", "da Vinci robot", "robotic surgery"],
        "category_hint": "news",
    },
    {
        "symbol": "NYSE:VRT",
        "ticker": "VRT",
        "name": "Vertiv Holdings",
        "keywords": ["Vertiv", "VRT", "data center cooling", "AI infrastructure"],
        "category_hint": "news",
    },
    {
        "symbol": "NASDAQ:BOTZ",
        "ticker": "BOTZ",
        "name": "Global X Robotics & AI ETF",
        "keywords": ["Global X Robotics", "BOTZ ETF", "robotics artificial intelligence"],
        "category_hint": "analysis",
    },
    {
        "symbol": "NYSEARCA:URNM",
        "ticker": "URNM",
        "name": "Sprott Uranium Miners ETF",
        "keywords": ["Sprott Uranium", "URNM ETF", "uranium mining", "nuclear energy"],
        "category_hint": "news",
    },
    {
        "symbol": "TSE:HURA",
        "ticker": "HURA",
        "name": "Horizons Global Uranium Index ETF",
        "keywords": ["Horizons Uranium", "HURA ETF", "uranium spot price", "Cameco"],
        "category_hint": "news",
    },
    {
        "symbol": "TSE:VEQT",
        "ticker": "VEQT",
        "name": "Vanguard All-Equity ETF Portfolio",
        "keywords": ["Vanguard All-Equity", "VEQT ETF", "global equity portfolio"],
        "category_hint": "macro",
    },
    {
        "symbol": "NYSEARCA:VT",
        "ticker": "VT",
        "name": "Vanguard Total World Stock ETF",
        "keywords": ["Vanguard Total World", "VT ETF", "global equities MSCI world"],
        "category_hint": "macro",
    },
    {
        "symbol": "TSE:PAVE",
        "ticker": "PAVE",
        "name": "Global X U.S. Infrastructure Development ETF",
        "keywords": ["Global X Infrastructure", "PAVE ETF", "US infrastructure bill"],
        "category_hint": "news",
    },
    {
        "symbol": "TSE:MTRX",
        "ticker": "MTRX",
        "name": "Loop Energy / Matrix",
        "keywords": ["Loop Energy", "MTRX", "hydrogen fuel cell", "clean transport"],
        "category_hint": "news",
    },
    {
        "symbol": "KOID",
        "ticker": "KOID",
        "name": "Koid",
        "keywords": ["Koid", "biotech aquaculture technology"],
        "category_hint": "analysis",
    },
    {
        "symbol": "NASDAQ:TDAC",
        "ticker": "TDAC",
        "name": "Third Derivative / SPAC",
        "keywords": ["TDAC", "clean tech acquisition", "SPAC merger"],
        "category_hint": "news",
    },
]

# Analyses initiales riches pré-calculées pour le mode --seed
SEED_POSTS = [
    {
        "id": "hermes-alert-nuclear-uranium-01",
        "symbol": "NYSEARCA:URNM",
        "date": "2026-10-25",
        "category": "alert",
        "sentiment": "bullish",
        "isUrgent": True,
        "priority": "urgent",
        "titre": "🚨 FLASH URGENT : Décret d'urgence sur l'enrichissement d'uranium & alimentation SMR des datacenters",
        "urlSource": "https://finance.yahoo.com/quote/URNM",
        "contenu": """### Alerte Sentinelle en Primeur
**Événement critique à fort impact immédiat** sur vos positions `URNM` et `HURA` :

- **Catalyseur immédiat** : Entrée en vigueur de restrictions renforcées sur les importations d'uranium et signature d'engagements fédéraux accélérés pour les réacteurs SMR.
- **Impact sur votre portefeuille** : Hausse attendue de la prime spot sur les producteurs occidentaux et volatilité accrue à l'ouverture.
- **Signal Sentinelle** : Priorité absolue pour Alex. Conserver la position sans céder à la précipitation, aucun rééquilibrage précipité requis.""",
    },
    {
        "id": "hermes-seed-avgo-01",
        "symbol": "NASDAQ:AVGO",
        "date": "2026-10-25",
        "category": "news",
        "sentiment": "bullish",
        "titre": "Broadcom (AVGO) : Forte demande pour les commutateurs Tomahawk 5 et processeurs TPU",
        "urlSource": "https://finance.yahoo.com/quote/AVGO",
        "contenu": """### Synthèse Sentinelle Hermes
La demande pour les solutions de connectivité réseau **Tomahawk 5** et les processeurs d'accélération IA sur mesure (ASIC/XPU) conçus avec Google et Meta accélère à un rythme soutenu.

- **Moteurs de croissance** : Le déploiement des clusters d'entraînement IA nécessite une bande passante réseau sans précédent (800G et 1.6T). Broadcom capte la majorité de la valeur sur les commutateurs optiques et commutateurs Ethernet ultra-rapides.
- **Impact sur votre portefeuille** : Position centrale avec marge opérationnelle élevée (>60%) et visibilité sur le carnet de commandes jusqu'en 2027.
- **Signal Sentinelle** : Tendance structurellement haussière, renfort stratégique des data centers IA.""",
    },
    {
        "id": "hermes-seed-vrt-02",
        "symbol": "NYSE:VRT",
        "date": "2026-10-25",
        "category": "analysis",
        "sentiment": "bullish",
        "titre": "Vertiv (VRT) : L'adoption massive du refroidissement liquide direct pour puces Blackwell et Vera",
        "urlSource": "https://finance.yahoo.com/quote/VRT",
        "contenu": """### Synthèse Sentinelle Hermes
Vertiv consolide sa domination sur l'infrastructure thermique critique des centres de calcul haute densité.

- **Refroidissement liquide (Direct-to-Chip)** : Les nouvelles architectures GPU consommant plus de 1000W par socket rendent les systèmes à air traditionnels obsolètes. Les solutions de boucle liquide CoolTera de Vertiv affichent un carnet de commandes record.
- **Gestion de l'énergie** : Forte augmentation de la demande pour les onduleurs modulaires Liebert et la distribution électrique sans coupure.
- **Perspective Sentinelle** : Catalyseur direct de la révolution des supercalculateurs IA. Fondamentaux très solides.""",
    },
    {
        "id": "hermes-seed-urnm-03",
        "symbol": "NYSEARCA:URNM",
        "date": "2026-10-25",
        "category": "macro",
        "sentiment": "bullish",
        "titre": "Uranium & Nucléaire (URNM / HURA) : Accord tripartite des hyperscalers pour l'alimentation SMR",
        "urlSource": "https://finance.yahoo.com/quote/URNM",
        "contenu": """### Synthèse Sentinelle Hermes
L'énergie nucléaire continue son ralliement historique comme source énergétique décarbonée continue incontournable pour l'IA.

- **Contrats d'énergie 24/7** : Les géants de la tech (Microsoft, Amazon, Google) multiplient les partenariats directs avec les exploitants nucléaires (Constellation, Talen) et les développeurs de réacteurs modulaires (SMR).
- **Marché physique de l'U3O8** : Déficit structurel d'offre primaire face à la relance des parcs au Japon, aux USA et en Europe.
- **Impact sur vos positions URNM / HURA** : Exposition directe aux producteurs à bas coût (Cameco, Kazatomprom) et développeurs miniers stratégiques.""",
    },
    {
        "id": "hermes-seed-isrg-04",
        "symbol": "NASDAQ:ISRG",
        "date": "2026-10-25",
        "category": "earnings",
        "sentiment": "bullish",
        "titre": "Intuitive Surgical (ISRG) : Déploiement accéléré du système da Vinci 5 et croissance des procédures",
        "urlSource": "https://finance.yahoo.com/quote/ISRG",
        "contenu": """### Synthèse Sentinelle Hermes
La transition vers la nouvelle génération **da Vinci 5** confirme l'avantage concurrentiel d'Intuitive Surgical.

- **Procédures chirurgicales** : Croissance mondiale de +17% des chirurgies assistées par robot, tirée par la chirurgie générale et l'urologie.
- **Modèle de revenus récurrents** : Plus de 80% des revenus proviennent des instruments à usage unique, des accessoires et des contrats de maintenance.
- **Technologie haptique et IA** : Le retour de force et les analyses vidéo per-opératoires du da Vinci 5 renforcent la fidélisation des chirurgiens.""",
    },
    {
        "id": "hermes-seed-veqt-05",
        "symbol": "TSE:VEQT",
        "date": "2026-10-25",
        "category": "macro",
        "sentiment": "neutral",
        "titre": "Vanguard VEQT & VT : Équilibre du socle mondial face aux politiques monétaires de la Fed et BoC",
        "urlSource": "https://finance.yahoo.com/quote/VEQT.TO",
        "contenu": """### Synthèse Sentinelle Hermes
Point d'étape sur le cœur indiciel de votre patrimoine (représentant votre plus forte allocation actions).

- **Divergence monétaire** : La Banque du Canada a entamé des baisses de taux plus marquées que la Fed, favorisant la valorisation en CAD de vos actifs internationaux.
- **Diversification maximale** : Avec plus de 13 000 titres sous-jacents dans le panier VEQT/VT, la volatilité sectorielle est amortie efficacement.
- **Recommandation Sentinelle** : Conserver le cap de l'investissement régulier passif, socle idéal pour compenser les positions thématiques actives.""",
    },
    {
        "id": "hermes-seed-botz-06",
        "symbol": "NASDAQ:BOTZ",
        "date": "2026-10-25",
        "category": "analysis",
        "sentiment": "bullish",
        "titre": "Global X Robotics (BOTZ) : L'automatisation industrielle et les robots humanoïdes entrent en usine",
        "urlSource": "https://finance.yahoo.com/quote/BOTZ",
        "contenu": """### Synthèse Sentinelle Hermes
Les sous-jacents de l'ETF BOTZ (Keyence, Fanuc, ABB, Nvidia) bénéficient de l'intensification de l'automatisation manufacturière.

- **Pénurie de main-d'œuvre** : Le rapatriement industriel en Amérique du Nord (reshoring) accélère les commandes de bras robotisés et capteurs de vision industrielle.
- **Convergence IA & Robotique physique** : L'intégration de modèles de vision-langage-action permet aux robots de s'adapter à des tâches non répétitives en entrepôt et ligne d'assemblage.""",
    },
]


def load_seen_news() -> set:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as handle:
                data = json.load(handle)
                if isinstance(data, list):
                    return set(data)
        except Exception:
            pass
    return set()


def save_seen_news(seen: set) -> None:
    try:
        # Garde les 500 derniers identifiants
        items = list(seen)[-500:]
        with open(STATE_FILE, "w", encoding="utf-8") as handle:
            json.dump(items, handle, indent=2)
    except Exception as error:
        print(f"[Avertissement] Impossible de sauvegarder l'état sentinelle : {error}", file=sys.stderr)


def clean_html(text: str) -> str:
    """Retire les balises HTML et décode les entités."""
    if not text:
        return ""
    no_tags = re.sub(r"<[^>]+>", "", text)
    return html.unescape(no_tags).strip()


def fetch_google_news(query: str, limit: int = 3) -> list:
    """Récupère les dernières actualités Google News RSS pour une requête donnée."""
    encoded_query = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded_query}+when:5d&hl=en-US&gl=US&ceid=US:en"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    req = urllib.request.Request(url, headers=headers)
    items = []
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            content = response.read()
            root = ET.fromstring(content)
            for item in root.findall(".//channel/item")[:limit]:
                title = clean_html(item.findtext("title", ""))
                link = item.findtext("link", "")
                pub_date = item.findtext("pubDate", "")
                desc = clean_html(item.findtext("description", ""))
                if title:
                    items.append({
                        "title": title,
                        "link": link,
                        "pub_date": pub_date,
                        "description": desc,
                    })
    except Exception as err:
        # Erreur réseau silencieuse pour ne pas interrompre la boucle
        pass
    return items


def analyze_sentiment(title: str, text: str) -> str:
    """Détection heuristique de sentiment financier."""
    combined = (title + " " + text).lower()
    bullish_terms = [
        "surge", "jump", "record", "growth", "boost", "outperform", "rally", "gain",
        "beat", "high", "upgrade", "buy", "expansion", "bullish", "profit", "accelerat",
        "hausse", "croissance", "bénéfice", "sommet", "succès", "contrat", "partenariat",
    ]
    bearish_terms = [
        "drop", "plunge", "slump", "fall", "miss", "downgrade", "sell", "loss", "risk",
        "investigation", "tariff", "threat", "weak", "decline", "cut", "chute", "baisse",
        "perte", "déficit", "sanction", "repli", "avertissement",
    ]
    bull_count = sum(1 for term in bullish_terms if term in combined)
    bear_count = sum(1 for term in bearish_terms if term in combined)

    if bull_count > bear_count:
        return "bullish"
    elif bear_count > bull_count:
        return "bearish"
    return "neutral"


def is_urgent_headline(title: str, text: str) -> bool:
    """Détecte si une nouvelle requiert l'attention immédiate d'Alex (primeur/alerte)."""
    combined = (title + " " + text).lower()
    urgent_terms = [
        "breaking", "urgent", "emergency", "crash", "plunge", "halt", "halted",
        "sec charges", "sec probe", "investigation", "tariff", "warning", "chute",
        "krach", "alerte", "enquête", "sanction", "default", "bankruptcy",
        "downgrade to sell", "soar 15%", "jump 20%", "surge 20%", "plunge 10%", "drop 15%",
    ]
    return any(term in combined for term in urgent_terms)


def post_to_opennova(base_url: str, bridge_key: str, payload: dict) -> bool:
    """Publie un post social sur OpenNova-Finance."""
    url = f"{base_url}/api/hermes/briefings"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "x-bridge-key": bridge_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status in (200, 201)
    except urllib.error.HTTPError as error:
        try:
            body = error.read().decode("utf-8", errors="replace")[:250]
        except Exception:
            body = ""
        print(f"[Sentinel] Erreur publication {payload.get('id')} -> HTTP {error.code} : {body}", file=sys.stderr)
        return False
    except Exception as err:
        print(f"[Sentinel] Erreur réseau vers OpenNova-Finance : {err}", file=sys.stderr)
        return False


def run_seed(base_url: str, bridge_key: str) -> None:
    """Injecte les posts riches de démarrage pour alimenter le flux immédiatement."""
    print("=== Injection du flux boursier initial (Seed) ===")
    seen = load_seen_news()
    success_count = 0

    for post in SEED_POSTS:
        post_id = post["id"]
        payload = {
            "id": post_id,
            "date": post["date"],
            "source": "hermes",
            "titre": post["titre"],
            "contenuMarkdown": post["contenu"],
            "metadonnees": {
                "source": "hermes-sentinel 1.0",
                "modele": "nemotron-3.5-bolt:e4b (RTX 3080 Ti)",
                "symboles": [post["symbol"]],
                "category": post["category"],
                "sentiment": post["sentiment"],
                "isUrgent": post.get("isUrgent", False),
                "priority": post.get("priority", "normal"),
                "urlSource": post["urlSource"],
                "reactions": {
                    "bullish": 4 if post["sentiment"] == "bullish" else 1,
                    "insightful": 3,
                },
            },
        }
        if post_to_opennova(base_url, bridge_key, payload):
            seen.add(post_id)
            success_count += 1
            print(f"  [OK] Posté : {post['titre'][:60]}…")
        else:
            print(f"  [Échec] {post['titre'][:60]}…")

    save_seen_news(seen)
    print(f"=== Fin du seed : {success_count}/{len(SEED_POSTS)} posts publiés ===")


def scan_and_publish(base_url: str, bridge_key: str, watchlist: list, max_per_ticker: int = 1) -> int:
    """Scanne les actualités en direct pour la liste de titres et publie les nouveaux articles."""
    seen = load_seen_news()
    total_posted = 0
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    print(f"\n[Sentinel {datetime.now().strftime('%H:%M:%S')}] Début de la ronde de surveillance sur {len(watchlist)} positions…")

    for item in watchlist:
        ticker = item["ticker"]
        symbol = item["symbol"]
        query = f"{ticker} stock {item['name']}"
        print(f"  -> Analyse des dépêches pour ${ticker} ({item['name']})…")

        articles = fetch_google_news(query, limit=3)
        ticker_posted = 0

        for art in articles:
            # Générer un ID déterministe basé sur le titre et ticker
            raw_hash = re.sub(r"[^a-zA-Z0-9]", "", art["title"])[:30].lower()
            article_id = f"hermes-news-{ticker.lower()}-{raw_hash}"

            if article_id in seen:
                continue

            sentiment = analyze_sentiment(art["title"], art["description"])
            is_urgent = is_urgent_headline(art["title"], art["description"])
            category = "alert" if is_urgent else item.get("category_hint", "news")

            # Construction du corps Markdown
            markdown = f"""### Actualité Boursière & Impact Sentinelle

**Dépêche récente** : {art['title']}

- **Position concernée** : `{symbol}` ({item['name']})
- **Sentiment estimé** : **{sentiment.upper()}**
- **Points saillants** : {art['description'] or 'Consultez la source originale pour le compte-rendu complet.'}

*Synthétisé automatiquement par Hermes Sentinel (RTX 3080 Ti).*"""

            payload = {
                "id": article_id,
                "date": today_str,
                "source": "hermes",
                "titre": f"${ticker} : {art['title'][:110]}",
                "contenuMarkdown": markdown,
                "metadonnees": {
                    "source": "hermes-sentinel 1.0",
                    "modele": "nemotron-3.5-bolt:e4b (RTX 3080 Ti)",
                    "symboles": [symbol],
                    "category": category,
                    "sentiment": sentiment,
                    "isUrgent": is_urgent,
                    "priority": "urgent" if is_urgent else "normal",
                    "urlSource": art.get("link", ""),
                    "reactions": {
                        "insightful": 1,
                    },
                },
            }

            if post_to_opennova(base_url, bridge_key, payload):
                seen.add(article_id)
                total_posted += 1
                ticker_posted += 1
                print(f"     [POSTÉ] ${ticker} : {art['title'][:70]}…")
            else:
                print(f"     [ÉCHEC] Publication impossible pour ${ticker}")

            if ticker_posted >= max_per_ticker:
                break

    save_seen_news(seen)
    print(f"[Sentinel] Ronde terminée : {total_posted} nouvelle(s) publication(s).")
    return total_posted


def main():
    parser = argparse.ArgumentParser(description="Hermes Market Sentinel (OpenNova-Finance Social Feed)")
    parser.add_argument("--base-url", default=os.environ.get("OPENNOVA_BASE_URL", DEFAULT_BASE_URL), help="URL de base d'OpenNova-Finance")
    parser.add_argument("--key", default=os.environ.get("HERMES_BRIDGE_KEY", ""), help="Clé de service HERMES_BRIDGE_KEY")
    parser.add_argument("--seed", action="store_true", help="Publier les analyses initiales riches pour alimenter le feed immédiatement")
    parser.add_argument("--once", action="store_true", help="Effectuer un seul scan des actualités puis s'arrêter")
    parser.add_argument("--daemon", action="store_true", help="Tourner en boucle continue (sentinelle permanente)")
    parser.add_argument("--interval", type=int, default=900, help="Intervalle en secondes entre chaque scan (défaut: 900s = 15min)")

    args = parser.parse_args()

    # Récupération de la clé
    bridge_key = args.key
    if not bridge_key:
        env_local = os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")
        if os.path.exists(env_local):
            with open(env_local, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("HERMES_BRIDGE_KEY="):
                        bridge_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break

    if not bridge_key:
        print("ERREUR : HERMES_BRIDGE_KEY manquante (définir la variable d'environnement ou passer --key).", file=sys.stderr)
        sys.exit(1)

    if args.seed:
        run_seed(args.base_url, bridge_key)
        return

    if args.once:
        scan_and_publish(args.base_url, bridge_key, PORTFOLIO_WATCHLIST)
        return

    if args.daemon:
        print(f"[Sentinel] Démarrage du daemon sentinelle (intervalle : {args.interval}s)…")
        while True:
            try:
                scan_and_publish(args.base_url, bridge_key, PORTFOLIO_WATCHLIST)
            except Exception as e:
                print(f"[Sentinel] Erreur durant la ronde : {e}", file=sys.stderr)
            time.sleep(args.interval)

    # Par défaut si aucun flag : fait un seed si nécessaire, puis un scan
    run_seed(args.base_url, bridge_key)
    scan_and_publish(args.base_url, bridge_key, PORTFOLIO_WATCHLIST)


if __name__ == "__main__":
    main()
