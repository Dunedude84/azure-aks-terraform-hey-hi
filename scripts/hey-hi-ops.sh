#!/usr/bin/env bash
# ============================================================================
# Outil DevOps en Bash (utilisé sur Linux et dans les pipelines GitHub Actions)
# ============================================================================

# LES 3 RÈGLES D'OR DU BASH EN DEVOPS (set -euo pipefail) :
# -e : Arrête immédiatement le script si une commande échoue (équivalent de $ErrorActionPreference = "Stop")
# -u : Arrête le script si on utilise une variable qui n'existe pas
# -o pipefail : Attrape les erreurs même au milieu d'un pipe (cmd1 | cmd2)
set -euo pipefail

COMMAND="${1:-status}"   # 1er argument (par défaut : "status")
VERSION="${2:-v1.0.1}"   # 2e argument (par défaut : "v1.0.1")
NAMESPACE="hey-hi"
ACR="acrdevolutionslaba0onk.azurecr.io"

case "$COMMAND" in
  status)
    echo "=== [Bash] État des Pods sur Azure AKS ($NAMESPACE) ==="
    kubectl get pods,svc -n "$NAMESPACE" -o wide
    ;;

  test-urls)
    echo "=== [Bash] Vérification HTTP de hey-hi.ca et biblio.hey-hi.ca ==="
    for url in "https://hey-hi.ca/login.html" "https://biblio.hey-hi.ca/login.html"; do
      http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
      if [ "$http_code" -eq 200 ]; then
        echo "[OK] $url -> HTTP $http_code"
      else
        echo "[ERREUR] $url -> HTTP $http_code"
        exit 1
      fi
    done
    ;;

  rollback)
    echo "=== [Bash] Rollback d'urgence sur Azure AKS ==="
    kubectl rollout undo deployment/horaire-app -n "$NAMESPACE"
    kubectl rollout undo deployment/biblio-app -n "$NAMESPACE"
    ;;

  *)
    echo "Usage: $0 {status|test-urls|rollback} [version]"
    exit 1
    ;;
esac
