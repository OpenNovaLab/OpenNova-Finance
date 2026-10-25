#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pont local Hermes -> OpenNova-Finance (phase 1).

Exécuté sur le PC d'Alex (connexions sortantes seulement, aucun port
entrant) :

1. récupère l'instantané du portefeuille via GET /api/hermes/snapshot
   (ou lit un fichier JSON local passé avec --snapshot-file) ;
2. construit un prompt de briefing en français (synthèse factuelle,
   aucun conseil d'achat ou de vente) ;
3. appelle l'Ollama local (modèle nemotron-3.5-bolt:e4b par défaut,
   le même que l'agent Hermes) ;
4. pousse le briefing via POST /api/hermes/briefings, authentifié par
   la clé de service HERMES_BRIDGE_KEY — vers l'instance locale par
   défaut, et aussi vers une deuxième cible optionnelle (ex. la copie
   Vercel) si OPENNOVA_BASE_URL_2 est définie.

Bibliothèque standard seulement. Voir README.md pour l'installation.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

DEFAULT_BASE_URL = "http://localhost:3000"
DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "nemotron-3.5-bolt:e4b"

SYSTEM_PROMPT = """Tu es Hermes, l'agent financier local d'Alex. Tu rédiges son briefing quotidien OpenNova-Finance, en français, au format Markdown.

Règles strictes :
- Synthèse factuelle uniquement : aucun conseil d'achat ou de vente, aucune recommandation de transaction, aucune prédiction présentée comme un fait.
- Utilise uniquement les données fournies dans l'instantané. N'invente aucun prix, aucune nouvelle, aucun chiffre. Si une donnée manque, dis-le simplement.
- Les montants dont le nom se termine par « Cents » sont en cents : divise-les par 100 pour les présenter, sans inventer de devise.
- Structure : un titre « # Briefing du <date> », puis les sections « ## Vue d'ensemble », « ## Comptes et mouvements récents », « ## Objectifs », « ## Points d'attention ». Omet une section si elle n'a vraiment rien à dire.
- Reste concis : 300 à 500 mots. Ton direct, sans formule de politesse inutile."""


def fail(message: str) -> "SystemExit":
    print(f"ERREUR : {message}", file=sys.stderr)
    raise SystemExit(1)


def http_json(method: str, url: str, payload=None, headers=None, timeout: int = 60):
    data = None
    final_headers = {"Accept": "application/json"}
    if headers:
        final_headers.update(headers)
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        final_headers["Content-Type"] = "application/json; charset=utf-8"
    request = urllib.request.Request(url, data=data, headers=final_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        body = ""
        try:
            body = error.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            pass
        fail(f"{method} {url} -> HTTP {error.code}. Réponse : {body}")
    except urllib.error.URLError as error:
        fail(f"{method} {url} injoignable ({error.reason}).")
    except TimeoutError:
        fail(f"{method} {url} : délai dépassé ({timeout} s).")


def fetch_snapshot(base_url: str, bridge_key: str) -> dict:
    print("1/4 Récupération de l'instantané du portefeuille…")
    _, payload = http_json(
        "GET",
        f"{base_url}/api/hermes/snapshot",
        headers={"x-hermes-key": bridge_key},
        timeout=30,
    )
    return payload


def load_snapshot_file(path: str) -> dict:
    print(f"1/4 Lecture de l'instantané local : {path}")
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError:
        fail(f"fichier d'instantané introuvable : {path}")
    except json.JSONDecodeError as error:
        fail(f"fichier d'instantané JSON invalide ({path}) : {error}")
    if isinstance(payload, dict) and "state" in payload:
        return payload
    # Un état de portefeuille brut (format /api/portfolio) est aussi accepté.
    return {"hasState": True, "state": payload, "symboles": []}


def build_user_prompt(snapshot: dict, date_str: str) -> str:
    state = snapshot.get("state")
    pretty = json.dumps(state, ensure_ascii=False, indent=2)
    return (
        f"Date du briefing : {date_str}.\n\n"
        "Voici l'instantané du portefeuille (état synchronisé OpenNova-Finance, format JSON) :\n\n"
        f"```json\n{pretty}\n```\n\n"
        "Rédige le briefing quotidien à partir de ces seules données."
    )


def call_ollama(ollama_url: str, model: str, user_prompt: str) -> str:
    print(f"2/4 Génération du briefing par Ollama ({model})…")
    _, payload = http_json(
        "POST",
        f"{ollama_url}/api/chat",
        payload={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": 0.3},
        },
        timeout=900,
    )
    content = strip_code_fence((payload.get("message") or {}).get("content", ""))
    if not content:
        fail("Ollama a répondu sans contenu. Vérifiez que le modèle est installé (ollama list).")
    return content


def strip_code_fence(text: str) -> str:
    """Retire une clôture ```markdown si le modèle a emballé sa réponse."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return stripped


def extract_title(markdown: str, date_str: str) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            title = stripped.lstrip("#").strip()
            if title:
                return title[:200]
    return f"Briefing Hermes du {date_str}"


def post_briefing(base_url: str, payload: dict, bridge_key: str):
    """POST d'un briefing vers une cible. Retourne (succès, détail) sans sortir."""
    url = f"{base_url}/api/hermes/briefings"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
            "x-hermes-key": bridge_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
            detail = f"HTTP {response.status}"
            if body.get("replaced"):
                detail += " (remplace le briefing déjà présent pour cette date)"
            return True, detail
    except urllib.error.HTTPError as error:
        body = ""
        try:
            body = error.read().decode("utf-8", errors="replace")[:300]
        except Exception:
            pass
        return False, f"HTTP {error.code} — {body}"
    except urllib.error.URLError as error:
        return False, f"injoignable ({error.reason})"
    except TimeoutError:
        return False, "délai dépassé (60 s)"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Pont local Hermes -> OpenNova-Finance : génère et pousse le briefing quotidien."
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("OPENNOVA_BASE_URL", DEFAULT_BASE_URL),
        help="Cible principale : URL de l'instance locale d'OpenNova-Finance "
        "(défaut : %(default)s, ou $OPENNOVA_BASE_URL).",
    )
    parser.add_argument(
        "--base-url-2",
        default=os.environ.get("OPENNOVA_BASE_URL_2", ""),
        help="Cible secondaire optionnelle (ex. la copie Vercel), ou $OPENNOVA_BASE_URL_2. "
        "Le briefing y est aussi poussé ; son échec n'empêche pas la cible principale.",
    )
    parser.add_argument(
        "--ollama-url",
        default=os.environ.get("OLLAMA_URL", DEFAULT_OLLAMA_URL),
        help="URL d'Ollama (défaut : %(default)s).",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("HERMES_MODEL", DEFAULT_MODEL),
        help="Modèle Ollama (défaut : %(default)s).",
    )
    parser.add_argument(
        "--snapshot-file",
        default=None,
        help="Fichier JSON local à utiliser à la place de l'instantané serveur.",
    )
    parser.add_argument(
        "--date",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="Date du briefing, format AAAA-MM-JJ (défaut : aujourd'hui).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Génère le briefing et l'affiche, sans rien pousser vers l'application.",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    bridge_key = os.environ.get("HERMES_BRIDGE_KEY", "").strip()

    if args.snapshot_file:
        snapshot = load_snapshot_file(args.snapshot_file)
    else:
        if not bridge_key:
            fail(
                "variable HERMES_BRIDGE_KEY absente. Définissez-la (même valeur que sur le serveur) "
                "ou utilisez --snapshot-file. Voir README.md."
            )
        snapshot = fetch_snapshot(base_url, bridge_key)

    if not snapshot.get("hasState") or not snapshot.get("state"):
        fail(
            "instantané vide : aucun état de portefeuille synchronisé côté serveur. "
            "Activez la synchronisation dans OpenNova-Finance, ou fournissez un fichier local "
            "avec --snapshot-file (voir snapshot-example.json)."
        )

    user_prompt = build_user_prompt(snapshot, args.date)
    content = call_ollama(args.ollama_url, args.model, user_prompt)
    title = extract_title(content, args.date)
    print(f"3/4 Briefing généré : « {title} » ({len(content)} caractères).")

    if args.dry_run:
        print("\n----- DÉBUT DU BRIEFING (dry-run, rien n'a été envoyé) -----\n")
        print(content)
        print("\n----- FIN DU BRIEFING -----")
        return 0

    if not bridge_key:
        fail("variable HERMES_BRIDGE_KEY absente : impossible de pousser le briefing. Voir README.md.")

    symboles = snapshot.get("symboles") or []
    payload = {
        "date": args.date,
        "titre": title,
        "contenuMarkdown": content,
        "metadonnees": {
            "source": "hermes-bridge 1.0",
            "modele": args.model,
            "genereLe": datetime.now().astimezone().isoformat(),
            "symboles": [str(symbol) for symbol in symboles][:100],
        },
    }
    targets = [base_url]
    base_url_2 = (args.base_url_2 or "").strip().rstrip("/")
    if base_url_2 and base_url_2 not in targets:
        targets.append(base_url_2)

    print(f"4/4 Envoi du briefing vers {len(targets)} cible(s)…")
    successes = 0
    for target in targets:
        ok, detail = post_briefing(target, payload, bridge_key)
        if ok:
            successes += 1
            print(f"  ✓ {target} : briefing du {args.date} accepté ({detail}).")
        else:
            print(f"  ✗ {target} : échec ({detail}).", file=sys.stderr)

    if successes == 0:
        fail(
            "aucune cible n'a accepté le briefing. Vérifiez que l'application roule, "
            "que HERMES_ENABLED=true côté serveur et que la clé du pont est la bonne. Voir README.md."
        )
    if successes < len(targets):
        print(
            f"AVERTISSEMENT : {successes}/{len(targets)} cibles ont accepté le briefing.",
            file=sys.stderr,
        )
    print("Terminé.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
