#!/usr/bin/env python3
"""
Outil DevOps de surveillance (Healthcheck & JSON API) en Python.
En DevOps, on utilise Python quand on doit manipuler du JSON, appeler des API REST
(Cloudflare, Azure, GitHub, Datadog) ou envoyer des alertes (Slack / Teams).
"""

import json
import subprocess
import sys
import urllib.error
import urllib.request

URLS = [
    "https://hey-hi.ca/login.html",
    "https://biblio.hey-hi.ca/login.html",
]


def check_websites():
    print("=== [Python] Vérification des sites publics ===")
    for url in URLS:
        try:
            req = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(req, timeout=10) as response:
                print(f"[OK] {url} -> HTTP {response.status}")
        except urllib.error.URLError as err:
            print(f"[ALERTE] {url} est inaccessible : {err}")
            sys.exit(1)


def check_aks_pods_json():
    print("\n=== [Python] Analyse JSON des Pods Kubernetes (hey-hi) ===")
    # On demande à kubectl de répondre en JSON (-o json) et Python l'analyse :
    result = subprocess.run(
        ["kubectl", "get", "pods", "-n", "hey-hi", "-o", "json"],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)

    for pod in data.get("items", []):
        name = pod["metadata"]["name"]
        phase = pod["status"]["phase"]
        restarts = sum(
            c.get("restartCount", 0)
            for c in pod["status"].get("containerStatuses", [])
        )
        ip = pod["status"].get("podIP", "N/A")
        print(f"Pod: {name:30} | Statut: {phase:8} | Redémarrages: {restarts} | IP: {ip}")


if __name__ == "__main__":
    check_websites()
    check_aks_pods_json()
