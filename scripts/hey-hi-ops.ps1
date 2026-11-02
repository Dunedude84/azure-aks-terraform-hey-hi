<#
.SYNOPSIS
    Outil interne DevOps pour opérer hey-hi.ca et biblio.hey-hi.ca sur Azure AKS.
.EXAMPLE
    .\scripts\hey-hi-ops.ps1 -Command status
    .\scripts\hey-hi-ops.ps1 -Command logs
    .\scripts\hey-hi-ops.ps1 -Command deploy -Version v1.0.2
    .\scripts\hey-hi-ops.ps1 -Command rollback
#>

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("status", "logs", "deploy", "rollback", "test-urls", "restart", "metrics")]
    [string]$Command,

    [Parameter(Mandatory=$false)]
    [string]$Version = "v1.0.1"
)

$ErrorActionPreference = "Stop"
if ($env:PATH -notlike "*Azure\CLI2\wbin*") {
    $env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
}
$ACR = "acrdevolutionslaba0onk.azurecr.io"
$Namespace = "hey-hi"

switch ($Command) {
    "status" {
        Write-Host "`n=== État des Pods et Services sur Azure AKS ($Namespace) ===" -ForegroundColor Cyan
        kubectl get pods,svc -n $Namespace -o wide
    }

    "logs" {
        Write-Host "`n=== Derniers logs de horaire-app (hey-hi.ca) ===" -ForegroundColor Cyan
        kubectl logs -l app=horaire-app -n $Namespace --tail=15
        Write-Host "`n=== Derniers logs de biblio-app (biblio.hey-hi.ca) ===" -ForegroundColor Cyan
        kubectl logs -l app=biblio-app -n $Namespace --tail=15
        Write-Host "`n=== Derniers logs du Tunnel Cloudflare ===" -ForegroundColor Cyan
        kubectl logs -l app=cloudflared -n $Namespace --tail=10
    }

    "deploy" {
        Write-Host "`n=== 1. Connexion au registre privé Azure (ACR) ===" -ForegroundColor Cyan
        az acr login --name acrdevolutionslaba0onk

        Write-Host "`n=== 2. Build & Push de la version $Version ===" -ForegroundColor Cyan
        docker build -t "$ACR/hey-hi-horaire:$Version" ./hey-hi
        docker build -t "$ACR/hey-hi-biblio:$Version" ./hey-hi/api_biblio/book-api
        docker push "$ACR/hey-hi-horaire:$Version"
        docker push "$ACR/hey-hi-biblio:$Version"

        Write-Host "`n=== 3. Déploiement Rolling Update sur Azure AKS ===" -ForegroundColor Cyan
        kubectl set image deployment/horaire-app "horaire-app=$ACR/hey-hi-horaire:$Version" -n $Namespace
        kubectl set image deployment/biblio-app "biblio-app=$ACR/hey-hi-biblio:$Version" -n $Namespace
        kubectl rollout status deployment/horaire-app -n $Namespace
        kubectl rollout status deployment/biblio-app -n $Namespace
        Write-Host "`n[SUCCÈS] Version $Version déployée sans coupure !" -ForegroundColor Green
    }

    "rollback" {
        Write-Host "`n=== Retour immédiat à la version précédente (Rollback) ===" -ForegroundColor Yellow
        kubectl apply -f ./k8s/hey-hi/deployments.yaml
        kubectl rollout status deployment/horaire-app -n $Namespace
        kubectl rollout status deployment/biblio-app -n $Namespace
        Write-Host "`n[SUCCÈS] Rollback terminé en quelques secondes !" -ForegroundColor Green
    }

    "test-urls" {
        Write-Host "`n=== Vérification HTTP de hey-hi.ca et biblio.hey-hi.ca ===" -ForegroundColor Cyan
        $r1 = Invoke-WebRequest -Uri "https://hey-hi.ca/login.html" -Method Head -UseBasicParsing
        $r2 = Invoke-WebRequest -Uri "https://biblio.hey-hi.ca/login.html" -Method Head -UseBasicParsing
        Write-Host "https://hey-hi.ca/login.html        -> HTTP $($r1.StatusCode)" -ForegroundColor Green
        Write-Host "https://biblio.hey-hi.ca/login.html -> HTTP $($r2.StatusCode)" -ForegroundColor Green
    }
    
    "restart" {
        Write-Host "`n=== Redémarrage des Pods (Rolling Restart) ===" -ForegroundColor Cyan
        kubectl rollout restart deployment/horaire-app -n $Namespace
        kubectl rollout restart deployment/biblio-app -n $Namespace
        kubectl rollout status deployment/horaire-app -n $Namespace
        kubectl rollout status deployment/biblio-app -n $Namespace
        Write-Host "`n[SUCCÈS] Pods redémarrés avec succès !" -ForegroundColor Green
    }

        "metrics" {
        Write-Host "`n=== Consommation CPU / RAM du Serveur Azure (Node) ===" -ForegroundColor Cyan
        kubectl top nodes
        Write-Host "`n=== Consommation CPU / RAM de vos Pods ($Namespace) ===" -ForegroundColor Cyan
        kubectl top pods -n $Namespace
    }
}
