#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ramassage local des briefings Nova · Muse -> OpenNova-Finance.

Modèle par tirage (décidé le 25 octobre 2026) : Nova · Muse, l'assistante
infonuagique d'Alex, ne peut pas publier directement sur l'instance locale
— la substitution d'identifiants de sa plateforme ne couvre pas la route
Tailscale. Elle dépose donc ses briefings en fichiers JSON dans la branche
« nova-outbox » du dépôt (dossier nova-briefings/, un fichier par date).

Ce script, exécuté sur le PC d'Alex (typiquement par une tâche planifiée
toutes les 30 minutes) :

1. récupère la branche nova-outbox (git fetch) ;
2. repère les fichiers nova-briefings/*.json nouveaux ou modifiés
   (empreinte SHA-256 comparée à un état local) ;
3. les publie sur l'instance locale via POST /api/hermes/briefings,
   authentifié par NOVA_BRIDGE_KEY — la clé ne quitte jamais le PC.

La republication est sans danger : l'application garantit l'unicité par
date + source (201 = créé, 200 = remplacé). Bibliothèque standard
seulement. Voir README.md, section « Ramassage des briefings
Nova · Muse ».
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

DEFAULT_BASE_URL = "http://localhost:3000"
OUTBOX_BRANCH = "nova-outbox"
OUTBOX_DIR = "nova-briefings"
STATE_NAME = ".nova-pickup-state.json"


def run_git(repo: Path, *git_args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(repo), *git_args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )


def load_state(path: Path) -> dict:
    """État local {chemin distant: empreinte SHA-256}. Vide si absent/illisible."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        empreintes = data.get("empreintes")
        if isinstance(empreintes, dict):
            return {str(k): str(v) for k, v in empreintes.items()}
    except FileNotFoundError:
        pass
    except (json.JSONDecodeError, OSError) as error:
        print(f"État local illisible ({path}) : {error}. On repart d'un état vide "
              "(la republication est sans danger).")
    return {}


def save_state(path: Path, empreintes: dict) -> None:
    payload = {
        "version": 1,
        "misAJour": datetime.now().astimezone().isoformat(timespec="seconds"),
        "empreintes": empreintes,
    }
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def list_outbox_files(repo: Path) -> list:
    result = run_git(repo, "ls-tree", "-r", "--name-only", f"origin/{OUTBOX_BRANCH}", "--", OUTBOX_DIR + "/")
    if result.returncode != 0:
        raise RuntimeError(
            f"git ls-tree sur origin/{OUTBOX_BRANCH} a échoué : {result.stderr.strip()}"
        )
    return sorted(
        line.strip()
        for line in result.stdout.splitlines()
        if line.strip().endswith(".json")
    )


def read_outbox_file(repo: Path, path: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), "show", f"origin/{OUTBOX_BRANCH}:{path}"],
        capture_output=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip())
    return result.stdout


def validate_briefing(raw: bytes):
    """Retourne (payload, None) si valide, sinon (None, motif)."""
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return None, f"JSON invalide ({error})"
    if not isinstance(payload, dict):
        return None, "le contenu n'est pas un objet JSON"
    if payload.get("source") != "nova":
        return None, f"source inattendue : {payload.get('source')!r} (attendu : 'nova')"
    for field in ("date", "titre", "contenuMarkdown"):
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            return None, f"champ « {field} » absent ou vide"
    return payload, None


def post_briefing(base_url: str, raw: bytes, bridge_key: str):
    """POST du corps JSON tel quel. Retourne (succès, détail) sans sortir."""
    url = f"{base_url}/api/hermes/briefings"
    request = urllib.request.Request(
        url,
        data=raw,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-bridge-key": bridge_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            detail = f"HTTP {response.status}"
            if response.status == 201:
                detail += " (créé)"
            elif response.status == 200:
                detail += " (remplacé)"
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


def update_muse_status(base_url: str, bridge_key: str, state: str, detail: str) -> None:
    """Met à jour le statut opérationnel de Muse sur OpenNova-Finance."""
    url = f"{base_url}/api/hermes/status"
    now_iso = datetime.now().astimezone().isoformat(timespec="seconds")
    payload = {
        "agent": "muse",
        "state": state,
        "detail": detail,
        "lastRun": now_iso,
        "hardware": "Serveurs Infonuagiques Meta AI",
        "model": "Meta AI · Llama 3.3",
        "mode": "auto",
    }
    try:
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
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ramassage des briefings Nova · Muse (branche nova-outbox) "
        "et publication sur l'instance locale d'OpenNova-Finance."
    )
    parser.add_argument(
        "--repo",
        default=str(Path(__file__).resolve().parents[2]),
        help="Racine du clone OpenNova-Finance (défaut : deux niveaux au-dessus du script).",
    )
    parser.add_argument(
        "--state",
        default=None,
        help=f"Fichier d'état local (défaut : <repo>/tools/hermes-bridge/{STATE_NAME}).",
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("OPENNOVA_BASE_URL", DEFAULT_BASE_URL),
        help="Instance locale d'OpenNova-Finance (défaut : %(default)s, ou $OPENNOVA_BASE_URL).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Récupère, liste et valide les briefings, sans rien publier ni écrire l'état.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Effectuer une seule relève des dépôts puis quitter",
    )
    args = parser.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    state_path = (
        Path(args.state).expanduser().resolve()
        if args.state
        else repo / "tools" / "hermes-bridge" / STATE_NAME
    )
    base_url = args.base_url.rstrip("/")
    bridge_key = os.environ.get("NOVA_BRIDGE_KEY", "").strip()
    if not bridge_key:
        env_local = repo / ".env.local"
        if env_local.exists():
            with open(env_local, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("NOVA_BRIDGE_KEY="):
                        bridge_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break

    if not (repo / ".git").exists():
        print(f"ERREUR : {repo} n'est pas un clone git.", file=sys.stderr)
        return 1
    if not args.dry_run and not bridge_key:
        print(
            "ERREUR : variable NOVA_BRIDGE_KEY absente. Définissez-la (même valeur que "
            "dans le .env.local de l'instance locale), ou utilisez --dry-run. Voir README.md.",
            file=sys.stderr,
        )
        return 1

    print(f"Ramassage Nova · Muse — dépôt : {repo}")
    fetched = run_git(repo, "fetch", "origin", OUTBOX_BRANCH)
    if fetched.returncode != 0:
        print(
            f"ERREUR : git fetch origin {OUTBOX_BRANCH} a échoué : {fetched.stderr.strip()}",
            file=sys.stderr,
        )
        return 1
    try:
        files = list_outbox_files(repo)
    except RuntimeError as error:
        print(f"ERREUR : {error}", file=sys.stderr)
        return 1
    if not files:
        print(f"Aucun briefing dans la boîte ({OUTBOX_DIR}/ est vide sur origin/{OUTBOX_BRANCH}).")
        return 0
    print(f"{len(files)} fichier(s) dans la boîte.")

    empreintes = load_state(state_path)
    failures = 0
    published = 0
    for path in files:
        try:
            raw = read_outbox_file(repo, path)
        except RuntimeError as error:
            print(f"  ✗ {path} : lecture impossible ({error})", file=sys.stderr)
            failures += 1
            continue
        digest = hashlib.sha256(raw).hexdigest()
        if empreintes.get(path) == digest:
            print(f"  • {path} : déjà publié, inchangé.")
            continue
        payload, problem = validate_briefing(raw)
        if problem:
            print(f"  ✗ {path} : {problem}.", file=sys.stderr)
            failures += 1
            continue
        # Attribution automatique d'un identifiant unique basé sur le nom du fichier si absent
        if "id" not in payload:
            payload["id"] = f"nova-{Path(path).stem}"
            raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        label = f"{path} (briefing du {payload['date']})"
        if args.dry_run:
            print(f"  → {label} : valide, serait publié sur {base_url}.")
            published += 1
            continue
        ok, detail = post_briefing(base_url, raw, bridge_key)
        if ok:
            published += 1
            empreintes[path] = digest
            save_state(state_path, empreintes)
            print(f"  ✓ {label} : publié ({detail}).")
            update_muse_status(base_url, bridge_key, "idle", f"Dernière publication : {payload.get('titre', path)[:60]}")
        else:
            failures += 1
            print(f"  ✗ {label} : échec de publication ({detail}).", file=sys.stderr)

    if args.dry_run:
        print(f"Dry-run terminé : {published} briefing(s) à publier, {failures} échec(s).")
    else:
        print(f"Terminé : {published} briefing(s) publié(s), {failures} échec(s).")
        if published == 0 and failures == 0:
            update_muse_status(
                base_url,
                bridge_key,
                "resting",
                "Veille active · Dépôts à jour · Prochain point pré-marché lundi ~08:05 EDT",
            )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
